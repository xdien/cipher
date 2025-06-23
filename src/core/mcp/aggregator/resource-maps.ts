/**
 * Resource Mapping System for MCP Aggregator
 *
 * Implements three-tier mapping strategy for efficient resource lookups:
 * 1. Primary: namespacedName -> resource info
 * 2. Secondary: serverName -> resources from that server
 * 3. Thread safety: AsyncLock for concurrent access
 */

import { AsyncLock } from '../utils/async-lock.js';
import { createNamespacedName, generateResourceNames, NamespacingOptions } from './namespacing.js';
import { Tool, ToolSet } from '../types/client.js';

/**
 * Namespaced tool information
 */
export interface NamespacedTool {
	tool: Tool;
	serverName: string;
	namespacedName: string;
	originalName: string;
	aliases: string[]; // All possible names (namespaced and non-namespaced)
}

/**
 * Namespaced prompt information
 */
export interface NamespacedPrompt {
	name: string;
	description?: string;
	arguments?: any[];
	serverName: string;
	namespacedName: string;
	originalName: string;
	aliases: string[];
}

/**
 * Namespaced resource information
 */
export interface NamespacedResource {
	uri: string;
	name?: string;
	description?: string;
	mimeType?: string;
	serverName: string;
	namespacedUri: string;
	originalUri: string;
	aliases: string[];
}

/**
 * Resource statistics
 */
export interface ResourceMapStats {
	totalTools: number;
	totalPrompts: number;
	totalResources: number;
	serverCount: number;
	memoryUsage: {
		toolMaps: number;
		promptMaps: number;
		resourceMaps: number;
	};
}

/**
 * Options for resource map operations
 */
export interface ResourceMapOptions {
	/** Namespacing options */
	namespacing?: NamespacingOptions;
	/** Whether to update existing entries */
	allowUpdates?: boolean;
	/** Whether to merge with existing aliases */
	mergeAliases?: boolean;
}

/**
 * Three-tier resource mapping system with thread safety
 */
export class ResourceMaps {
	// Tool mappings
	private namespacedToolMap = new Map<string, NamespacedTool>();
	private serverToToolMap = new Map<string, NamespacedTool[]>();

	// Prompt mappings
	private namespacedPromptMap = new Map<string, NamespacedPrompt>();
	private serverToPromptMap = new Map<string, NamespacedPrompt[]>();

	// Resource mappings
	private namespacedResourceMap = new Map<string, NamespacedResource>();
	private serverToResourceMap = new Map<string, NamespacedResource[]>();

	// Thread safety
	private toolMapLock = new AsyncLock();
	private promptMapLock = new AsyncLock();
	private resourceMapLock = new AsyncLock();

	// Configuration
	private options: ResourceMapOptions;

	constructor(options: ResourceMapOptions = {}) {
		this.options = {
			allowUpdates: true,
			mergeAliases: true,
			...options,
		};
	}

	// ================== TOOL OPERATIONS ==================

	/**
	 * Add a tool to the mappings
	 */
	async addTool(
		serverName: string,
		tool: Tool,
		toolName: string,
		options?: ResourceMapOptions
	): Promise<void> {
		await this.toolMapLock.withLock(async () => {
			const opts = { ...this.options, ...options };
			const namespacedName = createNamespacedName(
				serverName,
				toolName,
				opts.namespacing?.separator
			);
			const aliases = generateResourceNames(serverName, toolName, opts.namespacing);

			const namespacedTool: NamespacedTool = {
				tool,
				serverName,
				namespacedName,
				originalName: toolName,
				aliases,
			};

			// Check for existing entry
			const existing = this.namespacedToolMap.get(namespacedName);
			if (existing && !opts.allowUpdates) {
				throw new Error(`Tool '${namespacedName}' already exists and updates are not allowed`);
			}

			// Update primary mapping
			this.namespacedToolMap.set(namespacedName, namespacedTool);

			// Update all aliases
			for (const alias of aliases) {
				this.namespacedToolMap.set(alias, namespacedTool);
			}

			// Update server mapping
			if (!this.serverToToolMap.has(serverName)) {
				this.serverToToolMap.set(serverName, []);
			}

			const serverTools = this.serverToToolMap.get(serverName)!;
			const existingIndex = serverTools.findIndex(t => t.originalName === toolName);

			if (existingIndex >= 0) {
				serverTools[existingIndex] = namespacedTool;
			} else {
				serverTools.push(namespacedTool);
			}
		});
	}

