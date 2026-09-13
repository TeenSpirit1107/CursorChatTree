import * as vscode from 'vscode';
import { ChatNode } from '../model/ChatNode';

export class ChatTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: ChatNode,
    isActive: boolean
  ) {
    super(node.title, getCollapsibleState(node));

    this.id = node.id;
    this.contextValue = getContextValue(node);
    this.tooltip = node.summary ?? node.title;
    this.description = getDescription(node);

    if (isActive) {
      this.iconPath = new vscode.ThemeIcon('circle-filled');
    } else {
      this.iconPath = getIcon(node);
    }
  }
}

function getCollapsibleState(node: ChatNode): vscode.TreeItemCollapsibleState {
  return node.children.length > 0
    ? vscode.TreeItemCollapsibleState.Collapsed
    : vscode.TreeItemCollapsibleState.None;
}

function getContextValue(node: ChatNode): string {
  if (node.id === 'root' || node.kind === 'workspace-root') {
    return 'root';
  }
  if (node.source === 'cursor') {
    return node.kind === 'composer' ? 'cursor-composer' : 'cursor-readonly';
  }
  return 'branch';
}

function getDescription(node: ChatNode): string | undefined {
  if (node.kind === 'message' || node.kind === 'fork-point') {
    return undefined;
  }
  return node.status;
}

function getIcon(node: ChatNode): vscode.ThemeIcon {
  switch (node.kind) {
    case 'fork-point':
      return new vscode.ThemeIcon('git-merge');
    case 'message':
      return node.bubbleType === 1
        ? new vscode.ThemeIcon('comment')
        : new vscode.ThemeIcon('sparkle');
    case 'composer':
      if (node.status === 'completed') {
        return new vscode.ThemeIcon('check');
      }
      if (node.status === 'abandoned') {
        return new vscode.ThemeIcon('circle-slash');
      }
      return new vscode.ThemeIcon('comment-discussion');
    default:
      return new vscode.ThemeIcon('git-branch');
  }
}
