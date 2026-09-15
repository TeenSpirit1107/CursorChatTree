import * as vscode from 'vscode';

export const DEFAULT_MAX_ROOT_COMPOSERS = 20;
export const DEFAULT_MAX_TOTAL_COMPOSERS = 64;
export const ROOT_PAGE_SIZE = 5;
export const ROOT_PAGE_INCREMENT = 5;

export interface ComposerTreeLimits {
  maxRootComposers: number;
  maxTotalComposers: number;
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function getComposerTreeLimits(): ComposerTreeLimits {
  const config = vscode.workspace.getConfiguration('cursorChatTree');
  const maxRootComposers = clampInt(
    config.get('maxRootComposers'),
    DEFAULT_MAX_ROOT_COMPOSERS,
    1,
    500
  );
  let maxTotalComposers = clampInt(
    config.get('maxTotalComposers'),
    DEFAULT_MAX_TOTAL_COMPOSERS,
    1,
    1000
  );
  if (maxTotalComposers < maxRootComposers) {
    maxTotalComposers = maxRootComposers;
  }
  return { maxRootComposers, maxTotalComposers };
}

/** Limits used for sync/prune when only the first N roots are shown in the tree. */
export function getEffectiveComposerTreeLimits(
  visibleRootCount: number
): ComposerTreeLimits {
  const config = getComposerTreeLimits();
  const maxRootComposers = Math.min(
    Math.max(1, visibleRootCount),
    config.maxRootComposers
  );
  let maxTotalComposers = config.maxTotalComposers;
  if (maxTotalComposers < maxRootComposers) {
    maxTotalComposers = maxRootComposers;
  }
  return { maxRootComposers, maxTotalComposers };
}
