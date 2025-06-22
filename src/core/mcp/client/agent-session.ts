/**
 * MCPAgentClientSession
 * 
 * An enhanced MCP client that provides agent-specific functionality like
 * sampling callbacks, session management, and logging.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { 
  ISamplingCallback,
  IListRootsCallback,
  ISessionIdCallback,
  IEnhancedMCPClient,
  SamplingParams,
  SamplingResult,
  Root,
  MCPAgentSessionConfig
} from '../types/enhanced-client.js';
import { MCPClient } from './base-client.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * An enhanced MCP client session with agent-specific functiolity
 */
export class MCPAgentClientSession extends MCPClient implements IEnhancedMCPClient {
  private context?: IContext;
  private sessionIdCallback?: ISessionIdCallback;
  private samplingCallback?: ISamplingCallback;
  private listRootsCallback?: IListRootsCallback;
  private upstreamSession?: IEnhancedMCPClient;
  private serverName: string;
  private sessionLogger: Logger; // Use a different name to avoid conflict
  
  /**
   * Create a new MCP agent client session
   * 
   * @param config Configuration for the session
   */
  constructor(config: MCPAgentSessionConfig) {
    super();
    
    this.context = config.context;
    this.serverName = config.serverName;
    this.sessionLogger = this.context?.logger || new Logger('cipher-session');
    
    this.sessionIdCallback = config.sessionIdCallback;
    this.upstreamSession = config.upstreamSession;
    
    // Set default callbacks if not provided
    if (config.samplingCallback) {
      this.samplingCallback = config.samplingCallback;
    } else {
      this.samplingCallback = this.handleSamplingCallback.bind(this);
    }
    
    if (config.listRootsCallback) {
      this.listRootsCallback = config.listRootsCallback;
    } else {
      this.listRootsCallback = this.handleListRootsCallback.bind(this);
    }
    
    this.sessionLogger.debug(`Created MCP agent client session for server: ${this.serverName}`);
  }
  
