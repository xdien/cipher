/**
 * Circuit Breaker - Connection Failure Protection
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * and provide automatic recovery for failing MCP connections.
 */

import { CircuitBreakerOpenError } from '../errors/recovery-errors.js';

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Configuration for circuit breaker behavior
 */
export interface CircuitBreakerConfig {
	/** Number of failures required to open the circuit */
	failureThreshold: number;
	/** Time in milliseconds to wait before attempting recovery */
	resetTimeoutMs: number;
	/** Timeout for individual operations in milliseconds */
	operationTimeoutMs: number;
	/** Number of successful operations required to close circuit from half-open */
	successThreshold: number;
	/** Window size for rolling failure count */
	rollingWindowMs?: number;
	/** Minimum number of operations in window before opening circuit */
	minimumOperations?: number;
}

/**
 * Statistics about circuit breaker operations
 */
export interface CircuitBreakerStats {
	state: CircuitBreakerState;
	failureCount: number;
	successCount: number;
	totalOperations: number;
	lastFailureTime?: Date;
	lastSuccessTime?: Date;
	nextRetryTime?: Date;
	operationsInWindow: number;
	failureRate: number;
}

/**
 * Result of a circuit breaker operation
 */
export interface OperationResult<T> {
	success: boolean;
	result?: T;
	error?: Error;
	duration: number;
	timestamp: Date;
}

/**
 * Circuit breaker implementation for protecting against cascading failures
 */
export class CircuitBreaker {
	private state: CircuitBreakerState = 'CLOSED';
	private failureCount = 0;
	private successCount = 0;
	private totalOperations = 0;
	private lastFailureTime?: Date;
	private lastSuccessTime?: Date;
	private nextRetryTime?: Date;
	private operationHistory: Array<{ success: boolean; timestamp: Date }> = [];

	constructor(
		private serverName: string,
		private config: CircuitBreakerConfig
	) {
		// Validate configuration
		if (config.failureThreshold <= 0) {
			throw new Error('failureThreshold must be greater than 0');
		}
		if (config.resetTimeoutMs <= 0) {
			throw new Error('resetTimeoutMs must be greater than 0');
		}
		if (config.successThreshold <= 0) {
			throw new Error('successThreshold must be greater than 0');
		}
	}

