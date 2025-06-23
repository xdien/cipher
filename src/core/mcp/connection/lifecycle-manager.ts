/**
 * Connection Lifecycle Manager - Multi-Connection Orchestration
 *
 * Manages the lifecycle of multiple MCP server connections with background tasks,
 * automatic recovery, and coordinated shutdown. Replaces Python's _server_lifecycle_task
 * function with TypeScript structured concurrency patterns.
 */

import { TaskGroup, AbortManager, AsyncLock, AsyncEvent } from '../utils/index.js';
import { ConnectionErrorUtils } from '../errors/connection-errors.js';
import { ServerConnection, ServerConnectionConfig } from './server-connection.js';
import { HealthMonitor, HealthEvent, HealthMonitorConfig } from './health-monitor.js';
import { McpServerConfig } from '../types/config.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * Connection lifecycle state
 */
export type ConnectionLifecycleState =
	| 'initializing'
	| 'running'
	| 'recovering'
	| 'shutting_down'
	| 'shutdown'
	| 'failed';

/**
 * Connection lifecycle information
 */
export interface ConnectionLifecycleInfo {
	serverName: string;
	state: ConnectionLifecycleState;
	connection?: ServerConnection;
	healthMonitor?: HealthMonitor;
	startTime: Date;
	lastStateChange: Date;
	lifecycleTaskId?: string;
	monitorTaskId?: string;
	errorCount: number;
	lastError?: Error;
}

/**
 * Lifecycle manager configuration
 */
export interface LifecycleManagerConfig {
	/** Maximum number of concurrent connections */
	maxConcurrentConnections: number;
	/** Whether to enable automatic recovery */
	enableAutoRecovery: boolean;
	/** Maximum recovery attempts per connection */
	maxRecoveryAttempts: number;
	/** Delay between recovery attempts in milliseconds */
	recoveryDelay: number;
	/** Connection timeout in milliseconds */
	connectionTimeout: number;
	/** Shutdown timeout in milliseconds */
	shutdownTimeout: number;
	/** Health monitor configuration */
	healthMonitor?: Partial<HealthMonitorConfig>;
	/** Whether to start health monitoring automatically */
	autoStartHealthMonitoring: boolean;
}

/**
 * Lifecycle event types
 */
export type LifecycleEventType =
	| 'connection_started'
	| 'connection_ready'
	| 'connection_failed'
	| 'connection_recovered'
	| 'connection_shutdown'
	| 'recovery_started'
	| 'recovery_failed';

/**
 * Lifecycle event
 */
export interface LifecycleEvent {
	type: LifecycleEventType;
	serverName: string;
	timestamp: Date;
	data?: any;
	error?: Error;
}

/**
 * Lifecycle event listener
 */
export type LifecycleEventListener = (event: LifecycleEvent) => void | Promise<void>;

/**
 * Connection lifecycle statistics
 */
export interface LifecycleStatistics {
	totalConnections: number;
	activeConnections: number;
	healthyConnections: number;
	failedConnections: number;
	recoveringConnections: number;
	totalStartAttempts: number;
	totalRecoveryAttempts: number;
	averageStartupTime: number;
	uptime: number;
}

/**
 * Manages the lifecycle of multiple MCP server connections
 */
export class ConnectionLifecycleManager {
	private config: LifecycleManagerConfig;
	private logger: Logger;

	// Connection management
	private connections = new Map<string, ConnectionLifecycleInfo>();
	private connectionLock = new AsyncLock();

	// Task management
	private taskGroup: TaskGroup;
	private abortManager: AbortManager;
	private isShuttingDown = false;
	private shutdownComplete = new AsyncEvent();

	// Event handling
	private eventListeners: Map<LifecycleEventType, LifecycleEventListener[]> = new Map();

	// Statistics
	private startTime = new Date();
	private statistics: LifecycleStatistics = {
		totalConnections: 0,
		activeConnections: 0,
		healthyConnections: 0,
		failedConnections: 0,
		recoveringConnections: 0,
		totalStartAttempts: 0,
		totalRecoveryAttempts: 0,
		averageStartupTime: 0,
		uptime: 0,
	};

	constructor(config: Partial<LifecycleManagerConfig> = {}) {
		this.config = {
			maxConcurrentConnections: 20,
			enableAutoRecovery: true,
			maxRecoveryAttempts: 3,
			recoveryDelay: 10000,
			connectionTimeout: 60000,
			shutdownTimeout: 30000,
			autoStartHealthMonitoring: true,
			...config,
		};

		this.logger = new Logger('connection-lifecycle-manager');

		// Initialize task management
		this.taskGroup = new TaskGroup({
			maxConcurrency: this.config.maxConcurrentConnections + 5, // Extra for monitoring tasks
			abortOnFirstError: false,
		});

		this.abortManager = new AbortManager({
			timeout: this.config.shutdownTimeout,
		});

		this.logger.debug('Created connection lifecycle manager');
	}

