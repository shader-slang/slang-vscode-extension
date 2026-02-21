import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, workspace } from 'vscode';

import * as fs from 'fs';
import { spawn } from 'child_process';
import {
	LanguageClient,
	LanguageClientOptions,
	Middleware,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { Worker } from 'worker_threads';
import { CompiledPlayground, CompileRequest, EntrypointsRequest, EntrypointsResult, Result, ServerInitializationOptions, Shader, WorkerRequest } from 'slang-playground-shared';
import { getSlangdLocation } from './native/slangd';
import { SlangSynthesizedCodeProvider } from './native/synth_doc_provider';
import { getSlangFilesWithContents, sharedActivate } from './sharedClient';

let client: LanguageClient;
let worker: Worker;

const PYTHON_LOOKUP_TIMEOUT_MS = 2000;

function canFindSlangpyInUserSearchPaths(): boolean {
	const configuredSearchPathsRaw = vscode.workspace.getConfiguration('slang').get<unknown>('additionalSearchPaths', []);
	const configuredSearchPaths = Array.isArray(configuredSearchPathsRaw)
		? configuredSearchPathsRaw
			.filter((searchPath): searchPath is string => typeof searchPath === 'string' && searchPath.trim().length > 0)
			.map((searchPath) => searchPath.trim())
		: [];
	const workspaceRoots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];

	for (const configuredPath of configuredSearchPaths) {
		const candidatePaths = path.isAbsolute(configuredPath)
			? [configuredPath]
			: workspaceRoots.map((workspaceRoot) => path.resolve(workspaceRoot, configuredPath));

		for (const candidatePath of candidatePaths) {
			if (fs.existsSync(path.join(candidatePath, 'slangpy.slang'))) {
				return true;
			}
		}
	}
	return false;
}

async function findSlangpySearchPath(): Promise<string | undefined> {
	let pythonInterpreterPath: string | undefined;
	try {
		pythonInterpreterPath = await vscode.commands.executeCommand<string>('python.interpreterPath');
	} catch {
		pythonInterpreterPath = undefined;
		console.warn('Python interpreter command is unavailable; falling back to Python settings/path lookup.');
	}
	const interpreters = Array.from(new Set([
		pythonInterpreterPath,
		workspace.getConfiguration('python').get<string>('defaultInterpreterPath'),
		workspace.getConfiguration('python').get<string>('pythonPath'),
		'python',
	])).filter((value): value is string => !!value && value.trim().length > 0);

	for (const interpreter of interpreters) {
		const found = await new Promise<string | undefined>((resolve) => {
			const pythonScript = `
import importlib.util
import pathlib
spec = importlib.util.find_spec("slangpy")
if not spec:
    raise SystemExit(0)
roots = []
if spec.submodule_search_locations:
    roots.extend(pathlib.Path(p).resolve() for p in spec.submodule_search_locations)
if spec.origin:
    roots.append(pathlib.Path(spec.origin).resolve().parent)
for root in roots:
    direct_candidates = [root / "slangpy.slang", root / "slang" / "slangpy.slang"]
    for match in direct_candidates:
        if match.is_file():
            print(match.parent)
            raise SystemExit(0)
    for match in root.rglob("slangpy.slang"):
        if match.is_file():
            print(match.parent)
            raise SystemExit(0)
`;
			if ((interpreter.includes(path.sep) || path.isAbsolute(interpreter)) && (!fs.existsSync(interpreter) || !fs.statSync(interpreter).isFile())) {
				resolve(undefined);
				return;
			}
			const pythonProcess = spawn(interpreter, ['-c', pythonScript], { stdio: ['ignore', 'pipe', 'ignore'] });
			const timeout = setTimeout(() => {
				pythonProcess.kill();
				resolve(undefined);
			}, PYTHON_LOOKUP_TIMEOUT_MS);
			let output = '';
			pythonProcess.stdout.on('data', (chunk) => {
				output += chunk.toString();
			});
			pythonProcess.on('error', () => {
				clearTimeout(timeout);
				console.warn(`Failed to run Python interpreter for slangpy detection: ${interpreter}`);
				resolve(undefined);
			});
			pythonProcess.on('close', (code) => {
				clearTimeout(timeout);
				if (code !== 0) {
					resolve(undefined);
					return;
				}
				const foundPath = output.trim().split(/\r?\n/)[0];
				resolve(foundPath && fs.existsSync(foundPath) ? foundPath : undefined);
			});
		});
		if (found) {
			return found;
		}
	}

	return undefined;
}

