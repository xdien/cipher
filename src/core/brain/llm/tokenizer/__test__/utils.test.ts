import { describe, it, expect } from 'vitest';
import {
	estimateTokenCount,
	messageContentToString,
	estimateMessageTokens,
	getModelTokenLimit,
} from '../utils.js';
import { EnhancedInternalMessage } from '../types.js';

describe('Tokenizer Utils', () => {
	describe('estimateTokenCount', () => {
		it('should estimate token count for text', () => {
			const text = 'Hello world, this is a test message';
			const count = estimateTokenCount(text);
			expect(count).toBeGreaterThan(0);
			expect(count).toBe(Math.ceil(text.length / 4));
		});

		it('should handle empty text', () => {
			expect(estimateTokenCount('')).toBe(0);
			expect(estimateTokenCount(null as any)).toBe(0);
		});
	});

	describe('messageContentToString', () => {
		it('should convert string content', () => {
			const result = messageContentToString('Hello world');
			expect(result).toBe('Hello world');
		});

		it('should convert array content', () => {
			const content = [
				{ type: 'text', text: 'Hello' },
				{ type: 'text', text: 'world' },
			];
			const result = messageContentToString(content as any);
			expect(result).toBe('Hello world');
		});

		it('should handle image content', () => {
			const content = [
				{ type: 'text', text: 'Look at this:' },
				{ type: 'image', image: 'base64data', mimeType: 'image/jpeg' },
			];
			const result = messageContentToString(content as any);
			expect(result).toContain('Look at this:');
			expect(result).toContain('[IMAGE_PLACEHOLDER]');
		});

		it('should handle null content', () => {
			expect(messageContentToString(null)).toBe('');
			expect(messageContentToString(undefined as any)).toBe('');
		});
	});

	describe('estimateMessageTokens', () => {
		it('should estimate tokens for a simple message', () => {
			const message: EnhancedInternalMessage = {
				role: 'user',
				content: 'Hello world',
			};

			const count = estimateMessageTokens(message);
			expect(count).toBeGreaterThan(0);
		});

		it('should account for tool calls', () => {
			const message: EnhancedInternalMessage = {
				role: 'assistant',
				content: 'I will help you',
				toolCalls: [
					{
						id: 'call_123',
						type: 'function',
						function: {
							name: 'get_weather',
							arguments: '{"location": "San Francisco"}',
						},
					},
				],
			};

			const count = estimateMessageTokens(message);
			expect(count).toBeGreaterThan(estimateTokenCount('I will help you'));
		});

		it('should account for tool responses', () => {
			const message: EnhancedInternalMessage = {
				role: 'tool',
				content: 'Weather data here',
				toolCallId: 'call_123',
				name: 'get_weather',
			};

			const count = estimateMessageTokens(message);
			expect(count).toBeGreaterThan(estimateTokenCount('Weather data here'));
		});
	});

	describe('getModelTokenLimit', () => {
		it('should return correct limits for OpenAI models', () => {
			expect(getModelTokenLimit('openai', 'gpt-4o')).toBe(128000);
			expect(getModelTokenLimit('openai', 'gpt-4')).toBe(8192);
			expect(getModelTokenLimit('openai', 'gpt-3.5-turbo')).toBe(16385);
		});

		it('should return correct limits for Anthropic models', () => {
			expect(getModelTokenLimit('anthropic', 'claude-3-5-sonnet')).toBe(200000);
			expect(getModelTokenLimit('anthropic', 'claude-3-opus')).toBe(200000);
		});

		it('should return correct limits for Google models', () => {
			expect(getModelTokenLimit('google', 'gemini-1.5')).toBe(1000000);
			expect(getModelTokenLimit('google', 'gemini-pro')).toBe(30720);
		});

		it('should return default limit for unknown models', () => {
			expect(getModelTokenLimit('unknown', 'unknown-model')).toBe(4096);
		});
	});
});
