import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, workspace } from 'vscode';

import * as fs from 'fs';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { Worker } from 'worker_threads';
import { CompileRequest, EntrypointsRequest, EntrypointsResult, Result, ServerInitializationOptions, Shader, WorkerRequest } from '../../shared/playgroundInterface';
import { PlaygroundImportQuickFixProvider } from './native/playgroundQuickFix';
import { getSlangdLocation } from './native/slangd';
import { SlangSynthesizedCodeProvider } from './native/synth_doc_provider';
import { getSlangFilesWithContents, sharedActivate } from './sharedClient';

let client: LanguageClient;
let worker: Worker;


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
	// Register quick fix provider for playground import errors
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(
			{ language: 'slang', scheme: 'file' },
			new PlaygroundImportQuickFixProvider(),
			{ providedCodeActionKinds: PlaygroundImportQuickFixProvider.providedCodeActionKinds }
		)
	);

	// Register command to create playground.slang if missing
	context.subscriptions.push(
		vscode.commands.registerCommand('slang.createPlaygroundSlang', async (uri: vscode.Uri) => {
			const dir = path.dirname(uri.fsPath);
			const playgroundPath = path.join(dir, 'playground.slang');
			if (fs.existsSync(playgroundPath)) {
				vscode.window.showInformationMessage('playground.slang already exists in this directory.');
				return;
			}
			// Copy from extension's server/src/slang/playground.slang
			let srcPath = path.join(context.extensionPath, 'server', 'src', 'slang', 'playground.slang');
			// Fallback if running from source
			if (!fs.existsSync(srcPath)) {
				srcPath = path.join(__dirname, '../../server/src/slang/playground.slang');
			}
			if (!fs.existsSync(srcPath)) {
				vscode.window.showErrorMessage('Could not find playground.slang template in extension.');
				return;
			}
			fs.copyFileSync(srcPath, playgroundPath);
			vscode.window.showInformationMessage('playground.slang created in this directory.');
			// Optionally open the new file
			const doc = await vscode.workspace.openTextDocument(playgroundPath);
			vscode.window.showTextDocument(doc);
		})
	);
	const serverModule = getSlangdLocation(context);
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

	// Initialize language server options, including the implicit playground.slang file.
	const playgroundUri = vscode.Uri.file(path.join(context.extensionPath, 'server', 'src', 'slang', 'playground.slang'));
	const playgroundDocument = await vscode.workspace.openTextDocument(playgroundUri);
	const initializationOptions: ServerInitializationOptions = {
		extensionUri: context.extensionUri.toString(true),
		workspaceUris: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath) : [],
		files: [... await getSlangFilesWithContents(), {uri: playgroundUri.toString(), content: playgroundDocument.getText() }]
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
					if (result.succ == true) {
						resolve(result);
					} else {
						reject(new Error(result.message));
					}
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