/**
 * Enhanced MCP Client Types
 * 
 * These types extend the base MCP client interfaces to add support for 
 * agent-specific functionality like sampling callbacks and session management.
 */


import { IMCPClient } from './client.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';
import { McpServerConfig } from './config.js';

/**
 * Interface for a function that handles sampling requests
 * This is called when an MCP server needs to generate text using an AI model
 */
export interface ISamplingCallback {
  (params: SamplingParams): Promise<SamplingResult>;
}

/**
 * Interface for a function that handles list_roots requests
 * This is called when an MCP server wants to know what root resources are available
 */
export interface IListRootsCallback {
  (): Promise<Root[]>;
}

/**
 * Interface for a function that provides session IDs
 * This is used for HTTP transport types that support session tracking
 */
export interface ISessionIdCallback {
  (): string | null;
}

/**
 * Parameters for a sampling request
 */
export interface SamplingParams {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  [key: string]: any;
}

/**
 * Result from a sampling operation
 */
export interface SamplingResult {
  text: string;
  finish_reason?: 'stop' | 'length' | 'content_filter' | string;
  error?: string;
  [key: string]: any;
}

/**
 * Root resource information
 */
export interface Root {
  id: string;
  displayName: string;
  description?: string;
}

/**
 * Enhanced MCP Client interface that extends the base IMCPClient
 * with agent-specific functionality
 */
export interface IEnhancedMCPClient extends IMCPClient {
  // Session management
  setSessionIdCallback(callback: ISessionIdCallback): void;
  getSessionId(): string | null;

  // Progress notification
  sendProgressNotification(token: string, progress: number, total?: number): Promise<void>;
  
  // Custom callbacks
  setSamplingCallback(callback: ISamplingCallback): void;
  setListRootsCallback(callback: IListRootsCallback): void;
  
  // Handle sampling requests
  handleSampling(params: SamplingParams): Promise<SamplingResult>;
  
  // Context integration
  getContext(): IContext | undefined;
  getLogger(): Logger;
  
  // Enhanced operations with logging
  callToolWithLogging(name: string, args: any): Promise<any>;
}

/**
 * Configuration for an enhanced MCP client session
 */
export interface MCPAgentSessionConfig {
  serverConfig: McpServerConfig;
  serverName: string;
  context?: IContext;
  samplingCallback?: ISamplingCallback;
  listRootsCallback?: IListRootsCallback;
  sessionIdCallback?: ISessionIdCallback;
  upstreamSession?: IEnhancedMCPClient;
}