	/**
	 * Execute an operation through the circuit breaker
	 *
	 * @param operation Function to execute
	 * @returns Promise resolving to operation result
	 */
	async execute<T>(operation: () => Promise<T>): Promise<T> {
		if (!this.canExecute()) {
			throw new CircuitBreakerOpenError(
				`Circuit breaker is open for server '${this.serverName}'`,
				this.serverName,
				this.failureCount,
				this.lastFailureTime!,
				this.nextRetryTime!
			);
		}

		const startTime = Date.now();

		try {
			// Execute operation with timeout
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Operation timed out after ${this.config.operationTimeoutMs}ms`));
				}, this.config.operationTimeoutMs);
			});

			const result = await Promise.race([operation(), timeoutPromise]);

			// Record success
			this.onSuccess();

			return result;
		} catch (error) {
			// Record failure
			this.onFailure(error as Error);
			throw error;
		}
	}

	/**
	 * Check if the circuit breaker allows operation execution
	 *
	 * @returns True if operation can be executed
	 */
	canExecute(): boolean {
		const now = Date.now();

		switch (this.state) {
			case 'CLOSED':
				return true;

			case 'OPEN':
				if (this.nextRetryTime && now >= this.nextRetryTime.getTime()) {
					// Transition to half-open state
					this.state = 'HALF_OPEN';
					this.successCount = 0; // Reset success count for half-open evaluation
					return true;
				}
				return false;

			case 'HALF_OPEN':
				return true;

			default:
				return false;
		}
	}

	/**
	 * Force the circuit breaker to open
	 */
	forceOpen(): void {
		this.state = 'OPEN';
		this.nextRetryTime = new Date(Date.now() + this.config.resetTimeoutMs);
	}

	/**
	 * Force the circuit breaker to close
	 */
	forceClose(): void {
		this.state = 'CLOSED';
		this.failureCount = 0;
		this.successCount = 0;
		this.nextRetryTime = undefined;
	}

	/**
	 * Reset the circuit breaker to initial state
	 */
	reset(): void {
		this.state = 'CLOSED';
		this.failureCount = 0;
		this.successCount = 0;
		this.totalOperations = 0;
		this.lastFailureTime = undefined;
		this.lastSuccessTime = undefined;
		this.nextRetryTime = undefined;
		this.operationHistory = [];
	}

	/**
	 * Get current circuit breaker statistics
	 *
	 * @returns Current statistics
	 */
	getStats(): CircuitBreakerStats {
		this.cleanupOperationHistory();

		const operationsInWindow = this.operationHistory.length;
		const failuresInWindow = this.operationHistory.filter(op => !op.success).length;
		const failureRate = operationsInWindow > 0 ? failuresInWindow / operationsInWindow : 0;

		return {
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			totalOperations: this.totalOperations,
			lastFailureTime: this.lastFailureTime,
			lastSuccessTime: this.lastSuccessTime,
			nextRetryTime: this.nextRetryTime,
			operationsInWindow,
			failureRate,
		};
	}

	/**
	 * Get current state
	 *
	 * @returns Current circuit breaker state
	 */
	getState(): CircuitBreakerState {
		// Update state based on current conditions
		this.canExecute();
		return this.state;
	}

	/**
	 * Get time until next retry is allowed (for open state)
	 *
	 * @returns Milliseconds until retry, or 0 if retry is allowed
	 */
	getTimeUntilRetry(): number {
		if (this.state !== 'OPEN' || !this.nextRetryTime) {
			return 0;
		}
		return Math.max(0, this.nextRetryTime.getTime() - Date.now());
	}

	/**
	 * Check if circuit should be opened based on current metrics
	 */
	private shouldOpenCircuit(): boolean {
		this.cleanupOperationHistory();

		// Check if we have minimum operations for evaluation
		const minimumOps = this.config.minimumOperations || this.config.failureThreshold;
		if (this.operationHistory.length < minimumOps) {
			return false;
		}

		// Check failure rate if rolling window is configured
		if (this.config.rollingWindowMs) {
			const failuresInWindow = this.operationHistory.filter(op => !op.success).length;
			const failureRate = failuresInWindow / this.operationHistory.length;
			return failureRate >= this.config.failureThreshold / minimumOps;
		} else {
			// Use consecutive failures
			return this.failureCount >= this.config.failureThreshold;
		}
	}

	/**
	 * Handle successful operation
	 */
	private onSuccess(): void {
		this.totalOperations++;
		this.successCount++;
		this.lastSuccessTime = new Date();

		// Add to operation history
		this.operationHistory.push({
			success: true,
			timestamp: new Date(),
		});

		switch (this.state) {
			case 'CLOSED':
				// Reset failure count on success
				this.failureCount = 0;
				break;

			case 'HALF_OPEN':
				// Check if we have enough successes to close circuit
				if (this.successCount >= this.config.successThreshold) {
					this.state = 'CLOSED';
					this.failureCount = 0;
					this.nextRetryTime = undefined;
				}
				break;

			case 'OPEN':
				// Shouldn't happen, but handle gracefully
				this.state = 'HALF_OPEN';
				this.successCount = 1;
				break;
		}
	}

	/**
	 * Handle failed operation
	 */
	private onFailure(error: Error): void {
		this.totalOperations++;
		this.failureCount++;
		this.lastFailureTime = new Date();

		// Add to operation history
		this.operationHistory.push({
			success: false,
			timestamp: new Date(),
		});

		switch (this.state) {
			case 'CLOSED':
				if (this.shouldOpenCircuit()) {
					this.state = 'OPEN';
					this.nextRetryTime = new Date(Date.now() + this.config.resetTimeoutMs);
				}
				break;

			case 'HALF_OPEN':
				// Any failure in half-open state opens the circuit
				this.state = 'OPEN';
				this.nextRetryTime = new Date(Date.now() + this.config.resetTimeoutMs);
				this.successCount = 0;
				break;

			case 'OPEN':
				// Update next retry time
				this.nextRetryTime = new Date(Date.now() + this.config.resetTimeoutMs);
				break;
		}
	}

	/**
	 * Clean up old entries from operation history
	 */
	private cleanupOperationHistory(): void {
		if (!this.config.rollingWindowMs) {
			return;
		}

		const cutoffTime = new Date(Date.now() - this.config.rollingWindowMs);
		this.operationHistory = this.operationHistory.filter(op => op.timestamp > cutoffTime);
	}

	/**
	 * Create a circuit breaker with default configuration
	 */
	static createDefault(serverName: string): CircuitBreaker {
		return new CircuitBreaker(serverName, {
			failureThreshold: 5,
			resetTimeoutMs: 60000, // 1 minute
			operationTimeoutMs: 30000, // 30 seconds
			successThreshold: 3,
			rollingWindowMs: 60000, // 1 minute rolling window
			minimumOperations: 10,
		});
	}

	/**
	 * Create a circuit breaker for testing with fast recovery
	 */
	static createForTesting(serverName: string): CircuitBreaker {
		return new CircuitBreaker(serverName, {
			failureThreshold: 2,
			resetTimeoutMs: 1000, // 1 second
			operationTimeoutMs: 5000, // 5 seconds
			successThreshold: 1,
			rollingWindowMs: 10000, // 10 seconds
			minimumOperations: 2,
		});
	}
}
