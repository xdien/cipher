/**
 * MCP Aggregator - Unified MCP Server Interface
 *
 * Provides a unified interface that aggregates multiple MCP servers,
 * implementing the standard MCP server protocol while routing requests
 * to appropriate backend servers based on namespacing.
 */

import {
	ListToolsResult,
	CallToolResult,
	ListPromptsResult,
	GetPromptResult,
	ListResourcesResult,
	ReadResourceResult,
	Tool as SDKTool,
} from '@modelcontextprotocol/sdk/types.js';

import { NamespacingOptions, validateServerName } from './namespacing.js';

import { ResourceMaps, ResourceMapOptions, ResourceMapStats } from './resource-maps.js';

import {
	ConnectionStrategy,
	createConnectionStrategy,
	ConnectionStrategyConfig,
	ConnectionMode,
	ConnectionStrategyStats,
} from './connection-strategy.js';

import { IEnhancedMCPClient } from '../types/enhanced-client.js';
import { McpServerConfig } from '../types/config.js';
import { IContext } from '../../context/types.js';
import { Logger } from '../../logger/core/logger.js';
import { AsyncLock } from '../utils/async-lock.js';

/**
 * Aggregator configuration
 */
export interface MCPAggregatorConfig {
	/** Connection mode for the aggregator */
	connectionMode?: ConnectionMode;
	/** Connection strategy configuration */
	connectionStrategy?: ConnectionStrategyConfig;
	/** Resource mapping configuration */
	resourceMapping?: ResourceMapOptions;
	/** Namespacing configuration */
	namespacing?: NamespacingOptions;
	/** Context for client sessions */
	context?: IContext;
	/** Whether to enable parallel server loading */
	enableParallelLoading?: boolean;
	/** Server loading timeout in milliseconds */
	serverLoadingTimeout?: number;
	/** Whether to enforce strict initialization */
	strictInitialization?: boolean;
}

/**
 * Aggregator options for initialization
 */
export interface AggregatorOptions {
	/** Server configurations */
	serverConfigs?: Record<string, McpServerConfig>;
	/** Whether to force reinitialization */
	force?: boolean;
	/** Connection mode override */
	connectionMode?: ConnectionMode;
}

/**
 * Aggregator statistics
 */
export interface AggregatorStatistics {
	// Basic info
	initialized: boolean;
	serverCount: number;
	connectionMode: ConnectionMode;

	// Resource counts
	totalTools: number;
	totalPrompts: number;
	totalResources: number;

	// Performance metrics
	totalOperations: number;
	successfulOperations: number;
	failedOperations: number;
	averageResponseTime: number;

	// Connection stats
	connectionStats: ConnectionStrategyStats;
	resourceMapStats: ResourceMapStats;

	// Timestamps
	initializationTime?: Date;
	lastOperationTime?: Date;
	uptime: number;
}

/**
 * Main MCP Aggregator class
 *
 * Implements the standard MCP server interface while aggregating
 * multiple backend MCP servers with intelligent routing.
 */
export class MCPAggregator {
	private config: MCPAggregatorConfig;
	private logger: Logger;

	// Core components
	private resourceMaps: ResourceMaps;
	private connectionStrategy: ConnectionStrategy;

	// State management
	private initialized = false;
	private serverNames: string[] = [];
	private initializationLock = new AsyncLock();

	// Statistics tracking
	private statistics: AggregatorStatistics;
	private startTime = new Date();
	private operationTimes: number[] = [];

