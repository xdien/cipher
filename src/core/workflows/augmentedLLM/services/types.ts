import { z } from 'zod';
import {
	MessageTypes,
	RequestParams,
	MessageParamConstraint,
	MessageConstraint,
	ModelConstraint,
	MCPMessageResult,
	MCPMessageParam,
	CallToolRequest,
	CallToolResult,
} from '../types.js';
import { IMemory } from '../memory/types.js';
import { IContext, IModelSelector } from '../utils/types.js';

// ============================================================================
// Phase 2: Core Protocol Interfaces
// ============================================================================

/**
 * Protocol defining the interface for augmented LLMs
 * This is the core interface that all LLM implementations must follow
 */
export interface IAugmentedLLMProtocol<
	MessageParamT extends MessageParamConstraint = MessageParamConstraint,
	MessageT extends MessageConstraint = MessageConstraint,
> {
	/**
	 * Request an LLM generation, which may run multiple iterations, and return the result
	 */
	generate(message: MessageTypes, requestParams?: RequestParams): Promise<MessageT[]>;

	/**
	 * Request an LLM generation and return the string representation of the result
	 */
	generateStr(message: MessageTypes, requestParams?: RequestParams): Promise<string>;

	/**
	 * Request a structured LLM generation and return the result as a validated model
	 */
	generateStructured<ModelT extends ModelConstraint>(
		message: MessageTypes,
		responseModel: z.ZodSchema<ModelT>,
		requestParams?: RequestParams
	): Promise<ModelT>;
}

/**
 * Conversions between LLM provider and MCP types
 * This interface handles the conversion between provider-specific types and MCP standard types
 */
export interface IProviderToMCPConverter<
	MessageParamT extends MessageParamConstraint = MessageParamConstraint,
	MessageT extends MessageConstraint = MessageConstraint,
> {
	/**
	 * Convert an LLM response to an MCP message result type
	 */
	toMcpMessageResult(result: MessageT): MCPMessageResult;

	/**
	 * Convert an MCP message result to an LLM response type
	 */
	fromMcpMessageResult(result: MCPMessageResult): MessageT;

	/**
	 * Convert an LLM input to an MCP message (SamplingMessage) type
	 */
	toMcpMessageParam(param: MessageParamT): MCPMessageParam;

	/**
	 * Convert an MCP message (SamplingMessage) to an LLM input type
	 */
	fromMcpMessageParam(param: MCPMessageParam): MessageParamT;

	/**
	 * Convert an MCP tool result to an LLM input type
	 */
	fromMcpToolResult(result: CallToolResult, toolUseId: string): MessageParamT;
}

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * Agent interface for tool execution and management
 */
export interface IAgent {
	/**
	 * Agent name identifier
	 */
	readonly name: string;

	/**
	 * Agent instruction/system prompt
	 */
	readonly instruction?: string;

	/**
	 * Available server names for tools
	 */
	readonly serverNames: string[];

	/**
	 * Call a tool by name with arguments
	 */
	callTool(toolName: string, args: Record<string, any>): Promise<CallToolResult>;

	/**
	 * Get available tools
	 */
	getAvailableTools(): Promise<ToolInfo[]>;

	/**
	 * Check if a specific tool is available
	 */
	hasTool(toolName: string): Promise<boolean>;
}

/**
 * Tool information schema and type
 */
export const ToolInfoSchema = z.object({
	name: z.string(),
	description: z.string(),
	parameters: z.record(z.any()),
	serverName: z.string(),
	deprecated: z.boolean().default(false),
});

export type ToolInfo = z.infer<typeof ToolInfoSchema>;

// ============================================================================
// Context Dependent Interface
// ============================================================================

/**
 * Interface for components that depend on execution context
 */
export interface IContextDependent {
	/**
	 * Execution context containing shared resources
	 */
	readonly context: IContext;
}

// ============================================================================
// Main Augmented LLM Service Interface
// ============================================================================

/**
 * The main interface for augmented LLM services
 * Combines all protocols and adds service-specific functionality
 */
export interface IAugmentedLLMService<
	MessageParamT extends MessageParamConstraint = MessageParamConstraint,
	MessageT extends MessageConstraint = MessageConstraint,
