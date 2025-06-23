/**
 * Simple MCP Usage Examples
 *
 * Demonstrates the optimized and simplified MCP APIs for common usage patterns.
 * These examples show how to use the convenience functions for typical MCP tasks.
 */

import {
	genClient,
	connect,
	disconnect,
	withTemporaryClient,
	ServerRegistry,
	MCPConnectionManager,
	MCPAggregator,
} from '../../dist/src/core';
import { McpServerConfig } from '../../dist/src/core';
import { Context } from '../../dist/src/core';

/**
 * Example 1: Simple ephemeral connection using genClient
 */
export async function ephemeralConnectionExample() {
	console.log('=== Ephemeral Connection Example ===\n');

	// Create context and server registry
	const context = new Context({ sessionId: 'ephemeral-example' });
	const serverRegistry = new ServerRegistry({ context });

	// Configure a simple filesystem server
	const filesystemConfig: McpServerConfig = {
		type: 'stdio',
		command: 'npx',
		args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
		timeout: 30000,
	};

	try {
		// Initialize the server registry first
		await serverRegistry.initialize();
		
		// Initialize registry with server configuration
		await serverRegistry.addServer('filesystem', filesystemConfig);

		// Use ephemeral connection with automatic cleanup
		for await (const client of genClient('filesystem', serverRegistry)) {
			console.log('Connected to filesystem server');

			// Use the client
			const tools = await client.getTools();
			console.log(`Available tools: ${Object.keys(tools).join(', ')}`);

			const prompts = await client.listPrompts();
			console.log(`Available prompts: ${prompts.length}`);

			// Connection automatically cleaned up when exiting the loop
			break;
		}

		console.log('✓ Ephemeral connection completed with automatic cleanup\n');
	} catch (error) {
		console.error('Ephemeral connection failed:', error);
	} finally {
		await serverRegistry.shutdown();
	}
}

/**
 * Example 2: Persistent connection using connect/disconnect
 */
export async function persistentConnectionExample() {
	console.log('=== Persistent Connection Example ===\n');

	const context = new Context({ sessionId: 'persistent-example' });
	const serverRegistry = new ServerRegistry({ context });
	const connectionManager = new MCPConnectionManager();

	const searchConfig: McpServerConfig = {
		type: 'stdio',
		command: 'npx',
		args: ['@modelcontextprotocol/server-brave-search'],
		timeout: 30000,
		env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || 'demo' },
	};

	try {
		// Initialize the server registry first
		await serverRegistry.initialize();
		
		// Setup registry and connection manager
		await serverRegistry.addServer('search', searchConfig);
		await connectionManager.initialize({ search: searchConfig }, context);

		// Create persistent connection
		const client = await connect('search', serverRegistry, connectionManager);
		console.log('Connected to search server (persistent)');

		// Use the persistent connection multiple times
		for (let i = 0; i < 3; i++) {
			const tools = await client.getTools();
			console.log(`Request ${i + 1}: Found ${Object.keys(tools).length} tools`);
		}

		// Manually disconnect when done
		await disconnect('search', connectionManager);
		console.log('✓ Disconnected from search server\n');
	} catch (error) {
		console.error('Persistent connection failed:', error);
	} finally {
		await connectionManager.shutdown();
		await serverRegistry.shutdown();
	}
}

/**
 * Example 3: One-off operation using withTemporaryClient
 */
export async function oneOffOperationExample() {
	console.log('=== One-off Operation Example ===\n');

	// Use a proper MCP server instead of echo
	const serverConfig: McpServerConfig = {
		type: 'stdio',
		command: 'npx',
		args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
		timeout: 15000,
	};

	try {
		// Perform a single operation with automatic connection management
		const result = await withTemporaryClient(
			'filesystem-oneoff',
			serverConfig,
			async client => {
				console.log('Connected to filesystem server for one-off operation');

				const tools = await client.getTools();
				const prompts = await client.listPrompts();
				const resources = await client.listResources();

				return {
					toolCount: Object.keys(tools).length,
					promptCount: prompts.length,
					resourceCount: resources.length,
				};
			},
			{ timeout: 10000 }
		);

		console.log('Operation result:', result);
		console.log('✓ One-off operation completed with automatic cleanup\n');
	} catch (error) {
		console.error('One-off operation failed:', error);
	}
}