	constructor(config: MCPAggregatorConfig = {}) {
		this.config = {
			connectionMode: 'persistent',
			enableParallelLoading: true,
			serverLoadingTimeout: 60000,
			strictInitialization: false,
			...config,
		};

		this.logger = new Logger('mcp-aggregator');

		// Initialize resource maps
		this.resourceMaps = new ResourceMaps(this.config.resourceMapping);

		// Initialize statistics
		this.statistics = {
			initialized: false,
			serverCount: 0,
			connectionMode: this.config.connectionMode!,
			totalTools: 0,
			totalPrompts: 0,
			totalResources: 0,
			totalOperations: 0,
			successfulOperations: 0,
			failedOperations: 0,
			averageResponseTime: 0,
			connectionStats: {
				mode: this.config.connectionMode!,
				totalConnections: 0,
				activeConnections: 0,
				totalOperations: 0,
				connectionErrors: 0,
				averageConnectionTime: 0,
			},
			resourceMapStats: {
				totalTools: 0,
				totalPrompts: 0,
				totalResources: 0,
				serverCount: 0,
				memoryUsage: {
					toolMaps: 0,
					promptMaps: 0,
					resourceMaps: 0,
				},
			},
			uptime: 0,
		};

		this.logger.debug('Created MCP aggregator');
	}

	// ================== INITIALIZATION ==================

	/**
	 * Initialize the aggregator with server configurations
	 */
	async initialize(serverNames?: string[], options: AggregatorOptions = {}): Promise<void> {
		return this.initializationLock.withLock(async () => {
			if (this.initialized && !options.force) {
				this.logger.debug('MCP aggregator already initialized');
				return;
			}

			this.logger.info('Initializing MCP aggregator');

			try {
				// Setup server names
				if (serverNames) {
					this.serverNames = [...serverNames];
					// Validate server names
					for (const serverName of this.serverNames) {
						validateServerName(serverName);
					}
				}

				// Setup connection strategy
				await this.setupConnectionStrategy(options);

				// Initialize connection strategy if we have server configs
				if (options.serverConfigs) {
					await this.connectionStrategy.initialize(options.serverConfigs);
				}

				// Load servers if configurations provided
				if (options.serverConfigs && this.serverNames.length > 0) {
					await this.loadServers(options.force);
				}

				this.initialized = true;
				this.statistics.initialized = true;
				this.statistics.initializationTime = new Date();
				this.statistics.serverCount = this.serverNames.length;

				this.logger.info(`MCP aggregator initialized with ${this.serverNames.length} servers`);
			} catch (error) {
				this.logger.error(
					`Failed to initialize MCP aggregator: ${error instanceof Error ? error.message : String(error)}`
				);
				throw error;
			}
		});
	}

	/**
	 * Load all configured servers
	 */
	async loadServers(force: boolean = false): Promise<void> {
		if (this.initialized && !force) {
			this.logger.debug('Servers already loaded');
			return;
		}

		this.logger.info(`Loading ${this.serverNames.length} servers`);

		// Clear existing mappings if forcing reload
		if (force) {
			await this.resourceMaps.clear();
		}

		if (this.config.enableParallelLoading) {
			// Load servers in parallel
			const loadPromises = this.serverNames.map(serverName =>
				this.loadServer(serverName).catch(error => {
					this.logger.error(
						`Failed to load server '${serverName}': ${error instanceof Error ? error.message : String(error)}`
					);
					// Don't throw - allow other servers to load
				})
			);

			await Promise.allSettled(loadPromises);
		} else {
			// Load servers sequentially
			for (const serverName of this.serverNames) {
				try {
					await this.loadServer(serverName);
				} catch (error) {
					this.logger.error(
						`Failed to load server '${serverName}': ${error instanceof Error ? error.message : String(error)}`
					);
					if (this.config.strictInitialization) {
						throw error;
					}
				}
			}
		}

		// Update statistics
		await this.updateStatistics();

		this.logger.info('Server loading completed');
	}

