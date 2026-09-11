import * as vscode from 'vscode';
import { ChatTreeItem } from '../tree/ChatTreeItem';
import { ChatTreeProvider } from '../tree/ChatTreeProvider';

export function registerCommands(
  provider: ChatTreeProvider,
  treeView: vscode.TreeView<ChatTreeItem>
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('cursorChatTree.createBranch', async () => {
      const selection = treeView.selection[0];
      await provider.createBranch(selection?.node);
    }),

    vscode.commands.registerCommand('cursorChatTree.rename', async (item?: ChatTreeItem) => {
      const target = item ?? treeView.selection[0];
      if (!target) {
        vscode.window.showWarningMessage('Select a branch to rename.');
        return;
      }
      await provider.rename(target.node);
    }),

    vscode.commands.registerCommand('cursorChatTree.delete', async (item?: ChatTreeItem) => {
      const target = item ?? treeView.selection[0];
      if (!target) {
        vscode.window.showWarningMessage('Select a branch to delete.');
        return;
      }
      await provider.delete(target.node);
    }),

    vscode.commands.registerCommand('cursorChatTree.refresh', async () => {
      await provider.initialize();
    }),
  ];
}

export async function openChat(_id: string): Promise<void> {
  // Future: open the corresponding Cursor chat session.
  vscode.window.showInformationMessage(
    `Opening chat "${_id}" is not yet supported.`
  );
}
