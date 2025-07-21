import { initializeMcpServer } from '../mcp_handler';

describe('MCP Handler - Mode-specific Prompt Injection', () => {
	let promptLoaded: string | null;
	const mockPromptManager = {
		load: (prompt: string) => {
			promptLoaded = prompt;
		},
	};
	const mockAgent = {
		promptManager: mockPromptManager,
	};
	const agentCard = { name: 'test', version: '1.0.0' };

	beforeEach(() => {
		promptLoaded = null;
	});

	it('injects the MCP prompt in default mode', async () => {
		await initializeMcpServer(
			mockAgent as any,
			agentCard as any,
			'default',
		);
		expect(promptLoaded).toContain('Cipher should focus solely on EITHER storage OR retrieval');
	});

	it('does NOT inject the MCP prompt in aggregator mode', async () => {
		await initializeMcpServer(
			mockAgent as any,
			agentCard as any,
			'aggregator',
		);
		expect(promptLoaded).toBeNull();
	});
}); 