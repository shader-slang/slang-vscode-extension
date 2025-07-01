import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, ExtensionContext, Uri } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { getSlangFilesWithContents, sharedActivate } from './sharedClient';
import { Worker } from 'worker_threads';
import { CompileRequest, EntrypointsRequest, EntrypointsResult, Result, ServerInitializationOptions, Shader, WorkerRequest } from '../../shared/playgroundInterface';

let client: LanguageClient;
let worker: Worker;

export async function activate(context: ExtensionContext) {
	let slangdLoc = workspace.getConfiguration("slang").get("slangdLocation", "");
	if (slangdLoc === "") slangdLoc = context.asAbsolutePath(
		path.join('server', 'bin', process.platform + '-' + process.arch, 'slangd')
	)
	const serverModule = slangdLoc;
	const serverOptions: ServerOptions = {
		run: { command: serverModule, transport: TransportKind.stdio },
		debug: {
			command: serverModule, transport: TransportKind.stdio
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

	const initializationOptions: ServerInitializationOptions = {
		extensionUri: context.extensionUri.toString(true),
		workspaceUris: vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath),
		files: await getSlangFilesWithContents(),
	}
	worker = new Worker(path.join(context.extensionPath, 'server', 'dist', 'nativeServerMain.js'), {
		workerData: initializationOptions
	});
	sendMessageToWorker({ type: 'Initialize', initializationOptions: initializationOptions });

	sharedActivate(context, {
		compileShader: function (parameter: CompileRequest): Promise<Result<Shader>> {
			sendMessageToWorker({ type: 'slang/compile', ...parameter });
			return new Promise((resolve, reject) => {
				worker.once('message', (result: Result<Shader>) => {
					console.log('Received compile result from worker', result);
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