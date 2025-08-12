import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { PineconeBackend } from '../backend/pinecone.js';
import type { PineconeBackendConfig } from '../backend/types.js';
import { VectorStoreError, VectorStoreConnectionError } from '../backend/types.js';
import { DEFAULTS, ERROR_MESSAGES } from '../constants.js';

// Mock Pinecone client
const mockIndex = {
	upsert: vi.fn(),
	query: vi.fn(),
	fetch: vi.fn(),
	delete: vi.fn(),
	describeIndexStats: vi.fn(),
};

const mockPineconeClient = {
	Index: vi.fn(() => mockIndex),
};

// Mock the Pinecone import
vi.mock('@pinecone-database/pinecone', () => ({
	Pinecone: vi.fn(() => mockPineconeClient),
}));

// Mock logger
vi.mock('../../../logger/index.js', () => ({
	createLogger: vi.fn(() => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	})),
}));

describe('PineconeBackend', () => {
	let backend: PineconeBackend;
	let config: PineconeBackendConfig;

	beforeEach(() => {
		config = {
			type: 'pinecone',
			apiKey: 'test-api-key',
			indexName: 'test-index',
			collectionName: 'test-collection',
			dimension: 128,
			namespace: 'test-namespace',
		};

		backend = new PineconeBackend(config);

		// Reset all mocks
		vi.clearAllMocks();
		mockIndex.describeIndexStats.mockResolvedValue({});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Constructor', () => {
		it('should initialize with correct configuration', () => {
			expect(backend.getBackendType()).toBe('pinecone');
			expect(backend.getDimension()).toBe(128);
			expect(backend.getCollectionName()).toBe('test-index');
			expect(backend.getNamespace()).toBe('test-namespace');
		});

		it('should use indexName over collectionName', () => {
			const configWithBoth = {
				...config,
				indexName: 'index-name',
				collectionName: 'collection-name',
			};
			const backendWithBoth = new PineconeBackend(configWithBoth);
			expect(backendWithBoth.getCollectionName()).toBe('index-name');
		});

		it('should use default namespace when not provided', () => {
			const configNoNamespace = {
				...config,
				namespace: undefined,
			};
			const backendNoNamespace = new PineconeBackend(configNoNamespace);
			expect(backendNoNamespace.getNamespace()).toBe(DEFAULTS.PINECONE_NAMESPACE);
		});
	});

	describe('Connection Management', () => {
		it('should connect successfully', async () => {
			expect(backend.isConnected()).toBe(false);

			await backend.connect();

			expect(backend.isConnected()).toBe(true);
			expect(mockPineconeClient.Index).toHaveBeenCalledWith('test-index');
			expect(mockIndex.describeIndexStats).toHaveBeenCalled();
		});

		it('should handle connection failure', async () => {
			const error = new Error('Connection failed');
			mockIndex.describeIndexStats.mockRejectedValue(error);

			await expect(backend.connect()).rejects.toThrow(VectorStoreConnectionError);
			expect(backend.isConnected()).toBe(false);
		});

		it('should not reconnect if already connected', async () => {
			await backend.connect();
			vi.clearAllMocks();

			await backend.connect();

			expect(mockPineconeClient.Index).not.toHaveBeenCalled();
			expect(mockIndex.describeIndexStats).not.toHaveBeenCalled();
		});

		it('should disconnect successfully', async () => {
			await backend.connect();
			expect(backend.isConnected()).toBe(true);

			await backend.disconnect();

			expect(backend.isConnected()).toBe(false);
		});

		it('should handle disconnect when not connected', async () => {
			expect(backend.isConnected()).toBe(false);

			await expect(backend.disconnect()).resolves.not.toThrow();
		});
	});

	describe('Insert Operations', () => {
		beforeEach(async () => {
			await backend.connect();
			mockIndex.upsert.mockResolvedValue({});
		});

		it('should insert vectors successfully', async () => {
			const vectors = [[1, 2, 3, ...Array(125).fill(0)]];
			const ids = [1];
			const payloads = [{ title: 'Document 1' }];

			await backend.insert(vectors, ids, payloads);

			expect(mockIndex.upsert).toHaveBeenCalledWith({
				vectors: [
					{
						id: '1',
						values: vectors[0],
						metadata: payloads[0],
					},
				],
				namespace: 'test-namespace',
			});
		});

		it('should insert multiple vectors', async () => {
			const vectors = [
				[1, 2, 3, ...Array(125).fill(0)],
				[4, 5, 6, ...Array(125).fill(0)],
			];
			const ids = [1, 2];
			const payloads = [{ title: 'Doc 1' }, { title: 'Doc 2' }];

			await backend.insert(vectors, ids, payloads);

			expect(mockIndex.upsert).toHaveBeenCalledWith({
				vectors: [
					{ id: '1', values: vectors[0], metadata: payloads[0] },
					{ id: '2', values: vectors[1], metadata: payloads[1] },
				],
				namespace: 'test-namespace',
			});
		});

		it('should use default namespace when configured', async () => {
			const defaultConfig = { ...config, namespace: DEFAULTS.PINECONE_NAMESPACE };
			const defaultBackend = new PineconeBackend(defaultConfig);
			await defaultBackend.connect();

			const vectors = [[1, 2, 3, ...Array(125).fill(0)]];
			const ids = [1];
			const payloads = [{ title: 'Document 1' }];

			await defaultBackend.insert(vectors, ids, payloads);

			expect(mockIndex.upsert).toHaveBeenCalledWith({
				vectors: [
					{
						id: '1',
						values: vectors[0],
						metadata: payloads[0],
					},
				],
			});
		});

		it('should throw error when not connected', async () => {
			const disconnectedBackend = new PineconeBackend(config);
			const vectors = [[1, 2, 3, ...Array(125).fill(0)]];
			const ids = [1];
			const payloads = [{ title: 'Document 1' }];

			await expect(disconnectedBackend.insert(vectors, ids, payloads)).rejects.toThrow(
				ERROR_MESSAGES.NOT_CONNECTED
			);
		});

		it('should validate vector dimensions', async () => {
			const vectors = [[1, 2, 3]]; // Wrong dimension
			const ids = [1];
			const payloads = [{ title: 'Document 1' }];

			await expect(backend.insert(vectors, ids, payloads)).rejects.toThrow('expected 128, got 3');
		});

		it('should validate input array lengths', async () => {
			const vectors = [[1, 2, 3, ...Array(125).fill(0)]];
			const ids = [1, 2]; // Mismatched length
			const payloads = [{ title: 'Document 1' }];

			await expect(backend.insert(vectors, ids, payloads)).rejects.toThrow(
				'Vectors, IDs, and payloads must have the same length'
			);
		});

		it('should handle insert failure', async () => {
			const error = new Error('Insert failed');
			mockIndex.upsert.mockRejectedValue(error);

			const vectors = [[1, 2, 3, ...Array(125).fill(0)]];
			const ids = [1];
			const payloads = [{ title: 'Document 1' }];

			await expect(backend.insert(vectors, ids, payloads)).rejects.toThrow(VectorStoreError);
		});
	});

	describe('Search Operations', () => {
		beforeEach(async () => {
			await backend.connect();
		});

		it('should search vectors successfully', async () => {
			const query = [1, 2, 3, ...Array(125).fill(0)];
			const mockResponse = {
				matches: [
					{
						id: '1',
						score: 0.95,
						values: [1, 2, 3, ...Array(125).fill(0)],
						metadata: { title: 'Document 1' },
					},
				],
			};
			mockIndex.query.mockResolvedValue(mockResponse);

			const results = await backend.search(query, 5);

			expect(mockIndex.query).toHaveBeenCalledWith({
				vector: query,
				topK: 5,
				includeMetadata: true,
				includeValues: true,
				namespace: 'test-namespace',
			});

			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				id: 1,
				score: 0.95,
				payload: { title: 'Document 1' },
				vector: mockResponse.matches[0].values,
			});
		});

		it('should search with filters', async () => {
			const query = [1, 2, 3, ...Array(125).fill(0)];
			const filters = { category: 'test', score: { gte: 0.5 } };
			const mockResponse = { matches: [] };
			mockIndex.query.mockResolvedValue(mockResponse);

			await backend.search(query, 5, filters);

			expect(mockIndex.query).toHaveBeenCalledWith({
				vector: query,
				topK: 5,
				includeMetadata: true,
				includeValues: true,
				namespace: 'test-namespace',
				filter: {
					category: { $eq: 'test' },
					score: { $gte: 0.5 },
				},
			});
		});

		it('should handle search failure', async () => {
			const error = new Error('Search failed');
			mockIndex.query.mockRejectedValue(error);

			const query = [1, 2, 3, ...Array(125).fill(0)];

			await expect(backend.search(query, 5)).rejects.toThrow(VectorStoreError);
		});

		it('should validate query dimension', async () => {
			const query = [1, 2, 3]; // Wrong dimension

			await expect(backend.search(query, 5)).rejects.toThrow('expected 128, got 3');
		});
	});

	describe('Get Operations', () => {
		beforeEach(async () => {
			await backend.connect();
		});

		it('should get vector successfully', async () => {
			const mockResponse = {
				vectors: {
					'1': {
						values: [1, 2, 3, ...Array(125).fill(0)],
						metadata: { title: 'Document 1' },
					},
				},
			};
			mockIndex.fetch.mockResolvedValue(mockResponse);

			const result = await backend.get(1);

			expect(mockIndex.fetch).toHaveBeenCalledWith({
				ids: ['1'],
				namespace: 'test-namespace',
			});

			expect(result).toEqual({
				id: 1,
				vector: mockResponse.vectors['1'].values,
				payload: { title: 'Document 1' },
				score: 1.0,
			});
		});

		it('should return null for non-existent vector', async () => {
			const mockResponse = { vectors: {} };
			mockIndex.fetch.mockResolvedValue(mockResponse);

			const result = await backend.get(999);

			expect(result).toBeNull();
		});

		it('should handle get failure', async () => {
			const error = new Error('Get failed');
			mockIndex.fetch.mockRejectedValue(error);

			await expect(backend.get(1)).rejects.toThrow(VectorStoreError);
		});
	});

	describe('Update Operations', () => {
		beforeEach(async () => {
			await backend.connect();
			mockIndex.upsert.mockResolvedValue({});
		});

		it('should update vector successfully', async () => {
			const vector = [1, 2, 3, ...Array(125).fill(0)];
			const payload = { title: 'Updated Document' };

			await backend.update(1, vector, payload);

			expect(mockIndex.upsert).toHaveBeenCalledWith({
				vectors: [
					{
						id: '1',
						values: vector,
						metadata: payload,
					},
				],
				namespace: 'test-namespace',
			});
		});

		it('should validate vector dimension on update', async () => {
			const vector = [1, 2, 3]; // Wrong dimension
			const payload = { title: 'Updated Document' };

			await expect(backend.update(1, vector, payload)).rejects.toThrow('expected 128, got 3');
		});

		it('should handle update failure', async () => {
			const error = new Error('Update failed');
			mockIndex.upsert.mockRejectedValue(error);

			const vector = [1, 2, 3, ...Array(125).fill(0)];
			const payload = { title: 'Updated Document' };

			await expect(backend.update(1, vector, payload)).rejects.toThrow(VectorStoreError);
		});
	});

	describe('Delete Operations', () => {
		beforeEach(async () => {
			await backend.connect();
			mockIndex.delete.mockResolvedValue({});
		});

		it('should delete vector successfully', async () => {
			await backend.delete(1);

			expect(mockIndex.delete).toHaveBeenCalledWith({
				ids: ['1'],
				namespace: 'test-namespace',
			});
		});

		it('should delete collection successfully', async () => {
			await backend.deleteCollection();

			expect(mockIndex.delete).toHaveBeenCalledWith({
				deleteAll: true,
				namespace: 'test-namespace',
			});
		});

		it('should handle delete failure', async () => {
			const error = new Error('Delete failed');
			mockIndex.delete.mockRejectedValue(error);

			await expect(backend.delete(1)).rejects.toThrow(VectorStoreError);
		});

		it('should handle delete collection failure', async () => {
			const error = new Error('Delete collection failed');
			mockIndex.delete.mockRejectedValue(error);

			await expect(backend.deleteCollection()).rejects.toThrow(VectorStoreError);
		});
	});

	describe('List Operations', () => {
		beforeEach(async () => {
			await backend.connect();
		});

		it('should throw error for list operation', async () => {
			await expect(backend.list()).rejects.toThrow(
				'Pinecone does not support listing all vectors directly'
			);
		});
	});

	describe('Filter Conversion', () => {
		beforeEach(async () => {
			await backend.connect();
			mockIndex.query.mockResolvedValue({ matches: [] });
		});

		it('should convert range filters correctly', async () => {
			const query = [1, 2, 3, ...Array(125).fill(0)];
			const filters = {
				score: { gte: 0.5, lte: 1.0 },
				count: { gt: 10, lt: 100 },
			};

			await backend.search(query, 5, filters);

			expect(mockIndex.query).toHaveBeenCalledWith(
				expect.objectContaining({
					filter: {
						score: { $gte: 0.5, $lte: 1.0 },
						count: { $gt: 10, $lt: 100 },
					},
				})
			);
		});

		it('should convert array filters correctly', async () => {
			const query = [1, 2, 3, ...Array(125).fill(0)];
			const filters = {
				category: { any: ['tech', 'science'] },
				tags: { all: ['important'] },
			};

			await backend.search(query, 5, filters);

			expect(mockIndex.query).toHaveBeenCalledWith(
				expect.objectContaining({
					filter: {
						category: { $in: ['tech', 'science'] },
						tags: 'important',
					},
				})
			);
		});

		it('should convert exact match filters correctly', async () => {
			const query = [1, 2, 3, ...Array(125).fill(0)];
			const filters = {
				status: 'active',
				priority: 1,
			};

			await backend.search(query, 5, filters);

			expect(mockIndex.query).toHaveBeenCalledWith(
				expect.objectContaining({
					filter: {
						status: { $eq: 'active' },
						priority: { $eq: 1 },
					},
				})
			);
		});

		it('should handle empty filters', async () => {
			const query = [1, 2, 3, ...Array(125).fill(0)];

			await backend.search(query, 5, {});

			expect(mockIndex.query).toHaveBeenCalledWith({
				vector: query,
				topK: 5,
				includeMetadata: true,
				includeValues: true,
				namespace: 'test-namespace',
			});
		});
	});

	describe('Error Handling', () => {
		it('should throw error when operations called without connection', async () => {
			const vector = [1, 2, 3, ...Array(125).fill(0)];
			const payload = { title: 'Document' };

			await expect(backend.insert([vector], [1], [payload])).rejects.toThrow(
				ERROR_MESSAGES.NOT_CONNECTED
			);
			await expect(backend.search(vector)).rejects.toThrow(ERROR_MESSAGES.NOT_CONNECTED);
			await expect(backend.get(1)).rejects.toThrow(ERROR_MESSAGES.NOT_CONNECTED);
			await expect(backend.update(1, vector, payload)).rejects.toThrow(
				ERROR_MESSAGES.NOT_CONNECTED
			);
			await expect(backend.delete(1)).rejects.toThrow(ERROR_MESSAGES.NOT_CONNECTED);
			await expect(backend.deleteCollection()).rejects.toThrow(ERROR_MESSAGES.NOT_CONNECTED);
			await expect(backend.list()).rejects.toThrow(ERROR_MESSAGES.NOT_CONNECTED);
		});

		it('should validate IDs properly', async () => {
			await backend.connect();

			const vector = [1, 2, 3, ...Array(125).fill(0)];
			const payload = { title: 'Document' };

			// Test with null/undefined IDs
			await expect(backend.insert([vector], [null as any], [payload])).rejects.toThrow(
				'ID missing at index 0'
			);
			await expect(backend.update(null as any, vector, payload)).rejects.toThrow(
				'Pinecone point IDs must be valid'
			);
			await expect(backend.get(undefined as any)).rejects.toThrow(
				'Pinecone point IDs must be valid'
			);
			await expect(backend.delete(undefined as any)).rejects.toThrow(
				'Pinecone point IDs must be valid'
			);
		});
	});
});
