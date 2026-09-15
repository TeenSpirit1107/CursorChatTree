import * as vscode from 'vscode';
import { ChatTreeElement, ChatTreeProvider } from '../tree/ChatTreeProvider';
import { ChatTreeItem } from '../tree/ChatTreeItem';

export function registerCommands(
  provider: ChatTreeProvider,
  treeView: vscode.TreeView<ChatTreeElement>
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('cursorChatTree.createBranch', async () => {
      const selection = treeView.selection[0];
      const parent =
        selection instanceof ChatTreeItem ? selection.node : undefined;
      await provider.createBranch(parent);
    }),

    vscode.commands.registerCommand('cursorChatTree.rename', async (item?: ChatTreeItem) => {
      const selected = treeView.selection[0];
      const target =
        item ??
        (selected instanceof ChatTreeItem ? selected : undefined);
      if (!target) {
        vscode.window.showWarningMessage('Select a branch to rename.');
        return;
      }
      await provider.rename(target.node);
    }),

    vscode.commands.registerCommand('cursorChatTree.delete', async (item?: ChatTreeItem) => {
      const selected = treeView.selection[0];
      const target =
        item ??
        (selected instanceof ChatTreeItem ? selected : undefined);
      if (!target) {
        vscode.window.showWarningMessage('Select a branch to delete.');
        return;
      }
      await provider.delete(target.node);
    }),

    vscode.commands.registerCommand('cursorChatTree.refresh', async () => {
      provider.resetVisibleRootCount();
      const synced = await provider.syncFromCursor();
      if (!synced) {
        vscode.window.showWarningMessage(
          'AI Chat Tree: Could not sync from Cursor. Ensure sqlite3 is installed and this workspace has chat history.'
        );
        await provider.reloadFromStorage();
      }
    }),

    vscode.commands.registerCommand('cursorChatTree.loadMoreRoots', async () => {
      await provider.loadMoreRoots();
    }),
  ];
}

export async function openChat(_id: string): Promise<void> {
  // Future: open the corresponding Cursor chat session.
  vscode.window.showInformationMessage(
    `Opening chat "${_id}" is not yet supported.`
  );
}
