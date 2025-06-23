/**
 * Retry Strategy - Connection Recovery Patterns
 *
 * Implements various retry strategies for recovering from connection failures,
 * including exponential backoff, fixed delay, and linear backoff patterns.
 */

import { RetryExhaustedError, RecoveryTimeoutError } from '../errors/recovery-errors.js';
import { ConnectionErrorUtils } from '../errors/connection-errors.js';

/**
 * Retry strategy types
 */
export type RetryStrategyType = 'exponential' | 'linear' | 'fixed' | 'immediate' | 'custom';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
	/** Type of retry strategy */
	strategy: RetryStrategyType;
	/** Maximum number of retry attempts */
	maxAttempts: number;
	/** Base delay in milliseconds */
	baseDelayMs: number;
	/** Maximum delay in milliseconds */
	maxDelayMs: number;
	/** Multiplier for exponential backoff */
	backoffMultiplier: number;
	/** Maximum total time for all retry attempts */
	maxTotalTimeMs?: number;
	/** Whether to add jitter to delays */
	jitter: boolean;
	/** Jitter factor (0.0 to 1.0) */
	jitterFactor: number;
	/** Custom delay calculation function */
	customDelayFn?: (attempt: number, error: Error) => number;
	/** Function to determine if error is retryable */
	isRetryableError?: (error: Error) => boolean;
}

/**
 * Context for a retry attempt
 */
export interface RetryAttempt {
	attempt: number;
	timestamp: Date;
	error: Error;
	delayMs?: number;
	totalElapsedMs: number;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
	success: boolean;
	result?: T;
	error?: Error;
	attempts: number;
	totalTimeMs: number;
	attemptHistory: RetryAttempt[];
}

/**
 * Retry strategy implementation with various backoff patterns
 */
export class RetryStrategy {
	private attempts: RetryAttempt[] = [];
	private startTime?: Date;

	constructor(
		private serverName: string,
		private config: RetryConfig
	) {
		this.validateConfig();
	}

	/**
	 * Execute an operation with retry logic
	 *
	 * @param operation Function to execute with retry
	 * @returns Promise resolving to retry result
	 */
	async execute<T>(operation: () => Promise<T>): Promise<T> {
		this.reset();
		this.startTime = new Date();

		for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
			try {
				const result = await operation();

				// Success - return result
				return result;
			} catch (error) {
				const now = new Date();
				const totalElapsed = now.getTime() - this.startTime.getTime();

				const retryAttempt: RetryAttempt = {
					attempt,
					timestamp: now,
					error: error as Error,
					totalElapsedMs: totalElapsed,
				};

				this.attempts.push(retryAttempt);

				// Check if we should retry this error
				if (!this.shouldRetryError(error as Error)) {
					throw new RetryExhaustedError(
						`Non-retryable error for server '${this.serverName}': ${(error as Error).message}`,
						this.serverName,
						attempt,
						error as Error,
						this.attempts
					);
				}

				// Check if we've reached max attempts
				if (attempt >= this.config.maxAttempts) {
					throw new RetryExhaustedError(
						`Max retry attempts (${this.config.maxAttempts}) exceeded for server '${this.serverName}'`,
						this.serverName,
						attempt,
						error as Error,
						this.attempts
					);
				}

				// Check if we've exceeded total time limit
				if (this.config.maxTotalTimeMs && totalElapsed >= this.config.maxTotalTimeMs) {
					throw new RecoveryTimeoutError(
						`Retry timeout (${this.config.maxTotalTimeMs}ms) exceeded for server '${this.serverName}'`,
						this.serverName,
						this.config.maxTotalTimeMs,
						this.startTime,
						attempt
					);
				}

				// Calculate delay for next attempt
				const delay = this.calculateDelay(attempt, error as Error);
				retryAttempt.delayMs = delay;

				// Wait before next attempt
				if (delay > 0) {
					await this.sleep(delay);
				}

				// Check total time again after delay
				const totalElapsedAfterDelay = Date.now() - this.startTime.getTime();
				if (this.config.maxTotalTimeMs && totalElapsedAfterDelay >= this.config.maxTotalTimeMs) {
					throw new RecoveryTimeoutError(
						`Retry timeout (${this.config.maxTotalTimeMs}ms) exceeded for server '${this.serverName}' after delay`,
						this.serverName,
						this.config.maxTotalTimeMs,
						this.startTime,
						attempt
					);
				}
			}
		}