  /**
   * Connect to the MCP server and set up event handlers
   * 
   * @param config Server configuration
   * @param serverName Server name
   * @returns Connected client instance
   */
  async connect(config: any, serverName: string): Promise<Client> {
    this.sessionLogger.debug(`Connecting to MCP server: ${serverName}`);
    
    try {
      const client = await super.connect(config, serverName);
      
      // Note: Standard MCP SDK Client doesn't support callback registration
      // These would need to be handled through the MCP protocol directly
      // or through custom extensions to the client
      
      this.sessionLogger.info(`Successfully connected to MCP server: ${serverName}`);
      return client;
    } catch (error) {
      this.sessionLogger.error(`Failed to connect to MCP server ${serverName}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Set a callback to retrieve session IDs
   * 
   * @param callback Function that returns a session ID or null
   */
  setSessionIdCallback(callback: ISessionIdCallback): void {
    this.sessionIdCallback = callback;
    this.sessionLogger.debug('Session ID callback set');
  }
  
  /**
   * Get the current session ID
   * 
   * @returns Current session ID or null if not set
   */
  getSessionId(): string | null {
    return this.sessionIdCallback ? this.sessionIdCallback() : null;
  }
  
  /**
   * Set a callback to handle sampling requests
   * 
   * @param callback Sampling callback function
   */
  setSamplingCallback(callback: ISamplingCallback): void {
    this.samplingCallback = callback;
    this.sessionLogger.debug('Sampling callback updated');
  }
  
  /**
   * Set a callback to handle list_roots requests
   * 
   * @param callback List roots callback function
   */
  setListRootsCallback(callback: IListRootsCallback): void {
    this.listRootsCallback = callback;
    this.sessionLogger.debug('List roots callback updated');
  }
  
  /**
   * Get the context associated with this session
   * 
   * @returns Context or undefined if not set
   */
  getContext(): IContext | undefined {
    return this.context;
  }
  
  /**
   * Get the logger for this session
   * 
   * @returns Logger instance
   */
  getLogger(): Logger {
    return this.sessionLogger;
  }
  
  /**
   * Call a tool with enhanced logging
   * 
   * @param name Tool name
   * @param args Tool arguments
   * @returns Tool results
   */
  async callToolWithLogging(name: string, args: any): Promise<any> {
    this.sessionLogger.debug(`Calling tool '${name}' with args: ${JSON.stringify(args)}`);
    
    try {
      // Add session ID to request if available
      const sessionId = this.getSessionId();
      if (sessionId && typeof args === 'object') {
        args = { ...args, _sessionId: sessionId };
      }
      
      // Call the tool with logging
      const startTime = Date.now();
      const result = await super.callTool(name, args);
      const duration = Date.now() - startTime;
      
      this.sessionLogger.debug(`Tool '${name}' completed in ${duration}ms`);
      return result;
    } catch (error) {
      this.sessionLogger.error(`Error calling tool '${name}': ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Send a progress notification for a long-running operation
   * 
   * @param token Token identifying the operation
   * @param progress Current progress value (0-100)
   * @param total Optional total value
   */
  async sendProgressNotification(token: string, progress: number, total?: number): Promise<void> {
    this.sessionLogger.debug(`Sending progress notification: ${progress}${total ? `/${total}` : ''} for token ${token}`);
    
    try {
      const client = await this.getConnectedClient();
      
      // Note: Standard MCP SDK Client doesn't have sendProgressNotification
      // This would need to be implemented as a custom notification through the MCP protocol
      // For now, we'll just log the progress
      this.sessionLogger.info(`Progress update [${token}]: ${progress}${total ? `/${total}` : ''}`);
      
      // In a real implementation, you might send a custom notification:
      // await client.sendNotification({
      //   method: 'progress',
      //   params: { token, progress, total, sessionId: this.getSessionId() || undefined }
      // });
      
    } catch (error) {
      this.sessionLogger.warning(`Failed to send progress notification: ${error instanceof Error ? error.message : String(error)}`);
      // Non-critical error, don't throw
    }
  }
  
  /**
   * Handle a sampling request directly
   * 
   * @param params Sampling parameters
   * @returns Sampling result
   */
  public async handleSampling(params: SamplingParams): Promise<SamplingResult> {
    return this.handleSamplingCallback(params);
  }
  
  /**
   * Internal sampling callback handler
   * 
   * @param params Sampling parameters
   * @returns Sampling result
   */
  private async handleSamplingCallback(params: SamplingParams): Promise<SamplingResult> {
    this.sessionLogger.debug(`Handling sampling request for model: ${params.model}`);
    
    try {
      // Try to use upstream session if available
      if (this.upstreamSession) {
        this.sessionLogger.debug('Using upstream session for sampling');
        
        // Check if the upstream session has a sampling callback
        // Try to use the upstream session for sampling if it has appropriate methods
        if (typeof this.upstreamSession.handleSampling === 'function') {
          try {
            return await this.upstreamSession.handleSampling(params);
          } catch (error) {
            this.sessionLogger.warning(`Upstream session can't handle sampling: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Otherwise, try to find a tool named 'sample' or similar
        try {
          const result = await this.upstreamSession.callTool('sample', params);
          if (typeof result === 'string') {
            return { text: result };
          }
          return result;
        } catch (error) {
          this.sessionLogger.warning(`Error using upstream session for sampling: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // If we reach here, we need a fallback implementation
      // This is a simplified version - in a real implementation,
      // you would likely have a more robust fallback strategy
      
      this.sessionLogger.warning('No upstream session available for sampling, using mock implementation');
      
      // Mock implementation
      return {
        text: `[This is a mock response for sampling request with model ${params.model}]`,
        finish_reason: 'mock',
      };
      
      // In a real implementation, you might use a direct client:
      // const client = new AnthropicClient(...);
      // const response = await client.generate(params);
      // return { text: response.text, ... };
    } catch (error) {
      this.sessionLogger.error(`Error in sampling callback: ${error instanceof Error ? error.message : String(error)}`);
      return {
        text: '',
        error: error instanceof Error ? error.message : String(error),
        finish_reason: 'error',
      };
    }
  }
  
  /**
   * Default handler for list_roots requests
   * 
   * @returns List of root resources
   */
  private async handleListRootsCallback(): Promise<Root[]> {
    this.sessionLogger.debug('Handling list_roots request');
    
    try {
      // Try to get roots from context if available
      const config = this.context?.config;
      if (config && config.roots && Array.isArray(config.roots)) {
        this.sessionLogger.debug(`Returning ${config.roots.length} roots from context configuration`);
        return config.roots;
      }
      
      // Otherwise return an empty list
      return [];
    } catch (error) {
      this.sessionLogger.error(`Error in list_roots callback: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
