/**
 * LoggingConfig - Configuration and lifecycle management for the logging system
 */

import { EventFilter, EventTransport } from '../types/index.js';
import { AsyncEventBus } from './event-bus.js';
import { ConsoleListener } from '../listeners/index.js';

export interface LoggingConfigOptions {
	eventFilter?: EventFilter;
	transport?: EventTransport;
	batchSize?: number;
	flushInterval?: number;
	progressDisplay?: boolean;
	enableConsoleListener?: boolean;
}

export class LoggingConfig {
	private static initialized = false;
	private static eventBus?: AsyncEventBus;

	/**
	 * Configure the logging system
	 */
	public static async configure(options: LoggingConfigOptions = {}): Promise<void> {
		if (LoggingConfig.initialized) {
			throw new Error('Logging system is already configured');
		}

		const { transport, enableConsoleListener = true } = options;

		// Initialize event bus
		LoggingConfig.eventBus = AsyncEventBus.getInstance(transport);

		// Add default console listener if enabled
		if (enableConsoleListener) {
			const consoleListener = new ConsoleListener({
				colorize: true,
				format: 'pretty',
				includeTimestamp: true,
			});
			LoggingConfig.eventBus.addListener('console', consoleListener);
		}

		// Start the event bus
		await LoggingConfig.eventBus.start();

		LoggingConfig.initialized = true;
	}

	/**
	 * Shutdown the logging system
	 */
	public static async shutdown(): Promise<void> {
		if (!LoggingConfig.initialized || !LoggingConfig.eventBus) {
			return;
		}

		await LoggingConfig.eventBus.stop();
		LoggingConfig.initialized = false;
		LoggingConfig.eventBus = undefined;

		// Reset the singleton
		AsyncEventBus.reset();
	}

	/**
	 * Managed logging context - automatically configure and cleanup
	 */
	public static async managed<T>(
		configOptions: LoggingConfigOptions,
		callback: () => Promise<T>
	): Promise<T> {
		// Shutdown existing configuration if already initialized
		if (LoggingConfig.initialized) {
			await LoggingConfig.shutdown();
		}

		await LoggingConfig.configure(configOptions);

		try {
			return await callback();
		} finally {
			await LoggingConfig.shutdown();
		}
	}

	/**
	 * Check if logging system is initialized
	 */
	public static isInitialized(): boolean {
		return LoggingConfig.initialized;
	}

	/**
	 * Get the current event bus instance
	 */
	public static getEventBus(): AsyncEventBus | undefined {
		return LoggingConfig.eventBus;
	}

	/**
	 * Add a listener to the configured event bus
	 */
	public static addListener(name: string, listener: any): void {
		if (!LoggingConfig.eventBus) {
			throw new Error('Logging system not configured');
		}
		LoggingConfig.eventBus.addListener(name, listener);
	}

	/**
	 * Remove a listener from the configured event bus
	 */
	public static removeListener(name: string): void {
		if (!LoggingConfig.eventBus) {
			throw new Error('Logging system not configured');
		}
		LoggingConfig.eventBus.removeListener(name);
	}
}
