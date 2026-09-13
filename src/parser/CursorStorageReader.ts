import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  CursorBubbleData,
  CursorComposerData,
  CursorComposerHeadersIndex,
  CursorWorkspaceComposerData,
} from './cursorTypes';
import {
  findWorkspaceStorageId,
  getCursorProjectsRoot,
  getGlobalStateDbPath,
  getWorkspaceStorageRoot,
  normalizeFolderPath,
  workspacePathToProjectSlug,
  folderUriMatchesWorkspace,
} from './CursorPaths';

const MAX_BUFFER = 64 * 1024 * 1024;

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function isSqliteCliAvailable(): boolean {
  try {
    execFileSync('sqlite3', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function queryJsonRows<T extends Record<string, unknown>>(
  dbPath: string,
  sql: string
): T[] {
  const output = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
  }).trim();

  if (!output) {
    return [];
  }

  return JSON.parse(output) as T[];
}

function readJsonValue<T>(
  dbPath: string,
  table: 'ItemTable' | 'cursorDiskKV',
  key: string
): T | undefined {
  const rows = queryJsonRows<{ value: string }>(
    dbPath,
    `SELECT value FROM ${table} WHERE key = '${escapeSqlString(key)}' LIMIT 1;`
  );
  if (!rows[0]?.value) {
    return undefined;
  }
  return JSON.parse(rows[0].value) as T;
}

function readStringColumn(dbPath: string, sql: string): string[] {
  const rows = queryJsonRows<Record<string, string>>(dbPath, sql);
  const column = Object.keys(rows[0] ?? { key: '' })[0] ?? 'key';
  return rows
    .map((row) => row[column])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function collectComposerIdsFromWorkspaceData(data: CursorWorkspaceComposerData): string[] {
  const ids = new Set<string>();
  for (const composer of data.allComposers ?? []) {
    if (composer.composerId) {
      ids.add(composer.composerId);
    }
  }
  for (const id of data.selectedComposerIds ?? []) {
    ids.add(id);
  }
  for (const id of data.lastFocusedComposerIds ?? []) {
    ids.add(id);
  }
  return [...ids];
}

function collectComposerIdsFromViewPaneKeys(dbPath: string): string[] {
  const keys = readStringColumn(
    dbPath,
    "SELECT key FROM ItemTable WHERE key LIKE 'workbench.panel.composerChatViewPane.%';"
  );
  const ids = new Set<string>();
  for (const key of keys) {
    try {
      const value = readJsonValue<{ views?: Array<{ composerId?: string }> }>(
        dbPath,
        'ItemTable',
        key
      );
      for (const view of value?.views ?? []) {
        if (view.composerId) {
          ids.add(view.composerId);
        }
      }
    } catch {
      // ignore malformed view pane entries
    }
  }
  return [...ids];
}

function collectComposerIdsFromAgentTranscripts(workspacePath: string): string[] {
  const slug = workspacePathToProjectSlug(workspacePath);
  const transcriptsDir = path.join(
    getCursorProjectsRoot(),
    slug,
    'agent-transcripts'
  );
  try {
    return fs
      .readdirSync(transcriptsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function collectComposerIdsFromGlobalHeaders(
  dbPath: string,
  workspacePath: string,
  workspaceStorageId?: string
): string[] {
  const headers = readJsonValue<CursorComposerHeadersIndex>(
    dbPath,
    'ItemTable',
    'composer.composerHeaders'
  );
  if (!headers?.allComposers?.length) {
    return [];
  }

  const normalizedPath = normalizeFolderPath(workspacePath);
  return headers.allComposers
    .filter((composer) => {
      const identifier = composer.workspaceIdentifier;
      if (!identifier) {
        return false;
      }
      if (workspaceStorageId && identifier.id === workspaceStorageId) {
        return true;
      }
      const fsPath = identifier.uri?.fsPath;
      if (fsPath && normalizeFolderPath(fsPath) === normalizedPath) {
        return true;
      }
      const external = identifier.uri?.external;
      if (external && folderUriMatchesWorkspace(external, workspacePath)) {
        return true;
      }
      return false;
    })
    .map((composer) => composer.composerId)
    .filter(Boolean);
}

export async function discoverComposerIds(workspacePath: string): Promise<string[]> {
  if (!isSqliteCliAvailable()) {
    return [];
  }

  const ids = new Set<string>();
  const workspaceStorageId = findWorkspaceStorageId(workspacePath);

  for (const id of collectComposerIdsFromAgentTranscripts(workspacePath)) {
    ids.add(id);
  }

  if (workspaceStorageId) {
    const workspaceDbPath = path.join(
      getWorkspaceStorageRoot(),
      workspaceStorageId,
      'state.vscdb'
    );
    if (fs.existsSync(workspaceDbPath)) {
      const composerData = readJsonValue<CursorWorkspaceComposerData>(
        workspaceDbPath,
        'ItemTable',
        'composer.composerData'
      );
      if (composerData) {
        for (const id of collectComposerIdsFromWorkspaceData(composerData)) {
          ids.add(id);
        }
      }
      for (const id of collectComposerIdsFromViewPaneKeys(workspaceDbPath)) {
        ids.add(id);
      }
    }
  }

  const globalDbPath = getGlobalStateDbPath();
  if (fs.existsSync(globalDbPath)) {
    for (const id of collectComposerIdsFromGlobalHeaders(
      globalDbPath,
      workspacePath,
      workspaceStorageId
    )) {
      ids.add(id);
    }
  }

  return [...ids];
}

export async function loadComposerDataMap(
  seedIds: string[]
): Promise<Map<string, CursorComposerData>> {
  const globalDbPath = getGlobalStateDbPath();
  if (!fs.existsSync(globalDbPath) || seedIds.length === 0 || !isSqliteCliAvailable()) {
    return new Map();
  }

  const composers = new Map<string, CursorComposerData>();
  const pending = [...new Set(seedIds)];

  while (pending.length > 0) {
    const composerId = pending.pop();
    if (!composerId || composers.has(composerId)) {
      continue;
    }

    const data = readJsonValue<CursorComposerData>(
      globalDbPath,
      'cursorDiskKV',
      `composerData:${composerId}`
    );
    if (!data?.composerId) {
      continue;
    }

    composers.set(composerId, data);
    for (const childId of data.subComposerIds ?? []) {
      if (!composers.has(childId)) {
        pending.push(childId);
      }
    }
    for (const childId of data.subagentComposerIds ?? []) {
      if (!composers.has(childId)) {
        pending.push(childId);
      }
    }
  }

  return composers;
}

export async function loadWorkspaceComposers(
  workspacePath: string
): Promise<Map<string, CursorComposerData>> {
  const seedIds = await discoverComposerIds(workspacePath);
  return loadComposerDataMap(seedIds);
}

export function isCursorStorageAvailable(): boolean {
  return isSqliteCliAvailable() && fs.existsSync(getGlobalStateDbPath());
}

export function readBubbleData(
  composerId: string,
  bubbleId: string
): CursorBubbleData | undefined {
  const globalDbPath = getGlobalStateDbPath();
  if (!fs.existsSync(globalDbPath) || !isSqliteCliAvailable()) {
    return undefined;
  }
  return readJsonValue<CursorBubbleData>(
    globalDbPath,
    'cursorDiskKV',
    `bubbleId:${composerId}:${bubbleId}`
  );
}
