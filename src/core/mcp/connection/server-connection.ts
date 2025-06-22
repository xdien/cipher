/**
 * ServerConnection - Individual Server Connection Management
 * 
 * Manages the lifecycle of a single MCP server connection, including
 * initialization, health monitoring, error recovery, and graceful shutdown.
 */


import { AsyncEvent, AsyncLock, TaskGroup, AbortManager } from '../utils/index.js';
import {
  ConnectionFailureError,
  ConnectionLostError,
  ConnectionErrorUtils
} from '../errors/connection-errors.js';

import { CircuitBreaker, CircuitBreakerConfig } from '../recovery/circuit-breaker.js';
import { RetryStrategy, RetryConfig } from '../recovery/retry-strategy.js';
import { TransportFactory, TransportInstance, TransportCreationConfig } from './transport-factory.js';
import { McpServerConfig } from '../types/config.js';
import { IEnhancedMCPClient } from '../types/enhanced-client.js';
import { MCPAgentClientSession } from '../client/agent-session.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * Connection state information
 */
export interface ConnectionState {
  isHealthy: boolean;
  isInitialized: boolean;
  hasError: boolean;
  errorMessage?: string;
  lastHealthCheck?: Date;
  connectionAttempts: number;
  lastReconnectAttempt?: Date;
  consecutiveFailures: number;
  uptime: number; // in milliseconds
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  maxConsecutiveFailures: number;
  gracePeriod: number; // milliseconds before first health check
}

/**
 * Server connection configuration
 */
export interface ServerConnectionConfig {
  serverName: string;
  serverConfig: McpServerConfig;
  context?: IContext;
  sessionIdCallback?: () => string | null;
  healthCheck?: Partial<HealthCheckConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  retry?: Partial<RetryConfig>;
  connectionTimeout?: number;
}

/**
 * Manages a persistent connection to a single MCP server
 */
export class ServerConnection {
  private state: ConnectionState;
  private client: IEnhancedMCPClient | null = null;
  private transport: TransportInstance | null = null;
  
  // Event coordination
  private initializedEvent = new AsyncEvent();
  private shutdownRequested = new AsyncEvent();
  private shutdownComplete = new AsyncEvent();
  
  // Task management
  private taskGroup: TaskGroup;
  private abortManager: AbortManager;
  private healthCheckTaskId?: string;
  
  // Resilience components
  private circuitBreaker: CircuitBreaker;
  private retryStrategy: RetryStrategy;
  
  // Configuration
  private config: ServerConnectionConfig;
  private healthCheckConfig: HealthCheckConfig;
  
  // Synchronization
  private stateLock = new AsyncLock();
  private connectionLock = new AsyncLock();
  
  // Logging
  private logger: Logger;
  
  // Metrics
  private startTime: Date;
  private lastSuccessfulOperation?: Date;
  private operationCount = 0;

  constructor(config: ServerConnectionConfig) {
    this.config = config;
    this.logger = config.context?.logger || new Logger(`server-connection-${config.serverName}`);
    this.startTime = new Date();
    
    // Initialize state
    this.state = {
      isHealthy: false,
      isInitialized: false,
      hasError: false,
      connectionAttempts: 0,
      consecutiveFailures: 0,
      uptime: 0,
    };

    // Initialize health check configuration
    this.healthCheckConfig = {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      maxConsecutiveFailures: 3,
      gracePeriod: 5000, // 5 seconds
      ...config.healthCheck,
    };

    // Initialize resilience components
    this.circuitBreaker = new CircuitBreaker(config.serverName, {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      operationTimeoutMs: 30000,
      successThreshold: 2,
      rollingWindowMs: 60000,
      minimumOperations: 5,
      ...config.circuitBreaker,
    });

    this.retryStrategy = new RetryStrategy(config.serverName, {
      strategy: 'exponential',
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true,
      jitterFactor: 0.1,
      maxTotalTimeMs: 120000, // 2 minutes
      ...config.retry,
    });

    // Initialize task management
    this.taskGroup = new TaskGroup({
      maxConcurrency: 5,
      abortOnFirstError: false,
    });

    this.abortManager = new AbortManager({
      timeout: config.connectionTimeout || 60000,
    });

    this.logger.debug(`Created server connection for '${config.serverName}'`);
  }

  /**
   * Initialize the connection
   */
  async initialize(): Promise<void> {
    return this.connectionLock.withLock(async () => {
      if (this.state.isInitialized) {
        this.logger.debug(`Server '${this.config.serverName}' is already initialized`);
        return;
      }

      this.logger.info(`Initializing connection to server '${this.config.serverName}'`);

      try {
        await this.retryStrategy.execute(async () => {
          await this.createAndInitializeSession();
        });

        await this.stateLock.withLock(async () => {
          this.state.isInitialized = true;
          this.state.isHealthy = true;
          this.state.hasError = false;
          this.state.errorMessage = undefined;
          this.lastSuccessfulOperation = new Date();
        });

        // Signal initialization complete
        this.initializedEvent.set();

        // Start health monitoring if enabled
        if (this.healthCheckConfig.enabled) {
          this.startHealthMonitoring();
        }

        this.logger.info(`Successfully initialized connection to server '${this.config.serverName}'`);

      } catch (error) {
        await this.handleConnectionError(error as Error);
        throw error;
      }
    });
  }

