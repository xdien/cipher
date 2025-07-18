import { EnhancedInternalMessage } from '../tokenizer/types.js';
import { estimateMessageTokens } from '../tokenizer/utils.js';

/**
 * Calculate total token count for messages
 */
export function calculateMessagesTokenCount(messages: EnhancedInternalMessage[]): number {
	return messages.reduce((total, message) => {
		return total + (message.tokenCount || estimateMessageTokens(message));
	}, 0);
}

/**
 * Determine compression level based on current usage
 */
export function getCompressionLevel(
	currentTokenCount: number,
	maxTokens: number,
	warningThreshold: number = 0.8,
	compressionThreshold: number = 0.9
): 'normal' | 'warning' | 'soft' | 'hard' | 'emergency' {
	const ratio = currentTokenCount / maxTokens;

	if (ratio >= 1.0) {
		return 'emergency';
	} else if (ratio >= 0.95) {
		return 'hard';
	} else if (ratio >= compressionThreshold) {
		return 'soft';
	} else if (ratio >= warningThreshold) {
		return 'warning';
	} else {
		return 'normal';
	}
}

/**
 * Filter messages by priority
 */
export function filterMessagesByPriority(
	messages: EnhancedInternalMessage[],
	minPriority: 'critical' | 'high' | 'normal' | 'low' = 'normal'
): EnhancedInternalMessage[] {
	const priorityOrder = {
		critical: 4,
		high: 3,
		normal: 2,
		low: 1,
	} as const;

	const minPriorityValue = priorityOrder[minPriority];

	return messages.filter(message => {
		const messagePriority = message.priority ?? 'normal';
		const messagePriorityValue = priorityOrder[messagePriority as keyof typeof priorityOrder];

		return messagePriorityValue >= minPriorityValue;
	});
}

/**
 * Find messages that should be preserved during compression
 */
export function findPreservableMessages(messages: EnhancedInternalMessage[]): Set<number> {
	const preservableIndices = new Set<number>();

	messages.forEach((message, index) => {
		if (message.preserveInCompression || message.priority === 'critical') {
			preservableIndices.add(index);
		}

		// Always preserve system messages
		if (message.role === 'system') {
			preservableIndices.add(index);
		}
	});

	return preservableIndices;
}

/**
 * Calculate compression ratio
 */
export function calculateCompressionRatio(originalCount: number, compressedCount: number): number {
	if (originalCount === 0) return 0;
	return (originalCount - compressedCount) / originalCount;
}

/**
 * Create a safe copy of messages for compression
 */
export function cloneMessages(messages: EnhancedInternalMessage[]): EnhancedInternalMessage[] {
	return messages.map(message => {
		const clonedMessage: EnhancedInternalMessage = {
			...message,
			content: Array.isArray(message.content) ? [...message.content] : message.content,
		};

		if (message.toolCalls) {
			clonedMessage.toolCalls = message.toolCalls.map(tc => ({
				...tc,
				function: { ...tc.function },
			}));
		}

		return clonedMessage;
	});
}

/**
 * Validate compression result
 */
export function validateCompressionResult(
	originalMessages: EnhancedInternalMessage[],
	compressedMessages: EnhancedInternalMessage[],
	config: { minMessagesToKeep: number }
): boolean {
	// Must keep minimum number of messages
	if (compressedMessages.length < config.minMessagesToKeep) {
		return false;
	}

	// Must preserve all system messages
	const originalSystemCount = originalMessages.filter(m => m.role === 'system').length;
	const compressedSystemCount = compressedMessages.filter(m => m.role === 'system').length;

	if (originalSystemCount !== compressedSystemCount) {
		return false;
	}

	// Must preserve all critical messages
	const originalCriticalCount = originalMessages.filter(
		m => m.priority === 'critical' || m.preserveInCompression
	).length;
	const compressedCriticalCount = compressedMessages.filter(
		m => m.priority === 'critical' || m.preserveInCompression
	).length;

	if (originalCriticalCount !== compressedCriticalCount) {
		return false;
	}

	return true;
}
