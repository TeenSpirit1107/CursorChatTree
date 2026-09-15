import * as vscode from 'vscode';
import { applyComposerTreeLimits } from '../config/applyComposerTreeLimits';
import {
  getComposerTreeLimits,
  getEffectiveComposerTreeLimits,
  ROOT_PAGE_INCREMENT,
  ROOT_PAGE_SIZE,
} from '../config/composerTreeSettings';
import {
  ChatNode,
  createChatNode,
  findNode,
  removeNode,
} from '../model/ChatNode';
import { discoverPinnedComposerIds } from '../parser/CursorStorageReader';
import { pruneDeletedCursorComposers } from '../parser/pruneDeletedCursorComposers';
import {
  buildWorkspaceComposerSyncCache,
  extendSyncCacheForLimits,
  type WorkspaceComposerSyncCache,
} from '../parser/syncFromCursor';
import { ChatStorage } from '../storage/ChatStorage';
import { ChatTreeItem } from './ChatTreeItem';
import { ViewMoreTreeItem } from './ViewMoreTreeItem';

export type ChatTreeElement = ChatTreeItem | ViewMoreTreeItem;

export class ChatTreeProvider
  implements vscode.TreeDataProvider<ChatTreeElement>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ChatTreeElement | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private root: ChatNode | undefined;
  private activeNodeId: string = 'root';
  private visibleRootCount = ROOT_PAGE_SIZE;
  private hasMoreRoots = false;
  private composerSyncCache: WorkspaceComposerSyncCache | undefined;

  constructor(
    private readonly storage: ChatStorage,
    private readonly workspaceFolder: vscode.WorkspaceFolder
  ) {}

  async initialize(): Promise<void> {
    const synced = await this.syncFromCursor();
    if (synced) {
      this.root = synced;
    } else {
      this.root = await this.loadHygieneCache();
    }
    this.activeNodeId = this.root.id;
    this.refresh();
  }

  async syncFromCursor(): Promise<ChatNode | null> {
    const limits = getEffectiveComposerTreeLimits(this.visibleRootCount);
    const cache = await buildWorkspaceComposerSyncCache(
      this.workspaceFolder,
      limits
    );
    if (!cache) {
      this.composerSyncCache = undefined;
      return null;
    }
    this.composerSyncCache = cache;

    const pinnedComposerIds = cache.pinnedComposerIds;
    const synced = extendSyncCacheForLimits(
      cache,
      limits,
      this.workspaceFolder
    );
    if (!synced) {
      return null;
    }

    this.root = applyComposerTreeLimits(synced, limits, pinnedComposerIds);
    this.updateHasMoreRoots();
    await this.storage.save(this.root);
    this.refresh();
    return this.root;
  }

  resetVisibleRootCount(): void {
    this.visibleRootCount = ROOT_PAGE_SIZE;
  }

  async loadMoreRoots(): Promise<void> {
    const config = getComposerTreeLimits();
    if (!this.hasMoreRoots || this.visibleRootCount >= config.maxRootComposers) {
      return;
    }
    this.visibleRootCount = Math.min(
      this.visibleRootCount + ROOT_PAGE_INCREMENT,
      config.maxRootComposers
    );
    const limits = getEffectiveComposerTreeLimits(this.visibleRootCount);

    if (!this.composerSyncCache) {
      const synced = await this.syncFromCursor();
      if (!synced) {
        this.visibleRootCount = Math.max(
          ROOT_PAGE_SIZE,
          this.visibleRootCount - ROOT_PAGE_INCREMENT
        );
      }
      return;
    }

    const synced = extendSyncCacheForLimits(
      this.composerSyncCache,
      limits,
      this.workspaceFolder
    );
    if (!synced) {
      this.visibleRootCount = Math.max(
        ROOT_PAGE_SIZE,
        this.visibleRootCount - ROOT_PAGE_INCREMENT
      );
      return;
    }

    this.root = applyComposerTreeLimits(
      synced,
      limits,
      this.composerSyncCache.pinnedComposerIds
    );
    this.updateHasMoreRoots();
    await this.storage.save(this.root);
    this.refresh();
  }

  private updateHasMoreRoots(): void {
    if (!this.root) {
      this.hasMoreRoots = false;
      return;
    }
    const limits = getEffectiveComposerTreeLimits(this.visibleRootCount);
    const config = getComposerTreeLimits();
    const shown = this.root.children.length;
    this.hasMoreRoots =
      shown === limits.maxRootComposers &&
      limits.maxRootComposers < config.maxRootComposers;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async reloadFromStorage(): Promise<void> {
    this.root = await this.loadHygieneCache();
    this.activeNodeId = this.root.id;
    this.refresh();
  }

  private async loadHygieneCache(): Promise<ChatNode> {
    const limits = getEffectiveComposerTreeLimits(this.visibleRootCount);
    const pinnedComposerIds = discoverPinnedComposerIds(
      this.workspaceFolder.uri.fsPath
    );
    const loaded = applyComposerTreeLimits(
      await this.storage.load(),
      limits,
      pinnedComposerIds
    );
    const root = pruneDeletedCursorComposers(
      loaded,
      this.workspaceFolder.uri.fsPath
    );
    await this.storage.save(root);
    this.updateHasMoreRoots();
    return root;
  }

  getTreeItem(element: ChatTreeElement): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ChatTreeElement): ChatTreeElement[] {
    if (!this.root) {
      return [];
    }

    if (!element) {
      return [
        new ChatTreeItem(this.root, this.root.id === this.activeNodeId),
      ];
    }

    if (!(element instanceof ChatTreeItem)) {
      return [];
    }

    const items: ChatTreeElement[] = element.node.children.map(
      (child) => new ChatTreeItem(child, child.id === this.activeNodeId)
    );
    if (element.node.id === 'root' && this.hasMoreRoots) {
      return [...items, new ViewMoreTreeItem()];
    }
    return items;
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
    if (node.source === 'cursor') {
      vscode.window.showWarningMessage(
        'AI Chat Tree: Cursor chats are read-only in this extension.'
      );
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
    if (node.source === 'cursor') {
      vscode.window.showWarningMessage(
        'AI Chat Tree: Cursor chats are read-only in this extension.'
      );
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
