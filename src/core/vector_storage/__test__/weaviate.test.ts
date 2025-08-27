/**
 * Weaviate Vector Storage Backend Tests
 *
 * Tests for the Weaviate vector storage backend implementation.
 * Uses mocking since Weaviate requires external service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock weaviate-ts-client before any imports
vi.mock('weaviate-ts-client');

import { WeaviateBackend } from '../backend/weaviate.js';

import {
	VectorStoreError,
	VectorStoreConnectionError,
	VectorDimensionError,
} from '../backend/types.js';

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

vi.mock('weaviate-ts-client', () => {
	const mockModule = {
		client: vi.fn(config => {
			console.log('MOCK CLIENT CALLED with config:', config);
			return mockWeaviateClient;
		}),
	};
	return {
		__esModule: true,
		WeaviateClient: vi.fn(() => mockWeaviateClient),
		ApiKey: vi.fn().mockImplementation(apiKey => {
			console.log('MOCK APIKEY CALLED with:', apiKey);
			return { apiKey };
		}),
		default: mockModule,
		// Also provide client directly for any direct imports
		client: vi.fn(() => mockWeaviateClient),
	};
});

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
		apiKey:
			'L214NVErSVU2N29IVHpmMF85NytoOWdKRi9JUURYMnN5b1RpdEFzTldYRTQyMGhqVElRWVdrTDA5V0p3PV92MjAw',
		collectionName: 'testCollection',
		dimension: 1536,
	};

	// Helper function to generate 1536-dimensional test vectors
	const createTestVector = (seed: number = 1): number[] => {
		const vector = new Array(1536);
		for (let i = 0; i < 1536; i++) {
			// Use parseFloat to match JavaScript's natural floating-point precision
			vector[i] = parseFloat(((seed + i) / 1536).toFixed(4));
		}
		return vector;
	};

	beforeEach(() => {
		// Clear all mocks first
		vi.clearAllMocks();

		// Reset all mock functions to ensure clean state
		mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
		mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
		mockWeaviateClient.schema.getter().do.mockResolvedValue({
			classes: [
				{
					class: 'Testcollection',
					properties: [
						{
							name: 'payload',
							dataType: ['text'],
						},
					],
				},
			],
		});

		backend = new WeaviateBackend(validConfig);
	});

	afterEach(async () => {
		if (backend.isConnected()) {
			await backend.disconnect();
		}
	});

	describe('Connection Management', () => {
		it('should connect successfully when collection exists', async () => {
			expect(backend.isConnected()).toBe(false);
			await backend.connect();
			expect(backend.isConnected()).toBe(true);
		});

		it('should create collection if it does not exist', async () => {
			// Override the default to return no existing collections
			mockWeaviateClient.schema.getter().do.mockResolvedValue({
				classes: [],
			});
			mockWeaviateClient.schema.classCreator().withClass().do.mockResolvedValue({});

			await backend.connect();
			expect(backend.isConnected()).toBe(true);
		});

		it('should disconnect successfully', async () => {
			mockWeaviateClient.misc.liveChecker().do.mockResolvedValue({ live: true });
			mockWeaviateClient.misc.readyChecker().do.mockResolvedValue({ ready: true });
			mockWeaviateClient.schema.getter().do.mockResolvedValue({
				classes: [],
			});

			await backend.connect();
			await backend.disconnect();
			expect(backend.isConnected()).toBe(false);
		});

		it('should return correct backend type', () => {
			expect(backend.getBackendType()).toBe('weaviate');
		});

		it('should return correct metadata', () => {
			expect(backend.getDimension()).toBe(1536);
			expect(backend.getCollectionName()).toBe('Testcollection');
		});

		it('should not throw when disconnect is called while not connected', async () => {
			await expect(backend.disconnect()).resolves.not.toThrow();
		});
	});

	describe('Vector Operations', () => {
		beforeEach(async () => {
			// Ensure our mock is connected and ready
			await backend.connect();
		});

		it('should delete vectors successfully', async () => {
			const mockDeleter = {
				withClassName: vi.fn().mockReturnThis(),
				withId: vi.fn().mockReturnThis(),
				do: vi.fn().mockResolvedValue({}),
			};
			mockWeaviateClient.data.deleter.mockReturnValue(mockDeleter);

			await backend.delete(1);
		});

		it('should throw VectorStoreError if insert is called before connect', async () => {
			const testBackend = new WeaviateBackend(validConfig);
			const vectors = [createTestVector(1)];
			const ids = [1];
			const payloads = [{ title: 'Test' }];

			await expect(testBackend.insert(vectors, ids, payloads)).rejects.toThrow(VectorStoreError);
		});

		it('should throw VectorStoreError if update is called before connect', async () => {
			const testBackend = new WeaviateBackend(validConfig);
			await expect(testBackend.update(1, createTestVector(1), { title: 'Test' })).rejects.toThrow(
				VectorStoreError
			);
		});

		it('should throw VectorStoreError if delete is called before connect', async () => {
			const testBackend = new WeaviateBackend(validConfig);
			await expect(testBackend.delete(1)).rejects.toThrow(VectorStoreError);
		});

		it('should throw VectorStoreError if get is called before connect', async () => {
			const testBackend = new WeaviateBackend(validConfig);
			await expect(testBackend.get(1)).rejects.toThrow(VectorStoreError);
		});

		it('should throw VectorStoreError if vectors, ids, and payloads lengths do not match', async () => {
			await expect(
				backend.insert([createTestVector(1)], [1, 2], [{ title: 'Test' }])
			).rejects.toThrow(VectorStoreError);
		});

		it('should throw VectorDimensionError if update vector has wrong dimension', async () => {
			await expect(backend.update(1, [1, 2], { title: 'Test' })).rejects.toThrow(
				VectorDimensionError
			);
		});

		it('should throw if payloads are null or undefined', async () => {
			await expect(backend.insert([createTestVector(1)], [1], null as any)).rejects.toThrow();
			await expect(backend.insert([createTestVector(1)], [1], undefined as any)).rejects.toThrow();
		});

		it('should throw VectorDimensionError if search vector has wrong dimension', async () => {
			await expect(backend.search([1, 2], 1)).rejects.toThrow(VectorDimensionError);
		});

		it('should throw VectorStoreError on get failure', async () => {
			const mockGetter = {
				withClassName: vi.fn().mockReturnThis(),
				withId: vi.fn().mockReturnThis(),
				withVector: vi.fn().mockReturnThis(),
				do: vi.fn().mockRejectedValue(new Error('Get failed')),
			};
			mockWeaviateClient.data.getterById.mockReturnValue(mockGetter);

			await expect(backend.get(1)).rejects.toThrow(VectorStoreError);
		});

		it('should throw VectorStoreError on update failure', async () => {
			const mockUpdater = {
				withClassName: vi.fn().mockReturnThis(),
				withId: vi.fn().mockReturnThis(),
				withProperties: vi.fn().mockReturnThis(),
				withVector: vi.fn().mockReturnThis(),
				do: vi.fn().mockRejectedValue(new Error('Update failed')),
			};
			mockWeaviateClient.data.updater.mockReturnValue(mockUpdater);

			await expect(backend.update(1, createTestVector(1), { title: 'Fail' })).rejects.toThrow(
				VectorStoreError
			);
		});
	});

	describe('Collection Management', () => {
		beforeEach(async () => {
			// Ensure our mock is connected and ready
			await backend.connect();
		});

		it('should throw VectorStoreError if deleteCollection is called before connect', async () => {
			const testBackend = new WeaviateBackend(validConfig);
			await expect(testBackend.deleteCollection()).rejects.toThrow(VectorStoreError);
		});

		it('should throw VectorStoreError if listCollections is called before connect', async () => {
			const testBackend = new WeaviateBackend(validConfig);
			await expect(testBackend.listCollections()).rejects.toThrow(VectorStoreError);
		});
	});

	describe('Error Handling', () => {
		beforeEach(async () => {
			// Ensure our mock is connected and ready
			await backend.connect();
		});

		it('should throw VectorDimensionError on dimension mismatch', async () => {
			await expect(backend.insert([[1, 2]], [1], [{ title: 'Bad' }])).rejects.toThrow(
				VectorDimensionError
			);
		});
	});
});
