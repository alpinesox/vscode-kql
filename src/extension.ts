import * as vscode from "vscode";
import {
  COMPLETION_FUNCTIONS,
  COMPLETION_KEYWORDS,
  COMPLETION_OPERATORS,
  COMPLETION_TYPES,
  formatKql,
  parseKql
} from "./kql";

const KQL_SELECTOR: vscode.DocumentSelector = { language: "kql", scheme: "file" };

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection("kql");
  context.subscriptions.push(diagnostics);

  const refreshDiagnostics = (document: vscode.TextDocument): void => {
    if (document.languageId !== "kql") return;
    diagnostics.set(document.uri, toVscodeDiagnostics(document));
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(KQL_SELECTOR, {
      provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        return [vscode.TextEdit.replace(fullRange, formatKql(document.getText()))];
      }
    }),
    vscode.languages.registerCompletionItemProvider(KQL_SELECTOR, {
      provideCompletionItems(): vscode.CompletionItem[] {
        return [
          ...COMPLETION_KEYWORDS.map((value) => completion(value, vscode.CompletionItemKind.Keyword)),
          ...COMPLETION_FUNCTIONS.map((value) => completion(value, vscode.CompletionItemKind.Function)),
          ...COMPLETION_OPERATORS.map((value) => completion(value, vscode.CompletionItemKind.Operator)),
          ...COMPLETION_TYPES.map((value) => completion(value, vscode.CompletionItemKind.TypeParameter))
        ];
      }
    }),
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri))
  );

  for (const document of vscode.workspace.textDocuments) refreshDiagnostics(document);
}

export function deactivate(): void {}

function completion(value: string, kind: vscode.CompletionItemKind): vscode.CompletionItem {
  const item = new vscode.CompletionItem(value, kind);
  item.insertText = value;
  return item;
}

function toVscodeDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
  return parseKql(document.getText()).diagnostics.map((diagnostic) => {
    const range = new vscode.Range(document.positionAt(diagnostic.start), document.positionAt(diagnostic.end));
    return new vscode.Diagnostic(
      range,
      diagnostic.message,
      diagnostic.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
    );
  });
}
