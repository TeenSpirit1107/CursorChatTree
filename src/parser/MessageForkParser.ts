import { ChatNode, ChatNodeStatus } from '../model/ChatNode';
import { readBubbleData } from './CursorStorageReader';
import { CursorComposerData } from './cursorTypes';

const MIN_SHARED_BUBBLES = 2;
const MAX_TAIL_MESSAGES = 40;

interface ForkLink {
  parentId: string;
  lcpLength: number;
}

interface ForkChildRef {
  childId: string;
  lcpLength: number;
}

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
  return name || '(Untitled chat)';
}

function getBubbleIds(composer: CursorComposerData): string[] {
  return (composer.fullConversationHeadersOnly ?? []).map((header) => header.bubbleId);
}

function sharedPrefixLength(a: string[], b: string[]): number {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) {
    index += 1;
  }
  return index;
}

function isSubagentComposer(composer: CursorComposerData): boolean {
  return (
    Boolean(composer.subagentInfo?.parentComposerId) ||
    composer.composerId.startsWith('task-')
  );
}

function truncate(text: string, max = 72): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

function bubbleTitle(composerId: string, bubbleId: string, bubbleType: number): string {
  const bubble = readBubbleData(composerId, bubbleId);
  const text = (bubble?.rawText ?? bubble?.text ?? '').trim();
  const role = bubbleType === 1 ? 'You' : 'Assistant';
  if (text) {
    return `${role}: ${truncate(text)}`;
  }
  return role;
}

export class MessageForkParser {
  buildWorkspaceTree(
    composers: Map<string, CursorComposerData>,
    workspaceTitle = 'Conversations'
  ): ChatNode | null {
    const eligible = [...composers.values()].filter((composer) => !isSubagentComposer(composer));
    if (eligible.length === 0) {
      return null;
    }

    const forkParent = this.buildForkParentMap(eligible);
    const forkChildren = this.buildForkChildrenMap(forkParent);

    const roots = eligible
      .filter((composer) => !forkParent.has(composer.composerId))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return {
      id: 'root',
      title: workspaceTitle,
      createdAt: roots[0]?.createdAt ?? Date.now(),
      children: roots.map((composer) =>
        this.buildComposerNode(composer, composers, forkParent, forkChildren, 'root', 0)
      ),
      status: 'active',
      kind: 'workspace-root',
      source: 'cursor',
    };
  }

  private buildForkParentMap(composers: CursorComposerData[]): Map<string, ForkLink> {
    const parentMap = new Map<string, ForkLink>();

    for (const child of composers) {
      const childBubbles = getBubbleIds(child);
      if (childBubbles.length < MIN_SHARED_BUBBLES) {
        continue;
      }

      let bestParentId: string | undefined;
      let bestLcp = 0;

      for (const candidate of composers) {
        if (candidate.composerId === child.composerId) {
          continue;
        }
        const childCreated = child.createdAt ?? 0;
        const candidateCreated = candidate.createdAt ?? 0;
        if (candidateCreated >= childCreated) {
          continue;
        }

        const lcp = sharedPrefixLength(getBubbleIds(candidate), childBubbles);
        if (lcp < MIN_SHARED_BUBBLES) {
          continue;
        }

        if (lcp > bestLcp) {
          bestLcp = lcp;
          bestParentId = candidate.composerId;
        }
      }

      if (bestParentId) {
        parentMap.set(child.composerId, { parentId: bestParentId, lcpLength: bestLcp });
      }
    }

    return parentMap;
  }

  private buildForkChildrenMap(
    forkParent: Map<string, ForkLink>
  ): Map<string, ForkChildRef[]> {
    const children = new Map<string, ForkChildRef[]>();
    for (const [childId, link] of forkParent) {
      const list = children.get(link.parentId) ?? [];
      list.push({ childId, lcpLength: link.lcpLength });
      children.set(link.parentId, list);
    }
    for (const list of children.values()) {
      list.sort((a, b) => a.lcpLength - b.lcpLength);
    }
    return children;
  }

