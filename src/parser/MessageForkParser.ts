import { ComposerTreeLimits } from '../config/composerTreeSettings';
import { ChatNode, ChatNodeStatus } from '../model/ChatNode';
import { pruneComposerTree } from './composerTreeLimits';
import { CursorComposerData } from './cursorTypes';

const MIN_SHARED_BUBBLES = 2;

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
  if (name) {
    return name;
  }
  const subtitle = composer.subtitle?.trim();
  if (subtitle && subtitle !== 'New chat') {
    return subtitle;
  }
  return '(Untitled chat)';
}

function composerActivityAt(composer: CursorComposerData): number {
  const t = Math.max(composer.createdAt ?? 0, composer.lastUpdatedAt ?? 0);
  return t || Date.now();
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
    composer.composerId.startsWith('task-') ||
    Boolean(composer.isBestOfNSubcomposer)
  );
}

/** Cursor often leaves named-empty composer rows (0 bubbles) in storage. */
function isEmptyComposerShell(composer: CursorComposerData): boolean {
  return (
    (composer.fullConversationHeadersOnly ?? []).length === 0 &&
    !composer.name?.trim()
  );
}

export class MessageForkParser {
  buildWorkspaceTree(
    composers: Map<string, CursorComposerData>,
    workspaceTitle = 'Conversations',
    limits: ComposerTreeLimits,
    pinnedComposerIds: ReadonlySet<string> = new Set()
  ): ChatNode | null {
    const eligible = [...composers.values()].filter(
      (composer) =>
        !isSubagentComposer(composer) && !isEmptyComposerShell(composer)
    );
    if (eligible.length === 0) {
      return null;
    }

    const forkParent = this.buildForkParentMap(eligible);
    this.dropForkLinksToMissingParents(forkParent, eligible);
    const forkChildren = this.buildForkChildrenMap(forkParent);

    const roots = eligible
      .filter((composer) => !forkParent.has(composer.composerId))
      .sort((a, b) => this.compareRootComposers(a, b, pinnedComposerIds));

    const tree: ChatNode = {
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

    return pruneComposerTree(tree, limits, pinnedComposerIds);
  }

  private compareRootComposers(
    a: CursorComposerData,
    b: CursorComposerData,
    pinnedComposerIds: ReadonlySet<string>
  ): number {
    const aPinned = pinnedComposerIds.has(a.composerId);
    const bPinned = pinnedComposerIds.has(b.composerId);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return composerActivityAt(b) - composerActivityAt(a);
  }

  /** When the fork parent was deleted in Cursor, show the child as a workspace root composer. */
  private dropForkLinksToMissingParents(
    forkParent: Map<string, ForkLink>,
    eligible: CursorComposerData[]
  ): void {
    const eligibleIds = new Set(eligible.map((composer) => composer.composerId));
    for (const [childId, link] of forkParent.entries()) {
      if (!eligibleIds.has(link.parentId)) {
        forkParent.delete(childId);
      }
    }
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
    const childLinks = forkChildren.get(composerId) ?? [];

    const children: ChatNode[] = [];
    for (const link of childLinks) {
      const childComposer = composers.get(link.childId);
      if (!childComposer) {
        continue;
      }
      children.push(
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

    return {
      id: composerId,
      parentId,
      title: composerTitle(composer),
      createdAt: composerActivityAt(composer),
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
}
