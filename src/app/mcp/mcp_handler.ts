import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MemAgent } from '@core/brain/memAgent/agent.js';
import { logger } from '@core/logger/index.js';
import { AgentCardSchema } from '@core/brain/memAgent/config.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// Derive the AgentCard type from the schema
export type AgentCard = z.infer<typeof AgentCardSchema>;

/**
 * Initialize MCP server with agent capabilities
 * @param agent - The MemAgent instance to expose
 * @param agentCard - Agent metadata/card information
 */
export async function initializeMcpServer(
	agent: MemAgent,
	agentCard: AgentCard
): Promise<Server> {
	logger.info('[MCP Handler] Initializing MCP server with agent capabilities');

	// Create MCP server instance
	const server = new Server(
		{
			name: agentCard.name || 'cipher',
			version: agentCard.version || '1.0.0',
		},
		{
			capabilities: {
				tools: {},
				resources: {},
				prompts: {},
			},
		}
	);

	// Register agent capabilities as MCP tools, resources, and prompts
	await registerAgentTools(server, agent);
	await registerAgentResources(server, agent, agentCard);
	await registerAgentPrompts(server, agent);

	logger.info('[MCP Handler] MCP server initialized successfully');
	logger.info('[MCP Handler] Agent is now available as MCP server for external clients');

	return server;
}

/**
 * Register agent tools as MCP tools (dynamic discovery)
 */
async function registerAgentTools(server: Server, agent: MemAgent): Promise<void> {
	logger.debug('[MCP Handler] Registering agent tools (dynamic)');

	// Get all agent-accessible tools from unifiedToolManager
	const unifiedToolManager = agent.unifiedToolManager;
	const combinedTools = await unifiedToolManager.getAllTools();

	// Build MCP tool list
	const mcpTools = Object.entries(combinedTools).map(([toolName, tool]) => ({
		name: toolName,
		description: (tool as any).description,
		inputSchema: (tool as any).parameters,
	}));

	// For backward compatibility, ensure ask_cipher is always present
	if (!mcpTools.find(t => t.name === 'ask_cipher')) {
		mcpTools.push({
			name: 'ask_cipher',
			description: 'Chat with the Cipher AI agent. Send a message to interact with the agent.',
			inputSchema: {
				type: 'object',
				properties: {
					message: {
						type: 'string',
						description: 'The message or question to send to the Cipher agent',
					},
					session_id: {
						type: 'string',
						description: 'Optional session ID to maintain conversation context',
						default: 'default',
					},
					stream: {
						type: 'boolean',
						description: 'Whether to stream the response (not supported via MCP)',
						default: false,
					},
				},
				required: ['message'],
			},
		});
	}

	logger.info(
		`[MCP Handler] Registering ${mcpTools.length} MCP tools: ${mcpTools.map(t => t.name).join(', ')}`
	);

	// Register list tools handler
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return { tools: mcpTools };
	});

	// Register call tool handler
	server.setRequestHandler(CallToolRequestSchema, async request => {
		const { name, arguments: args } = request.params;
		logger.info(`[MCP Handler] Tool called: ${name}`, { toolName: name, args });

		if (name === 'ask_cipher') {
			return await handleAskCipherTool(agent, args);
		}

		// Route to unifiedToolManager for all other tools
		try {
			const result = await unifiedToolManager.executeTool(name, args);
			return {
				content: [
					{
						type: 'text',
						text: typeof result === 'string' ? result : JSON.stringify(result),
					},
				],
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`[MCP Handler] Error in tool '${name}'`, { error: errorMessage });
			throw new Error(`Tool execution failed: ${errorMessage}`);
		}
	});
}

/**
 * Handle the ask_cipher tool execution
 */