	/**
	 * Add multiple tools from a server
	 */
	async addTools(serverName: string, tools: ToolSet, options?: ResourceMapOptions): Promise<void> {
		const addPromises = Object.entries(tools).map(([toolName, tool]) =>
			this.addTool(serverName, tool, toolName, options)
		);

		await Promise.all(addPromises);
	}

	/**
	 * Get a tool by name (namespaced or non-namespaced)
	 */
	async getTool(name: string): Promise<NamespacedTool | undefined> {
		return this.toolMapLock.withLock(async () => {
			return this.namespacedToolMap.get(name);
		});
	}

	/**
	 * Get all tools from a specific server
	 */
	async getToolsFromServer(serverName: string): Promise<NamespacedTool[]> {
		return this.toolMapLock.withLock(async () => {
			return [...(this.serverToToolMap.get(serverName) || [])];
		});
	}

	/**
	 * Get all tools as a ToolSet (for compatibility)
	 */
	async getAllTools(): Promise<ToolSet> {
		return this.toolMapLock.withLock(async () => {
			const toolSet: ToolSet = {};

			for (const [name, namespacedTool] of this.namespacedToolMap) {
				toolSet[name] = namespacedTool.tool;
			}

			return toolSet;
		});
	}

	/**
	 * List all tool names (including aliases)
	 */
	async listToolNames(): Promise<string[]> {
		return this.toolMapLock.withLock(async () => {
			return Array.from(this.namespacedToolMap.keys());
		});
	}

	// ================== PROMPT OPERATIONS ==================

	/**
	 * Add a prompt to the mappings
	 */
	async addPrompt(
		serverName: string,
		promptName: string,
		promptInfo: { description?: string; arguments?: any[] } = {},
		options?: ResourceMapOptions
	): Promise<void> {
		await this.promptMapLock.withLock(async () => {
			const opts = { ...this.options, ...options };
			const namespacedName = createNamespacedName(
				serverName,
				promptName,
				opts.namespacing?.separator
			);
			const aliases = generateResourceNames(serverName, promptName, opts.namespacing);

			const namespacedPrompt: NamespacedPrompt = {
				name: promptName,
				description: promptInfo.description,
				arguments: promptInfo.arguments,
				serverName,
				namespacedName,
				originalName: promptName,
				aliases,
			};

			// Update primary mapping
			this.namespacedPromptMap.set(namespacedName, namespacedPrompt);

			// Update all aliases
			for (const alias of aliases) {
				this.namespacedPromptMap.set(alias, namespacedPrompt);
			}

			// Update server mapping
			if (!this.serverToPromptMap.has(serverName)) {
				this.serverToPromptMap.set(serverName, []);
			}

			const serverPrompts = this.serverToPromptMap.get(serverName)!;
			const existingIndex = serverPrompts.findIndex(p => p.originalName === promptName);

			if (existingIndex >= 0) {
				serverPrompts[existingIndex] = namespacedPrompt;
			} else {
				serverPrompts.push(namespacedPrompt);
			}
		});
	}

	/**
	 * Add multiple prompts from a server
	 */
	async addPrompts(
		serverName: string,
		prompts: string[] | Array<{ name: string; description?: string; arguments?: any[] }>,
		options?: ResourceMapOptions
	): Promise<void> {
		const addPromises = prompts.map(prompt => {
			if (typeof prompt === 'string') {
				return this.addPrompt(serverName, prompt, {}, options);
			} else {
				return this.addPrompt(
					serverName,
					prompt.name,
					{
						description: prompt.description,
						arguments: prompt.arguments,
					},
					options
				);
			}
		});

		await Promise.all(addPromises);
	}

	/**
	 * Get a prompt by name
	 */
	async getPrompt(name: string): Promise<NamespacedPrompt | undefined> {
		return this.promptMapLock.withLock(async () => {
			return this.namespacedPromptMap.get(name);
		});
	}

