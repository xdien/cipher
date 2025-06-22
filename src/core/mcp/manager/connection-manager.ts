/**
 * MCP Connection Manager - Pure Connection Pool Management
 * 
 * Provides connection pooling and lifecycle management for MCP servers.
 * Resource discovery and aggregation is delegated to MCPAggregator.
 */

import { AsyncLock, AsyncEvent } from '../utils/index.js';
import { 
  ConnectionFailureError
} from '../errors/connection-errors.js';
import { 
  ConnectionLifecycleManager,
  LifecycleManagerConfig,
  ConnectionLifecycleInfo,
  LifecycleEvent,
} from '../connection/lifecycle-manager.js';
import { 
  ServerConnection,
} from '../connection/server-connection.js';
import { HealthMetrics } from '../connection/health-monitor.js';
import { ServerConfigs, McpServerConfig } from '../types/config.js';
import { 
  ConnectionPoolConfig, 
  DEFAULT_CONNECTION_POOL_CONFIG
} from '../types/connection-config.js';
import { IEnhancedMCPClient } from '../types/enhanced-client.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * Connection pool statistics
 */
export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  healthyConnections: number;
  failedConnections: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  poolUtilization: number; // percentage
  uptime: number;
}

/**
 * Connection request options
 */
export interface ConnectionRequestOptions {
  timeout?: number;
  retryAttempts?: number;
  requireHealthy?: boolean;
  preferCached?: boolean;
}

/**
 * Pure connection pool manager without aggregation logic
 */
export class MCPConnectionManager {
  private config: ConnectionPoolConfig;
  private lifecycleManager: ConnectionLifecycleManager;
  private logger: Logger;
  
  // State management
  private isInitialized = false;
  private isShuttingDown = false;
  private initializationLock = new AsyncLock();
  private shutdownComplete = new AsyncEvent();
  
