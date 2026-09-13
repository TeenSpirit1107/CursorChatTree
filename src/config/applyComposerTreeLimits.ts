import { ChatNode } from '../model/ChatNode';
import { getComposerTreeLimits } from './composerTreeSettings';
import { pruneComposerTree } from '../parser/composerTreeLimits';

export function applyComposerTreeLimits(root: ChatNode): ChatNode {
  return pruneComposerTree(root, getComposerTreeLimits());
}
