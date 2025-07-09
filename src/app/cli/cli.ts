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

	// TODO: Implement MCP server functionality
	// This would start an MCP server that other tools can connect to
	logger.info('MCP mode is not yet fully implemented');
	logger.info('This would start a server that accepts MCP client connections');

	// Keep the process alive
	process.stdin.resume();
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
