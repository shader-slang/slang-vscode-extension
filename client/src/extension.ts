/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { workspace, ExtensionContext } from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import {getSlangdLocation} from './slangd';
import { SlangSynthesizedCodeProvider } from './synth_doc_provider';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	const serverModule = getSlangdLocation(context);
	const serverOptions: ServerOptions = {
		run : { command: serverModule, transport: TransportKind.stdio},
		debug: {command: serverModule, transport: TransportKind.stdio,
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
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
