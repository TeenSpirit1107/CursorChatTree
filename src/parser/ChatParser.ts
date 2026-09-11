import { ChatNode, ChatNodeStatus } from '../model/ChatNode';
import { CursorComposerData } from './cursorTypes';

function mapStatus(status?: string): ChatNodeStatus | undefined {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'aborted':
      return 'abandoned';
    case 'none':
    case 'generating':
    case 'running':
      return 'active';
    default:
      return status ? 'active' : undefined;
  }
}

function composerTitle(composer: CursorComposerData): string {
  const name = composer.name?.trim();
  if (name) {
    return name;
  }
  return '(Untitled chat)';
}

function composerSummary(composer: CursorComposerData): string | undefined {
  const subtitle = composer.subtitle?.trim();
  if (subtitle) {
    return subtitle;
  }
  const mode = composer.unifiedMode?.trim();
  if (mode) {
    return mode;
  }
  return undefined;
}

function getParentComposerId(composer: CursorComposerData): string | undefined {
  return composer.subagentInfo?.parentComposerId;
}

function getChildComposerIds(composer: CursorComposerData): string[] {
  const childIds = new Set<string>();
  for (const id of composer.subComposerIds ?? []) {
    childIds.add(id);
  }
  for (const id of composer.subagentComposerIds ?? []) {
    childIds.add(id);
  }
  return [...childIds];
}

function buildComposerNode(
  composer: CursorComposerData,
  composers: Map<string, CursorComposerData>,
  parentId: string,
  visiting: Set<string>
): ChatNode {
  const childNodes: ChatNode[] = [];
  for (const childId of getChildComposerIds(composer)) {
    if (visiting.has(childId)) {
      continue;
    }
    const childComposer = composers.get(childId);
    if (!childComposer) {
      continue;
    }
    visiting.add(childId);
    childNodes.push(
      buildComposerNode(childComposer, composers, composer.composerId, visiting)
    );
    visiting.delete(childId);
  }

  childNodes.sort((a, b) => b.createdAt - a.createdAt);

  return {
    id: composer.composerId,
    parentId,
    title: composerTitle(composer),
    createdAt: composer.createdAt ?? composer.lastUpdatedAt ?? Date.now(),
    children: childNodes,
    summary: composerSummary(composer),
    status: mapStatus(composer.status),
  };
}

export class ChatParser {
  parseWorkspaceComposers(
    composers: Map<string, CursorComposerData>,
    workspaceTitle = 'Conversations'
  ): ChatNode | null {
    if (composers.size === 0) {
      return null;
    }

    const composerIds = new Set(composers.keys());
    const roots: ChatNode[] = [];

    for (const composer of composers.values()) {
      const parentId = getParentComposerId(composer);
      if (parentId && composerIds.has(parentId)) {
        continue;
      }
      roots.push(buildComposerNode(composer, composers, 'root', new Set([composer.composerId])));
    }

    roots.sort((a, b) => b.createdAt - a.createdAt);

    return {
      id: 'root',
      title: workspaceTitle,
      createdAt: roots[0]?.createdAt ?? Date.now(),
      children: roots,
      status: 'active',
    };
  }
}
