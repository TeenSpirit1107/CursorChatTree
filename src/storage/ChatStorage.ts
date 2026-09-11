import * as vscode from 'vscode';
import { ChatNode, createDefaultRoot } from '../model/ChatNode';

export interface ChatProvider {
  getChats(): Promise<ChatNode[]>;
}

export interface ChatStorage {
  load(): Promise<ChatNode>;
  save(root: ChatNode): Promise<void>;
}

const STORAGE_DIR = '.cursor-chat-tree';
const STORAGE_FILE = 'chats.json';

export class LocalJsonChatStorage implements ChatStorage {
  private readonly storageUri: vscode.Uri;

  constructor(workspaceFolder: vscode.WorkspaceFolder) {
    this.storageUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      STORAGE_DIR,
      STORAGE_FILE
    );
  }

  async load(): Promise<ChatNode> {
    try {
      const data = await vscode.workspace.fs.readFile(this.storageUri);
      const parsed = JSON.parse(Buffer.from(data).toString('utf8')) as ChatNode;
      return this.normalizeNode(parsed);
    } catch {
      const root = createDefaultRoot();
      await this.save(root);
      return root;
    }
  }

  async save(root: ChatNode): Promise<void> {
    const dirUri = vscode.Uri.joinPath(this.storageUri, '..');
    await vscode.workspace.fs.createDirectory(dirUri);
    const content = Buffer.from(JSON.stringify(root, null, 2), 'utf8');
    await vscode.workspace.fs.writeFile(this.storageUri, content);
  }

  private normalizeNode(node: ChatNode, parentId?: string): ChatNode {
    return {
      ...node,
      parentId,
      children: (node.children ?? []).map((child) =>
        this.normalizeNode(child, node.id)
      ),
    };
  }
}

export function getWorkspaceStorage(): LocalJsonChatStorage | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return undefined;
  }
  return new LocalJsonChatStorage(folder);
}
