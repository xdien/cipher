import { IConversationHistoryProvider } from './types.js';
import { InternalMessage } from '../types.js';
import { StorageManager } from '../../../storage/manager.js';
import { Logger } from '../../../logger/index.js';

const MESSAGE_LIMIT = 1000;
const HISTORY_KEY_PREFIX = 'messages:';
const TRUNCATE_LENGTH = 200;

function truncateContent(content: string): string {
  if (content.length > TRUNCATE_LENGTH) {
    return content.slice(0, TRUNCATE_LENGTH) + '... [truncated]';
  }
  return content;
}

export class DatabaseHistoryProvider implements IConversationHistoryProvider {
  private storage: StorageManager;
  private logger: Logger;

  constructor(storage: StorageManager, logger: Logger) {
    this.storage = storage;
    this.logger = logger;
  }

  private getKey(sessionId: string): string {
    return `${HISTORY_KEY_PREFIX}${sessionId}`;
  }

  async getHistory(sessionId: string, limit: number = MESSAGE_LIMIT): Promise<InternalMessage[]> {
    try {
      const key = this.getKey(sessionId);
      const messages: InternalMessage[] = (await this.storage.get(key)) || [];
      // Return oldest first, limit to MESSAGE_LIMIT
      return messages.slice(-limit);
    } catch (err) {
      this.logger.error(`Failed to get history for session ${sessionId}: ${err}`);
      throw err;
    }
  }

  async saveMessage(sessionId: string, message: InternalMessage): Promise<void> {
    try {
      const key = this.getKey(sessionId);
      const messages: InternalMessage[] = (await this.storage.get(key)) || [];
      messages.push(message);
      // Enforce message limit
      const trimmed = messages.slice(-MESSAGE_LIMIT);
      await this.storage.set(key, trimmed);
      this.logger.debug(
        `Saved message to session ${sessionId}: ${truncateContent(JSON.stringify(message))}`
      );
    } catch (err) {
      this.logger.error(`Failed to save message for session ${sessionId}: ${err}`);
    }
  }

  async clearHistory(sessionId: string): Promise<void> {
    try {
      const key = this.getKey(sessionId);
      await this.storage.delete(key);
      this.logger.debug(`Cleared history for session ${sessionId}`);
    } catch (err) {
      this.logger.error(`Failed to clear history for session ${sessionId}: ${err}`);
    }
  }
}
