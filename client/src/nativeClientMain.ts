import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, workspace } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { Worker } from 'worker_threads';
import { CompiledPlayground, CompileRequest, EntrypointsRequest, EntrypointsResult, Result, ServerInitializationOptions, Shader, WorkerRequest } from 'slang-playground-shared';
import { getSlangdLocation } from './native/slangd';
import { SlangSynthesizedCodeProvider } from './native/synth_doc_provider';
import { getSlangFilesWithContents, getWorkspaceFilePreloadErrorMessage, sharedActivate } from './sharedClient';
import { expandSlangSettingsInConfiguration } from './configVariables';

let client: LanguageClient | undefined;
let worker: Worker | undefined;
let workerInitialization: Promise<Worker> | undefined;
let workerRequestQueue: Promise<void> = Promise.resolve();

function postDidOpenTextDocument(target: Worker, document: vscode.TextDocument): void {
	if (document.languageId !== 'slang') return;
	target.postMessage({
		type: 'DidOpenTextDocument',
		textDocument: {
			uri: document.uri.toString(),
			text: document.getText(),
		}
	} satisfies WorkerRequest);
}

function sendDidOpenTextDocument(document: vscode.TextDocument): void {
	if (worker) postDidOpenTextDocument(worker, document);
}

function sendDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
	if (!worker || event.document.languageId !== 'slang') return;
	worker.postMessage({
		type: 'DidChangeTextDocument',
		textDocument: {
			uri: event.document.uri.toString(),
		},
		contentChanges: event.contentChanges.map(change => ({
			range: {
				start: {
					character: change.range.start.character,
					line: change.range.start.line,
				},
				end: {
					character: change.range.end.character,
					line: change.range.end.line,
				},
			},
			text: change.text
		}))
	} satisfies WorkerRequest);
}

async function getEmbeddedSlangFiles(context: ExtensionContext): Promise<{ uri: string, content: string }[]> {
	const slangDir = vscode.Uri.file(path.join(
		context.extensionPath,
		'external',
		'slang-playground',
		'engine',
		'slang-compilation-engine',
		'src',
		'slang',
	));
	let entries: [string, vscode.FileType][];
	try {
		entries = await workspace.fs.readDirectory(slangDir);
	} catch (error) {
		if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') return [];
		throw error;
	}

	const decoder = new TextDecoder();
	const files: { uri: string, content: string }[] = [];
	for (const [name, type] of entries) {
		if (type !== vscode.FileType.File || !name.endsWith('.slang')) continue;
		const uri = vscode.Uri.joinPath(slangDir, name);
		files.push({ uri: uri.toString(false), content: decoder.decode(await workspace.fs.readFile(uri)) });
	}
	return files;
}

async function createInitializationOptions(
	context: ExtensionContext,
	token: vscode.CancellationToken,
): Promise<ServerInitializationOptions> {
	const [workspaceFiles, embeddedFiles] = await Promise.all([
		getSlangFilesWithContents(token),
		getEmbeddedSlangFiles(context),
	]);
	return {
		extensionUri: context.extensionUri.toString(true),
		workspaceUris: workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? [],
		files: [...workspaceFiles, ...embeddedFiles],
	};
}

