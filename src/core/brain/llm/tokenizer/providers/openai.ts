import {
	ITokenizer,
	TokenizerConfig,
	TokenCountResult,
	EnhancedInternalMessage,
} from '../types.js';
import {
	estimateTokenCount,
	estimateMessageTokens,
	createTokenCountResult,
	getModelTokenLimit,
	messageContentToString,
} from '../utils.js';

/**
 * OpenAI tokenizer implementation
 * Uses tiktoken when available, falls back to approximation
 */
export class OpenAITokenizer implements ITokenizer {
	private config: TokenizerConfig;
	private tiktoken: any = null;
	private encoder: any = null;

	constructor(config: TokenizerConfig) {
		this.config = config;
		this.initializeTiktoken();
	}

	private async initializeTiktoken(): Promise<void> {
		if (!this.config.hybridTracking) {
			return; // Skip tiktoken initialization if hybrid tracking is disabled
		}

		try {
			// Try to dynamically import tiktoken - using dynamic import to avoid compile-time dependency
			const tiktokenModule = await Function('return import("tiktoken")')().catch(() => null);

			if (tiktokenModule) {
				this.tiktoken = tiktokenModule;
				const model = this.config.model || 'gpt-3.5-turbo';

				// Get encoding for the specific model
				try {
					this.encoder = this.tiktoken.encodingForModel(model);
				} catch (error) {
					// Fallback to cl100k_base encoding for unknown models
					this.encoder = this.tiktoken.getEncoding('cl100k_base');
				}
			}
		} catch (error) {
			// Tiktoken not available, will use approximation
			this.tiktoken = null;
			this.encoder = null;
		}
	}

	async countTokens(text: string): Promise<TokenCountResult> {
		if (this.encoder && this.config.hybridTracking) {
			try {
				const tokens = this.encoder.encode(text);
				return createTokenCountResult(
					tokens.length,
					false,
					this.config.provider,
					this.config.model
				);
			} catch (error) {
				// Fall back to approximation
				if (this.config.fallbackToApproximation) {
					const count = estimateTokenCount(text);
					return createTokenCountResult(count, true, this.config.provider, this.config.model);
				}
				throw new Error(
					`Failed to count tokens: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		// Use approximation
		const count = estimateTokenCount(text);
		return createTokenCountResult(count, true, this.config.provider, this.config.model);
	}

	async countMessageTokens(message: EnhancedInternalMessage): Promise<TokenCountResult> {
		if (this.encoder && this.config.hybridTracking) {
			try {
				let totalTokens = 0;

				// Message overhead (from OpenAI's token counting documentation)
				totalTokens += 3; // Every message follows <|start|>{role/name}\n{content}<|end|>\n

				// Role tokens
				totalTokens += (await this.countTokens(message.role)).count;

				// Content tokens
				const contentStr = messageContentToString(message.content);
				totalTokens += (await this.countTokens(contentStr)).count;

				// Handle images in content
				if (Array.isArray(message.content)) {
					const imageCount = message.content.filter(
						part =>
							typeof part === 'object' && part !== null && 'type' in part && part.type === 'image'
					).length;

					// OpenAI vision models use ~85-170 tokens per image
					totalTokens += imageCount * 85;
				}

				// Tool calls
				if (message.toolCalls && message.toolCalls.length > 0) {
					for (const toolCall of message.toolCalls) {
						totalTokens += (await this.countTokens(toolCall.function.name)).count;
						totalTokens += (await this.countTokens(toolCall.function.arguments)).count;
						totalTokens += 3; // Tool call overhead
					}
				}

				// Tool response
				if (message.toolCallId && message.name) {
					totalTokens += (await this.countTokens(message.name)).count;
					totalTokens += 2; // Tool response overhead
				}

				return createTokenCountResult(totalTokens, false, this.config.provider, this.config.model);
			} catch (error) {
				// Fall back to approximation
				if (this.config.fallbackToApproximation) {
					const count = estimateMessageTokens(message);
					return createTokenCountResult(count, true, this.config.provider, this.config.model);
				}
				throw error;
			}
		}

		// Use approximation
		const count = estimateMessageTokens(message);
		return createTokenCountResult(count, true, this.config.provider, this.config.model);
	}

	async countMessagesTokens(messages: EnhancedInternalMessage[]): Promise<TokenCountResult> {
		let totalTokens = 0;
		let allAccurate = this.encoder && this.config.hybridTracking;

		for (const message of messages) {
			const result = await this.countMessageTokens(message);
			totalTokens += result.count;
			if (result.estimated) {
				allAccurate = false;
			}
		}

		// Additional tokens for conversation structure
		if (messages.length > 0) {
			totalTokens += 3; // Conversation structure overhead
		}

		return createTokenCountResult(
			totalTokens,
			!allAccurate,
			this.config.provider,
			this.config.model
		);
	}

	getMaxTokens(): number {
		return getModelTokenLimit(this.config.provider, this.config.model);
	}

	getProviderInfo() {
		return {
			provider: this.config.provider,
			model: this.config.model || undefined,
			supportsAccurateCounting: !!this.encoder,
		};
	}
}
