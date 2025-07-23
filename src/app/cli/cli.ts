import { MemAgent, logger } from '@core/index.js';
import * as readline from 'readline';
import chalk from 'chalk';
import { executeCommand } from './commands.js';
import { commandParser } from './parser.js';
import type { AggregatorConfig } from '@core/mcp/types.js';

// Constants
const COMPRESSION_CHECK_DELAY = 100;
const META_COMMAND_PREFIX = '!meta ';

// State tracking for compression display
let lastCompressionHistoryLength = 0;

// Public API
export async function startHeadlessCli(agent: MemAgent, input: string): Promise<void> {
	await initializeCli(agent);
	await showCompressionStartup(agent);
	await processHeadlessInput(agent, input);
}

export async function startInteractiveCli(agent: MemAgent): Promise<void> {
	await initializeCli(agent);
	await initializeSessionAndCompression(agent);
	await startInteractiveLoop(agent);
}

export async function startMcpMode(agent: MemAgent): Promise<void> {
	validateAgent(agent);

	const mcpServerMode = process.env.MCP_SERVER_MODE || 'default';

	try {
		switch (mcpServerMode) {
			case 'aggregator':
				await startAggregatorMode(agent);
				break;
			case 'default':
			default:
				await startDefaultMcpMode(agent);
				break;
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`[MCP Mode] Failed to start MCP server (mode: ${mcpServerMode}): ${errorMessage}`);
		process.exit(1);
	}
}

export function parseMetaString(metaStr: string): Record<string, any> {
	const metadata: Record<string, any> = {};

	if (!metaStr) {
		return metadata;
	}

	const pairs = metaStr.split(',');

	for (const pair of pairs) {
		const [key, value] = pair.split('=');

		if (!key || value === undefined || value === '') {
			throw new Error('Invalid metadata pair');
		}

		metadata[key.trim()] = value.trim();
	}

	return metadata;
}

// Headless CLI Implementation
async function processHeadlessInput(agent: MemAgent, input: string): Promise<void> {
	if (input.trim().startsWith(META_COMMAND_PREFIX)) {
		await handleMetadataCommand(agent, input);
	} else {
		await handleRegularCommand(agent, input);
	}
}

async function handleMetadataCommand(agent: MemAgent, input: string): Promise<void> {
	const { metadata, message } = parseMetadataInput(input);

	if (!metadata) {
		console.log(chalk.red('❌ Invalid metadata format. Use key=value,key2=value2 ...'));
		return;
	}

	console.log(chalk.gray('🤔 Processing (with metadata)...'));

	const result = await agent.run(message, undefined, undefined, false, {
		memoryMetadata: metadata,
	});

	await displayResult(result);
	await showCompressionInfo(agent);
	await waitForBackgroundOperations(result);
}

async function handleRegularCommand(agent: MemAgent, input: string): Promise<void> {
	console.log(chalk.gray('🤔 Processing...'));

	const result = await agent.run(input);

	await displayResult(result);
	await showCompressionInfo(agent);
	await waitForBackgroundOperations(result);
}

// Interactive CLI Implementation
async function initializeSessionAndCompression(agent: MemAgent): Promise<void> {
	const session = await agent.getSession(agent.getCurrentSessionId());

	if (session && typeof session.init === 'function') {
		await session.init();
	}

	await showCompressionStartup(agent);
	await new Promise(res => process.stderr.write('', res));
}

async function startInteractiveLoop(agent: MemAgent): Promise<void> {
	const rl = createReadlineInterface();
	setupGracefulShutdown(rl);

	setTimeout(() => displayWelcomeMessage(rl), 0);

	rl.on('line', async (input: string) => {
		await handleInteractiveInput(agent, rl, input);
	});

	rl.on('close', () => {
		console.log(chalk.yellow('\n👋 Session ended. Your conversation has been saved to memory.'));
		process.exit(0);
	});
}

function createReadlineInterface(): readline.Interface {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: chalk.blue('cipher> '),
	});
}

function setupGracefulShutdown(rl: readline.Interface): void {
	const handleExit = () => {
		console.log(chalk.yellow('\n👋 Goodbye! Your conversation has been saved to memory.'));
		rl.close();
		process.exit(0);
	};

	rl.on('SIGINT', handleExit);
	rl.on('SIGTERM', handleExit);
}

