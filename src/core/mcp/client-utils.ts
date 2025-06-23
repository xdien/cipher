/**
 * MCP Client Utilities - Convenience APIs
 *
 * Provides simple convenience functions for creating and managing MCP client connections.
 * These functions offer easy-to-use APIs for the most common MCP usage patterns.
 */

import { IEnhancedMCPClient } from './types/enhanced-client.js';
import { McpServerConfig } from './types/config.js';
import { ServerRegistry, ClientSessionFactory } from './registry/server-registry.js';
import { MCPConnectionManager } from './manager/connection-manager.js';
import { MCPAgentClientSession } from './client/agent-session.js';
import { IContext } from '../context/types.js';
import { Logger } from '../logger/core/logger.js';

/**
 * Async generator function for ephemeral MCP client connections.
 * Automatically handles connection setup and cleanup.
 *
 * @param serverName Name of the server to connect to
 * @param serverRegistry Server registry containing server configurations
 * @param clientSessionFactory Optional factory for creating client sessions
 * @param sessionId Optional session ID for tracking
 * @yields Enhanced MCP client session
 *
 * @example
 * ```typescript
 * for await (const client of genClient('filesystem', serverRegistry)) {
 *   const tools = await client.getTools();
 *   console.log('Available tools:', Object.keys(tools));
 *   // Connection automatically cleaned up when generator exits
 * }
 * ```
 */
export async function* genClient(
	serverName: string,
	serverRegistry: ServerRegistry,
	clientSessionFactory?: ClientSessionFactory,
	sessionId?: string
): AsyncGenerator<IEnhancedMCPClient, void, unknown> {
	if (!serverRegistry) {
		throw new Error(
			'Server registry not found in the context. Please specify one either on this method, or in the context.'
		);
	}

	for await (const session of serverRegistry.initializeServer(
		serverName,
		clientSessionFactory,
		undefined, // initHook
		sessionId
	)) {
		yield session;
	}
}

/**
 * Create a persistent MCP client connection.
 * The connection will remain active until explicitly disconnected.
 *
 * @param serverName Name of the server to connect to
 * @param serverRegistry Server registry containing server configurations
 * @param connectionManager Connection manager for pooling connections
 * @param options Optional connection options
 * @returns Enhanced MCP client session
 *
 * @example
 * ```typescript
 * const client = await connect('filesystem', serverRegistry, connectionManager);
 * const tools = await client.getTools();
 * // Remember to call disconnect() when done
 * await disconnect('filesystem', connectionManager);
 * ```
 */
export async function connect(
	serverName: string,
	serverRegistry: ServerRegistry,
	connectionManager?: MCPConnectionManager,
	options?: {
		requireHealthy?: boolean;
		sessionId?: string;
	}
): Promise<IEnhancedMCPClient> {
	if (!serverRegistry) {
		throw new Error(
			'Server registry not found in the context. Please specify one either on this method, or in the context.'
		);
	}

	// If no connection manager provided, create a temporary one-off connection
	if (!connectionManager) {
		const serverConfig = serverRegistry.getServerConfig(serverName);
		if (!serverConfig) {
			throw new Error(`Server configuration not found for '${serverName}'`);
		}

		const sessionConfig = {
			serverConfig,
			serverName,
			sessionIdCallback: () => options?.sessionId || null,
		};

		const client = new MCPAgentClientSession(sessionConfig);
		await client.connect(serverConfig, serverName);
		return client;
	}

	// Use connection manager for persistent connections
	const connection = await connectionManager.getServerConnection(serverName, {
		requireHealthy: options?.requireHealthy ?? true,
	});

	return await connection.getSession();
}

/**
 * Disconnect from an MCP server or close all connections.
 *
 * @param serverName Name of the server to disconnect from (null for all servers)
 * @param connectionManager Connection manager handling the connections
 *
 * @example
 * ```typescript
 * // Disconnect from specific server
 * await disconnect('filesystem', connectionManager);
 *
 * // Disconnect from all servers
 * await disconnect(null, connectionManager);
 * ```
 */
