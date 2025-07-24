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

// Complete AWS Bedrock model families (2025)
enum ModelFamily {
	ANTHROPIC = 'anthropic',
	META_LLAMA = 'meta',
	AMAZON_TITAN = 'amazon.titan',
	AMAZON_NOVA = 'amazon.nova',
	AI21_LABS = 'ai21',
	COHERE = 'cohere',
	DEEPSEEK = 'deepseek',
	LUMA_AI = 'luma',
	MISTRAL_AI = 'mistral',
	STABILITY_AI = 'stability',
	TWELVELABS = 'twelvelabs',
	WRITER = 'writer'
}

// Anthropic format (Claude models)
interface AnthropicRequest {
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

// Meta Llama format
interface LlamaRequest {
	prompt: string;
	temperature?: number;
	top_p?: number;
	max_gen_len?: number;
	images?: string[];
}

// Amazon Titan format
interface TitanRequest {
	inputText: string;
	textGenerationConfig?: {
		maxTokenCount?: number;
		temperature?: number;
		topP?: number;
		stopSequences?: string[];
	};
}

// AI21 Labs format
interface AI21Request {
	messages: Array<{
		role: 'system' | 'user' | 'assistant';
		content: string;
	}>;
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	frequency_penalty?: number;
	presence_penalty?: number;
}

// DeepSeek format
interface DeepSeekRequest {
	prompt: string;
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	stop?: string[];
}

// Cohere format
interface CohereRequest {
	message: string;
	chat_history?: Array<{
		role: 'USER' | 'CHATBOT';
		message: string;
	}>;
	temperature?: number;
	p?: number;
	k?: number;
	max_tokens?: number;
}

// Union type for all request formats (for type checking)
// type BedrockRequest = AnthropicRequest | LlamaRequest | TitanRequest | AI21Request | DeepSeekRequest | CohereRequest;

// Anthropic response format
interface AnthropicResponse {
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

// Meta Llama response format
interface LlamaResponse {
	generation: string;
	prompt_token_count: number;
	generation_token_count: number;
	stop_reason: string;
}

// Amazon Titan response format
interface TitanResponse {
	inputTextTokenCount: number;
	results: Array<{
		tokenCount: number;
		outputText: string;
		completionReason: string;
	}>;
}

// AI21 Labs response format
interface AI21Response {
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

// DeepSeek response format
interface DeepSeekResponse {
	choices: Array<{
		text: string;
		finish_reason: string;
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

// Union type for all response formats
type BedrockResponse = AnthropicResponse | LlamaResponse | TitanResponse | AI21Response | DeepSeekResponse;

export class AwsService implements ILLMService {
	private client: BedrockRuntimeClient;
	private model: string;
	private mcpManager: MCPManager;
	private unifiedToolManager: UnifiedToolManager | undefined;
	private contextManager: ContextManager;
	private maxIterations: number;
	private modelFamily: ModelFamily;
	private inferenceProfileArn: string | undefined;

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
		this.modelFamily = this.detectModelFamily(model);
		this.inferenceProfileArn = awsConfig?.inferenceProfileArn || process.env.AWS_BEDROCK_INFERENCE_PROFILE_ARN;

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
			`AWS Bedrock service initialized with model: ${model} (family: ${this.modelFamily}) in region: ${clientConfig.region}`
		);
	}

	private detectModelFamily(modelId: string): ModelFamily {
		const id = modelId.toLowerCase();
		
		logger.info(`Detecting model family for: ${id}`);
		
		if (id.startsWith('anthropic.')) {
			logger.info(`Detected ANTHROPIC model family`);
			return ModelFamily.ANTHROPIC;
		}
		if (id.startsWith('meta.') || id.startsWith('us.meta.')) {
			logger.info(`Detected META_LLAMA model family`);
			return ModelFamily.META_LLAMA;
		}
		if (id.startsWith('amazon.titan')) {
			logger.debug(`Detected AMAZON_TITAN model family`);
			return ModelFamily.AMAZON_TITAN;
		}
		if (id.startsWith('amazon.nova')) {
			logger.debug(`Detected AMAZON_NOVA model family`);
			return ModelFamily.AMAZON_NOVA;
		}
		if (id.startsWith('ai21.')) {
			logger.debug(`Detected AI21_LABS model family`);
			return ModelFamily.AI21_LABS;
		}
		if (id.startsWith('cohere.')) {
			logger.debug(`Detected COHERE model family`);
			return ModelFamily.COHERE;
		}
		if (id.startsWith('deepseek') || id.startsWith('us.deepseek')) {
			logger.debug(`Detected DEEPSEEK model family`);
			return ModelFamily.DEEPSEEK;
		}
		if (id.startsWith('luma.')) {
			logger.debug(`Detected LUMA_AI model family`);
			return ModelFamily.LUMA_AI;
		}
		if (id.startsWith('mistral.')) {
			logger.debug(`Detected MISTRAL_AI model family`);
			return ModelFamily.MISTRAL_AI;
		}
		if (id.startsWith('stability.')) {
			logger.debug(`Detected STABILITY_AI model family`);
			return ModelFamily.STABILITY_AI;
		}
		if (id.startsWith('twelvelabs.')) {
			logger.debug(`Detected TWELVELABS model family`);
			return ModelFamily.TWELVELABS;
		}
		if (id.startsWith('writer.')) {
			logger.debug(`Detected WRITER model family`);
			return ModelFamily.WRITER;
		}
		
		// Default to Anthropic for backward compatibility
		logger.warn(`Unknown model family for ${modelId}, defaulting to Anthropic format`);
		return ModelFamily.ANTHROPIC;
	}

