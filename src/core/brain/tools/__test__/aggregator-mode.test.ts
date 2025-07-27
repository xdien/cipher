import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnifiedToolManager } from '../unified-tool-manager.js';
import { InternalToolManager } from '../manager.js';
import { MCPManager } from '../../../mcp/manager.js';

// Mock tools
const mockMcpManager = {
	getAllTools: async () => ({}),
	getClients: () => new Map(),
	getFailedConnections: () => ({}),
	executeTool: async () => 'mcp result',
} as unknown as MCPManager;

const mockInternalToolManager = {
	getAllTools: () => ({
		extract_and_operate_memory: {
			name: 'extract_and_operate_memory',
			agentAccessible: false, // This is the key - it's marked as not agent-accessible
			description: 'Extract and operate memory tool',
			parameters: { type: 'object', properties: {} },
		},
		memory_search: {
			name: 'memory_search',
			agentAccessible: true,
			description: 'Memory search tool',
			parameters: { type: 'object', properties: {} },
		},
	}),
	getTool: (name: string) => {
		const tools: Record<string, any> = {
			extract_and_operate_memory: {
				name: 'extract_and_operate_memory',
				agentAccessible: false,
				description: 'Extract and operate memory tool',
				parameters: { type: 'object', properties: {} },
			},
			cipher_extract_and_operate_memory: {
				name: 'extract_and_operate_memory',
				agentAccessible: false,
				description: 'Extract and operate memory tool',
				parameters: { type: 'object', properties: {} },
			},
			memory_search: {
				name: 'memory_search',
				agentAccessible: true,
				description: 'Memory search tool',
				parameters: { type: 'object', properties: {} },
			},
			cipher_memory_search: {
				name: 'memory_search',
				agentAccessible: true,
				description: 'Memory search tool',
				parameters: { type: 'object', properties: {} },
			},
		};
		return tools[name];
	},
	isInternalTool: (name: string) => name.includes('cipher_') || name.includes('memory'),
	executeTool: async () => 'internal result',
} as unknown as InternalToolManager;

describe('UnifiedToolManager - Aggregator Mode', () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Save original environment
		originalEnv = process.env.MCP_SERVER_MODE;
	});

	afterEach(() => {
		// Restore original environment
		if (originalEnv === undefined) {
			delete process.env.MCP_SERVER_MODE;
		} else {
			process.env.MCP_SERVER_MODE = originalEnv;
		}
	});

	describe('Default Mode', () => {
		it('should NOT expose cipher_extract_and_operate_memory in default mode', async () => {
			process.env.MCP_SERVER_MODE = 'default';

			const manager = new UnifiedToolManager(mockMcpManager, mockInternalToolManager);
			const allTools = await manager.getAllTools();

			// cipher_extract_and_operate_memory should NOT be in the tools list
			expect(allTools).not.toHaveProperty('cipher_extract_and_operate_memory');

			// But other agent-accessible tools should be present
			expect(allTools).toHaveProperty('cipher_memory_search');
		});

		it('should return false for isToolAvailable for cipher_extract_and_operate_memory in default mode', async () => {
			process.env.MCP_SERVER_MODE = 'default';

			const manager = new UnifiedToolManager(mockMcpManager, mockInternalToolManager);

			const isAvailable = await manager.isToolAvailable('cipher_extract_and_operate_memory');
			expect(isAvailable).toBe(false);
		});

		it('should return null for getToolSource for cipher_extract_and_operate_memory in default mode', async () => {
			process.env.MCP_SERVER_MODE = 'default';

			const manager = new UnifiedToolManager(mockMcpManager, mockInternalToolManager);

			const source = await manager.getToolSource('cipher_extract_and_operate_memory');
			expect(source).toBe(null);
		});
	});

	describe('Aggregator Mode', () => {
		it('should expose cipher_extract_and_operate_memory in aggregator mode', async () => {
			process.env.MCP_SERVER_MODE = 'aggregator';

			const manager = new UnifiedToolManager(mockMcpManager, mockInternalToolManager);
			const allTools = await manager.getAllTools();

			// cipher_extract_and_operate_memory SHOULD be in the tools list
			expect(allTools).toHaveProperty('cipher_extract_and_operate_memory');
			expect(allTools['cipher_extract_and_operate_memory']).toEqual({
				description: 'Extract and operate memory tool',
				parameters: { type: 'object', properties: {} },
				source: 'internal',
			});

			// Other agent-accessible tools should still be present
			expect(allTools).toHaveProperty('cipher_memory_search');
		});

		it('should return true for isToolAvailable for cipher_extract_and_operate_memory in aggregator mode', async () => {
			process.env.MCP_SERVER_MODE = 'aggregator';

			const manager = new UnifiedToolManager(mockMcpManager, mockInternalToolManager);

			const isAvailable = await manager.isToolAvailable('cipher_extract_and_operate_memory');
			expect(isAvailable).toBe(true);
		});

		it('should return "internal" for getToolSource for cipher_extract_and_operate_memory in aggregator mode', async () => {
			process.env.MCP_SERVER_MODE = 'aggregator';

			const manager = new UnifiedToolManager(mockMcpManager, mockInternalToolManager);

			const source = await manager.getToolSource('cipher_extract_and_operate_memory');
			expect(source).toBe('internal');
		});
	});

	describe('Explicit Configuration Override', () => {
		it('should allow explicit mode override via config', async () => {
			process.env.MCP_SERVER_MODE = 'default';

			// Override via config
			const manager = new UnifiedToolManager(mockMcpManager, mockInternalToolManager, {
				mode: 'aggregator',
			});

			const allTools = await manager.getAllTools();

			// Should respect the explicit config over environment variable
			expect(allTools).toHaveProperty('cipher_extract_and_operate_memory');
		});
	});
});
