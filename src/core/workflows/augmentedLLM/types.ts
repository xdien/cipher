import { z } from 'zod';

// ============================================================================
// Base Message Types
// ============================================================================

/**
 * Content types for messages
 */
export const TextContentSchema = z.object({
	type: z.literal('text'),
	text: z.string(),
});

export const ImageContentSchema = z.object({
	type: z.literal('image'),
	source: z.object({
		type: z.string(),
		media_type: z.string(),
		data: z.string(),
	}),
});

export const ContentSchema = z.union([TextContentSchema, ImageContentSchema]);

export type TextContent = z.infer<typeof TextContentSchema>;
export type ImageContent = z.infer<typeof ImageContentSchema>;
export type Content = z.infer<typeof ContentSchema>;

/**
 * Base message parameter type for LLM input
 */
export const MessageParamSchema = z.object({
	role: z.enum(['system', 'user', 'assistant', 'tool']),
	content: z.union([z.string(), z.array(ContentSchema)]),
	name: z.string().optional(),
	tool_call_id: z.string().optional(),
});

export type MessageParam = z.infer<typeof MessageParamSchema>;

/**
 * Base message type for LLM output
 */
export const MessageSchema = z.object({
	role: z.enum(['assistant', 'tool']),
	content: z.union([z.string(), z.array(ContentSchema)]),
	tool_calls: z
		.array(
			z.object({
				id: z.string(),
				type: z.literal('function'),
				function: z.object({
					name: z.string(),
					arguments: z.string(),
				}),
			})
		)
		.optional(),
	usage: z
		.object({
			prompt_tokens: z.number(),
			completion_tokens: z.number(),
			total_tokens: z.number(),
		})
		.optional(),
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Union type for various message input formats
 */
export type MessageTypes = string | MessageParam | MessageParam[];

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Model preferences for selection
 */
export const ModelPreferencesSchema = z.object({
	costTier: z.enum(['low', 'medium', 'high']).optional(),
	speedTier: z.enum(['slow', 'medium', 'fast']).optional(),
	intelligenceTier: z.enum(['low', 'medium', 'high']).optional(),
	hints: z
		.array(
			z.object({
				name: z.string(),
				value: z.any().optional(),
			})
		)
		.optional(),
});

export type ModelPreferences = z.infer<typeof ModelPreferencesSchema>;

/**
 * Request parameters for LLM calls
 */
export const RequestParamsSchema = z.object({
	model: z.string().optional(),
	maxTokens: z.number().min(1).max(100000).default(4000),
	temperature: z.number().min(0).max(2).default(0.7),
	topP: z.number().min(0).max(1).optional(),
	topK: z.number().min(1).optional(),
	stopSequences: z.array(z.string()).optional(),
	systemPrompt: z.string().optional(),
	useHistory: z.boolean().default(true),
	maxIterations: z.number().min(1).max(10).default(1),
	parallelToolCalls: z.boolean().default(false),
	includeContext: z.boolean().default(true),
	modelPreferences: ModelPreferencesSchema.optional(),
	metadata: z.record(z.any()).optional(),
});

export type RequestParams = z.infer<typeof RequestParamsSchema>;

// ============================================================================
// MCP (Model Context Protocol) Types
// ============================================================================

/**
 * MCP Message Result type
 */
export const MCPMessageResultSchema = z.object({
	role: z.enum(['assistant', 'tool']),
	content: z.union([z.string(), z.array(ContentSchema)]),
	model: z.string().optional(),
	stopReason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use']).optional(),
	usage: z
		.object({
			inputTokens: z.number(),
			outputTokens: z.number(),
			totalTokens: z.number(),
		})
		.optional(),
});

export type MCPMessageResult = z.infer<typeof MCPMessageResultSchema>;

/**
 * MCP Message Parameter type
 */
export const MCPMessageParamSchema = z.object({
	role: z.enum(['system', 'user', 'assistant', 'tool']),
	content: z.union([z.string(), z.array(ContentSchema)]),
	name: z.string().optional(),
	toolCallId: z.string().optional(),
});

export type MCPMessageParam = z.infer<typeof MCPMessageParamSchema>;

// ============================================================================
// Tool Calling Types
// ============================================================================

/**
 * Tool call request
 */
export const CallToolRequestSchema = z.object({
	method: z.literal('tools/call'),
	params: z.object({
		name: z.string(),
		arguments: z.record(z.any()).optional(),
	}),
});

export type CallToolRequest = z.infer<typeof CallToolRequestSchema>;

/**
 * Tool call result
 */
export const CallToolResultSchema = z.object({
	isError: z.boolean().default(false),
	content: z.array(ContentSchema),
	meta: z.record(z.any()).optional(),
});

export type CallToolResult = z.infer<typeof CallToolResultSchema>;

// ============================================================================
// Generic Type Constraints
// ============================================================================

/**
 * Generic constraint for message parameter types
 */
export interface MessageParamConstraint {
	role: string;
	content: string | Content[];
}

/**
 * Generic constraint for message types
 */
export interface MessageConstraint {
	role: string;
	content: string | Content[];
}

/**
 * Generic constraint for model types (structured responses)
 */
export interface ModelConstraint {
	[key: string]: any;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Error types for LLM operations
 */
export const LLMErrorSchema = z.object({
	code: z.enum([
		'INVALID_REQUEST',
		'MODEL_NOT_FOUND',
		'RATE_LIMIT_EXCEEDED',
		'CONTEXT_LENGTH_EXCEEDED',
		'TOOL_EXECUTION_FAILED',
		'NETWORK_ERROR',
		'UNKNOWN_ERROR',
	]),
	message: z.string(),
	details: z.record(z.any()).optional(),
});

export type LLMError = z.infer<typeof LLMErrorSchema>;

/**
 * Result wrapper type for operations that can fail
 */
export type Result<T, E = LLMError> = { success: true; data: T } | { success: false; error: E };

/**
 * Configuration for LLM providers
 */
export const ProviderConfigSchema = z.object({
	name: z.string(),
	apiKey: z.string().optional(),
	baseUrl: z.string().url().optional(),
	defaultModel: z.string().optional(),
	timeout: z.number().positive().optional(),
	retryAttempts: z.number().min(0).max(5).default(3),
	retryDelay: z.number().positive().default(1000),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for MessageParam
 */
export function isMessageParam(value: any): value is MessageParam {
	return MessageParamSchema.safeParse(value).success;
}

/**
 * Type guard for Message
 */
export function isMessage(value: any): value is Message {
	return MessageSchema.safeParse(value).success;
}

/**
 * Type guard for CallToolResult
 */
export function isCallToolResult(value: any): value is CallToolResult {
	return CallToolResultSchema.safeParse(value).success;
}

/**
 * Type guard for LLMError
 */
export function isLLMError(value: any): value is LLMError {
	return LLMErrorSchema.safeParse(value).success;
}
