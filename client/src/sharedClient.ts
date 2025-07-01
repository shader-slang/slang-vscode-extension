/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Uri, commands, window, workspace } from 'vscode';
import * as vscode from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';

import { LanguageClient } from 'vscode-languageclient/browser';
import type { CompileRequest, EntrypointsRequest, EntrypointsResult, PlaygroundMessage, Result, Shader } from '../../shared/playgroundInterface';
import { checkShaderType, getResourceCommandsFromAttributes, getUniformControllers, getUniformSize, isControllerRendered, parseCallCommands } from "../../shared/util.js";

const compileOptions = ['SPIRV', 'HLSL', 'GLSL', 'METAL', 'WGSL', 'CUDA'] as const;
type LanguageOptions = {
	languageId: string,
	requiresEntrypoint: boolean,
}
const compileOptionMap: { [k in (typeof compileOptions)[number]]: LanguageOptions } = {
	SPIRV: {
		languageId: 'spirv',
		requiresEntrypoint: false,
	},
	HLSL: {
		languageId: 'hlsl',
		requiresEntrypoint: true,
	},
	GLSL: {
		languageId: 'glsl',
		requiresEntrypoint: true,
	},
	METAL: {
		languageId: 'metal',
		requiresEntrypoint: false,
	},
	WGSL: {
		languageId: 'wgsl',
		requiresEntrypoint: false,
	},
	CUDA: {
		languageId: 'cuda-cpp',
		requiresEntrypoint: true
	}
}

export async function getSlangFilesWithContents(): Promise<{ uri: string, content: string }[]> {
	const pattern = '**/*.slang';
	const files = await vscode.workspace.findFiles(pattern);

	const results: { uri: string, content: string }[] = [];

	for (const uri of files) {
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			results.push({ uri: uri.toString(true), content: document.getText() });
		} catch (err) {
			console.error(`Failed to read ${uri.fsPath}:`, err);
		}
	}

	return results;
}

export type SlangHandler = {
	compileShader: (parameter: CompileRequest) => Promise<Result<Shader>>;
	entrypoints: (parameter: EntrypointsRequest) => Promise<EntrypointsResult>;
};

