import { StorageManager } from '../../../storage/manager';
import { Logger } from '../../../logger';
import { DatabaseHistoryProvider } from './database.js';
import { IConversationHistoryProvider } from './types.js';

export function createDatabaseHistoryProvider(storage: StorageManager, logger: Logger): IConversationHistoryProvider {
  return new DatabaseHistoryProvider(storage, logger);
}
