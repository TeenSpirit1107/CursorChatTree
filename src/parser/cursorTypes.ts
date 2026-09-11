export interface CursorComposerHeader {
  composerId: string;
  name?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  unifiedMode?: string;
  subtitle?: string;
  workspaceIdentifier?: {
    id?: string;
    uri?: {
      fsPath?: string;
      external?: string;
    };
  };
}

export interface CursorComposerData {
  composerId: string;
  name?: string;
  subtitle?: string;
  createdAt?: number;
  lastUpdatedAt?: number;
  status?: string;
  unifiedMode?: string;
  subComposerIds?: string[];
  subagentComposerIds?: string[];
  isBestOfNParent?: boolean;
  isBestOfNSubcomposer?: boolean;
  subagentInfo?: {
    parentComposerId?: string;
    subagentTypeName?: string;
  };
  fullConversationHeadersOnly?: Array<{ bubbleId: string; type: number }>;
}

export interface CursorWorkspaceComposerData {
  allComposers?: CursorComposerHeader[];
  selectedComposerIds?: string[];
  lastFocusedComposerIds?: string[];
  hasMigratedComposerData?: boolean;
}

export interface CursorComposerHeadersIndex {
  allComposers?: CursorComposerHeader[];
}