  /**
   * Get the MCP client session
   */
  async getSession(): Promise<IEnhancedMCPClient> {
    // Wait for initialization if not yet initialized
    if (!this.state.isInitialized) {
      await this.waitForInitialized();
    }

    if (!this.client) {
      throw new ConnectionLostError(
        `No client session available for server '${this.config.serverName}'`,
        this.config.serverName,
        this.lastSuccessfulOperation
      );
    }

    return this.client;
  }

  /**
   * Wait for the connection to be initialized
   */
  async waitForInitialized(): Promise<void> {
    if (this.state.isInitialized) {
      return;
    }

    await this.initializedEvent.wait();
  }

  /**
   * Request graceful shutdown
   */
  requestShutdown(): void {
    if (this.shutdownRequested.isSet()) {
      return;
    }

    this.logger.info(`Shutdown requested for server '${this.config.serverName}'`);
    this.shutdownRequested.set();
    
    // Trigger async shutdown process
    this.taskGroup.startInBackground(async () => {
      await this.performShutdown();
    }, 'shutdown');
  }

  /**
   * Wait for shutdown to complete
   */
  async waitForShutdown(): Promise<void> {
    if (this.shutdownComplete.isSet()) {
      return;
    }

    await this.shutdownComplete.wait();
  }

  /**
   * Check if the connection is healthy
   */
  isHealthy(): boolean {
    return this.state.isHealthy;
  }

