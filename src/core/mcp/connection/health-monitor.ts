/**
 * Health Monitor - Advanced Connection Health Monitoring
 *
 * Provides sophisticated health monitoring for MCP connections with
 * automatic recovery, metrics collection, and alerting capabilities.
 */

import { AsyncLock, TaskGroup, AbortManager } from '../utils/index.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * Health check result
 */
export interface HealthCheckResult {
	isHealthy: boolean;
	timestamp: Date;
	duration: number; // milliseconds
	error?: Error;
	metadata?: Record<string, any>;
}

/**
 * Health metrics
 */
export interface HealthMetrics {
	totalChecks: number;
	successfulChecks: number;
	failedChecks: number;
	consecutiveFailures: number;
	averageResponseTime: number;
	lastSuccessfulCheck?: Date;
	lastFailedCheck?: Date;
	uptime: number; // milliseconds
	availability: number; // percentage
}

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
	/** Interval between health checks in milliseconds */
	checkInterval: number;
	/** Timeout for individual health checks in milliseconds */
	checkTimeout: number;
	/** Maximum consecutive failures before marking as unhealthy */
	maxConsecutiveFailures: number;
	/** Grace period before starting health checks in milliseconds */
	gracePeriod: number;
	/** Enable detailed metrics collection */
	enableMetrics: boolean;
	/** Enable automatic recovery attempts */
	enableAutoRecovery: boolean;
	/** Maximum number of recovery attempts */
	maxRecoveryAttempts: number;
	/** Delay between recovery attempts in milliseconds */
	recoveryDelay: number;
	/** Custom health check function */
	customHealthCheck?: () => Promise<HealthCheckResult>;
}

/**
 * Interface for objects that can be health monitored
 */
export interface HealthMonitorable {
	isHealthy(): boolean;
	getConnectionState(): any;
	resetErrorState(): Promise<void>;
	performHealthCheck?(): Promise<boolean>;
}

/**
 * Health event types
 */
export type HealthEventType =
	| 'healthy'
	| 'unhealthy'
	| 'recovered'
	| 'check_failed'
	| 'recovery_started'
	| 'recovery_failed';

/**
 * Health event
 */
export interface HealthEvent {
	type: HealthEventType;
	timestamp: Date;
	target: string;
	data?: any;
	error?: Error;
}

/**
 * Health event listener
 */
export type HealthEventListener = (event: HealthEvent) => void | Promise<void>;

/**
 * Advanced health monitor with metrics and recovery capabilities
 */
export class HealthMonitor {
	private config: HealthMonitorConfig;
	private target: HealthMonitorable;
	private targetName: string;
	private logger: Logger;

	// State
	private isRunning = false;
	private isPaused = false;
	private isRecovering = false;

	// Task management
	private taskGroup: TaskGroup;
	private abortManager: AbortManager;
	private monitorTaskId?: string;

	// Metrics
	private metrics: HealthMetrics;
	private checkHistory: HealthCheckResult[] = [];
	private startTime: Date;
	private responseTimes: number[] = [];

	// Event handling
	private eventListeners: Map<HealthEventType, HealthEventListener[]> = new Map();

	// Synchronization
	private metricsLock = new AsyncLock();
	private recoveryLock = new AsyncLock();

	constructor(
		target: HealthMonitorable,
		targetName: string,
		config: Partial<HealthMonitorConfig> = {}
	) {
		this.target = target;
		this.targetName = targetName;
		this.logger = new Logger(`health-monitor-${targetName}`);
		this.startTime = new Date();

		// Initialize configuration with defaults
		this.config = {
			checkInterval: 30000, // 30 seconds
			checkTimeout: 5000, // 5 seconds
			maxConsecutiveFailures: 3,
			gracePeriod: 5000, // 5 seconds
			enableMetrics: true,
			enableAutoRecovery: true,
			maxRecoveryAttempts: 3,
			recoveryDelay: 10000, // 10 seconds
			...config,
		};

		// Initialize metrics
		this.metrics = {
			totalChecks: 0,
			successfulChecks: 0,
			failedChecks: 0,
			consecutiveFailures: 0,
			averageResponseTime: 0,
			uptime: 0,
			availability: 100,
		};

		// Initialize task management
		this.taskGroup = new TaskGroup({
			maxConcurrency: 3,
			abortOnFirstError: false,
		});

		this.abortManager = new AbortManager();

		this.logger.debug(`Created health monitor for '${targetName}'`);
	}

	/**
	 * Start health monitoring
	 */
	async start(): Promise<void> {
		if (this.isRunning) {
			this.logger.debug(`Health monitor for '${this.targetName}' is already running`);
			return;
		}

		this.logger.info(`Starting health monitor for '${this.targetName}'`);
		this.isRunning = true;
		this.startTime = new Date();

		// Start monitoring task
		this.monitorTaskId = this.taskGroup.startInBackground(async () => {
			await this.runMonitoringLoop();
		}, 'health-monitor');
	}