		// This should never be reached due to the max attempts check above
		throw new RetryExhaustedError(
			`Unexpected end of retry loop for server '${this.serverName}'`,
			this.serverName,
			this.config.maxAttempts,
			new Error('Unknown error'),
			this.attempts
		);
	}

	/**
	 * Get current retry statistics
	 *
	 * @returns Current retry attempt information
	 */
	getAttemptHistory(): RetryAttempt[] {
		return [...this.attempts];
	}

	/**
	 * Get total elapsed time since first attempt
	 *
	 * @returns Elapsed time in milliseconds
	 */
	getTotalElapsedTime(): number {
		if (!this.startTime) return 0;
		return Date.now() - this.startTime.getTime();
	}

	/**
	 * Reset retry state
	 */
	reset(): void {
		this.attempts = [];
		this.startTime = undefined;
	}

	/**
	 * Calculate delay for next retry attempt
	 */
	private calculateDelay(attempt: number, error: Error): number {
		let delay: number;

		switch (this.config.strategy) {
			case 'immediate':
				delay = 0;
				break;

			case 'fixed':
				delay = this.config.baseDelayMs;
				break;

			case 'linear':
				delay = this.config.baseDelayMs * attempt;
				break;

			case 'exponential':
				delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
				break;

			case 'custom':
				if (this.config.customDelayFn) {
					delay = this.config.customDelayFn(attempt, error);
				} else {
					throw new Error('Custom delay function not provided for custom retry strategy');
				}
				break;

			default:
				delay = this.config.baseDelayMs;
				break;
		}

		// Apply maximum delay limit
		delay = Math.min(delay, this.config.maxDelayMs);

		// Apply jitter if enabled
		if (this.config.jitter) {
			const jitterRange = delay * this.config.jitterFactor;
			const jitterOffset = (Math.random() - 0.5) * 2 * jitterRange;
			delay = Math.max(0, delay + jitterOffset);
		}

		return Math.floor(delay);
	}

	/**
	 * Check if an error should be retried
	 */
	private shouldRetryError(error: Error): boolean {
		if (this.config.isRetryableError) {
			return this.config.isRetryableError(error);
		}

		// Use default retry logic
		return ConnectionErrorUtils.isRecoverable(error);
	}

	/**
	 * Sleep for specified duration
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Validate retry configuration
	 */
	private validateConfig(): void {
		if (this.config.maxAttempts <= 0) {
			throw new Error('maxAttempts must be greater than 0');
		}
		if (this.config.baseDelayMs < 0) {
			throw new Error('baseDelayMs must be non-negative');
		}
		if (this.config.maxDelayMs < this.config.baseDelayMs) {
			throw new Error('maxDelayMs must be greater than or equal to baseDelayMs');
		}
		if (this.config.backoffMultiplier <= 0) {
			throw new Error('backoffMultiplier must be greater than 0');
		}
		if (this.config.jitterFactor < 0 || this.config.jitterFactor > 1) {
			throw new Error('jitterFactor must be between 0 and 1');
		}
		if (this.config.maxTotalTimeMs && this.config.maxTotalTimeMs <= 0) {
			throw new Error('maxTotalTimeMs must be greater than 0 if specified');
		}
	}

	/**
	 * Create a retry strategy with exponential backoff
	 */
	static createExponentialBackoff(
		serverName: string,
		maxAttempts = 5,
		baseDelayMs = 1000,
		maxDelayMs = 30000
	): RetryStrategy {
		return new RetryStrategy(serverName, {
			strategy: 'exponential',
			maxAttempts,
			baseDelayMs,
			maxDelayMs,
			backoffMultiplier: 2,
			jitter: true,
			jitterFactor: 0.1,
		});
	}

	/**
	 * Create a retry strategy with linear backoff
	 */
	static createLinearBackoff(
		serverName: string,
		maxAttempts = 3,
		baseDelayMs = 2000,
		maxDelayMs = 10000
	): RetryStrategy {
		return new RetryStrategy(serverName, {
			strategy: 'linear',
			maxAttempts,
			baseDelayMs,
			maxDelayMs,
			backoffMultiplier: 1,
			jitter: true,
			jitterFactor: 0.1,
		});
	}

	/**
	 * Create a retry strategy with fixed delay
	 */
	static createFixedDelay(serverName: string, maxAttempts = 3, delayMs = 5000): RetryStrategy {
		return new RetryStrategy(serverName, {
			strategy: 'fixed',
			maxAttempts,
			baseDelayMs: delayMs,
			maxDelayMs: delayMs,
			backoffMultiplier: 1,
			jitter: false,
			jitterFactor: 0,
		});
	}

	/**
	 * Create a retry strategy with immediate retries
	 */
	static createImmediate(serverName: string, maxAttempts = 2): RetryStrategy {
		return new RetryStrategy(serverName, {
			strategy: 'immediate',
			maxAttempts,
			baseDelayMs: 0,
			maxDelayMs: 0,
			backoffMultiplier: 1,
			jitter: false,
			jitterFactor: 0,
		});
	}

	/**
	 * Create a retry strategy for testing with fast retries
	 */
	static createForTesting(serverName: string): RetryStrategy {
		return new RetryStrategy(serverName, {
			strategy: 'exponential',
			maxAttempts: 3,
			baseDelayMs: 100,
			maxDelayMs: 1000,
			backoffMultiplier: 2,
			jitter: false,
			jitterFactor: 0,
			maxTotalTimeMs: 5000,
		});
	}

	/**
	 * Create a custom retry strategy
	 */
	static createCustom(
		serverName: string,
		config: Partial<RetryConfig> & {
			customDelayFn: (attempt: number, error: Error) => number;
		}
	): RetryStrategy {
		const fullConfig: RetryConfig = {
			strategy: 'custom',
			maxAttempts: 5,
			baseDelayMs: 1000,
			maxDelayMs: 30000,
			backoffMultiplier: 2,
			jitter: false,
			jitterFactor: 0,
			...config,
		};

		return new RetryStrategy(serverName, fullConfig);
	}
}
