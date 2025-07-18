import { ITokenizer, TokenizerConfig, TokenizerConfigSchema } from './types.js';
import { OpenAITokenizer } from './providers/openai.js';
import { AnthropicTokenizer } from './providers/anthropic.js';
import { GoogleTokenizer } from './providers/google.js';
import { DefaultTokenizer } from './providers/default.js';
import { logger } from '../../../logger/index.js';

/**
 * Create a tokenizer instance based on configuration
 */
export function createTokenizer(config: TokenizerConfig): ITokenizer {
	// Validate configuration
	const validatedConfig = TokenizerConfigSchema.parse(config);
	const model = validatedConfig.model ?? 'gpt-3.5-turbo';
	logger.debug('Creating tokenizer', {
		provider: validatedConfig.provider,
		model: validatedConfig.model,
	});

	switch (validatedConfig.provider ?? 'default') {
		case 'openai':
			return new OpenAITokenizer(validatedConfig);

		case 'anthropic':
			return new AnthropicTokenizer(validatedConfig);

		case 'google':
			return new GoogleTokenizer(validatedConfig);

		case 'default':
		default:
			return new DefaultTokenizer(validatedConfig);
	}
}

/**
 * Create a tokenizer from LLM provider configuration
 */
export function createTokenizerFromProvider(
	provider: string,
	model?: string,
	options?: Partial<TokenizerConfig>
): ITokenizer {
	const providerLower = provider.toLowerCase();

	// Map LLM providers to tokenizer providers
	let tokenizerProvider: TokenizerConfig['provider'];

	switch (providerLower) {
		case 'openai':
		case 'openrouter': // OpenRouter uses OpenAI-compatible models
			tokenizerProvider = 'openai';
			break;

		case 'anthropic':
			tokenizerProvider = 'anthropic';
			break;

		case 'google':
		case 'gemini':
			tokenizerProvider = 'google';
			break;

		default:
			tokenizerProvider = 'default';
			break;
	}

	const config: TokenizerConfig = {
		provider: tokenizerProvider,
		model,
		fallbackToApproximation: true,
		hybridTracking: true,
		...options,
	};

	return createTokenizer(config);
}