	async generate(userInput: string, imageData?: ImageData): Promise<string> {
		logger.info(`AWS generate called with userInput: ${userInput.substring(0, 100)}...`);
		await this.contextManager.addUserMessage(userInput, imageData);
		logger.info('User message added to context');

		// Get formatted tools
		let formattedTools: any[];
		if (this.unifiedToolManager) {
			logger.info('Getting tools from unified tool manager');
			formattedTools = await this.unifiedToolManager.getToolsForProvider('aws');
		} else {
			logger.info('Getting tools from MCP manager');
			const rawTools = await this.mcpManager.getAllTools();
			formattedTools = this.formatToolsForBedrock(rawTools);
		}

		logger.info(`Got ${formattedTools.length} formatted tools`);
		logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

		let iterationCount = 0;
		try {
			logger.info('Starting generation loop');
			while (iterationCount < this.maxIterations) {
				iterationCount++;
				logger.info(`Generation iteration ${iterationCount}`);

				logger.info('Calling getAIResponse');
				const response = await this.getAIResponse(formattedTools);
				logger.info('Got AI response, parsing...');

				// Parse response based on model family
				const { textContent, toolCalls } = this.parseResponse(response);
				logger.info(`Parsed response - textContent length: ${textContent?.length || 0}, toolCalls: ${toolCalls.length}`);

				if (toolCalls.length === 0) {
					// No tool calls, return the text content
					logger.info('No tool calls, adding assistant message and returning');
					await this.contextManager.addAssistantMessage(textContent);
					logger.info('Assistant message added, returning response');
					return textContent;
				}

				// Log thinking steps if there's text content before tool calls
				if (textContent && textContent.trim()) {
					logger.info(`💭 ${textContent.trim()}`);
				}

				await this.contextManager.addAssistantMessage(textContent, toolCalls);

				// Handle tool calls for supported model families
				if (toolCalls.length > 0) {
					for (const toolCall of toolCalls) {
						logger.debug(`Tool call initiated: ${JSON.stringify(toolCall, null, 2)}`);
						logger.info(`🔧 Using tool: ${toolCall.function.name}`);

						const toolName = toolCall.function.name;
						const args = JSON.parse(toolCall.function.arguments);

						try {
							let toolResult: string;
							if (this.unifiedToolManager) {
								toolResult = await this.unifiedToolManager.executeTool(toolName, args);
							} else {
								const toolExecutionResult = await this.mcpManager.executeTool(toolName, args);
								toolResult = toolExecutionResult.content;
							}

							const formattedResult = formatToolResult(toolName, toolResult);
							await this.contextManager.addToolResult(toolCall.id, toolName, formattedResult);
							logger.debug(`Tool result: ${formattedResult}`);
						} catch (error) {
							const errorMessage = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
							await this.contextManager.addToolResult(toolCall.id, toolName, errorMessage);
							logger.error(`Tool execution error: ${errorMessage}`);
						}
					}
				}
			}

			throw new Error(`Maximum iterations (${this.maxIterations}) reached without completion`);
		} catch (error) {
			logger.error('AWS Bedrock generation error:', error);
			logger.error('Error details:', {
				message: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				iterationCount,
				modelFamily: this.modelFamily,
				model: this.model
			});
			throw error;
		}
	}