	/**
	 * Start a new connection with lifecycle management
	 */
	async startConnection(
		serverName: string,
		serverConfig: McpServerConfig,
		context?: IContext
	): Promise<ServerConnection> {
		return this.connectionLock.withLock(async () => {
			if (this.isShuttingDown) {
				throw new Error('Lifecycle manager is shutting down');
			}

			if (this.connections.has(serverName)) {
				const existingInfo = this.connections.get(serverName)!;
				if (existingInfo.connection && existingInfo.state !== 'failed') {
					this.logger.debug(
						`Connection '${serverName}' already exists and is ${existingInfo.state}`
					);
					return existingInfo.connection;
				}

				// Clean up failed connection
				await this.cleanupConnection(serverName);
			}

			// Check connection limit
			if (this.connections.size >= this.config.maxConcurrentConnections) {
				throw new Error(
					`Maximum concurrent connections (${this.config.maxConcurrentConnections}) reached`
				);
			}

			this.logger.info(`Starting connection lifecycle for server '${serverName}'`);

			// Create connection lifecycle info
			const lifecycleInfo: ConnectionLifecycleInfo = {
				serverName,
				state: 'initializing',
				startTime: new Date(),
				lastStateChange: new Date(),
				errorCount: 0,
			};

			this.connections.set(serverName, lifecycleInfo);
			this.statistics.totalConnections++;
			this.statistics.totalStartAttempts++;

			await this.emitEvent('connection_started', serverName, { serverConfig });

			try {
				// Create server connection
				const connectionConfig: ServerConnectionConfig = {
					serverName,
					serverConfig,
					context,
					connectionTimeout: this.config.connectionTimeout,
					healthCheck: this.config.healthMonitor,
				};

				const connection = new ServerConnection(connectionConfig);
				lifecycleInfo.connection = connection;

				// Start lifecycle task
				lifecycleInfo.lifecycleTaskId = this.taskGroup.startInBackground(async () => {
					await this.runConnectionLifecycle(serverName, connection);
				}, `lifecycle-${serverName}`);

				// Start health monitoring if enabled
				if (this.config.autoStartHealthMonitoring) {
					lifecycleInfo.monitorTaskId = this.taskGroup.startInBackground(async () => {
						await this.runHealthMonitoring(serverName, connection);
					}, `health-monitor-${serverName}`);
				}

				// Wait for connection to be initialized
				await connection.waitForInitialized();

				// Update state
				await this.updateConnectionState(serverName, 'running');
				this.statistics.activeConnections++;

				await this.emitEvent('connection_ready', serverName, {
					connectionState: connection.getConnectionState(),
				});

				this.logger.info(`Successfully started connection lifecycle for server '${serverName}'`);
				return connection;
			} catch (error) {
				await this.handleConnectionStartupError(serverName, error as Error);
				throw error;
			}
		});
	}

	/**
	 * Get a connection by server name
	 */
	async getConnection(serverName: string): Promise<ServerConnection | undefined> {
		const info = this.connections.get(serverName);

		if (!info || !info.connection) {
			return undefined;
		}

		// Check if connection is healthy
		if (info.state === 'running' && info.connection.isHealthy()) {
			return info.connection;
		}

		return undefined;
	}

	/**
	 * Stop a specific connection
	 */
	async stopConnection(serverName: string): Promise<void> {
		return this.connectionLock.withLock(async () => {
			const info = this.connections.get(serverName);

			if (!info) {
				this.logger.debug(`Connection '${serverName}' not found`);
				return;
			}

			this.logger.info(`Stopping connection '${serverName}'`);

			await this.updateConnectionState(serverName, 'shutting_down');

			if (info.connection) {
				info.connection.requestShutdown();
				await info.connection.waitForShutdown();
			}

			await this.cleanupConnection(serverName);
			await this.emitEvent('connection_shutdown', serverName);

			this.logger.info(`Stopped connection '${serverName}'`);
		});
	}

