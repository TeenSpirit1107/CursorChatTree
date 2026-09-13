export type ChatNodeStatus = 'active' | 'completed' | 'abandoned';

export type ChatNodeKind =
  | 'workspace-root'
  | 'composer'
  | 'message'
  | 'fork-point';

export interface ChatNode {
  id: string;
  parentId?: string;
  title: string;
  createdAt: number;
  children: ChatNode[];
  summary?: string;
  status?: ChatNodeStatus;
  kind?: ChatNodeKind;
  composerId?: string;
  bubbleId?: string;
  bubbleType?: number;
  forkedFromComposerId?: string;
  forkedAtBubbleId?: string;
  source?: 'cursor' | 'local';
}

export function createChatNode(
  title: string,
  parentId?: string,
  status?: ChatNodeStatus
): ChatNode {
  return {
    id: crypto.randomUUID(),
    parentId,
    title,
    createdAt: Date.now(),
    children: [],
    status,
  };
}

export function createDefaultRoot(): ChatNode {
  return {
    id: 'root',
    title: 'Current Conversation',
    createdAt: Date.now(),
    children: [
      {
        id: 'branch-a',
        parentId: 'root',
        title: 'Branch A',
        createdAt: Date.now(),
        children: [],
      },
      {
        id: 'branch-b',
        parentId: 'root',
        title: 'Branch B',
        createdAt: Date.now(),
        children: [],
      },
    ],
    status: 'active',
  };
}

export function findNode(root: ChatNode, id: string): ChatNode | undefined {
  if (root.id === id) {
    return root;
  }
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function removeNode(root: ChatNode, id: string): boolean {
  if (root.id === id) {
    return false;
  }
  const index = root.children.findIndex((child) => child.id === id);
  if (index !== -1) {
    root.children.splice(index, 1);
    return true;
  }
  for (const child of root.children) {
    if (removeNode(child, id)) {
      return true;
    }
  }
  return false;
}
