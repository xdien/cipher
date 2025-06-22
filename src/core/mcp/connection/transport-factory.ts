/**
 * Transport Factory - Enhanced Transport Creation
 * 
 * Provides enhanced transport creation with session support, error handling,
 * and configuration validation for different MCP transport types.
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { 
  McpServerConfig,
  StdioServerConfig,
  SseServerConfig,
  HttpServerConfig
} from '../types/config.js';
import { 
  TransportError,
  StdioProcessError,
  HttpTransportError,
  ConfigurationError
} from '../errors/connection-errors.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * Transport instance with metadata
 */
export interface TransportInstance {
  transport: any; // Base transport type from MCP SDK
  type: 'stdio' | 'http' | 'sse';
  config: McpServerConfig;
  sessionId?: string;
  metadata: {
    createdAt: Date;
    serverName: string;
    connectionAttempts: number;
  };
}

/**
 * Configuration for transport creation
 */
export interface TransportCreationConfig {
  serverName: string;
  sessionId?: string;
  connectionAttempts?: number;
  timeout?: number;
  headers?: Record<string, string>;
  environment?: Record<string, string>;
}

/**
 * Enhanced transport factory with session support and error handling
 */
export class TransportFactory {
  private static logger = new Logger('transport-factory');

  /**
   * Create a transport instance based on server configuration
   * 
   * @param config Server configuration
   * @param creationConfig Transport creation configuration
   * @returns Promise resolving to transport instance
   */
  static async createTransport(
    config: McpServerConfig,
    creationConfig: TransportCreationConfig
  ): Promise<TransportInstance> {
    this.logger.debug(`Creating transport for server '${creationConfig.serverName}' of type '${config.type}'`);

    try {
      this.validateConfig(config, creationConfig.serverName);

      let transport: any;

      switch (config.type) {
        case 'stdio':
          transport = await this.createStdioTransport(
            config as StdioServerConfig,
            creationConfig
          );
          break;

        case 'http':
          transport = this.createHttpTransport(
            config as HttpServerConfig,
            creationConfig
          );
          break;

        case 'sse':
          transport = this.createSSETransport(
            config as SseServerConfig,
            creationConfig
          );
          break;

        default:
          throw new ConfigurationError(
            `Unsupported transport type: ${(config as any).type}`,
            creationConfig.serverName,
            'type',
            (config as any).type
          );
      }

      const instance: TransportInstance = {
        transport,
        type: config.type,
        config,
        sessionId: creationConfig.sessionId,
        metadata: {
          createdAt: new Date(),
          serverName: creationConfig.serverName,
          connectionAttempts: creationConfig.connectionAttempts || 0,
        },
      };

      this.logger.info(`Successfully created ${config.type} transport for server '${creationConfig.serverName}'`);
      return instance;

    } catch (error) {
      this.logger.error(`Failed to create transport for server '${creationConfig.serverName}': ${error instanceof Error ? error.message : String(error)}`);
      
      if (error instanceof TransportError) {
        throw error;
      }
      
      throw new TransportError(
        `Transport creation failed: ${error instanceof Error ? error.message : String(error)}`,
        creationConfig.serverName,
        (config as any).type || 'unknown',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Create stdio transport with enhanced error handling
   */
  private static async createStdioTransport(
    config: StdioServerConfig,
    creationConfig: TransportCreationConfig
  ): Promise<StdioClientTransport> {
    try {
      // Resolve command path for Windows
      let resolvedCommand = config.command;
      if (process.platform === 'win32' && config.command === 'npx') {
        resolvedCommand = 'C:\\Program Files\\nodejs\\npx.cmd';
        this.logger.debug(`Resolved Windows path for npx: ${resolvedCommand}`);
      }

      // Merge environment variables
      const environment = {
        ...process.env,
        ...config.env,
        ...creationConfig.environment,
      };

      // Add session ID to environment if provided
      if (creationConfig.sessionId) {
        environment.MCP_SESSION_ID = creationConfig.sessionId;
      }

      this.logger.debug(`Creating stdio transport: ${resolvedCommand} ${config.args.join(' ')}`);

      const transport = new StdioClientTransport({
        command: resolvedCommand,
        args: config.args,
        env: environment as Record<string, string>,
      });

      return transport;

    } catch (error) {
      throw new StdioProcessError(
        `Failed to create stdio transport: ${error instanceof Error ? error.message : String(error)}`,
        creationConfig.serverName,
        config.command,
        config.args
      );
    }
  }

  /**
   * Create HTTP transport with session support
   */
  private static createHttpTransport(
    config: HttpServerConfig,
    creationConfig: TransportCreationConfig
  ): StreamableHTTPClientTransport {
    try {
      // Validate URL
      let url: URL;
      try {
        url = new URL(config.url);
      } catch (urlError) {
        throw new HttpTransportError(
          `Invalid URL: ${config.url}`,
          creationConfig.serverName,
          'http',
          config.url
        );
      }

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'cipher-mcp-client/1.0.0',
        ...config.headers,
        ...creationConfig.headers,
      };

      // Add session ID header if provided
      if (creationConfig.sessionId) {
        headers['X-Session-ID'] = creationConfig.sessionId;
        headers['X-MCP-Session-ID'] = creationConfig.sessionId; // Alternative header name
      }

      // Add connection attempt tracking
      if (creationConfig.connectionAttempts) {
        headers['X-Connection-Attempt'] = creationConfig.connectionAttempts.toString();
      }

      this.logger.debug(`Creating HTTP transport to ${config.url}`);

      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers,
        },
      });

      return transport;

    } catch (error) {
      if (error instanceof HttpTransportError) {
        throw error;
      }

      throw new HttpTransportError(
        `Failed to create HTTP transport: ${error instanceof Error ? error.message : String(error)}`,
        creationConfig.serverName,
        'http',
        config.url
      );
    }
  }

  /**
   * Create SSE transport with session support
   */
  private static createSSETransport(
    config: SseServerConfig,
    creationConfig: TransportCreationConfig
  ): SSEClientTransport {
    try {
      // Validate URL
      let url: URL;
      try {
        url = new URL(config.url);
      } catch (urlError) {
        throw new HttpTransportError(
          `Invalid SSE URL: ${config.url}`,
          creationConfig.serverName,
          'sse',
          config.url
        );
      }

      // Prepare headers
      const headers = {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'User-Agent': 'cipher-mcp-client/1.0.0',
        ...config.headers,
        ...creationConfig.headers,
      };

      // Add session ID header if provided
      if (creationConfig.sessionId) {
        headers['X-Session-ID'] = creationConfig.sessionId;
        headers['X-MCP-Session-ID'] = creationConfig.sessionId;
      }

      // Add connection attempt tracking
      if (creationConfig.connectionAttempts) {
        headers['X-Connection-Attempt'] = creationConfig.connectionAttempts.toString();
      }

      this.logger.debug(`Creating SSE transport to ${config.url}`);

      const transport = new SSEClientTransport(url, {
        requestInit: {
          headers,
        },
      });

      return transport;

    } catch (error) {
      if (error instanceof HttpTransportError) {
        throw error;
      }

      throw new HttpTransportError(
        `Failed to create SSE transport: ${error instanceof Error ? error.message : String(error)}`,
        creationConfig.serverName,
        'sse',
        config.url
      );
    }
  }

  /**
   * Validate server configuration
   */
  private static validateConfig(config: McpServerConfig, serverName: string): void {
    if (!config) {
      throw new ConfigurationError(
        'Server configuration is required',
        serverName,
        'config'
      );
    }

    if (!config.type) {
      throw new ConfigurationError(
        'Server type is required',
        serverName,
        'type'
      );
    }

    switch (config.type) {
      case 'stdio':
        this.validateStdioConfig(config as StdioServerConfig, serverName);
        break;
      case 'http':
        this.validateHttpConfig(config as HttpServerConfig, serverName);
        break;
      case 'sse':
        this.validateSseConfig(config as SseServerConfig, serverName);
        break;
      default:
        throw new ConfigurationError(
          `Unsupported server type: ${config.type}`,
          serverName,
          'type',
          config.type
        );
    }
  }

  /**
   * Validate stdio configuration
   */
  private static validateStdioConfig(config: StdioServerConfig, serverName: string): void {
    if (!config.command) {
      throw new ConfigurationError(
        'Command is required for stdio transport',
        serverName,
        'command'
      );
    }

    if (!Array.isArray(config.args)) {
      throw new ConfigurationError(
        'Args must be an array for stdio transport',
        serverName,
        'args',
        config.args
      );
    }

    if (config.env && typeof config.env !== 'object') {
      throw new ConfigurationError(
        'Environment must be an object for stdio transport',
        serverName,
        'env',
        config.env
      );
    }
  }

  /**
   * Validate HTTP configuration
   */
  private static validateHttpConfig(config: HttpServerConfig, serverName: string): void {
    if (!config.url) {
      throw new ConfigurationError(
        'URL is required for HTTP transport',
        serverName,
        'url'
      );
    }

    try {
      new URL(config.url);
    } catch (error) {
      throw new ConfigurationError(
        `Invalid URL for HTTP transport: ${config.url}`,
        serverName,
        'url',
        config.url
      );
    }

    if (config.headers && typeof config.headers !== 'object') {
      throw new ConfigurationError(
        'Headers must be an object for HTTP transport',
        serverName,
        'headers',
        config.headers
      );
    }
  }

  /**
   * Validate SSE configuration
   */
  private static validateSseConfig(config: SseServerConfig, serverName: string): void {
    if (!config.url) {
      throw new ConfigurationError(
        'URL is required for SSE transport',
        serverName,
        'url'
      );
    }

    try {
      new URL(config.url);
    } catch (error) {
      throw new ConfigurationError(
        `Invalid URL for SSE transport: ${config.url}`,
        serverName,
        'url',
        config.url
      );
    }

    if (config.headers && typeof config.headers !== 'object') {
      throw new ConfigurationError(
        'Headers must be an object for SSE transport',
        serverName,
        'headers',
        config.headers
      );
    }
  }

  /**
   * Create transport with retry on failure
   */
  static async createTransportWithRetry(
    config: McpServerConfig,
    creationConfig: TransportCreationConfig,
    maxAttempts = 3
  ): Promise<TransportInstance> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const attemptConfig = {
          ...creationConfig,
          connectionAttempts: attempt,
        };

        return await this.createTransport(config, attemptConfig);
      } catch (error) {
        lastError = error as Error;
        this.logger.warning(`Transport creation attempt ${attempt}/${maxAttempts} failed for server '${creationConfig.serverName}': ${lastError.message}`);

        if (attempt < maxAttempts) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new TransportError(
      `Failed to create transport after ${maxAttempts} attempts: ${lastError?.message}`,
      creationConfig.serverName,
      (config as any).type || 'unknown',
      { attempts: maxAttempts, lastError: lastError?.message }
    );
  }

  /**
   * Dispose of a transport instance
   */
  static async disposeTransport(instance: TransportInstance): Promise<void> {
    try {
      if (instance.transport && typeof instance.transport.close === 'function') {
        await instance.transport.close();
        this.logger.debug(`Disposed ${instance.type} transport for server '${instance.metadata.serverName}'`);
      }
    } catch (error) {
      this.logger.warning(`Error disposing transport for server '${instance.metadata.serverName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 