import { IMemory, MemoryConfig, MemoryStats, MemoryItem } from './types.js';

/**
 * Simple in-memory implementation of IMemory
 */
export class SimpleMemory<T> implements IMemory<T> {
	private items: T[] = [];
	private readonly config: MemoryConfig;

	constructor(config: MemoryConfig = {}) {
		this.config = {
			name: config.name,
		};
	}

	add(items: T[]): void {
		this.items.push(...items);
	}

	clear(): void {
		this.items = [];
	}

	size(): number {
		return this.items.length;
	}

	isEmpty(): boolean {
		return this.items.length === 0;
	}

	remove(items: T[]): T[] {
		const removed: T[] = [];
		this.items = this.items.filter(item => {
			if (items.includes(item)) {
				removed.push(item);
				return false;
			}
			return true;
		});
		return removed;
	}

	query(query: string): T[] {
		return this.items.filter(item => item.toString().includes(query));
	}

	updateAccessCount(items: T[]): void {
		this.items = this.items.map(item => {
			if (items.includes(item)) {
				return {
					...item,
					accessCount: (item as any).accessCount + 1,
				};
			}
			return item;
		});
	}

	step(): void {
		// Do nothing
	}
}
