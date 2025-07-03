import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	getAllToolDefinitions,
	registerAllTools,
	getToolInfo,
	getToolsByCategory,
	TOOL_CATEGORIES,
} from '../definitions/index.js';
import { extractKnowledgeTool } from '../definitions/memory/index.js';
import { InternalToolManager } from '../manager.js';
import { InternalToolRegistry } from '../registry.js';

// Mock the logger to avoid console output during tests
vi.mock('../../../logger/index.js', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

describe('Tool Definitions', () => {
	let manager: InternalToolManager;

	beforeEach(async () => {
		// Reset the registry singleton before each test
		InternalToolRegistry.reset();

		manager = new InternalToolManager();
		await manager.initialize();
	});

	afterEach(() => {
		InternalToolRegistry.reset();
	});

	describe('Individual Tool Definitions', () => {
		describe('Memory Tools', () => {
			describe('Extract Fact Tool', () => {
				it('should have correct basic properties', () => {
					expect(extractKnowledgeTool.name).toBe('extract_knowledge');
					expect(extractKnowledgeTool.category).toBe('memory');
					expect(extractKnowledgeTool.internal).toBe(true);
					expect(extractKnowledgeTool.description).toContain('Extract detailed facts');
					expect(typeof extractKnowledgeTool.handler).toBe('function');
				});

				it('should have valid parameter schema', () => {
					expect(extractKnowledgeTool.parameters.type).toBe('object');
					expect(extractKnowledgeTool.parameters.properties?.knowledge).toBeDefined();
					expect(extractKnowledgeTool.parameters.properties?.knowledge?.type).toBe('array');
					expect(extractKnowledgeTool.parameters.required).toContain('knowledge');
				});

				it('should execute successfully with valid input', async () => {
					const result = await extractKnowledgeTool.handler({
						knowledge: ['TypeScript interface pattern for tools'],
					});

					expect(result.success).toBe(true);
					expect(result.extracted).toBe(1);
					expect(result.facts).toHaveLength(1);
				});

				it('should handle empty facts array', async () => {
					const result = await extractKnowledgeTool.handler({ knowledge: [] });

					expect(result.success).toBe(false);
					expect(result.error).toContain('No facts provided');
				});
			});
		});
	});

	describe('Tool Registration', () => {
		it('should load all tool definitions', async () => {
			const tools = await getAllToolDefinitions();

			expect(Object.keys(tools)).toHaveLength(1); // 1 memory tool
			expect(tools['extract_knowledge']).toBeDefined();
		});

		it('should register all tools successfully', async () => {
			const result = await registerAllTools(manager);

			expect(result.total).toBe(1);
			expect(result.registered.length).toBe(1);
			expect(result.failed.length).toBe(0);
			expect(result.registered).toContain('extract_knowledge');
		});

		it('should handle registration failures gracefully', async () => {
			// Create a mock manager that always fails registration
			const failingManager = {
				registerTool: vi.fn().mockReturnValue({
					success: false,
					message: 'Simulated failure',
				}),
			};

			const result = await registerAllTools(failingManager);

			expect(result.total).toBe(1);
			expect(result.registered.length).toBe(0);
			expect(result.failed.length).toBe(1);
			expect(result.failed?.[0]?.error).toBe('Simulated failure');
		});
	});

	describe('Tool Categories', () => {
		it('should have correct category structure', () => {
			expect(TOOL_CATEGORIES.memory).toBeDefined();

			expect(TOOL_CATEGORIES.memory.tools).toHaveLength(1);
		});

		it('should get tool info by name', () => {
			const extractInfo = getToolInfo('cipher_extract_knowledge');
			expect(extractInfo).toBeDefined();
			expect(extractInfo?.category).toBe('memory');
		});

		it('should return null for unknown tools', () => {
			const unknownInfo = getToolInfo('unknown_tool');
			expect(unknownInfo).toBeNull();
		});

		it('should get tools by category', () => {
			const memoryTools = getToolsByCategory('memory');
			expect(memoryTools).toHaveLength(1);
			expect(memoryTools).toContain('cipher_extract_knowledge');
		});
	});

	describe('Integration with Manager', () => {
		it('should register and execute all tools through manager', async () => {
			// Register all tools
			await registerAllTools(manager);

			// Test extract fact tool
			const extractResult = await manager.executeTool('extract_knowledge', {
				knowledge: ['Test fact for integration'],
			});
			expect(extractResult.success).toBe(true);

			// Verify tool is working
			expect(extractResult.success).toBe(true);
		});

		it('should track tool execution statistics', async () => {
			await registerAllTools(manager);

			// Execute a tool multiple times
			await manager.executeTool('extract_knowledge', { knowledge: ['Test 1'] });
			await manager.executeTool('extract_knowledge', { knowledge: ['Test 2'] });

			const stats = manager.getToolStats('extract_knowledge');
			expect(stats).toBeDefined();
			expect(stats?.totalExecutions).toBe(2);
			expect(stats?.successfulExecutions).toBe(2);
		});
	});
});
