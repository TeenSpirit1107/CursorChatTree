import * as vscode from 'vscode';
import {
  ComposerTreeLimits,
  getComposerTreeLimits,
} from '../config/composerTreeSettings';
import { ChatNode } from '../model/ChatNode';
import { ChatParser } from './ChatParser';
import {
  discoverPinnedComposerIds,
  isCursorStorageAvailable,
  loadAdditionalComposersForLimits,
  loadComposerDataMap,
  rankWorkspaceComposerIds,
} from './CursorStorageReader';
import { selectComposerIdsForLimits } from './composerIdSelection';

export function parseWorkspaceFromComposers(
  composers: Map<string, import('./cursorTypes').CursorComposerData>,
  workspaceFolder: vscode.WorkspaceFolder,
  limits: ComposerTreeLimits,
  pinnedComposerIds: ReadonlySet<string>
): ChatNode | null {
  const parser = new ChatParser();
  return parser.parseWorkspaceComposers(
    composers,
    workspaceFolder.name,
    limits,
    pinnedComposerIds
  );
}

export async function syncFromCursor(
  workspaceFolder: vscode.WorkspaceFolder,
  limits: ComposerTreeLimits = getComposerTreeLimits()
): Promise<ChatNode | null> {
  if (!isCursorStorageAvailable()) {
    return null;
  }
  const workspacePath = workspaceFolder.uri.fsPath;
  const pinnedComposerIds = discoverPinnedComposerIds(workspacePath);
  const rankedIds = await rankWorkspaceComposerIds(
    workspacePath,
    pinnedComposerIds
  );
  const selected = selectComposerIdsForLimits(rankedIds, limits);
  const composers = await loadComposerDataMap(selected, limits);
  return parseWorkspaceFromComposers(
    composers,
    workspaceFolder,
    limits,
    pinnedComposerIds
  );
}

export interface WorkspaceComposerSyncCache {
  rankedIds: string[];
  composers: Map<string, import('./cursorTypes').CursorComposerData>;
  pinnedComposerIds: Set<string>;
}

export async function buildWorkspaceComposerSyncCache(
  workspaceFolder: vscode.WorkspaceFolder,
  limits: ComposerTreeLimits
): Promise<WorkspaceComposerSyncCache | null> {
  if (!isCursorStorageAvailable()) {
    return null;
  }
  const workspacePath = workspaceFolder.uri.fsPath;
  const pinnedComposerIds = discoverPinnedComposerIds(workspacePath);
  const rankedIds = await rankWorkspaceComposerIds(
    workspacePath,
    pinnedComposerIds
  );
  const selected = selectComposerIdsForLimits(rankedIds, limits);
  const composers = await loadComposerDataMap(selected, limits);
  return { rankedIds, composers, pinnedComposerIds };
}

export function extendSyncCacheForLimits(
  cache: WorkspaceComposerSyncCache,
  limits: ComposerTreeLimits,
  workspaceFolder: vscode.WorkspaceFolder
): ChatNode | null {
  const composers = loadAdditionalComposersForLimits(
    cache.composers,
    cache.rankedIds,
    limits
  );
  cache.composers = composers;
  return parseWorkspaceFromComposers(
    composers,
    workspaceFolder,
    limits,
    cache.pinnedComposerIds
  );
}
