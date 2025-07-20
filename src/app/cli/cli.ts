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

	if (input.trim().startsWith('!meta ')) {
		const metaAndMessage = input.trim().substring(6).split(' ');
		const metaStr = metaAndMessage[0];
		const message = metaAndMessage.slice(1).join(' ');
		let metadata: Record<string, any> = {};
		try {
			// Add null check for metaStr before passing to parseMetaString
			if (metaStr) {
				metadata = parseMetaString(metaStr);
			}
		} catch {
			console.log(chalk.red('❌ Invalid metadata format. Use key=value,key2=value2 ...'));
			return;
		}
		console.log(chalk.gray('🤔 Processing (with metadata)...'));
		const result = await agent.run(message, undefined, undefined, false, {
			memoryMetadata: metadata,
		});
		if (result && result.response) {
			logger.displayAIResponse(result.response);
		} else {
			console.log(chalk.gray('No response received.'));
		}

		// Wait for background operations to complete before exiting
		if (result && result.backgroundOperations) {
			try {
				await result.backgroundOperations;
			} catch {
				// Background operations failures are already logged, don't show to user
			}
		}
	} else {
		console.log(chalk.gray('🤔 Processing...'));
		const result = await agent.run(input);
		if (result && result.response) {
			logger.displayAIResponse(result.response);
		} else {
			console.log(chalk.gray('No response received.'));
		}

		// Wait for background operations to complete before exiting
		if (result && result.backgroundOperations) {
			try {
				await result.backgroundOperations;
			} catch {
				// Background operations failures are already logged, don't show to user
			}
		}
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
			if (trimmedInput.startsWith('!meta ')) {
				// Parse metadata command: !meta key=value,key2=value2 message
				const metaAndMessage = trimmedInput.substring(6).split(' ');
				const metaStr = metaAndMessage[0];
				const message = metaAndMessage.slice(1).join(' ');
				let metadata: Record<string, any> = {};
				try {
					// Add null check for metaStr before passing to parseMetaString
					if (metaStr) {
						metadata = parseMetaString(metaStr);
					}
				} catch {
					console.log(chalk.red('❌ Invalid metadata format. Use key=value,key2=value2 ...'));
					rl.prompt();
					return;
				}
				console.log(chalk.gray('🤔 Thinking (with metadata)...'));
				const result = await agent.run(message, undefined, undefined, false, {
					memoryMetadata: metadata,
				});
				if (result && result.response) {
					logger.displayAIResponse(result.response);
				} else {
					console.log(chalk.gray('No response received.'));
				}

				// Let background operations run in the background without blocking the UI
				if (result && result.backgroundOperations) {
					result.backgroundOperations
						.catch(() => {
							// Background operations failures are already logged, don't show to user
						})
						.finally(() => {
							// Small delay to ensure any error logs are fully written before redisplaying prompt
							setTimeout(() => {
								rl.prompt();
							}, 100);
						});
				}
			} else {
				const parsedInput = commandParser.parseInput(trimmedInput);

				if (parsedInput.isCommand) {
					// Handle slash command
					if (parsedInput.command && parsedInput.args !== undefined) {
						const commandSuccess = await executeCommand(
							parsedInput.command,
							parsedInput.args,
							agent
						);

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
					const result = await agent.run(trimmedInput);

					if (result && result.response) {
						// Display the AI response with nice formatting
						logger.displayAIResponse(result.response);
					} else {
						console.log(chalk.gray('No response received.'));
					}

					// Let background operations run in the background without blocking the UI
					if (result && result.backgroundOperations) {
						result.backgroundOperations
							.catch(() => {
								// Background operations failures are already logged, don't show to user
							})
							.finally(() => {
								// Small delay to ensure any error logs are fully written before redisplaying prompt
								setTimeout(() => {
									rl.prompt();
								}, 100);
							});
					}
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

// Add utility for parsing metadata from CLI
export function parseMetaString(metaStr: string): Record<string, any> {
	const metadata: Record<string, any> = {};
	if (!metaStr) return metadata;
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
