/**
 * Base MCP Client Interface
 *
 * Defines the core interface for MCP clients that can provide tools,
 * prompts, and resources.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { McpServerConfig } from './config.js';

/**
 * Interface for any provider of tools
 */
export interface ToolProvider {
	getTools(): Promise<ToolSet>;
	callTool(toolName: string, args: any): Promise<any>;
}

/**
 * Tool definition interface
 */
export interface Tool {
	description: string;
	parameters: any; // JSONSchema for parameters
}

/**
 * Mapping of tool names to tool definitions
 */
export interface ToolSet {
	[toolName: string]: Tool;
}

/**
 * Interface for MCP clients specifically, that can provide tools
 */
export interface IMCPClient extends ToolProvider {
	// Connection Management
	connect(config: McpServerConfig, serverName: string): Promise<Client>;
	disconnect?(): Promise<void>;

	// Prompt Management
	listPrompts(): Promise<string[]>;
	getPrompt(name: string, args?: any): Promise<GetPromptResult>;

	// Resource Management
	listResources(): Promise<string[]>;
	readResource(uri: string): Promise<ReadResourceResult>;

	// MCP Client Management
	getConnectedClient(): Promise<Client>;
	getConnectionStatus(): boolean;
}
