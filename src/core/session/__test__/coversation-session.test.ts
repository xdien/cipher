import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationSession } from '../coversation-session.js';
import type { LLMConfig } from '../../brain/llm/config.js';

// Mock the factory functions
vi.mock('../../brain/llm/messages/factory.js', () => ({
	createContextManager: vi.fn(),
}));

vi.mock('../../brain/llm/services/factory.js', () => ({
	createLLMService: vi.fn(),
}));

// Mock the logger to avoid console output in tests
vi.mock('../../logger/index.js', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

describe('ConversationSession', () => {
	let session: ConversationSession;
	let mockStateManager: any;
	let mockPromptManager: any;
	let mockMcpManager: any;
	let mockContextManager: any;
	let mockLLMService: any;
	let mockCreateContextManager: any;
	let mockCreateLLMService: any;

	const mockLLMConfig: LLMConfig = {
		provider: 'openai',
		model: 'gpt-4.1-mini',
		apiKey: 'test-api-key',
		maxIterations: 3,
		baseURL: 'https://api.openai.com/v1',
	};

	const sessionId = 'test-session-123';

	beforeEach(async () => {
		vi.clearAllMocks();

		// Create mock services
		mockStateManager = {
			getLLMConfig: vi.fn().mockReturnValue(mockLLMConfig),
		};

		mockPromptManager = {
			load: vi.fn(),
			getInstruction: vi.fn().mockReturnValue('Test system prompt'),
		};

		mockMcpManager = {
			getAllTools: vi.fn().mockResolvedValue({}),
			getClients: vi.fn().mockReturnValue(new Map()),
		};

		mockContextManager = {
			addMessage: vi.fn(),
			getMessages: vi.fn().mockReturnValue([]),
			clearMessages: vi.fn(),
		};

		mockLLMService = {
			generate: vi.fn().mockResolvedValue('Generated response'),
			getAllTools: vi.fn().mockResolvedValue({}),
			getConfig: vi.fn().mockReturnValue({
				provider: 'openai',
				model: 'gpt-4',
			}),
		};

		// Mock factory functions
		const { createContextManager } = await import('../../brain/llm/messages/factory.js');
		const { createLLMService } = await import('../../brain/llm/services/factory.js');

		mockCreateContextManager = vi.mocked(createContextManager);
		mockCreateLLMService = vi.mocked(createLLMService);

		mockCreateContextManager.mockReturnValue(mockContextManager);
		mockCreateLLMService.mockReturnValue(mockLLMService);

		session = new ConversationSession(
			{
				stateManager: mockStateManager,
				promptManager: mockPromptManager,
				mcpManager: mockMcpManager,
			},
			sessionId
		);
	});

	describe('Initialization', () => {
		it('should initialize successfully with provided services and id', () => {
			expect(session.id).toBe(sessionId);
		});

		it('should initialize services correctly', async () => {
			await session.init();

			expect(mockStateManager.getLLMConfig).toHaveBeenCalledWith(sessionId);
			expect(mockCreateContextManager).toHaveBeenCalledWith(mockLLMConfig, mockPromptManager);
			expect(mockCreateLLMService).toHaveBeenCalledWith(
				mockLLMConfig,
				mockMcpManager,
				mockContextManager,
				undefined // unifiedToolManager is undefined in these tests
			);
		});

		it('should handle initialization errors gracefully', async () => {
			const error = new Error('Initialization failed');
			mockCreateContextManager.mockImplementation(() => {
				throw error;
			});

			await expect(session.init()).rejects.toThrow('Initialization failed');
		});

		it('should handle LLM service creation errors', async () => {
			const error = new Error('LLM service creation failed');
			mockCreateLLMService.mockImplementation(() => {
				throw error;
			});

			await expect(session.init()).rejects.toThrow('LLM service creation failed');
		});
	});

	describe('Session Execution', () => {
		beforeEach(async () => {
			await session.init();
		});

		it('should run session with text input successfully', async () => {
			const input = 'Hello, how are you?';
			const expectedResponse = 'I am doing well, thank you!';

			mockLLMService.generate.mockResolvedValue(expectedResponse);

			const result = await session.run(input);

			expect(result).toBe(expectedResponse);
			expect(mockLLMService.generate).toHaveBeenCalledWith(input, undefined, undefined);
		});

		it('should run session with image data input', async () => {
			const input = 'What do you see in this image?';
			const imageData = { image: 'base64-image-data', mimeType: 'image/jpeg' };
			const expectedResponse = 'I see a beautiful landscape.';

			mockLLMService.generate.mockResolvedValue(expectedResponse);

			const result = await session.run(input, imageData);

			expect(result).toBe(expectedResponse);
			expect(mockLLMService.generate).toHaveBeenCalledWith(input, imageData, undefined);
		});

		it('should run session with streaming enabled', async () => {
			const input = 'Stream this response';
			const expectedResponse = 'Streaming response...';

			mockLLMService.generate.mockResolvedValue(expectedResponse);

			const result = await session.run(input, undefined, true);

			expect(result).toBe(expectedResponse);
			expect(mockLLMService.generate).toHaveBeenCalledWith(input, undefined, true);
		});

		it('should run session with all parameters', async () => {
			const input = 'Complex request';
			const imageData = { image: 'base64-data', mimeType: 'image/png' };
			const stream = true;
			const expectedResponse = 'Complex response';

			mockLLMService.generate.mockResolvedValue(expectedResponse);

			const result = await session.run(input, imageData, stream);

			expect(result).toBe(expectedResponse);
			expect(mockLLMService.generate).toHaveBeenCalledWith(input, imageData, stream);
		});

		it('should handle LLM service generation errors', async () => {
			const error = new Error('Generation failed');
			mockLLMService.generate.mockRejectedValue(error);

			await expect(session.run('test input')).rejects.toThrow('Generation failed');
		});

		it('should throw error when running uninitialized session', async () => {
			const uninitializedSession = new ConversationSession(
				{
					stateManager: mockStateManager,
					promptManager: mockPromptManager,
					mcpManager: mockMcpManager,
				},
				'uninitialized-session'
			);

			// This should throw because it tries to call llmService.generate() on undefined
			await expect(uninitializedSession.run('test')).rejects.toThrow();
		});
	});

	describe('Service Access', () => {
		beforeEach(async () => {
			await session.init();
		});

		it('should return context manager', () => {
			const contextManager = session.getContextManager();
			expect(contextManager).toBe(mockContextManager);
		});

		it('should return LLM service', () => {
			const llmService = session.getLLMService();
			expect(llmService).toBe(mockLLMService);
		});

		it('should return undefined when accessing services before initialization', () => {
			const uninitializedSession = new ConversationSession(
				{
					stateManager: mockStateManager,
					promptManager: mockPromptManager,
					mcpManager: mockMcpManager,
				},
				'uninitialized-session'
			);

			expect(uninitializedSession.getContextManager()).toBeUndefined();
			expect(uninitializedSession.getLLMService()).toBeUndefined();
		});
	});

	describe('Session State Management', () => {
		it('should use session-specific LLM config', async () => {
			const sessionSpecificConfig = {
				...mockLLMConfig,
				model: 'gpt-3.5-turbo',
				temperature: 0.5,
			};

			mockStateManager.getLLMConfig.mockReturnValue(sessionSpecificConfig);

			await session.init();

			expect(mockStateManager.getLLMConfig).toHaveBeenCalledWith(sessionId);
			expect(mockCreateContextManager).toHaveBeenCalledWith(
				sessionSpecificConfig,
				mockPromptManager
			);
			expect(mockCreateLLMService).toHaveBeenCalledWith(
				sessionSpecificConfig,
				mockMcpManager,
				mockContextManager,
				undefined // unifiedToolManager is undefined in these tests
			);
		});

		it('should handle different LLM providers', async () => {
			const anthropicConfig = {
				...mockLLMConfig,
				provider: 'anthropic',
				model: 'claude-3-sonnet',
			};

			mockStateManager.getLLMConfig.mockReturnValue(anthropicConfig);

			await session.init();

			expect(mockCreateContextManager).toHaveBeenCalledWith(anthropicConfig, mockPromptManager);
			expect(mockCreateLLMService).toHaveBeenCalledWith(
				anthropicConfig,
				mockMcpManager,
				mockContextManager,
				undefined // unifiedToolManager is undefined in these tests
			);
		});
	});

	describe('Concurrent Operations', () => {
		beforeEach(async () => {
			await session.init();
		});

		it('should handle multiple concurrent run calls', async () => {
			const inputs = ['Question 1', 'Question 2', 'Question 3'];
			const expectedResponses = ['Answer 1', 'Answer 2', 'Answer 3'];

			mockLLMService.generate
				.mockResolvedValueOnce(expectedResponses[0])
				.mockResolvedValueOnce(expectedResponses[1])
				.mockResolvedValueOnce(expectedResponses[2]);

			const promises = inputs.map(input => session.run(input));
			const results = await Promise.all(promises);

			// Check that all expected responses are present, but order may vary due to concurrency
			expect(results).toHaveLength(3);
			expect(results).toEqual(expect.arrayContaining(expectedResponses));
			expect(mockLLMService.generate).toHaveBeenCalledTimes(3);
		});

		it('should handle mixed success and failure scenarios', async () => {
			mockLLMService.generate
				.mockResolvedValueOnce('Success 1')
				.mockRejectedValueOnce(new Error('Failure'))
				.mockResolvedValueOnce('Success 2');

			const results = await Promise.allSettled([
				session.run('input1'),
				session.run('input2'),
				session.run('input3'),
			]);

			// Since Promise.allSettled doesn't guarantee order with concurrent calls,
			// we need to check the overall results instead of specific positions
			const fulfilled = results.filter(r => r.status === 'fulfilled');
			const rejected = results.filter(r => r.status === 'rejected');

			expect(fulfilled).toHaveLength(2);
			expect(rejected).toHaveLength(1);

			const successValues = fulfilled.map(r => (r as PromiseFulfilledResult<string>).value);
			expect(successValues).toContain('Success 1');
			expect(successValues).toContain('Success 2');

			const rejectedReasons = rejected.map(r => (r as PromiseRejectedResult).reason.message);
			expect(rejectedReasons).toContain('Failure');
		});
	});

	describe('Edge Cases', () => {
		beforeEach(async () => {
			await session.init();
		});

		it('should handle empty input', async () => {
			const emptyInput = '';
			const expectedResponse = 'Please provide a valid input.';

			mockLLMService.generate.mockResolvedValue(expectedResponse);

			const result = await session.run(emptyInput);

			expect(result).toBe(expectedResponse);
			expect(mockLLMService.generate).toHaveBeenCalledWith(emptyInput, undefined, undefined);
		});

		it('should handle very long input', async () => {
			const longInput = 'a'.repeat(10000);
			const expectedResponse = 'Response to long input';

			mockLLMService.generate.mockResolvedValue(expectedResponse);

			const result = await session.run(longInput);

			expect(result).toBe(expectedResponse);
			expect(mockLLMService.generate).toHaveBeenCalledWith(longInput, undefined, undefined);
		});

		it('should handle special characters and unicode', async () => {
			const specialInput = '🚀 Hello! 你好 @#$%^&*()';
			const expectedResponse = 'Response with special chars';

			mockLLMService.generate.mockResolvedValue(expectedResponse);

			const result = await session.run(specialInput);

			expect(result).toBe(expectedResponse);
			expect(mockLLMService.generate).toHaveBeenCalledWith(specialInput, undefined, undefined);
		});
	});
});
