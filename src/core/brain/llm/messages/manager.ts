import { IMessageFormatter } from './formatters/types.js';
import { logger } from '../../../logger/index.js';
import { InternalMessage, ImageData } from './types.js';
import { getImageData } from './utils.js';
import { PromptManager } from '../../../brain/systemPrompt/manager.js';
import { ITokenizer, createTokenizer, getTokenizerConfigForModel } from '../tokenizer/index.js';
import {
	ICompressionStrategy,
	createCompressionStrategy,
	getCompressionConfigForProvider,
	EnhancedInternalMessage,
	CompressionResult,
	CompressionLevel,
} from '../compression/index.js';
import { assignMessagePriorities } from '../compression/utils.js';

export class ContextManager {
	private promptManager: PromptManager;
	private formatter: IMessageFormatter;
	private messages: InternalMessage[] = [];

	// Token-aware compression components
	private tokenizer?: ITokenizer;
	private compressionStrategy?: ICompressionStrategy;
	private enableCompression: boolean = false;

	// Token tracking
	private currentTokenCount: number = 0;
	private compressionHistory: CompressionResult[] = [];
	private lastCompressionCheck: number = 0;

	// Configuration
	private compressionConfig = {
		checkInterval: 5000, // Check every 5 seconds
		maxCompressionHistory: 10,
	};

	constructor(formatter: IMessageFormatter, promptManager: PromptManager) {
		if (!formatter) throw new Error('formatter is required');
		this.formatter = formatter;
		this.promptManager = promptManager;
		logger.debug('ContextManager initialized with formatter', { formatter });
	}

	async getSystemPrompt(): Promise<string> {
		// Use the complete system prompt that includes both user instruction and built-in tool instructions
		const prompt = await this.promptManager.getCompleteSystemPrompt();
		logger.debug(`[SystemPrompt] Built complete system prompt:\n${prompt}`);
		return prompt;
	}

	/**
	 * Add a message to the context
	 */
	async addMessage(message: InternalMessage): Promise<void> {
		if (!message.role) {
			throw new Error('Role is required for a message');
		}
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

		this.messages.push(message);
		logger.debug(`Adding message to context: ${JSON.stringify(message, null, 2)}`);
		logger.debug(`Total messages in context: ${this.messages.length}`);

		if (this.enableCompression) {
			await this.updateTokenCount();
			await this.checkAndCompress();
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
			// For objects or other types, JSON stringify for now
			content = JSON.stringify(result, null, 2);
		}

		await this.addMessage({
			role: 'tool',
			content,
			toolCallId,
			name,
		});
	}

