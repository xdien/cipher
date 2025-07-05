import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedToolManager } from '../unified-tool-manager.js';
import { InternalToolManager } from '../manager.js';
import { InternalToolRegistry } from '../registry.js';
import { MCPManager } from '../../../mcp/manager.js';
import { registerAllTools } from '../definitions/index.js';

// Mock the logger to avoid console output during tests
vi.mock('../../../logger/index.js', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
	createLogger: vi.fn(() => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	})),
}));

describe('UnifiedToolManager', () => {
	let unifiedManager: UnifiedToolManager;
	let internalToolManager: InternalToolManager;
	let mcpManager: MCPManager;

	beforeEach(async () => {
		// Reset the registry singleton before each test
		InternalToolRegistry.reset();

		// Create managers
		internalToolManager = new InternalToolManager();
		mcpManager = new MCPManager();

		// Initialize internal tool manager and register tools
		await internalToolManager.initialize();
		await registerAllTools(internalToolManager);

		// Create unified manager
		unifiedManager = new UnifiedToolManager(mcpManager, internalToolManager);
	});

	afterEach(() => {
		InternalToolRegistry.reset();
	});

	describe('Initialization and Configuration', () => {
		it('should initialize with default configuration', () => {
			const manager = new UnifiedToolManager(mcpManager, internalToolManager);
			const stats = manager.getStats();

			expect(stats.config.enableInternalTools).toBe(true);
			expect(stats.config.enableMcpTools).toBe(true);
			expect(stats.config.conflictResolution).toBe('prefix-internal');
			expect(stats.config.executionTimeout).toBe(30000);
		});

		it('should initialize with custom configuration', () => {
			const config = {
				enableInternalTools: false,
				enableMcpTools: true,
				conflictResolution: 'prefer-mcp' as const,
				executionTimeout: 15000,
			};

			const manager = new UnifiedToolManager(mcpManager, internalToolManager, config);
			const stats = manager.getStats();

			expect(stats.config.enableInternalTools).toBe(false);
			expect(stats.config.enableMcpTools).toBe(true);
			expect(stats.config.conflictResolution).toBe('prefer-mcp');
			expect(stats.config.executionTimeout).toBe(15000);
		});
	});

	describe('Tool Loading and Management', () => {
		it('should load internal tools when enabled', async () => {
			const tools = await unifiedManager.getAllTools();

			// Should have 2 memory tools
			expect(Object.keys(tools)).toHaveLength(2);
			expect(tools['cipher_extract_knowledge']).toBeDefined();
			expect(tools['cipher_memory_operation']).toBeDefined();

			// All tools should be marked as internal
			for (const tool of Object.values(tools)) {
				expect(tool.source).toBe('internal');
			}
		});

		it('should handle disabled internal tools', async () => {
			const manager = new UnifiedToolManager(mcpManager, internalToolManager, {
				enableInternalTools: false,
				enableMcpTools: true,
			});

			const tools = await manager.getAllTools();

			// Should not have any internal tools
			const internalTools = Object.values(tools).filter(t => t.source === 'internal');
			expect(internalTools).toHaveLength(0);
		});

		it('should handle disabled MCP tools', async () => {
			const manager = new UnifiedToolManager(mcpManager, internalToolManager, {
				enableInternalTools: true,
				enableMcpTools: false,
			});

			const tools = await manager.getAllTools();

			// Should only have internal tools
			const mcpTools = Object.values(tools).filter(t => t.source === 'mcp');
			expect(mcpTools).toHaveLength(0);

			const internalTools = Object.values(tools).filter(t => t.source === 'internal');
			expect(internalTools.length).toBeGreaterThan(0);
		});
	});

	describe('Tool Execution', () => {
		it('should execute internal tools correctly', async () => {
			const result = await unifiedManager.executeTool('cipher_extract_knowledge', {
				knowledge: ['Test fact for unified manager'],
			});

			expect(result.success).toBe(true);
			expect(result.extracted).toBe(1);
		});

		it('should route tools to correct manager', async () => {
			// Test internal tool routing
			const internalResult = await unifiedManager.executeTool('cipher_extract_knowledge', {
				knowledge: ['Test knowledge extraction'],
			});
			expect(internalResult.success).toBe(true);

			// Test that internal tools are identified correctly
			const isInternal = await unifiedManager.getToolSource('cipher_extract_knowledge');
			expect(isInternal).toBe('internal');
		});

		it('should handle tool execution errors gracefully', async () => {
			await expect(unifiedManager.executeTool('nonexistent_tool', {})).rejects.toThrow();
		});

		it('should check tool availability correctly', async () => {
			const isAvailable = await unifiedManager.isToolAvailable('cipher_extract_knowledge');
			expect(isAvailable).toBe(true);

			const notAvailable = await unifiedManager.isToolAvailable('nonexistent_tool');
			expect(notAvailable).toBe(false);
		});
	});

	describe('Provider-Specific Tool Formatting', () => {
		it('should format tools for OpenAI', async () => {
			const formattedTools = await unifiedManager.getToolsForProvider('openai');

			expect(Array.isArray(formattedTools)).toBe(true);
			expect(formattedTools.length).toBe(2);

			// Check OpenAI format
			const tool = formattedTools[0];
			expect(tool.type).toBe('function');
			expect(tool.function).toBeDefined();
			expect(tool.function.name).toBeDefined();
			expect(tool.function.description).toBeDefined();
			expect(tool.function.parameters).toBeDefined();
		});

		it('should format tools for Anthropic', async () => {
			const formattedTools = await unifiedManager.getToolsForProvider('anthropic');

			expect(Array.isArray(formattedTools)).toBe(true);
			expect(formattedTools.length).toBe(2);

			// Check Anthropic format
			const tool = formattedTools[0];
			expect(tool.name).toBeDefined();
			expect(tool.description).toBeDefined();
			expect(tool.input_schema).toBeDefined();
		});

		it('should format tools for OpenRouter', async () => {
			const formattedTools = await unifiedManager.getToolsForProvider('openrouter');

			expect(Array.isArray(formattedTools)).toBe(true);
			expect(formattedTools.length).toBe(2);

			// OpenRouter uses OpenAI format
			const tool = formattedTools[0];
			expect(tool.type).toBe('function');
			expect(tool.function).toBeDefined();
		});

		it('should throw error for unsupported provider', async () => {
			await expect(unifiedManager.getToolsForProvider('unsupported' as any)).rejects.toThrow(
				'Unsupported provider'
			);
		});
	});

	describe('Statistics and Monitoring', () => {
		it('should provide comprehensive statistics', () => {
			const stats = unifiedManager.getStats();

			expect(stats.internalTools).toBeDefined();
			expect(stats.mcpTools).toBeDefined();
			expect(stats.config).toBeDefined();

			// Internal tools stats should be available
			expect(stats.internalTools.totalTools).toBe(2);
			expect(stats.internalTools.toolsByCategory.memory).toBe(2);
		});

		it('should handle disabled tool managers in stats', () => {
			const manager = new UnifiedToolManager(mcpManager, internalToolManager, {
				enableInternalTools: false,
				enableMcpTools: false,
			});

			const stats = manager.getStats();
			expect(stats.internalTools).toBeNull();
			expect(stats.mcpTools).toBeNull();
		});
	});

	describe('Error Handling', () => {
		it('should handle internal tool manager errors gracefully', async () => {
			// Create a manager with disabled internal tools
			const manager = new UnifiedToolManager(mcpManager, internalToolManager, {
				enableInternalTools: false,
			});

			await expect(manager.executeTool('cipher_extract_knowledge', {})).rejects.toThrow();
		});

		it('should handle MCP manager errors gracefully', async () => {
			// Mock MCP manager to throw errors
			const errorMcpManager = {
				getAllTools: vi.fn().mockRejectedValue(new Error('MCP Error')),
				executeTool: vi.fn().mockRejectedValue(new Error('MCP Execution Error')),
			} as any;

			const manager = new UnifiedToolManager(errorMcpManager, internalToolManager);

			// Should still work with internal tools
			const tools = await manager.getAllTools();
			const internalTools = Object.values(tools).filter(t => t.source === 'internal');
			expect(internalTools.length).toBeGreaterThan(0);
		});
	});

	describe('Tool Source Detection', () => {
		it('should correctly identify internal tool sources', async () => {
			const source = await unifiedManager.getToolSource('cipher_extract_knowledge');
			expect(source).toBe('internal');
		});

		it('should return null for unknown tools', async () => {
			const source = await unifiedManager.getToolSource('unknown_tool');
			expect(source).toBeNull();
		});

		it('should handle tool source detection errors', async () => {
			// Create manager with error-prone internal tool manager
			const errorInternalManager = {
				isInternalTool: vi.fn().mockImplementation(() => {
					throw new Error('Internal error');
				}),
			} as any;

			const manager = new UnifiedToolManager(mcpManager, errorInternalManager);
			const source = await manager.getToolSource('cipher_test_tool');
			expect(source).toBeNull();
		});
	});

	describe('Integration Scenarios', () => {
		it('should work with real tool execution flow', async () => {
			// Test a complete flow similar to LLM service usage

			// 1. Get all available tools
			const allTools = await unifiedManager.getAllTools();
			expect(Object.keys(allTools).length).toBeGreaterThan(0);

			// 2. Format tools for OpenAI
			const openaiTools = await unifiedManager.getToolsForProvider('openai');
			expect(openaiTools.length).toBeGreaterThan(0);

			// 3. Execute a tool
			const extractResult = await unifiedManager.executeTool('cipher_extract_knowledge', {
				knowledge: ['Integration test fact'],
			});
			expect(extractResult.success).toBe(true);

			// 4. Check statistics
			const stats = unifiedManager.getStats();
			expect(stats.internalTools.totalExecutions).toBeGreaterThan(0);
		});
	});
});
