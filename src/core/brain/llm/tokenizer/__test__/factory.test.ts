import { describe, it, expect, beforeEach } from 'vitest';
import { createTokenizer, createTokenizerFromProvider } from '../factory.js';
import { TokenizerConfig } from '../types.js';

describe('Tokenizer Factory', () => {
	it('should create OpenAI tokenizer', () => {
		const config: TokenizerConfig = {
			provider: 'openai',
			model: 'gpt-3.5-turbo',
			fallbackToApproximation: true,
			hybridTracking: true,
		};

		const tokenizer = createTokenizer(config);
		expect(tokenizer).toBeDefined();
		expect(tokenizer.getProviderInfo().provider).toBe('openai');
	});

	it('should create Anthropic tokenizer', () => {
		const tokenizer = createTokenizerFromProvider('anthropic', 'claude-3-sonnet');
		expect(tokenizer).toBeDefined();
		expect(tokenizer.getProviderInfo().provider).toBe('anthropic');
	});

	it('should create Google tokenizer', () => {
		const tokenizer = createTokenizerFromProvider('google', 'gemini-pro');
		expect(tokenizer).toBeDefined();
		expect(tokenizer.getProviderInfo().provider).toBe('google');
	});

	it('should create default tokenizer for unknown providers', () => {
		const tokenizer = createTokenizerFromProvider('unknown-provider');
		expect(tokenizer).toBeDefined();
		expect(tokenizer.getProviderInfo().provider).toBe('default');
	});

	it('should map OpenRouter to OpenAI tokenizer', () => {
		const tokenizer = createTokenizerFromProvider('openrouter', 'openai/gpt-4');
		expect(tokenizer).toBeDefined();
		expect(tokenizer.getProviderInfo().provider).toBe('openai');
	});
});
