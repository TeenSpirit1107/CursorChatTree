import { ChatNode } from '../model/ChatNode';
import {
  discoverRegisteredComposerIds,
  isCursorStorageAvailable,
} from './CursorStorageReader';

function isStaleCursorComposer(
  node: ChatNode,
  registered: ReadonlySet<string>
): boolean {
  return (
    node.source === 'cursor' &&
    node.kind === 'composer' &&
    Boolean(node.composerId) &&
    !registered.has(node.composerId!)
  );
}

function pruneChildrenAtLevel(
  children: ChatNode[],
  registered: ReadonlySet<string>,
  parentId: string
): ChatNode[] {
  const out: ChatNode[] = [];
  for (const child of children) {
    if (isStaleCursorComposer(child, registered)) {
      out.push(
        ...pruneChildrenAtLevel(child.children, registered, parentId).map(
          (hoisted) => ({
            ...hoisted,
            parentId,
            forkedFromComposerId: undefined,
          })
        )
      );
      continue;
    }

    out.push({
      ...child,
      parentId,
      children: pruneChildrenAtLevel(child.children, registered, child.id),
    });
  }
  return out;
}

/** Drop Cursor composers removed from Cursor's registry; hoist their children to the parent level. */
export function pruneDeletedCursorComposers(
  root: ChatNode,
  workspacePath: string
): ChatNode {
  if (!isCursorStorageAvailable()) {
    return root;
  }

  const registered = discoverRegisteredComposerIds(workspacePath);
  if (registered.size === 0) {
    return root;
  }

  return {
    ...root,
    children: pruneChildrenAtLevel(root.children, registered, root.id),
  };
}
