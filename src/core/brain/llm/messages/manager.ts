import { IMessageFormatter } from './formatters/types.js';
import { logger } from '../../../logger/index.js';
import { InternalMessage, ImageData } from './types.js';
import { getImageData } from './utils.js';
import { PromptManager } from '../../../brain/systemPrompt/manager.js';
import {
	ITokenizer,
	EnhancedInternalMessage,
	createTokenizerFromProvider,
} from '../tokenizer/index.js';
import {
	ICompressionStrategy,
	CompressionResult,
	createDefaultCompressionStrategy,
	getCompressionLevel,
} from '../compression/index.js';

export interface ContextManagerConfig {
	enableTokenManagement?: boolean;
	maxTokens?: number;
	warningThreshold?: number;
	compressionThreshold?: number;
	compressionStrategy?: 'middle-removal' | 'oldest-removal' | 'hybrid';
}

export class ContextManager {
	private promptManager: PromptManager;
	private formatter: IMessageFormatter;
	private messages: EnhancedInternalMessage[] = [];
	private tokenizer?: ITokenizer;
	private compressionStrategy?: ICompressionStrategy;
	private config: ContextManagerConfig;
	private compressionHistory: CompressionResult[] = [];

	constructor(
		formatter: IMessageFormatter,
		promptManager: PromptManager,
		config: ContextManagerConfig = {}
	) {
		if (!formatter) throw new Error('formatter is required');
		this.formatter = formatter;
		this.promptManager = promptManager;
		this.config = {
			enableTokenManagement: true,
			maxTokens: 8192,
			warningThreshold: 0.8,
			compressionThreshold: 0.9,
			compressionStrategy: 'hybrid',
			...config,
		};
		logger.debug('ContextManager initialized with formatter', { formatter, config: this.config });
	}

	/**
	 * Initialize token management with provider information
	 */
	async initializeTokenManagement(provider: string, model?: string): Promise<void> {
		if (!this.config.enableTokenManagement) {
			logger.debug('Token management disabled');
			return;
		}

		try {
			this.tokenizer = createTokenizerFromProvider(provider, model);
			this.config.maxTokens = this.tokenizer.getMaxTokens();

			this.compressionStrategy = createDefaultCompressionStrategy(this.config.maxTokens!, {
				strategy: this.config.compressionStrategy ?? 'hybrid',
				warningThreshold: this.config.warningThreshold as number,
				...(this.config.compressionThreshold !== undefined && {
					compressionThreshold: this.config.compressionThreshold,
				}),
			});

			logger.debug('Token management initialized', {
				provider,
				model,
				maxTokens: this.config.maxTokens,
				tokenizerInfo: this.tokenizer.getProviderInfo(),
			});
		} catch (error) {
			logger.warn('Failed to initialize token management', { error });
			this.config.enableTokenManagement = false;
		}
	}

	async getSystemPrompt(): Promise<string> {
		// Use the complete system prompt that includes both user instruction and built-in tool instructions
		const prompt = await this.promptManager.getCompleteSystemPrompt();
		logger.debug(`[SystemPrompt] Built complete system prompt:\n${prompt}`);
		return prompt;
	}

	/**
	 * Add a message to the context
	 * @param message - The message to add to the context
	 */
	async addMessage(message: InternalMessage): Promise<void> {
		if (!message.role) {
			throw new Error('Role is required for a message');
		}

		// Validate message content based on role
		switch (message.role) {
			case 'user':
				if (
					!(Array.isArray(message.content) && message.content.length > 0) &&
					(typeof message.content !== 'string' || message.content.trim() === '')
				) {
					throw new Error(
						'User message content should be a non-empty string or a non-empty array of parts.'
					);
				}
				break;
			case 'assistant':
				if (message.content === null && (!message.toolCalls || message.toolCalls.length === 0)) {
					throw new Error('Assistant message must have content or toolCalls.');
				}
				if (message.toolCalls) {
					if (
						!Array.isArray(message.toolCalls) ||
						message.toolCalls.some(tc => !tc.id || !tc.function?.name || !tc.function?.arguments)
					) {
						throw new Error('Invalid toolCalls structure in assistant message.');
					}
				}
				break;
			case 'tool':
				if (!message.toolCallId || !message.name || message.content === null) {
					throw new Error('Tool message missing required fields (toolCallId, name, content).');
				}
				break;
			case 'system':
				if (typeof message.content !== 'string' || message.content.trim() === '') {
					throw new Error('System message content must be a non-empty string.');
				}
				break;
			default:
				throw new Error(`Unknown message role: ${(message as any).role}`);
		}

		// Create enhanced message with token counting
		const enhancedMessage: EnhancedInternalMessage = {
			...message,
			timestamp: Date.now(),
			priority: 'normal', // Default priority
		};

		// Count tokens if tokenizer is available
		if (this.tokenizer && this.config.enableTokenManagement) {
			try {
				const tokenResult = await this.tokenizer.countMessageTokens(enhancedMessage);
				enhancedMessage.tokenCount = tokenResult.count;
				logger.debug('Message tokens counted', {
					tokens: tokenResult.count,
					estimated: tokenResult.estimated,
				});
			} catch (error) {
				logger.warn('Failed to count message tokens', { error });
			}
		}

		// Store the message in history
		this.messages.push(enhancedMessage);
		logger.debug(`Adding message to context: ${JSON.stringify(enhancedMessage, null, 2)}`);
		logger.debug(`Total messages in context: ${this.messages.length}`);

		// Check if compression is needed
		await this.checkAndCompress();
	}

