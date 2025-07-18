import { z } from 'zod';
import { EnhancedInternalMessage } from '../tokenizer/types.js';

/**
 * Configuration schema for compression strategy
 */
export const CompressionConfigSchema = z.object({
	strategy: z.enum(['middle-removal', 'oldest-removal', 'hybrid']),
	maxTokens: z.number().positive(),
	warningThreshold: z.number().min(0).max(1).default(0.8),
	compressionThreshold: z.number().min(0).max(1).default(0.9),
	preserveStart: z.number().min(1).default(4),
	preserveEnd: z.number().min(1).default(5),
	minMessagesToKeep: z.number().min(1).default(4),
});

export type CompressionConfig = z.infer<typeof CompressionConfigSchema>;

/**
 * Compression result interface
 */
export interface CompressionResult {
	originalCount: number;
	compressedCount: number;
	removedCount: number;
	removedMessages: EnhancedInternalMessage[];
	strategy: string;
	compressionRatio: number;
	tokensSaved: number;
}

/**
 * Compression context interface
 */
export interface CompressionContext {
	currentTokenCount: number;
	maxTokens: number;
	targetTokenCount: number;
	preserveCritical: boolean;
	compressionLevel: 'warning' | 'soft' | 'hard' | 'emergency';
}

/**
 * Compression strategy interface
 */
export interface ICompressionStrategy {
	/**
	 * Compress messages to fit within token limits
	 */
	compress(
		messages: EnhancedInternalMessage[],
		context: CompressionContext
	): Promise<CompressionResult>;

	/**
	 * Determine if compression is needed
	 */
	shouldCompress(currentTokenCount: number, maxTokens: number, config: CompressionConfig): boolean;

	/**
	 * Get strategy name
	 */
	getStrategyName(): string;

	/**
	 * Get strategy configuration
	 */
	getConfig(): CompressionConfig;
}
