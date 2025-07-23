import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AzureService } from '../azure.js';
import { LLMConfig } from '../../config.js';
import { ChatMessage } from '../../messages/types.js';
import { MCPManager } from '../../../../mcp/manager.js';
import { IContextManager } from '../../messages/base.js';
import { UnifiedToolManager } from '../../tools/unified-tool-manager.js';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

// Mock Azure SDK
vi.mock('@azure/openai', () => ({
  OpenAIClient: vi.fn(),
  AzureKeyCredential: vi.fn(),
}));

// Mock logger
vi.mock('@core/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AzureService', () => {
  let azureService: AzureService;
  let mockConfig: LLMConfig;
  let mockMcpManager: MCPManager;
  let mockContextManager: IContextManager;
  let mockToolManager: UnifiedToolManager;
  let mockOpenAIClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup environment variables
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'test-api-key';
    process.env.AZURE_OPENAI_API_VERSION = '2024-10-01-preview';

    // Create mock config
    mockConfig = {
      provider: 'azure' as const,
      model: 'gpt-4-deployment',
      apiKey: 'config-api-key',
      maxIterations: 10,
    };

    // Create mock managers
    mockMcpManager = {} as MCPManager;
    
    mockContextManager = {
      format: vi.fn().mockResolvedValue({
        messages: [],
        systemPrompt: 'Test system prompt',
      }),
    } as unknown as IContextManager;

    mockToolManager = {
      getAllTools: vi.fn().mockReturnValue([
        {
          name: 'test_function',
          description: 'A test function',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
      ]),
    } as unknown as UnifiedToolManager;

    // Create mock OpenAI client
    mockOpenAIClient = {
      getChatCompletions: vi.fn(),
      streamChatCompletions: vi.fn(),
    };

    (OpenAIClient as any).mockImplementation(() => mockOpenAIClient);
    (AzureKeyCredential as any).mockImplementation((key: string) => ({ key }));

    // Create service instance
    azureService = new AzureService(mockConfig, mockMcpManager, mockContextManager, mockToolManager);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_API_VERSION;
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(OpenAIClient).toHaveBeenCalledWith(
        'https://test.openai.azure.com',
        expect.objectContaining({ key: 'test-api-key' })
      );
    });

    it('should throw error when endpoint is missing', () => {
      delete process.env.AZURE_OPENAI_ENDPOINT;
      
      expect(() => {
        new AzureService(mockConfig, mockMcpManager, mockContextManager, mockToolManager);
      }).toThrow('AZURE_OPENAI_ENDPOINT environment variable is required');
    });

    it('should throw error when API key is missing', () => {
      delete process.env.AZURE_OPENAI_API_KEY;
      
      expect(() => {
        new AzureService(mockConfig, mockMcpManager, mockContextManager, mockToolManager);
      }).toThrow('AZURE_OPENAI_API_KEY environment variable is required');
    });

    it('should use default API version if not provided', () => {
      delete process.env.AZURE_OPENAI_API_VERSION;
      
      const service = new AzureService(mockConfig, mockMcpManager, mockContextManager, mockToolManager);
      expect(service).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should successfully generate a response', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello, Azure!' },
      ];

      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };

      mockOpenAIClient.getChatCompletions.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Hello, Azure!' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await azureService.generate(messages);

      expect(result).toEqual({
        content: 'Hello! How can I help you today?',
        toolCalls: undefined,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        stopReason: 'stop',
      });

      expect(mockOpenAIClient.getChatCompletions).toHaveBeenCalledWith(
        'gpt-4-deployment',
        expect.arrayContaining([
          { role: 'system', content: 'Test system prompt' },
          { role: 'user', content: 'Hello, Azure!' },
        ]),
        expect.objectContaining({
          temperature: 0.7,
          maxTokens: 4096,
          topP: 1,
        })
      );
    });

    it('should handle function calls', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Search for something' },
      ];

      const mockResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I\'ll search for that.',
              functionCall: {
                name: 'test_function',
                arguments: '{"query": "something"}',
              },
            },
            finishReason: 'function_call',
          },
        ],
        usage: {
          promptTokens: 15,
          completionTokens: 25,
          totalTokens: 40,
        },
      };

      mockOpenAIClient.getChatCompletions.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Search for something' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await azureService.generate(messages);

      expect(result.content).toBe('I\'ll search for that.');
      expect(result.toolCalls).toEqual([
        {
          id: expect.stringMatching(/^call_\d+$/),
          name: 'test_function',
          arguments: '{"query": "something"}',
        },
      ]);
    });

    it('should handle tool response messages', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Search for cats' },
        {
          role: 'assistant',
          content: 'I\'ll search for cats.',
          toolCalls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'search',
                arguments: '{"query": "cats"}',
              },
            },
          ],
        },
        {
          role: 'tool',
          content: 'Found 10 results about cats',
          toolCallId: 'call_123',
          name: 'search',
        },
      ];

      const mockResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I found 10 results about cats for you.',
            },
            finishReason: 'stop',
          },
        ],
      };

      mockOpenAIClient.getChatCompletions.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [
          { role: 'user', content: 'Search for cats' },
          {
            role: 'assistant',
            content: 'I\'ll search for cats.',
            toolCalls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'search',
                  arguments: '{"query": "cats"}',
                },
              },
            ],
          },
          {
            role: 'tool',
            content: 'Found 10 results about cats',
            toolCallId: 'call_123',
            name: 'search',
          },
        ],
        systemPrompt: 'Test system prompt',
      });

      const result = await azureService.generate(messages);

      expect(result.content).toBe('I found 10 results about cats for you.');
    });

    it('should handle errors gracefully', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      mockOpenAIClient.getChatCompletions.mockRejectedValue(new Error('API Error'));
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'Test system prompt',
      });

      await expect(azureService.generate(messages)).rejects.toThrow(
        'Azure OpenAI generation failed: API Error'
      );
    });

    it('should handle no choices in response', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const mockResponse = {
        choices: [],
      };

      mockOpenAIClient.getChatCompletions.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'Test system prompt',
      });

      await expect(azureService.generate(messages)).rejects.toThrow(
        'No choices returned from Azure OpenAI'
      );
    });
  });

  describe('streaming', () => {
    it('should handle streaming responses', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Stream test' },
      ];

      const mockStreamEvents = [
        {
          choices: [
            {
              delta: {
                content: 'Hello',
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                content: ' world!',
              },
            },
          ],
        },
      ];

      // Create async generator for streaming
      const mockStream = async function* () {
        for (const event of mockStreamEvents) {
          yield event;
        }
      };

      mockOpenAIClient.streamChatCompletions.mockReturnValue(mockStream());
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Stream test' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await azureService.generate(messages, { stream: true });

      expect(result.content).toBe('Hello world!');
    });

    it('should handle streaming with function calls', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Stream with function' },
      ];

      const mockStreamEvents = [
        {
          choices: [
            {
              delta: {
                content: 'I\'ll use a function',
                functionCall: {
                  name: 'test_function',
                },
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                functionCall: {
                  arguments: '{"query":',
                },
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                functionCall: {
                  arguments: ' "test"}',
                },
              },
            },
          ],
        },
      ];

      const mockStream = async function* () {
        for (const event of mockStreamEvents) {
          yield event;
        }
      };

      mockOpenAIClient.streamChatCompletions.mockReturnValue(mockStream());
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Stream with function' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await azureService.generate(messages, { stream: true });

      expect(result.content).toBe('I\'ll use a function');
      expect(result.toolCalls).toEqual([
        {
          id: expect.stringMatching(/^call_\d+$/),
          name: 'test_function',
          arguments: '{"query": "test"}',
        },
      ]);
    });
  });

  describe('directGenerate', () => {
    it('should call generate without streaming', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Direct generation test' },
      ];

      const mockResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Direct response',
            },
            finishReason: 'stop',
          },
        ],
      };

      mockOpenAIClient.getChatCompletions.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Direct generation test' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await azureService.directGenerate(messages);

      expect(result.content).toBe('Direct response');
    });
  });

  describe('getAllTools', () => {
    it('should return tools from tool manager', () => {
      const tools = azureService.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_function');
    });

    it('should return empty array when no tool manager', () => {
      const serviceWithoutTools = new AzureService(mockConfig);
      expect(serviceWithoutTools.getAllTools()).toEqual([]);
    });
  });

  describe('getConfig', () => {
    it('should return service configuration', () => {
      const config = azureService.getConfig();
      expect(config).toEqual({
        provider: 'azure',
        model: 'gpt-4-deployment',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when context manager is missing', async () => {
      const serviceWithoutContext = new AzureService(
        mockConfig,
        mockMcpManager,
        undefined,
        mockToolManager
      );

      await expect(
        serviceWithoutContext.generate([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Context manager is required for message formatting');
    });
  });

  describe('message formatting', () => {
    it('should handle image messages by converting to text', async () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'What is in this image?',
          imageData: {
            base64: 'base64encodedimage',
            mimeType: 'image/jpeg',
          },
        },
      ];

      const mockResponse = {
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I cannot process images directly.',
            },
          },
        ],
      };

      mockOpenAIClient.getChatCompletions.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [
          {
            role: 'user',
            content: 'What is in this image?',
            imageData: {
              base64: 'base64encodedimage',
              mimeType: 'image/jpeg',
            },
          },
        ],
        systemPrompt: 'Test system prompt',
      });

      await azureService.generate(messages);

      // Verify the image message was converted to text
      expect(mockOpenAIClient.getChatCompletions).toHaveBeenCalledWith(
        'gpt-4-deployment',
        expect.arrayContaining([
          { role: 'system', content: 'Test system prompt' },
          { role: 'user', content: 'What is in this image?' },
        ]),
        expect.any(Object)
      );
    });
  });
});