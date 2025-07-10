import { MemAgent, logger } from '@core/index.js';
import * as readline from 'readline';
import chalk from 'chalk';
import { executeCommand } from './commands.js';
import { commandParser } from './parser.js';

/**
 * Start headless CLI mode for one-shot command execution
 * @param agent - The MemAgent instance
 * @param input - The user input/prompt to execute
 */
export async function startHeadlessCli(agent: MemAgent, input: string): Promise<void> {
	await _initCli(agent);
	
	console.log(chalk.gray('🤔 Processing...'));
	const response = await agent.run(input);
	
	if (response) {
		// Display the AI response with nice formatting
		logger.displayAIResponse(response);
	} else {
		console.log(chalk.gray('No response received.'));
	}
}

/**
 * Start interactive CLI mode where user can continuously chat with the agent
 */
export async function startInteractiveCli(agent: MemAgent): Promise<void> {
	// Common initialization
	await _initCli(agent);

	console.log(chalk.cyan('🚀 Welcome to Cipher Interactive CLI!'));
	console.log(chalk.gray('Your memory-powered coding assistant is ready.'));
	console.log(chalk.gray('• Type /help to see available commands'));
	console.log(chalk.gray('• Use /exit or /quit to end the session'));
	console.log(chalk.gray('• Regular messages will be sent to the AI agent\n'));

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: chalk.blue('cipher> '),
	});

	// Set up graceful shutdown
	const handleExit = () => {
		console.log(chalk.yellow('\n👋 Goodbye! Your conversation has been saved to memory.'));
		rl.close();
		process.exit(0);
	};

	rl.on('SIGINT', handleExit);
	rl.on('SIGTERM', handleExit);

	rl.prompt();

	rl.on('line', async (input: string) => {
		const trimmedInput = input.trim();

		// Skip empty inputs
		if (!trimmedInput) {
			rl.prompt();
			return;
		}

		try {
			// Parse input to determine if it's a command or regular prompt
			const parsedInput = commandParser.parseInput(trimmedInput);

			if (parsedInput.isCommand) {
				// Handle slash command
				if (parsedInput.command && parsedInput.args !== undefined) {
					const commandSuccess = await executeCommand(parsedInput.command, parsedInput.args, agent);

					if (!commandSuccess) {
						console.log(chalk.gray('Command execution failed or was cancelled.'));
					}
				} else {
					console.log(chalk.red('❌ Invalid command format'));
					commandParser.displayHelp();
				}
			} else {
				// Handle regular user prompt - pass to agent
				console.log(chalk.gray('🤔 Thinking...'));
				const response = await agent.run(trimmedInput);

				if (response) {
					// Display the AI response with nice formatting
					logger.displayAIResponse(response);
				} else {
					console.log(chalk.gray('No response received.'));
				}
			}
		} catch (error) {
			logger.error(
				`Error processing input: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		rl.prompt();
	});

	rl.on('close', () => {
		console.log(chalk.yellow('\n👋 Session ended. Your conversation has been saved to memory.'));
		process.exit(0);
	});
}

/**
 * Start MCP server mode for Model Context Protocol integration
 */
export async function startMcpMode(agent: MemAgent): Promise<void> {
	await _initCli(agent);

	console.log(chalk.cyan('🔗 Starting Cipher in MCP Server Mode...'));
	console.log(chalk.gray('Ready to accept MCP client connections.'));

	try {
		// Import MCP handler functions
		const { createMcpTransport, initializeMcpServer, initializeAgentCardResource } = await import('../mcp/mcp_handler.js');

		// Get agent configuration for agent card
		const config = agent.getEffectiveConfig();
		const agentCardData = initializeAgentCardResource(config.agentCard || {});

		// Create stdio transport (primary transport for MCP mode)
		logger.info('[MCP Mode] Creating stdio transport for MCP server');
		const mcpTransport = await createMcpTransport('stdio');

		// Initialize MCP server with agent capabilities
		logger.info('[MCP Mode] Initializing MCP server with agent capabilities');
		await initializeMcpServer(agent, agentCardData, mcpTransport);

		// Server is now running - the initializeMcpServer function keeps process alive
		logger.info('[MCP Mode] Cipher agent is now running as MCP server');
		console.log(chalk.green('✅ MCP server initialized successfully!'));
		console.log(chalk.gray('🔧 Available tools: ask_cipher'));
		console.log(chalk.gray('📊 Available resources: cipher://agent/card, cipher://agent/stats'));
		console.log(chalk.gray('📝 Available prompts: system_prompt'));
		console.log(chalk.gray('💡 Connect MCP clients to interact with the Cipher agent'));
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`[MCP Mode] Failed to start MCP server: ${errorMessage}`);
		console.log(chalk.red(`❌ Failed to start MCP server: ${errorMessage}`));
		process.exit(1);
	}
}

/**
 * Common CLI initialization logic
 */
async function _initCli(agent: MemAgent): Promise<void> {
	logger.info('Initializing CLI interface...');

	// Ensure agent is started
	if (!agent) {
		throw new Error('Agent is not initialized');
	}

	logger.info('CLI interface ready');
}
