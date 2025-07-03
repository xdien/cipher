/**
 * SQLite Backend Implementation (Placeholder)
 *
 * This is a placeholder for the SQLite backend implementation.
 * Will be implemented when the sqlite3 module is available.
 *
 * @module storage/backend/sqlite
 */

import type { DatabaseBackend } from './database-backend.js';
import type { SqliteBackendConfig } from '../config.js';
import { StorageError, StorageConnectionError } from './types.js';
import { BACKEND_TYPES } from '../constants.js';
import { Logger, createLogger } from '../../logger/index.js';

/**
 * SQLite Database Backend (Placeholder)
 *
 * Will provide persistent storage using SQLite database.
 *
 * Features to implement:
 * - File-based storage
 * - SQL queries for key-value operations
 * - Transaction support
 * - Schema migration
 */
export class SqliteBackend implements DatabaseBackend {
	private readonly logger: Logger;
	private connected = false;

	constructor(private config: SqliteBackendConfig) {
		this.logger = createLogger({ level: process.env.LOG_LEVEL || 'info' });
		this.logger.warn('SqliteBackend is not implemented yet - using as placeholder');
	}

	async connect(): Promise<void> {
		throw new StorageConnectionError(
			'SQLite backend not implemented',
			BACKEND_TYPES.SQLITE,
			new Error('This is a placeholder implementation')
		);
	}

	async disconnect(): Promise<void> {
		this.connected = false;
	}

	isConnected(): boolean {
		return this.connected;
	}

	getBackendType(): string {
		return BACKEND_TYPES.SQLITE;
	}

	// DatabaseBackend methods (all throw not implemented)

	async get<T>(key: string): Promise<T | undefined> {
		throw new StorageError('SQLite backend not implemented', 'get');
	}

	async set<T>(key: string, value: T): Promise<void> {
		throw new StorageError('SQLite backend not implemented', 'set');
	}

	async delete(key: string): Promise<void> {
		throw new StorageError('SQLite backend not implemented', 'delete');
	}

	async list(prefix: string): Promise<string[]> {
		throw new StorageError('SQLite backend not implemented', 'list');
	}

	async append<T>(key: string, item: T): Promise<void> {
		throw new StorageError('SQLite backend not implemented', 'append');
	}

	async getRange<T>(key: string, start: number, count: number): Promise<T[]> {
		throw new StorageError('SQLite backend not implemented', 'getRange');
	}
}
