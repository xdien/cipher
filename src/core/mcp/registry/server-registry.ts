/**
 * MCP Server Registry - Configuration and Lifecycle Management
 * 
 * Provides centralized management of MCP server configurations,
 * including loading from files, initialization hooks, and session lifecycle.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { IEnhancedMCPClient } from '../types/enhanced-client.js';
import { 
  McpServerConfig,
  ServerConfigs,
  Settings,
  MCPServerAuthSettings,
  ConfigValidation
} from '../types/config.js';
import { TransportFactory, TransportInstance, TransportCreationConfig } from '../connection/transport-factory.js';
import { MCPAgentClientSession } from '../client/agent-session.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';
import { AsyncLock } from '../utils/async-lock.js';

/**
 * Initialization hook function type
 */
export type InitHookCallable = (
  session: IEnhancedMCPClient | null,
  auth: MCPServerAuthSettings | null
) => boolean | Promise<boolean>;

/**
 * Transport context for session lifecycle management
 */
export interface TransportContext {
  transport: TransportInstance;
  cleanup: () => Promise<void>;
  sessionIdCallback?: () => string | null;
}

/**
 * Session factory function type
 */
export type ClientSessionFactory = (
  transportContext: TransportContext,
  readTimeout?: number
) => Promise<IEnhancedMCPClient>;

/**
 * Registry configuration options
 */
export interface ServerRegistryConfig {
  /** Default configuration file path */
  configPath?: string;
  /** Default settings if no config file */
  defaultSettings?: Settings;
  /** Context for client sessions */
  context?: IContext;
  /** Default timeout for operations */
  defaultTimeout?: number;
  /** Whether to validate configurations strictly */
  strictValidation?: boolean;
}

/**
 * Server entry with metadata
 */
export interface ServerEntry {
  name: string;
  config: McpServerConfig;
  metadata: {
    addedAt: Date;
    lastUsed?: Date;
    useCount: number;
    isEnabled: boolean;
  };
}

/**
 * Registry statistics
 */
export interface RegistryStatistics {
  totalServers: number;
  enabledServers: number;
  disabledServers: number;
  serversWithAuth: number;
  transportTypes: Record<string, number>;
  totalSessions: number;
  activeSessions: number;
  registryUptime: number;
}

/**
 * Main Server Registry class
 */
export class ServerRegistry {
  private registry: Map<string, ServerEntry> = new Map();
  private initHooks: Map<string, InitHookCallable> = new Map();
  private config: ServerRegistryConfig;
  private logger: Logger;
  private initializationLock = new AsyncLock();
  private isInitialized = false;
  private startTime = new Date();
  
  // Session tracking
  private activeSessions = new Set<string>();
  private sessionCounter = 0;

  constructor(config: ServerRegistryConfig = {}) {
    this.config = {
      defaultTimeout: 60000,
      strictValidation: true,
      ...config,
    };

    this.logger = new Logger('server-registry');
  }

  // ================== INITIALIZATION ==================

