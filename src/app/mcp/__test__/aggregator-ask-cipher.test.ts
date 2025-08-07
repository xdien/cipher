import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the logger to avoid console output during tests
vi.mock('../../../core/logger/index.js', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

// Mock the memAgent
const mockAgent = {
	unifiedToolManager: {
		getAllTools: vi.fn(() => Promise.resolve({})),
		executeTool: vi.fn(() => Promise.resolve('mock result')),
	},
	run: vi.fn(() => Promise.resolve({ response: 'mock response' })),
} as any;

// Mock the createMcpTransport function
vi.mock('../mcp_handler.js', () => ({
	createMcpTransport: vi.fn(() =>
		Promise.resolve({
			server: {
				on: vi.fn(),
				send: vi.fn(),
			},
		})
	),
}));

// Mock the Server class
const mockServer = {
	connect: vi.fn(),
	setRequestHandler: vi.fn(),
	on: vi.fn(),
};

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
	Server: vi.fn(() => mockServer),
}));

// Import after mocks
import { initializeAggregatorServer } from '../aggregator-handler.js';

describe('Aggregator USE_ASK_CIPHER functionality', () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Save original environment
		originalEnv = process.env.USE_ASK_CIPHER;
		// Clear all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore original environment
		if (originalEnv === undefined) {
			delete process.env.USE_ASK_CIPHER;
		} else {
			process.env.USE_ASK_CIPHER = originalEnv;
		}
	});

	it('should include ask_cipher tool when USE_ASK_CIPHER is not set (default true)', async () => {
		delete process.env.USE_ASK_CIPHER;

		await initializeAggregatorServer(
			{
				conflictResolution: 'prefix',
				timeout: 30000,
			},
			mockAgent
		);

		// Check that setRequestHandler was called for ListToolsRequestSchema
		expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);

		// Get the first handler call (ListToolsRequestSchema)
		const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
		const toolsResult = await listToolsHandler();

		// Should include ask_cipher tool by default
		const askCipherTool = toolsResult.tools.find((t: any) => t.name === 'ask_cipher');
		expect(askCipherTool).toBeDefined();
		expect(askCipherTool.description).toContain('Access Cipher memory layer');
	});

	it('should include ask_cipher tool when USE_ASK_CIPHER is explicitly set to true', async () => {
		process.env.USE_ASK_CIPHER = 'true';

		await initializeAggregatorServer(
			{
				conflictResolution: 'prefix',
				timeout: 30000,
			},
			mockAgent
		);

		// Get the first handler call (ListToolsRequestSchema)
		const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
		const toolsResult = await listToolsHandler();

		// Should include ask_cipher tool
		const askCipherTool = toolsResult.tools.find((t: any) => t.name === 'ask_cipher');
		expect(askCipherTool).toBeDefined();
	});

	it('should exclude ask_cipher tool when USE_ASK_CIPHER is set to false', async () => {
		process.env.USE_ASK_CIPHER = 'false';

		await initializeAggregatorServer(
			{
				conflictResolution: 'prefix',
				timeout: 30000,
			},
			mockAgent
		);

		// Get the first handler call (ListToolsRequestSchema)
		const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
		const toolsResult = await listToolsHandler();

		// Should NOT include ask_cipher tool
		const askCipherTool = toolsResult.tools.find((t: any) => t.name === 'ask_cipher');
		expect(askCipherTool).toBeUndefined();
	});

	it('should reject ask_cipher tool calls when USE_ASK_CIPHER is set to false', async () => {
		process.env.USE_ASK_CIPHER = 'false';

		await initializeAggregatorServer(
			{
				conflictResolution: 'prefix',
				timeout: 30000,
			},
			mockAgent
		);

		// Get the second handler call (CallToolRequestSchema)
		const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

		// Try to call ask_cipher when it's disabled
		await expect(
			callToolHandler({
				params: {
					name: 'ask_cipher',
					arguments: { message: 'test message' },
				},
			})
		).rejects.toThrow('ask_cipher tool is disabled in this aggregator configuration');
	});

	it('should handle ask_cipher tool calls when USE_ASK_CIPHER is enabled', async () => {
		process.env.USE_ASK_CIPHER = 'true';

		await initializeAggregatorServer(
			{
				conflictResolution: 'prefix',
				timeout: 30000,
			},
			mockAgent
		);

		// Get the second handler call (CallToolRequestSchema)
		const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

		// Call ask_cipher when it's enabled
		const result = await callToolHandler({
			params: {
				name: 'ask_cipher',
				arguments: { message: 'test message' },
			},
		});

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'mock response',
				},
			],
		});
		expect(mockAgent.run).toHaveBeenCalledTimes(1);
	});

	it('should treat case insensitive values correctly', async () => {
		process.env.USE_ASK_CIPHER = 'FALSE';

		await initializeAggregatorServer(
			{
				conflictResolution: 'prefix',
				timeout: 30000,
			},
			mockAgent
		);

		// Get the first handler call (ListToolsRequestSchema)
		const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];
		const toolsResult = await listToolsHandler();

		// Should NOT include ask_cipher tool (case insensitive)
		const askCipherTool = toolsResult.tools.find((t: any) => t.name === 'ask_cipher');
		expect(askCipherTool).toBeUndefined();
	});
});
