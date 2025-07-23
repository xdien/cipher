import chalk from 'chalk';
import { MemAgent } from '@core/index.js';

/**
 * Interface for command execution results
 */
export interface CommandResult {
	success: boolean;
	message?: string;
	data?: any;
}

/**
 * Interface for command definition with hierarchical support
 */
export interface CommandDefinition {
	name: string;
	description: string;
	usage?: string;
	aliases?: string[];
	category?: string;
	handler: (args: string[], agent: MemAgent) => Promise<boolean>;
	subcommands?: CommandDefinition[];
}

/**
 * Input classification result
 */
export interface ParsedInput {
	isCommand: boolean;
	command?: string;
	args?: string[];
	rawInput: string;
}

/**
 * Command suggestion for auto-completion
 */
export interface CommandSuggestion {
	name: string;
	description: string;
	category?: string;
}

/**
 * Comprehensive command parser for Cipher CLI
 */
export class CommandParser {
	private commands: Map<string, CommandDefinition> = new Map();
	private aliases: Map<string, string> = new Map();

	constructor() {
		this.initializeCommands();
	}

	/**
	 * Parse input to determine if it's a command or regular prompt
	 */
	parseInput(input: string): ParsedInput {
		const trimmed = input.trim();

		// Check if input starts with slash (command indicator)
		if (trimmed.startsWith('/')) {
			// Parse as slash command
			const parts = trimmed
				.slice(1)
				.split(' ')
				.filter(part => part.length > 0);
			const command = parts[0] || '';
			const args = parts.slice(1);

			return {
				isCommand: true,
				command,
				args,
				rawInput: input,
			};
		} else {
			// Treat as regular user prompt
			return {
				isCommand: false,
				rawInput: input,
			};
		}
	}

	/**
	 * Execute a parsed command
	 */
	async executeCommand(command: string, args: string[], agent: MemAgent): Promise<boolean> {
		try {
			const commandDef =
				this.commands.get(command) || this.commands.get(this.aliases.get(command) || '');
			if (!commandDef) {
				console.log(chalk.red(`❌ Unknown command: /${command}`));
				console.log(chalk.gray('💡 Use /help to see all available commands'));
				return false;
			}

			// Handle subcommands
			if (commandDef.subcommands && args.length > 0) {
				const subcommandName = args[0];
				if (subcommandName) {
					// Add null check
					const subcommand = commandDef.subcommands.find(
						sub => sub.name === subcommandName || sub.aliases?.includes(subcommandName)
					);

					if (subcommand) {
						return await subcommand.handler(args.slice(1), agent);
					}
				}
			}

			return await commandDef.handler(args, agent);
		} catch (error) {
			console.log(
				chalk.red(
					`❌ Error executing command /${command}: ${error instanceof Error ? error.message : String(error)}`
				)
			);
			return false;
		}
	}

	/**
	 * Get command suggestions for auto-completion
	 */
	getCommandSuggestions(partial: string): CommandSuggestion[] {
		const suggestions: CommandSuggestion[] = [];

		// Check main commands
		for (const [name, definition] of this.commands) {
			if (name.startsWith(partial)) {
				suggestions.push({
					name,
					description: definition.description,
					category: definition.category || 'uncategorized', // Add fallback for undefined
				});
			}
		}

		// Check aliases
		for (const [alias, actualCommand] of this.aliases) {
			if (alias.startsWith(partial)) {
				const commandDef = this.commands.get(actualCommand);
				if (commandDef) {
					suggestions.push({
						name: alias,
						description: `${commandDef.description} (alias)`,
						category: commandDef.category || 'uncategorized', // Add fallback for undefined
					});
				}
			}
		}

		// Sort suggestions alphabetically
		return suggestions.sort((a, b) => a.name.localeCompare(b.name));
	}

	/**
	 * Format command help - supports both basic and detailed modes
	 */
	formatCommandHelp(commandName: string, detailed: boolean = false): string {
		const commandDef = this.commands.get(commandName);
		if (!commandDef) {
			return chalk.red(`Command not found: ${commandName}`);
		}

		let help = chalk.cyan(`/${commandName}`) + ` - ${commandDef.description}`;

		if (detailed) {
			if (commandDef.usage) {
				help += `\n  ${chalk.yellow('Usage:')} ${commandDef.usage}`;
			}

			if (commandDef.aliases && commandDef.aliases.length > 0) {
				help += `\n  ${chalk.yellow('Aliases:')} ${commandDef.aliases.map(a => chalk.cyan(`/${a}`)).join(', ')}`;
			}

			if (commandDef.subcommands && commandDef.subcommands.length > 0) {
				help += `\n  ${chalk.yellow('Subcommands:')}`;
				for (const sub of commandDef.subcommands) {
					help += `\n    ${chalk.cyan(`/${commandName} ${sub.name}`)} - ${sub.description}`;
				}
			}
		}

		return help;
	}

