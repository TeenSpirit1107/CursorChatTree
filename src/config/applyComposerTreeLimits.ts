import { ChatNode } from '../model/ChatNode';
import { getComposerTreeLimits } from './composerTreeSettings';
import {
  pruneComposerTree,
  stripEmptyShellComposers,
} from '../parser/composerTreeLimits';

export function applyComposerTreeLimits(root: ChatNode): ChatNode {
  const cleaned = stripEmptyShellComposers(root);
  return pruneComposerTree(cleaned, getComposerTreeLimits());
}