	/**
	 * Stop health monitoring
	 */
	async stop(): Promise<void> {
		if (!this.isRunning) {
			return;
		}

		this.logger.info(`Stopping health monitor for '${this.targetName}'`);
		this.isRunning = false;

		// Abort monitoring tasks
		this.abortManager.abort('Health monitor stopped');

		// Wait for tasks to complete
		try {
			await this.taskGroup.waitForAll();
		} catch (error) {
			this.logger.warning(
				`Error waiting for monitoring tasks to complete: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		this.logger.info(`Health monitor stopped for '${this.targetName}'`);
	}

	/**
	 * Pause health monitoring
	 */
	pause(): void {
		this.isPaused = true;
		this.logger.debug(`Health monitor paused for '${this.targetName}'`);
	}

	/**
	 * Resume health monitoring
	 */
	resume(): void {
		this.isPaused = false;
		this.logger.debug(`Health monitor resumed for '${this.targetName}'`);
	}

	/**
	 * Perform a single health check
	 */
	async performHealthCheck(): Promise<HealthCheckResult> {
		const startTime = Date.now();

		try {
			let result: HealthCheckResult;

			if (this.config.customHealthCheck) {
				// Use custom health check function
				result = await Promise.race([this.config.customHealthCheck(), this.createTimeoutPromise()]);
			} else if (this.target.performHealthCheck) {
				// Use target's health check method
				const isHealthy = await Promise.race([
					this.target.performHealthCheck(),
					this.createTimeoutPromise(),
				]);

				result = {
					isHealthy,
					timestamp: new Date(),
					duration: Date.now() - startTime,
				};
			} else {
				// Default health check - just check if target reports healthy
				const isHealthy = this.target.isHealthy();

				result = {
					isHealthy,
					timestamp: new Date(),
					duration: Date.now() - startTime,
				};
			}

			await this.recordHealthCheckResult(result);
			return result;
		} catch (error) {
			const result: HealthCheckResult = {
				isHealthy: false,
				timestamp: new Date(),
				duration: Date.now() - startTime,
				error: error as Error,
			};

			await this.recordHealthCheckResult(result);
			return result;
		}
	}

	/**
	 * Get current health metrics
	 */
	async getMetrics(): Promise<HealthMetrics> {
		return this.metricsLock.withLock(async () => {
			return {
				...this.metrics,
				uptime: Date.now() - this.startTime.getTime(),
				availability: this.calculateAvailability(),
			};
		});
	}

	/**
	 * Get recent health check history
	 */
	getCheckHistory(limit = 50): HealthCheckResult[] {
		return this.checkHistory.slice(-limit);
	}

	/**
	 * Reset metrics and history
	 */
	async resetMetrics(): Promise<void> {
		await this.metricsLock.withLock(async () => {
			this.metrics = {
				totalChecks: 0,
				successfulChecks: 0,
				failedChecks: 0,
				consecutiveFailures: 0,
				averageResponseTime: 0,
				uptime: 0,
				availability: 100,
			};

			this.checkHistory = [];
			this.responseTimes = [];
			this.startTime = new Date();
		});

		this.logger.debug(`Reset metrics for '${this.targetName}'`);
	}

	/**
	 * Add event listener
	 */
	on(eventType: HealthEventType, listener: HealthEventListener): void {
		if (!this.eventListeners.has(eventType)) {
			this.eventListeners.set(eventType, []);
		}
		this.eventListeners.get(eventType)!.push(listener);
	}

	/**
	 * Remove event listener
	 */
	off(eventType: HealthEventType, listener: HealthEventListener): void {
		const listeners = this.eventListeners.get(eventType);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index >= 0) {
				listeners.splice(index, 1);
			}
		}
	}

	/**
	 * Trigger recovery for unhealthy target
	 */
	async triggerRecovery(): Promise<boolean> {
		return this.recoveryLock.withLock(async () => {
			if (this.isRecovering) {
				this.logger.debug(`Recovery already in progress for '${this.targetName}'`);
				return false;
			}

			if (!this.config.enableAutoRecovery) {
				this.logger.debug(`Auto recovery disabled for '${this.targetName}'`);
				return false;
			}

			this.logger.info(`Starting recovery for '${this.targetName}'`);
			this.isRecovering = true;

			await this.emitEvent('recovery_started', {
				attempts: this.config.maxRecoveryAttempts,
			});

			try {
				for (let attempt = 1; attempt <= this.config.maxRecoveryAttempts; attempt++) {
					this.logger.debug(
						`Recovery attempt ${attempt}/${this.config.maxRecoveryAttempts} for '${this.targetName}'`
					);

					try {
						// Reset error state
						await this.target.resetErrorState();

						// Wait for recovery delay
						if (attempt > 1) {
							await new Promise(resolve => setTimeout(resolve, this.config.recoveryDelay));
						}

						// Perform health check
						const result = await this.performHealthCheck();

						if (result.isHealthy) {
							this.logger.info(
								`Recovery successful for '${this.targetName}' after ${attempt} attempts`
							);
							await this.emitEvent('recovered', { attempts: attempt });
							return true;
						}
					} catch (error) {
						this.logger.warning(
							`Recovery attempt ${attempt} failed for '${this.targetName}': ${error instanceof Error ? error.message : String(error)}`
						);
					}
				}

				// All recovery attempts failed
				this.logger.error(
					`Recovery failed for '${this.targetName}' after ${this.config.maxRecoveryAttempts} attempts`
				);
				await this.emitEvent('recovery_failed', {
					attempts: this.config.maxRecoveryAttempts,
				});
				return false;
			} finally {
				this.isRecovering = false;
			}
		});
	}

	/**
	 * Dispose of the health monitor
	 */
	async dispose(): Promise<void> {
		await this.stop();
		this.abortManager.dispose();
		this.eventListeners.clear();
		this.logger.debug(`Disposed health monitor for '${this.targetName}'`);
	}

	/**
	 * Main monitoring loop
	 */
	private async runMonitoringLoop(): Promise<void> {
		// Wait for grace period
		await new Promise(resolve => setTimeout(resolve, this.config.gracePeriod));

		while (this.isRunning && !this.abortManager.aborted) {
			try {
				if (!this.isPaused) {
					const result = await this.performHealthCheck();

					// Handle health state changes
					await this.handleHealthStateChange(result);
				}

				// Wait for next check interval
				await new Promise(resolve => setTimeout(resolve, this.config.checkInterval));
			} catch (error) {
				this.logger.error(
					`Error in monitoring loop for '${this.targetName}': ${error instanceof Error ? error.message : String(error)}`
				);

				// Wait a bit before retrying
				await new Promise(resolve =>
					setTimeout(resolve, Math.min(this.config.checkInterval, 5000))
				);
			}
		}
	}

	/**
	 * Handle health state changes
	 */
	private async handleHealthStateChange(result: HealthCheckResult): Promise<void> {
		const wasHealthy = this.metrics.consecutiveFailures === 0;
		const isHealthy = result.isHealthy;

		if (isHealthy && !wasHealthy) {
			// Recovered
			await this.emitEvent('healthy', result);
		} else if (!isHealthy && wasHealthy) {
			// Became unhealthy
			await this.emitEvent('unhealthy', result);
		} else if (!isHealthy) {
			// Still unhealthy
			await this.emitEvent('check_failed', result);
		}

		// Trigger recovery if needed
		if (!isHealthy && this.metrics.consecutiveFailures >= this.config.maxConsecutiveFailures) {
			if (!this.isRecovering) {
				// Start recovery in background
				this.taskGroup.startInBackground(async () => {
					await this.triggerRecovery();
				}, 'recovery');
			}
		}
	}

	/**
	 * Record health check result and update metrics
	 */
	private async recordHealthCheckResult(result: HealthCheckResult): Promise<void> {
		if (!this.config.enableMetrics) {
			return;
		}

		await this.metricsLock.withLock(async () => {
			// Update basic metrics
			this.metrics.totalChecks++;

			if (result.isHealthy) {
				this.metrics.successfulChecks++;
				this.metrics.consecutiveFailures = 0;
				this.metrics.lastSuccessfulCheck = result.timestamp;
			} else {
				this.metrics.failedChecks++;
				this.metrics.consecutiveFailures++;
				this.metrics.lastFailedCheck = result.timestamp;
			}

			// Update response time metrics
			this.responseTimes.push(result.duration);

			// Keep only recent response times for average calculation
			if (this.responseTimes.length > 100) {
				this.responseTimes = this.responseTimes.slice(-50);
			}

			this.metrics.averageResponseTime =
				this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

			// Add to history
			this.checkHistory.push(result);

			// Keep only recent history
			if (this.checkHistory.length > 1000) {
				this.checkHistory = this.checkHistory.slice(-500);
			}
		});
	}

	/**
	 * Calculate availability percentage
	 */
	private calculateAvailability(): number {
		if (this.metrics.totalChecks === 0) {
			return 100;
		}

		return (this.metrics.successfulChecks / this.metrics.totalChecks) * 100;
	}

	/**
	 * Create timeout promise for health checks
	 */
	private createTimeoutPromise(): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Health check timeout after ${this.config.checkTimeout}ms`));
			}, this.config.checkTimeout);
		});
	}

	/**
	 * Emit health event to listeners
	 */
	private async emitEvent(type: HealthEventType, data?: any, error?: Error): Promise<void> {
		const event: HealthEvent = {
			type,
			timestamp: new Date(),
			target: this.targetName,
			data,
			error,
		};

		const listeners = this.eventListeners.get(type) || [];

		for (const listener of listeners) {
			try {
				await listener(event);
			} catch (error) {
				this.logger.warning(
					`Error in health event listener for '${this.targetName}': ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}
}
