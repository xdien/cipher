import { z } from 'zod';

// ============================================================================
// Cipher Memory Interface Types
// ============================================================================

/**
 * Generic memory interface for storing conversation history and real-time fine-tuning
 */
export interface IMemory<T> {
	/**
	 * Add multiple items to memory
	 */
	add(items: T[]): void;

	/**
	 * Clear all items from memory
	 */
	clear(): void;

	/**
	 * Get the total number of items in memory
	 */
	size(): number;

	/**
	 * Check if memory is empty
	 */
	isEmpty(): boolean;

	/**
	 * Remove items from memory
	 */
	remove(items: T[]): void;

	/**
	 * Query items in memory base on a string
	 */
	query(query: string): T[];

	/**
	 * Update access count for items in memory regarding to usage
	 */
	updateAccessCount(items: T[]): void;

	/**
	 * real-time fine-tuning for memory
	 */
	step(): void;
}

/**
 * Memory configuration options
 */
export const MemoryConfigSchema = z.object({
	name: z.string(),
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

/**
 * Memory statistics
 */
export interface MemoryStats {
	totalItems: number;
}

/**
 * Memory item with metadata
 */
export interface MemoryItem<T> {
	data: T;
	timestamp: Date;
	id: string;
	metadata?: Record<string, any>;
}
