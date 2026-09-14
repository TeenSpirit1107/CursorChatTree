import * as vscode from 'vscode';
import { getComposerTreeLimits } from '../config/composerTreeSettings';
import { ChatNode } from '../model/ChatNode';
import { ChatParser } from './ChatParser';
import {
  discoverPinnedComposerIds,
  isCursorStorageAvailable,
  loadWorkspaceComposers,
} from './CursorStorageReader';

export async function syncFromCursor(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<ChatNode | null> {
  if (!isCursorStorageAvailable()) {
    return null;
  }

  const limits = getComposerTreeLimits();
  const workspacePath = workspaceFolder.uri.fsPath;
  const pinnedComposerIds = discoverPinnedComposerIds(workspacePath);
  const composers = await loadWorkspaceComposers(
    workspacePath,
    limits,
    pinnedComposerIds
  );
  const parser = new ChatParser();
  return parser.parseWorkspaceComposers(
    composers,
    workspaceFolder.name,
    limits,
    pinnedComposerIds
  );
}
