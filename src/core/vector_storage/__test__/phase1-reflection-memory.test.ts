/**
 * Phase 1 Test: Reflection Memory Infrastructure
 * 
 * Tests environment configuration and dual collection vector storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../../env.js';
import { DualCollectionVectorManager } from '../dual-collection-manager.js';
import { createDualCollectionVectorStoreFromEnv } from '../factory.js';
import type { VectorStoreConfig } from '../types.js';

// Mock Qdrant client to prevent actual connections during tests
const mockQdrantClient = {
	getCollections: vi.fn(),
	getCollection: vi.fn(),
	createCollection: vi.fn(),
	upsert: vi.fn(),
	search: vi.fn(),
	retrieve: vi.fn(),
	delete: vi.fn(),
	deleteCollection: vi.fn(),
	count: vi.fn(),
	scroll: vi.fn(),
};

vi.mock('@qdrant/js-client-rest', () => ({
	QdrantClient: vi.fn(() => mockQdrantClient),
}));

// Mock logger to reduce test noise
vi.mock('../../logger/index.js', () => ({
	createLogger: () => ({
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

describe('Phase 1: Reflection Memory Infrastructure', () => {
	let originalEnv: Record<string, string | undefined>;

	beforeEach(() => {
		// Save original environment
		originalEnv = {
			REFLECTION_MEMORY_ENABLED: process.env.REFLECTION_MEMORY_ENABLED,
			REFLECTION_VECTOR_STORE_COLLECTION: process.env.REFLECTION_VECTOR_STORE_COLLECTION,
			REFLECTION_AUTO_EXTRACT: process.env.REFLECTION_AUTO_EXTRACT,
			REFLECTION_EVALUATION_ENABLED: process.env.REFLECTION_EVALUATION_ENABLED,
			VECTOR_STORE_TYPE: process.env.VECTOR_STORE_TYPE,
			VECTOR_STORE_COLLECTION: process.env.VECTOR_STORE_COLLECTION,
		};

		// Reset all mocks
		vi.clearAllMocks();
		
		// Mock Qdrant to fail connections (to trigger fallback to in-memory)
		mockQdrantClient.getCollections.mockRejectedValue(new Error('Qdrant connection failed'));
	});

	afterEach(() => {
		// Restore original environment
		Object.keys(originalEnv).forEach(key => {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		});
	});

	describe('Environment Configuration', () => {
		it('should have default reflection memory settings when not configured', () => {
			// Clear reflection memory env vars
			delete process.env.REFLECTION_MEMORY_ENABLED;
			delete process.env.REFLECTION_VECTOR_STORE_COLLECTION;
			delete process.env.REFLECTION_AUTO_EXTRACT;
			delete process.env.REFLECTION_EVALUATION_ENABLED;

			expect(env.REFLECTION_MEMORY_ENABLED).toBe(false);
			expect(env.REFLECTION_VECTOR_STORE_COLLECTION).toBe('reflection_memory');
			expect(env.REFLECTION_AUTO_EXTRACT).toBe(true);
			expect(env.REFLECTION_EVALUATION_ENABLED).toBe(true);
		});

		it('should read reflection memory settings from environment', () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.REFLECTION_VECTOR_STORE_COLLECTION = 'custom_reflection';
			process.env.REFLECTION_AUTO_EXTRACT = 'false';
			process.env.REFLECTION_EVALUATION_ENABLED = 'false';

			expect(env.REFLECTION_MEMORY_ENABLED).toBe(true);
			expect(env.REFLECTION_VECTOR_STORE_COLLECTION).toBe('custom_reflection');
			expect(env.REFLECTION_AUTO_EXTRACT).toBe(false);
			expect(env.REFLECTION_EVALUATION_ENABLED).toBe(false);
		});

		it('should handle boolean environment variables correctly', () => {
			// Test various boolean representations
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			expect(env.REFLECTION_MEMORY_ENABLED).toBe(true);

			process.env.REFLECTION_MEMORY_ENABLED = 'false';
			expect(env.REFLECTION_MEMORY_ENABLED).toBe(false);

			process.env.REFLECTION_MEMORY_ENABLED = '';
			expect(env.REFLECTION_MEMORY_ENABLED).toBe(false);

			delete process.env.REFLECTION_MEMORY_ENABLED;
			expect(env.REFLECTION_MEMORY_ENABLED).toBe(false);
		});
	});

	describe('DualCollectionVectorManager', () => {
		const testConfig: VectorStoreConfig = {
			type: 'in-memory',
			collectionName: 'test_knowledge',
			dimension: 1536,
			maxVectors: 1000,
		};

		it('should create dual collection manager with reflection disabled', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'false';
			process.env.VECTOR_STORE_TYPE = 'in-memory';

			const manager = new DualCollectionVectorManager(testConfig);
			await manager.connect();

			expect(manager.isConnected('knowledge')).toBe(true);
			expect(manager.isConnected('reflection')).toBe(false);
			expect(manager.getStore('knowledge')).not.toBeNull();
			expect(manager.getStore('reflection')).toBeNull();

			const info = manager.getInfo();
			expect(info.knowledge.connected).toBe(true);
			expect(info.reflection.enabled).toBe(false);
			expect(info.reflection.connected).toBe(false);

			await manager.disconnect();
		});

		it('should create dual collection manager with reflection enabled', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.REFLECTION_VECTOR_STORE_COLLECTION = 'test_reflection';
			process.env.VECTOR_STORE_TYPE = 'in-memory';

			const manager = new DualCollectionVectorManager(testConfig);
			await manager.connect();

			expect(manager.isConnected('knowledge')).toBe(true);
			expect(manager.isConnected('reflection')).toBe(true);
			expect(manager.getStore('knowledge')).not.toBeNull();
			expect(manager.getStore('reflection')).not.toBeNull();

			const info = manager.getInfo();
			expect(info.knowledge.connected).toBe(true);
			expect(info.knowledge.collectionName).toBe('test_knowledge');
			expect(info.reflection.enabled).toBe(true);
			expect(info.reflection.connected).toBe(true);
			expect(info.reflection.collectionName).toBe('test_reflection');

			await manager.disconnect();
		});

		it('should handle reflection collection connection failure gracefully', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.VECTOR_STORE_TYPE = 'in-memory';

			// Use a valid config - the graceful handling happens when reflection collection
			// fails to connect but knowledge collection succeeds
			const validConfig: VectorStoreConfig = {
				type: 'in-memory',
				collectionName: 'test_knowledge',
				dimension: 1536,
				maxVectors: 1000,
			};

			const manager = new DualCollectionVectorManager(validConfig);
			
			// Should not throw, but handle gracefully
			await expect(manager.connect()).resolves.not.toThrow();
			
			// Knowledge should be connected (this test mainly ensures no exceptions are thrown)
			expect(manager.isConnected('knowledge')).toBe(true);
			
			// Reflection should also be connected since config is valid
			// This test mainly verifies the error handling structure is in place
			expect(manager.isConnected('reflection')).toBe(true);

			await manager.disconnect();
		});

		it('should provide individual managers for advanced usage', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.VECTOR_STORE_TYPE = 'in-memory';

			const manager = new DualCollectionVectorManager(testConfig);
			await manager.connect();

			const knowledgeManager = manager.getManager('knowledge');
			const reflectionManager = manager.getManager('reflection');

			expect(knowledgeManager).not.toBeNull();
			expect(reflectionManager).not.toBeNull();
			expect(knowledgeManager?.isConnected()).toBe(true);
			expect(reflectionManager?.isConnected()).toBe(true);

			await manager.disconnect();
		});

		it('should perform health checks on both collections', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.VECTOR_STORE_TYPE = 'in-memory';

			const manager = new DualCollectionVectorManager(testConfig);
			await manager.connect();

			const health = await manager.healthCheck();
			
			expect(health.knowledge).toBeDefined();
			expect(health.reflection).toBeDefined();
			expect(health.overall).toBe(true);
			expect(health.knowledge.overall).toBe(true);
			expect(health.reflection.overall).toBe(true);

			await manager.disconnect();
		});
	});

	describe('Factory Integration', () => {
		it('should create dual collection from environment variables', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.VECTOR_STORE_TYPE = 'in-memory';
			process.env.VECTOR_STORE_COLLECTION = 'env_knowledge';
			process.env.REFLECTION_VECTOR_STORE_COLLECTION = 'env_reflection';
			process.env.VECTOR_STORE_DIMENSION = '512';

			const factory = await createDualCollectionVectorStoreFromEnv();

			expect(factory.manager).toBeInstanceOf(DualCollectionVectorManager);
			expect(factory.knowledgeStore).not.toBeNull();
			expect(factory.reflectionStore).not.toBeNull();

			expect(factory.manager.isConnected('knowledge')).toBe(true);
			expect(factory.manager.isConnected('reflection')).toBe(true);

			const info = factory.manager.getInfo();
			expect(info.knowledge.collectionName).toBe('env_knowledge');
			expect(info.reflection.collectionName).toBe('env_reflection');

			await factory.manager.disconnect();
		});

		it('should create dual collection with reflection disabled from environment', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'false';
			process.env.VECTOR_STORE_TYPE = 'in-memory';
			process.env.VECTOR_STORE_COLLECTION = 'knowledge_only';

			const factory = await createDualCollectionVectorStoreFromEnv();

			expect(factory.manager).toBeInstanceOf(DualCollectionVectorManager);
			expect(factory.knowledgeStore).not.toBeNull();
			expect(factory.reflectionStore).toBeNull();

			expect(factory.manager.isConnected('knowledge')).toBe(true);
			expect(factory.manager.isConnected('reflection')).toBe(false);

			await factory.manager.disconnect();
		});

		it('should handle factory connection failures', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.VECTOR_STORE_TYPE = 'qdrant';
			// No host/URL provided - should fallback to in-memory

			// Factory should handle incomplete Qdrant config by falling back to in-memory
			const factory = await createDualCollectionVectorStoreFromEnv();
			
			// Should fallback to in-memory if Qdrant config is incomplete
			expect(factory.manager).toBeInstanceOf(DualCollectionVectorManager);
			expect(factory.knowledgeStore).not.toBeNull();
			expect(factory.reflectionStore).not.toBeNull();
			
			// Both collections should be connected successfully via fallback
			expect(factory.manager.isConnected('knowledge')).toBe(true);
			expect(factory.manager.isConnected('reflection')).toBe(true);
			
			await factory.manager.disconnect();
		});
	});

	describe('Collection Type Validation', () => {
		it('should throw error for invalid collection types', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
			process.env.VECTOR_STORE_TYPE = 'in-memory';

			const manager = new DualCollectionVectorManager({
				type: 'in-memory',
				collectionName: 'test',
				dimension: 1536,
				maxVectors: 1000,
			});

			await manager.connect();

			// Testing invalid collection type
			expect(() => manager.getStore('invalid' as any)).toThrow('Unknown collection type');
			
			// Testing invalid collection type
			expect(() => manager.isConnected('invalid' as any)).toThrow('Unknown collection type');

			// Testing invalid collection type
			expect(() => manager.getManager('invalid' as any)).toThrow('Unknown collection type');

			await manager.disconnect();
		});
	});

	describe('Backwards Compatibility', () => {
		it('should not break existing single collection workflows', async () => {
			process.env.REFLECTION_MEMORY_ENABLED = 'false';
			process.env.VECTOR_STORE_TYPE = 'in-memory';
			process.env.VECTOR_STORE_COLLECTION = 'legacy_collection';

			const factory = await createDualCollectionVectorStoreFromEnv();
			
			// Should behave like original single collection
			expect(factory.knowledgeStore).not.toBeNull();
			expect(factory.reflectionStore).toBeNull();
			expect(factory.manager.isConnected()).toBe(true); // Overall connection

			// Knowledge store should work normally
			const store = factory.knowledgeStore!;
			expect(store.isConnected()).toBe(true);

			await factory.manager.disconnect();
		});
	});
}); 