	/**
	 * Load capabilities from a single server
	 */
	async loadServer(serverName: string): Promise<void> {
		this.logger.debug(`Loading server capabilities: ${serverName}`);

		try {
			const client = await this.connectionStrategy.getConnection(serverName);

			// Load capabilities in parallel
			const [toolsResult, promptsResult, resourcesResult] = await Promise.allSettled([
				this.loadServerTools(serverName, client),
				this.loadServerPrompts(serverName, client),
				this.loadServerResources(serverName, client),
			]);

			// Log any failures
			if (toolsResult.status === 'rejected') {
				this.logger.warning(`Failed to load tools from '${serverName}': ${toolsResult.reason}`);
			}
			if (promptsResult.status === 'rejected') {
				this.logger.warning(`Failed to load prompts from '${serverName}': ${promptsResult.reason}`);
			}
			if (resourcesResult.status === 'rejected') {
				this.logger.warning(
					`Failed to load resources from '${serverName}': ${resourcesResult.reason}`
				);
			}

			this.logger.debug(`Successfully loaded capabilities from server: ${serverName}`);
		} catch (error) {
			this.logger.error(
				`Error loading server '${serverName}': ${error instanceof Error ? error.message : String(error)}`
			);
			throw error;
		}
	}

	// ================== MCP SERVER INTERFACE ==================

	/**
	 * List all available tools
	 */
	async listTools(): Promise<ListToolsResult> {
		this.ensureInitialized();

		const startTime = Date.now();

		try {
			const allTools = await this.resourceMaps.getAllTools();
			const tools: SDKTool[] = Object.entries(allTools).map(([name, tool]) => ({
				name,
				description: tool.description,
				inputSchema: tool.parameters,
			}));

			this.recordOperation(Date.now() - startTime, true);

			return {
				tools,
			};
		} catch (error) {
			this.recordOperation(Date.now() - startTime, false);
			throw error;
		}
	}

	/**
	 * Call a specific tool
	 */
	async callTool(name: string, args?: any): Promise<CallToolResult> {
		this.ensureInitialized();

		const startTime = Date.now();

		try {
			// Find which server provides this tool
			const namespacedTool = await this.resourceMaps.getTool(name);

			if (!namespacedTool) {
				throw new Error(`Tool '${name}' not found`);
			}

			// Get connection and execute tool
			const client = await this.connectionStrategy.getConnection(namespacedTool.serverName);
			const result = await client.callToolWithLogging(namespacedTool.originalName, args);

			this.recordOperation(Date.now() - startTime, true);

			return result;
		} catch (error) {
			this.recordOperation(Date.now() - startTime, false);
			throw error;
		}
	}

	/**
	 * List all available prompts
	 */
	async listPrompts(): Promise<ListPromptsResult> {
		this.ensureInitialized();

		const startTime = Date.now();

		try {
			const promptNames = await this.resourceMaps.listPromptNames();
			const prompts = [];

			// Get unique prompts (avoid duplicates from aliases)
			const seenPrompts = new Set<string>();

			for (const promptName of promptNames) {
				const namespacedPrompt = await this.resourceMaps.getPrompt(promptName);
				if (namespacedPrompt && !seenPrompts.has(namespacedPrompt.namespacedName)) {
					seenPrompts.add(namespacedPrompt.namespacedName);
					prompts.push({
						name: promptName,
						description: namespacedPrompt.description,
						arguments: namespacedPrompt.arguments,
					});
				}
			}

			this.recordOperation(Date.now() - startTime, true);

			return {
				prompts,
			};
		} catch (error) {
			this.recordOperation(Date.now() - startTime, false);
			throw error;
		}
	}

	/**
	 * Get a specific prompt
	 */
	async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
		this.ensureInitialized();

		const startTime = Date.now();

