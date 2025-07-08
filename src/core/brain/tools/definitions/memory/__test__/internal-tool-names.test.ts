import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InternalToolManager } from '../../../manager.js';
import { UnifiedToolManager } from '../../../unified-tool-manager.js';
import { extractAndOperateMemoryTool } from '../extract_and_operate_memory.js';

describe('Internal Tool Names', () => {
	let internalToolManager: InternalToolManager;
	let mockMCPManager: any;

	beforeEach(async () => {
		internalToolManager = new InternalToolManager();
		await internalToolManager.initialize();
		internalToolManager.registerTool(extractAndOperateMemoryTool);

		mockMCPManager = {
			getAllTools: async () => ({}), // No MCP tools
			executeTool: async () => {
				throw new Error('Not implemented');
			},
			clients: new Map(),
			failedConnections: new Map(),
			logger: console,
			toolCache: new Map(),
			initialized: true,
			isConnected: () => false,
			connect: async () => {},
			disconnect: async () => {},
			getAvailableTools: async () => ({}),
			executeToolCall: async () => {
				throw new Error('Not implemented');
			},
			getToolSchema: () => null,
			listTools: async () => [],
			getConnectionStatus: () => ({ connected: [], failed: [] }),
			reloadConnections: async () => {},
			validateConnection: async () => true,
			getToolInfo: () => null,
			handleToolError: () => {},
			clearCache: () => {},
			getStats: () => ({ totalCalls: 0, successfulCalls: 0, failedCalls: 0 }),
			subscribe: () => {},
			unsubscribe: () => {},
			emit: () => {},
			on: () => {},
			off: () => {},
			once: () => {},
			removeListener: () => {},
			removeAllListeners: () => {},
			setMaxListeners: () => {},
			getMaxListeners: () => 10,
			listeners: () => [],
			listenerCount: () => 0,
			eventNames: () => [],
			prependListener: () => {},
			prependOnceListener: () => {},
			rawListeners: () => [],
		};
	});

	afterEach(() => {
		// Clean up if needed
	});

	it('should register tool with correct name in InternalToolManager', () => {
		const internalTools = internalToolManager.getAllTools();
		expect(Object.keys(internalTools)).toContain('cipher_extract_and_operate_memory');
	});

	it('should identify internal tools correctly', () => {
		expect(internalToolManager.isInternalTool('extract_and_operate_memory')).toBe(true);
		expect(internalToolManager.isInternalTool('cipher_extract_and_operate_memory')).toBe(true);
		expect(internalToolManager.isInternalTool('nonexistent_tool')).toBe(false);
	});

	it('should make tools available in UnifiedToolManager', async () => {
		const unifiedToolManager = new UnifiedToolManager(mockMCPManager, internalToolManager, {
			enableInternalTools: true,
			enableMcpTools: false,
		});

		const allTools = await unifiedToolManager.getAllTools();
		expect(Object.keys(allTools)).toContain('cipher_extract_and_operate_memory');
	});

	it('should check tool availability correctly', async () => {
		const unifiedToolManager = new UnifiedToolManager(mockMCPManager, internalToolManager, {
			enableInternalTools: true,
			enableMcpTools: false,
		});

		expect(await unifiedToolManager.isToolAvailable('cipher_extract_and_operate_memory')).toBe(
			true
		);
		expect(await unifiedToolManager.isToolAvailable('nonexistent_tool')).toBe(false);
	});
});
