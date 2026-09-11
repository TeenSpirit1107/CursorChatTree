import * as vscode from 'vscode';
import { ChatNode } from '../model/ChatNode';

export class ChatTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: ChatNode,
    isActive: boolean
  ) {
    super(node.title, getCollapsibleState(node));

    this.id = node.id;
    this.contextValue = node.id === 'root' ? 'root' : 'branch';
    this.tooltip = node.summary ?? node.title;
    this.description = node.status;

    if (isActive) {
      this.iconPath = new vscode.ThemeIcon('circle-filled');
    } else if (node.status === 'completed') {
      this.iconPath = new vscode.ThemeIcon('check');
    } else if (node.status === 'abandoned') {
      this.iconPath = new vscode.ThemeIcon('circle-slash');
    } else {
      this.iconPath = new vscode.ThemeIcon('git-branch');
    }
  }
}

function getCollapsibleState(node: ChatNode): vscode.TreeItemCollapsibleState {
  return node.children.length > 0
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.None;
}