	async getFormattedMessage(_message: InternalMessage): Promise<any[]> {
		try {
			return this.getAllFormattedMessages();
		} catch (error) {
			logger.error('Failed to get formatted messages', { error });
			throw new Error(
				`Failed to format message: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	async getAllFormattedMessages(): Promise<any[]> {
		try {
			const prompt = await this.getSystemPrompt();
			const formattedMessages: any[] = [];
			if (prompt) {
				formattedMessages.push({ role: 'system', content: prompt });
			}
			for (const msg of this.messages) {
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

	public async restoreHistory(): Promise<void> {
		logger.debug(
			`ContextManager: restoreHistory called, in-memory messages: ${this.messages.length}`
		);
	}

	/**
	 * Get the raw messages array (for inspection, debugging, or deduplication)
	 */
	public getRawMessages(): InternalMessage[] {
		return this.messages;
	}

	/**
	 * Configure token-aware compression for this context
	 * @param provider - The LLM provider (openai, anthropic, google)
	 * @param model - The specific model being used
	 * @param contextWindow - The model's context window size
	 */
	async configureCompression(
		provider: string,
		model?: string,
		contextWindow?: number
	): Promise<void> {
		try {
			// Initialize tokenizer
			const tokenizerConfig = getTokenizerConfigForModel(model || `${provider}-default`);
			this.tokenizer = createTokenizer(tokenizerConfig);

			// Initialize compression strategy
			const compressionConfig = getCompressionConfigForProvider(provider, model, contextWindow);
			this.compressionStrategy = createCompressionStrategy(compressionConfig);

			this.enableCompression = true;

			// Recalculate current token count with new tokenizer
			await this.updateTokenCount();

			logger.debug('Token-aware compression configured', {
				provider,
				model,
				contextWindow,
				tokenizerProvider: this.tokenizer.provider,
				compressionStrategy: this.compressionStrategy.name,
				currentTokens: this.currentTokenCount,
			});
		} catch (error) {
			logger.error('Failed to configure compression', { error, provider, model });
			this.enableCompression = false;
		}
	}

	/**
	 * Update the current token count cho toàn bộ messages
	 */
	private async updateTokenCount(): Promise<void> {
		if (!this.tokenizer || this.messages.length === 0) {
			this.currentTokenCount = 0;
			logger.debug('[TokenAware] Token count reset to 0 (no messages or tokenizer)');
			return;
		}
		try {
			const messageTokenCounts = await Promise.all(
				this.messages.map(async (message, index) => {
					const textContent = this.extractTextFromMessage(message);
					const tokenCount = await this.tokenizer!.countTokens(textContent);
					if ('tokenCount' in message) {
						(message as any).tokenCount = tokenCount.total;
					}
					return tokenCount.total;
				})
			);
			this.currentTokenCount = messageTokenCounts.reduce((sum, count) => sum + count, 0);
			logger.info(
				`[TokenAware] Token count updated: ${this.currentTokenCount} tokens for ${this.messages.length} messages`
			);
		} catch (error) {
			logger.error('[TokenAware] Failed to update token count', { error });
		}
	}

	/**
	 * Extract text content from a message for token counting
	 */
	private extractTextFromMessage(message: InternalMessage): string {
		if (typeof message.content === 'string') {
			return message.content;
		}

		if (Array.isArray(message.content)) {
			return message.content
				.filter(part => part.type === 'text')
				.map(part => part.text)
				.join(' ');
		}

		return '';
	}

	private async checkAndCompress(): Promise<void> {
		if (!this.enableCompression || !this.compressionStrategy || !this.tokenizer) {
			return;
		}
		const now = Date.now();
		if (now - this.lastCompressionCheck < this.compressionConfig.checkInterval) {
			return;
		}
		this.lastCompressionCheck = now;
		const utilization = this.currentTokenCount / (this.compressionStrategy.config.maxTokens || 1);
		if (
			utilization >= this.compressionStrategy.config.warningThreshold &&
			utilization < this.compressionStrategy.config.compressionThreshold
		) {
			logger.warn(
				`[TokenAware] Token usage warning: ${Math.round(utilization * 100)}% of context window (${this.currentTokenCount}/${this.compressionStrategy.config.maxTokens})`
			);
		}
		if (!this.compressionStrategy.shouldCompress(this.currentTokenCount)) {
			return;
		}
		logger.info(
			`[TokenAware] Compression threshold reached (${Math.round(utilization * 100)}%), starting compression...`
		);
		await this.performCompression();
	}

	private async performCompression(): Promise<void> {
		if (!this.compressionStrategy || !this.tokenizer) {
			return;
		}
		try {
			// Convert messages to enhanced format
			const enhancedMessages: EnhancedInternalMessage[] = this.messages.map((message, index) => ({
				...message,
				messageId: `msg_${Date.now()}_${index}`,
				timestamp: Date.now() - (this.messages.length - index) * 1000, // Approximate timestamps
				tokenCount: this.extractTextFromMessage(message).length / 4, // Rough estimate
			}));

			// Add priorities
			const prioritizedMessages = assignMessagePriorities(enhancedMessages);

			// Calculate target token count (aim for 80% of max)
			const targetTokenCount = Math.floor(this.compressionStrategy.config.maxTokens * 0.8);

			// Perform compression
			const compressionResult = await this.compressionStrategy.compress(
				prioritizedMessages,
				this.currentTokenCount,
				targetTokenCount
			);

			// Validate compression result
			if (!this.compressionStrategy.validateCompression(compressionResult)) {
				logger.warn('[TokenAware] Compression validation failed, keeping original messages');
				return;
			}

			// Apply compression result
			this.messages = compressionResult.compressedMessages.map(msg => {
				// Convert back to InternalMessage format
				const {
					messageId,
					timestamp,
					tokenCount,
					priority,
					preserveInCompression,
					...internalMessage
				} = msg;
				return internalMessage;
			});

			// Update token count
			await this.updateTokenCount();

			// Store compression history
			this.compressionHistory.push(compressionResult);
			if (this.compressionHistory.length > this.compressionConfig.maxCompressionHistory) {
				this.compressionHistory.shift();
			}

			logger.info(
				`[TokenAware] Compression completed: ${compressionResult.originalTokenCount} → ${compressionResult.compressedTokenCount} tokens, strategy: ${compressionResult.strategy}, messages removed: ${compressionResult.removedMessages.length}`
			);
		} catch (error) {
			logger.error('[TokenAware] Compression failed', { error });
		}
	}

	/**
	 * Get current compression level
	 */
	public getCompressionLevel(): CompressionLevel {
		if (!this.compressionStrategy) {
			return CompressionLevel.NONE;
		}

		return this.compressionStrategy.getCompressionLevel(this.currentTokenCount);
	}

	/**
	 * Get token usage statistics
	 */
	public getTokenStats(): {
		currentTokens: number;
		maxTokens: number;
		utilization: number;
		compressionLevel: CompressionLevel;
		compressionHistory: number;
	} {
		const maxTokens = this.compressionStrategy?.config.maxTokens || 0;
		return {
			currentTokens: this.currentTokenCount,
			maxTokens,
			utilization: maxTokens > 0 ? this.currentTokenCount / maxTokens : 0,
			compressionLevel: this.getCompressionLevel(),
			compressionHistory: this.compressionHistory.length,
		};
	}

	/**
	 * Force compression (for testing or manual control)
	 */
	public async forceCompression(): Promise<CompressionResult | null> {
		if (!this.enableCompression || !this.compressionStrategy) {
			throw new Error('Compression not configured');
		}

		await this.performCompression();
		return this.compressionHistory[this.compressionHistory.length - 1] || null;
	}
}
