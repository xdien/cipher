/**
 * Base MCP Client Implementation
 *
 * Provides a foundation for connecting to and interacting with MCP servers
 * through different transport types.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

import { IMCPClient, ToolSet } from '../types/client.js';
import {
	McpServerConfig,
	StdioServerConfig,
	SseServerConfig,
	HttpServerConfig,
} from '../types/config.js';
import { Logger } from '../../logger/core/logger.js';

/**
 * Base implementation of an MCP client
 */
export class MCPClient implements IMCPClient {
	private client: Client | null = null;
	private transport: any = null;
	private isConnected = false;
	private serverCommand: string | null = null;
	private originalArgs: string[] | null = null;
	private resolvedArgs: string[] | null = null;
	private serverEnv: Record<string, string> | null = null;
	private serverSpawned = false;
	private serverPid: number | null = null;
	private serverAlias: string | null = null;
	private timeout: number = 60000;
	private logger: Logger;

	constructor() {
		this.logger = new Logger('cipher-mcp-client');
	}

	/**
	 * Connect to an MCP server
	 *
	 * @param config Server configuration
	 * @param serverName Server name for logging
	 * @returns Connected client
	 */
	async connect(config: McpServerConfig, serverName: string): Promise<Client> {
		this.timeout = config.timeout;

		if (config.type === 'stdio') {
			return this.connectViaStdio(config as StdioServerConfig, serverName);
		} else if (config.type === 'sse') {
			return this.connectViaSSE(config as SseServerConfig, serverName);
		} else if (config.type === 'http') {
			return this.connectViaHttp(config as HttpServerConfig, serverName);
		} else {
			throw new Error('Unsupported server type');
		}
	}