  // Statistics
  private stats: ConnectionPoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    healthyConnections: 0,
    failedConnections: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    poolUtilization: 0,
    uptime: 0,
  };
  private startTime = new Date();
  private requestTimes: number[] = [];
  
  // Context
  private context?: IContext;

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = {
      ...DEFAULT_CONNECTION_POOL_CONFIG,
      ...config,
    };

    this.logger = new Logger('mcp-connection-manager');

    // Create lifecycle manager
    const lifecycleConfig: Partial<LifecycleManagerConfig> = {
      maxConcurrentConnections: this.config.maxPoolSize,
      connectionTimeout: this.config.connectionTimeout,
      enableAutoRecovery: true,
      maxRecoveryAttempts: this.config.maxRetryAttempts,
      autoStartHealthMonitoring: true,
      healthMonitor: {
        checkInterval: this.config.healthCheckInterval,
      },
    };

    this.lifecycleManager = new ConnectionLifecycleManager(lifecycleConfig);

    // Set up lifecycle event listeners
    this.setupEventListeners();

    this.logger.debug('Created MCP connection manager');
  }

  /**
   * Initialize the connection manager
   */
  async initialize(serverConfigs: ServerConfigs, context?: IContext): Promise<void> {
    return this.initializationLock.withLock(async () => {
      if (this.isInitialized) {
        this.logger.debug('Connection manager already initialized');
        return;
      }

      this.logger.info('Initializing MCP connection manager');
      this.context = context;

      try {
        // Start connections for all configured servers
        const connectionPromises: Promise<void>[] = [];

        for (const [serverName, serverConfig] of Object.entries(serverConfigs)) {
          connectionPromises.push(
            this.startServerConnection(serverName, serverConfig)
              .then(() => {
                this.logger.debug(`Successfully started connection for server '${serverName}'`);
              })
              .catch((error) => {
                this.logger.warning(`Failed to start connection for server '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
                // Don't throw - allow other connections to succeed
              })
          );
        }

        // Wait for all connection attempts (successful or failed)
        await Promise.allSettled(connectionPromises);

        // Warm up connections if enabled
        if (this.config.warmupOnStartup) {
          await this.warmupConnections();
        }

        this.isInitialized = true;
        this.logger.info('MCP connection manager initialized successfully');

      } catch (error) {
        this.logger.error(`Failed to initialize connection manager: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  /**
   * Get a server connection from the pool
   */
  async getServerConnection(
    serverName: string,
    options: ConnectionRequestOptions = {}
  ): Promise<ServerConnection> {
    this.ensureInitialized();

    const startTime = Date.now();
    
    try {
      const connection = await this.lifecycleManager.getConnection(serverName);
      
      if (!connection) {
        throw new ConnectionFailureError(
          `Connection not found for server '${serverName}'`,
          serverName
        );
      }

      if (options.requireHealthy && !connection.isHealthy()) {
        throw new ConnectionFailureError(
          `Server '${serverName}' is not healthy`,
          serverName
        );
      }

      this.recordRequestSuccess(Date.now() - startTime);
      return connection;

    } catch (error) {
      this.recordRequestFailure();
      throw error;
    }
  }

  /**
   * Get an enhanced MCP client for a server
   */
  async getClient(
    serverName: string,
    options: ConnectionRequestOptions = {}
  ): Promise<IEnhancedMCPClient> {
    const connection = await this.getServerConnection(serverName, options);
    return await connection.getSession();
  }

  /**
   * Add a new server to the connection pool
   */
  async addServer(serverName: string, serverConfig: McpServerConfig): Promise<void> {
    this.ensureInitialized();

    if (this.lifecycleManager.getConnections().has(serverName)) {
      throw new Error(`Server '${serverName}' already exists in connection pool`);
    }

    await this.startServerConnection(serverName, serverConfig);
    this.logger.info(`Added new server '${serverName}' to connection pool`);
  }

  /**
   * Remove a server from the connection pool
   */
  async removeServer(serverName: string): Promise<void> {
    this.ensureInitialized();

    const connections = this.lifecycleManager.getConnections();
    const info = connections.get(serverName);
    
    if (!info) {
      this.logger.warning(`Server '${serverName}' not found in connection pool`);
      return;
    }

    if (info.connection) {
      info.connection.requestShutdown();
      await info.connection.waitForShutdown();
    }

    // Note: Lifecycle manager should handle the removal internally
    this.logger.info(`Removed server '${serverName}' from connection pool`);
  }

  /**
   * Get all server names in the connection pool
   */
  getServerNames(): string[] {
    return Array.from(this.lifecycleManager.getConnections().keys());
  }

  /**
   * Check if a server is available and healthy
   */
  isServerHealthy(serverName: string): boolean {
    const connections = this.lifecycleManager.getConnections();
    const info = connections.get(serverName);
    
    return info?.connection?.isHealthy() ?? false;
  }

  /**
   * Get connection pool statistics
   */
  async getStatistics(): Promise<ConnectionPoolStats> {
    const lifecycleStats = this.lifecycleManager.getStatistics();
    const connections = this.lifecycleManager.getConnections();

    return {
      ...this.stats,
      totalConnections: lifecycleStats.totalConnections,
      activeConnections: lifecycleStats.activeConnections,
      healthyConnections: lifecycleStats.healthyConnections,
      failedConnections: lifecycleStats.failedConnections,
      idleConnections: Math.max(0, lifecycleStats.activeConnections - this.getCurrentlyUsedConnections()),
      poolUtilization: (lifecycleStats.activeConnections / this.config.maxPoolSize) * 100,
      uptime: Date.now() - this.startTime.getTime(),
      averageResponseTime: this.calculateAverageResponseTime(),
    };
  }

  /**
   * Get detailed connection information
   */
  getConnectionInfo(): Map<string, ConnectionLifecycleInfo> {
    return this.lifecycleManager.getConnections();
  }

  /**
   * Get health metrics for a server
   */
  async getHealthMetrics(serverName: string): Promise<HealthMetrics | undefined> {
    const connections = this.lifecycleManager.getConnections();
    const info = connections.get(serverName);
    
    if (info?.healthMonitor) {
      return await info.healthMonitor.getMetrics();
    }
    
    return undefined;
  }

  /**
   * Force a health check on all connections
   */
  async performHealthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const connections = this.lifecycleManager.getConnections();

    for (const [serverName, info] of connections) {
      if (info.connection) {
        try {
          const isHealthy = info.connection.isHealthy();
          results.set(serverName, isHealthy);
        } catch (error) {
          this.logger.error(`Health check failed for server '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
          results.set(serverName, false);
        }
      } else {
        results.set(serverName, false);
      }
    }

    return results;
  }

  /**
   * Warm up all connections
   */
  async warmupConnections(): Promise<void> {
    this.logger.info('Warming up connections...');

    const connections = this.lifecycleManager.getConnections();
    const warmupPromises: Promise<void>[] = [];

    for (const [serverName, info] of connections) {
      if (info.connection) {
        warmupPromises.push(
          this.warmupConnection(serverName, info.connection)
            .catch((error) => {
              this.logger.warning(`Failed to warm up connection for server '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
            })
        );
      }
    }

    await Promise.allSettled(warmupPromises);
    this.logger.info('Connection warmup completed');
  }

  /**
   * Get configuration for the connection pool
   */
  getConfig(): ConnectionPoolConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart for some changes)
   */
  updateConfig(newConfig: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Updated connection pool configuration');
  }

  /**
   * Shutdown the connection manager
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      await this.shutdownComplete.wait();
      return;
    }

    this.logger.info('Shutting down MCP connection manager');
    this.isShuttingDown = true;

    try {
      await this.lifecycleManager.shutdown();
      
      this.logger.info('MCP connection manager shutdown complete');

    } catch (error) {
      this.logger.error(`Error during connection manager shutdown: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.shutdownComplete.set();
    }
  }

  /**
   * Start a connection for a specific server
   */
  private async startServerConnection(serverName: string, serverConfig: McpServerConfig): Promise<void> {
    try {
      await this.lifecycleManager.startConnection(serverName, serverConfig, this.context);
      this.stats.totalConnections++;
    } catch (error) {
      this.logger.error(`Failed to start connection for server '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Warm up a single connection
   */
  private async warmupConnection(serverName: string, connection: ServerConnection): Promise<void> {
    try {
      const client = await connection.getSession();
      
      // Perform lightweight operations to warm up the connection
      await Promise.allSettled([
        client.getTools(),
        client.listPrompts(),
        client.listResources(),
      ]);

      this.logger.debug(`Warmed up connection for server '${serverName}'`);
    } catch (error) {
      this.logger.debug(`Failed to warm up connection for server '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set up lifecycle event listeners
   */
  private setupEventListeners(): void {
    this.lifecycleManager.on('connection_ready', (event: LifecycleEvent) => {
      this.logger.debug(`Connection ready: ${event.serverName}`);
      this.stats.activeConnections++;
    });

    this.lifecycleManager.on('connection_failed', (event: LifecycleEvent) => {
      this.logger.warning(`Connection failed: ${event.serverName}`);
      this.stats.failedConnections++;
      
      // Clear cache for failed server
      this.clearServerCache(event.serverName);
    });

    this.lifecycleManager.on('connection_recovered', (event: LifecycleEvent) => {
      this.logger.info(`Connection recovered: ${event.serverName}`);
      this.stats.failedConnections = Math.max(0, this.stats.failedConnections - 1);
    });

    this.lifecycleManager.on('connection_shutdown', (event: LifecycleEvent) => {
      this.logger.debug(`Connection shutdown: ${event.serverName}`);
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
      
      // Clear cache for shutdown server
      this.clearServerCache(event.serverName);
    });
  }

  /**
   * Clear cache for a specific server
   */
  private async clearServerCache(serverName: string): Promise<void> {
    // Implementation of clearServerCache method
  }

  /**
   * Record successful request
   */
  private recordRequestSuccess(responseTime: number): void {
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
    
    this.requestTimes.push(responseTime);
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-500);
    }
  }

  /**
   * Record failed request
   */
  private recordRequestFailure(): void {
    this.stats.totalRequests++;
    this.stats.failedRequests++;
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.requestTimes.length === 0) {
      return 0;
    }
    
    const sum = this.requestTimes.reduce((a, b) => a + b, 0);
    return sum / this.requestTimes.length;
  }

  /**
   * Get currently used connections (placeholder - implement based on usage tracking)
   */
  private getCurrentlyUsedConnections(): number {
    // This is a simplified implementation
    // In a real implementation, you would track active operations per connection
    return Math.min(this.stats.activeConnections, Math.ceil(this.stats.activeConnections * 0.7));
  }

  /**
   * Ensure the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Connection manager not initialized. Call initialize() first.');
    }

    if (this.isShuttingDown) {
      throw new Error('Connection manager is shutting down');
    }
  }

  /**
   * Dispose of the connection manager
   */
  async dispose(): Promise<void> {
    await this.shutdown();
    this.logger.debug('Disposed MCP connection manager');
  }
} 