/**
 * Weaviate Vector Storage Backend Tests
 *
 * Tests for the Weaviate vector storage backend implementation.
 * Uses mocking since Weaviate requires external service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WeaviateBackend } from '../backend/weaviate.js';

import {
	VectorStoreError,
	VectorStoreConnectionError,
	VectorDimensionError,
} from '../backend/types.js';
import { L } from 'vitest/dist/chunks/reporters.d.BFLkQcL6.js';

// Mock the Weaviate client
const mockWeaviateClient = {
	// Schema operations
	schema: {
		getter: vi.fn(() => ({
			do: vi.fn(),
		})),
		classCreator: vi.fn(() => ({
			withClass: vi.fn(() => ({
				do: vi.fn(),
			})),
		})),
		classDeleter: vi.fn(() => ({
			withClassName: vi.fn(() => ({
				do: vi.fn(),
			})),
		})),
		exists: vi.fn(() => ({
			withClassName: vi.fn(() => ({
				do: vi.fn(),
			})),
		})),
	},
	// Batch operations
	batch: {
		objectsBatcher: vi.fn(() => ({
			withObject: vi.fn(),
			do: vi.fn(),
		})),
	},
	// Data operations
	data: {
		getterById: vi.fn(() => ({
			withClassName: vi.fn(() => ({
				withId: vi.fn(() => ({
					withVector: vi.fn(() => ({
						do: vi.fn(),
					})),
				})),
			})),
		})),
		updater: vi.fn(() => ({
			withClassName: vi.fn(() => ({
				withId: vi.fn(() => ({
					withProperties: vi.fn(() => ({
						withVector: vi.fn(() => ({
							do: vi.fn(),
						})),
					})),
				})),
			})),
		})),
		deleter: vi.fn(() => ({
			withClassName: vi.fn(() => ({
				withId: vi.fn(() => ({
					do: vi.fn(),
				})),
			})),
		})),
	},
	// GraphQL queries
	graphql: {
		get: vi.fn(() => ({
			withClassName: vi.fn(() => ({
				withNearVector: vi.fn(() => ({
					withLimit: vi.fn(() => ({
						withFields: vi.fn(() => ({
							withWhere: vi.fn(() => ({
								do: vi.fn(),
							})),
							do: vi.fn(),
						})),
					})),
				})),
				withLimit: vi.fn(() => ({
					withFields: vi.fn(() => ({
						withWhere: vi.fn(() => ({
							do: vi.fn(),
						})),
						do: vi.fn(),
					})),
				})),
			})),
		})),
	},
	// Misc operations
	misc: {
		liveChecker: vi.fn(() => ({
			do: vi.fn(),
		})),
		readyChecker: vi.fn(() => ({
			do: vi.fn(),
		})),
	},
};

vi.mock('weaviate-ts-client', () => ({
	WeaviateClient: vi.fn(() => mockWeaviateClient),
	ApiKey: vi.fn(),
	default: vi.fn(() => mockWeaviateClient),
}));

// Mock the logger to reduce noise in tests
vi.mock('../../logger/index.js', () => ({
	createLogger: () => ({
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

describe('WeaviateBackend', () => {
	let backend: WeaviateBackend;

	const validConfig = {
		type: 'weaviate' as const,
		url: 'a8mbdcsbrywlfimbdc30iw.c0.asia-southeast1.gcp.weaviate.cloud',
		apiKey: 'L214NVErSVU2N29IVHpmMF85NytoOWdKRi9JUURYMnN5b1RpdEFzTldYRTQyMGhqVElRWVdrTDA5V0p3PV92MjAw',
		collectionName: 'testCollection',
		dimension: 768,
	};

	beforeEach(() => {
		backend = new WeaviateBackend(validConfig);
		vi.clearAllMocks();
	});

	afterEach(async () => {
		if (backend.isConnected()) {
			await backend.disconnect();
		}
	});

	describe('Connection Management', () => {
		it('should connect successfully when collection exists', async () => {
			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(true);
            // console.log('connect successfully when collection exists', mockWeaviateClient.schema.exists().withClassName().do);
            expect(backend.isConnected()).toBe(false);
			await backend.connect();
            console.log('check connection if it is connected after connect: ', backend.isConnected());
			expect(backend.isConnected()).toBe(true);
			expect(mockWeaviateClient.misc.liveChecker().do).toHaveBeenCalled();
			expect(mockWeaviateClient.misc.readyChecker().do).toHaveBeenCalled();
		});

		it('should create collection if it does not exist', async () => {
			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(false);
			mockWeaviateClient.schema.classCreator().withClass().do.mockResolvedValue({});

			await backend.connect();

			expect(mockWeaviateClient.misc.liveChecker().do).toHaveBeenCalled();
			expect(mockWeaviateClient.misc.readyChecker().do).toHaveBeenCalled();
			expect(mockWeaviateClient.schema.exists().withClassName).toHaveBeenCalledWith('Test_collection');
			expect(mockWeaviateClient.schema.classCreator().withClass).toHaveBeenCalledWith(
				expect.objectContaining({
					class: 'Test_collection',
					vectorIndexType: 'hnsw',
					vectorIndexConfig: expect.objectContaining({
						distance: 'cosine',
					}),
					properties: expect.arrayContaining([
						expect.objectContaining({
							name: 'payload',
							dataType: ['text'],
						}),
					]),
				})
			);
		});
    });
});
// 		it('should handle connection failures', async () => {
// 			mockWeaviateClient.misc.liveChecker().do.mockRejectedValue(new Error('Connection failed'));
			
// 			await expect(backend.connect()).rejects.toThrow(VectorStoreConnectionError);
// 			expect(backend.isConnected()).toBe(false);
// 		});

// 		it('should disconnect successfully', async () => {
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
// 			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(true);
			
// 			await backend.connect();
// 			await backend.disconnect();
// 			expect(backend.isConnected()).toBe(false);
// 		});

// 		it('should return correct backend type', () => {
// 			expect(backend.getBackendType()).toBe('weaviate');
// 		});

// 		it('should return correct metadata', () => {
// 			expect(backend.getDimension()).toBe(3);
// 			expect(backend.getCollectionName()).toBe('Test_collection');
// 		});

// 		it('should not throw when disconnect is called while not connected', async () => {
// 			await expect(backend.disconnect()).resolves.not.toThrow();
// 		});

// 		it('should handle local instance configuration', async () => {
// 			const localConfig = {
// 				type: 'weaviate' as const,
// 				host: 'localhost',
// 				port: 8080,
// 				collectionName: 'test_collection',
// 				dimension: 3,
// 			};
			
// 			const localBackend = new WeaviateBackend(localConfig);
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
// 			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(true);

// 			await localBackend.connect();
// 			expect(localBackend.isConnected()).toBe(true);
			
// 			await localBackend.disconnect();
// 		});
// 	});

// 	describe('Vector Operations', () => {
// 		beforeEach(async () => {
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
// 			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(true);
// 			await backend.connect();
// 		});
//     });
// });
		// it('should insert vectors successfully', async () => {
		// 	const mockBatcher = {
		// 		withObject: vi.fn().mockReturnThis(),
		// 		do: vi.fn().mockResolvedValue([]),
		// 	};
		// 	mockWeaviateClient.batch.objectsBatcher.mockReturnValue(mockBatcher);

		// 	const vectors = [
		// 		[1, 2, 3],
		// 		[4, 5, 6],
		// 	];
		// 	const ids = [1, 2];
		// 	const payloads = [{ title: 'First' }, { title: 'Second' }];
			
		// 	await backend.insert(vectors, ids, payloads);
			
		// 	expect(mockWeaviateClient.batch.objectsBatcher).toHaveBeenCalled();
		// 	expect(mockBatcher.withObject).toHaveBeenCalledTimes(2);
		// 	expect(mockBatcher.withObject).toHaveBeenCalledWith(
		// 		expect.objectContaining({
		// 			class: 'Test_collection',
		// 			id: expect.any(String),
		// 			properties: {
		// 				payload: JSON.stringify({ title: 'First' }),
		// 			},
		// 			vector: [1, 2, 3],
		// 		})
		// 	);
		// 	expect(mockBatcher.do).toHaveBeenCalled();
		// });

		// it('should handle insert batch errors', async () => {
		// 	const mockBatcher = {
		// 		withObject: vi.fn().mockReturnThis(),
		// 		do: vi.fn().mockResolvedValue([
		// 			{
		// 				result: {
		// 					errors: {
		// 						error: [{ message: 'Insert failed' }],
		// 					},
		// 				},
		// 			},
		// 		]),
		// 	};
		// 	mockWeaviateClient.batch.objectsBatcher.mockReturnValue(mockBatcher);

		// 	const vectors = [[1, 2, 3]];
		// 	const ids = [1];
		// 	const payloads = [{ title: 'Test' }];
			
		// 	await expect(backend.insert(vectors, ids, payloads)).rejects.toThrow(VectorStoreError);
		// });

		// it('should retrieve vectors by ID', async () => {
		// 	const mockGetter = {
		// 		withClassName: vi.fn().mockReturnThis(),
		// 		withId: vi.fn().mockReturnThis(),
		// 		withVector: vi.fn().mockReturnThis(),
		// 		do: vi.fn().mockResolvedValue({
		// 			vector: [1, 2, 3],
		// 			properties: {
		// 				payload: JSON.stringify({ title: 'Test' }),
		// 			},
		// 		}),
		// 	};
		// 	mockWeaviateClient.data.getterById.mockReturnValue(mockGetter);

		// 	const result = await backend.get(1);
			
		// 	expect(result).toEqual({
		// 		id: 1,
		// 		vector: [1, 2, 3],
		// 		payload: { title: 'Test' },
		// 		score: 1.0,
		// 	});
		// 	expect(mockGetter.withClassName).toHaveBeenCalledWith('Test_collection');
		// });
        
// 		it('should return null if vector not found', async () => {
// 			const mockGetter = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withId: vi.fn().mockReturnThis(),
// 				withVector: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue(null),
// 			};
// 			mockWeaviateClient.data.getterById.mockReturnValue(mockGetter);

// 			const result = await backend.get(999);
// 			expect(result).toBeNull();
// 		});

// 		it('should update vectors successfully', async () => {
// 			const mockUpdater = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withId: vi.fn().mockReturnThis(),
// 				withProperties: vi.fn().mockReturnThis(),
// 				withVector: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({}),
// 			};
// 			mockWeaviateClient.data.updater.mockReturnValue(mockUpdater);

// 			await backend.update(1, [1, 2, 3], { title: 'Updated' });
			
// 			expect(mockUpdater.withClassName).toHaveBeenCalledWith('Test_collection');
// 			expect(mockUpdater.withProperties).toHaveBeenCalledWith({
// 				payload: JSON.stringify({ title: 'Updated' }),
// 			});
// 			expect(mockUpdater.withVector).toHaveBeenCalledWith([1, 2, 3]);
// 			expect(mockUpdater.do).toHaveBeenCalled();
// 		});

// 		it('should delete vectors successfully', async () => {
// 			const mockDeleter = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withId: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({}),
// 			};
// 			mockWeaviateClient.data.deleter.mockReturnValue(mockDeleter);

// 			await backend.delete(1);
			
// 			expect(mockDeleter.withClassName).toHaveBeenCalledWith('Test_collection');
// 			expect(mockDeleter.do).toHaveBeenCalled();
// 		});

// 		it('should search vectors successfully', async () => {
// 			const mockQuery = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withNearVector: vi.fn().mockReturnThis(),
// 				withLimit: vi.fn().mockReturnThis(),
// 				withFields: vi.fn().mockReturnThis(),
// 				withWhere: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({
// 					data: {
// 						Get: {
// 							Test_collection: [
// 								{
// 									_additional: {
// 										id: '1',
// 										certainty: 0.99,
// 									},
// 									payload: JSON.stringify({ title: 'Test' }),
// 								},
// 							],
// 						},
// 					},
// 				}),
// 			};
// 			mockWeaviateClient.graphql.get.mockReturnValue(mockQuery);

// 			const result = await backend.search([1, 2, 3], 1);
			
// 			expect(result).toEqual([
// 				{
// 					id: 1,
// 					score: 0.99,
// 					payload: { title: 'Test' },
// 				},
// 			]);
// 			expect(mockQuery.withNearVector).toHaveBeenCalledWith({
// 				vector: [1, 2, 3],
// 			});
// 		});

// 		it('should list vectors successfully', async () => {
// 			const mockQuery = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withLimit: vi.fn().mockReturnThis(),
// 				withFields: vi.fn().mockReturnThis(),
// 				withWhere: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({
// 					data: {
// 						Get: {
// 							Test_collection: [
// 								{
// 									_additional: { id: '1' },
// 									payload: JSON.stringify({ title: 'Test' }),
// 								},
// 							],
// 						},
// 					},
// 				}),
// 			};
// 			mockWeaviateClient.graphql.get.mockReturnValue(mockQuery);

// 			const [results, count] = await backend.list();
			
// 			expect(results).toEqual([
// 				{
// 					id: 1,
// 					vector: [],
// 					payload: { title: 'Test' },
// 					score: 1.0,
// 				},
// 			]);
// 			expect(count).toBe(1);
// 		});

// 		it('should throw VectorStoreError if insert is called before connect', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			const vectors = [[1, 2, 3]];
// 			const ids = [1];
// 			const payloads = [{ title: 'Test' }];
			
// 			await expect(backend.insert(vectors, ids, payloads)).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError if update is called before connect', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			await expect(backend.update(1, [1, 2, 3], { title: 'Test' })).rejects.toThrow(
// 				VectorStoreError
// 			);
// 		});

// 		it('should throw VectorStoreError if delete is called before connect', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			await expect(backend.delete(1)).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError if get is called before connect', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			await expect(backend.get(1)).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError if vectors, ids, and payloads lengths do not match', async () => {
// 			await expect(backend.insert([[1, 2, 3]], [1, 2], [{ title: 'Test' }])).rejects.toThrow(
// 				VectorStoreError
// 			);
// 		});

// 		it('should throw VectorDimensionError if update vector has wrong dimension', async () => {
// 			await expect(backend.update(1, [1, 2], { title: 'Test' })).rejects.toThrow(
// 				VectorDimensionError
// 			);
// 		});

// 		it('should throw if payloads are null or undefined', async () => {
// 			await expect(backend.insert([[1, 2, 3]], [1], null as any)).rejects.toThrow();
// 			await expect(backend.insert([[1, 2, 3]], [1], undefined as any)).rejects.toThrow();
// 		});

// 		it('should throw VectorDimensionError if search vector has wrong dimension', async () => {
// 			await expect(backend.search([1, 2], 1)).rejects.toThrow(VectorDimensionError);
// 		});

// 		it('should throw VectorStoreError on get failure', async () => {
// 			const mockGetter = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withId: vi.fn().mockReturnThis(),
// 				withVector: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockRejectedValue(new Error('Get failed')),
// 			};
// 			mockWeaviateClient.data.getterById.mockReturnValue(mockGetter);

// 			await expect(backend.get(1)).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError on list failure', async () => {
// 			const mockQuery = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withLimit: vi.fn().mockReturnThis(),
// 				withFields: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockRejectedValue(new Error('List failed')),
// 			};
// 			mockWeaviateClient.graphql.get.mockReturnValue(mockQuery);

// 			await expect(backend.list()).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError on update failure', async () => {
// 			const mockUpdater = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withId: vi.fn().mockReturnThis(),
// 				withProperties: vi.fn().mockReturnThis(),
// 				withVector: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockRejectedValue(new Error('Update failed')),
// 			};
// 			mockWeaviateClient.data.updater.mockReturnValue(mockUpdater);

// 			await expect(backend.update(1, [1, 2, 3], { title: 'Fail' })).rejects.toThrow(
// 				VectorStoreError
// 			);
// 		});

// 		it('should throw VectorStoreError on delete failure', async () => {
// 			const mockDeleter = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withId: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockRejectedValue(new Error('Delete failed')),
// 			};
// 			mockWeaviateClient.data.deleter.mockReturnValue(mockDeleter);

// 			await expect(backend.delete(1)).rejects.toThrow(VectorStoreError);
// 		});
// 	});

// 	describe('Collection Management', () => {
// 		beforeEach(async () => {
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
// 			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(true);
// 			await backend.connect();
// 		});

// 		it('should delete collection successfully', async () => {
// 			const mockDeleter = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({}),
// 			};
// 			mockWeaviateClient.schema.classDeleter.mockReturnValue(mockDeleter);

// 			await backend.deleteCollection();
			
// 			expect(mockDeleter.withClassName).toHaveBeenCalledWith('Test_collection');
// 			expect(mockDeleter.do).toHaveBeenCalled();
// 		});

// 		it('should list all collections', async () => {
// 			const mockGetter = {
// 				do: vi.fn().mockResolvedValue({
// 					classes: [{ class: 'Collection1' }, { class: 'Collection2' }],
// 				}),
// 			};
// 			mockWeaviateClient.schema.getter.mockReturnValue(mockGetter);

// 			const collections = await backend.listCollections();
			
// 			expect(collections).toEqual(['Collection1', 'Collection2']);
// 			expect(mockGetter.do).toHaveBeenCalled();
// 		});

// 		it('should handle empty collection list', async () => {
// 			const mockGetter = {
// 				do: vi.fn().mockResolvedValue({ classes: null }),
// 			};
// 			mockWeaviateClient.schema.getter.mockReturnValue(mockGetter);

// 			const collections = await backend.listCollections();
			
// 			expect(collections).toEqual([]);
// 		});

// 		it('should throw VectorStoreError if deleteCollection is called before connect', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			await expect(backend.deleteCollection()).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError if listCollections is called before connect', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			await expect(backend.listCollections()).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError on deleteCollection failure', async () => {
// 			const mockDeleter = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockRejectedValue(new Error('Delete collection failed')),
// 			};
// 			mockWeaviateClient.schema.classDeleter.mockReturnValue(mockDeleter);

// 			await expect(backend.deleteCollection()).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should throw VectorStoreError on listCollections failure', async () => {
// 			const mockGetter = {
// 				do: vi.fn().mockRejectedValue(new Error('List collections failed')),
// 			};
// 			mockWeaviateClient.schema.getter.mockReturnValue(mockGetter);

// 			await expect(backend.listCollections()).rejects.toThrow(VectorStoreError);
// 		});
// 	});

// 	describe('Error Handling', () => {
// 		beforeEach(async () => {
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
// 			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(true);
// 			await backend.connect();
// 		});

// 		it('should throw VectorDimensionError on dimension mismatch', async () => {
// 			await expect(backend.insert([[1, 2]], [1], [{ title: 'Bad' }])).rejects.toThrow(
// 				VectorDimensionError
// 			);
// 		});

// 		it('should throw VectorStoreError on insert failure', async () => {
// 			const mockBatcher = {
// 				withObject: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockRejectedValue(new Error('Insert failed')),
// 			};
// 			mockWeaviateClient.batch.objectsBatcher.mockReturnValue(mockBatcher);

// 			await expect(backend.insert([[1, 2, 3]], [1], [{ title: 'Fail' }])).rejects.toThrow(
// 				VectorStoreError
// 			);
// 		});

// 		it('should throw VectorStoreError on search failure', async () => {
// 			const mockQuery = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withNearVector: vi.fn().mockReturnThis(),
// 				withLimit: vi.fn().mockReturnThis(),
// 				withFields: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockRejectedValue(new Error('Search failed')),
// 			};
// 			mockWeaviateClient.graphql.get.mockReturnValue(mockQuery);

// 			await expect(backend.search([1, 2, 3], 1)).rejects.toThrow(VectorStoreError);
// 		});

// 		it('should handle connection ready check failure', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockRejectedValue(new Error('Not ready'));

// 			await expect(backend.connect()).rejects.toThrow(VectorStoreConnectionError);
// 		});

// 		it('should handle collection creation failure', async () => {
// 			const backend = new WeaviateBackend(validConfig);
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
// 			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(false);
// 			mockWeaviateClient.schema.classCreator().withClass().do.mockRejectedValue(
// 				new Error('Collection creation failed')
// 			);

// 			await expect(backend.connect()).rejects.toThrow(VectorStoreConnectionError);
// 		});
// 	});

// 	describe('Search Filters', () => {
// 		beforeEach(async () => {
// 			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
// 			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
// 			mockWeaviateClient.schema.exists().withClassName().do.mockResolvedValue(true);
// 			await backend.connect();
// 		});

// 		it('should search with simple filters', async () => {
// 			const mockQuery = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withNearVector: vi.fn().mockReturnThis(),
// 				withLimit: vi.fn().mockReturnThis(),
// 				withFields: vi.fn().mockReturnThis(),
// 				withWhere: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({
// 					data: {
// 						Get: {
// 							Test_collection: [],
// 						},
// 					},
// 				}),
// 			};
// 			mockWeaviateClient.graphql.get.mockReturnValue(mockQuery);

// 			await backend.search([1, 2, 3], 5, { category: 'test' });
			
// 			expect(mockQuery.withWhere).toHaveBeenCalledWith(
// 				expect.objectContaining({
// 					path: ['payload'],
// 					operator: 'Like',
// 					valueText: '*"category":"test"*',
// 				})
// 			);
// 		});

// 		it('should search with array filters (any operator)', async () => {
// 			const mockQuery = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withNearVector: vi.fn().mockReturnThis(),
// 				withLimit: vi.fn().mockReturnThis(),
// 				withFields: vi.fn().mockReturnThis(),
// 				withWhere: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({
// 					data: {
// 						Get: {
// 							Test_collection: [],
// 						},
// 					},
// 				}),
// 			};
// 			mockWeaviateClient.graphql.get.mockReturnValue(mockQuery);

// 			await backend.search([1, 2, 3], 5, { category: { any: ['test1', 'test2'] } });
			
// 			expect(mockQuery.withWhere).toHaveBeenCalledWith(
// 				expect.objectContaining({
// 					operator: 'Or',
// 					operands: expect.arrayContaining([
// 						expect.objectContaining({
// 							path: ['payload'],
// 							operator: 'Like',
// 							valueText: '*"category":"test1"*',
// 						}),
// 						expect.objectContaining({
// 							path: ['payload'],
// 							operator: 'Like',
// 							valueText: '*"category":"test2"*',
// 						}),
// 					]),
// 				})
// 			);
// 		});

// 		it('should list with filters', async () => {
// 			const mockQuery = {
// 				withClassName: vi.fn().mockReturnThis(),
// 				withLimit: vi.fn().mockReturnThis(),
// 				withFields: vi.fn().mockReturnThis(),
// 				withWhere: vi.fn().mockReturnThis(),
// 				do: vi.fn().mockResolvedValue({
// 					data: {
// 						Get: {
// 							Test_collection: [],
// 						},
// 					},
// 				}),
// 			};
// 			mockWeaviateClient.graphql.get.mockReturnValue(mockQuery);

// 			await backend.list({ status: 'active' }, 100);
			
// 			expect(mockQuery.withWhere).toHaveBeenCalledWith(
// 				expect.objectContaining({
// 					path: ['payload'],
// 					operator: 'Like',
// 					valueText: '*"status":"active"*',
// 				})
// 			);
// 		});
// 	});
// }); 