	/**
	 * Get all prompts from a specific server
	 */
	async getPromptsFromServer(serverName: string): Promise<NamespacedPrompt[]> {
		return this.promptMapLock.withLock(async () => {
			return [...(this.serverToPromptMap.get(serverName) || [])];
		});
	}

	/**
	 * List all prompt names
	 */
	async listPromptNames(): Promise<string[]> {
		return this.promptMapLock.withLock(async () => {
			return Array.from(this.namespacedPromptMap.keys());
		});
	}

	// ================== RESOURCE OPERATIONS ==================

	/**
	 * Add a resource to the mappings
	 */
	async addResource(
		serverName: string,
		resourceUri: string,
		resourceInfo: {
			name?: string;
			description?: string;
			mimeType?: string;
		} = {},
		options?: ResourceMapOptions
	): Promise<void> {
		await this.resourceMapLock.withLock(async () => {
			const opts = { ...this.options, ...options };
			const namespacedUri = createNamespacedName(
				serverName,
				resourceUri,
				opts.namespacing?.separator
			);
			const aliases = generateResourceNames(serverName, resourceUri, opts.namespacing);

			const namespacedResource: NamespacedResource = {
				uri: resourceUri,
				name: resourceInfo.name,
				description: resourceInfo.description,
				mimeType: resourceInfo.mimeType,
				serverName,
				namespacedUri,
				originalUri: resourceUri,
				aliases,
			};

			// Update primary mapping
			this.namespacedResourceMap.set(namespacedUri, namespacedResource);

			// Update all aliases
			for (const alias of aliases) {
				this.namespacedResourceMap.set(alias, namespacedResource);
			}

			// Update server mapping
			if (!this.serverToResourceMap.has(serverName)) {
				this.serverToResourceMap.set(serverName, []);
			}

			const serverResources = this.serverToResourceMap.get(serverName)!;
			const existingIndex = serverResources.findIndex(r => r.originalUri === resourceUri);

			if (existingIndex >= 0) {
				serverResources[existingIndex] = namespacedResource;
			} else {
				serverResources.push(namespacedResource);
			}
		});
	}

	/**
	 * Add multiple resources from a server
	 */
	async addResources(
		serverName: string,
		resources:
			| string[]
			| Array<{
					uri: string;
					name?: string;
					description?: string;
					mimeType?: string;
			  }>,
		options?: ResourceMapOptions
	): Promise<void> {
		const addPromises = resources.map(resource => {
			if (typeof resource === 'string') {
				return this.addResource(serverName, resource, {}, options);
			} else {
				return this.addResource(
					serverName,
					resource.uri,
					{
						name: resource.name,
						description: resource.description,
						mimeType: resource.mimeType,
					},
					options
				);
			}
		});

		await Promise.all(addPromises);
	}

	/**
	 * Get a resource by URI
	 */
	async getResource(uri: string): Promise<NamespacedResource | undefined> {
		return this.resourceMapLock.withLock(async () => {
			return this.namespacedResourceMap.get(uri);
		});
	}

	/**
	 * Get all resources from a specific server
	 */
	async getResourcesFromServer(serverName: string): Promise<NamespacedResource[]> {
		return this.resourceMapLock.withLock(async () => {
			return [...(this.serverToResourceMap.get(serverName) || [])];
		});
	}

	/**
	 * List all resource URIs
	 */
	async listResourceUris(): Promise<string[]> {
		return this.resourceMapLock.withLock(async () => {
			return Array.from(this.namespacedResourceMap.keys());
		});
	}

	// ================== SERVER OPERATIONS ==================

	/**
	 * Remove all resources from a server
	 */
	async removeServer(serverName: string): Promise<void> {
		await Promise.all([
			this.removeServerTools(serverName),
			this.removeServerPrompts(serverName),
			this.removeServerResources(serverName),
		]);
	}

	/**
	 * Remove all tools from a server
	 */
	async removeServerTools(serverName: string): Promise<void> {
		await this.toolMapLock.withLock(async () => {
			const serverTools = this.serverToToolMap.get(serverName) || [];

			// Remove from primary map and aliases
			for (const tool of serverTools) {
				for (const alias of tool.aliases) {
					this.namespacedToolMap.delete(alias);
				}
				this.namespacedToolMap.delete(tool.namespacedName);
			}

			// Remove from server map
			this.serverToToolMap.delete(serverName);
		});
	}

