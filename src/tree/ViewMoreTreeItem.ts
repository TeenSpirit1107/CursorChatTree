import * as vscode from 'vscode';

export class ViewMoreTreeItem extends vscode.TreeItem {
  constructor() {
    super('View more', vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: 'cursorChatTree.loadMoreRoots',
      title: 'View more',
    };
    this.contextValue = 'view-more';
    this.iconPath = new vscode.ThemeIcon('ellipsis');
  }
}
