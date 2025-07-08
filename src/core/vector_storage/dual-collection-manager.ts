/**
 * Dual Collection Vector Manager
 *
 * Manages two separate vector collections for knowledge and reflection memory.
 * Built on top of the existing VectorStoreManager infrastructure.
 */

import { VectorStoreManager } from './manager.js';
import { VectorStore } from './backend/vector-store.js';
import type { VectorStoreConfig } from './types.js';
import { Logger, createLogger } from '../logger/index.js';
import { env } from '../env.js';

/**
 * Collection type identifier
 */
export type CollectionType = 'knowledge' | 'reflection';

/**
 * Information about both collections
 */
export interface DualCollectionInfo {
	knowledge: {
		connected: boolean;
		collectionName: string;
		manager: VectorStoreManager;
	};
	reflection: {
		connected: boolean;
		collectionName: string;
		manager: VectorStoreManager;
		enabled: boolean;
	};
	overallConnected: boolean;
}

/**
 * Dual Collection Vector Manager
 *
 * Manages separate vector collections for knowledge and reflection memory.
 * Uses two VectorStoreManager instances under the hood.
 *
 * @example
 * ```typescript
 * const dualManager = new DualCollectionVectorManager(baseConfig);
 * await dualManager.connect();
 *
 * // Get knowledge store
 * const knowledgeStore = dualManager.getStore('knowledge');
 * 
 * // Get reflection store (if enabled)
 * const reflectionStore = dualManager.getStore('reflection');
 * ```
 */
export class DualCollectionVectorManager {
	private readonly knowledgeManager: VectorStoreManager;
	private readonly reflectionManager: VectorStoreManager | null;
	private readonly logger: Logger;
	private readonly reflectionEnabled: boolean;
	
	constructor(baseConfig: VectorStoreConfig) {
		this.logger = createLogger({
			level: process.env.LOG_LEVEL || 'info',
		});

		// Check if reflection memory is enabled
		this.reflectionEnabled = env.REFLECTION_MEMORY_ENABLED;

		// Create knowledge manager with original collection name
		this.knowledgeManager = new VectorStoreManager(baseConfig);

		// Create reflection manager only if enabled
		if (this.reflectionEnabled) {
			const reflectionConfig: VectorStoreConfig = {
				...baseConfig,
				collectionName: env.REFLECTION_VECTOR_STORE_COLLECTION,
			};
			this.reflectionManager = new VectorStoreManager(reflectionConfig);

			this.logger.info('DualCollectionVectorManager: Initialized with reflection memory enabled', {
				knowledgeCollection: baseConfig.collectionName,
				reflectionCollection: env.REFLECTION_VECTOR_STORE_COLLECTION,
			});
		} else {
			this.reflectionManager = null;
			this.logger.info('DualCollectionVectorManager: Initialized with reflection memory disabled', {
				knowledgeCollection: baseConfig.collectionName,
			});
		}
	}

	/**
	 * Connect both collections
	 */
	async connect(): Promise<void> {
		this.logger.info('DualCollectionVectorManager: Connecting collections...');

		// Always connect knowledge collection
		await this.knowledgeManager.connect();
		this.logger.info('DualCollectionVectorManager: Knowledge collection connected');

		// Connect reflection collection only if enabled
		if (this.reflectionEnabled && this.reflectionManager) {
			try {
				await this.reflectionManager.connect();
				this.logger.info('DualCollectionVectorManager: Reflection collection connected');
			} catch (error) {
				this.logger.warn('DualCollectionVectorManager: Failed to connect reflection collection', {
					error: error instanceof Error ? error.message : String(error),
				});
				// Don't fail the entire connection if reflection fails
			}
		}
	}

	/**
	 * Disconnect both collections
	 */
	async disconnect(): Promise<void> {
		this.logger.info('DualCollectionVectorManager: Disconnecting collections...');

		// Disconnect both collections
		await Promise.allSettled([
			this.knowledgeManager.disconnect(),
			this.reflectionManager?.disconnect(),
		]);

		this.logger.info('DualCollectionVectorManager: All collections disconnected');
	}

	/**
	 * Get a vector store by collection type
	 */
	getStore(type: CollectionType): VectorStore | null {
		switch (type) {
			case 'knowledge':
				return this.knowledgeManager.getStore();
			case 'reflection':
				if (!this.reflectionEnabled || !this.reflectionManager) {
					this.logger.debug('DualCollectionVectorManager: Reflection memory is disabled');
					return null;
				}
				return this.reflectionManager.getStore();
			default:
				throw new Error(`Unknown collection type: ${type}`);
		}
	}

	/**
	 * Check if collections are connected
	 */
	isConnected(type?: CollectionType): boolean {
		if (type) {
			switch (type) {
				case 'knowledge':
					return this.knowledgeManager.isConnected();
				case 'reflection':
					return this.reflectionEnabled && this.reflectionManager?.isConnected() === true;
				default:
					throw new Error(`Unknown collection type: ${type}`);
			}
		}

		// Check overall connection status
		const knowledgeConnected = this.knowledgeManager.isConnected();
		const reflectionConnected = !this.reflectionEnabled || this.reflectionManager?.isConnected() === true;
		
		return knowledgeConnected && reflectionConnected;
	}

	/**
	 * Get information about both collections
	 */
	getInfo(): DualCollectionInfo {
		return {
			knowledge: {
				connected: this.knowledgeManager.isConnected(),
				collectionName: this.knowledgeManager.getConfig().collectionName,
				manager: this.knowledgeManager,
			},
			reflection: {
				connected: this.reflectionManager?.isConnected() === true,
				collectionName: env.REFLECTION_VECTOR_STORE_COLLECTION,
				manager: this.reflectionManager!,
				enabled: this.reflectionEnabled,
			},
			overallConnected: this.isConnected(),
		};
	}

	/**
	 * Get a manager by collection type (for advanced usage)
	 */
	getManager(type: CollectionType): VectorStoreManager | null {
		switch (type) {
			case 'knowledge':
				return this.knowledgeManager;
			case 'reflection':
				return this.reflectionManager;
			default:
				throw new Error(`Unknown collection type: ${type}`);
		}
	}

	/**
	 * Health check for both collections
	 */
	async healthCheck(): Promise<{
		knowledge: any;
		reflection: any;
		overall: boolean;
	}> {
		const knowledgeHealth = await this.knowledgeManager.healthCheck();
		const reflectionHealth = this.reflectionManager 
			? await this.reflectionManager.healthCheck()
			: { overall: true }; // Consider healthy if disabled

		return {
			knowledge: knowledgeHealth,
			reflection: reflectionHealth,
			overall: knowledgeHealth.overall && reflectionHealth.overall,
		};
	}
} 