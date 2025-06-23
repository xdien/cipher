/**
 * MCP Server Configuration Types
 *
 * These types define the configuration structure for different types of MCP servers.
 */

import { z } from 'zod';

/**
 * Authentication settings for MCP servers
 */
export const MCPServerAuthSettingsSchema = z
	.object({
		apiKey: z.string().optional(),
		token: z.string().optional(),
		username: z.string().optional(),
		password: z.string().optional(),
	})
	.optional();

/**
 * Root settings for MCP servers (file:// URIs that server can access)
 */
export const MCPRootSettingsSchema = z.object({
	uri: z.string().regex(/^file:\/\//, 'URI must start with "file://"'),
	name: z.string().optional(),
	serverUriAlias: z.string().optional(),
});

/**
 * Base configuration for all MCP server types
 */
export const BaseMcpServerConfigSchema = z.object({
	type: z.enum(['stdio', 'sse', 'http', 'websocket']),
	name: z.string().optional(),
	description: z.string().optional(),
	timeout: z.number().default(60000),
	readTimeoutSeconds: z.number().optional(),
	httpTimeoutSeconds: z.number().optional(),
	terminateOnClose: z.boolean().default(true),
	auth: MCPServerAuthSettingsSchema,
	roots: z.array(MCPRootSettingsSchema).optional(),
});

/**
 * Configuration for stdio-based MCP servers
 */
export const StdioServerConfigSchema = BaseMcpServerConfigSchema.extend({
	type: z.literal('stdio'),
	command: z.string(),
	args: z.array(z.string()).default([]),
	env: z.record(z.string()).optional(),
});

/**
 * Configuration for SSE-based MCP servers
 */
export const SseServerConfigSchema = BaseMcpServerConfigSchema.extend({
	type: z.literal('sse'),
	url: z.string().url(),
	headers: z.record(z.string()).optional(),
});

/**
 * Configuration for HTTP-based MCP servers
 */
export const HttpServerConfigSchema = BaseMcpServerConfigSchema.extend({
	type: z.literal('http'),
	url: z.string().url(),
	headers: z.record(z.string()).optional(),
});

/**
 * Configuration for WebSocket-based MCP servers
 */
export const WebSocketServerConfigSchema = BaseMcpServerConfigSchema.extend({
	type: z.literal('websocket'),
	url: z.string().url(),
	headers: z.record(z.string()).optional(),
	protocols: z.array(z.string()).optional(),
});

/**
 * Combined schema for any MCP server configuration
 */
export const McpServerConfigSchema = z.discriminatedUnion('type', [
	StdioServerConfigSchema,
	SseServerConfigSchema,
	HttpServerConfigSchema,
	WebSocketServerConfigSchema,
]);

/**
 * Schema for all configured server instances
 */
export const ServerConfigsSchema = z.record(McpServerConfigSchema);

/**
 * Schema for MCP settings (top-level configuration)
 */
export const MCPSettingsSchema = z.object({
	servers: ServerConfigsSchema,
});

/**
 * Schema for application settings
 */
export const SettingsSchema = z.object({
	mcp: MCPSettingsSchema.optional(),
});

/**
 * Type for authentication settings
 */
export type MCPServerAuthSettings = z.infer<typeof MCPServerAuthSettingsSchema>;

/**
 * Type for root settings
 */
export type MCPRootSettings = z.infer<typeof MCPRootSettingsSchema>;

/**
 * Type for base MCP server configuration
 */
export type BaseMcpServerConfig = z.infer<typeof BaseMcpServerConfigSchema>;

/**
 * Type for stdio server configuration
 */
export type StdioServerConfig = z.infer<typeof StdioServerConfigSchema>;

/**
 * Type for SSE server configuration
 */
export type SseServerConfig = z.infer<typeof SseServerConfigSchema>;

/**
 * Type for HTTP server configuration
 */
export type HttpServerConfig = z.infer<typeof HttpServerConfigSchema>;

/**
 * Type for WebSocket server configuration
 */
export type WebSocketServerConfig = z.infer<typeof WebSocketServerConfigSchema>;

/**
 * Type for any MCP server configuration
 */
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/**
 * Type for all configured server instances
 */
export type ServerConfigs = z.infer<typeof ServerConfigsSchema>;

/**
 * Type for MCP settings
 */
export type MCPSettings = z.infer<typeof MCPSettingsSchema>;

/**
 * Type for application settings
 */
export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Transport types
 */
export const TRANSPORT_TYPES = ['stdio', 'sse', 'http', 'websocket'] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

/**
 * Validation helpers
 */
export const ConfigValidation = {
	isValidTransportType: (type: string): type is TransportType => {
		return TRANSPORT_TYPES.includes(type as TransportType);
	},

	validateServerConfig: (config: unknown): McpServerConfig => {
		return McpServerConfigSchema.parse(config);
	},

	validateServerConfigs: (configs: unknown): ServerConfigs => {
		return ServerConfigsSchema.parse(configs);
	},

	validateSettings: (settings: unknown): Settings => {
		return SettingsSchema.parse(settings);
	},
};
