import * as vscode from 'vscode';
import { ChatNode } from '../model/ChatNode';

const OPEN_COMPOSER = 'composer.openComposer';
const OPEN_COMPOSER_FROM_NOTIFICATION = 'composer.openComposerFromNotification';
const OPEN_GLASS_AGENT = 'glass.openAgentById';

const COMMAND_CACHE_TTL_MS = 30_000;
let registeredCommands: Set<string> | undefined;
let registeredCommandsAt = 0;

async function hasCommand(command: string): Promise<boolean> {
  const now = Date.now();
  if (!registeredCommands || now - registeredCommandsAt > COMMAND_CACHE_TTL_MS) {
    registeredCommands = new Set(await vscode.commands.getCommands(true));
    registeredCommandsAt = now;
  }
  return registeredCommands.has(command);
}

export function resolveComposerId(node: ChatNode): string | undefined {
  if (node.composerId) {
    return node.composerId;
  }
  if (node.source === 'cursor' && node.kind === 'composer') {
    return node.id;
  }
  return undefined;
}

export async function openComposerChat(node: ChatNode): Promise<void> {
  if (node.id === 'root' || node.kind === 'workspace-root') {
    return;
  }

  const composerId = resolveComposerId(node);
  if (!composerId) {
    return;
  }

  const tried = await tryOpenComposer(composerId);
  if (tried) {
    return;
  }

  vscode.window.showWarningMessage(
    'AI Chat Tree: Could not open this chat in Cursor. The session may have been deleted, or this Cursor version may not support opening chats from extensions.'
  );
}

async function tryOpenComposer(composerId: string): Promise<boolean> {
  if (await runCommand(OPEN_COMPOSER, composerId)) {
    return true;
  }
  if (await runCommand(OPEN_COMPOSER_FROM_NOTIFICATION, { composerId })) {
    return true;
  }
  if (await runCommand(OPEN_GLASS_AGENT, composerId)) {
    return true;
  }
  return false;
}

async function runCommand(command: string, arg: unknown): Promise<boolean> {
  if (!(await hasCommand(command))) {
    return false;
  }
  try {
    await vscode.commands.executeCommand(command, arg);
    return true;
  } catch {
    return false;
  }
}
