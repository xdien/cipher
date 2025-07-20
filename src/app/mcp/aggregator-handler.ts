/**
 * Aggregator MCP Handler for exposing aggregated tools as a unified MCP server.
 *
 * This file contains the handler for running Cipher in aggregator mode,
 * where it connects to multiple MCP servers and exposes their combined tools
 * through a single MCP interface.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { AggregatorMCPManager } from '@core/mcp/aggregator.js';
import { createToolArgumentValidator, validateToolArguments } from '@core/mcp/schema-converter.js';
import { logger } from '@core/logger/index.js';
import type { AggregatorConfig, ToolRegistryEntry } from '@core/mcp/types.js';

/**
 * Initialize aggregator MCP server
 * @param config - Aggregator configuration
 */
export async function initializeAggregatorServer(config: AggregatorConfig): Promise<void> {
	logger.info('[Aggregator Handler] Initializing aggregator MCP server');

	// Create aggregator manager
	const aggregatorManager = new AggregatorMCPManager();

	// Start the aggregator (connects to downstream servers)
	await aggregatorManager.startServer(config);

	// Create MCP server instance
	const server = new Server(
		{
			name: 'cipher-aggregator',
			version: '1.0.0',
		},
		{
			capabilities: {
				tools: {},
				resources: {},
				prompts: {},
			},
		}
	);

	// Register aggregated capabilities
	await registerAggregatedTools(server, aggregatorManager);
	await registerAggregatedResources(server, aggregatorManager);
	await registerAggregatedPrompts(server, aggregatorManager);

	// Create transport
	const transport = new StdioServerTransport();

	// Connect server to transport
	logger.info('[Aggregator Handler] Connecting aggregator server to stdio transport');
	await server.connect(transport);

	logger.info('[Aggregator Handler] Aggregator MCP server initialized and connected successfully');
	logger.info('[Aggregator Handler] Aggregated tools are now available to external clients');

	// Handle shutdown gracefully
	process.on('SIGINT', async () => {
		logger.info('[Aggregator Handler] Shutting down aggregator server');
		await aggregatorManager.stopServer();
		process.exit(0);
	});

	process.on('SIGTERM', async () => {
		logger.info('[Aggregator Handler] Shutting down aggregator server');
		await aggregatorManager.stopServer();
		process.exit(0);
	});

	// Keep the process alive
	process.stdin.resume();
}

/**
 * Register aggregated tools as MCP tools
 */
async function registerAggregatedTools(
	server: Server,
	aggregatorManager: AggregatorMCPManager
): Promise<void> {
	logger.debug('[Aggregator Handler] Registering aggregated tools');

	// Get all aggregated tools
	const tools = await aggregatorManager.getAllTools();
	const toolRegistry = aggregatorManager.getToolRegistry();

	// Build MCP tool list with enhanced metadata
	const mcpTools = Object.entries(tools).map(([toolName, tool]) => {
		const registryEntry = toolRegistry.get(toolName);
		return {
			name: toolName,
			description: `${tool.description}${registryEntry ? ` (from ${registryEntry.clientName})` : ''}`,
			inputSchema: tool.parameters,
		};
	});

	logger.info(
		`[Aggregator Handler] Registering ${mcpTools.length} aggregated tools: ${mcpTools.map(t => t.name).join(', ')}`
	);

	// Register list tools handler
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		// Refresh tools on each request to ensure latest state
		const currentTools = await aggregatorManager.getAllTools();
		const currentRegistry = aggregatorManager.getToolRegistry();

		const refreshedMcpTools = Object.entries(currentTools).map(([toolName, tool]) => {
			const registryEntry = currentRegistry.get(toolName);
			return {
				name: toolName,
				description: `${tool.description}${registryEntry ? ` (from ${registryEntry.clientName})` : ''}`,
				inputSchema: tool.parameters,
			};
		});

		return { tools: refreshedMcpTools };
	});

	// Register call tool handler
	server.setRequestHandler(CallToolRequestSchema, async request => {
		const { name, arguments: args } = request.params;
		logger.info(`[Aggregator Handler] Tool called: ${name}`, { toolName: name, args });

		try {
			// Get tool definition for validation
			const currentTools = await aggregatorManager.getAllTools();
			const toolDef = currentTools[name];

			if (!toolDef) {
				throw new Error(`Tool '${name}' not found in aggregated tools`);
			}

			// Validate arguments if schema is available
			if (toolDef.parameters) {
				const validator = createToolArgumentValidator(toolDef.parameters);
				const validation = validateToolArguments(args || {}, validator);

				if (!validation.success) {
					throw new Error(`Invalid arguments for tool '${name}': ${validation.error}`);
				}
			}

			// Execute the tool through the aggregator
			const result = await aggregatorManager.executeTool(name, args);

			// Format response for MCP
			return {
				content: [
					{
						type: 'text',
						text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`[Aggregator Handler] Error in tool '${name}'`, { error: errorMessage });
			throw new Error(`Tool execution failed: ${errorMessage}`);
		}
	});
}

/**
 * Register aggregated resources as MCP resources
 */
async function registerAggregatedResources(
	server: Server,
	aggregatorManager: AggregatorMCPManager
): Promise<void> {
	logger.debug('[Aggregator Handler] Registering aggregated resources');

	// Register list resources handler
	server.setRequestHandler(ListResourcesRequestSchema, async () => {
		try {
			// Get resources from all connected servers
			const resources = await aggregatorManager.listAllResources();

			// Add aggregator-specific resources
			const aggregatorResources = [
				{
					uri: 'aggregator://stats',
					name: 'Aggregator Statistics',
					description: 'Statistics and metrics for the aggregator server',
					mimeType: 'application/json',
				},
				{
					uri: 'aggregator://registry',
					name: 'Tool Registry',
					description: 'Complete registry of aggregated tools with metadata',
					mimeType: 'application/json',
				},
			];

			// Convert resource URIs to resource objects
			const mcpResources = resources.map(uri => ({
				uri,
				name: uri.split('/').pop() || uri,
				description: `Aggregated resource: ${uri}`,
				mimeType: 'application/octet-stream',
			}));

			return {
				resources: [...mcpResources, ...aggregatorResources],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('[Aggregator Handler] Error listing resources', { error: errorMessage });
			return { resources: [] };
		}
	});

	// Register read resource handler
	server.setRequestHandler(ReadResourceRequestSchema, async request => {
		const { uri } = request.params;
		logger.info(`[Aggregator Handler] Resource requested: ${uri}`);

		// Handle aggregator-specific resources
		if (uri.startsWith('aggregator://')) {
			return await handleAggregatorResource(uri, aggregatorManager);
		}

		// Delegate to aggregated servers
		try {
			return await aggregatorManager.readResource(uri);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`[Aggregator Handler] Error reading resource '${uri}'`, { error: errorMessage });
			throw new Error(`Failed to read resource: ${errorMessage}`);
		}
	});
}

/**
 * Register aggregated prompts as MCP prompts
 */
async function registerAggregatedPrompts(
	server: Server,
	aggregatorManager: AggregatorMCPManager
): Promise<void> {
	logger.debug('[Aggregator Handler] Registering aggregated prompts');

	// Register list prompts handler
	server.setRequestHandler(ListPromptsRequestSchema, async () => {
		try {
			const prompts = await aggregatorManager.listAllPrompts();

			const mcpPrompts = prompts.map(name => ({
				name,
				description: `Aggregated prompt: ${name}`,
			}));

			return { prompts: mcpPrompts };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('[Aggregator Handler] Error listing prompts', { error: errorMessage });
			return { prompts: [] };
		}
	});

	// Register get prompt handler
	server.setRequestHandler(GetPromptRequestSchema, async request => {
		const { name, arguments: args } = request.params;
		logger.info(`[Aggregator Handler] Prompt requested: ${name}`);

		try {
			return await aggregatorManager.getPrompt(name, args);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`[Aggregator Handler] Error getting prompt '${name}'`, { error: errorMessage });
			throw new Error(`Failed to get prompt: ${errorMessage}`);
		}
	});
}