> extends IAugmentedLLMProtocol<MessageParamT, MessageT>,
		IProviderToMCPConverter<MessageParamT, MessageT>,
		IContextDependent {
	// ============================================================================
	// Core Properties
	// ============================================================================

	/**
	 * Provider identifier (e.g., 'openai', 'anthropic')
	 */
	readonly provider?: string;

	/**
	 * Service name identifier
	 */
	readonly name: string;

	/**
	 * Service instruction/system prompt
	 */
	readonly instruction?: string;

	/**
	 * Conversation history memory
	 */
	readonly history: IMemory<MessageParamT>;

	/**
	 * Default request parameters
	 */
	readonly defaultRequestParams?: RequestParams;

	/**
	 * Associated agent for tool execution
	 */
	readonly agent: IAgent;

	// ============================================================================
	// Model Selection and Configuration
	// ============================================================================

	/**
	 * Select an appropriate model based on request parameters
	 */
	selectModel(requestParams?: RequestParams): Promise<string | null>;

	/**
	 * Get merged request parameters with defaults and overrides
	 */
	getRequestParams(requestParams?: RequestParams, defaultParams?: RequestParams): RequestParams;

	// ============================================================================
	// Message Utilities
	// ============================================================================

	/**
	 * Convert a response message to an input parameter for chaining
	 */
	convertMessageToMessageParam(message: MessageT): MessageParamT;

	/**
	 * Get the last message from conversation history
	 */
	getLastMessage(): Promise<MessageParamT | null>;

	/**
	 * Get the string representation of the last message
	 */
	getLastMessageStr(): Promise<string | null>;

	/**
	 * Convert a message parameter to string representation
	 */
	messageParamStr(message: MessageParamT): string;

	/**
	 * Convert a message to string representation
	 */
	messageStr(message: MessageT, contentOnly?: boolean): string;

	// ============================================================================
	// Tool Execution Hooks
	// ============================================================================

	/**
	 * Called before a tool is executed. Return false to prevent execution
	 */
	preToolCall(
		toolCallId: string | null,
		request: CallToolRequest
	): Promise<CallToolRequest | boolean>;

	/**
	 * Called after a tool execution. Can modify the result before it's returned
	 */
	postToolCall(
		toolCallId: string | null,
		request: CallToolRequest,
		result: CallToolResult
	): Promise<CallToolResult>;

	/**
	 * Execute a tool with the given parameters and optional ID
	 */
	callTool(request: CallToolRequest, toolCallId?: string): Promise<CallToolResult>;
}

// ============================================================================
// Service Configuration
// ============================================================================

/**
 * Configuration for creating an augmented LLM service
 */
export const AugmentedLLMConfigSchema = z.object({
	name: z.string(),
	provider: z.string().optional(),
	instruction: z.string().optional(),
	serverNames: z.array(z.string()).default([]),
	defaultRequestParams: z.any().optional(), // RequestParamsSchema would be circular
	memoryConfig: z.any().optional(), // MemoryConfigSchema
	context: z.any().optional(), // IContext
});

export type AugmentedLLMConfig = z.infer<typeof AugmentedLLMConfigSchema>;

// ============================================================================
// Factory Interface
// ============================================================================

/**
 * Factory interface for creating LLM service instances
 */
export interface IAugmentedLLMFactory {
	/**
	 * Create a new LLM service instance
	 */
	create<
		MessageParamT extends MessageParamConstraint = MessageParamConstraint,
		MessageT extends MessageConstraint = MessageConstraint,
	>(
		config: AugmentedLLMConfig
	): Promise<IAugmentedLLMService<MessageParamT, MessageT>>;

	/**
	 * Get supported providers
	 */
	getSupportedProviders(): string[];

	/**
	 * Check if a provider is supported
	 */
	supportsProvider(provider: string): boolean;
}

// ============================================================================
// Event System
// ============================================================================

/**
 * Events emitted by LLM services
 */
export interface LLMServiceEvents {
	'generation:start': { message: MessageTypes; requestParams?: RequestParams };
	'generation:complete': { result: any; duration: number };
	'generation:error': { error: Error; message: MessageTypes };
	'tool:call:start': { request: CallToolRequest; toolCallId?: string };
	'tool:call:complete': { result: CallToolResult; duration: number };
	'tool:call:error': { error: Error; request: CallToolRequest };
	'memory:update': { added: any[]; removed: any[] };
}

/**
 * Event emitter interface for LLM services
 */
export interface ILLMServiceEventEmitter {
	/**
	 * Emit an event
	 */
	emit<K extends keyof LLMServiceEvents>(event: K, data: LLMServiceEvents[K]): void;

	/**
	 * Listen to an event
	 */
	on<K extends keyof LLMServiceEvents>(
		event: K,
		listener: (data: LLMServiceEvents[K]) => void
	): void;

	/**
	 * Remove event listener
	 */
	off<K extends keyof LLMServiceEvents>(
		event: K,
		listener: (data: LLMServiceEvents[K]) => void
	): void;
}
