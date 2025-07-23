import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AwsService } from '../aws.js';
import { LLMConfig } from '../../config.js';
import { ChatMessage } from '../../messages/types.js';
import { MCPManager } from '../../../../mcp/manager.js';
import { IContextManager } from '../../messages/base.js';
import { UnifiedToolManager } from '../../tools/unified-tool-manager.js';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';

// Mock AWS SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(),
  InvokeModelCommand: vi.fn(),
  InvokeModelWithResponseStreamCommand: vi.fn(),
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

describe('AwsService', () => {
  let awsService: AwsService;
  let mockConfig: LLMConfig;
  let mockMcpManager: MCPManager;
  let mockContextManager: IContextManager;
  let mockToolManager: UnifiedToolManager;
  let mockBedrockClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup environment variables
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.AWS_DEFAULT_REGION = 'us-east-1';

    // Create mock config
    mockConfig = {
      provider: 'aws' as const,
      model: 'anthropic.claude-3-sonnet-20240229-v1:0',
      apiKey: 'test-api-key',
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
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
          },
        },
      ]),
    } as unknown as UnifiedToolManager;

    // Create mock Bedrock client
    mockBedrockClient = {
      send: vi.fn(),
    };

    (BedrockRuntimeClient as any).mockImplementation(() => mockBedrockClient);

    // Create service instance
    awsService = new AwsService(mockConfig, mockMcpManager, mockContextManager, mockToolManager);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_DEFAULT_REGION;
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(BedrockRuntimeClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          sessionToken: undefined,
        },
      });
    });

    it('should use default region if not provided', () => {
      delete process.env.AWS_DEFAULT_REGION;
      new AwsService(mockConfig, mockMcpManager, mockContextManager, mockToolManager);
      
      expect(BedrockRuntimeClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
          sessionToken: undefined,
        },
      });
    });
  });

  describe('generate', () => {
    it('should successfully generate a response', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello, world!' },
      ];

      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'Hello! How can I help you today?',
              },
            ],
            usage: {
              input_tokens: 10,
              output_tokens: 20,
            },
            stop_reason: 'end_turn',
          })
        ),
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Hello, world!' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await awsService.generate(messages);

      expect(result).toEqual({
        content: 'Hello! How can I help you today?',
        toolCalls: undefined,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        stopReason: 'end_turn',
      });

      expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
      expect(InvokeModelCommand).toHaveBeenCalled();
    });

    it('should handle tool calls', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Use the test tool' },
      ];

      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'I\'ll use the test tool for you.',
              },
              {
                type: 'tool_use',
                id: 'call_123',
                name: 'test_tool',
                input: { input: 'test input' },
              },
            ],
            usage: {
              input_tokens: 15,
              output_tokens: 25,
            },
          })
        ),
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Use the test tool' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await awsService.generate(messages);

      expect(result.toolCalls).toEqual([
        {
          id: 'call_123',
          name: 'test_tool',
          arguments: '{"input":"test input"}',
        },
      ]);
    });

    it('should handle image messages', async () => {
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
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'I can see an image.',
              },
            ],
            usage: {
              input_tokens: 100,
              output_tokens: 10,
            },
          })
        ),
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);
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

      const result = await awsService.generate(messages);

      expect(result.content).toBe('I can see an image.');
    });

    it('should handle errors gracefully', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      mockBedrockClient.send.mockRejectedValue(new Error('API Error'));
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Hello' }],
        systemPrompt: 'Test system prompt',
      });

      await expect(awsService.generate(messages)).rejects.toThrow(
        'AWS Bedrock generation failed: API Error'
      );
    });
  });

  describe('directGenerate', () => {
    it('should call generate without streaming', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Direct generation test' },
      ];

      const mockResponse = {
        body: new TextEncoder().encode(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'Direct response',
              },
            ],
            usage: {
              input_tokens: 5,
              output_tokens: 5,
            },
          })
        ),
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);
      mockContextManager.format.mockResolvedValue({
        messages: [{ role: 'user', content: 'Direct generation test' }],
        systemPrompt: 'Test system prompt',
      });

      const result = await awsService.directGenerate(messages);

      expect(result.content).toBe('Direct response');
    });
  });

  describe('getAllTools', () => {
    it('should return tools from tool manager', () => {
      const tools = awsService.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
    });

    it('should return empty array when no tool manager', () => {
      const serviceWithoutTools = new AwsService(mockConfig);
      expect(serviceWithoutTools.getAllTools()).toEqual([]);
    });
  });

  describe('getConfig', () => {
    it('should return service configuration', () => {
      const config = awsService.getConfig();
      expect(config).toEqual({
        provider: 'aws',
        model: 'anthropic.claude-3-sonnet-20240229-v1:0',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when context manager is missing', async () => {
      const serviceWithoutContext = new AwsService(
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
});