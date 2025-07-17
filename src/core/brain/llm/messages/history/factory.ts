import type { DatabaseBackend } from '../../../../storage/backend/database-backend.js';
import { Logger } from '../../../../logger/index.js';
import { DatabaseHistoryProvider } from './database.js';
import { IConversationHistoryProvider } from './types.js';

export function createDatabaseHistoryProvider(
	database: DatabaseBackend,
	logger: Logger
): IConversationHistoryProvider {
	return new DatabaseHistoryProvider(database, logger);
}
