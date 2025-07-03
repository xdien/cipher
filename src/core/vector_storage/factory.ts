/**
 * Vector Storage Factory
 *
 * Factory functions for creating and initializing the vector storage system.
 * Provides a simplified API for common vector storage setup patterns.
 *
 * @module vector_storage/factory
 */

import { VectorStoreManager } from './manager.js';
import type { VectorStoreConfig, VectorStore } from './types.js';
import { Logger, createLogger } from '../logger/index.js';
import { LOG_PREFIXES } from './constants.js';
import { env } from '../env.js';

/**
 * Factory result containing both the manager and vector store
 */
export interface VectorStoreFactory {
	/** The vector store manager instance for lifecycle control */
	manager: VectorStoreManager;
	/** The connected vector store ready for use */
	store: VectorStore;
}

/**
 * Creates and connects vector storage backend
 *
 * This is the primary factory function for initializing the vector storage system.
 * It creates a VectorStoreManager, connects to the configured backend, and
 * returns both the manager and the connected vector store.
 *
 * @param config - Vector storage configuration
 * @returns Promise resolving to manager and connected vector store
 * @throws {VectorStoreConnectionError} If connection fails and no fallback is available
 *
 * @example
 * ```typescript
 * // Basic usage with Qdrant
 * const { manager, store } = await createVectorStore({
 *   type: 'qdrant',
 *   host: 'localhost',
 *   port: 6333,
 *   collectionName: 'documents',
 *   dimension: 1536
 * });
 *
 * // Use the vector store
 * await store.insert([vector], ['doc1'], [{ title: 'Document' }]);
 * const results = await store.search(queryVector, 5);
 *
 * // Cleanup when done
 * await manager.disconnect();
 * ```
 *
 * @example
 * ```typescript
 * // Development configuration with in-memory
 * const { manager, store } = await createVectorStore({
 *   type: 'in-memory',
 *   collectionName: 'test',
 *   dimension: 1536,
 *   maxVectors: 1000
 * });
 * ```
 */
export async function createVectorStore(config: VectorStoreConfig): Promise<VectorStoreFactory> {
	const logger = createLogger({ level: env.CIPHER_LOG_LEVEL });

	logger.debug(`${LOG_PREFIXES.FACTORY} Creating vector storage system`, {
		type: config.type,
		collection: config.collectionName,
		dimension: config.dimension,
	});

	// Create manager
	const manager = new VectorStoreManager(config);

	try {
		// Connect to backend
		const store = await manager.connect();

		logger.info(`${LOG_PREFIXES.FACTORY} Vector storage system created successfully`, {
			type: manager.getInfo().backend.type,
			collection: config.collectionName,
			connected: manager.isConnected(),
		});

		return { manager, store };
	} catch (error) {
		// If connection fails, ensure cleanup
		await manager.disconnect().catch(() => {
			// Ignore disconnect errors during cleanup
		});

		logger.error(`${LOG_PREFIXES.FACTORY} Failed to create vector storage system`, {
			error: error instanceof Error ? error.message : String(error),
		});

		throw error;
	}
}

/**
 * Creates vector storage with default configuration
 *
 * Convenience function that creates vector storage with in-memory backend.
 * Useful for testing or development environments.
 *
 * @param collectionName - Optional collection name (default: 'default')
 * @param dimension - Optional vector dimension (default: 1536)
 * @returns Promise resolving to manager and connected vector store
 *
 * @example
 * ```typescript
 * const { manager, store } = await createDefaultVectorStore();
 * // Uses in-memory backend with default settings
 *
 * const { manager, store } = await createDefaultVectorStore('my_collection', 768);
 * // Uses in-memory backend with custom collection and dimension
 * ```
 */
export async function createDefaultVectorStore(
	collectionName: string = 'default',
	dimension: number = 1536
): Promise<VectorStoreFactory> {
	return createVectorStore({
		type: 'in-memory',
		collectionName,
		dimension,
		maxVectors: 10000,
	});
}

