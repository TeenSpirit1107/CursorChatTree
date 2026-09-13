import { ComposerTreeLimits } from '../config/composerTreeSettings';
import { ChatNode } from '../model/ChatNode';

function computeSubtreeLatest(
  node: ChatNode,
  cache: Map<string, number>
): number {
  const cached = cache.get(node.id);
  if (cached !== undefined) {
    return cached;
  }
  let latest = node.createdAt ?? 0;
  for (const child of node.children) {
    latest = Math.max(latest, computeSubtreeLatest(child, cache));
  }
  cache.set(node.id, latest);
  return latest;
}

function buildIdMap(roots: ChatNode[]): Map<string, ChatNode> {
  const map = new Map<string, ChatNode>();
  const walk = (node: ChatNode): void => {
    map.set(node.id, node);
    for (const child of node.children) {
      walk(child);
    }
  };
  for (const root of roots) {
    walk(root);
  }
  return map;
}

function ancestorIdsToComposerRoot(
  node: ChatNode,
  idMap: Map<string, ChatNode>
): string[] {
  const ids: string[] = [];
  let parentId = node.parentId;
  while (parentId && parentId !== 'root') {
    if (!idMap.has(parentId)) {
      break;
    }
    ids.push(parentId);
    parentId = idMap.get(parentId)?.parentId;
  }
  return ids;
}

function collectDescendants(node: ChatNode, out: ChatNode[] = []): ChatNode[] {
  for (const child of node.children) {
    out.push(child);
    collectDescendants(child, out);
  }
  return out;
}

function rebuildComposer(node: ChatNode, kept: Set<string>): ChatNode {
  return {
    ...node,
    children: node.children
      .filter((child) => kept.has(child.id))
      .map((child) => rebuildComposer(child, kept)),
  };
}

/**
 * Keeps at most limits.maxRootComposers top-level chats and
 * limits.maxTotalComposers composers overall. Priority uses the latest
 * activity time in each node's subtree.
 */
export function pruneComposerTree(
  workspaceRoot: ChatNode,
  limits: ComposerTreeLimits
): ChatNode {
  const { maxRootComposers, maxTotalComposers } = limits;
  if (workspaceRoot.id !== 'root' || workspaceRoot.children.length === 0) {
    return workspaceRoot;
  }

  const latestCache = new Map<string, number>();
  for (const child of workspaceRoot.children) {
    computeSubtreeLatest(child, latestCache);
  }

  const selectedRoots = [...workspaceRoot.children]
    .sort(
      (a, b) =>
        (latestCache.get(b.id) ?? 0) - (latestCache.get(a.id) ?? 0)
    )
    .slice(0, maxRootComposers);

  const kept = new Set<string>(selectedRoots.map((node) => node.id));
  const idMap = buildIdMap(selectedRoots);

  const candidates: ChatNode[] = [];
  for (const root of selectedRoots) {
    collectDescendants(root, candidates);
  }
  candidates.sort(
    (a, b) =>
      (latestCache.get(b.id) ?? 0) - (latestCache.get(a.id) ?? 0)
  );

  for (const candidate of candidates) {
    if (kept.size >= maxTotalComposers) {
      break;
    }

    const toAdd: string[] = [];
    for (const ancestorId of ancestorIdsToComposerRoot(candidate, idMap)) {
      if (!kept.has(ancestorId)) {
        toAdd.push(ancestorId);
      }
    }
    if (!kept.has(candidate.id)) {
      toAdd.push(candidate.id);
    }

    if (kept.size + toAdd.length <= maxTotalComposers) {
      for (const id of toAdd) {
        kept.add(id);
      }
    }
  }

  return {
    ...workspaceRoot,
    children: selectedRoots.map((node) => rebuildComposer(node, kept)),
  };
}