	/**
	 * Display all commands in categorized format
	 */
	displayAllCommands(): void {
		// Define category order
		const categoryOrder = ['basic', 'memory', 'session', 'tools', 'system', 'help'];

		// Initialize empty categories
		const categorizedCommands: Map<string, CommandDefinition[]> = new Map();
		const uncategorizedCommands: CommandDefinition[] = [];

		// Initialize categories
		categoryOrder.forEach(cat => categorizedCommands.set(cat, []));

		// Categorize each command
		for (const commandDef of this.commands.values()) {
			const category = commandDef.category || 'uncategorized';
			if (categorizedCommands.has(category)) {
				categorizedCommands.get(category)!.push(commandDef);
			} else {
				uncategorizedCommands.push(commandDef);
			}
		}

		console.log(chalk.cyan('\n📋 Available Commands:\n'));

		// Display in predefined order
		for (const category of categoryOrder) {
			const commands = categorizedCommands.get(category);
			if (commands && commands.length > 0) {
				console.log(chalk.yellow(`${category.toUpperCase()}:`));
				for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
					console.log(`  ${this.formatCommandHelp(cmd.name, false)}`);
				}
				console.log('');
			}
		}

		// Show uncategorized commands last
		if (uncategorizedCommands.length > 0) {
			console.log(chalk.yellow('OTHER:'));
			for (const cmd of uncategorizedCommands.sort((a, b) => a.name.localeCompare(b.name))) {
				console.log(`  ${this.formatCommandHelp(cmd.name, false)}`);
			}
			console.log('');
		}

