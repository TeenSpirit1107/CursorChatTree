import * as vscode from 'vscode';
import { ChatNode } from '../model/ChatNode';
import { ChatParser } from './ChatParser';
import {
  isCursorStorageAvailable,
  loadWorkspaceComposers,
} from './CursorStorageReader';

export async function syncFromCursor(
  workspaceFolder: vscode.WorkspaceFolder
): Promise<ChatNode | null> {
  if (!isCursorStorageAvailable()) {
    return null;
  }

  const composers = await loadWorkspaceComposers(workspaceFolder.uri.fsPath);
  const parser = new ChatParser();
  return parser.parseWorkspaceComposers(composers, workspaceFolder.name);
}
