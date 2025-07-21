import {
	ICompressionStrategy,
	CompressionConfig,
	CompressionResult,
	EnhancedInternalMessage,
	CompressionLevel,
} from '../types.js';
import {
	assignMessagePriorities,
	getPreservableMessages,
	getRemovableMessages,
	calculateTotalTokens,
	createCompressionResult,
	validateCompressionResult,
	logCompressionOperation,
	ensureMessageIds,
} from '../utils.js';
import { logger } from '../../../../logger/index.js';

/**
 * Middle Removal Strategy
 * Preserves conversation start and end, removes messages from the middle
 * Best for maintaining conversation flow and recent context
 */
export class MiddleRemovalStrategy implements ICompressionStrategy {
	public readonly name = 'middle-removal';
	public readonly config: CompressionConfig;

	constructor(config: CompressionConfig) {
		this.config = config;
		logger.debug('MiddleRemovalStrategy initialized', config);
	}

	async compress(
		messages: EnhancedInternalMessage[],
		currentTokenCount: number,
		targetTokenCount: number
	): Promise<CompressionResult> {
		const startTime = Date.now();

		// Ensure messages have IDs and priorities
		let processedMessages = ensureMessageIds(messages);
		processedMessages = assignMessagePriorities(processedMessages);

		logger.debug('Starting middle removal compression', {
			messageCount: processedMessages.length,
			currentTokens: currentTokenCount,
			targetTokens: targetTokenCount,
			tokensToRemove: currentTokenCount - targetTokenCount,
		});

		// Get preservable messages (always keep these)
		const preservableMessages = getPreservableMessages(processedMessages);
		const removableMessages = getRemovableMessages(processedMessages);

		if (removableMessages.length === 0) {
			logger.warn('No removable messages found for compression');
			return createCompressionResult(processedMessages, processedMessages, [], this.name);
		}

		// Sort removable messages by index to identify start, middle, and end
		const sortedRemovable = removableMessages.sort((a, b) => {
			const aIndex = processedMessages.indexOf(a);
			const bIndex = processedMessages.indexOf(b);
			return aIndex - bIndex;
		});

		// Determine which messages to preserve from start and end
		const startPreserveCount = Math.min(this.config.preserveStart, sortedRemovable.length);
		const endPreserveCount = Math.min(
			this.config.preserveEnd,
			sortedRemovable.length - startPreserveCount
		);

		const startMessages = sortedRemovable.slice(0, startPreserveCount);
		const endMessages = sortedRemovable.slice(-endPreserveCount);
		const middleMessages = sortedRemovable.slice(
			startPreserveCount,
			sortedRemovable.length - endPreserveCount
		);

		// Start with all preservable messages plus start and end
		let compressedMessages = [...preservableMessages, ...startMessages, ...endMessages];
		let removedMessages: EnhancedInternalMessage[] = [];

		// Remove middle messages until we reach target or minimum
		const minToKeep = Math.max(this.config.minMessagesToKeep, preservableMessages.length + 2);

		for (const message of middleMessages) {
			const currentTotal = calculateTotalTokens(compressedMessages);

			if (currentTotal <= targetTokenCount) {
				break; // Target reached
			}

			if (compressedMessages.length <= minToKeep) {
				break; // Minimum reached
			}

			removedMessages.push(message);
		}

		// Re-sort compressed messages by original order
		compressedMessages = compressedMessages.sort((a, b) => {
			const aIndex = processedMessages.indexOf(a);
			const bIndex = processedMessages.indexOf(b);
			return aIndex - bIndex;
		});

		const result = createCompressionResult(
			processedMessages,
			compressedMessages,
			removedMessages,
			this.name
		);

		// Validate the compression result
		if (!validateCompressionResult(result, this.config.minMessagesToKeep)) {
			logger.warn('Middle removal compression validation failed, returning original messages');
			return createCompressionResult(processedMessages, processedMessages, [], this.name);
		}

		const duration = Date.now() - startTime;
		logCompressionOperation('middle removal completed', result, { duration });

		return result;
	}

	shouldCompress(currentTokenCount: number): boolean {
		const threshold = this.config.maxTokens * this.config.compressionThreshold;
		return currentTokenCount >= threshold;
	}

	getCompressionLevel(currentTokenCount: number): number {
		const warningThreshold = this.config.maxTokens * this.config.warningThreshold;
		const compressionThreshold = this.config.maxTokens * this.config.compressionThreshold;

		if (currentTokenCount < warningThreshold) {
			return CompressionLevel.NONE;
		} else if (currentTokenCount < compressionThreshold) {
			return CompressionLevel.WARNING;
		} else if (currentTokenCount < this.config.maxTokens * 0.95) {
			return CompressionLevel.SOFT;
		} else if (currentTokenCount < this.config.maxTokens) {
			return CompressionLevel.HARD;
		} else {
			return CompressionLevel.EMERGENCY;
		}
	}

	validateCompression(result: CompressionResult): boolean {
		return validateCompressionResult(result, this.config.minMessagesToKeep);
	}

	/**
	 * Get strategy-specific statistics
	 */
	getStrategyStats(): any {
		return {
			name: this.name,
			preserveStart: this.config.preserveStart,
			preserveEnd: this.config.preserveEnd,
			compressionType: 'middle-removal',
			bestFor: 'maintaining conversation flow and recent context',
		};
	}
}
