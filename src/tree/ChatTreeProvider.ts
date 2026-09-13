import * as vscode from 'vscode';
import { applyComposerTreeLimits } from '../config/applyComposerTreeLimits';
import {
  ChatNode,
  createChatNode,
  findNode,
  removeNode,
} from '../model/ChatNode';
import { syncFromCursor } from '../parser/syncFromCursor';
import { ChatStorage } from '../storage/ChatStorage';
import { ChatTreeItem } from './ChatTreeItem';

export class ChatTreeProvider
  implements vscode.TreeDataProvider<ChatTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ChatTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private root: ChatNode | undefined;
  private activeNodeId: string = 'root';

  constructor(
    private readonly storage: ChatStorage,
    private readonly workspaceFolder: vscode.WorkspaceFolder
  ) {}

  async initialize(): Promise<void> {
    const synced = await this.syncFromCursor();
    if (synced) {
      this.root = synced;
    } else {
      this.root = applyComposerTreeLimits(await this.storage.load());
      await this.storage.save(this.root);
    }
    this.activeNodeId = this.root.id;
    this.refresh();
  }

  async syncFromCursor(): Promise<ChatNode | null> {
    const synced = await syncFromCursor(this.workspaceFolder);
    if (!synced) {
      return null;
    }

    this.root = applyComposerTreeLimits(synced);
    await this.storage.save(this.root);
    this.refresh();
    return this.root;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async reloadFromStorage(): Promise<void> {
    this.root = applyComposerTreeLimits(await this.storage.load());
    await this.storage.save(this.root);
    this.activeNodeId = this.root.id;
    this.refresh();
  }

  getTreeItem(element: ChatTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ChatTreeItem): ChatTreeItem[] {
    if (!this.root) {
      return [];
    }

    if (!element) {
      return [
        new ChatTreeItem(this.root, this.root.id === this.activeNodeId),
      ];
    }

    return element.node.children.map(
      (child) => new ChatTreeItem(child, child.id === this.activeNodeId)
    );
  }

  getActiveNode(): ChatNode | undefined {
    if (!this.root) {
      return undefined;
    }
    return findNode(this.root, this.activeNodeId) ?? this.root;
  }

  setActiveNode(node: ChatNode): void {
    this.activeNodeId = node.id;
    this.refresh();
  }

  async createBranch(parent?: ChatNode): Promise<ChatNode | undefined> {
    if (!this.root) {
      return undefined;
    }

    const target = parent ?? this.getActiveNode() ?? this.root;
    const title = await vscode.window.showInputBox({
      prompt: 'Branch title',
      placeHolder: 'New branch',
      value: 'New branch',
    });

    if (!title?.trim()) {
      return undefined;
    }

    const child = createChatNode(title.trim(), target.id, 'active');
    const parentNode = findNode(this.root, target.id);
    if (!parentNode) {
      return undefined;
    }

    parentNode.children.push(child);
    this.activeNodeId = child.id;
    await this.storage.save(this.root);
    this.refresh();
    return child;
  }

  async rename(node: ChatNode): Promise<void> {
    if (!this.root || node.id === 'root') {
      return;
    }

    const title = await vscode.window.showInputBox({
      prompt: 'Rename branch',
      value: node.title,
    });

    if (!title?.trim() || title.trim() === node.title) {
      return;
    }

    const target = findNode(this.root, node.id);
    if (!target) {
      return;
    }

    target.title = title.trim();
    await this.storage.save(this.root);
    this.refresh();
  }

  async delete(node: ChatNode): Promise<void> {
    if (!this.root || node.id === 'root') {
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete branch "${node.title}" and all its children?`,
      { modal: true },
      'Delete'
    );

    if (confirm !== 'Delete') {
      return;
    }

    if (!removeNode(this.root, node.id)) {
      return;
    }

    if (this.activeNodeId === node.id) {
      this.activeNodeId = this.root.id;
    }

    await this.storage.save(this.root);
    this.refresh();
  }

  getRoot(): ChatNode | undefined {
    return this.root;
  }
}