function displayWelcomeMessage(rl: readline.Interface): void {
	console.log(chalk.cyan('🚀 Welcome to Cipher Interactive CLI!'));
	console.log(chalk.gray('Your memory-powered coding assistant is ready.'));
	console.log(chalk.gray('• Type /help to see available commands'));
	console.log(chalk.gray('• Use /exit or /quit to end the session'));
	console.log(chalk.gray('• Regular messages will be sent to the AI agent\n'));
	rl.prompt();
}

async function handleInteractiveInput(
	agent: MemAgent,
	rl: readline.Interface,
	input: string
): Promise<void> {
	const trimmedInput = input.trim();

	if (!trimmedInput) {
		rl.prompt();
		return;
	}

	try {
		if (trimmedInput.startsWith(META_COMMAND_PREFIX)) {
			await handleInteractiveMetadataCommand(agent, rl, trimmedInput);
		} else {
			await handleInteractiveRegularInput(agent, rl, trimmedInput);
		}
	} catch (error) {
		logger.error(
			`Error processing input: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	rl.prompt();
}

async function handleInteractiveMetadataCommand(
	agent: MemAgent,
	rl: readline.Interface,
	input: string
): Promise<void> {
	const { metadata, message } = parseMetadataInput(input);

	if (!metadata) {
		console.log(chalk.red('❌ Invalid metadata format. Use key=value,key2=value2 ...'));
		rl.prompt();
		return;
	}

	console.log(chalk.gray('🤔 Thinking (with metadata)...'));

	const result = await agent.run(message, undefined, undefined, false, {
		memoryMetadata: metadata,
	});

	await displayResult(result);
	await showCompressionInfo(agent);
	handleBackgroundOperationsAsync(result, rl);
}

async function handleInteractiveRegularInput(
	agent: MemAgent,
	rl: readline.Interface,
	input: string
): Promise<void> {
	const parsedInput = commandParser.parseInput(input);

	if (parsedInput.isCommand) {
		await handleSlashCommand(parsedInput, agent);
	} else {
		await handleUserPrompt(agent, rl, input);
	}
}

async function handleSlashCommand(parsedInput: any, agent: MemAgent): Promise<void> {
	if (parsedInput.command && parsedInput.args !== undefined) {
		const commandSuccess = await executeCommand(parsedInput.command, parsedInput.args, agent);

		if (!commandSuccess) {
			console.log(chalk.gray('Command execution failed or was cancelled.'));
		}
	} else {
		console.log(chalk.red('❌ Invalid command format'));
		commandParser.displayHelp();
	}
}

async function handleUserPrompt(
	agent: MemAgent,
	rl: readline.Interface,
	input: string
): Promise<void> {
	console.log(chalk.gray('🤔 Thinking...'));

	const result = await agent.run(input);

	if (result && result.backgroundOperations) {
		try {
			await result.backgroundOperations;
		} catch {
			// Error already logged, skip
		}
	}

	await displayResult(result);
	await showCompressionInfo(agent);
	rl.prompt();

	handleBackgroundOperationsAsync(result, rl);
}

// MCP Mode Implementation
async function startDefaultMcpMode(agent: MemAgent): Promise<void> {
	const { createMcpTransport, initializeMcpServer, initializeAgentCardResource } = await import(
		'../mcp/mcp_handler.js'
	);

	const agentCardData = prepareAgentCardData(agent);

	logger.info('[MCP Mode] Creating stdio transport for default MCP server');
	const mcpTransport = await createMcpTransport('stdio');

	logger.info('[MCP Mode] Initializing default MCP server with agent capabilities');
	const server = await initializeMcpServer(agent, agentCardData, 'default');
	await server.connect(mcpTransport.server);

	logger.info('[MCP Mode] Cipher agent is now running as default MCP server');
	process.stdin.resume();
}

async function startAggregatorMode(agent: MemAgent): Promise<void> {
	const { createMcpTransport, initializeMcpServer, initializeAgentCardResource } = await import(
		'../mcp/mcp_handler.js'
	);

	const aggregatorConfig = await loadAggregatorConfig();
	const agentCardData = prepareAgentCardData(agent);

	logger.info('[MCP Mode] Creating stdio transport for aggregator MCP server');
	const mcpTransport = await createMcpTransport('stdio');

	logger.info('[MCP Mode] Initializing aggregator MCP server with agent capabilities');
	const server = await initializeMcpServer(agent, agentCardData, 'aggregator', aggregatorConfig);
	await server.connect(mcpTransport.server);

	logger.info('[MCP Mode] Cipher is now running as aggregator MCP server');
	process.stdin.resume();
}

function prepareAgentCardData(agent: MemAgent): any {
	const config = agent.getEffectiveConfig();

	return config.agentCard
		? Object.fromEntries(
				Object.entries(config.agentCard).filter(([, value]) => value !== undefined)
			)
		: {};
}

async function loadAggregatorConfig(): Promise<AggregatorConfig> {
	const defaultConfig: AggregatorConfig = {
		type: 'aggregator',
		servers: {},
		conflictResolution: (process.env.AGGREGATOR_CONFLICT_RESOLUTION as any) || 'prefix',
		autoDiscovery: false,
		timeout: parseInt(process.env.AGGREGATOR_TIMEOUT || '60000'),
		connectionMode: 'lenient',
	};

	logger.info('[MCP Aggregator] Using simplified configuration with env vars', {
		conflictResolution: defaultConfig.conflictResolution,
		timeout: defaultConfig.timeout,
	});

	return defaultConfig;
}

// Compression Display Functions
async function showCompressionStartup(agent: MemAgent): Promise<void> {
	try {
		const session = await agent.getSession(agent.getCurrentSessionId());

		if (!session) {
			return;
		}

		const ctx = session.getContextManager();
		const stats = ctx.getTokenStats();

		if (stats.maxTokens > 0) {
			console.log(chalk.green('🧠 Token-Aware Compression System is ACTIVE'));
			console.log(
				chalk.gray(
					`• Max tokens: ${stats.maxTokens}, Compression strategy: ${ctx['compressionStrategy']?.name || 'unknown'}`
				)
			);

			lastCompressionHistoryLength = ctx['compressionHistory']?.length || 0;
		}
	} catch {
		// Intentionally empty - compression info is optional
	}
}

async function showCompressionInfo(agent: MemAgent): Promise<void> {
	try {
		const session = await agent.getSession(agent.getCurrentSessionId());

		if (!session) {
			return;
		}

		const ctx = session.getContextManager();
		const history = ctx['compressionHistory'];

		if (Array.isArray(history) && history.length > lastCompressionHistoryLength) {
			const event = history[history.length - 1];
			displayCompressionEvent(event);
			lastCompressionHistoryLength = history.length;
		}
	} catch {
		// Intentionally empty - compression info is optional
	}
}

function displayCompressionEvent(event: any): void {
	console.log(
		chalk.yellowBright('⚡ Context compressed:') +
			chalk.gray(` [${event?.strategy ?? ''}] `) +
			chalk.white(
				`Tokens: ${event?.originalTokenCount ?? '?'} → ${event?.compressedTokenCount ?? '?'} `
			) +
			chalk.gray(
				`(${event?.compressionRatio !== undefined ? Math.round(event.compressionRatio * 100) : '?'}%) `
			) +
			chalk.gray(`Messages removed: ${event?.removedMessages?.length ?? '?'} `)
	);
}

// Utility Functions
async function initializeCli(agent: MemAgent): Promise<void> {
	logger.info('Initializing CLI interface...');
	validateAgent(agent);
	logger.info('CLI interface ready');
}

function validateAgent(agent: MemAgent): void {
	if (!agent) {
		throw new Error('Agent is not initialized');
	}
}

function parseMetadataInput(input: string): {
	metadata: Record<string, any> | null;
	message: string;
} {
	const metaAndMessage = input.trim().substring(META_COMMAND_PREFIX.length).split(' ');
	const metaStr = metaAndMessage[0];
	const message = metaAndMessage.slice(1).join(' ');

	let metadata: Record<string, any> | null = null;

	try {
		if (metaStr) {
			metadata = parseMetaString(metaStr);
		}
	} catch {
		metadata = null;
	}

	return { metadata, message };
}

async function displayResult(result: any): Promise<void> {
	if (result && result.response) {
		logger.displayAIResponse(result.response);
	} else {
		console.log(chalk.gray('No response received.'));
	}
}

async function waitForBackgroundOperations(result: any): Promise<void> {
	if (result && result.backgroundOperations) {
		try {
			await result.backgroundOperations;
		} catch {
			// Background operations failures are already logged, don't show to user
		}
	}
}

function handleBackgroundOperationsAsync(result: any, rl: readline.Interface): void {
	if (result && result.backgroundOperations) {
		result.backgroundOperations
			.catch(() => {
				// Background operations failures are already logged, don't show to user
			})
			.finally(() => {
				// Small delay to ensure any error logs are fully written before redisplaying prompt
				setTimeout(() => {
					rl.prompt();
				}, COMPRESSION_CHECK_DELAY);
			});
	}
}
