import {
	BedrockRuntimeClient,
	BedrockRuntimeClientConfig,
	InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { ILLMService, LLMServiceConfig } from './types.js';
import { AwsConfig } from '../config.js';
import { MCPManager } from '../../../mcp/manager.js';
import { ContextManager } from '../messages/manager.js';
import { UnifiedToolManager, CombinedToolSet } from '../../tools/unified-tool-manager.js';
import { ImageData } from '../messages/types.js';
import { ToolSet } from '../../../mcp/types.js';
import { logger } from '../../../logger/index.js';
import { formatToolResult } from '../utils/tool-result-formatter.js';
import { TextDecoder } from 'util';

interface BedrockRequest {
	messages: Array<{
		role: 'user' | 'assistant';
		content: Array<{
			type: 'text' | 'image';
			text?: string;
			image?: {
				format: 'png' | 'jpeg' | 'gif' | 'webp';
				source: {
					bytes: string;
				};
			};
		}>;
	}>;
	anthropic_version: string;
	max_tokens: number;
	temperature?: number;
	top_p?: number;
	system?: string;
	tools?: Array<{
		name: string;
		description: string;
		input_schema: any;
	}>;
}

interface BedrockResponse {
	content: Array<{
		type: 'text' | 'tool_use';
		text?: string;
		id?: string;
		name?: string;
		input?: any;
	}>;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
	stop_reason?: string;
}

export class AwsService implements ILLMService {
	private client: BedrockRuntimeClient;
	private model: string;
	private mcpManager: MCPManager;
	private unifiedToolManager: UnifiedToolManager | undefined;
	private contextManager: ContextManager;
	private maxIterations: number;

	constructor(
		model: string,
		mcpManager: MCPManager,
		contextManager: ContextManager,
		unifiedToolManager?: UnifiedToolManager,
		maxIterations = 10,
		awsConfig?: AwsConfig
	) {
		this.model = model;
		this.mcpManager = mcpManager;
		this.unifiedToolManager = unifiedToolManager;
		this.contextManager = contextManager;
		this.maxIterations = maxIterations;

		const clientConfig: BedrockRuntimeClientConfig = {
			region: awsConfig?.region || process.env.AWS_DEFAULT_REGION || 'us-east-1',
		};

		// Handle credentials from config or environment
		const accessKeyId = awsConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = awsConfig?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
		const sessionToken = awsConfig?.sessionToken || process.env.AWS_SESSION_TOKEN;

		if (accessKeyId && secretAccessKey) {
			const credentials: any = {
				accessKeyId,
				secretAccessKey,
			};
			if (sessionToken) {
				credentials.sessionToken = sessionToken;
			}
			clientConfig.credentials = credentials;
		}

		this.client = new BedrockRuntimeClient(clientConfig);

		logger.info(
			`AWS Bedrock service initialized with model: ${model} in region: ${clientConfig.region}`
		);
	}

	async generate(userInput: string, imageData?: ImageData): Promise<string> {
		await this.contextManager.addUserMessage(userInput, imageData);

		// Get formatted tools
		let formattedTools: any[];
		if (this.unifiedToolManager) {
			formattedTools = await this.unifiedToolManager.getToolsForProvider('aws');
		} else {
			const rawTools = await this.mcpManager.getAllTools();
			formattedTools = this.formatToolsForBedrock(rawTools);
		}

		logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

		let iterationCount = 0;
		try {
			while (iterationCount < this.maxIterations) {
				iterationCount++;

				const response = await this.getAIResponse(formattedTools);

				// Check if there are tool calls
				const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

				if (toolUseBlocks.length === 0) {
					// No tool calls, return the text content
					const textContent = response.content
						.filter(block => block.type === 'text')
						.map(block => block.text)
						.join('');

					await this.contextManager.addAssistantMessage(textContent);
					return textContent;
				}

				// Log thinking steps if there's text content before tool calls
				const textContent = response.content
					.filter(block => block.type === 'text')
					.map(block => block.text)
					.join('');

				if (textContent && textContent.trim()) {
					logger.info(`💭 ${textContent.trim()}`);
				}

				// Convert tool calls to OpenAI format for context manager
				const toolCalls = toolUseBlocks.map(block => ({
					id: block.id!,
					type: 'function' as const,
					function: {
						name: block.name!,
						arguments: JSON.stringify(block.input),
					},
				}));

				await this.contextManager.addAssistantMessage(textContent, toolCalls);

				// Handle tool calls
				for (const toolUseBlock of toolUseBlocks) {
					logger.debug(`Tool call initiated: ${JSON.stringify(toolUseBlock, null, 2)}`);
					logger.info(`🔧 Using tool: ${toolUseBlock.name}`);

					const toolName = toolUseBlock.name!;
					const args = toolUseBlock.input || {};

					try {
						let toolResult: string;
						if (this.unifiedToolManager) {
							toolResult = await this.unifiedToolManager.executeTool(toolName, args);
						} else {
							const toolExecutionResult = await this.mcpManager.executeTool(toolName, args);
							toolResult = toolExecutionResult.content;
						}

						const formattedResult = formatToolResult(toolName, toolResult);
						await this.contextManager.addToolResult(toolUseBlock.id!, toolName, formattedResult);
						logger.debug(`Tool result: ${formattedResult}`);
					} catch (error) {
						const errorMessage = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
						await this.contextManager.addToolResult(toolUseBlock.id!, toolName, errorMessage);
						logger.error(`Tool execution error: ${errorMessage}`);
					}
				}
			}

			throw new Error(`Maximum iterations (${this.maxIterations}) reached without completion`);
		} catch (error) {
			logger.error('AWS Bedrock generation error:', error);
			throw error;
		}
	}

	async directGenerate(userInput: string, systemPrompt?: string): Promise<string> {
		const messages = [];

		if (systemPrompt) {
			// Handle system prompt in the request
		}

		messages.push({
			role: 'user' as const,
			content: [{ type: 'text' as const, text: userInput }],
		});

		const request: BedrockRequest = {
			messages,
			anthropic_version: 'bedrock-2023-05-31',
			max_tokens: 4096,
			temperature: 0.7,
			...(systemPrompt && { system: systemPrompt }),
		};

		const command = new InvokeModelCommand({
			modelId: this.model,
			contentType: 'application/json',
			accept: 'application/json',
			body: JSON.stringify(request),
		});

		const response = (await this.client.send(command)) as any;
		const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as BedrockResponse;

		return responseBody.content
			.filter(block => block.type === 'text')
			.map(block => block.text)
			.join('');
	}

	async getAllTools(): Promise<ToolSet> {
		if (this.unifiedToolManager) {
			const combinedTools: CombinedToolSet = await this.unifiedToolManager.getAllTools();
			// Convert CombinedToolSet to ToolSet format
			const toolSet: ToolSet = {};
			for (const [toolName, toolInfo] of Object.entries(combinedTools)) {
				toolSet[toolName] = {
					description: toolInfo.description,
					parameters: toolInfo.parameters,
				};
			}
			return toolSet;
		}
		return this.mcpManager.getAllTools();
	}

	getConfig(): LLMServiceConfig {
		return {
			provider: 'aws',
			model: this.model,
		};
	}

	private async getAIResponse(formattedTools: any[]): Promise<BedrockResponse> {
		const messages = await this.contextManager.getAllFormattedMessages();
		const systemPrompt = await this.contextManager.getSystemPrompt();

		// Filter out system messages as they're handled separately in Bedrock
		const bedrockMessages = messages.filter((msg: any) => msg.role !== 'system');

		const request: BedrockRequest = {
			messages: bedrockMessages,
			anthropic_version: 'bedrock-2023-05-31',
			max_tokens: 4096,
			temperature: 0.7,
			...(systemPrompt && { system: systemPrompt }),
		};

		if (formattedTools.length > 0) {
			request.tools = formattedTools;
		}

		const command = new InvokeModelCommand({
			modelId: this.model,
			contentType: 'application/json',
			accept: 'application/json',
			body: JSON.stringify(request),
		});

		const response = (await this.client.send(command)) as any;
		return JSON.parse(new TextDecoder().decode(response.body)) as BedrockResponse;
	}

	private formatToolsForBedrock(rawTools: ToolSet): any[] {
		if (!rawTools || typeof rawTools !== 'object') return [];
		return Object.entries(rawTools).map(([toolName, tool]) => ({
			name: toolName,
			description: tool.description,
			input_schema: tool.parameters,
		}));
	}
}