  /**
   * Initialize the registry with configuration
   */
  async initialize(settings?: Settings, configPath?: string): Promise<void> {
    return this.initializationLock.withLock(async () => {
      if (this.isInitialized) {
        this.logger.debug('Server registry already initialized');
        return;
      }

      this.logger.info('Initializing MCP server registry');

      try {
        // Load configuration
        const finalSettings = settings || 
          await this.loadSettingsFromFile(configPath || this.config.configPath) ||
          this.config.defaultSettings ||
          { mcp: { servers: {} } };

        // Validate and load servers
        const validatedSettings = ConfigValidation.validateSettings(finalSettings);
        await this.loadServersFromSettings(validatedSettings);

        this.isInitialized = true;
        this.logger.info(`Server registry initialized with ${this.registry.size} servers`);

      } catch (error) {
        this.logger.error(`Failed to initialize server registry: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  /**
   * Load server configurations from settings
   */
  private async loadServersFromSettings(settings: Settings): Promise<void> {
    if (!settings.mcp?.servers) {
      this.logger.info('No MCP servers configured');
      return;
    }

    for (const [serverName, serverConfig] of Object.entries(settings.mcp.servers)) {
      try {
        await this.addServer(serverName, serverConfig);
      } catch (error) {
        this.logger.error(`Failed to add server '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
        if (this.config.strictValidation) {
          throw error;
        }
      }
    }
  }

  /**
   * Load settings from a configuration file
   */
  private async loadSettingsFromFile(configPath?: string): Promise<Settings | null> {
    if (!configPath) {
      return null;
    }

    try {
      const resolvedPath = path.resolve(configPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');

      let parsed: unknown;
      if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
        parsed = yaml.load(content);
      } else {
        parsed = JSON.parse(content);
      }

      this.logger.debug(`Loaded configuration from: ${resolvedPath}`);
      return ConfigValidation.validateSettings(parsed);

    } catch (error) {
      this.logger.warning(`Failed to load configuration from '${configPath}': ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  // ================== SERVER MANAGEMENT ==================

  /**
   * Add a server to the registry
   */
  async addServer(serverName: string, serverConfig: McpServerConfig): Promise<void> {
    this.ensureInitialized();

    if (this.registry.has(serverName)) {
      throw new Error(`Server '${serverName}' already exists in registry`);
    }

    // Validate configuration
    const validatedConfig = ConfigValidation.validateServerConfig(serverConfig);

    // Set default name if not provided
    if (!validatedConfig.name) {
      validatedConfig.name = serverName;
    }

    const entry: ServerEntry = {
      name: serverName,
      config: validatedConfig,
      metadata: {
        addedAt: new Date(),
        useCount: 0,
        isEnabled: true,
      },
    };

    this.registry.set(serverName, entry);
    this.logger.info(`Added server '${serverName}' (${validatedConfig.type}) to registry`);
  }

  /**
   * Remove a server from the registry
   */
  async removeServer(serverName: string): Promise<void> {
    this.ensureInitialized();

    const entry = this.registry.get(serverName);
    if (!entry) {
      this.logger.warning(`Server '${serverName}' not found in registry`);
      return;
    }

    this.registry.delete(serverName);
    this.initHooks.delete(serverName);
    
    this.logger.info(`Removed server '${serverName}' from registry`);
  }

  /**
   * Get server configuration
   */
  getServerConfig(serverName: string): McpServerConfig | undefined {
    const entry = this.registry.get(serverName);
    return entry?.config;
  }

  /**
   * Get all server names
   */
  getServerNames(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get enabled server names
   */
  getEnabledServerNames(): string[] {
    return Array.from(this.registry.entries())
      .filter(([_, entry]) => entry.metadata.isEnabled)
      .map(([name, _]) => name);
  }

  /**
   * Enable/disable a server
   */
  setServerEnabled(serverName: string, enabled: boolean): void {
    const entry = this.registry.get(serverName);
    if (entry) {
      entry.metadata.isEnabled = enabled;
      this.logger.info(`${enabled ? 'Enabled' : 'Disabled'} server '${serverName}'`);
    }
  }

  /**
   * Get server statistics
   */
  getServerEntry(serverName: string): ServerEntry | undefined {
    return this.registry.get(serverName);
  }

  // ================== HOOK MANAGEMENT ==================

  /**
   * Register an initialization hook for a server
   */
  registerInitHook(serverName: string, hook: InitHookCallable): void {
    this.initHooks.set(serverName, hook);
    this.logger.debug(`Registered init hook for server '${serverName}'`);
  }

  /**
   * Unregister an initialization hook
   */
  unregisterInitHook(serverName: string): void {
    this.initHooks.delete(serverName);
    this.logger.debug(`Unregistered init hook for server '${serverName}'`);
  }

  // ================== SESSION LIFECYCLE ==================

  /**
   * Start a server session (async generator for proper cleanup)
   */
  async *startServer(
    serverName: string,
    clientSessionFactory?: ClientSessionFactory,
    sessionId?: string
  ): AsyncGenerator<IEnhancedMCPClient, void, unknown> {
    this.ensureInitialized();

    const entry = this.registry.get(serverName);
    if (!entry) {
      throw new Error(`Server '${serverName}' not found in registry`);
    }

    if (!entry.metadata.isEnabled) {
      throw new Error(`Server '${serverName}' is disabled`);
    }

    const currentSessionId = sessionId || this.generateSessionId();
    this.logger.debug(`Starting server session: ${serverName} (${currentSessionId})`);

    // Create transport context
    const transportContext = await this.createTransportContext(entry.config, serverName, currentSessionId);

    try {
      // Create client session
      const session = await this.createClientSession(
        transportContext,
        entry.config,
        serverName,
        clientSessionFactory
      );

      // Track session
      this.activeSessions.add(currentSessionId);
      entry.metadata.useCount++;
      entry.metadata.lastUsed = new Date();

      this.logger.debug(`Started session for server '${serverName}': ${currentSessionId}`);

      yield session;

    } finally {
      // Cleanup
      await transportContext.cleanup();
      this.activeSessions.delete(currentSessionId);
      this.logger.debug(`Cleaned up session for server '${serverName}': ${currentSessionId}`);
    }
  }

  /**
   * Initialize a server session with hooks
   */
  async *initializeServer(
    serverName: string,
    clientSessionFactory?: ClientSessionFactory,
    initHook?: InitHookCallable,
    sessionId?: string
  ): AsyncGenerator<IEnhancedMCPClient, void, unknown> {
    for await (const session of this.startServer(serverName, clientSessionFactory, sessionId)) {
      try {
        // Session is already connected via the connect() method in createClientSession
        this.logger.debug(`Session ready for server '${serverName}'`);

        // Execute initialization hook
        const hook = initHook || this.initHooks.get(serverName);
        if (hook) {
          const entry = this.registry.get(serverName);
          const shouldContinue = await hook(session, entry?.config.auth || null);
          if (!shouldContinue) {
            this.logger.warning(`Init hook for server '${serverName}' returned false, skipping session`);
            return;
          }
        }

        yield session;

      } catch (error) {
        this.logger.error(`Failed to initialize session for server '${serverName}': ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
  }

  // ================== HELPER METHODS ==================

  /**
   * Create transport context for a server
   */
  private async createTransportContext(
    config: McpServerConfig,
    serverName: string,
    sessionId: string
  ): Promise<TransportContext> {
    const transportConfig: TransportCreationConfig = {
      serverName,
      sessionId,
      timeout: config.timeout,
      headers: config.type !== 'stdio' ? (config as any).headers : undefined,
      environment: config.type === 'stdio' ? (config as any).env : undefined,
    };

    const transport = await TransportFactory.createTransport(config, transportConfig);

    return {
      transport,
      cleanup: async () => {
        await TransportFactory.disposeTransport(transport);
      },
      sessionIdCallback: () => sessionId,
    };
  }

  /**
   * Create client session
   */
  private async createClientSession(
    transportContext: TransportContext,
    config: McpServerConfig,
    serverName: string,
    clientSessionFactory?: ClientSessionFactory
  ): Promise<IEnhancedMCPClient> {
    if (clientSessionFactory) {
      return await clientSessionFactory(transportContext, config.readTimeoutSeconds);
    }

    // Default session creation
    const session = new MCPAgentClientSession({
      serverConfig: config,
      serverName,
      context: this.config.context,
      sessionIdCallback: transportContext.sessionIdCallback,
    });

    await session.connect(config, serverName);
    return session;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${++this.sessionCounter}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ================== STATISTICS ==================

  /**
   * Get registry statistics
   */
  getStatistics(): RegistryStatistics {
    const transportTypes: Record<string, number> = {};
    let enabledCount = 0;
    let authCount = 0;

    for (const [_, entry] of this.registry) {
      if (entry.metadata.isEnabled) enabledCount++;
      if (entry.config.auth) authCount++;
      
      const type = entry.config.type;
      transportTypes[type] = (transportTypes[type] || 0) + 1;
    }

    return {
      totalServers: this.registry.size,
      enabledServers: enabledCount,
      disabledServers: this.registry.size - enabledCount,
      serversWithAuth: authCount,
      transportTypes,
      totalSessions: this.sessionCounter,
      activeSessions: this.activeSessions.size,
      registryUptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Export registry configuration
   */
  exportConfiguration(): Settings {
    const servers: ServerConfigs = {};
    
    for (const [name, entry] of this.registry) {
      servers[name] = entry.config;
    }

    return {
      mcp: {
        servers,
      },
    };
  }

  /**
   * Save configuration to file
   */
  async saveConfiguration(filePath: string, format: 'json' | 'yaml' = 'json'): Promise<void> {
    const config = this.exportConfiguration();
    
    let content: string;
    if (format === 'yaml') {
      content = yaml.dump(config, { indent: 2 });
    } else {
      content = JSON.stringify(config, null, 2);
    }

    await fs.writeFile(filePath, content, 'utf-8');
    this.logger.info(`Saved configuration to: ${filePath}`);
  }

  /**
   * Ensure registry is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Server registry not initialized. Call initialize() first.');
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down server registry');
    
    // Clear all data
    this.registry.clear();
    this.initHooks.clear();
    this.activeSessions.clear();
    
    this.isInitialized = false;
    this.logger.info('Server registry shutdown complete');
  }
} 