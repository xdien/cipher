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
 * Middle removal compression strategy
 * Preserves the start and end of the conversation, removes messages from the middle
 */
export class MiddleRemovalStrategy implements ICompressionStrategy {
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

		logger.debug('Starting middle removal compression', {
			originalCount: originalMessages.length,
			originalTokens: originalTokenCount,
			targetTokens: context.targetTokenCount,
		});

		// Find messages that must be preserved
		const preservableIndices = findPreservableMessages(originalMessages);

		// Separate messages into start, middle, and end sections
		const startCount = this.config.preserveStart;
		const endCount = this.config.preserveEnd;

		const startMessages = originalMessages.slice(0, startCount);
		const endMessages = originalMessages.slice(-endCount);
		const middleMessages = originalMessages.slice(startCount, originalMessages.length - endCount);

		// Add preservable messages from middle section
		const preservedMiddleMessages = middleMessages.filter((_, index) => {
			const originalIndex = startCount + index;
			return preservableIndices.has(originalIndex);
		});

		// Start with essential messages (start + preserved middle + end)
		let compressedMessages = [...startMessages, ...preservedMiddleMessages, ...endMessages];

		// Remove duplicates (in case of overlap between sections)
		const seen = new Set<string>();
		compressedMessages = compressedMessages.filter(message => {
			const key = JSON.stringify(message);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});

		let currentTokenCount = calculateMessagesTokenCount(compressedMessages);

		// If still over target, progressively remove more middle messages
		if (currentTokenCount > context.targetTokenCount) {
			// Try removing non-critical middle messages
			const removableMiddleMessages = middleMessages.filter((_, index) => {
				const originalIndex = startCount + index;
				return !preservableIndices.has(originalIndex);
			});

			// Sort by priority (remove lowest priority first)
			removableMiddleMessages.sort((a, b) => {
				const priorityOrder = {
					critical: 4,
					high: 3,
					normal: 2,
					low: 1,
				} as const;

				type PriorityKey = keyof typeof priorityOrder;

				const aPriority = priorityOrder[(a.priority ?? 'normal') as PriorityKey] ?? 2;
				const bPriority = priorityOrder[(b.priority ?? 'normal') as PriorityKey] ?? 2;

				return aPriority - bPriority;
			});

			// Keep adding back messages until we hit the target
			const finalMessages = [...compressedMessages];
			for (const message of removableMiddleMessages.reverse()) {
				const testMessages = [...finalMessages, message];
				const testTokenCount = calculateMessagesTokenCount(testMessages);

				if (testTokenCount <= context.targetTokenCount) {
					finalMessages.push(message);
				} else {
					break;
				}
			}

			compressedMessages = finalMessages;
		}

		// Ensure we meet minimum requirements
		if (
			!validateCompressionResult(originalMessages, compressedMessages, {
				minMessagesToKeep: this.config.minMessagesToKeep,
			})
		) {
			logger.warn('Middle removal compression failed validation, keeping minimum messages');
			// Keep at least the minimum required messages
			compressedMessages = originalMessages.slice(0, this.config.minMessagesToKeep);
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

		logger.debug('Middle removal compression completed', result);

		// Update the original messages array
		messages.splice(0, messages.length, ...compressedMessages);

		return result;
	}

	shouldCompress(currentTokenCount: number, maxTokens: number, config: CompressionConfig): boolean {
		const ratio = currentTokenCount / maxTokens;
		return ratio >= config.compressionThreshold;
	}

	getStrategyName(): string {
		return 'middle-removal';
	}

	getConfig(): CompressionConfig {
		return this.config;
	}
}
