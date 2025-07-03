/**
 * Storage Backend Exports
 *
 * Central export point for all storage backend implementations.
 *
 * @module storage/backend
 */

// Interface exports
export type { CacheBackend } from './cache-backend.js';
export type { DatabaseBackend } from './database-backend.js';

// Implementation exports
export { InMemoryBackend } from './in-memory.js';
export { RedisBackend } from './redis-backend.js';
export { SqliteBackend } from './sqlite.js';

// Type exports
export { StorageError, StorageConnectionError, StorageNotFoundError } from './types.js';

export type {
	StorageBackends,
	BackendConfig,
	InMemoryBackendConfig,
	RedisBackendConfig,
	SqliteBackendConfig,
} from './types.js';