	async directGenerate(userInput: string, systemPrompt?: string): Promise<string> {
		const messages = [{
			role: 'user' as const,
			content: [{ type: 'text' as const, text: userInput }],
		}];

		let request: any;

		switch (this.modelFamily) {
			case ModelFamily.ANTHROPIC:
				request = this.buildAnthropicRequest(messages, systemPrompt);
				break;
			case ModelFamily.META_LLAMA:
				request = this.buildLlamaRequest(messages, systemPrompt);
				break;
			case ModelFamily.AMAZON_TITAN:
				request = this.buildTitanRequest(messages, systemPrompt);
				break;
			case ModelFamily.AI21_LABS:
				request = this.buildAI21Request(messages, systemPrompt);
				break;
			case ModelFamily.DEEPSEEK:
				request = this.buildDeepSeekRequest(messages, systemPrompt);
				break;
			default:
				request = this.buildAnthropicRequest(messages, systemPrompt);
		}

		const commandParams: any = {
			modelId: this.model,
			contentType: 'application/json',
			accept: 'application/json',
			body: JSON.stringify(request),
		};
		if (this.inferenceProfileArn) {
			commandParams.inferenceConfig = { profileId: this.inferenceProfileArn };
		}
		const command = new InvokeModelCommand(commandParams);

		const response = (await this.client.send(command)) as any;
		const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as BedrockResponse;

		const { textContent } = this.parseResponse(responseBody);
		return textContent;
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
		logger.info('Getting formatted messages from context manager');
		const messages = await this.contextManager.getAllFormattedMessages();
		logger.info(`Got ${messages.length} messages from context`);
		
		logger.info('Getting system prompt from context manager');
		const systemPrompt = await this.contextManager.getSystemPrompt();
		logger.info(`Got system prompt: ${systemPrompt ? 'yes' : 'no'}`);

		logger.info(`Building request for model family: ${this.modelFamily}`);
		let request: any;

		switch (this.modelFamily) {
			case ModelFamily.ANTHROPIC:
				logger.info(`Using Anthropic request format`);
				request = this.buildAnthropicRequest(messages, systemPrompt, formattedTools);
				break;
			case ModelFamily.META_LLAMA:
				logger.info(`Using Llama request format`);
				request = this.buildLlamaRequest(messages, systemPrompt);
				break;
			case ModelFamily.AMAZON_TITAN:
				request = this.buildTitanRequest(messages, systemPrompt);
				break;
			case ModelFamily.AI21_LABS:
				request = this.buildAI21Request(messages, systemPrompt);
				break;
			case ModelFamily.DEEPSEEK:
				request = this.buildDeepSeekRequest(messages, systemPrompt);
				break;
			default:
				// Fallback to Anthropic format for unsupported families
				logger.warn(`Model family ${this.modelFamily} not fully implemented, using Anthropic format`);
				request = this.buildAnthropicRequest(messages, systemPrompt, formattedTools);
		}

		logger.info('Creating InvokeModelCommand');
		const commandParams: any = {
			modelId: this.model,
			contentType: 'application/json',
			accept: 'application/json',
			body: JSON.stringify(request),
		};
		if (this.inferenceProfileArn) {
			commandParams.inferenceConfig = { profileId: this.inferenceProfileArn };
		}
		const command = new InvokeModelCommand(commandParams);

		logger.info('Sending command to Bedrock client');
		const response = (await this.client.send(command)) as any;
		logger.info('Got response from Bedrock, parsing...');
		
		const parsedResponse = JSON.parse(new TextDecoder().decode(response.body)) as BedrockResponse;
		logger.info('Response parsed successfully');
		return parsedResponse;
	}

	private parseResponse(response: BedrockResponse): { textContent: string; toolCalls: any[] } {
		switch (this.modelFamily) {
			case ModelFamily.ANTHROPIC:
				return this.parseAnthropicResponse(response as AnthropicResponse);
			case ModelFamily.META_LLAMA:
				return this.parseLlamaResponse(response as LlamaResponse);
			case ModelFamily.AMAZON_TITAN:
				return this.parseTitanResponse(response as TitanResponse);
			case ModelFamily.AI21_LABS:
				return this.parseAI21Response(response as AI21Response);
			case ModelFamily.DEEPSEEK:
				return this.parseDeepSeekResponse(response as DeepSeekResponse);
			default:
				// Fallback to Anthropic parsing
				return this.parseAnthropicResponse(response as AnthropicResponse);
		}
	}

	private parseAnthropicResponse(response: AnthropicResponse): { textContent: string; toolCalls: any[] } {
		const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
		const textContent = response.content
			.filter(block => block.type === 'text')
			.map(block => block.text)
			.join('');

		const toolCalls = toolUseBlocks.map(block => ({
			id: block.id!,
			type: 'function' as const,
			function: {
				name: block.name!,
				arguments: JSON.stringify(block.input),
			},
		}));

		return { textContent, toolCalls };
	}

	private parseLlamaResponse(response: LlamaResponse): { textContent: string; toolCalls: any[] } {
		return {
			textContent: response.generation,
			toolCalls: [], // Llama models don't support tool calling
		};
	}

	private parseTitanResponse(response: TitanResponse): { textContent: string; toolCalls: any[] } {
		const textContent = response.results.map(result => result.outputText).join('');
		return {
			textContent,
			toolCalls: [], // Titan models don't support tool calling
		};
	}

	private parseAI21Response(response: AI21Response): { textContent: string; toolCalls: any[] } {
		const textContent = response.choices.map(choice => choice.message.content).join('');
		return {
			textContent,
			toolCalls: [], // AI21 models don't support tool calling in this implementation
		};
	}