	/**
	 * Check if compression is needed and perform it if necessary
	 */
	private async checkAndCompress(): Promise<void> {
		if (!this.config.enableTokenManagement || !this.tokenizer || !this.compressionStrategy) {
			return;
		}

		try {
			// Calculate current token usage
			const tokenResult = await this.tokenizer.countMessagesTokens(this.messages);
			const currentTokens = tokenResult.count;
			const maxTokens = this.config.maxTokens!;

			// Get compression level
			const compressionLevel = getCompressionLevel(
				currentTokens,
				maxTokens,
				this.config.warningThreshold!,
				this.config.compressionThreshold!
			);

			logger.debug('Token usage check', {
				currentTokens,
				maxTokens,
				ratio: currentTokens / maxTokens,
				compressionLevel,
			});

			// Log warning at warning threshold
			if (compressionLevel === 'warning') {
				logger.warn('Approaching token limit', {
					currentTokens,
					maxTokens,
					ratio: currentTokens / maxTokens,
				});
			}

			// Perform compression if needed
			if (
				this.compressionStrategy.shouldCompress(
					currentTokens,
					maxTokens,
					this.compressionStrategy.getConfig()
				)
			) {
				logger.info('Starting proactive compression', {
					currentTokens,
					maxTokens,
					compressionLevel,
				});

				// Calculate target token count (aim for 70% of max to provide buffer)
				const targetTokens = Math.floor(maxTokens * 0.7);

				const compressionResult = await this.compressionStrategy.compress(this.messages, {
					currentTokenCount: currentTokens,
					maxTokens,
					targetTokenCount: targetTokens,
					preserveCritical: true,
					compressionLevel: compressionLevel as any,
				});

				// Store compression history for debugging
				this.compressionHistory.push(compressionResult);

				logger.info('Compression completed', {
					...compressionResult,
					newTokenCount: await this.getCurrentTokenCount(),
				});
			}
		} catch (error) {
			logger.error('Failed to check and compress messages', { error });
		}
	}

	/**
	 * Get current token count
	 */
	async getCurrentTokenCount(): Promise<number> {
		if (!this.tokenizer) {
			return 0;
		}

		try {
			const result = await this.tokenizer.countMessagesTokens(this.messages);
			return result.count;
		} catch (error) {
			logger.warn('Failed to get current token count', { error });
			return 0;
		}
	}

	/**
	 * Add a user message to the context
	 * @param textContent - The text content of the message
	 * @param imageData - The image data to add to the message
	 */
	async addUserMessage(textContent: string, imageData?: ImageData): Promise<void> {
		if (typeof textContent !== 'string' || textContent.trim() === '') {
			throw new Error('Content must be a non-empty string.');
		}
		const messageParts: InternalMessage['content'] = imageData
			? [
					{ type: 'text', text: textContent },
					{
						type: 'image',
						image: imageData.image,
						mimeType: imageData.mimeType || 'image/jpeg',
					},
				]
			: [{ type: 'text', text: textContent }];
		logger.debug(`Adding user message: ${JSON.stringify(messageParts, null, 2)}`);
		await this.addMessage({ role: 'user', content: messageParts });
	}