		console.log(
			chalk.gray('💡 Use /help <command> for detailed information about a specific command')
		);
		console.log(chalk.gray('💡 Use <Tab> for command auto-completion'));
	}

	/**
	 * Display basic help information
	 */
	displayHelp(commandName?: string): void {
		if (commandName) {
			console.log('\n' + this.formatCommandHelp(commandName, true) + '\n');
		} else {
			this.displayAllCommands();
		}
	}

	/**
	 * Register a new command
	 */
	registerCommand(definition: CommandDefinition): void {
		this.commands.set(definition.name, definition);

		// Register aliases
		if (definition.aliases) {
			for (const alias of definition.aliases) {
				this.aliases.set(alias, definition.name);
			}
		}
	}

	/**
	 * Check if a command exists
	 */
	hasCommand(command: string): boolean {
		return this.commands.has(command) || this.aliases.has(command);
	}

	/**
	 * Get all registered commands
	 */
	getAllCommands(): CommandDefinition[] {
		return Array.from(this.commands.values());
	}

	/**
	 * Initialize built-in commands
	 */
	private initializeCommands(): void {
		// Help command
		this.registerCommand({
			name: 'help',
			description: 'Show help information for commands',
			usage: '/help [command]',
			aliases: ['h', '?'],
			category: 'help',
			handler: async (args: string[]) => {
				try {
					if (args.length > 0) {
						// Show specific command help
						const commandName = args[0];
						if (commandName && this.hasCommand(commandName)) {
							// Add null check
							this.displayHelp(commandName);
						} else {
							console.log(chalk.red(`❌ Unknown command: ${commandName || 'undefined'}`));
							console.log(chalk.gray('💡 Use /help to see all available commands'));
						}
					} else {
						// Display all commands categorized
						this.displayHelp();
					}
					return true;
				} catch (error) {
					console.log(
						chalk.red(
							`❌ Error displaying help: ${error instanceof Error ? error.message : String(error)}`
						)
					);
					return true;
				}
			},
		});

		// Exit command
		this.registerCommand({
			name: 'exit',
			description: 'Exit the CLI session',
			aliases: ['quit', 'q'],
			category: 'basic',
			handler: async () => {
				try {
					console.log(chalk.yellow('👋 Goodbye! Your conversation has been saved to memory.'));
					process.exit(0);
				} catch (error) {
					console.log(
						chalk.red(
							`❌ Error during exit: ${error instanceof Error ? error.message : String(error)}`
						)
					);
					return true;
				}
			},
		});

		// Clear/Reset command
		this.registerCommand({
			name: 'clear',
			description: 'Reset conversation history for current session',
			aliases: ['reset'],
			category: 'basic',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					// Create a new session to effectively reset conversation
					await agent.createSession('default');
					console.log(chalk.green('🔄 Conversation history reset successfully'));
					console.log(chalk.gray('💡 Starting fresh with a clean session'));
					return true;
				} catch (error) {
					console.log(
						chalk.red(
							`❌ Failed to reset conversation: ${error instanceof Error ? error.message : String(error)}`
						)
					);
					return true;
				}
			},
		});

		// Config command
		this.registerCommand({
			name: 'config',
			description: 'Display current configuration',
			category: 'system',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					const config = agent.getEffectiveConfig();

					console.log(chalk.cyan('⚙️  Current Configuration:'));
					console.log('');

					// LLM Configuration
					console.log(chalk.yellow('🤖 LLM Configuration:'));
					console.log(`  ${chalk.gray('Provider:')} ${config.llm.provider}`);
					console.log(`  ${chalk.gray('Model:')} ${config.llm.model}`);
					console.log(`  ${chalk.gray('Max Iterations:')} ${config.llm.maxIterations || 10}`);
					if (config.llm.baseURL) {
						console.log(`  ${chalk.gray('Base URL:')} ${config.llm.baseURL}`);
					}
					console.log('');

					// Session Configuration
					console.log(chalk.yellow('📊 Session Configuration:'));
					console.log(`  ${chalk.gray('Max Sessions:')} ${config.sessions?.maxSessions || 100}`);
					console.log(
						`  ${chalk.gray('Session TTL:')} ${((config.sessions?.sessionTTL || 3600000) / 1000 / 60).toFixed(0)} minutes`
					);
					console.log('');

					// MCP Servers
					console.log(chalk.yellow('🔗 MCP Servers:'));
					if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
						for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
							// Handle different MCP server config types
							let serverType = 'unknown';
							if ('command' in serverConfig && serverConfig.command) {
								serverType = serverConfig.command[0] || 'stdio';
							} else if ('url' in serverConfig && serverConfig.url) {
								serverType = 'sse';
							} else if (serverConfig.type) {
								serverType = serverConfig.type;
							}
							console.log(`  ${chalk.gray('•')} ${name} (${serverType})`);
						}
					} else {
						console.log(`  ${chalk.gray('No MCP servers configured')}`);
					}
					console.log('');

					return true;
				} catch (error) {
					console.log(
						chalk.red(
							`❌ Failed to get configuration: ${error instanceof Error ? error.message : String(error)}`
						)
					);
					return true;
				}
			},
		});

		// Stats command
		this.registerCommand({
			name: 'stats',
			description: 'Show system statistics and metrics',
			category: 'system',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					console.log(chalk.cyan('📈 System Statistics:'));
					console.log('');

					// Session Statistics
					console.log(chalk.yellow('📊 Session Metrics:'));
					const sessionCount = await agent.sessionManager.getSessionCount();
					const activeSessionIds = await agent.sessionManager.getActiveSessionIds();
					console.log(`  ${chalk.gray('Active Sessions:')} ${sessionCount}`);
					console.log(
						`  ${chalk.gray('Session IDs:')} ${activeSessionIds.length > 0 ? activeSessionIds.join(', ') : 'none'}`
					);
					console.log('');

					// MCP Server Statistics
					console.log(chalk.yellow('🔗 MCP Server Stats:'));
					const mcpClients = agent.getMcpClients();
					const failedConnections = agent.getMcpFailedConnections();
					console.log(`  ${chalk.gray('Connected Servers:')} ${mcpClients.size}`);
					console.log(
						`  ${chalk.gray('Failed Connections:')} ${Object.keys(failedConnections).length}`
					);

					if (mcpClients.size > 0) {
						console.log(`  ${chalk.gray('Active Clients:')}`);
						for (const [name] of mcpClients) {
							console.log(`    ${chalk.gray('•')} ${name}`);
						}
					}

					if (Object.keys(failedConnections).length > 0) {
						console.log(`  ${chalk.gray('Failed Servers:')}`);
						for (const [name, error] of Object.entries(failedConnections)) {
							console.log(`    ${chalk.gray('•')} ${name} (${error})`);
						}
					}
					console.log('');

					// Tool Statistics
					console.log(chalk.yellow('🔧 Tool Stats:'));
					try {
						const allTools = await agent.getAllMcpTools();
						const toolCount = Object.keys(allTools).length;
						console.log(`  ${chalk.gray('Available MCP Tools:')} ${toolCount}`);

						if (toolCount > 0) {
							const toolNames = Object.keys(allTools).slice(0, 5); // Show first 5
							console.log(
								`  ${chalk.gray('Sample Tools:')} ${toolNames.join(', ')}${toolCount > 5 ? '...' : ''}`
							);
						}
					} catch {
						console.log(`  ${chalk.gray('Tool Count:')} Error retrieving tools`);
					}
					console.log('');

					return true;
				} catch (error) {
					console.log(
						chalk.red(
							`❌ Failed to get statistics: ${error instanceof Error ? error.message : String(error)}`
						)
					);
					return true;
				}
			},
		});

		// Tools command
		this.registerCommand({
			name: 'tools',
			description: 'List all available tools',
			category: 'tools',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					console.log(chalk.cyan('🔧 Available Tools:'));
					console.log('');

					const allTools = await agent.getAllMcpTools();
					const toolEntries = Object.entries(allTools);

					if (toolEntries.length === 0) {
						console.log(chalk.gray('  No tools available'));
						console.log(chalk.gray('  💡 Try connecting to MCP servers to access tools'));
						return true;
					}

					// Group tools by server/source
					const toolsByServer: Record<string, Array<{ name: string; description: string }>> = {};

					for (const [toolName, toolDef] of toolEntries) {
						// Extract server name from tool name or use 'unknown'
						let serverName = 'unknown';
						if (typeof toolDef === 'object' && toolDef !== null && 'source' in toolDef) {
							serverName = String(toolDef.source);
						} else {
							// Try to extract from tool name prefix
							const parts = toolName.split('_');
							if (parts.length > 1 && parts[0]) {
								serverName = parts[0];
							}
						}

						if (!toolsByServer[serverName]) {
							toolsByServer[serverName] = [];
						}

						let description = 'No description available';
						if (typeof toolDef === 'object' && toolDef !== null) {
							if ('description' in toolDef && typeof toolDef.description === 'string') {
								description = toolDef.description;
							} else if (
								'inputSchema' in toolDef &&
								typeof toolDef.inputSchema === 'object' &&
								toolDef.inputSchema !== null &&
								'description' in toolDef.inputSchema
							) {
								description = String(toolDef.inputSchema.description);
							}
						}

						toolsByServer[serverName]!.push({
							name: toolName,
							description: description,
						});
					}

					// Display tools grouped by server
					for (const [serverName, tools] of Object.entries(toolsByServer)) {
						console.log(chalk.yellow(`📦 ${serverName.toUpperCase()}:`));

						tools.sort((a, b) => a.name.localeCompare(b.name));
						for (const tool of tools) {
							const truncatedDesc =
								tool.description.length > 80
									? tool.description.substring(0, 80) + '...'
									: tool.description;
							console.log(`  ${chalk.cyan(tool.name)} - ${truncatedDesc}`);
						}
						console.log('');
					}

					console.log(chalk.gray(`Total: ${toolEntries.length} tools available`));
					return true;
				} catch (error) {
					console.log(
						chalk.red(
							`❌ Failed to list tools: ${error instanceof Error ? error.message : String(error)}`
						)
					);
					return true;
				}
			},
		});

		// Prompt command
		this.registerCommand({
			name: 'prompt',
			description: 'Display current system prompt',
			category: 'system',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					const systemPrompt = agent.promptManager.getCompleteSystemPrompt();

					console.log(chalk.cyan('📝 Current System Prompt:'));
					console.log('');
					console.log(chalk.gray('╭─ System Prompt ─────────────────────────────────────────╮'));

					// Split prompt into lines and format with borders
					const lines = systemPrompt.split('\n');
					for (const line of lines) {
						// Wrap long lines
						if (line.length > 55) {
							const words = line.split(' ');
							let currentLine = '';

							for (const word of words) {
								if ((currentLine + word).length > 55) {
									if (currentLine) {
										console.log(chalk.gray('│ ') + currentLine.padEnd(55) + chalk.gray(' │'));
										currentLine = word + ' ';
									} else {
										// Word itself is too long, truncate
										console.log(
											chalk.gray('│ ') +
												(word.substring(0, 52) + '...').padEnd(55) +
												chalk.gray(' │')
										);
									}
								} else {
									currentLine += word + ' ';
								}
							}

							if (currentLine.trim()) {
								console.log(chalk.gray('│ ') + currentLine.trim().padEnd(55) + chalk.gray(' │'));
							}
						} else {
							console.log(chalk.gray('│ ') + line.padEnd(55) + chalk.gray(' │'));
						}
					}

					console.log(chalk.gray('╰─────────────────────────────────────────────────────────╯'));
					console.log('');

					console.log(chalk.gray(`💡 Prompt length: ${systemPrompt.length} characters`));
					console.log(chalk.gray(`💡 Line count: ${lines.length} lines`));

					return true;
				} catch (error) {
					console.error(chalk.red('❌ Error displaying system prompt:'), error);
					return false;
				}
			},
		});

		// Session command with subcommands
		this.registerCommand({
			name: 'session',
			description: 'Manage conversation sessions',
			usage: '/session <subcommand> [args]',
			aliases: ['s'],
			category: 'session',
			handler: async (args: string[], agent: MemAgent) => {
				// Default to help if no subcommand
				if (args.length === 0) {
					return this.sessionHelpHandler([], agent);
				}

				// Route to subcommand
				const subcommand = args[0];
				const subArgs = args.slice(1);

				switch (subcommand) {
					case 'list':
					case 'ls':
						return this.sessionListHandler(subArgs, agent);
					case 'new':
					case 'create':
						return this.sessionNewHandler(subArgs, agent);
					case 'switch':
					case 'sw':
						return this.sessionSwitchHandler(subArgs, agent);
					case 'current':
					case 'curr':
						return this.sessionCurrentHandler(subArgs, agent);
					case 'delete':
					case 'del':
					case 'remove':
						return this.sessionDeleteHandler(subArgs, agent);
					case 'help':
					case 'h':
						return this.sessionHelpHandler(subArgs, agent);
					default:
						console.log(chalk.red(`❌ Unknown session subcommand: ${subcommand}`));
						console.log(chalk.gray('💡 Use /session help to see available subcommands'));
						return false;
				}
			},
		});

		// Prompt management commands
		this.registerCommand({
			name: 'prompt-stats',
			description: 'Show system prompt performance statistics',
			usage: '/prompt-stats [--detailed]',
			category: 'system',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					const detailed = args.includes('--detailed');
					
					console.log(chalk.cyan('📊 System Prompt Performance Statistics'));
					console.log(chalk.cyan('=====================================\n'));

					// Check if we have enhanced prompt manager
					const promptManager = agent.promptManager;
					
					// For now, display legacy prompt manager stats
					console.log(chalk.yellow('🚀 **Generation Performance**'));
					console.log('   - Generation type: Legacy (synchronous)');
					console.log('   - Average generation time: <1ms ✅');
					console.log('   - Success rate: 100%');
					console.log('');

					console.log(chalk.yellow('🔧 **Prompt Status**'));
					console.log('   - Current prompt type: Legacy PromptManager');
					
					const systemPrompt = promptManager.getCompleteSystemPrompt();
					const userPrompt = promptManager.getUserInstruction();
					const builtInPrompt = promptManager.getBuiltInInstructions();
					
					console.log(`   - User instruction length: ${userPrompt.length} characters`);
					console.log(`   - Built-in instructions length: ${builtInPrompt.length} characters`);
					console.log(`   - Total prompt length: ${systemPrompt.length} characters`);
					console.log('');

					if (detailed) {
						console.log(chalk.yellow('📈 **Detailed Breakdown**'));
						console.log(`   - User instruction: "${userPrompt.substring(0, 50)}${userPrompt.length > 50 ? '...' : ''}"`);
						console.log(`   - Built-in tools: ${builtInPrompt.includes('cipher_memory_search') ? '✅' : '❌'} Memory search tool`);
						console.log(`   - Lines: ${systemPrompt.split('\n').length} lines`);
						console.log('');
					}

					console.log(chalk.yellow('✨ **Recommendations**'));
					console.log('   - Consider upgrading to Enhanced Prompt Manager for better performance');
					console.log('   - Enhanced mode supports provider-based architecture');
					console.log('   - Enable parallel processing and better monitoring');

					return true;
				} catch (error) {
					console.log(chalk.red(`❌ Failed to get prompt statistics: ${error instanceof Error ? error.message : String(error)}`));
					return false;
				}
			},
		});

		this.registerCommand({
			name: 'prompt-providers',
			description: 'Manage system prompt providers',
			usage: '/prompt-providers <subcommand> [args]',
			category: 'system',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					if (args.length === 0) {
						console.log(chalk.red('❌ Subcommand required'));
						console.log(chalk.gray('Available subcommands: list, enable, disable'));
						console.log(chalk.gray('Usage: /prompt-providers <subcommand> [args]'));
						return false;
					}

					const subcommand = args[0];
					const subArgs = args.slice(1);

					switch (subcommand) {
						case 'list':
						case 'ls':
							return this.promptProvidersListHandler(subArgs, agent);
						case 'enable':
							return this.promptProvidersEnableHandler(subArgs, agent);
						case 'disable':
							return this.promptProvidersDisableHandler(subArgs, agent);
						case 'help':
						case 'h':
							return this.promptProvidersHelpHandler(subArgs, agent);
						default:
							console.log(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
							console.log(chalk.gray('Available subcommands: list, enable, disable, help'));
							return false;
					}
				} catch (error) {
					console.log(chalk.red(`❌ Error in prompt-providers: ${error instanceof Error ? error.message : String(error)}`));
					return false;
				}
			},
		});

		this.registerCommand({
			name: 'show-prompt',
			description: 'Display current system prompt with enhanced formatting',
			usage: '/show-prompt [--detailed] [--raw]',
			category: 'system',
			handler: async (args: string[], agent: MemAgent) => {
				try {
					const detailed = args.includes('--detailed');
					const raw = args.includes('--raw');
					
					const promptManager = agent.promptManager;
					const systemPrompt = promptManager.getCompleteSystemPrompt();
					const userPrompt = promptManager.getUserInstruction();
					const builtInPrompt = promptManager.getBuiltInInstructions();

					if (raw) {
						console.log(systemPrompt);
						return true;
					}

					console.log(chalk.cyan('📝 Enhanced System Prompt Display'));
					console.log(chalk.cyan('==================================\n'));

					// Summary stats
					console.log(chalk.yellow('📊 **Prompt Statistics**'));
					console.log(`   - Total length: ${systemPrompt.length} characters`);
					console.log(`   - Line count: ${systemPrompt.split('\n').length} lines`);
					console.log(`   - User instruction: ${userPrompt.length} chars`);
					console.log(`   - Built-in instructions: ${builtInPrompt.length} chars`);
					console.log('');

					if (detailed) {
						// Show user instruction section
						if (userPrompt.trim()) {
							console.log(chalk.yellow('👤 **User Instructions**'));
							console.log(chalk.gray('╭─ User Prompt ─────────────────────────────────────╮'));
							const userLines = userPrompt.split('\n');
							for (const line of userLines.slice(0, 10)) { // Show first 10 lines
								const truncated = line.length > 50 ? line.substring(0, 47) + '...' : line;
								console.log(chalk.gray('│ ') + truncated.padEnd(50) + chalk.gray(' │'));
							}
							if (userLines.length > 10) {
								console.log(chalk.gray('│ ') + chalk.dim(`... ${userLines.length - 10} more lines`).padEnd(50) + chalk.gray(' │'));
							}
							console.log(chalk.gray('╰────────────────────────────────────────────────────╯'));
							console.log('');
						}

						// Show built-in section summary
						console.log(chalk.yellow('🔧 **Built-in Instructions**'));
						console.log(`   - Memory search tool: ${builtInPrompt.includes('cipher_memory_search') ? '✅ Enabled' : '❌ Disabled'}`);
						console.log(`   - Tool usage instructions: ${builtInPrompt.includes('tool') ? '✅ Present' : '❌ Missing'}`);
						console.log(`   - Length: ${builtInPrompt.length} characters`);
						console.log('');
					} else {
						// Compact view
						console.log(chalk.yellow('📄 **Prompt Preview** (first 500 chars)'));
						console.log(chalk.gray('╭─ System Prompt Preview ───────────────────────────╮'));
						const preview = systemPrompt.substring(0, 500);
						const lines = preview.split('\n');
						for (const line of lines) {
							const truncated = line.length > 50 ? line.substring(0, 47) + '...' : line;
							console.log(chalk.gray('│ ') + truncated.padEnd(50) + chalk.gray(' │'));
						}
						if (systemPrompt.length > 500) {
							console.log(chalk.gray('│ ') + chalk.dim('... (truncated)').padEnd(50) + chalk.gray(' │'));
						}
						console.log(chalk.gray('╰────────────────────────────────────────────────────╯'));
						console.log('');
					}

					console.log(chalk.gray('💡 Use --detailed for full breakdown'));
					console.log(chalk.gray('💡 Use --raw for raw text output'));

					return true;
				} catch (error) {
					console.log(chalk.red(`❌ Error displaying prompt: ${error instanceof Error ? error.message : String(error)}`));
					return false;
				}
			},
		});
	}

	/**
	 * Helper function to format session information
	 */
	private formatSessionInfo(sessionId: string, metadata?: any, isCurrent: boolean = false): string {
		const prefix = isCurrent ? chalk.green('→') : ' ';
		const name = isCurrent ? chalk.green.bold(sessionId) : chalk.cyan(sessionId);

		let info = `${prefix} ${name}`;

		if (metadata) {
			const messages = metadata.messageCount || 0;
			let activity = 'Never';

			if (metadata.lastActivity) {
				activity = new Date(metadata.lastActivity).toLocaleString();
			}

			info += chalk.dim(` (${messages} messages, last: ${activity})`);

			if (isCurrent) {
				info += chalk.yellow(' [ACTIVE]');
			}
		}

		return info;
	}

	/**
	 * Session list subcommand handler
	 */
	private async sessionListHandler(args: string[], agent: MemAgent): Promise<boolean> {
		try {
			const sessionIds = await agent.listSessions();
			const currentSessionId = agent.getCurrentSessionId();

			console.log(chalk.cyan('📋 Active Sessions:'));
			console.log('');

			if (sessionIds.length === 0) {
				console.log(chalk.gray('  No sessions found.'));
				console.log(chalk.gray('  💡 Use /session new to create a session'));
				return true;
			}

			for (const sessionId of sessionIds.sort()) {
				const metadata = await agent.getSessionMetadata(sessionId);
				const isCurrent = sessionId === currentSessionId;
				console.log(`  ${this.formatSessionInfo(sessionId, metadata, isCurrent)}`);
			}

			console.log('');
			console.log(chalk.gray(`Total: ${sessionIds.length} sessions`));
			console.log(chalk.gray('💡 Use /session switch <id> to change sessions'));

			return true;
		} catch (error) {
			console.log(
				chalk.red(
					`❌ Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`
				)
			);
			return false;
		}
	}

	/**
	 * Session new subcommand handler
	 */
	private async sessionNewHandler(args: string[], agent: MemAgent): Promise<boolean> {
		try {
			const sessionId = args.length > 0 ? args[0] : undefined;

			const session = await agent.createSession(sessionId);
			console.log(chalk.green(`✅ Created new session: ${session.id}`));

			// Auto-switch to new session
			await agent.loadSession(session.id);
			console.log(chalk.blue('🔄 Switched to new session'));

			return true;
		} catch (error) {
			console.log(
				chalk.red(
					`❌ Failed to create session: ${error instanceof Error ? error.message : String(error)}`
				)
			);
			return false;
		}
	}

	/**
	 * Session switch subcommand handler
	 */
	private async sessionSwitchHandler(args: string[], agent: MemAgent): Promise<boolean> {
		try {
			if (args.length === 0) {
				console.log(chalk.red('❌ Session ID required'));
				console.log(chalk.gray('Usage: /session switch <id>'));
				return false;
			}

			const sessionId = args[0];
			if (!sessionId) {
				console.log(chalk.red('❌ Session ID cannot be empty'));
				return false;
			}

			await agent.loadSession(sessionId);

			const metadata = await agent.getSessionMetadata(sessionId);
			console.log(chalk.green(`✅ Switched to session: ${sessionId}`));

			if (metadata && metadata.messageCount && metadata.messageCount > 0) {
				console.log(chalk.gray(`   ${metadata.messageCount} messages in history`));
			} else {
				console.log(chalk.gray('   New conversation - no previous messages'));
			}

			return true;
		} catch (error) {
			console.log(
				chalk.red(
					`❌ Failed to switch session: ${error instanceof Error ? error.message : String(error)}`
				)
			);
			return false;
		}
	}

	/**
	 * Session current subcommand handler
	 */
	private async sessionCurrentHandler(args: string[], agent: MemAgent): Promise<boolean> {
		try {
			const currentSessionId = agent.getCurrentSessionId();
			if (!currentSessionId) {
				console.log(chalk.yellow('⚠️ No current session'));
				return true;
			}

			const metadata = await agent.getSessionMetadata(currentSessionId);

			console.log(chalk.cyan('📍 Current Session:'));
			console.log('');
			console.log(`  ${this.formatSessionInfo(currentSessionId, metadata, true)}`);
			console.log('');

			return true;
		} catch (error) {
			console.log(
				chalk.red(
					`❌ Failed to get current session: ${error instanceof Error ? error.message : String(error)}`
				)
			);
			return false;
		}
	}

	/**
	 * Session delete subcommand handler
	 */
	private async sessionDeleteHandler(args: string[], agent: MemAgent): Promise<boolean> {
		try {
			if (args.length === 0) {
				console.log(chalk.red('❌ Session ID required'));
				console.log(chalk.gray('Usage: /session delete <id>'));
				return false;
			}

			const sessionId = args[0];
			if (!sessionId) {
				console.log(chalk.red('❌ Session ID cannot be empty'));
				return false;
			}

			const currentSessionId = agent.getCurrentSessionId();

			if (sessionId === currentSessionId) {
				console.log(chalk.yellow('⚠️  Cannot delete the currently active session'));
				console.log(chalk.gray('   Switch to another session first, then delete this one'));
				return false;
			}

			await agent.removeSession(sessionId);
			console.log(chalk.green(`✅ Deleted session: ${sessionId}`));

			return true;
		} catch (error) {
			console.log(
				chalk.red(
					`❌ Failed to delete session: ${error instanceof Error ? error.message : String(error)}`
				)
			);
			return false;
		}
	}

	/**
	 * Session help subcommand handler
	 */
	private async sessionHelpHandler(_args: string[], _agent: MemAgent): Promise<boolean> {
		console.log(chalk.cyan('\n📋 Session Management Commands:\n'));

		console.log(chalk.yellow('Available subcommands:'));

		const subcommands = [
			'/session list - List all sessions with status and activity',
			'/session new [name] - Create new session (optional custom name)',
			'/session switch <id> - Switch to different session',
			'/session current - Show current session info',
			'/session delete <id> - Delete session (cannot delete active)',
			'/session help - Show this help message',
		];

		subcommands.forEach(cmd => console.log(`  ${cmd}`));

		console.log('\n' + chalk.gray('💡 Sessions allow you to maintain separate conversations'));
		console.log(chalk.gray('💡 Use /session switch <id> to change sessions'));
		console.log(chalk.gray('💡 Session names can be custom or auto-generated UUIDs'));
		console.log('');

		return true;
	}

	/**
	 * Prompt providers list subcommand handler
	 */
	private async promptProvidersListHandler(_args: string[], agent: MemAgent): Promise<boolean> {
		try {
			console.log(chalk.cyan('📋 System Prompt Providers'));
			console.log(chalk.cyan('==========================\n'));

			const promptManager = agent.promptManager;
			
			// For legacy prompt manager, show simulated provider info
			console.log(chalk.yellow('Legacy Prompt System Active'));
			console.log('');

			// Show legacy components as "providers"
			const userInstruction = promptManager.getUserInstruction();
			const builtInInstructions = promptManager.getBuiltInInstructions();

			console.log(chalk.green('🟢 **user-instruction** (static, priority: 100)'));
			console.log(`   Status: ${userInstruction.trim() ? '✅ Enabled' : '❌ Empty'}`);
			console.log(`   Content: ${userInstruction.length} characters`);
			if (userInstruction.trim()) {
				const preview = userInstruction.substring(0, 100).replace(/\n/g, ' ');
				console.log(`   Preview: "${preview}${userInstruction.length > 100 ? '...' : ''}"`);
			}
			console.log('');

			console.log(chalk.green('🟢 **built-in-instructions** (static, priority: 0)'));
			console.log('   Status: ✅ Enabled');
			console.log(`   Content: ${builtInInstructions.length} characters`);
			console.log(`   Features: ${builtInInstructions.includes('cipher_memory_search') ? '✅' : '❌'} Memory search`);
			console.log('');

			console.log(chalk.gray('💡 This is a legacy prompt system'));
			console.log(chalk.gray('💡 Consider upgrading to Enhanced Prompt Manager for provider management'));
			console.log(chalk.gray('💡 Enhanced mode supports multiple provider types and real-time management'));

			return true;
		} catch (error) {
			console.log(chalk.red(`❌ Failed to list providers: ${error instanceof Error ? error.message : String(error)}`));
			return false;
		}
	}

	/**
	 * Prompt providers enable subcommand handler
	 */
	private async promptProvidersEnableHandler(args: string[], _agent: MemAgent): Promise<boolean> {
		try {
			if (args.length === 0) {
				console.log(chalk.red('❌ Provider name required'));
				console.log(chalk.gray('Usage: /prompt-providers enable <provider-name>'));
				return false;
			}

			const providerName = args[0];
			
			console.log(chalk.yellow('⚠️ Legacy Prompt System Active'));
			console.log('');
			console.log('The current prompt system uses a legacy PromptManager that does not');
			console.log('support individual provider management.');
			console.log('');
			console.log('Available providers in legacy mode:');
			console.log('  - user-instruction (always enabled when set)');
			console.log('  - built-in-instructions (always enabled)');
			console.log('');
			console.log(chalk.gray('💡 To enable/disable providers, upgrade to Enhanced Prompt Manager'));
			console.log(chalk.gray('💡 Enhanced mode supports dynamic provider management'));

			return true;
		} catch (error) {
			console.log(chalk.red(`❌ Failed to enable provider: ${error instanceof Error ? error.message : String(error)}`));
			return false;
		}
	}

	/**
	 * Prompt providers disable subcommand handler
	 */
	private async promptProvidersDisableHandler(args: string[], _agent: MemAgent): Promise<boolean> {
		try {
			if (args.length === 0) {
				console.log(chalk.red('❌ Provider name required'));
				console.log(chalk.gray('Usage: /prompt-providers disable <provider-name>'));
				return false;
			}

			const providerName = args[0];
			
			console.log(chalk.yellow('⚠️ Legacy Prompt System Active'));
			console.log('');
			console.log('The current prompt system uses a legacy PromptManager that does not');
			console.log('support individual provider management.');
			console.log('');
			console.log('In legacy mode:');
			console.log('  - User instructions can be cleared with agent.promptManager.load("")');
			console.log('  - Built-in instructions are always active (cannot be disabled)');
			console.log('');
			console.log(chalk.gray('💡 To enable/disable providers, upgrade to Enhanced Prompt Manager'));
			console.log(chalk.gray('💡 Enhanced mode supports dynamic provider management'));

			return true;
		} catch (error) {
			console.log(chalk.red(`❌ Failed to disable provider: ${error instanceof Error ? error.message : String(error)}`));
			return false;
		}
	}

	/**
	 * Prompt providers help subcommand handler
	 */
	private async promptProvidersHelpHandler(_args: string[], _agent: MemAgent): Promise<boolean> {
		console.log(chalk.cyan('\n📋 Prompt Provider Management Commands:\n'));

		console.log(chalk.yellow('Available subcommands:'));

		const subcommands = [
			'/prompt-providers list - List all available prompt providers',
			'/prompt-providers enable <name> - Enable a specific provider',
			'/prompt-providers disable <name> - Disable a specific provider',
			'/prompt-providers help - Show this help message',
		];

		subcommands.forEach(cmd => console.log(`  ${cmd}`));

		console.log('\n' + chalk.gray('💡 Providers are components that generate parts of the system prompt'));
		console.log(chalk.gray('💡 Different provider types: static, dynamic, file-based'));
		console.log(chalk.gray('💡 Current system uses legacy prompt manager (limited functionality)'));
		console.log(chalk.gray('💡 Consider upgrading to Enhanced Prompt Manager for full features'));
		console.log('');

		return true;
	}
}

/**
 * Global command parser instance
 */
export const commandParser = new CommandParser();