/**
 * Creates vector storage from environment variables
 *
 * Reads vector storage configuration from environment variables and creates
 * the vector storage system. Falls back to in-memory if not configured.
 *
 * Environment variables:
 * - VECTOR_STORE_TYPE: Backend type (qdrant, in-memory)
 * - VECTOR_STORE_HOST: Qdrant host (if using Qdrant)
 * - VECTOR_STORE_PORT: Qdrant port (if using Qdrant)
 * - VECTOR_STORE_URL: Qdrant URL (if using Qdrant)
 * - VECTOR_STORE_API_KEY: Qdrant API key (if using Qdrant)
 * - VECTOR_STORE_COLLECTION: Collection name
 * - VECTOR_STORE_DIMENSION: Vector dimension
 * - VECTOR_STORE_DISTANCE: Distance metric for Qdrant
 * - VECTOR_STORE_ON_DISK: Store vectors on disk (if using Qdrant)
 * - VECTOR_STORE_MAX_VECTORS: Maximum vectors for in-memory storage
 *
 * @returns Promise resolving to manager and connected vector store
 *
 * @example
 * ```typescript
 * // Set environment variables
 * process.env.VECTOR_STORE_TYPE = 'qdrant';
 * process.env.VECTOR_STORE_HOST = 'localhost';
 * process.env.VECTOR_STORE_COLLECTION = 'documents';
 *
 * const { manager, store } = await createVectorStoreFromEnv();
 * ```
 */
export async function createVectorStoreFromEnv(): Promise<VectorStoreFactory> {
	const logger = createLogger({ level: env.CIPHER_LOG_LEVEL });

	// Get configuration from environment variables
	const config = getVectorStoreConfigFromEnv();

	logger.info(`${LOG_PREFIXES.FACTORY} Creating vector storage from environment`, {
		type: config.type,
		collection: config.collectionName,
		dimension: config.dimension,
	});

	return createVectorStore(config);
}

/**
 * Get vector storage configuration from environment variables
 *
 * Returns the configuration object that would be used by createVectorStoreFromEnv
 * without actually creating the vector store. Useful for debugging and validation.
 *
 * @returns Vector storage configuration based on environment variables
 *
 * @example
 * ```typescript
 * const config = getVectorStoreConfigFromEnv();
 * console.log('Vector store configuration:', config);
 * 
 * // Then use the config to create the store
 * const { manager, store } = await createVectorStore(config);
 * ```
 */
export function getVectorStoreConfigFromEnv(): VectorStoreConfig {
	// Get configuration from centralized env object with fallbacks for invalid values
	const storeType = env.VECTOR_STORE_TYPE;
	const collectionName = env.VECTOR_STORE_COLLECTION;
	const dimension = Number.isNaN(env.VECTOR_STORE_DIMENSION) ? 1536 : env.VECTOR_STORE_DIMENSION;
	const maxVectors = Number.isNaN(env.VECTOR_STORE_MAX_VECTORS) ? 10000 : env.VECTOR_STORE_MAX_VECTORS;

	// Build configuration based on type
	let config: VectorStoreConfig;

	if (storeType === 'qdrant') {
		const host = env.VECTOR_STORE_HOST;
		const url = env.VECTOR_STORE_URL;
		const port = Number.isNaN(env.VECTOR_STORE_PORT) ? undefined : env.VECTOR_STORE_PORT;
		const apiKey = env.VECTOR_STORE_API_KEY;
		const distance = env.VECTOR_STORE_DISTANCE;
		const onDisk = env.VECTOR_STORE_ON_DISK;

		config = {
			type: 'qdrant',
			collectionName,
			dimension,
			url,
			host,
			port,
			apiKey,
			distance,
			onDisk,
		};

		// Validate required fields and fallback if necessary
		if (!url && !host) {
			config = {
				type: 'in-memory',
				collectionName,
				dimension,
				maxVectors,
			};
		}
	} else {
		// Use in-memory
		config = {
			type: 'in-memory',
			collectionName,
			dimension,
			maxVectors,
		};
	}

	return config;
}

/**
 * Type guard to check if an object is a VectorStoreFactory
 *
 * @param obj - Object to check
 * @returns true if the object has manager and store properties
 */
export function isVectorStoreFactory(obj: unknown): obj is VectorStoreFactory {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'manager' in obj &&
		'store' in obj &&
		obj.manager instanceof VectorStoreManager
	);
}