async function handleAskCipherTool(agent: MemAgent, args: any): Promise<any> {
	const { message, session_id = 'default', stream = false } = args;

	if (!message || typeof message !== 'string') {
		throw new Error('Message parameter is required and must be a string');
	}

	logger.info('[MCP Handler] Processing ask_cipher request', {
		sessionId: session_id,
		messageLength: message.length,
	});

	try {
		// Run the agent with the provided message and session
		const { response, backgroundOperations } = await agent.run(
			message,
			undefined,
			session_id,
			stream
		);
		// In MCP mode, always wait for background operations to complete before returning response
		await backgroundOperations;

		return {
			content: [
				{
					type: 'text',
					text: response || 'No response generated',
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error('[MCP Handler] Error in ask_cipher tool', { error: errorMessage });

		throw new Error(`Agent execution failed: ${errorMessage}`);
	}
}

/**
 * Register agent resources as MCP resources
 */
async function registerAgentResources(
	server: Server,
	agent: MemAgent,
	agentCard: AgentCard
): Promise<void> {
	logger.debug('[MCP Handler] Registering agent resources');

	// Register list resources handler
	server.setRequestHandler(ListResourcesRequestSchema, async () => {
		return {
			resources: [
				{
					uri: 'cipher://agent/card',
					name: 'Agent Card',
					description: 'Metadata and information about the Cipher agent',
					mimeType: 'application/json',
				},
				{
					uri: 'cipher://agent/stats',
					name: 'Agent Statistics',
					description: 'Runtime statistics and metrics for the Cipher agent',
					mimeType: 'application/json',
				},
			],
		};
	});

	// Register read resource handler
	server.setRequestHandler(ReadResourceRequestSchema, async request => {
		const { uri } = request.params;

		logger.info(`[MCP Handler] Resource requested: ${uri}`);

		switch (uri) {
			case 'cipher://agent/card':
				return await getAgentCardResource(agentCard);
			case 'cipher://agent/stats':
				return await getAgentStatsResource(agent);
			default:
				throw new Error(`Unknown resource: ${uri}`);
		}
	});
}

/**
 * Get agent card resource
 */
async function getAgentCardResource(agentCard: AgentCard): Promise<any> {
	return {
		contents: [
			{
				uri: 'cipher://agent/card',
				mimeType: 'application/json',
				text: JSON.stringify(agentCard, null, 2),
			},
		],
	};
}

/**
 * Get agent statistics resource
 */
async function getAgentStatsResource(agent: MemAgent): Promise<any> {
	try {
		const sessionCount = await agent.sessionManager.getSessionCount();
		const activeSessionIds = await agent.sessionManager.getActiveSessionIds();
		const mcpClients = agent.getMcpClients();
		const failedConnections = agent.getMcpFailedConnections();

		const stats = {
			sessions: {
				count: sessionCount,
				activeIds: activeSessionIds,
			},
			mcpConnections: {
				connectedClients: mcpClients.size,
				failedConnections: Object.keys(failedConnections).length,
				clientNames: Array.from(mcpClients.keys()),
				failures: failedConnections,
			},
			uptime: process.uptime(),
			memoryUsage: process.memoryUsage(),
			timestamp: new Date().toISOString(),
		};

		return {
			contents: [
				{
					uri: 'cipher://agent/stats',
					mimeType: 'application/json',
					text: JSON.stringify(stats, null, 2),
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error('[MCP Handler] Error getting agent stats', { error: errorMessage });

		const errorStats = {
			error: `Failed to retrieve stats: ${errorMessage}`,
			timestamp: new Date().toISOString(),
		};

		return {
			contents: [
				{
					uri: 'cipher://agent/stats',
					mimeType: 'application/json',
					text: JSON.stringify(errorStats, null, 2),
				},
			],
		};
	}
}

/**
 * Register agent prompts as MCP prompts
 */
async function registerAgentPrompts(server: Server, agent: MemAgent): Promise<void> {
	logger.debug('[MCP Handler] Registering agent prompts');

	// Register list prompts handler
	server.setRequestHandler(ListPromptsRequestSchema, async () => {
		return {
			prompts: [
				{
					name: 'system_prompt',
					description: 'Get the current system prompt used by the Cipher agent',
				},
			],
		};
	});

	// Register get prompt handler
	server.setRequestHandler(GetPromptRequestSchema, async request => {
		const { name } = request.params;

		logger.info(`[MCP Handler] Prompt requested: ${name}`);

		switch (name) {
			case 'system_prompt':
				return await getSystemPrompt(agent);
			default:
				throw new Error(`Unknown prompt: ${name}`);
		}
	});
}

/**
 * Get system prompt
 */
async function getSystemPrompt(agent: MemAgent): Promise<any> {
	try {
		const systemPrompt = agent.promptManager.getCompleteSystemPrompt();

		return {
			messages: [
				{
					role: 'system',
					content: {
						type: 'text',
						text: systemPrompt,
					},
				},
			],
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error('[MCP Handler] Error getting system prompt', { error: errorMessage });

		throw new Error(`Failed to get system prompt: ${errorMessage}`);
	}
}

/**
 * Initialize agent card resource data
 * @param agentCard - Agent card configuration
 * @returns Processed agent card data
 */
export function initializeAgentCardResource(agentCard: Partial<AgentCard>): AgentCard {
	logger.debug('[MCP Handler] Initializing agent card resource');

	// Ensure required fields have defaults
	const processedCard: AgentCard = {
		name: agentCard.name || 'cipher',
		description: agentCard.description || 'Cipher AI Agent - Memory-powered coding assistant',
		version: agentCard.version || '1.0.0',
		provider: agentCard.provider || {
			organization: 'byterover-inc',
			url: 'https://byterover.dev',
		},
		defaultInputModes: agentCard.defaultInputModes || ['application/json', 'text/plain'],
		defaultOutputModes: agentCard.defaultOutputModes || [
			'application/json',
			'text/event-stream',
			'text/plain',
		],
		skills: agentCard.skills || [
			{
				id: 'chat_with_agent',
				name: 'chat_with_agent',
				description: 'Allows you to chat with an AI agent. Send a message to interact.',
				tags: ['chat', 'AI', 'assistant', 'mcp', 'natural language'],
				inputModes: ['application/json', 'text/plain'],
				outputModes: ['application/json', 'text/plain'],
				examples: [
					`Send a JSON-RPC request to /mcp with method: "chat_with_agent" and params: {"message":"Your query..."}`,
					'Alternatively, use a compatible MCP client library.',
				],
			},
		],
	};

	return processedCard;
}

/**
 * Redirect logs to file when running in stdio mode to prevent interference
 */
export function redirectLogsForStdio(): void {
	// Create a log file path
	const logPath = './logs/mcp-server.log';

	// Redirect logger to file FIRST - this prevents Winston from writing to stdout/stderr
	logger.redirectToFile(logPath);

	// Then redirect console methods as backup
	// In stdio mode, we need to redirect console output to prevent interference with MCP protocol
	// The MCP protocol uses stdio for communication, so any console.log will break the protocol

	// Ensure logs directory exists
	const logDir = path.dirname(logPath);

	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir, { recursive: true });
	}

	// Redirect console output to log file
	const logStream = fs.createWriteStream(logPath, { flags: 'a' });

	// Store original console methods for potential restoration
	const originalConsole = {
		log: console.log,
		error: console.error,
		warn: console.warn,
		info: console.info,
		debug: console.debug,
		trace: console.trace,
	};

	// Override console methods to write to log file instead of stdout/stderr
	console.log = (...args: any[]) => {
		logStream.write(`[LOG] ${new Date().toISOString()} ${args.join(' ')}\n`);
	};

	console.error = (...args: any[]) => {
		logStream.write(`[ERROR] ${new Date().toISOString()} ${args.join(' ')}\n`);
	};

	console.warn = (...args: any[]) => {
		logStream.write(`[WARN] ${new Date().toISOString()} ${args.join(' ')}\n`);
	};

	console.info = (...args: any[]) => {
		logStream.write(`[INFO] ${new Date().toISOString()} ${args.join(' ')}\n`);
	};

	console.debug = (...args: any[]) => {
		logStream.write(`[DEBUG] ${new Date().toISOString()} ${args.join(' ')}\n`);
	};

	console.trace = (...args: any[]) => {
		logStream.write(`[TRACE] ${new Date().toISOString()} ${args.join(' ')}\n`);
	};

	// Also capture process stdout/stderr writes to prevent any direct writes
	const originalStdoutWrite = process.stdout.write;
	const originalStderrWrite = process.stderr.write;

	process.stdout.write = function (chunk: any, encoding?: any, callback?: any) {
		// Only allow JSON-RPC messages to stdout (they start with '{' and contain '"jsonrpc"')
		const chunkStr = chunk.toString();
		if (chunkStr.trim().startsWith('{') && chunkStr.includes('"jsonrpc"')) {
			return originalStdoutWrite.call(this, chunk, encoding, callback);
		} else {
			// Redirect non-JSON-RPC output to log file
			logStream.write(`[STDOUT] ${new Date().toISOString()} ${chunkStr}`);
			return true;
		}
	};

	process.stderr.write = function (chunk: any, encoding?: any, callback?: any) {
		// Allow stderr for MCP error reporting, but log it too
		logStream.write(`[STDERR] ${new Date().toISOString()} ${chunk.toString()}`);
		return originalStderrWrite.call(this, chunk, encoding, callback);
	};

	// Store original methods for potential restoration
	(globalThis as any).__originalConsole = originalConsole;
	(globalThis as any).__originalStdoutWrite = originalStdoutWrite;
	(globalThis as any).__originalStderrWrite = originalStderrWrite;

	// Log the redirection activation
	logStream.write(
		`[MCP-PROTECTION] ${new Date().toISOString()} Console and stdout/stderr redirection activated\n`
	);
}