	/**
	 * Remove all prompts from a server
	 */
	async removeServerPrompts(serverName: string): Promise<void> {
		await this.promptMapLock.withLock(async () => {
			const serverPrompts = this.serverToPromptMap.get(serverName) || [];

			// Remove from primary map and aliases
			for (const prompt of serverPrompts) {
				for (const alias of prompt.aliases) {
					this.namespacedPromptMap.delete(alias);
				}
				this.namespacedPromptMap.delete(prompt.namespacedName);
			}

			// Remove from server map
			this.serverToPromptMap.delete(serverName);
		});
	}

	/**
	 * Remove all resources from a server
	 */
	async removeServerResources(serverName: string): Promise<void> {
		await this.resourceMapLock.withLock(async () => {
			const serverResources = this.serverToResourceMap.get(serverName) || [];

			// Remove from primary map and aliases
			for (const resource of serverResources) {
				for (const alias of resource.aliases) {
					this.namespacedResourceMap.delete(alias);
				}
				this.namespacedResourceMap.delete(resource.namespacedUri);
			}

			// Remove from server map
			this.serverToResourceMap.delete(serverName);
		});
	}

	/**
	 * List all servers with resources
	 */
	async listServers(): Promise<string[]> {
		const servers = new Set<string>();

		// Collect servers from all maps
		for (const serverName of this.serverToToolMap.keys()) {
			servers.add(serverName);
		}
		for (const serverName of this.serverToPromptMap.keys()) {
			servers.add(serverName);
		}
		for (const serverName of this.serverToResourceMap.keys()) {
			servers.add(serverName);
		}

		return Array.from(servers);
	}

	// ================== UTILITY OPERATIONS ==================

	/**
	 * Clear all mappings
	 */
	async clear(): Promise<void> {
		await Promise.all([
			this.toolMapLock.withLock(async () => {
				this.namespacedToolMap.clear();
				this.serverToToolMap.clear();
			}),
			this.promptMapLock.withLock(async () => {
				this.namespacedPromptMap.clear();
				this.serverToPromptMap.clear();
			}),
			this.resourceMapLock.withLock(async () => {
				this.namespacedResourceMap.clear();
				this.serverToResourceMap.clear();
			}),
		]);
	}

	/**
	 * Get statistics about the resource mappings
	 */
	async getStatistics(): Promise<ResourceMapStats> {
		const [toolCount, promptCount, resourceCount, servers] = await Promise.all([
			this.toolMapLock.withLock(async () => this.namespacedToolMap.size),
			this.promptMapLock.withLock(async () => this.namespacedPromptMap.size),
			this.resourceMapLock.withLock(async () => this.namespacedResourceMap.size),
			this.listServers(),
		]);

		return {
			totalTools: toolCount as number,
			totalPrompts: promptCount as number,
			totalResources: resourceCount as number,
			serverCount: servers.length,
			memoryUsage: {
				toolMaps: this.namespacedToolMap.size + this.serverToToolMap.size,
				promptMaps: this.namespacedPromptMap.size + this.serverToPromptMap.size,
				resourceMaps: this.namespacedResourceMap.size + this.serverToResourceMap.size,
			},
		};
	}

	/**
	 * Check if a resource exists
	 */
	async hasResource(name: string, type: 'tool' | 'prompt' | 'resource'): Promise<boolean> {
		switch (type) {
			case 'tool':
				return this.toolMapLock.withLock(async () => this.namespacedToolMap.has(name));
			case 'prompt':
				return this.promptMapLock.withLock(async () => this.namespacedPromptMap.has(name));
			case 'resource':
				return this.resourceMapLock.withLock(async () => this.namespacedResourceMap.has(name));
			default:
				return false;
		}
	}

	/**
	 * Dispose of the resource maps and clean up locks
	 */
	async dispose(): Promise<void> {
		await this.clear();
		// AsyncLock doesn't need explicit disposal, but we can clear references
	}
}