	/**
	 * Stop all connections and shutdown lifecycle manager
	 */
	async shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			await this.shutdownComplete.wait();
			return;
		}

		this.logger.info('Shutting down connection lifecycle manager');
		this.isShuttingDown = true;

		try {
			// Request shutdown for all connections
			const shutdownPromises: Promise<void>[] = [];

			for (const [serverName, info] of this.connections) {
				if (info.connection) {
					info.connection.requestShutdown();
					shutdownPromises.push(info.connection.waitForShutdown());
				}
			}

			// Wait for all connections to shutdown
			await Promise.allSettled(shutdownPromises);

			// Abort all tasks
			this.abortManager.abort('Lifecycle manager shutdown');

			// Wait for all tasks to complete
			await this.taskGroup.waitForAll();

			// Clean up all connections
			for (const serverName of Array.from(this.connections.keys())) {
				await this.cleanupConnection(serverName);
			}

			this.logger.info('Connection lifecycle manager shutdown complete');
		} catch (error) {
			this.logger.error(
				`Error during lifecycle manager shutdown: ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			this.shutdownComplete.set();
		}
	}

	/**
	 * Get all connection information
	 */
	getConnections(): Map<string, ConnectionLifecycleInfo> {
		return new Map(this.connections);
	}

	/**
	 * Get lifecycle statistics
	 */
	getStatistics(): LifecycleStatistics {
		return {
			...this.statistics,
			uptime: Date.now() - this.startTime.getTime(),
			activeConnections: Array.from(this.connections.values()).filter(
				info => info.state === 'running'
			).length,
			healthyConnections: Array.from(this.connections.values()).filter(info =>
				info.connection?.isHealthy()
			).length,
			failedConnections: Array.from(this.connections.values()).filter(
				info => info.state === 'failed'
			).length,
			recoveringConnections: Array.from(this.connections.values()).filter(
				info => info.state === 'recovering'
			).length,
		};
	}

	/**
	 * Add event listener
	 */
	on(eventType: LifecycleEventType, listener: LifecycleEventListener): void {
		if (!this.eventListeners.has(eventType)) {
			this.eventListeners.set(eventType, []);
		}
		this.eventListeners.get(eventType)!.push(listener);
	}

	/**
	 * Remove event listener
	 */
	off(eventType: LifecycleEventType, listener: LifecycleEventListener): void {
		const listeners = this.eventListeners.get(eventType);
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (index >= 0) {
				listeners.splice(index, 1);
			}
		}
	}

	/**
	 * Run connection lifecycle for a single connection
	 */
	private async runConnectionLifecycle(
		serverName: string,
		connection: ServerConnection
	): Promise<void> {
		this.logger.debug(`Starting lifecycle task for connection '${serverName}'`);

		try {
			// Initialize the connection
			await connection.initialize();

			// Wait for shutdown request
			await connection.waitForShutdown();

			this.logger.debug(`Lifecycle task completed for connection '${serverName}'`);
		} catch (error) {
			await this.handleConnectionError(serverName, error as Error);
		}
	}

	/**
	 * Run health monitoring for a connection
	 */
	private async runHealthMonitoring(
		serverName: string,
		connection: ServerConnection
	): Promise<void> {
		const info = this.connections.get(serverName);
		if (!info) {
			return;
		}

		this.logger.debug(`Starting health monitoring for connection '${serverName}'`);

		try {
			// Create health monitor
			const healthMonitor = new HealthMonitor(connection, serverName, this.config.healthMonitor);

			info.healthMonitor = healthMonitor;

			// Set up event listeners
			healthMonitor.on('unhealthy', async event => {
				await this.handleHealthEvent(serverName, event);
			});

			healthMonitor.on('recovered', async event => {
				await this.handleHealthEvent(serverName, event);
			});

			// Start monitoring
			await healthMonitor.start();

			// Wait for shutdown
			await connection.waitForShutdown();

			// Stop monitoring
			await healthMonitor.stop();
		} catch (error) {
			this.logger.warning(
				`Health monitoring error for connection '${serverName}': ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Handle connection startup errors
	 */
	private async handleConnectionStartupError(serverName: string, error: Error): Promise<void> {
		const info = this.connections.get(serverName);
		if (!info) {
			return;
		}

		info.errorCount++;
		info.lastError = error;

		await this.updateConnectionState(serverName, 'failed');
		this.statistics.failedConnections++;

		await this.emitEvent('connection_failed', serverName, undefined, error);

		this.logger.error(`Connection startup failed for '${serverName}': ${error.message}`);

		// Attempt recovery if enabled
		if (this.config.enableAutoRecovery) {
			this.taskGroup.startInBackground(async () => {
				await this.attemptRecovery(serverName);
			}, `recovery-${serverName}`);
		}
	}

	/**
	 * Handle connection errors during lifecycle
	 */
	private async handleConnectionError(serverName: string, error: Error): Promise<void> {
		const info = this.connections.get(serverName);
		if (!info) {
			return;
		}

		info.errorCount++;
		info.lastError = error;

		this.logger.error(`Connection error for '${serverName}': ${error.message}`);

		// Check if error is recoverable
		if (ConnectionErrorUtils.isRecoverable(error)) {
			await this.updateConnectionState(serverName, 'recovering');

			if (this.config.enableAutoRecovery) {
				await this.attemptRecovery(serverName);
			}
		} else {
			await this.updateConnectionState(serverName, 'failed');
			await this.emitEvent('connection_failed', serverName, undefined, error);
		}
	}

	/**
	 * Handle health monitoring events
	 */
	private async handleHealthEvent(serverName: string, event: HealthEvent): Promise<void> {
		this.logger.debug(`Health event for '${serverName}': ${event.type}`);

		switch (event.type) {
			case 'unhealthy':
				if (this.config.enableAutoRecovery) {
					this.taskGroup.startInBackground(async () => {
						await this.attemptRecovery(serverName);
					}, `health-recovery-${serverName}`);
				}
				break;

			case 'recovered':
				await this.updateConnectionState(serverName, 'running');
				await this.emitEvent('connection_recovered', serverName, event.data);
				break;
		}
	}

	/**
	 * Attempt recovery for a failed connection
	 */
	private async attemptRecovery(serverName: string): Promise<boolean> {
		const info = this.connections.get(serverName);
		if (!info || !info.connection) {
			return false;
		}

		if (info.state === 'recovering') {
			this.logger.debug(`Recovery already in progress for '${serverName}'`);
			return false;
		}

		await this.updateConnectionState(serverName, 'recovering');
		this.statistics.totalRecoveryAttempts++;

		await this.emitEvent('recovery_started', serverName, {
			attempts: this.config.maxRecoveryAttempts,
		});

		this.logger.info(`Starting recovery for connection '${serverName}'`);

		try {
			for (let attempt = 1; attempt <= this.config.maxRecoveryAttempts; attempt++) {
				this.logger.debug(
					`Recovery attempt ${attempt}/${this.config.maxRecoveryAttempts} for '${serverName}'`
				);

				try {
					// Reset connection error state
					await info.connection.resetErrorState();

					// Wait for recovery delay
					if (attempt > 1) {
						await new Promise(resolve => setTimeout(resolve, this.config.recoveryDelay));
					}

					// Try to reinitialize if needed
					if (!info.connection.isInitialized()) {
						await info.connection.initialize();
					}

					// Check if connection is healthy
					if (info.connection.isHealthy()) {
						await this.updateConnectionState(serverName, 'running');
						await this.emitEvent('connection_recovered', serverName, {
							attempts: attempt,
						});

						this.logger.info(`Recovery successful for '${serverName}' after ${attempt} attempts`);
						return true;
					}
				} catch (error) {
					this.logger.warning(
						`Recovery attempt ${attempt} failed for '${serverName}': ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}

			// All recovery attempts failed
			await this.updateConnectionState(serverName, 'failed');
			await this.emitEvent('recovery_failed', serverName, {
				attempts: this.config.maxRecoveryAttempts,
			});

			this.logger.error(
				`Recovery failed for '${serverName}' after ${this.config.maxRecoveryAttempts} attempts`
			);
			return false;
		} catch (error) {
			await this.updateConnectionState(serverName, 'failed');
			await this.emitEvent('recovery_failed', serverName, undefined, error as Error);

			this.logger.error(
				`Recovery error for '${serverName}': ${error instanceof Error ? error.message : String(error)}`
			);
			return false;
		}
	}

	/**
	 * Update connection state
	 */
	private async updateConnectionState(
		serverName: string,
		newState: ConnectionLifecycleState
	): Promise<void> {
		const info = this.connections.get(serverName);
		if (!info) {
			return;
		}

		const oldState = info.state;
		info.state = newState;
		info.lastStateChange = new Date();

		this.logger.debug(`Connection '${serverName}' state changed: ${oldState} -> ${newState}`);
	}

	/**
	 * Clean up connection resources
	 */
	private async cleanupConnection(serverName: string): Promise<void> {
		const info = this.connections.get(serverName);
		if (!info) {
			return;
		}

		try {
			// Dispose health monitor
			if (info.healthMonitor) {
				await info.healthMonitor.dispose();
			}

			// Dispose connection
			if (info.connection) {
				await info.connection.dispose();
			}
		} catch (error) {
			this.logger.warning(
				`Error cleaning up connection '${serverName}': ${error instanceof Error ? error.message : String(error)}`
			);
		} finally {
			this.connections.delete(serverName);
		}
	}

	/**
	 * Emit lifecycle event
	 */
	private async emitEvent(
		type: LifecycleEventType,
		serverName: string,
		data?: any,
		error?: Error
	): Promise<void> {
		const event: LifecycleEvent = {
			type,
			serverName,
			timestamp: new Date(),
			data,
			error,
		};

		const listeners = this.eventListeners.get(type) || [];

		for (const listener of listeners) {
			try {
				await listener(event);
			} catch (error) {
				this.logger.warning(
					`Error in lifecycle event listener: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}

	/**
	 * Dispose of the lifecycle manager
	 */
	async dispose(): Promise<void> {
		await this.shutdown();
		this.abortManager.dispose();
		this.eventListeners.clear();
		this.logger.debug('Disposed connection lifecycle manager');
	}
}
