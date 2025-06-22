/**
 * Connection Strategy for MCP Aggregator
 * 
 * Provides dual connection management modes:
 * 1. Persistent connections: Pooled connections with lifecycle management
 * 2. Temporary connections: Created/disposed per operation
 */

import { IEnhancedMCPClient } from '../types/enhanced-client.js';
import { McpServerConfig } from '../types/config.js';
import { ConnectionPoolConfig } from '../types/connection-config.js';
import { MCPConnectionManager } from '../manager/connection-manager.js';
import { MCPAgentClientSession } from '../client/agent-session.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * Connection mode enum
 */
export type ConnectionMode = 'persistent' | 'temporary';

/**
 * Connection strategy configuration
 */
export interface ConnectionStrategyConfig {
  /** Connection mode to use */
  mode: ConnectionMode;
  /** Pool configuration for persistent mode */
  poolConfig?: ConnectionPoolConfig;
  /** Context for client sessions */
  context?: IContext;
  /** Timeout for temporary connections */
  temporaryConnectionTimeout?: number;
}

/**
 * Connection strategy statistics
 */
export interface ConnectionStrategyStats {
  mode: ConnectionMode;
  totalConnections: number;
  activeConnections: number;
  totalOperations: number;
  connectionErrors: number;
  averageConnectionTime: number;
}

/**
 * Base connection strategy interface
 */
export interface ConnectionStrategy {
  getConnection(serverName: string): Promise<IEnhancedMCPClient>;
  releaseConnection(serverName: string, client?: IEnhancedMCPClient): Promise<void>;
  initialize(serverConfigs: Record<string, McpServerConfig>): Promise<void>;
  isInitialized(): boolean;
  getStatistics(): Promise<ConnectionStrategyStats>;
  shutdown(): Promise<void>;
}

/**
 * Persistent connection strategy using connection pooling
 */
export class PersistentConnectionStrategy implements ConnectionStrategy {
  private connectionManager: MCPConnectionManager;
  private config: ConnectionStrategyConfig;
  private logger: Logger;
  private initialized = false;
  private statistics: ConnectionStrategyStats;

  constructor(config: ConnectionStrategyConfig) {
    this.config = config;
    this.logger = new Logger('persistent-connection-strategy');
    this.connectionManager = new MCPConnectionManager(config.poolConfig);
    
    this.statistics = {
      mode: 'persistent',
      totalConnections: 0,
      activeConnections: 0,
      totalOperations: 0,
      connectionErrors: 0,
      averageConnectionTime: 0,
    };
  }

  async initialize(serverConfigs: Record<string, McpServerConfig>): Promise<void> {
    if (this.initialized) return;

    this.logger.info('Initializing persistent connection strategy');
    await this.connectionManager.initialize(serverConfigs, this.config.context);
    this.initialized = true;
  }

  async getConnection(serverName: string): Promise<IEnhancedMCPClient> {
    if (!this.initialized) {
      throw new Error('Persistent connection strategy not initialized');
    }

    const startTime = Date.now();
    
    try {
      this.statistics.totalOperations++;
      const client = await this.connectionManager.getClient(serverName, {
        requireHealthy: true,
      });
      
      this.statistics.averageConnectionTime = 
        (this.statistics.averageConnectionTime + (Date.now() - startTime)) / 2;
      
      return client;
    } catch (error) {
      this.statistics.connectionErrors++;
      throw error;
    }
  }

  async releaseConnection(): Promise<void> {
    // Persistent connections are managed by the connection manager
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getStatistics(): Promise<ConnectionStrategyStats> {
    if (this.initialized) {
      const poolStats = await this.connectionManager.getStatistics();
      return {
        ...this.statistics,
        totalConnections: poolStats.totalConnections,
        activeConnections: poolStats.activeConnections,
      };
    }
    return this.statistics;
  }

  async shutdown(): Promise<void> {
    if (this.initialized) {
      await this.connectionManager.shutdown();
      this.initialized = false;
    }
  }
}

/**
 * Temporary connection strategy creating connections per operation
 */
export class TemporaryConnectionStrategy implements ConnectionStrategy {
  private config: ConnectionStrategyConfig;
  private logger: Logger;
  private serverConfigs: Record<string, McpServerConfig> = {};
  private initialized = false;
  private statistics: ConnectionStrategyStats;

