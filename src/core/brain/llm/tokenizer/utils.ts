import { TokenCountResult, EnhancedInternalMessage } from './types.js';

/**
 * Estimate token count using character-based approximation
 * Uses the common rule of ~4 characters per token for most models
 */
export function estimateTokenCount(text: string): number {
	if (!text || typeof text !== 'string') {
		return 0;
	}

	// Basic approximation: ~4 characters per token
	// This is a conservative estimate that works reasonably well across providers
	return Math.ceil(text.length / 4);
}

/**
 * Convert message content to string for token counting
 */
export function messageContentToString(content: EnhancedInternalMessage['content']): string {
	if (typeof content === 'string') {
		return content || '';
	}

	if (content === null || content === undefined) {
		return '';
	}

	if (Array.isArray(content)) {
		return content
			.map(part => {
				if (typeof part === 'object' && part !== null) {
					if ('text' in part && typeof part.text === 'string') {
						return part.text;
					}
					if ('type' in part && part.type === 'image') {
						// For images, we'll estimate based on image tokens
						// Most models use around 85-170 tokens per image
						return '[IMAGE_PLACEHOLDER]'; // Will be handled specially in counting
					}
				}
				return '';
			})
			.join(' ');
	}

	return String(content);
}

/**
 * Estimate tokens for a complete message including role and structure overhead
 */
export function estimateMessageTokens(message: EnhancedInternalMessage): number {
	let totalTokens = 0;

	// Base overhead for message structure (role, etc.)
	totalTokens += 4; // Typical overhead per message

	// Content tokens
	const contentStr = messageContentToString(message.content);
	if (Array.isArray(message.content)) {
		// Check for images
		const imageCount = message.content.filter(
			part => typeof part === 'object' && part !== null && 'type' in part && part.type === 'image'
		).length;

		// Add image tokens (estimate 120 tokens per image)
		totalTokens += imageCount * 120;
	}

	totalTokens += estimateTokenCount(contentStr);

	// Tool calls overhead
	if (message.toolCalls && message.toolCalls.length > 0) {
		totalTokens += message.toolCalls.length * 10; // Base overhead per tool call

		for (const toolCall of message.toolCalls) {
			totalTokens += estimateTokenCount(toolCall.function.name);
			totalTokens += estimateTokenCount(toolCall.function.arguments);
		}
	}

	// Tool result overhead
	if (message.toolCallId && message.name) {
		totalTokens += 5; // Tool response overhead
		totalTokens += estimateTokenCount(message.name);
	}

	return totalTokens;
}

/**
 * Create a token count result with common metadata
 */
export function createTokenCountResult(
	count: number,
	estimated: boolean,
	provider: string,
	model?: string
): TokenCountResult {
	return {
		count,
		estimated,
		provider,
		model: model || undefined,
	};
}

/**
 * Get model-specific token limits
 */
export function getModelTokenLimit(provider: string, model?: string): number {
	const providerLower = provider.toLowerCase();
	const modelLower = model?.toLowerCase() || '';

	switch (providerLower) {
		case 'openai':
			if (modelLower.includes('gpt-4o')) return 128000;
			if (modelLower.includes('gpt-4-turbo')) return 128000;
			if (modelLower.includes('gpt-4')) return 8192;
			if (modelLower.includes('gpt-3.5-turbo')) return 16385;
			if (modelLower.includes('o1')) return 200000;
			return 4096; // Default fallback

		case 'anthropic':
			if (modelLower.includes('claude-3-5-sonnet')) return 200000;
			if (modelLower.includes('claude-3-opus')) return 200000;
			if (modelLower.includes('claude-3-sonnet')) return 200000;
			if (modelLower.includes('claude-3-haiku')) return 200000;
			if (modelLower.includes('claude-2')) return 100000;
			return 100000; // Default fallback

		case 'google':
			if (modelLower.includes('gemini-pro')) return 30720;
			if (modelLower.includes('gemini-1.5')) return 1000000;
			return 30720; // Default fallback

		default:
			return 4096; // Conservative default
	}
}