function withSlangpySearchPathMiddleware(
	originalMiddleware: Middleware | undefined,
	slangpySearchPath: string | undefined,
): Middleware | undefined {
	if (!slangpySearchPath) {
		return originalMiddleware;
	}
	return {
		...originalMiddleware,
		workspace: {
			...originalMiddleware?.workspace,
			configuration: async (params, token, next) => {
				const values = await (originalMiddleware?.workspace?.configuration?.(params, token, next) ?? next(params, token));
				if (!Array.isArray(values) || !Array.isArray(params.items)) {
					return values;
				}
				for (let i = 0; i < params.items.length; i++) {
					const section = params.items[i]?.section;
					if (section === 'slang.additionalSearchPaths') {
						const searchPaths = Array.isArray(values[i]) ? values[i] : [];
						if (!searchPaths.includes(slangpySearchPath)) {
							values[i] = [...searchPaths, slangpySearchPath];
						}
					}
					if (section === 'slang') {
						const sectionValue = typeof values[i] === 'object' && values[i] !== null ? values[i] : {};
						const sectionConfig = sectionValue as { additionalSearchPaths?: unknown };
						const searchPaths = Array.isArray(sectionConfig.additionalSearchPaths)
							? sectionConfig.additionalSearchPaths.filter((entry): entry is string => typeof entry === 'string')
							: [];
						if (!searchPaths.includes(slangpySearchPath)) {
							values[i] = { ...sectionValue, additionalSearchPaths: [...searchPaths, slangpySearchPath] };
						}
					}
				}
				return values;
			},
		},
	};
}


function sendDidOpenTextDocument(document: vscode.TextDocument) {
	if (document.languageId !== 'slang') return;
	sendMessageToWorker({
		type: 'DidOpenTextDocument',
		textDocument: {
			uri: document.uri.toString(),
			text: document.getText(),
		}
	});
}


function sendDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
	const document = event.document;
	if (document.languageId !== 'slang') return;
	sendMessageToWorker({
		type: 'DidChangeTextDocument',
		textDocument: {
			uri: document.uri.toString(),
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
	});
}

export async function activate(context: ExtensionContext) {
	const serverModule = getSlangdLocation(context);
	const slangpySearchPath = canFindSlangpyInUserSearchPaths() ? undefined : await findSlangpySearchPath();
	const serverOptions: ServerOptions = {
		run: { command: serverModule, transport: TransportKind.stdio },
		debug: {
			command: serverModule, transport: TransportKind.stdio,
			//	, args: ["--debug"]
		}
	};
	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'slang' }],
		middleware: withSlangpySearchPathMiddleware(undefined, slangpySearchPath),
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'slangLanguageServer',
		'Slang Language Server',
		serverOptions,
		clientOptions
	);
	// Start the client. This will also launch the server
	client.start();

	let synthCodeProvider = new SlangSynthesizedCodeProvider();
	synthCodeProvider.extensionContext = context;

	context.subscriptions.push(
		workspace.registerTextDocumentContentProvider('slang-synth', synthCodeProvider)
	);

	// Initialize language server options, including the implicit playground.slang file and other embedded slang files.
	const slangDir = path.join(context.extensionPath, 'external', 'slang-playground', 'engine', 'slang-compilation-engine', 'src', 'slang');
	let embeddedSlangFiles: { uri: string, content: string }[] = [];
	if (fs.existsSync(slangDir)) {
		const names = fs.readdirSync(slangDir);
		for (const name of names) {
			if(!name.endsWith(".slang")) continue;
			const fileUri = vscode.Uri.file(path.join(slangDir, name));
			const fileDocument = await vscode.workspace.openTextDocument(fileUri);
			embeddedSlangFiles.push({ uri: fileUri.toString(), content: fileDocument.getText() });
		}
	}
	const initializationOptions: ServerInitializationOptions = {
		extensionUri: context.extensionUri.toString(true),
		workspaceUris: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath) : [],
		files: [
			... await getSlangFilesWithContents(),
			...embeddedSlangFiles
		]
	}
	worker = new Worker(path.join(context.extensionPath, 'server', 'dist', 'nativeServerMain.js'), {
		workerData: initializationOptions
	});
	sendMessageToWorker({ type: 'Initialize', initializationOptions: initializationOptions });

	// Listen for document open/change events
	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(sendDidOpenTextDocument),
		vscode.workspace.onDidChangeTextDocument(sendDidChangeTextDocument)
	);

	sharedActivate(context, {
		compileShader: function (parameter: CompileRequest): Promise<Result<Shader>> {
			sendMessageToWorker({ type: 'slang/compile', ...parameter });
			return new Promise((resolve, reject) => {
				worker.once('message', (result: Result<Shader>) => {
					resolve(result);
				});
			});
		},
		compilePlayground: function (parameter: CompileRequest & { uri: string }): Promise<Result<CompiledPlayground>> {
			sendMessageToWorker({ type: 'slang/compilePlayground', ...parameter });
			return new Promise((resolve, reject) => {
				worker.once('message', (result: Result<CompiledPlayground>) => {
					resolve(result);
				});
			});
		},
		entrypoints: function (parameter: EntrypointsRequest): Promise<EntrypointsResult> {
			sendMessageToWorker({ type: 'slang/entrypoints', ...parameter });
			return new Promise((resolve, reject) => {
				worker.once('message', (result: EntrypointsResult) => {
					resolve(result);
				});
			});
		}
	});
}

export function sendMessageToWorker(message: WorkerRequest) {
	worker.postMessage(message);
}

export function deactivate(): Thenable<void> | undefined {
	if (worker) {
		worker.terminate();
	}
	if (!client) {
		return undefined;
	}
	client.stop();
}