  /**
   * Check if the connection is initialized
   */
  isInitialized(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return {
      ...this.state,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Reset error state
   */
  async resetErrorState(): Promise<void> {
    await this.stateLock.withLock(async () => {
      this.state.hasError = false;
      this.state.errorMessage = undefined;
      this.state.consecutiveFailures = 0;
    });

    this.circuitBreaker.reset();
    this.retryStrategy.reset();
    
    this.logger.debug(`Reset error state for server '${this.config.serverName}'`);
  }

  /**
   * Get connection statistics
   */
  getStatistics(): Record<string, any> {
    const circuitBreakerStats = this.circuitBreaker.getStats();
    
    return {
      serverName: this.config.serverName,
      state: this.getConnectionState(),
      circuitBreaker: circuitBreakerStats,
      retry: {
        attempts: this.retryStrategy.getAttemptHistory().length,
        totalElapsed: this.retryStrategy.getTotalElapsedTime(),
      },
      operations: {
        total: this.operationCount,
        lastSuccessful: this.lastSuccessfulOperation,
      },
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Create and initialize client session
   */
  private async createAndInitializeSession(): Promise<void> {
    this.logger.debug(`Creating session for server '${this.config.serverName}'`);

    await this.stateLock.withLock(async () => {
      this.state.connectionAttempts++;
    });

    try {
      // Create transport
      const transportConfig: TransportCreationConfig = {
        serverName: this.config.serverName,
        sessionId: this.config.sessionIdCallback?.(),
        connectionAttempts: this.state.connectionAttempts,
        timeout: this.config.connectionTimeout,
      };

      this.transport = await TransportFactory.createTransport(
        this.config.serverConfig,
        transportConfig
      );

      // Create enhanced client session
      this.client = new MCPAgentClientSession({
        serverConfig: this.config.serverConfig,
        serverName: this.config.serverName,
        context: this.config.context,
        sessionIdCallback: this.config.sessionIdCallback,
      });

      // Connect the client
      await this.client.connect(this.config.serverConfig, this.config.serverName);

      this.logger.debug(`Successfully created session for server '${this.config.serverName}'`);

    } catch (error) {
      // Clean up on failure
      await this.cleanupSession();
      throw new ConnectionFailureError(
        `Failed to create session: ${error instanceof Error ? error.message : String(error)}`,
        this.config.serverName,
        this.state.connectionAttempts,
        error as Error
      );
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTaskId) {
      this.logger.debug(`Health monitoring already started for server '${this.config.serverName}'`);
      return;
    }

    this.logger.debug(`Starting health monitoring for server '${this.config.serverName}'`);

    this.healthCheckTaskId = this.taskGroup.startInBackground(async () => {
      // Wait for grace period
      await new Promise(resolve => setTimeout(resolve, this.healthCheckConfig.gracePeriod));

      while (!this.shutdownRequested.isSet()) {
        try {
          await this.performHealthCheck();
          await new Promise(resolve => setTimeout(resolve, this.healthCheckConfig.interval));
        } catch (error) {
          this.logger.warning(`Health check task error for server '${this.config.serverName}': ${error instanceof Error ? error.message : String(error)}`);
          break;
        }
      }
    }, 'health-monitor');
  }

  /**
   * Perform a health check
   */
  async performHealthCheck(): Promise<boolean> {
    if (!this.client || this.shutdownRequested.isSet()) {
      return false;
    }

    this.logger.debug(`Performing health check for server '${this.config.serverName}'`);

    try {
      // Use circuit breaker for health check
      await this.circuitBreaker.execute(async () => {
        // Simple health check - list prompts with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), this.healthCheckConfig.timeout);
        });

        await Promise.race([
          this.client!.listPrompts(),
          timeoutPromise,
        ]);
      });

      // Health check successful
      await this.stateLock.withLock(async () => {
        this.state.isHealthy = true;
        this.state.lastHealthCheck = new Date();
        this.state.consecutiveFailures = 0;
      });

      this.lastSuccessfulOperation = new Date();
      this.logger.debug(`Health check passed for server '${this.config.serverName}'`);
      
      return true;

    } catch (error) {
      await this.handleHealthCheckFailure(error as Error);
      return false;
    }
  }

  /**
   * Handle health check failure
   */
  private async handleHealthCheckFailure(error: Error): Promise<void> {
    await this.stateLock.withLock(async () => {
      this.state.consecutiveFailures++;
      this.state.lastHealthCheck = new Date();
      
      if (this.state.consecutiveFailures >= this.healthCheckConfig.maxConsecutiveFailures) {
        this.state.isHealthy = false;
        this.state.hasError = true;
        this.state.errorMessage = `Health check failed ${this.state.consecutiveFailures} times: ${error.message}`;
      }
    });

    this.logger.warning(`Health check failed for server '${this.config.serverName}' (${this.state.consecutiveFailures}/${this.healthCheckConfig.maxConsecutiveFailures}): ${error.message}`);

    // If we've exceeded max failures, trigger recovery
    if (this.state.consecutiveFailures >= this.healthCheckConfig.maxConsecutiveFailures) {
      this.logger.error(`Max consecutive health check failures reached for server '${this.config.serverName}', marking as unhealthy`);
      
      // Optionally trigger reconnection here
      // await this.triggerReconnection();
    }
  }

  /**
   * Handle connection errors
   */
  private async handleConnectionError(error: Error): Promise<void> {
    const normalizedError = ConnectionErrorUtils.normalize(error, this.config.serverName);
    
    await this.stateLock.withLock(async () => {
      this.state.hasError = true;
      this.state.errorMessage = normalizedError.message;
      this.state.isHealthy = false;
      
      if (normalizedError.recoverable) {
        this.state.lastReconnectAttempt = new Date();
      }
    });

    this.logger.error(`Connection error for server '${this.config.serverName}': ${normalizedError.getUserFriendlyMessage()}`);
  }

  /**
   * Perform graceful shutdown
   */
  private async performShutdown(): Promise<void> {
    this.logger.info(`Starting shutdown for server '${this.config.serverName}'`);

    try {
      // Abort all operations
      this.abortManager.abort('Server connection shutdown');

      // Stop health monitoring
      if (this.healthCheckTaskId) {
        // Health check task will stop on shutdown signal
        this.healthCheckTaskId = undefined;
      }

      // Wait for all tasks to complete or timeout
      try {
        await this.taskGroup.waitForAll();
      } catch (error) {
        this.logger.warning(`Error waiting for tasks to complete during shutdown: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Clean up session
      await this.cleanupSession();

      await this.stateLock.withLock(async () => {
        this.state.isInitialized = false;
        this.state.isHealthy = false;
      });

      this.logger.info(`Shutdown completed for server '${this.config.serverName}'`);

    } catch (error) {
      this.logger.error(`Error during shutdown for server '${this.config.serverName}': ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.shutdownComplete.set();
    }
  }

  /**
   * Clean up client session and transport
   */
  private async cleanupSession(): Promise<void> {
    // Dispose client
    if (this.client) {
      try {
        if (typeof this.client.disconnect === 'function') {
          await this.client.disconnect();
        }
      } catch (error) {
        this.logger.warning(`Error disconnecting client for server '${this.config.serverName}': ${error instanceof Error ? error.message : String(error)}`);
      }
      this.client = null;
    }

    // Dispose transport
    if (this.transport) {
      try {
        await TransportFactory.disposeTransport(this.transport);
      } catch (error) {
        this.logger.warning(`Error disposing transport for server '${this.config.serverName}': ${error instanceof Error ? error.message : String(error)}`);
      }
      this.transport = null;
    }
  }

  /**
   * Dispose of the server connection
   */
  async dispose(): Promise<void> {
    if (!this.shutdownComplete.isSet()) {
      this.requestShutdown();
      await this.waitForShutdown();
    }

    this.abortManager.dispose();
    this.logger.debug(`Disposed server connection for '${this.config.serverName}'`);
  }
} 