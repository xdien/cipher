import { describe, it, expect } from 'vitest';
import { OpenAITokenizer } from '../providers/openai.js';
import { AnthropicTokenizer } from '../providers/anthropic.js';
import { GoogleTokenizer } from '../providers/google.js';
import { DefaultTokenizer } from '../providers/default.js';
import { TokenizerConfig, EnhancedInternalMessage } from '../types.js';

describe('Tokenizer Providers', () => {
	const mockConfig: TokenizerConfig = {
		provider: 'openai',
		model: 'gpt-3.5-turbo',
		fallbackToApproximation: true,
		hybridTracking: false, // Disable to avoid tiktoken dependency in tests
	};

	describe('OpenAITokenizer', () => {
		it('should count tokens in text', async () => {
			const tokenizer = new OpenAITokenizer(mockConfig);
			const result = await tokenizer.countTokens('Hello world');

			expect(result.count).toBeGreaterThan(0);
			expect(result.provider).toBe('openai');
			expect(result.estimated).toBe(true); // Should be estimated without tiktoken
		});

		it('should count tokens in message', async () => {
			const tokenizer = new OpenAITokenizer(mockConfig);
			const message: EnhancedInternalMessage = {
				role: 'user',
				content: 'This is a test message',
			};

			const result = await tokenizer.countMessageTokens(message);
			expect(result.count).toBeGreaterThan(0);
			expect(result.provider).toBe('openai');
		});

		it('should get max tokens for model', () => {
			const tokenizer = new OpenAITokenizer(mockConfig);
			const maxTokens = tokenizer.getMaxTokens();
			expect(maxTokens).toBeGreaterThan(0);
		});
	});

	describe('AnthropicTokenizer', () => {
		it('should count tokens using approximation', async () => {
			const config: TokenizerConfig = { ...mockConfig, provider: 'anthropic' };
			const tokenizer = new AnthropicTokenizer(config);

			const result = await tokenizer.countTokens('Hello world');
			expect(result.count).toBeGreaterThan(0);
			expect(result.estimated).toBe(true);
			expect(result.provider).toBe('anthropic');
		});
	});

	describe('GoogleTokenizer', () => {
		it('should count tokens using approximation', async () => {
			const config: TokenizerConfig = { ...mockConfig, provider: 'google' };
			const tokenizer = new GoogleTokenizer(config);

			const result = await tokenizer.countTokens('Hello world');
			expect(result.count).toBeGreaterThan(0);
			expect(result.estimated).toBe(true);
			expect(result.provider).toBe('google');
		});
	});

	describe('DefaultTokenizer', () => {
		it('should count tokens using approximation', async () => {
			const config: TokenizerConfig = { ...mockConfig, provider: 'default' };
			const tokenizer = new DefaultTokenizer(config);

			const result = await tokenizer.countTokens('Hello world');
			expect(result.count).toBeGreaterThan(0);
			expect(result.estimated).toBe(true);
			expect(result.provider).toBe('default');
		});
	});
});