	/**
	 * Connect to an MCP server via stdio
	 *
	 * @param config Stdio server configuration
	 * @param serverAlias Server alias for logging
	 * @returns Connected client
	 */
	private async connectViaStdio(config: StdioServerConfig, serverAlias: string): Promise<Client> {
		// Store server details
		this.serverCommand = config.command;
		this.originalArgs = [...config.args];
		this.resolvedArgs = [...this.originalArgs];
		this.serverEnv = config.env || null;
		this.serverAlias = serverAlias;

		// Windows path resolution for npx
		if (process.platform === 'win32' && config.command === 'npx') {
			this.serverCommand = 'C:\\Program Files\\nodejs\\npx.cmd';
			this.logger.debug(`Resolved Windows path for npx: ${this.serverCommand}`);
		}

		this.logger.info('=======================================');
		this.logger.info(`MCP SERVER: ${config.command} ${this.resolvedArgs.join(' ')}`);
		if (config.env) {
			this.logger.info('Environment:');
			Object.entries(config.env).forEach(([key, _]) => {
				this.logger.info(`  ${key}= [value hidden]`);
			});
		}
		this.logger.info('=======================================\n');

		const serverName = this.serverAlias
			? `"${this.serverAlias}" (${config.command} ${this.resolvedArgs.join(' ')})`
			: `${config.command} ${this.resolvedArgs.join(' ')}`;
		this.logger.info(`Connecting to MCP server: ${serverName}`);

		// Create a properly expanded environment by combining process.env with the provided env
		const expandedEnv = {
			...process.env,
			...(config.env || {}),
		};

		// Create transport for stdio connection with expanded environment
		this.transport = new StdioClientTransport({
			command: this.serverCommand,
			args: this.resolvedArgs,
			env: expandedEnv as Record<string, string>,
		});

		this.client = new Client(
			{
				name: 'cipher-stdio-mcp-client',
				version: '1.0.0',
			},
			{
				capabilities: { tools: {} },
			}
		);

		try {
			this.logger.info('Establishing connection...');
			await this.client.connect(this.transport);

			// If connection is successful, we know the server was spawned
			this.serverSpawned = true;
			this.logger.info(`✅ Stdio SERVER ${serverName} SPAWNED`);
			this.logger.info('Connection established!\n\n');
			this.isConnected = true;

			return this.client;
		} catch (error: any) {
			this.logger.error(`Failed to connect to MCP server ${serverName}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Connect to an MCP server via SSE
	 *
	 * @param config SSE server configuration
	 * @param serverName Server name for logging
	 * @returns Connected client
	 */
	private async connectViaSSE(config: SseServerConfig, serverName: string): Promise<Client> {
		this.logger.debug(`Connecting to SSE MCP server at url: ${config.url}`);

		this.transport = new SSEClientTransport(new URL(config.url), {
			requestInit: {
				headers: config.headers || {},
			},
		});

		this.client = new Client(
			{
				name: 'cipher-sse-mcp-client',
				version: '1.0.0',
			},
			{
				capabilities: { tools: {} },
			}
		);

		try {
			this.logger.info('Establishing connection...');
			await this.client.connect(this.transport);

			this.serverSpawned = true;
			this.logger.info(`✅ ${serverName} SSE SERVER CONNECTED`);
			this.logger.info('Connection established!\n\n');
			this.isConnected = true;

			return this.client;
		} catch (error: any) {
			this.logger.error(`Failed to connect to SSE MCP server ${config.url}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Connect to an MCP server via HTTP
	 *
	 * @param config HTTP server configuration
	 * @param serverAlias Server alias for logging
	 * @returns Connected client
	 */
	private async connectViaHttp(config: HttpServerConfig, serverAlias: string): Promise<Client> {
		this.logger.info(`Connecting to HTTP MCP server at ${config.url}`);

		this.transport = new StreamableHTTPClientTransport(new URL(config.url), {
			requestInit: { headers: config.headers || {} },
		});

		this.client = new Client(
			{ name: 'cipher-http-mcp-client', version: '1.0.0' },
			{ capabilities: { tools: {} } }
		);

		try {
			this.logger.info('Establishing HTTP connection...');
			await this.client.connect(this.transport);
			this.isConnected = true;
			this.logger.info(`✅ HTTP SERVER ${serverAlias} CONNECTED`);
			return this.client;
		} catch (error: any) {
			this.logger.error(`Failed to connect to HTTP MCP server ${config.url}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Disconnect from the MCP server
	 */
	async disconnect(): Promise<void> {
		if (this.transport && typeof this.transport.close === 'function') {
			try {
				await this.transport.close();
				this.isConnected = false;
				this.serverSpawned = false;
				this.logger.info('Disconnected from MCP server');
			} catch (error: any) {
				this.logger.error(`Error disconnecting from MCP server: ${error.message}`);
			}
		}
	}

	/**
	 * Call a tool with given name and arguments
	 *
	 * @param name Tool name
	 * @param args Tool arguments
	 * @returns Tool execution result
	 */
	async callTool(name: string, args: any): Promise<any> {
		try {
			this.logger.debug(`Calling tool '${name}' with args: ${JSON.stringify(args)}`);

			// Parse args if it's a string (handle JSON strings)
			let toolArgs = args;
			if (typeof args === 'string') {
				try {
					toolArgs = JSON.parse(args);
				} catch {
					// If it's not valid JSON, keep as string
					toolArgs = { input: args };
				}
			}

			// Call the tool with properly formatted arguments
			this.logger.debug(`Using timeout: ${this.timeout}`);

			const result = await this.client!.callTool(
				{ name, arguments: toolArgs },
				undefined, // resultSchema (optional)
				{ timeout: this.timeout } // Use server-specific timeout
			);

			this.logger.debug(`Tool '${name}' result: ${JSON.stringify(result)}`);

			// Check for null or undefined result
			if (result === null || result === undefined) {
				return 'Tool executed successfully with no result data.';
			}

			return result;
		} catch (error) {
			this.logger.error(`Tool call '${name}' failed: ${JSON.stringify(error)}`);
			throw error;
		}
	}

	/**
	 * Get the list of tools provided by this client
	 *
	 * @returns Available tools
	 */
	async getTools(): Promise<ToolSet> {
		const tools: ToolSet = {};
		try {
			const listToolResult = await this.client!.listTools({});
			this.logger.debug(`listTools result: ${JSON.stringify(listToolResult)}`);

			// Populate tools
			if (listToolResult && listToolResult.tools) {
				listToolResult.tools.forEach((tool: any) => {
					if (!tool.description) {
						this.logger.warning(`Tool '${tool.name}' is missing a description`);
					}
					if (!tool.inputSchema) {
						throw new Error(`Tool '${tool.name}' is missing an input schema`);
					}
					tools[tool.name] = {
						description: tool.description ?? '',
						parameters: tool.inputSchema,
					};
				});
			} else {
				throw new Error('listTools did not return the expected structure: missing tools');
			}
		} catch (error) {
			this.logger.warning(`Failed to get tools from MCP server, proceeding with zero tools`);
			return tools;
		}
		return tools;
	}

	/**
	 * Get the list of prompts provided by this client
	 *
	 * @returns Available prompt names
	 */
	async listPrompts(): Promise<string[]> {
		this.ensureConnected();
		try {
			const response = await this.client!.listPrompts();
			this.logger.debug(`listPrompts response: ${JSON.stringify(response)}`);
			return response.prompts.map((p: any) => p.name);
		} catch (error) {
			this.logger.debug(`Failed to list prompts from MCP server (optional feature), skipping`);
			return [];
		}
	}

	/**
	 * Get a specific prompt definition
	 *
	 * @param name Name of the prompt
	 * @param args Arguments for the prompt (optional)
	 * @returns Prompt definition
	 */
	async getPrompt(name: string, args?: any): Promise<GetPromptResult> {
		this.ensureConnected();
		try {
			this.logger.debug(`Getting prompt '${name}' with args: ${JSON.stringify(args)}`);

			// Pass params first, then options
			const response = await this.client!.getPrompt(
				{ name, arguments: args },
				{ timeout: this.timeout }
			);

			this.logger.debug(`getPrompt '${name}' response: ${JSON.stringify(response)}`);
			return response; // Return the full response object
		} catch (error: any) {
			this.logger.error(`Failed to get prompt '${name}' from MCP server: ${error.message}`);
			throw new Error(`Error getting prompt '${name}': ${error.message}`);
		}
	}

	/**
	 * Get the list of resources provided by this client
	 *
	 * @returns Available resource URIs
	 */
	async listResources(): Promise<string[]> {
		this.ensureConnected();
		try {
			const response = await this.client!.listResources();
			this.logger.debug(`listResources response: ${JSON.stringify(response)}`);
			return response.resources.map((r: any) => r.uri);
		} catch (error) {
			this.logger.debug(`Failed to list resources from MCP server (optional feature), skipping`);
			return [];
		}
	}

	/**
	 * Read the content of a specific resource
	 *
	 * @param uri URI of the resource
	 * @returns Content of the resource
	 */
	async readResource(uri: string): Promise<ReadResourceResult> {
		this.ensureConnected();
		try {
			this.logger.debug(`Reading resource '${uri}'`);

			// Pass params first, then options
			const response = await this.client!.readResource({ uri }, { timeout: this.timeout });
			this.logger.debug(`readResource '${uri}' response: ${JSON.stringify(response)}`);
			return response; // Return the full response object
		} catch (error: any) {
			this.logger.error(`Failed to read resource '${uri}' from MCP server: ${error.message}`);
			throw new Error(`Error reading resource '${uri}': ${error.message}`);
		}
	}

	/**
	 * Check if the client is connected
	 *
	 * @returns Connection status
	 */
	getConnectionStatus(): boolean {
		return this.isConnected;
	}

	/**
	 * Get the connected client
	 *
	 * @returns MCP client instance
	 */
	getConnectedClient(): Promise<Client> {
		if (!this.client || !this.isConnected) {
			throw new Error('MCP client is not connected.');
		}
		return Promise.resolve(this.client);
	}

	/**
	 * Get server status information
	 *
	 * @returns Server information
	 */
	getServerInfo(): {
		spawned: boolean;
		pid: number | null;
		command: string | null;
		originalArgs: string[] | null;
		resolvedArgs: string[] | null;
		env: Record<string, string> | null;
		alias: string | null;
	} {
		return {
			spawned: this.serverSpawned,
			pid: this.serverPid,
			command: this.serverCommand,
			originalArgs: this.originalArgs,
			resolvedArgs: this.resolvedArgs,
			env: this.serverEnv,
			alias: this.serverAlias,
		};
	}

	/**
	 * Ensure the client is connected before performing operations
	 */
	private ensureConnected(): void {
		if (!this.isConnected || !this.client) {
			throw new Error('Client not connected. Please call connect() first.');
		}
	}
}
