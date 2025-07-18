import { z } from 'zod';

/**
 * Configuration schema for tokenizer
 */
export const TokenizerConfigSchema = z.object({
	provider: z.enum(['openai', 'anthropic', 'google', 'default']),
	model: z.string().optional(),
	fallbackToApproximation: z.boolean().default(true),
	hybridTracking: z.boolean().default(true),
});

export type TokenizerConfig = z.infer<typeof TokenizerConfigSchema>;

/**
 * Token count result interface
 */
export interface TokenCountResult {
	count: number;
	estimated: boolean;
	provider: string;
	model: string | undefined;
}

/**
 * Message token count interface
 */
export interface MessageTokenCount {
	messageIndex: number;
	role: string;
	tokenCount: number;
	estimated: boolean;
}

/**
 * Enhanced Internal Message with token information
 */
export interface EnhancedInternalMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | null | Array<any>;
	toolCalls?: Array<{
		id: string;
		type: 'function';
		function: {
			name: string;
			arguments: string;
		};
	}>;
	toolCallId?: string;
	name?: string;
	// Enhanced fields for token management
	priority?: 'critical' | 'high' | 'normal' | 'low';
	preserveInCompression?: boolean;
	tokenCount?: number;
	timestamp?: number;
}

/**
 * Tokenizer interface for counting tokens in text and messages
 */
export interface ITokenizer {
	/**
	 * Count tokens in a text string
	 */
	countTokens(text: string): Promise<TokenCountResult>;

	/**
	 * Count tokens in a message
	 */
	countMessageTokens(message: EnhancedInternalMessage): Promise<TokenCountResult>;

	/**
	 * Count tokens in an array of messages
	 */
	countMessagesTokens(messages: EnhancedInternalMessage[]): Promise<TokenCountResult>;

	/**
	 * Get the maximum token limit for the current model
	 */
	getMaxTokens(): number;

	/**
	 * Get provider-specific information
	 */
	getProviderInfo(): {
		provider: string;
		model: string | undefined;
		supportsAccurateCounting: boolean;
	};
}