	private parseDeepSeekResponse(response: DeepSeekResponse): { textContent: string; toolCalls: any[] } {
		const textContent = response.choices.map(choice => choice.text).join('');
		return {
			textContent,
			toolCalls: [], // DeepSeek models don't support tool calling
		};
	}

	private buildAnthropicRequest(messages: any[], systemPrompt?: string, formattedTools?: any[]): AnthropicRequest {
		// Filter out system messages as they're handled separately in Bedrock
		const bedrockMessages = messages.filter((msg: any) => msg.role !== 'system');

		const request: AnthropicRequest = {
			messages: bedrockMessages,
			anthropic_version: 'bedrock-2023-05-31',
			max_tokens: 4096,
			temperature: 0.7,
			...(systemPrompt && { system: systemPrompt }),
		};

		if (formattedTools && formattedTools.length > 0) {
			request.tools = formattedTools;
		}

		return request;
	}

	private buildLlamaRequest(messages: any[], systemPrompt?: string): LlamaRequest {
		// Convert messages to Llama prompt format according to AWS Bedrock documentation
		let prompt = '<|begin_of_text|>';
		
		if (systemPrompt) {
			prompt += `<|start_header_id|>system<|end_header_id|> ${systemPrompt} <|eot_id|>`;
		}

		for (const message of messages) {
			if (message.role === 'system') continue; // Already handled above
			
			const role = message.role === 'assistant' ? 'assistant' : 'user';
			const content = Array.isArray(message.content) 
				? message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
				: message.content;
			
			prompt += `<|start_header_id|>${role}<|end_header_id|> ${content} <|eot_id|>`;
		}

		prompt += '<|start_header_id|>assistant<|end_header_id|>';

		return {
			prompt,
			max_gen_len: 512,
			temperature: 0.5,
			top_p: 0.9,
		};
	}

	private buildTitanRequest(messages: any[], systemPrompt?: string): TitanRequest {
		// Convert messages to Titan format according to AWS Bedrock documentation
		let inputText = '';
		
		if (systemPrompt) {
			inputText += `${systemPrompt}\n\n`;
		}

		for (const message of messages) {
			if (message.role === 'system') continue; // Already handled above
			
			const role = message.role === 'assistant' ? 'Bot' : 'User';
			const content = Array.isArray(message.content) 
				? message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
				: message.content;
			
			inputText += `${role}: ${content}\n`;
		}

		inputText += 'Bot:';

		return {
			inputText,
			textGenerationConfig: {
				maxTokenCount: 512,
				temperature: 0.7,
				topP: 0.9,
				stopSequences: [],
			},
		};
	}

	private buildAI21Request(messages: any[], systemPrompt?: string): AI21Request {
		const ai21Messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

		if (systemPrompt) {
			ai21Messages.push({ role: 'system', content: systemPrompt });
		}

		for (const message of messages) {
			if (message.role === 'system' && systemPrompt) continue; // Already added above
			
			const content = Array.isArray(message.content) 
				? message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
				: message.content;
			
			ai21Messages.push({
				role: message.role as 'user' | 'assistant' | 'system',
				content,
			});
		}

		return {
			messages: ai21Messages,
			temperature: 1.0,
			top_p: 1.0,
			max_tokens: 4096,
			frequency_penalty: 0,
			presence_penalty: 0,
		};
	}

	private buildDeepSeekRequest(messages: any[], systemPrompt?: string): DeepSeekRequest {
		// Convert messages to DeepSeek R1 prompt format according to AWS Bedrock documentation
		let prompt = '<｜begin▁of▁sentence｜>';
		
		// Handle system prompt by incorporating it into the first user message
		let firstUserMessage = true;
		
		for (const message of messages) {
			if (message.role === 'system') continue; // System prompt handled separately
			
			const content = Array.isArray(message.content) 
				? message.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
				: message.content;
			
			if (message.role === 'user') {
				let userContent = content;
				if (firstUserMessage && systemPrompt) {
					userContent = `${systemPrompt}\n\n${content}`;
					firstUserMessage = false;
				}
				prompt += '<｜User｜>' + userContent;
			} else if (message.role === 'assistant') {
				prompt += '<｜Assistant｜>' + content;
			}
		}

		prompt += '<｜Assistant｜><think>\n';

		return {
			prompt,
			temperature: 0.5,
			top_p: 0.9,
			max_tokens: 512,
		};
	}

	private supportsToolCalling(): boolean {
		// Currently support tool calling for these model families
		// Note: We can extend this as we implement tool calling for more families
		return [
			ModelFamily.ANTHROPIC,
			ModelFamily.META_LLAMA,
			ModelFamily.DEEPSEEK,
			// Add more families as we implement support
		].includes(this.modelFamily);
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
