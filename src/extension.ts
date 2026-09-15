import * as vscode from 'vscode';
import { openComposerChat } from './cursor/openComposerChat';
import { registerCommands } from './commands/commands';
import { getWorkspaceStorage } from './storage/ChatStorage';
import { startCursorStoragePoll } from './sync/cursorStoragePoll';
import { ChatTreeElement, ChatTreeProvider } from './tree/ChatTreeProvider';
import { ChatTreeItem } from './tree/ChatTreeItem';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const storage = getWorkspaceStorage();
  if (!storage || !workspaceFolder) {
    vscode.window.showWarningMessage(
      'AI Chat Tree: Open a workspace folder to use chat tree storage.'
    );
    return;
  }

  const provider = new ChatTreeProvider(storage, workspaceFolder);
  await provider.initialize();

  const treeView = vscode.window.createTreeView<ChatTreeElement>('chatTreeView', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  treeView.onDidChangeSelection((e) => {
    const item = e.selection[0];
    if (item instanceof ChatTreeItem) {
      provider.setActiveNode(item.node);
      void openComposerChat(item.node);
    }
  });

  const disposables = registerCommands(provider, treeView);
  context.subscriptions.push(
    treeView,
    startCursorStoragePoll(provider, workspaceFolder),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('cursorChatTree.maxRootComposers') ||
        event.affectsConfiguration('cursorChatTree.maxTotalComposers')
      ) {
        void provider.syncFromCursor();
      }
    }),
    ...disposables
  );
}

export function deactivate(): void {}
