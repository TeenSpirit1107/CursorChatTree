/**
 * Single gateway for Cursor-owned data on disk (User storage + ~/.cursor/projects).
 * All access here is read-only; writes throw at runtime and mutating SQL is rejected.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  folderUriMatchesWorkspace,
  getCursorProjectsRoot,
  getCursorUserDir,
  getWorkspaceStorageRoot,
} from './cursorDataLocations';

const MAX_SQL_BUFFER = 64 * 1024 * 1024;

const MUTATING_SQL_KEYWORD =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|TRUNCATE|REINDEX|VACUUM|PRAGMA)\b/i;

function cursorDataRoots(): string[] {
  return [path.resolve(getCursorUserDir()), path.resolve(getCursorProjectsRoot())];
}

/** Ensures `targetPath` resolves under Cursor User dir or ~/.cursor/projects. */
export function assertCursorReadOnlyPath(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  const roots = cursorDataRoots();
  const allowed = roots.some(
    (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)
  );
  if (!allowed) {
    throw new Error(
      `Refusing non-Cursor or out-of-root path for Cursor data: ${targetPath}`
    );
  }
  return resolved;
}

function assertReadOnlySql(sql: string): void {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new Error('Empty SQL is not allowed for Cursor database access');
  }
  if (MUTATING_SQL_KEYWORD.test(trimmed)) {
    throw new Error('Mutating SQL is not allowed for Cursor database access');
  }
  if (!/^(WITH\b|SELECT\b)/i.test(trimmed)) {
    throw new Error('Only SELECT (or WITH … SELECT) queries are allowed on Cursor DB');
  }
}

export function isSqliteCliAvailable(): boolean {
  try {
    execFileSync('sqlite3', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function queryCursorDbSelect<T extends Record<string, unknown>>(
  dbPath: string,
  sql: string
): T[] {
  const resolvedDb = assertCursorReadOnlyPath(dbPath);
  assertReadOnlySql(sql);
  const output = execFileSync('sqlite3', ['-json', resolvedDb, sql], {
    encoding: 'utf8',
    maxBuffer: MAX_SQL_BUFFER,
  }).trim();

  if (!output) {
    return [];
  }

  return JSON.parse(output) as T[];
}

export function cursorPathExists(targetPath: string): boolean {
  try {
    assertCursorReadOnlyPath(targetPath);
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

export function readCursorFileUtf8(targetPath: string): string {
  const resolved = assertCursorReadOnlyPath(targetPath);
  return fs.readFileSync(resolved, 'utf8');
}

export function listCursorDirEntryNames(targetPath: string): string[] {
  const resolved = assertCursorReadOnlyPath(targetPath);
  return fs.readdirSync(resolved);
}

export function listCursorSubdirNames(targetPath: string): string[] {
  const resolved = assertCursorReadOnlyPath(targetPath);
  return fs
    .readdirSync(resolved, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export function statCursorPath(targetPath: string): fs.Stats {
  const resolved = assertCursorReadOnlyPath(targetPath);
  return fs.statSync(resolved);
}

export function findWorkspaceStorageId(workspacePath: string): string | undefined {
  const storageRoot = getWorkspaceStorageRoot();
  let entries: string[];
  try {
    entries = listCursorDirEntryNames(storageRoot);
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    const workspaceJsonPath = path.join(storageRoot, entry, 'workspace.json');
    try {
      const raw = readCursorFileUtf8(workspaceJsonPath);
      const data = JSON.parse(raw) as { folder?: string };
      if (data.folder && folderUriMatchesWorkspace(data.folder, workspacePath)) {
        return entry;
      }
    } catch {
      // skip invalid workspace entries
    }
  }

  return undefined;
}

export function isCursorDataPath(targetPath: string): boolean {
  try {
    assertCursorReadOnlyPath(targetPath);
    return true;
  } catch {
    return false;
  }
}

/** @internal Throws if extension code attempts to write Cursor-owned paths. */
export function forbidCursorDataWrite(targetPath: string): never {
  assertCursorReadOnlyPath(targetPath);
  throw new Error(
    `Cursor data is read-only in this extension: ${targetPath}`
  );
}
