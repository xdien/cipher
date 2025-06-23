/**
 * AsyncEventBus - Core event distribution system
 */

import { Event, EventListener, EventTransport } from '../types/index.js';

export class AsyncEventBus {
	private static instance: AsyncEventBus | null = null;
	private listeners: Map<string, EventListener> = new Map();
	private transport?: EventTransport;
	private eventQueue: Event[] = [];
	private processing = false;
	private processingPromise?: Promise<void>;
	private started = false;

	private constructor(transport?: EventTransport) {
		this.transport = transport;
	}

	/**
	 * Get singleton instance of the event bus
	 */
	public static getInstance(transport?: EventTransport): AsyncEventBus {
		if (!AsyncEventBus.instance) {
			AsyncEventBus.instance = new AsyncEventBus(transport);
		}
		return AsyncEventBus.instance;
	}

	/**
	 * Reset singleton instance (mainly for testing)
	 */
	public static reset(): void {
		AsyncEventBus.instance = null;
	}

	/**
	 * Emit an event to all listeners and transport
	 */
	public async emit(event: Event): Promise<void> {
		// Add to queue for processing
		this.eventQueue.push(event);

		// Start processing if not already running
		if (!this.processing) {
			this.processingPromise = this.processEvents();
		}

		// Wait for current processing cycle to complete
		await this.processingPromise;
	}

	/**
	 * Add a listener to the event bus
	 */
	public addListener(name: string, listener: EventListener): void {
		this.listeners.set(name, listener);
	}

	/**
	 * Remove a listener from the event bus
	 */
	public removeListener(name: string): void {
		this.listeners.delete(name);
	}

	/**
	 * Start the event bus and all lifecycle-aware listeners
	 */
	public async start(): Promise<void> {
		if (this.started) {
			return;
		}

		this.started = true;

		// Start all lifecycle-aware listeners
		for (const [name, listener] of Array.from(this.listeners.entries())) {
			if ('start' in listener && typeof listener.start === 'function') {
				try {
					await listener.start();
				} catch (error) {
					console.error(`Failed to start listener ${name}:`, error);
				}
			}
		}
	}

	/**
	 * Stop the event bus and all lifecycle-aware listeners
	 */
	public async stop(): Promise<void> {
		if (!this.started) {
			return;
		}

		this.started = false;

		// Wait for current processing to complete
		if (this.processingPromise) {
			await this.processingPromise;
		}

		// Stop all lifecycle-aware listeners
		for (const [name, listener] of Array.from(this.listeners.entries())) {
			if ('stop' in listener && typeof listener.stop === 'function') {
				try {
					await listener.stop();
				} catch (error) {
					console.error(`Failed to stop listener ${name}:`, error);
				}
			}
		}
	}

	/**
	 * Process events in the queue
	 */
	private async processEvents(): Promise<void> {
		if (this.processing) {
			return;
		}

		this.processing = true;

		try {
			while (this.eventQueue.length > 0) {
				const event = this.eventQueue.shift();
				if (!event) continue;

				// Send to transport if available
				if (this.transport) {
					try {
						await this.transport.sendEvent(event);
					} catch (error) {
						console.error('Transport error:', error);
					}
				}

				// Send to all listeners
				const listenerPromises = Array.from(this.listeners.entries()).map(
					async ([name, listener]) => {
						try {
							await listener.handleEvent(event);
						} catch (error) {
							// Only log errors if not in test environment
							if (
								typeof process !== 'undefined' &&
								process.env.NODE_ENV !== 'test' &&
								!process.env.VITEST
							) {
								console.error(`Listener ${name} error:`, error);
							}
						}
					}
				);

				await Promise.allSettled(listenerPromises);
			}
		} finally {
			this.processing = false;
		}
	}

	/**
	 * Get current queue size (for monitoring)
	 */
	public getQueueSize(): number {
		return this.eventQueue.length;
	}

	/**
	 * Check if event bus is processing
	 */
	public isProcessing(): boolean {
		return this.processing;
	}
}
