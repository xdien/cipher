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
} from '../utils.js';

/**
 * Anthropic tokenizer implementation
 * Uses character-based approximation (4 chars per token)
 * Anthropic doesn't provide a public tokenizer library
 */
export class AnthropicTokenizer implements ITokenizer {
	private config: TokenizerConfig;

	constructor(config: TokenizerConfig) {
		this.config = config;
	}

	async countTokens(text: string): Promise<TokenCountResult> {
		const count = estimateTokenCount(text);
		return createTokenCountResult(count, true, this.config.provider, this.config.model);
	}

	async countMessageTokens(message: EnhancedInternalMessage): Promise<TokenCountResult> {
		const count = estimateMessageTokens(message);
		return createTokenCountResult(count, true, this.config.provider, this.config.model);
	}

	async countMessagesTokens(messages: EnhancedInternalMessage[]): Promise<TokenCountResult> {
		let totalTokens = 0;

		for (const message of messages) {
			const result = await this.countMessageTokens(message);
			totalTokens += result.count;
		}

		return createTokenCountResult(totalTokens, true, this.config.provider, this.config.model);
	}

	getMaxTokens(): number {
		return getModelTokenLimit(this.config.provider, this.config.model);
	}

	getProviderInfo() {
		return {
			provider: this.config.provider,
			model: this.config.model || undefined,
			supportsAccurateCounting: false,
		};
	}
}
