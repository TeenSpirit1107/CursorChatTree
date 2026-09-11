import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { getWorkspaceStorage } from './storage/ChatStorage';
import { ChatTreeItem } from './tree/ChatTreeItem';
import { ChatTreeProvider } from './tree/ChatTreeProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storage = getWorkspaceStorage();
  if (!storage) {
    vscode.window.showWarningMessage(
      'AI Chat Tree: Open a workspace folder to use chat tree storage.'
    );
    return;
  }

  const provider = new ChatTreeProvider(storage);
  await provider.initialize();

  const treeView = vscode.window.createTreeView<ChatTreeItem>('chatTreeView', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  treeView.onDidChangeSelection((e) => {
    const item = e.selection[0];
    if (item) {
      provider.setActiveNode(item.node);
    }
  });

  const disposables = registerCommands(provider, treeView);
  context.subscriptions.push(treeView, ...disposables);
}

export function deactivate(): void {}
