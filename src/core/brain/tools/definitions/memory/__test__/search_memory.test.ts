import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMemoryTool } from '../search_memory.js';

describe('Search Memory Tool', () => {
	let mockContext: any;
	let mockEmbeddingManager: any;
	let mockVectorStoreManager: any;
	let mockDualVectorStoreManager: any;
	let mockEmbedder: any;
	let mockKnowledgeStore: any;
	let mockReflectionStore: any;

	beforeEach(() => {
		// Mock embedder
		mockEmbedder = {
			embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
		};

		// Mock knowledge store
		mockKnowledgeStore = {
			search: vi.fn().mockResolvedValue([
				{
					id: 'knowledge_1',
					score: 0.9,
					payload: {
						text: 'User prefers TypeScript over JavaScript',
						tags: ['preference', 'language'],
						confidence: 0.8,
						reasoning: 'User preference',
						timestamp: '2024-01-01T00:00:00Z',
						event: 'ADD',
						code_pattern: 'typescript',
					},
				},
				{
					id: 'knowledge_2',
					score: 0.7,
					payload: {
						text: 'Project uses React with Vite',
						tags: ['framework', 'build'],
						confidence: 0.9,
						reasoning: 'Technical fact',
						timestamp: '2024-01-02T00:00:00Z',
						event: 'ADD',
					},
				},
			]),
		};

		// Mock reflection store
		mockReflectionStore = {
			search: vi.fn().mockResolvedValue([
				{
					id: 'reflection_1',
					score: 0.85,
					payload: {
						content: 'When debugging authentication, check token validation first',
						text: 'When debugging authentication, check token validation first',
						tags: ['debugging', 'auth'],
						confidence: 0.85,
						reasoning: 'Reasoning pattern',
						timestamp: '2024-01-03T00:00:00Z',
						qualityScore: 0.9,
						stepTypes: ['thought', 'action'],
						issueCount: 0,
						traceId: 'trace_123',
					},
				},
			]),
		};

		// Mock embedding manager
		mockEmbeddingManager = {
			getEmbedder: vi.fn().mockReturnValue(mockEmbedder),
		};

		// Mock single collection vector store manager
		mockVectorStoreManager = {
			constructor: { name: 'VectorStoreManager' },
			getStore: vi.fn().mockReturnValue(mockKnowledgeStore),
		};

		// Mock dual collection vector store manager
		mockDualVectorStoreManager = {
			constructor: { name: 'DualCollectionVectorManager' },
			getStore: vi.fn((type?: string) => {
				if (type === 'knowledge') return mockKnowledgeStore;
				if (type === 'reflection') return mockReflectionStore;
				return mockKnowledgeStore; // fallback
			}),
		};

		// Mock context
		mockContext = {
			services: {
				embeddingManager: mockEmbeddingManager,
				vectorStoreManager: mockVectorStoreManager,
			},
			toolName: 'memory_search',
			startTime: Date.now(),
			sessionId: 'test-session',
			metadata: {},
		};
	});

	describe('Input Validation', () => {
		it('should require query parameter', async () => {
			const args = {};
			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(false);
			expect(result.results).toEqual([]);
		});

		it('should require non-empty query', async () => {
			const args = { query: '   ' };
			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(false);
			expect(result.results).toEqual([]);
		});

		it('should require context with services', async () => {
			const args = { query: 'test query' };
			const result = await searchMemoryTool.handler(args, undefined);

			expect(result.success).toBe(false);
			expect(result.results).toEqual([]);
		});
	});

	describe('Knowledge-Only Search', () => {
		it('should search knowledge collection with single manager', async () => {
			const args = {
				query: 'programming preferences',
				type: 'knowledge',
				top_k: 5,
				similarity_threshold: 0.5,
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			expect(result.query).toBe('programming preferences');
			expect(result.results).toHaveLength(2);
			expect(result.results[0].source).toBe('knowledge');
			expect(result.results[0].memoryType).toBe('knowledge');
			expect(result.metadata.searchMode).toBe('knowledge');
			expect(result.metadata.knowledgeResults).toBe(2);
			expect(result.metadata.reflectionResults).toBe(0);
			expect(mockEmbedder.embed).toHaveBeenCalledWith('programming preferences');
		});

		it('should filter results by similarity threshold', async () => {
			const args = {
				query: 'test query',
				type: 'knowledge',
				similarity_threshold: 0.8,
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(1); // Only knowledge_1 has score >= 0.8
			expect(result.results[0].similarity).toBe(0.9);
		});

		it('should limit results by top_k', async () => {
			const args = {
				query: 'test query',
				type: 'knowledge',
				top_k: 1,
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].similarity).toBe(0.9); // Should get the highest scored result
		});
	});

	describe('Reflection-Only Search', () => {
		beforeEach(() => {
			// Use dual manager for reflection tests
			mockContext.services.vectorStoreManager = mockDualVectorStoreManager;
		});

		it('should search reflection collection with dual manager', async () => {
			const args = {
				query: 'debugging patterns',
				type: 'reflection',
				top_k: 5,
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].source).toBe('reflection');
			expect(result.results[0].memoryType).toBe('reflection');
			expect(result.results[0].stepTypes).toEqual(['thought', 'action']);
			expect(result.results[0].issueCount).toBe(0);
			expect(result.metadata.searchMode).toBe('reflection');
			expect(result.metadata.knowledgeResults).toBe(0);
			expect(result.metadata.reflectionResults).toBe(1);
		});

		it('should fail reflection search with single manager', async () => {
			// Use single manager (should fail)
			mockContext.services.vectorStoreManager = mockVectorStoreManager;

			const args = {
				query: 'debugging patterns',
				type: 'reflection',
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(false);
		});
	});

	describe('Both Collections Search', () => {
		beforeEach(() => {
			// Use dual manager for both tests
			mockContext.services.vectorStoreManager = mockDualVectorStoreManager;
		});

		it('should search both collections and merge results', async () => {
			const args = {
				query: 'programming and debugging',
				type: 'both',
				top_k: 10,
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(3); // 2 knowledge + 1 reflection
			expect(result.metadata.searchMode).toBe('both');
			expect(result.metadata.knowledgeResults).toBe(2);
			expect(result.metadata.reflectionResults).toBe(1);

			// Should be sorted by similarity score (descending)
			expect(result.results[0].similarity).toBe(0.9); // knowledge_1
			expect(result.results[1].similarity).toBe(0.85); // reflection_1
			expect(result.results[2].similarity).toBe(0.7); // knowledge_2

			// Check that sources are correctly identified
			const knowledgeResults = result.results.filter((r: any) => r.source === 'knowledge');
			const reflectionResults = result.results.filter((r: any) => r.source === 'reflection');
			expect(knowledgeResults).toHaveLength(2);
			expect(reflectionResults).toHaveLength(1);
		});

		it('should respect top_k when merging results from both collections', async () => {
			const args = {
				query: 'test query',
				type: 'both',
				top_k: 2,
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			expect(result.results).toHaveLength(2); // Limited to top 2
			expect(result.results[0].similarity).toBe(0.9); // Highest score
			expect(result.results[1].similarity).toBe(0.85); // Second highest
		});

		it('should handle fallback when reflection collection fails', async () => {
			// Mock reflection store to throw error
			mockReflectionStore.search = vi.fn().mockRejectedValue(new Error('Reflection unavailable'));

			const args = {
				query: 'test query',
				type: 'both',
			};

			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			expect(result.metadata.usedFallback).toBe(true);
			expect(result.metadata.knowledgeResults).toBe(2);
			expect(result.metadata.reflectionResults).toBe(0);
		});
	});

	describe('Error Handling', () => {
		it('should handle embedding failure', async () => {
			mockEmbedder.embed = vi.fn().mockRejectedValue(new Error('Embedding failed'));

			const args = { query: 'test query' };
			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(false);
			expect(result.results).toEqual([]);
		});

		it('should handle vector store search failure', async () => {
			mockKnowledgeStore.search = vi.fn().mockRejectedValue(new Error('Search failed'));

			const args = { query: 'test query' };
			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(false);
			expect(result.results).toEqual([]);
		});

		it('should handle missing services gracefully', async () => {
			const contextWithoutServices = {
				...mockContext,
				services: {
					embeddingManager: null,
					vectorStoreManager: null,
				},
			};

			const args = { query: 'test query' };
			const result = await searchMemoryTool.handler(args, contextWithoutServices);

			expect(result.success).toBe(false);
			expect(result.results).toEqual([]);
		});
	});

	describe('Result Processing', () => {
		it('should include all standard fields in results', async () => {
			const args = { query: 'test query', type: 'knowledge' };
			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.success).toBe(true);
			const firstResult = result.results[0];

			expect(firstResult).toHaveProperty('id');
			expect(firstResult).toHaveProperty('text');
			expect(firstResult).toHaveProperty('tags');
			expect(firstResult).toHaveProperty('confidence');
			expect(firstResult).toHaveProperty('reasoning');
			expect(firstResult).toHaveProperty('timestamp');
			expect(firstResult).toHaveProperty('similarity');
			expect(firstResult).toHaveProperty('source');
			expect(firstResult).toHaveProperty('memoryType');
		});

		it('should calculate metadata statistics correctly', async () => {
			const args = { query: 'test query', type: 'knowledge' };
			const result = await searchMemoryTool.handler(args, mockContext);

			expect(result.metadata.totalResults).toBe(2);
			expect(result.metadata.maxSimilarity).toBe(0.9);
			expect(result.metadata.minSimilarity).toBe(0.7);
			expect(result.metadata.averageSimilarity).toBe(0.8);
			expect(result.metadata.searchMode).toBe('knowledge');
			expect(result.metadata).toHaveProperty('searchTime');
			expect(result.metadata).toHaveProperty('embeddingTime');
		});
	});
});
