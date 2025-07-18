import {
	ICompressionStrategy,
	CompressionConfig,
	CompressionResult,
	CompressionContext,
} from '../types.js';
import { EnhancedInternalMessage } from '../../tokenizer/types.js';
import {
	calculateMessagesTokenCount,
	findPreservableMessages,
	calculateCompressionRatio,
	cloneMessages,
	validateCompressionResult,
} from '../utils.js';
import { logger } from '../../../../logger/index.js';

/**
 * Oldest removal compression strategy
 * Removes oldest messages first (FIFO) while preserving critical messages
 */
export class OldestRemovalStrategy implements ICompressionStrategy {
	private config: CompressionConfig;

	constructor(config: CompressionConfig) {
		this.config = config;
	}

	async compress(
		messages: EnhancedInternalMessage[],
		context: CompressionContext
	): Promise<CompressionResult> {
		const originalMessages = cloneMessages(messages);
		const originalTokenCount = calculateMessagesTokenCount(originalMessages);

		logger.debug('Starting oldest removal compression', {
			originalCount: originalMessages.length,
			originalTokens: originalTokenCount,
			targetTokens: context.targetTokenCount,
		});

		// Find messages that must be preserved
		const preservableIndices = findPreservableMessages(originalMessages);

		// Separate preservable and removable messages
		const preservableMessages: EnhancedInternalMessage[] = [];
		const removableMessages: { message: EnhancedInternalMessage; originalIndex: number }[] = [];

		originalMessages.forEach((message, index) => {
			if (preservableIndices.has(index)) {
				preservableMessages.push(message);
			} else {
				removableMessages.push({ message, originalIndex: index });
			}
		});

		// Sort removable messages by timestamp/order (oldest first)
		removableMessages.sort((a, b) => {
			// Use timestamp if available, otherwise use original index
			const aTime = a.message.timestamp || a.originalIndex;
			const bTime = b.message.timestamp || b.originalIndex;
			return aTime - bTime;
		});

		// Start with preservable messages
		let compressedMessages = [...preservableMessages];
		let currentTokenCount = calculateMessagesTokenCount(compressedMessages);

		// Add back removable messages from newest to oldest until we hit the target
		for (let i = removableMessages.length - 1; i >= 0; i--) {
			const candidate = removableMessages[i]!;
			const testMessages = [...compressedMessages, candidate.message];
			const testTokenCount = calculateMessagesTokenCount(testMessages);

			if (testTokenCount <= context.targetTokenCount) {
				compressedMessages.push(candidate.message);
				currentTokenCount = testTokenCount;
			} else {
				// Can't add more messages without exceeding target
				break;
			}
		}

		// Sort final messages back to original order
		compressedMessages.sort((a, b) => {
			const aIndex = originalMessages.findIndex(msg => JSON.stringify(msg) === JSON.stringify(a));
			const bIndex = originalMessages.findIndex(msg => JSON.stringify(msg) === JSON.stringify(b));
			return aIndex - bIndex;
		});

		// Ensure we meet minimum requirements
		if (
			!validateCompressionResult(originalMessages, compressedMessages, {
				minMessagesToKeep: this.config.minMessagesToKeep,
			})
		) {
			logger.warn('Oldest removal compression failed validation, keeping minimum messages');
			// Keep the most recent messages up to minimum
			compressedMessages = originalMessages.slice(-this.config.minMessagesToKeep);
		}

		const finalTokenCount = calculateMessagesTokenCount(compressedMessages);
		const removedMessages = originalMessages.filter(
			msg => !compressedMessages.some(cMsg => JSON.stringify(cMsg) === JSON.stringify(msg))
		);

		const result: CompressionResult = {
			originalCount: originalMessages.length,
			compressedCount: compressedMessages.length,
			removedCount: removedMessages.length,
			removedMessages,
			strategy: this.getStrategyName(),
			compressionRatio: calculateCompressionRatio(
				originalMessages.length,
				compressedMessages.length
			),
			tokensSaved: originalTokenCount - finalTokenCount,
		};

		logger.debug('Oldest removal compression completed', result);

		// Update the original messages array
		messages.splice(0, messages.length, ...compressedMessages);

		return result;
	}

	shouldCompress(currentTokenCount: number, maxTokens: number, config: CompressionConfig): boolean {
		const ratio = currentTokenCount / maxTokens;
		return ratio >= config.compressionThreshold;
	}

	getStrategyName(): string {
		return 'oldest-removal';
	}

	getConfig(): CompressionConfig {
		return this.config;
	}
}
