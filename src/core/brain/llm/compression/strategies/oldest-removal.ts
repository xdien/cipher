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
	sortMessagesByRemovalPriority,
	calculateTotalTokens,
	createCompressionResult,
	validateCompressionResult,
	logCompressionOperation,
	ensureMessageIds,
} from '../utils.js';
import { logger } from '../../../../logger/index.js';

/**
 * Oldest Removal Strategy
 * Removes oldest messages first while preserving minimum message count
 * Best for long conversations where recent context is most important
 */
export class OldestRemovalStrategy implements ICompressionStrategy {
	public readonly name = 'oldest-removal';
	public readonly config: CompressionConfig;

	constructor(config: CompressionConfig) {
		this.config = config;
		logger.debug('OldestRemovalStrategy initialized', config);
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

		logger.debug('Starting oldest removal compression', {
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

		// Sort removable messages by removal priority (oldest and lowest priority first)
		const sortedForRemoval = sortMessagesByRemovalPriority(removableMessages);

		// Start with all preservable messages
		let compressedMessages = [...preservableMessages];
		let removedMessages: EnhancedInternalMessage[] = [];

		// Add removable messages back in reverse order (newest first)
		// until we reach target token count or minimum message count
		const minToKeep = Math.max(this.config.minMessagesToKeep, preservableMessages.length);

		for (let i = sortedForRemoval.length - 1; i >= 0; i--) {
			const message = sortedForRemoval[i];
			if (!message) continue; // Skip undefined messages

			const testMessages = [...compressedMessages, message];
			const testTokenCount = calculateTotalTokens(testMessages);

			// Add message if it doesn't exceed target and we need more messages
			if (testTokenCount <= targetTokenCount || compressedMessages.length < minToKeep) {
				compressedMessages.push(message);
			} else {
				// Mark for removal
				removedMessages.unshift(message); // Add to beginning to maintain order
			}
		}

		// Re-sort compressed messages by original order
		compressedMessages = compressedMessages.sort((a, b) => {
			const aIndex = processedMessages.indexOf(a);
			const bIndex = processedMessages.indexOf(b);
			return aIndex - bIndex;
		});

		// Ensure we have minimum messages even if it exceeds target
		if (compressedMessages.length < minToKeep) {
			const neededMessages = minToKeep - compressedMessages.length;
			const toRestore = removedMessages.slice(-neededMessages); // Get newest removed messages

			compressedMessages.push(...toRestore);
			removedMessages = removedMessages.slice(0, -neededMessages);

			// Re-sort after restoration
			compressedMessages = compressedMessages.sort((a, b) => {
				const aIndex = processedMessages.indexOf(a);
				const bIndex = processedMessages.indexOf(b);
				return aIndex - bIndex;
			});
		}

		const result = createCompressionResult(
			processedMessages,
			compressedMessages,
			removedMessages,
			this.name
		);

		// Validate the compression result
		if (!validateCompressionResult(result, this.config.minMessagesToKeep)) {
			logger.warn('Oldest removal compression validation failed, returning original messages');
			return createCompressionResult(processedMessages, processedMessages, [], this.name);
		}

		const duration = Date.now() - startTime;
		logCompressionOperation('oldest removal completed', result, { duration });

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
	 * Calculate age-based removal score for a message
	 */
	private getRemovalScore(
		message: EnhancedInternalMessage,
		oldestTime: number,
		newestTime: number
	): number {
		const messageTime = message.timestamp || Date.now();
		const timeRange = newestTime - oldestTime;

		// Age factor (0-1, older = higher score = more likely to remove)
		const ageFactor = timeRange > 0 ? (newestTime - messageTime) / timeRange : 0;

		// Priority factor (0-1, lower priority = higher score = more likely to remove)
		const priorityFactors = {
			critical: 0,
			high: 0.2,
			normal: 0.5,
			low: 1.0,
		};
		const priorityFactor = priorityFactors[message.priority || 'normal'];

		// Combined score (weighted towards age for this strategy)
		return ageFactor * 0.7 + priorityFactor * 0.3;
	}

	/**
	 * Get strategy-specific statistics
	 */
	getStrategyStats(): any {
		return {
			name: this.name,
			minMessagesToKeep: this.config.minMessagesToKeep,
			compressionType: 'oldest-removal',
			bestFor: 'long conversations where recent context is most important',
		};
	}
}
