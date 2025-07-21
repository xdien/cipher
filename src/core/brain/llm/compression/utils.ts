import { EnhancedInternalMessage, CompressionResult, MessagePriority } from './types.js';
import { extractTextFromMessage } from '../tokenizer/utils.js';
import { logger } from '../../../logger/index.js';

/**
 * Calculate token count for a message (uses cached value if available)
 */
export function getMessageTokenCount(message: EnhancedInternalMessage): number {
	if (message.tokenCount !== undefined) {
		return message.tokenCount;
	}

	// Fallback to character-based estimation
	const text = extractTextFromMessage(message);
	return Math.ceil(text.length / 4); // 4 chars per token approximation
}

/**
 * Calculate total token count for an array of messages
 */
export function calculateTotalTokens(messages: EnhancedInternalMessage[]): number {
	return messages.reduce((total, message) => total + getMessageTokenCount(message), 0);
}

/**
 * Assign priorities to messages based on role and content
 */
export function assignMessagePriorities(
	messages: EnhancedInternalMessage[]
): EnhancedInternalMessage[] {
	return messages.map((message, index) => {
		// Skip if priority is already set
		if (message.priority !== undefined) {
			return message;
		}

		let priority: MessagePriority = MessagePriority.NORMAL;

		// System messages are critical
		if (message.role === 'system') {
			priority = MessagePriority.CRITICAL;
		}
		// Tool messages are high priority
		else if (message.role === 'tool') {
			priority = MessagePriority.HIGH;
		}
		// First few messages are high priority (conversation context)
		else if (index < 3) {
			priority = MessagePriority.HIGH;
		}
		// Last few messages are high priority (recent context)
		else if (index >= messages.length - 3) {
			priority = MessagePriority.HIGH;
		}
		// Long messages might be important
		else if (getMessageTokenCount(message) > 500) {
			priority = MessagePriority.HIGH;
		}
		// Very short messages are low priority
		else if (getMessageTokenCount(message) < 20) {
			priority = MessagePriority.LOW;
		}

		return {
			...message,
			priority,
			timestamp: message.timestamp || Date.now(),
		};
	});
}

/**
 * Filter messages that should be preserved during compression
 */
export function getPreservableMessages(
	messages: EnhancedInternalMessage[]
): EnhancedInternalMessage[] {
	return messages.filter(
		message =>
			message.preserveInCompression === true ||
			message.priority === MessagePriority.CRITICAL ||
			message.role === 'system'
	);
}

/**
 * Filter messages that can be removed during compression
 */
export function getRemovableMessages(
	messages: EnhancedInternalMessage[]
): EnhancedInternalMessage[] {
	return messages.filter(
		message =>
			message.preserveInCompression !== true &&
			message.priority !== MessagePriority.CRITICAL &&
			message.role !== 'system'
	);
}

/**
 * Sort messages by priority (for removal order)
 */
export function sortMessagesByRemovalPriority(
	messages: EnhancedInternalMessage[]
): EnhancedInternalMessage[] {
	return [...messages].sort((a, b) => {
		// First sort by priority (low priority removed first)
		const priorityOrder = {
			[MessagePriority.LOW]: 0,
			[MessagePriority.NORMAL]: 1,
			[MessagePriority.HIGH]: 2,
			[MessagePriority.CRITICAL]: 3,
		};

		const aPriority = priorityOrder[a.priority || MessagePriority.NORMAL];
		const bPriority = priorityOrder[b.priority || MessagePriority.NORMAL];

		if (aPriority !== bPriority) {
			return aPriority - bPriority;
		}

		// Then sort by timestamp (older messages removed first)
		const aTime = a.timestamp || 0;
		const bTime = b.timestamp || 0;

		return aTime - bTime;
	});
}

/**
 * Create compression result object
 */
export function createCompressionResult(
	originalMessages: EnhancedInternalMessage[],
	compressedMessages: EnhancedInternalMessage[],
	removedMessages: EnhancedInternalMessage[],
	strategy: string
): CompressionResult {
	const originalTokenCount = calculateTotalTokens(originalMessages);
	const compressedTokenCount = calculateTotalTokens(compressedMessages);
	const compressionRatio = originalTokenCount > 0 ? compressedTokenCount / originalTokenCount : 1;

	return {
		compressedMessages,
		removedMessages,
		originalTokenCount,
		compressedTokenCount,
		compressionRatio,
		strategy,
		timestamp: Date.now(),
	};
}

/**
 * Validate compression result to ensure quality
 */
export function validateCompressionResult(
	result: CompressionResult,
	minMessagesToKeep: number
): boolean {
	// Must preserve minimum number of messages
	if (result.compressedMessages.length < minMessagesToKeep) {
		logger.warn('Compression removed too many messages', {
			remaining: result.compressedMessages.length,
			minimum: minMessagesToKeep,
		});
		return false;
	}

	// Must preserve system messages
	const systemMessages = result.compressedMessages.filter(m => m.role === 'system');
	const originalSystemMessages = result.compressedMessages
		.concat(result.removedMessages)
		.filter(m => m.role === 'system');

	if (systemMessages.length !== originalSystemMessages.length) {
		logger.warn('Compression removed system messages');
		return false;
	}

	// Must preserve critical messages
	const criticalMessages = result.compressedMessages.filter(
		m => m.priority === MessagePriority.CRITICAL
	);
	const originalCriticalMessages = result.compressedMessages
		.concat(result.removedMessages)
		.filter(m => m.priority === MessagePriority.CRITICAL);

	if (criticalMessages.length !== originalCriticalMessages.length) {
		logger.warn('Compression removed critical messages');
		return false;
	}

	// Should achieve some compression
	if (result.compressionRatio > 0.95) {
		logger.warn('Compression achieved minimal token reduction', {
			ratio: result.compressionRatio,
		});
		return false;
	}

	return true;
}

/**
 * Add message IDs if not present
 */
export function ensureMessageIds(messages: EnhancedInternalMessage[]): EnhancedInternalMessage[] {
	return messages.map((message, index) => ({
		...message,
		messageId: message.messageId || `msg_${Date.now()}_${index}`,
	}));
}

/**
 * Log compression operation
 */
export function logCompressionOperation(
	operation: string,
	result: CompressionResult,
	context?: any
): void {
	logger.debug(`Compression: ${operation}`, {
		strategy: result.strategy,
		originalTokens: result.originalTokenCount,
		compressedTokens: result.compressedTokenCount,
		ratio: result.compressionRatio,
		messagesRemoved: result.removedMessages.length,
		messagesRemaining: result.compressedMessages.length,
		...context,
	});
}

/**
 * Calculate compression efficiency score
 */
export function calculateCompressionEfficiency(result: CompressionResult): number {
	// Efficiency considers both token reduction and message preservation
	const tokenReduction = 1 - result.compressionRatio;
	const messagePreservation =
		result.compressedMessages.length /
		(result.compressedMessages.length + result.removedMessages.length);

	// Weighted score (60% token reduction, 40% message preservation)
	return tokenReduction * 0.6 + messagePreservation * 0.4;
}