  private buildComposerNode(
    composer: CursorComposerData,
    composers: Map<string, CursorComposerData>,
    forkParent: Map<string, ForkLink>,
    forkChildren: Map<string, ForkChildRef[]>,
    parentId: string,
    lcpFromParent: number
  ): ChatNode {
    const composerId = composer.composerId;
    const headers = composer.fullConversationHeadersOnly ?? [];
    const children: ChatNode[] = [];
    const childLinks = forkChildren.get(composerId) ?? [];

    const continuationStart = this.continuationStart(
      headers.length,
      lcpFromParent,
      childLinks
    );
    const continuationEnd = this.continuationEnd(
      headers.length,
      lcpFromParent,
      childLinks
    );
    const messageNodes: ChatNode[] = [];
    for (let index = continuationStart; index < continuationEnd; index += 1) {
      const header = headers[index];
      messageNodes.push({
        id: `msg:${composerId}:${header.bubbleId}`,
        parentId: composerId,
        title: bubbleTitle(composerId, header.bubbleId, header.type),
        createdAt: composer.createdAt ?? Date.now(),
        children: [],
        kind: 'message',
        composerId,
        bubbleId: header.bubbleId,
        bubbleType: header.type,
        source: 'cursor',
      });
    }

    const forkChildNodes: ChatNode[] = [];
    for (const link of childLinks) {
      const childComposer = composers.get(link.childId);
      if (!childComposer) {
        continue;
      }
      forkChildNodes.push(
        this.buildComposerNode(
          childComposer,
          composers,
          forkParent,
          forkChildren,
          composerId,
          link.lcpLength
        )
      );
    }

    if (lcpFromParent > 0 && headers.length >= lcpFromParent) {
      const forkBubble = headers[lcpFromParent - 1];
      children.push({
        id: `fork:${composerId}:${forkBubble.bubbleId}`,
        parentId: composerId,
        title: `Fork · ${bubbleTitle(composerId, forkBubble.bubbleId, forkBubble.type)}`,
        createdAt: composer.createdAt ?? Date.now(),
        children: [],
        kind: 'fork-point',
        composerId,
        bubbleId: forkBubble.bubbleId,
        bubbleType: forkBubble.type,
        forkedFromComposerId: forkParent.get(composerId)?.parentId,
        forkedAtBubbleId: forkBubble.bubbleId,
        source: 'cursor',
      });
      children.push(...messageNodes, ...forkChildNodes);
    } else {
      children.push(...forkChildNodes, ...messageNodes);
    }

    return {
      id: composerId,
      parentId,
      title: composerTitle(composer),
      createdAt: composer.createdAt ?? composer.lastUpdatedAt ?? Date.now(),
      children,
      summary: composer.subtitle?.trim() || composer.unifiedMode,
      status: mapStatus(composer.status),
      kind: 'composer',
      composerId,
      forkedFromComposerId: forkParent.get(composerId)?.parentId,
      forkedAtBubbleId:
        lcpFromParent > 0 && headers[lcpFromParent - 1]
          ? headers[lcpFromParent - 1].bubbleId
          : undefined,
      source: 'cursor',
    };
  }

  private continuationStart(
    headerCount: number,
    lcpFromParent: number,
    childLinks: Array<{ childId: string; lcpLength: number }>
  ): number {
    if (childLinks.length > 0) {
      return Math.max(lcpFromParent, Math.min(...childLinks.map((link) => link.lcpLength)));
    }
    if (lcpFromParent > 0) {
      return lcpFromParent;
    }
    return Math.max(0, headerCount - MAX_TAIL_MESSAGES);
  }

  private continuationEnd(
    headerCount: number,
    lcpFromParent: number,
    childLinks: ForkChildRef[]
  ): number {
    if (childLinks.length === 0) {
      return headerCount;
    }
    const minChildLcp = Math.min(...childLinks.map((link) => link.lcpLength));
    if (lcpFromParent > 0 && minChildLcp > lcpFromParent) {
      return minChildLcp;
    }
    return headerCount;
  }
}
