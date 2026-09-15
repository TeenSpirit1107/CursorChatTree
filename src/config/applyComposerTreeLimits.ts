import { ChatNode } from '../model/ChatNode';
import {
  ComposerTreeLimits,
  getComposerTreeLimits,
} from './composerTreeSettings';
import {
  pruneComposerTree,
  stripEmptyShellComposers,
} from '../parser/composerTreeLimits';

export function applyComposerTreeLimits(
  root: ChatNode,
  limits: ComposerTreeLimits = getComposerTreeLimits(),
  pinnedComposerIds: ReadonlySet<string> = new Set()
): ChatNode {
  const cleaned = stripEmptyShellComposers(root);
  return pruneComposerTree(cleaned, limits, pinnedComposerIds);
}
