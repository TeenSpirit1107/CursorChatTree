import { ComposerTreeLimits } from '../config/composerTreeSettings';
import { ChatNode } from '../model/ChatNode';
import { CursorComposerData } from './cursorTypes';
import { MessageForkParser } from './MessageForkParser';

export class ChatParser {
  private readonly forkParser = new MessageForkParser();

  parseWorkspaceComposers(
    composers: Map<string, CursorComposerData>,
    workspaceTitle = 'Conversations',
    limits: ComposerTreeLimits
  ): ChatNode | null {
    return this.forkParser.buildWorkspaceTree(composers, workspaceTitle, limits);
  }
}
