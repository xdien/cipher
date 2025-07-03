/**
 * Core types and interfaces for the internal tools system.
 *
 * This module defines the type system for internal tools that work alongside
 * MCP tools to provide built-in agent capabilities like memory management,
 * session control, and system operations.
 */

import { Tool, ToolParameters, ToolExecutionResult } from '../../mcp/types.js';

/**
 * Categories for organizing internal tools
 */
export type InternalToolCategory = 'memory' | 'session' | 'system';

/**
 * Internal tool handler function signature
 */
export type InternalToolHandler = (args: any) => Promise<ToolExecutionResult>;

/**
 * Internal tool definition extending the base Tool interface
 */
export interface InternalTool extends Tool {
	/**
	 * Unique name for the tool (should be prefixed with 'cipher_')
	 */
	name: string;

	/**
	 * Category for organizing tools
	 */
	category: InternalToolCategory;

	/**
	 * Marker to identify this as an internal tool
	 */
	internal: true;

	/**
	 * Handler function that executes the tool
	 */
	handler: InternalToolHandler;

	/**
	 * Optional version for tool evolution
	 */
	version?: string;
}

/**
 * Collection of internal tools indexed by their names
 */
export interface InternalToolSet {
	[toolName: string]: InternalTool;
}

/**
 * Configuration for the internal tool manager
 */
export interface InternalToolManagerConfig {
	/**
	 * Whether to enable internal tools
	 * @default true
	 */
	enabled?: boolean;

	/**
	 * Maximum execution timeout for internal tools in milliseconds
	 * @default 30000 (30 seconds)
	 */
	timeout?: number;

	/**
	 * Whether to cache tool lookups for performance
	 * @default true
	 */
	enableCache?: boolean;

	/**
	 * Cache timeout in milliseconds
	 * @default 300000 (5 minutes)
	 */
	cacheTimeout?: number;
}

/**
 * Tool registration result
 */
export interface ToolRegistrationResult {
	success: boolean;
	message: string;
	conflictedWith?: string;
}

/**
 * Tool execution context provided to handlers
 */
export interface InternalToolContext {
	/**
	 * Tool name being executed
	 */
	toolName: string;

	/**
	 * Execution start time
	 */
	startTime: number;

	/**
	 * Optional session ID if available
	 */
	sessionId: string | undefined;

	/**
	 * Any additional metadata
	 */
	metadata: Record<string, any> | undefined;
}

/**
 * Statistics for internal tool usage
 */
export interface ToolExecutionStats {
	/**
	 * Total number of executions
	 */
	totalExecutions: number;

	/**
	 * Number of successful executions
	 */
	successfulExecutions: number;

	/**
	 * Number of failed executions
	 */
	failedExecutions: number;

	/**
	 * Average execution time in milliseconds
	 */
	averageExecutionTime: number;

	/**
	 * Last execution timestamp
	 */
	lastExecuted?: number;
}

/**
 * Interface for internal tool manager
 */
export interface IInternalToolManager {
	/**
	 * Initialize the internal tool manager
	 */
	initialize(): Promise<void>;

	/**
	 * Register a new internal tool
	 */
	registerTool(tool: InternalTool): ToolRegistrationResult;

	/**
	 * Unregister an internal tool
	 */
	unregisterTool(toolName: string): boolean;

	/**
	 * Get all registered internal tools
	 */
	getAllTools(): InternalToolSet;

	/**
	 * Get a specific internal tool by name
	 */
	getTool(toolName: string): InternalTool | undefined;

	/**
	 * Check if a tool name is an internal tool
	 */
	isInternalTool(toolName: string): boolean;

	/**
	 * Execute an internal tool
	 */
	executeTool(
		toolName: string,
		args: any,
		context?: Partial<InternalToolContext>
	): Promise<ToolExecutionResult>;

	/**
	 * Get tools by category
	 */
	getToolsByCategory(category: InternalToolCategory): InternalToolSet;

	/**
	 * Get execution statistics for a tool
	 */
	getToolStats(toolName: string): ToolExecutionStats | undefined;

	/**
	 * Get overall manager statistics
	 */
	getManagerStats(): {
		totalTools: number;
		toolsByCategory: Record<InternalToolCategory, number>;
		totalExecutions: number;
	};

	/**
	 * Clear all execution statistics
	 */
	clearStats(): void;

	/**
	 * Shutdown the internal tool manager
	 */
	shutdown(): Promise<void>;
}

/**
 * Prefix for all internal tool names to avoid conflicts
 */
export const INTERNAL_TOOL_PREFIX = 'cipher_';

/**
 * Helper function to create internal tool name
 */
export function createInternalToolName(baseName: string): string {
	return baseName.startsWith(INTERNAL_TOOL_PREFIX)
		? baseName
		: `${INTERNAL_TOOL_PREFIX}${baseName}`;
}

/**
 * Helper function to check if a tool name is internal
 */
export function isInternalToolName(toolName: string): boolean {
	return toolName.startsWith(INTERNAL_TOOL_PREFIX);
}
