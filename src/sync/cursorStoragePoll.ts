import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  findWorkspaceStorageId,
  getCursorProjectsRoot,
  getGlobalStateDbPath,
  getWorkspaceStorageRoot,
  workspacePathToProjectSlug,
} from '../parser/CursorPaths';
import { ChatTreeProvider } from '../tree/ChatTreeProvider';

const POLL_INTERVAL_MS = 10_000;
const DEBOUNCE_MS = 2_000;
const MIN_SYNC_INTERVAL_MS = 10_000;

function getWatchPaths(workspacePath: string): string[] {
  const paths: string[] = [];
  const globalDb = getGlobalStateDbPath();
  if (fs.existsSync(globalDb)) {
    paths.push(globalDb);
  }

  const workspaceStorageId = findWorkspaceStorageId(workspacePath);
  if (workspaceStorageId) {
    const workspaceDb = path.join(
      getWorkspaceStorageRoot(),
      workspaceStorageId,
      'state.vscdb'
    );
    if (fs.existsSync(workspaceDb)) {
      paths.push(workspaceDb);
    }
  }

  const transcriptsDir = path.join(
    getCursorProjectsRoot(),
    workspacePathToProjectSlug(workspacePath),
    'agent-transcripts'
  );
  if (fs.existsSync(transcriptsDir)) {
    paths.push(transcriptsDir);
  }

  return paths;
}

function fingerprint(paths: string[]): string {
  const parts: string[] = [];
  for (const filePath of paths) {
    try {
      const stat = fs.statSync(filePath);
      parts.push(`${filePath}:${stat.mtimeMs}:${stat.size}`);
    } catch {
      parts.push(`${filePath}:missing`);
    }
  }
  return parts.join('|');
}

export function startCursorStoragePoll(
  provider: ChatTreeProvider,
  workspaceFolder: vscode.WorkspaceFolder
): vscode.Disposable {
  const workspacePath = workspaceFolder.uri.fsPath;
  let lastFingerprint = fingerprint(getWatchPaths(workspacePath));
  let lastSyncAt = Date.now();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let rateLimitTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const runSync = async (): Promise<void> => {
    if (disposed) {
      return;
    }

    const elapsed = Date.now() - lastSyncAt;
    if (elapsed < MIN_SYNC_INTERVAL_MS) {
      if (rateLimitTimer) {
        return;
      }
      rateLimitTimer = setTimeout(() => {
        rateLimitTimer = undefined;
        void runSync();
      }, MIN_SYNC_INTERVAL_MS - elapsed);
      return;
    }

    lastSyncAt = Date.now();
    await provider.syncFromCursor();
    lastFingerprint = fingerprint(getWatchPaths(workspacePath));
  };

  const scheduleSync = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void runSync();
    }, DEBOUNCE_MS);
  };

  const interval = setInterval(() => {
    if (disposed) {
      return;
    }
    const next = fingerprint(getWatchPaths(workspacePath));
    if (next !== lastFingerprint) {
      lastFingerprint = next;
      scheduleSync();
    }
  }, POLL_INTERVAL_MS);

  return new vscode.Disposable(() => {
    disposed = true;
    clearInterval(interval);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (rateLimitTimer) {
      clearTimeout(rateLimitTimer);
    }
  });
}