function requestWorker<T>(target: Worker, message: WorkerRequest): Promise<T> {
	return new Promise((resolve, reject) => {
		const onMessage = (result: T) => {
			cleanup();
			resolve(result);
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const onExit = (code: number) => {
			cleanup();
			reject(new Error(`Slang playground worker exited with code ${code}.`));
		};
		const cleanup = () => {
			target.off('message', onMessage);
			target.off('error', onError);
			target.off('exit', onExit);
		};

		target.once('message', onMessage);
		target.once('error', onError);
		target.once('exit', onExit);
		target.postMessage(message);
	});
}

async function initializeWorker(context: ExtensionContext): Promise<Worker> {
	return vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: 'Loading Slang workspace modules',
			cancellable: true,
		},
		async (_progress, token) => {
			const initializationOptions = await createInitializationOptions(context, token);
			const candidate = new Worker(path.join(context.extensionPath, 'server', 'dist', 'nativeServerMain.js'));
			const cancellation = token.onCancellationRequested(() => void candidate.terminate());
			try {
				const result = await requestWorker<Result<undefined>>(candidate, {
					type: 'Initialize',
					initializationOptions,
				});
				if (result.succ === false) throw new Error(result.message);
			} catch (error) {
				await candidate.terminate();
				throw error;
			} finally {
				cancellation.dispose();
			}

			worker = candidate;
			candidate.once('exit', () => {
				if (worker === candidate) {
					worker = undefined;
					workerInitialization = undefined;
				}
			});
			for (const document of workspace.textDocuments) {
				postDidOpenTextDocument(candidate, document);
			}
			return candidate;
		},
	);
}

async function getWorker(context: ExtensionContext): Promise<Worker> {
	if (worker) return worker;
	if (!workerInitialization) {
		workerInitialization = initializeWorker(context).catch(error => {
			workerInitialization = undefined;
			throw error;
		});
	}
	return workerInitialization;
}

function enqueueWorkerRequest<T>(context: ExtensionContext, message: WorkerRequest): Promise<T> {
	const request = workerRequestQueue.then(async () => requestWorker<T>(await getWorker(context), message));
	workerRequestQueue = request.then(() => undefined, () => undefined);
	return request;
}

function errorResult<T>(error: unknown): Result<T> {
	return {
		succ: false,
		message: getWorkspaceFilePreloadErrorMessage(error),
		log: error instanceof Error ? error.stack ?? error.message : String(error),
	};
}

export async function activate(context: ExtensionContext) {
	const serverModule = getSlangdLocation(context);
	const serverOptions: ServerOptions = {
		run: { command: serverModule, transport: TransportKind.stdio },
		debug: {
			command: serverModule, transport: TransportKind.stdio,
			//	, args: ["--debug"]
		}
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'slang' }],
		middleware: {
			workspace: {
				configuration: async (params, token, next) => {
					const values = await next(params, token);
					if (!Array.isArray(values)) return values;
					return values.map((value, index) => expandSlangSettingsInConfiguration(
						value,
						params.items[index]?.section,
						params.items[index]?.scopeUri,
					));
				},
			},
		},
	};

	client = new LanguageClient(
		'slangLanguageServer',
		'Slang Language Server',
		serverOptions,
		clientOptions
	);
	await client.start();

	const synthCodeProvider = new SlangSynthesizedCodeProvider();
	synthCodeProvider.extensionContext = context;
	context.subscriptions.push(
		workspace.registerTextDocumentContentProvider('slang-synth', synthCodeProvider),
		workspace.onDidOpenTextDocument(sendDidOpenTextDocument),
		workspace.onDidChangeTextDocument(sendDidChangeTextDocument),
	);

	sharedActivate(context, {
		compileShader: async (parameter: CompileRequest): Promise<Result<Shader>> => {
			try {
				return await enqueueWorkerRequest<Result<Shader>>(context, { type: 'slang/compile', ...parameter });
			} catch (error) {
				return errorResult(error);
			}
		},
		compilePlayground: async (parameter: CompileRequest & { uri: string }): Promise<Result<CompiledPlayground>> => {
			try {
				return await enqueueWorkerRequest<Result<CompiledPlayground>>(context, { type: 'slang/compilePlayground', ...parameter });
			} catch (error) {
				return errorResult(error);
			}
		},
		entrypoints: async (parameter: EntrypointsRequest): Promise<Result<EntrypointsResult>> => {
			try {
				return await enqueueWorkerRequest<Result<EntrypointsResult>>(context, { type: 'slang/entrypoints', ...parameter });
			} catch (error) {
				return errorResult(error);
			}
		},
	});
}

export async function deactivate(): Promise<void> {
	const target = worker;
	worker = undefined;
	workerInitialization = undefined;
	if (target) await target.terminate();
	if (client) await client.stop();
}