	/**
	 * Add an assistant message to the context
	 * @param content - The content of the message
	 * @param toolCalls - The tool calls to add to the message
	 */
	async addAssistantMessage(
		content: string | null,
		toolCalls?: InternalMessage['toolCalls']
	): Promise<void> {
		// Validate that either content or toolCalls is provided
		if (content === null && (!toolCalls || toolCalls.length === 0)) {
			throw new Error('Must provide content or toolCalls.');
		}
		await this.addMessage({
			role: 'assistant' as const,
			content,
			...(toolCalls && toolCalls.length > 0 && { toolCalls }),
		});
	}

	/**
	 * Add a tool result to the context
	 * @param toolCallId - The ID of the tool call
	 * @param name - The name of the tool
	 * @param result - The result of the tool call
	 */
	async addToolResult(toolCallId: string, name: string, result: any): Promise<void> {
		if (!toolCallId || !name) {
			throw new Error('addToolResult: toolCallId and name are required.');
		}

		// Simplest image detection: if result has an 'image' field, treat as ImagePart
		let content: InternalMessage['content'];
		if (result && typeof result === 'object' && 'image' in result) {
			// Use shared helper to get base64/URL
			const imagePart = result as {
				image: string | Uint8Array | Buffer | ArrayBuffer | URL;
				mimeType?: string;
			};
			content = [
				{
					type: 'image',
					image: getImageData(imagePart),
					mimeType: imagePart.mimeType || 'image/jpeg',
				},
			];
		} else if (typeof result === 'string') {
			content = result;
		} else if (Array.isArray(result)) {
			// Assume array of parts already
			content = result;
		} else {
			// Fallback: stringify all other values
			content = JSON.stringify(result ?? '');
		}

		await this.addMessage({ role: 'tool', content, toolCallId, name });
	}

