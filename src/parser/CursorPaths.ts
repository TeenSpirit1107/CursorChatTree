import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

export function getCursorUserDir(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Cursor',
        'User'
      );
    case 'win32':
      return path.join(process.env.APPDATA ?? os.homedir(), 'Cursor', 'User');
    default:
      return path.join(os.homedir(), '.config', 'Cursor', 'User');
  }
}

export function getGlobalStateDbPath(): string {
  return path.join(getCursorUserDir(), 'globalStorage', 'state.vscdb');
}

export function getWorkspaceStorageRoot(): string {
  return path.join(getCursorUserDir(), 'workspaceStorage');
}

export function getCursorProjectsRoot(): string {
  return path.join(os.homedir(), '.cursor', 'projects');
}

export function normalizeFolderPath(folderPath: string): string {
  return path.normalize(folderPath).replace(/\\/g, '/').replace(/\/$/, '');
}

export function workspacePathToProjectSlug(folderPath: string): string {
  return normalizeFolderPath(folderPath).replace(/^\//, '').replace(/\//g, '-');
}

export function folderUriToPath(folderUri: string): string {
  if (folderUri.startsWith('file://')) {
    return fileURLToPath(folderUri);
  }
  return folderUri;
}

export function folderUriMatchesWorkspace(
  folderUri: string,
  workspacePath: string
): boolean {
  return normalizeFolderPath(folderUriToPath(folderUri)) === normalizeFolderPath(workspacePath);
}

export function findWorkspaceStorageId(workspacePath: string): string | undefined {
  const storageRoot = getWorkspaceStorageRoot();
  let entries: string[];
  try {
    entries = fs.readdirSync(storageRoot);
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    const workspaceJsonPath = path.join(storageRoot, entry, 'workspace.json');
    try {
      const raw = fs.readFileSync(workspaceJsonPath, 'utf8');
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