/**
 * Example 4: Multi-server aggregation
 */
export async function multiServerAggregationExample() {
	console.log('=== Multi-Server Aggregation Example ===\n');

	const context = new Context({ sessionId: 'aggregation-example' });

	// Configure multiple servers
	const serverConfigs = {
		filesystem: {
			type: 'stdio' as const,
			command: 'npx',
			args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
			timeout: 30000,
		},
		search: {
			type: 'stdio' as const,
			command: 'npx',
			args: ['@modelcontextprotocol/server-brave-search'],
			timeout: 30000,
			env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || 'demo' },
		},
	};

	const aggregator = new MCPAggregator({
		connectionMode: 'persistent',
		context,
		enableParallelLoading: true,
		strictInitialization: false,
	});

	try {
		// Initialize aggregator with multiple servers
		await aggregator.initialize(['filesystem', 'search'], {
			serverConfigs,
			connectionMode: 'persistent',
		});

		console.log('Initialized aggregator with multiple servers');

		// Use unified interface to access all servers
		const allTools = await aggregator.listTools();
		console.log(`Total tools from all servers: ${allTools.tools.length}`);
		console.log(`Available tools: ${allTools.tools.map(tool => tool.name).join(', ')}`);

		const allPrompts = await aggregator.listPrompts();
		console.log(`Total prompts from all servers: ${allPrompts.prompts.length}`);

		const allResources = await aggregator.listResources();
		console.log(`Total resources from all servers: ${allResources.resources.length}`);

		// Get aggregator statistics
		const stats = await aggregator.getStatistics();
		console.log(
			`Aggregator stats: ${stats.serverCount} servers, ${stats.totalOperations} operations`
		);

		console.log('✓ Multi-server aggregation completed\n');
	} catch (error) {
		console.error('Multi-server aggregation failed (expected if servers not available):', error);
	} finally {
		await aggregator.shutdown();
	}
}

/**
 * Example 5: Error handling and health checking
 */
export async function healthCheckingExample() {
	console.log('=== Health Checking Example ===\n');

	const context = new Context({ sessionId: 'health-example' });
	const connectionManager = new MCPConnectionManager();

	try {
		// Initialize with a potentially unreliable server
		await connectionManager.initialize(
			{
				'test-server': {
					type: 'stdio',
					command: 'nonexistent-command',
					args: [],
					timeout: 5000,
				},
			},
			context
		);

		// Check server health
		const serverNames = connectionManager.getServerNames();
		console.log(`Checking health of servers: ${serverNames.join(', ')}`);

		for (const serverName of serverNames) {
			const isHealthy = connectionManager.isServerHealthy(serverName);
			console.log(`Server '${serverName}' is ${isHealthy ? 'healthy' : 'unhealthy'}`);
		}

		// Get detailed statistics
		const stats = await connectionManager.getStatistics();
		console.log('Connection manager stats:', {
			totalConnections: stats.totalConnections,
			healthyConnections: stats.healthyConnections,
			failedConnections: stats.failedConnections,
		});

		console.log('✓ Health checking completed\n');
	} catch (error) {
		console.log('Health checking detected issues (expected):', error);
	} finally {
		await connectionManager.shutdown();
	}
}

/**
 * Run all simple usage examples
 */
export async function runSimpleUsageExamples() {
	console.log('🚀 Running Simple MCP Usage Examples\n');
	console.log('='.repeat(60) + '\n');

	try {
		// await ephemeralConnectionExample();
		// await persistentConnectionExample();
		// await oneOffOperationExample();
		await multiServerAggregationExample();
		// await healthCheckingExample();

		console.log('='.repeat(60));
		console.log('✅ All simple usage examples completed!');
		console.log('='.repeat(60) + '\n');
	} catch (error) {
		console.error('❌ Simple usage examples failed:', error);
		process.exit(1);
	}
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runSimpleUsageExamples().catch(console.error);
}
