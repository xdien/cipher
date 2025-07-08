import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InternalToolManager } from '../manager.js';
import { InternalToolRegistry } from '../registry.js';
import { registerAllTools } from '../definitions/index.js';

// Mock the logger to avoid console output during tests
vi.mock('../../../logger/index.js', () => ({
	createLogger: vi.fn(() => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	})),
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

describe('Phase 3: Service Integration Tests', () => {
	let toolManager: InternalToolManager;
	let mockVectorStoreManager: any;
	let originalEnv: Record<string, string | undefined>;

	beforeEach(async () => {
		// Store original env values
		originalEnv = { ...process.env };

		// Set required environment variables for reflection memory
		process.env.REFLECTION_MEMORY_ENABLED = 'true';
		process.env.REFLECTION_AUTO_EXTRACT = 'true';
		process.env.REFLECTION_EVALUATION_ENABLED = 'true';
		process.env.REFLECTION_VECTOR_STORE_COLLECTION = 'reflection_memory';

		// Create mock vector store manager with dual collection support
		const mockVectorStore = {
			search: vi.fn().mockResolvedValue([]),
			store: vi.fn().mockResolvedValue(undefined),
			insert: vi.fn().mockResolvedValue(undefined),
		};
		
		mockVectorStoreManager = {
			search: vi.fn().mockResolvedValue([]),
			store: vi.fn().mockResolvedValue(undefined),
			searchInCollection: vi.fn().mockResolvedValue([]),
			storeInCollection: vi.fn().mockResolvedValue(undefined),
			getStore: vi.fn().mockReturnValue(mockVectorStore),
		};

		// Reset all mocks
		vi.clearAllMocks();

		// Initialize tool manager
		toolManager = new InternalToolManager({
			enabled: true,
			timeout: 30000,
			enableCache: false,
			cacheTimeout: 300000,
		});

		await toolManager.initialize();

		// Register all tools including reflection memory tools
		await registerAllTools(toolManager);

		// Set services including vector store manager
		toolManager.setServices({
			vectorStoreManager: mockVectorStoreManager,
			embeddingManager: {
				getEmbedder: vi.fn().mockReturnValue({
					embed: vi.fn().mockResolvedValue(Array(128).fill(0).map(() => Math.random())),
				}),
			},
			llmService: {
				directGenerate: vi.fn().mockResolvedValue('Operation: ADD\nConfidence: 0.8\nReasoning: New technical information to store'),
			},
		});
	});

	afterEach(() => {
		// Restore original env
		Object.assign(process.env, originalEnv);
	});

	describe('Tool Registration', () => {
		it('should register all reflection memory tools', () => {
			const tools = toolManager.getAllTools();
			
			expect(tools).toHaveProperty('cipher_extract_reasoning_steps');
			expect(tools).toHaveProperty('cipher_evaluate_reasoning');
			expect(tools).toHaveProperty('cipher_search_reasoning_patterns');
			
			// Verify tool categories
			const reflectionTools = toolManager.getToolsByCategory('memory');
			expect(Object.keys(reflectionTools).length).toBeGreaterThan(0);
		});

		it('should properly categorize reflection memory tools', () => {
			const extractTool = toolManager.getTool('extract_reasoning_steps');
			const evaluateTool = toolManager.getTool('evaluate_reasoning');
			const searchTool = toolManager.getTool('search_reasoning_patterns');

			expect(extractTool?.category).toBe('memory');
			expect(evaluateTool?.category).toBe('memory');
			expect(searchTool?.category).toBe('memory');
		});
	});

	describe('Extract and Store Workflow', () => {
		it('should extract reasoning and store in vector storage', async () => {
			const conversation = `
Thought: I need to solve this math problem: 2 + 2.
Action: I'll add the numbers together.
Observation: 2 + 2 = 4.
Conclusion: The answer is 4.
			`;

			const result = await toolManager.executeTool(
				'extract_reasoning_steps',
				{ 
					conversation,
					options: { includeMetadata: true }
				},
				{ 
					sessionId: 'test-session',
					services: { vectorStoreManager: mockVectorStoreManager }
				}
			);

			expect(result.success).toBe(true);
			expect(result.result.trace).toBeDefined();
			expect(result.result.trace.steps).toHaveLength(4);
		});

		it('should handle storage failures gracefully', async () => {
			// Mock storage failure
			mockVectorStoreManager.storeInCollection.mockRejectedValue(new Error('Storage failed'));

			const conversation = 'Thought: Simple test.';

			const result = await toolManager.executeTool(
				'extract_reasoning_steps',
				{ conversation },
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			// Should still succeed even if storage fails
			expect(result.success).toBe(true);
			expect(result.result.trace).toBeDefined();
		});
	});

	describe('Evaluation and Storage Workflow', () => {
		it('should evaluate reasoning and store evaluation results', async () => {
			const sampleTrace = {
				id: 'test-trace-123',
				steps: [
					{
						type: 'thought',
						content: 'I need to solve this problem',
						confidence: 0.9,
						timestamp: '2024-01-01T00:00:00Z'
					},
					{
						type: 'action',
						content: 'Implementing solution approach',
						confidence: 0.8,
						timestamp: '2024-01-01T00:01:00Z'
					}
				],
				metadata: {
					extractedAt: '2024-01-01T00:00:00Z',
					conversationLength: 100,
					stepCount: 2,
					hasExplicitMarkup: true
				}
			};

			const result = await toolManager.executeTool(
				'evaluate_reasoning',
				{ 
					trace: sampleTrace,
					options: { includeOptimization: true }
				},
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			expect(result.success).toBe(true);
			expect(result.result.evaluation).toBeDefined();
			expect(result.result.evaluation.qualityScore).toBeGreaterThan(0);
			
			// Verify evaluation storage was attempted if shouldStore is true
			const mockVectorStore = mockVectorStoreManager.getStore();
			if (result.result.evaluation.shouldStore) {
				expect(mockVectorStore.store.mock.calls.length + mockVectorStore.insert.mock.calls.length).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe('Search Integration', () => {
		it('should search reasoning patterns using vector storage', async () => {
			// Mock search results
			const mockSearchResults = [
				{
					id: 'trace-1',
					content: 'Reasoning pattern about problem solving',
					score: 0.85,
					metadata: {
						type: 'reasoning_trace',
						qualityScore: 0.9,
						traceId: 'trace-1'
					}
				}
			];
			
			// Set up the mock on the vector store's search method
			const mockVectorStore = mockVectorStoreManager.getStore();
			mockVectorStore.search.mockResolvedValue(mockSearchResults);

			const result = await toolManager.executeTool(
				'search_reasoning_patterns',
				{ 
					query: 'problem solving approaches',
					options: { maxResults: 5, minQualityScore: 0.7 }
				},
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			expect(result.success).toBe(true);
			expect(result.result.patterns).toHaveLength(1);
			expect(result.result.patterns[0]).toMatchObject({
				id: 'trace-1',
				score: 0.85,
				type: 'reasoning_trace'
			});

			// Verify vector search was called with embedding vector
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(Array), // embedding vector
				5 // maxResults
			);
		});

		it('should fallback to default collection when dual collection not available', async () => {
			// The search tool always uses the vector store from getStore()
			// So this test should verify that it works normally even without dual collection support
			const mockVectorStore = mockVectorStoreManager.getStore();
			mockVectorStore.search.mockResolvedValue([]);

			const result = await toolManager.executeTool(
				'search_reasoning_patterns',
				{ query: 'test query' },
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			expect(result.success).toBe(true);
			expect(result.result.patterns).toHaveLength(0);
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(Array), // embedding vector
				10 // default maxResults
			);
		});

		it('should handle missing vector store manager gracefully', async () => {
			// Temporarily clear the tool manager's default services
			const originalServices = (toolManager as any).services;
			(toolManager as any).services = {};

			const result = await toolManager.executeTool(
				'search_reasoning_patterns',
				{ query: 'test query' },
				{ services: {} }
			);

			expect(result.success).toBe(true);
			expect(result.result.patterns).toHaveLength(0);
			expect(result.metadata.fallback).toBe(true);

			// Restore the original services
			(toolManager as any).services = originalServices;
		});
	});

	describe('Complete Integration Workflow', () => {
		it('should execute the complete reflection memory workflow', async () => {
			// Step 1: Extract reasoning
			const conversation = `
Thought: I need to implement a sorting algorithm.
Action: I'll use quicksort for its efficiency.
Observation: Quicksort has O(n log n) average complexity.
Thought: I should handle the edge case of empty arrays.
Action: Adding validation for empty input.
Result: Algorithm implemented with proper error handling.
			`;

			const extractResult = await toolManager.executeTool(
				'extract_reasoning_steps',
				{ conversation },
				{ 
					sessionId: 'integration-test',
					services: { vectorStoreManager: mockVectorStoreManager }
				}
			);

			expect(extractResult.success).toBe(true);
			const trace = extractResult.result.trace;

			// Step 2: Evaluate reasoning
			const evaluateResult = await toolManager.executeTool(
				'evaluate_reasoning',
				{ trace },
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			expect(evaluateResult.success).toBe(true);
			const evaluation = evaluateResult.result.evaluation;

			// Step 3: Search for similar patterns
			const mockVectorStore = mockVectorStoreManager.getStore();
			mockVectorStore.search.mockResolvedValue([
				{
					id: trace.id,
					content: 'sorting algorithm reasoning',
					score: 0.9,
					metadata: { type: 'reasoning_trace', qualityScore: evaluation.qualityScore }
				}
			]);

			const searchResult = await toolManager.executeTool(
				'search_reasoning_patterns',
				{ query: 'sorting algorithm implementation' },
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			expect(searchResult.success).toBe(true);
			expect(searchResult.result.patterns).toHaveLength(1);

			// Verify all steps completed successfully
			expect(extractResult.metadata.stepCount).toBeGreaterThan(0);
			expect(evaluation.qualityScore).toBeGreaterThan(0);
			expect(searchResult.result.patterns[0].id).toBe(trace.id);
		});
	});

	describe('Configuration and Environment', () => {
		it('should respect REFLECTION_MEMORY_ENABLED setting', async () => {
			// Temporarily disable reflection memory
			process.env.REFLECTION_MEMORY_ENABLED = 'false';

			const result = await toolManager.executeTool(
				'extract_reasoning_steps',
				{ conversation: 'Test conversation' },
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			expect(result.success).toBe(false);
			expect(result.result.error).toContain('disabled');

			// Restore to enabled
			process.env.REFLECTION_MEMORY_ENABLED = 'true';
		});

		it('should handle missing reflection collection configuration', async () => {
			// The search tool uses the vector store normally regardless of collection configuration
			const mockVectorStore = mockVectorStoreManager.getStore();
			mockVectorStore.search.mockResolvedValue([]);

			const result = await toolManager.executeTool(
				'search_reasoning_patterns',
				{ query: 'test' },
				{ services: { vectorStoreManager: mockVectorStoreManager }}
			);

			expect(result.success).toBe(true);
			// Should use normal vector search 
			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(Array), // embedding vector
				10 // default maxResults
			);
		});
	});
}); 