// this method is called when vs code is activated
export async function sharedActivate(context: ExtensionContext, slangHandler: SlangHandler) {
	// Register Playground Run command to open a webview
	context.subscriptions.push(
		commands.registerCommand('slang.playgroundRun', async () => {
			const userSource = window.activeTextEditor.document.getText();
			const userURI = window.activeTextEditor.document.uri;
			const shaderType = checkShaderType(userSource);
			if (shaderType == null) {
				vscode.window.showErrorMessage("Error: In order to run the shader, please define either imageMain or printMain function in the shader code.");
				return;
			}
			const compileResult = await slangHandler.compileShader({
				target: "WGSL",
				entrypoint: shaderType,
				sourceCode: userSource,
				shaderPath: window.activeTextEditor.document.uri.toString(true),
				noWebGPU: false,
			});
			if (compileResult.succ == false) {
				vscode.window.showErrorMessage(compileResult.message);
				return;
			}
			const compilation = compileResult.result;

			let resourceCommandsResult = getResourceCommandsFromAttributes(compilation.reflection);
			if(resourceCommandsResult.succ == false) {
				vscode.window.showErrorMessage("Error while parsing Resource commands: " + resourceCommandsResult.message);
				return;
			}
			let uniformSize = getUniformSize(compilation.reflection)
			let uniformComponents = getUniformControllers(resourceCommandsResult.result)

			let callCommandResult = parseCallCommands(compilation.reflection);
			if(callCommandResult.succ == false) {
				vscode.window.showErrorMessage("Error while parsing CALL commands: " + callCommandResult.message);
				return;
			}

			const panel = window.createWebviewPanel(
				'slangPlayground',
				'Slang Playground',
				vscode.ViewColumn.Beside,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
				}
			);
			panel.webview.html = getWebviewContent(context, panel, 'client/dist/webviewBundle.js', 'client/dist/webviewBundle.css');

			if (shaderType === 'printMain') {
				const shaderOutputLog = vscode.window.createOutputChannel(`Slang Shader Output (${window.activeTextEditor.document.fileName})`);
				panel.webview.onDidReceiveMessage(message => {
					if (message.type === 'log') {
						shaderOutputLog.append(message.text);
						shaderOutputLog.show(true);
					}
				});
				panel.onDidDispose(() => {
					shaderOutputLog.dispose();
				});
			}

			let message: PlaygroundMessage = {
				type: "init",
				payload: {
					slangSource: userSource,
					callCommands: callCommandResult.result,
					mainEntryPoint: shaderType,
					resourceCommands: resourceCommandsResult.result,
					uniformComponents,
					uniformSize,
					shader: compilation,
					uri: panel.webview.asWebviewUri(userURI).toString(),
				},
			};
			panel.webview.postMessage(message)

			if(uniformComponents.some(isControllerRendered)) {
				const uniform_panel = window.createWebviewPanel(
					'slangPlaygroundUniforms',
					'Slang Playground Uniforms',
					vscode.ViewColumn.Beside,
					{
						enableScripts: true,
						retainContextWhenHidden: true,
					}
				);
				uniform_panel.webview.html = getWebviewContent(context, uniform_panel, "client/dist/uniformWebviewBundle.js", "client/dist/uniformWebviewBundle.css");
				uniform_panel.webview.onDidReceiveMessage(uniform_message => {
					console.log("uniform update:", uniform_message)
					if (uniform_message.type === 'update') {
						let playground_message: PlaygroundMessage = {
							type: "uniformUpdate",
							payload: uniform_message.data,
						};
						panel.webview.postMessage(playground_message)
					}
				});
				uniform_panel.webview.postMessage({
					type: "init",
					uniformComponents,
				})

				panel.onDidDispose(() => {
					try {
						uniform_panel.dispose()
					} catch {
						// ignore if panel was already disposed
					}
				})
			}
		})
	);
	// Register a virtual document content provider for readonly docs
	const slangVirtualScheme = 'slang-virtual';
	const virtualDocumentContents = new Map();

	context.subscriptions.push(
		workspace.registerTextDocumentContentProvider(slangVirtualScheme, {
			provideTextDocumentContent: (uri) => {
				return virtualDocumentContents.get(uri.path.slice(1));
			}
		})
	);

	// Register the user command
	context.subscriptions.push(commands.registerCommand('slang.compile', async () => {
		const targetSelection = await window.showQuickPick(compileOptions, {
			placeHolder: 'Select a Target',
		}) as (typeof compileOptions)[number] | undefined;
		if (!targetSelection) {
			return;
		}
		const userSource = window.activeTextEditor.document.getText() ?? '';
		let selectedEntrypoint = ""
		if (compileOptionMap[targetSelection].requiresEntrypoint) {
			// Send the picked option to the server and get the result
			const parameter: EntrypointsRequest = {
				sourceCode: userSource,
				shaderPath: window.activeTextEditor.document.uri.toString(true),
			}
			let entrypoints: EntrypointsResult = await slangHandler.entrypoints(parameter);
			const entrypointSelection = await window.showQuickPick(entrypoints, {
				placeHolder: 'Select a Entrypoint',
			}) as (typeof compileOptions)[number] | undefined;
			if (!entrypointSelection) {
				return;
			}
			selectedEntrypoint = entrypointSelection;
		}
		// Send the picked option to the server and get the result
		let compilationResult = await slangHandler.compileShader({
			target: targetSelection,
			entrypoint: selectedEntrypoint,
			sourceCode: userSource,
			shaderPath: window.activeTextEditor.document.uri.toString(true),
			noWebGPU: true,
		});
		if (compilationResult.succ == false) {
			vscode.window.showErrorMessage(compilationResult.message);
			return;
		}
		const shader = compilationResult.result;
		const vDocName = `Slang Compile (${targetSelection})`
		// Show the result in a readonly virtual document
		const vdocUri = Uri.parse(`${slangVirtualScheme}:/${vDocName}`);
		virtualDocumentContents.set(vDocName, shader.code);
		const doc = await workspace.openTextDocument(vdocUri);
		await window.showTextDocument(doc, { preview: false, viewColumn: window.activeTextEditor?.viewColumn }).then(editor => {
			vscode.languages.setTextDocumentLanguage(doc, compileOptionMap[targetSelection].languageId);
		});
	}));

	context.subscriptions.push(commands.registerCommand('slang.reflection', async () => {
		const userSource = window.activeTextEditor.document.getText() ?? '';
		// Send the picked option to the server and get the result
		let compilationResult = await slangHandler.compileShader({
			target: "WGSL",
			entrypoint: "",
			sourceCode: userSource,
			shaderPath: window.activeTextEditor.document.uri.toString(true),
			noWebGPU: true,
		});
		if (compilationResult.succ == false) {
			vscode.window.showErrorMessage(compilationResult.message);
			return;
		}
		const shader = compilationResult.result;
		const vDocName = `Slang Reflection (${window.activeTextEditor.document.fileName.replace('\\', "")})`
		// Show the result in a readonly virtual document
		const vdocUri = Uri.parse(`${slangVirtualScheme}:/${vDocName}`);
		virtualDocumentContents.set(vDocName, JSON.stringify(shader.reflection, undefined, 4));
		const doc = await workspace.openTextDocument(vdocUri);
		await window.showTextDocument(doc, { preview: false, viewColumn: window.activeTextEditor?.viewColumn }).then(editor => {
			vscode.languages.setTextDocumentLanguage(doc, "json");
		});
	}));

	context.subscriptions.push(commands.registerCommand('slang.playgroundDocumentation', async () => {
		const mdFile = vscode.Uri.joinPath(context.extensionUri, 'media', 'playgroundDocumentation.md')
		await vscode.commands.executeCommand('markdown.showPreviewToSide', mdFile);
	}));
}

export function getWebviewContent(context: ExtensionContext, panel: vscode.WebviewPanel, scriptPath: string, stylePath: string): string {
	// Webview HTML with script tag for the esbuild webview bundle
	const webviewMain = panel.webview.asWebviewUri(Uri.joinPath(context.extensionUri, scriptPath));
	const webviewStyle = panel.webview.asWebviewUri(Uri.joinPath(context.extensionUri, stylePath));
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Slang Playground</title>
      	<link rel="stylesheet" href="${webviewStyle.toString(true)}">
		<script type="module" src="${webviewMain.toString(true)}"></script>
		<style>
			#app {
			    position: absolute;
				left: 0;
				right: 0;
				bottom: 0;
				top: 0;
			}
		</style>
	</head>
	<body>
	<div id="app">
		<p>Loading</p>
	</div>
	</body>
	</html>
`;
}
