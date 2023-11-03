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
	var arch = process.arch;
	var slangdLoc: string = workspace.getConfiguration("slang").get("slangdLocation", "");
	if (slangdLoc == "") {
		if (process.platform == 'win32') {
			platformDirName = "win";
		}
		else if (process.platform == 'darwin') {
			platformDirName = "darwin";
			if (arch != 'arm64')
				arch = 'x64';
		}
		else {
			platformDirName = "linux";
			arch = 'x64';
		}
		slangdLoc = context.asAbsolutePath(path.join('server', 'bin', platformDirName + '-' + arch, 'slangd'));
	}
	const serverModule = slangdLoc;
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