  constructor(config: ConnectionStrategyConfig) {
    this.config = config;
    this.logger = new Logger('temporary-connection-strategy');
    
    this.statistics = {
      mode: 'temporary',
      totalConnections: 0,
      activeConnections: 0,
      totalOperations: 0,
      connectionErrors: 0,
      averageConnectionTime: 0,
    };
  }

  async initialize(serverConfigs: Record<string, McpServerConfig>): Promise<void> {
    this.logger.info('Initializing temporary connection strategy');
    this.serverConfigs = { ...serverConfigs };
    this.initialized = true;
  }

  async getConnection(serverName: string): Promise<IEnhancedMCPClient> {
    if (!this.initialized) {
      throw new Error('Temporary connection strategy not initialized');
    }

    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server configuration not found for '${serverName}'`);
    }

    const startTime = Date.now();
    
    try {
      this.statistics.totalOperations++;
      this.statistics.activeConnections++;
      
      const sessionConfig = {
        serverConfig,
        serverName,
        context: this.config.context,
        sessionIdCallback: () => this.config.context?.sessionId || null,
      };

      const client = new MCPAgentClientSession(sessionConfig);
      
      const timeout = this.config.temporaryConnectionTimeout || 30000;
      await Promise.race([
        client.connect(serverConfig, serverName),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Connection timeout after ${timeout}ms`)), timeout)
        ),
      ]);

      this.statistics.totalConnections++;
      this.statistics.averageConnectionTime = 
        (this.statistics.averageConnectionTime + (Date.now() - startTime)) / 2;
      
      return client;

    } catch (error) {
      this.statistics.connectionErrors++;
      this.statistics.activeConnections = Math.max(0, this.statistics.activeConnections - 1);
      throw error;
    }
  }

  async releaseConnection(serverName: string, client?: IEnhancedMCPClient): Promise<void> {
    if (client && client.disconnect) {
      try {
        await client.disconnect();
        this.statistics.activeConnections = Math.max(0, this.statistics.activeConnections - 1);
      } catch (error) {
        this.logger.warning(`Error releasing temporary connection for '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getStatistics(): Promise<ConnectionStrategyStats> {
    return { ...this.statistics };
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    this.statistics.activeConnections = 0;
  }
}

/**
 * Create a connection strategy based on configuration
 */
export function createConnectionStrategy(config: ConnectionStrategyConfig): ConnectionStrategy {
  switch (config.mode) {
    case 'persistent':
      return new PersistentConnectionStrategy(config);
    case 'temporary':
      return new TemporaryConnectionStrategy(config);
    default:
      throw new Error(`Unsupported connection mode: ${config.mode}`);
  }
}

/**
 * Utility function to execute an operation with temporary connection
 */
export async function withTemporaryConnection<T>(
  serverName: string,
  serverConfig: McpServerConfig,
  operation: (client: IEnhancedMCPClient) => Promise<T>,
  config?: { timeout?: number; context?: IContext }
): Promise<T> {
  const strategy = new TemporaryConnectionStrategy({
    mode: 'temporary',
    temporaryConnectionTimeout: config?.timeout,
    context: config?.context,
  });

  await strategy.initialize({ [serverName]: serverConfig });
  let client: IEnhancedMCPClient | undefined;
  
  try {
    client = await strategy.getConnection(serverName);
    return await operation(client);
  } finally {
    if (client) {
      await strategy.releaseConnection(serverName, client);
    }
    await strategy.shutdown();
  }
} 