export async function disconnect(
	serverName: string | null,
	connectionManager: MCPConnectionManager
): Promise<void> {
	if (!connectionManager) {
		throw new Error('Connection manager not provided');
	}

	if (serverName) {
		await connectionManager.removeServer(serverName);
	} else {
		await connectionManager.shutdown();
	}
}

/**
 * Create a temporary MCP client connection with automatic cleanup.
 * Best for one-off operations that don't need persistent connections.
 *
 * @param serverName Name of the server to connect to
 * @param serverConfig Server configuration
 * @param operation Function to execute with the client
 * @param options Optional configuration
 * @returns Result of the operation
 *
 * @example
 * ```typescript
 * const tools = await withTemporaryClient(
 *   'filesystem',
 *   serverConfig,
 *   async (client) => {
 *     return await client.getTools();
 *   },
 *   { timeout: 30000 }
 * );
 * ```
 */
export async function withTemporaryClient<T>(
	serverName: string,
	serverConfig: McpServerConfig,
	operation: (client: IEnhancedMCPClient) => Promise<T>,
	options?: {
		timeout?: number;
		context?: IContext;
		sessionId?: string;
	}
): Promise<T> {
	const sessionConfig = {
		serverConfig,
		serverName,
		context: options?.context,
		sessionIdCallback: () => options?.sessionId || null,
	};

	const client = new MCPAgentClientSession(sessionConfig);

	try {
		// Connect with timeout if specified
		if (options?.timeout) {
			await Promise.race([
				client.connect(serverConfig, serverName),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error(`Connection timeout after ${options.timeout}ms`)),
						options.timeout
					)
				),
			]);
		} else {
			await client.connect(serverConfig, serverName);
		}

		return await operation(client);
	} finally {
		// Always cleanup the connection
		if (client.disconnect) {
			try {
				await client.disconnect();
			} catch (error) {
				const logger = options?.context?.logger || new Logger('client-utils');
				logger.warning(
					`Error disconnecting temporary client: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}
}

/**
 * Validate that a server registry contains the specified server.
 *
 * @param serverRegistry Server registry to check
 * @param serverName Name of the server to validate
 * @throws Error if server is not found in the registry
 */
export function validateServerRegistry(serverRegistry: ServerRegistry, serverName?: string): void {
	if (!serverRegistry) {
		throw new Error(
			'Server registry not found in the context. Please specify one either on this method, or in the context.'
		);
	}

	if (serverName) {
		const serverConfig = serverRegistry.getServerConfig(serverName);
		if (!serverConfig) {
			throw new Error(`Server '${serverName}' not found in registry`);
		}
	}
}

/**
 * Get the status of all servers in a connection manager.
 *
 * @param connectionManager Connection manager to check
 * @returns Map of server names to their health status
 */
export async function getServerStatuses(
	connectionManager: MCPConnectionManager
): Promise<Map<string, boolean>> {
	const serverNames = connectionManager.getServerNames();
	const statusMap = new Map<string, boolean>();

	for (const serverName of serverNames) {
		const isHealthy = connectionManager.isServerHealthy(serverName);
		statusMap.set(serverName, isHealthy);
	}

	return statusMap;
}

/**
 * Wait for a server to become healthy.
 *
 * @param serverName Name of the server to wait for
 * @param connectionManager Connection manager handling the server
 * @param options Optional configuration
 * @returns True if server became healthy, false if timeout reached
 */
export async function waitForServerHealth(
	serverName: string,
	connectionManager: MCPConnectionManager,
	options?: {
		timeout?: number;
		checkInterval?: number;
	}
): Promise<boolean> {
	const timeout = options?.timeout || 30000; // 30 seconds default
	const checkInterval = options?.checkInterval || 1000; // 1 second default
	const startTime = Date.now();

	while (Date.now() - startTime < timeout) {
		if (connectionManager.isServerHealthy(serverName)) {
			return true;
		}

		await new Promise(resolve => setTimeout(resolve, checkInterval));
	}

	return false;
}
