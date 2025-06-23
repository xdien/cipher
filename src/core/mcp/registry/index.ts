/**
 * MCP Registry - Server Configuration and Lifecycle Management
 *
 * Exports server registry functionality for managing MCP server configurations,
 * loading from files, initialization hooks, and session lifecycle management.
 */

export {
	ServerRegistry,
	type InitHookCallable,
	type TransportContext,
	type ClientSessionFactory,
	type ServerRegistryConfig,
	type ServerEntry,
	type RegistryStatistics,
} from './server-registry.js';

export {
	type Settings,
	type MCPSettings,
	type ServerConfigs,
	type McpServerConfig,
	type MCPServerAuthSettings,
	type MCPRootSettings,
	ConfigValidation,
} from '../types/config.js';
