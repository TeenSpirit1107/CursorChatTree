import { ComposerTreeLimits } from '../config/composerTreeSettings';

export function composerActivity(
  createdAt?: number,
  lastUpdatedAt?: number
): number {
  return Math.max(createdAt ?? 0, lastUpdatedAt ?? 0);
}

export function rankComposerIds(
  seedIds: string[],
  activityById: Map<string, number>
): string[] {
  const unique = [...new Set(seedIds)];
  return unique.sort((a, b) => {
    const diff = (activityById.get(b) ?? 0) - (activityById.get(a) ?? 0);
    if (diff !== 0) {
      return diff;
    }
    return a.localeCompare(b);
  });
}

/**
 * Picks composer IDs to load before hitting SQLite: top maxRootComposers by activity,
 * then fills toward maxTotalComposers with the next highest-activity ids.
 */
export function selectComposerIdsForLimits(
  rankedIds: string[],
  limits: ComposerTreeLimits
): string[] {
  const { maxRootComposers, maxTotalComposers } = limits;
  if (rankedIds.length === 0) {
    return [];
  }

  const roots = rankedIds.slice(0, maxRootComposers);
  const selected = [...roots];
  const selectedSet = new Set(roots);

  for (const id of rankedIds.slice(maxRootComposers)) {
    if (selected.length >= maxTotalComposers) {
      break;
    }
    if (!selectedSet.has(id)) {
      selected.push(id);
      selectedSet.add(id);
    }
  }

  return selected.slice(0, maxTotalComposers);
}
