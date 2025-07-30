import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class PlaygroundImportQuickFixProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeAction[]> {
        const diagnostics = context.diagnostics.filter(d => this.isPlaygroundImportError(d));
        if (diagnostics.length === 0) return;

        const actions: vscode.CodeAction[] = [];
        for (const diagnostic of diagnostics) {
            const action = new vscode.CodeAction(
                'Create playground.slang in this directory',
                vscode.CodeActionKind.QuickFix
            );
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            action.command = {
                title: 'Create playground.slang',
                command: 'slang.createPlaygroundSlang',
                arguments: [document.uri]
            };
            actions.push(action);
        }
        return actions;
    }

    private isPlaygroundImportError(diagnostic: vscode.Diagnostic): boolean {
        // Heuristic: error message contains 'playground' and 'not found' or 'cannot find'
        const msg = diagnostic.message.toLowerCase();
        return msg.includes('cannot open file \'playground.slang\'');
    }
}