	/**
	 * Get formatted messages including conversation history
	 * @param message - The current message (already added to context by the service)
	 * @returns The formatted messages array including conversation history
	 */
	async getFormattedMessage(_message: InternalMessage): Promise<any[]> {
		try {
			// Don't add the message again - it's already been added by the service
			// Just return all formatted messages from the existing conversation history
			return this.getAllFormattedMessages();
		} catch (error) {
			logger.error('Failed to get formatted messages', { error });
			throw new Error(
				`Failed to format message: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Get all formatted messages from conversation history
	 * @returns The formatted messages array
	 */
	async getAllFormattedMessages(): Promise<any[]> {
		try {
			// Get the system prompt
			const prompt = await this.getSystemPrompt();

			// Format all messages in conversation history
			const formattedMessages: any[] = [];

			// Add system prompt as first message - for both OpenAI and Anthropic
			if (prompt) {
				formattedMessages.push({ role: 'system', content: prompt });
			}

			// Format each message in history
			for (const msg of this.messages) {
				// Don't pass system prompt to individual message formatting
				// The system prompt has already been added above
				const formatted = this.formatter.format(msg, null);
				if (Array.isArray(formatted)) {
					formattedMessages.push(...formatted);
				} else if (formatted && formatted !== null) {
					formattedMessages.push(formatted);
				}
			}

			logger.debug(
				`Formatted ${formattedMessages.length} messages from history of ${this.messages.length} messages`
			);
			return formattedMessages;
		} catch (error) {
			logger.error('Failed to format all messages', { error });
			throw new Error(
				`Failed to format messages: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Process a stream response from the LLM
	 * @param response - The stream response from the LLM
	 */

	async processLLMStreamResponse(response: any): Promise<void> {
		if (this.formatter.parseStreamResponse) {
			const msgs = (await this.formatter.parseStreamResponse(response)) ?? [];
			for (const msg of msgs) {
				try {
					await this.addMessage(msg);
				} catch (error) {
					logger.error('Failed to process LLM stream response message', { error });
				}
			}
		} else {
			await this.processLLMResponse(response);
		}
	}

	/**
	 * Process a response from the LLM
	 * @param response - The response from the LLM
	 */

	async processLLMResponse(response: any): Promise<void> {
		const msgs = this.formatter.parseResponse(response) ?? [];
		for (const msg of msgs) {
			try {
				await this.addMessage(msg);
			} catch (error) {
				logger.error('Failed to process LLM response message', { error });
			}
		}
	}

	/**
	 * Get the raw messages array (for inspection, debugging, or deduplication)
	 */
	public getRawMessages(): EnhancedInternalMessage[] {
		return this.messages;
	}

	/**
	 * Get compression history for debugging
	 */
	public getCompressionHistory(): CompressionResult[] {
		return this.compressionHistory;
	}

	/**
	 * Get token management statistics
	 */
	public async getTokenStats(): Promise<{
		currentTokens: number;
		maxTokens: number;
		utilizationRatio: number;
		compressionLevel: string;
		messageCount: number;
		tokenizerInfo?: any;
	} | null> {
		if (!this.config.enableTokenManagement || !this.tokenizer) {
			return null;
		}

		const currentTokens = await this.getCurrentTokenCount();
		const maxTokens = this.config.maxTokens!;
		const compressionLevel = getCompressionLevel(
			currentTokens,
			maxTokens,
			this.config.warningThreshold!,
			this.config.compressionThreshold!
		);

		return {
			currentTokens,
			maxTokens,
			utilizationRatio: currentTokens / maxTokens,
			compressionLevel,
			messageCount: this.messages.length,
			tokenizerInfo: this.tokenizer.getProviderInfo(),
		};
	}

	/**
	 * Force compression manually (for testing or emergency situations)
	 */
	public async forceCompression(targetRatio: number = 0.7): Promise<CompressionResult | null> {
		if (!this.config.enableTokenManagement || !this.compressionStrategy || !this.tokenizer) {
			return null;
		}

		const currentTokens = await this.getCurrentTokenCount();
		const maxTokens = this.config.maxTokens!;
		const targetTokens = Math.floor(maxTokens * targetRatio);

		logger.info('Forcing compression', { currentTokens, targetTokens });

		const result = await this.compressionStrategy.compress(this.messages, {
			currentTokenCount: currentTokens,
			maxTokens,
			targetTokenCount: targetTokens,
			preserveCritical: true,
			compressionLevel: 'hard',
		});

		this.compressionHistory.push(result);
		return result;
	}

	/**
	 * Add a message with enhanced options
	 */
	async addEnhancedMessage(
		message: InternalMessage,
		options: {
			priority?: 'critical' | 'high' | 'normal' | 'low';
			preserveInCompression?: boolean;
		} = {}
	): Promise<void> {
		// Validate the base message first
		if (!message.role) {
			throw new Error('Role is required for a message');
		}

		// Validate message content based on role (same validation as addMessage)
		switch (message.role) {
			case 'user':
				if (
					!(Array.isArray(message.content) && message.content.length > 0) &&
					(typeof message.content !== 'string' || message.content.trim() === '')
				) {
					throw new Error(
						'User message content should be a non-empty string or a non-empty array of parts.'
					);
				}
				break;
			case 'assistant':
				if (message.content === null && (!message.toolCalls || message.toolCalls.length === 0)) {
					throw new Error('Assistant message must have content or toolCalls.');
				}
				if (message.toolCalls) {
					if (
						!Array.isArray(message.toolCalls) ||
						message.toolCalls.some(tc => !tc.id || !tc.function?.name || !tc.function?.arguments)
					) {
						throw new Error('Invalid toolCalls structure in assistant message.');
					}
				}
				break;
			case 'tool':
				if (!message.toolCallId || !message.name || message.content === null) {
					throw new Error('Tool message missing required fields (toolCallId, name, content).');
				}
				break;
			case 'system':
				if (typeof message.content !== 'string' || message.content.trim() === '') {
					throw new Error('System message content must be a non-empty string.');
				}
				break;
			default:
				throw new Error(`Unknown message role: ${(message as any).role}`);
		}

		// Create enhanced message with options
		const enhancedMessage: EnhancedInternalMessage = {
			...message,
			...options,
			timestamp: Date.now(),
		};

		// Count tokens if tokenizer is available
		if (this.tokenizer && this.config.enableTokenManagement) {
			try {
				const tokenResult = await this.tokenizer.countMessageTokens(enhancedMessage);
				enhancedMessage.tokenCount = tokenResult.count;
				logger.debug('Enhanced message tokens counted', {
					tokens: tokenResult.count,
					estimated: tokenResult.estimated,
					priority: options.priority,
				});
			} catch (error) {
				logger.warn('Failed to count enhanced message tokens', { error });
			}
		}

		// Store the enhanced message in history
		this.messages.push(enhancedMessage);
		logger.debug(`Adding enhanced message to context: ${JSON.stringify(enhancedMessage, null, 2)}`);
		logger.debug(`Total messages in context: ${this.messages.length}`);

		// Check if compression is needed
		await this.checkAndCompress();
	}
}