		try {
			// Find which server provides this prompt
			const namespacedPrompt = await this.resourceMaps.getPrompt(name);

			if (!namespacedPrompt) {
				throw new Error(`Prompt '${name}' not found`);
			}

			// Get connection and retrieve prompt
			const client = await this.connectionStrategy.getConnection(namespacedPrompt.serverName);
			const result = await client.getPrompt(namespacedPrompt.originalName, args);

			this.recordOperation(Date.now() - startTime, true);

			return result;
		} catch (error) {
			this.recordOperation(Date.now() - startTime, false);
			throw error;
		}
	}

	/**
	 * List all available resources
	 */
	async listResources(): Promise<ListResourcesResult> {
		this.ensureInitialized();

		const startTime = Date.now();

		try {
			const resourceUris = await this.resourceMaps.listResourceUris();
			const resources = [];

			// Get unique resources (avoid duplicates from aliases)
			const seenResources = new Set<string>();

			for (const resourceUri of resourceUris) {
				const namespacedResource = await this.resourceMaps.getResource(resourceUri);
				if (namespacedResource && !seenResources.has(namespacedResource.namespacedUri)) {
					seenResources.add(namespacedResource.namespacedUri);
					resources.push({
						uri: resourceUri,
						name: namespacedResource.name,
						description: namespacedResource.description,
						mimeType: namespacedResource.mimeType,
					});
				}
			}

			this.recordOperation(Date.now() - startTime, true);

			return {
				resources,
			};
		} catch (error) {
			this.recordOperation(Date.now() - startTime, false);
			throw error;
		}
	}

	/**
	 * Read a specific resource
	 */
	async readResource(uri: string): Promise<ReadResourceResult> {
		this.ensureInitialized();

		const startTime = Date.now();

		try {
			// Find which server provides this resource
			const namespacedResource = await this.resourceMaps.getResource(uri);

			if (!namespacedResource) {
				throw new Error(`Resource '${uri}' not found`);
			}

			// Get connection and read resource
			const client = await this.connectionStrategy.getConnection(namespacedResource.serverName);
			const result = await client.readResource(namespacedResource.originalUri);

			this.recordOperation(Date.now() - startTime, true);

			return result;
		} catch (error) {
			this.recordOperation(Date.now() - startTime, false);
			throw error;
		}
	}

	// ================== AGGREGATOR-SPECIFIC METHODS ==================

	/**
	 * Get server capabilities for a specific server
	 */
	async getServerCapabilities(serverName: string): Promise<{
		tools: string[];
		prompts: string[];
		resources: string[];
	}> {
		this.ensureInitialized();

		const [tools, prompts, resources] = await Promise.all([
			this.resourceMaps.getToolsFromServer(serverName),
			this.resourceMaps.getPromptsFromServer(serverName),
			this.resourceMaps.getResourcesFromServer(serverName),
		]);

		return {
			tools: tools.map(t => t.namespacedName),
			prompts: prompts.map(p => p.namespacedName),
			resources: resources.map(r => r.namespacedUri),
		};
	}

	/**
	 * Add a new server to the aggregator
	 */
	async addServer(serverName: string, serverConfig: McpServerConfig): Promise<void> {
		validateServerName(serverName);

		if (this.serverNames.includes(serverName)) {
			throw new Error(`Server '${serverName}' already exists`);
		}

		this.logger.info(`Adding new server: ${serverName}`);

		// Add to connection strategy
		await this.connectionStrategy.initialize({
			...(await this.getServerConfigs()),
			[serverName]: serverConfig,
		});

		this.serverNames.push(serverName);

		// Load the new server
		await this.loadServer(serverName);

		// Update statistics
		await this.updateStatistics();

		this.logger.info(`Successfully added server: ${serverName}`);
	}

	/**
	 * Remove a server from the aggregator
	 */
	async removeServer(serverName: string): Promise<void> {
		const index = this.serverNames.indexOf(serverName);
		if (index === -1) {
			throw new Error(`Server '${serverName}' not found`);
		}

		this.logger.info(`Removing server: ${serverName}`);

		// Remove from resource maps
		await this.resourceMaps.removeServer(serverName);

		// Remove from server list
		this.serverNames.splice(index, 1);

		// Update statistics
		await this.updateStatistics();

		this.logger.info(`Successfully removed server: ${serverName}`);
	}

	/**
	 * Get aggregator statistics
	 */
	async getStatistics(): Promise<AggregatorStatistics> {
		await this.updateStatistics();
		return { ...this.statistics };
	}

	/**
	 * Check if aggregator is initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Get list of server names
	 */
	getServerNames(): string[] {
		return [...this.serverNames];
	}

	/**
	 * Shutdown the aggregator
	 */
	async shutdown(): Promise<void> {
		this.logger.info('Shutting down MCP aggregator');

		try {
			// Shutdown connection strategy
			if (this.connectionStrategy) {
				await this.connectionStrategy.shutdown();
			}

			// Clear resource maps
			await this.resourceMaps.dispose();

			this.initialized = false;
			this.statistics.initialized = false;

			this.logger.info('MCP aggregator shutdown complete');
		} catch (error) {
			this.logger.error(
				`Error during aggregator shutdown: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	// ================== PRIVATE METHODS ==================

	/**
	 * Setup connection strategy based on configuration
	 */
	private async setupConnectionStrategy(options: AggregatorOptions): Promise<void> {
		const connectionMode = options.connectionMode || this.config.connectionMode || 'persistent';

		const strategyConfig: ConnectionStrategyConfig = {
			mode: connectionMode,
			context: this.config.context,
			...this.config.connectionStrategy,
		};

		this.connectionStrategy = createConnectionStrategy(strategyConfig);
		this.statistics.connectionMode = connectionMode;
	}

	/**
	 * Load tools from a server
	 */
	private async loadServerTools(serverName: string, client: IEnhancedMCPClient): Promise<void> {
		try {
			const tools = await client.getTools();
			await this.resourceMaps.addTools(serverName, tools);
			this.logger.debug(`Loaded ${Object.keys(tools).length} tools from '${serverName}'`);
		} catch (error) {
			this.logger.debug(`No tools available from '${serverName}': ${error}`);
		}
	}

	/**
	 * Load prompts from a server
	 */
	private async loadServerPrompts(serverName: string, client: IEnhancedMCPClient): Promise<void> {
		try {
			const prompts = await client.listPrompts();
			await this.resourceMaps.addPrompts(serverName, prompts);
			this.logger.debug(`Loaded ${prompts.length} prompts from '${serverName}'`);
		} catch (error) {
			this.logger.debug(`No prompts available from '${serverName}': ${error}`);
		}
	}

	/**
	 * Load resources from a server
	 */
	private async loadServerResources(serverName: string, client: IEnhancedMCPClient): Promise<void> {
		try {
			const resources = await client.listResources();
			await this.resourceMaps.addResources(serverName, resources);
			this.logger.debug(`Loaded ${resources.length} resources from '${serverName}'`);
		} catch (error) {
			this.logger.debug(`No resources available from '${serverName}': ${error}`);
		}
	}

	/**
	 * Update aggregator statistics
	 */
	private async updateStatistics(): Promise<void> {
		try {
			const [resourceMapStats, connectionStats] = await Promise.all([
				this.resourceMaps.getStatistics(),
				this.connectionStrategy.getStatistics(),
			]);

			this.statistics.resourceMapStats = resourceMapStats;
			this.statistics.connectionStats = connectionStats;
			this.statistics.totalTools = resourceMapStats.totalTools;
			this.statistics.totalPrompts = resourceMapStats.totalPrompts;
			this.statistics.totalResources = resourceMapStats.totalResources;
			this.statistics.serverCount = this.serverNames.length;
			this.statistics.uptime = Date.now() - this.startTime.getTime();
			this.statistics.lastOperationTime = new Date();
		} catch (error) {
			this.logger.debug(
				`Error updating statistics: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Record operation statistics
	 */
	private recordOperation(responseTime: number, success: boolean): void {
		this.statistics.totalOperations++;

		if (success) {
			this.statistics.successfulOperations++;
		} else {
			this.statistics.failedOperations++;
		}

		this.operationTimes.push(responseTime);
		if (this.operationTimes.length > 100) {
			this.operationTimes = this.operationTimes.slice(-50);
		}

		this.statistics.averageResponseTime =
			this.operationTimes.reduce((a, b) => a + b, 0) / this.operationTimes.length;
	}

	/**
	 * Get current server configurations (placeholder)
	 */
	private async getServerConfigs(): Promise<Record<string, McpServerConfig>> {
		// This would need to be implemented based on how server configs are stored
		// For now, return empty object
		return {};
	}

	/**
	 * Ensure aggregator is initialized
	 */
	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error('MCP aggregator not initialized. Call initialize() first.');
		}
	}
}
