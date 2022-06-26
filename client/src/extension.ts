/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	var platformDirName: string = "win";
	if (process.platform == 'win32')
	{
		platformDirName = "win-x32";
	}
	else if (process.platform == 'darwin')
	{
		platformDirName = "darwin"
	}
	else
	{
		platformDirName = "linux-x64";
	}
	const serverModule = context.asAbsolutePath(
		path.join('server', 'bin', platformDirName, 'slangd')
	);
	const serverOptions: ServerOptions = {
		run : { command: serverModule, transport: TransportKind.stdio},
		debug: {command: serverModule, transport: TransportKind.stdio
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
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