/**
 * Handle aggregator-specific resources
 */
async function handleAggregatorResource(
	uri: string,
	aggregatorManager: AggregatorMCPManager
): Promise<any> {
	switch (uri) {
		case 'aggregator://stats':
			return await getAggregatorStats(aggregatorManager);
		case 'aggregator://registry':
			return await getToolRegistry(aggregatorManager);
		default:
			throw new Error(`Unknown aggregator resource: ${uri}`);
	}
}

/**
 * Get aggregator statistics resource
 */
async function getAggregatorStats(aggregatorManager: AggregatorMCPManager): Promise<any> {
	try {
		const stats = aggregatorManager.getStats();
		const clients = aggregatorManager.getClients();
		const failedConnections = aggregatorManager.getFailedConnections();

		const enhancedStats = {
			...stats,
			connectedClients: Array.from(clients.keys()),
			failedConnections,
			timestamp: new Date().toISOString(),
		};

		return {
			contents: [
				{
					uri: 'aggregator://stats',
					mimeType: 'application/json',
					text: JSON.stringify(enhancedStats, null, 2),
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error('[Aggregator Handler] Error getting aggregator stats', { error: errorMessage });

		const errorStats = {
			error: `Failed to retrieve stats: ${errorMessage}`,
			timestamp: new Date().toISOString(),
		};

		return {
			contents: [
				{
					uri: 'aggregator://stats',
					mimeType: 'application/json',
					text: JSON.stringify(errorStats, null, 2),
				},
			],
		};
	}
}

/**
 * Get tool registry resource
 */
async function getToolRegistry(aggregatorManager: AggregatorMCPManager): Promise<any> {
	try {
		const registry = aggregatorManager.getToolRegistry();
		const registryData = Array.from(registry.entries()).map(([name, entry]) => ({
			name,
			originalName: entry.originalName,
			clientName: entry.clientName,
			registeredName: entry.registeredName,
			timestamp: entry.timestamp,
			description: entry.tool.description,
		}));

		return {
			contents: [
				{
					uri: 'aggregator://registry',
					mimeType: 'application/json',
					text: JSON.stringify(registryData, null, 2),
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error('[Aggregator Handler] Error getting tool registry', { error: errorMessage });

		const errorRegistry = {
			error: `Failed to retrieve registry: ${errorMessage}`,
			timestamp: new Date().toISOString(),
		};

		return {
			contents: [
				{
					uri: 'aggregator://registry',
					mimeType: 'application/json',
					text: JSON.stringify(errorRegistry, null, 2),
				},
			],
		};
	}
}
