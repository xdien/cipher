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
      const parts = trimmed.slice(1).split(' ').filter(part => part.length > 0);
      const command = parts[0] || '';
      const args = parts.slice(1);
      
      return {
        isCommand: true,
        command,
        args,
        rawInput: input
      };
    } else {
      // Treat as regular user prompt
      return {
        isCommand: false,
        rawInput: input
      };
    }
  }

  /**
   * Execute a parsed command
   */
  async executeCommand(command: string, args: string[], agent: MemAgent): Promise<boolean> {
    // Check aliases first
    const actualCommand = this.aliases.get(command) || command;
    const commandDef = this.commands.get(actualCommand);
    
    if (!commandDef) {
      console.log(chalk.red(`❌ Unknown command: /${command}`));
      this.displayHelp();
      return false;
    }

    try {
      // Check for subcommands
      if (commandDef.subcommands && args.length > 0) {
        const subcommandName = args[0];
        const subcommand = commandDef.subcommands.find(sub => 
          sub.name === subcommandName || sub.aliases?.includes(subcommandName)
        );
        
        if (subcommand) {
          return await subcommand.handler(args.slice(1), agent);
        }
      }
      
      return await commandDef.handler(args, agent);
    } catch (error) {
      console.log(chalk.red(`❌ Error executing command /${command}: ${error instanceof Error ? error.message : String(error)}`));
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
          category: definition.category
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
            category: commandDef.category
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
    const categoryOrder = [
      'basic',
      'memory',
      'session',
      'tools',
      'system',
      'help'
    ];
    
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
    
    console.log(chalk.gray('💡 Use /help <command> for detailed information about a specific command'));
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
            if (this.hasCommand(commandName)) {
              this.displayHelp(commandName);
            } else {
              console.log(chalk.red(`❌ Unknown command: ${commandName}`));
              console.log(chalk.gray('💡 Use /help to see all available commands'));
            }
          } else {
            // Display all commands categorized
            this.displayHelp();
          }
          return true;
        } catch (error) {
          console.log(chalk.red(`❌ Error displaying help: ${error instanceof Error ? error.message : String(error)}`));
          return true;
        }
      }
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
          console.log(chalk.red(`❌ Error during exit: ${error instanceof Error ? error.message : String(error)}`));
          return true;
        }
      }
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
          const newSession = await agent.createSession('default');
          console.log(chalk.green('🔄 Conversation history reset successfully'));
          console.log(chalk.gray('💡 Starting fresh with a clean session'));
          return true;
        } catch (error) {
          console.log(chalk.red(`❌ Failed to reset conversation: ${error instanceof Error ? error.message : String(error)}`));
          return true;
        }
      }
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
          console.log(`  ${chalk.gray('Session TTL:')} ${((config.sessions?.sessionTTL || 3600000) / 1000 / 60).toFixed(0)} minutes`);
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
          console.log(chalk.red(`❌ Failed to get configuration: ${error instanceof Error ? error.message : String(error)}`));
          return true;
        }
      }
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
          console.log(`  ${chalk.gray('Session IDs:')} ${activeSessionIds.length > 0 ? activeSessionIds.join(', ') : 'none'}`);
          console.log('');

          // MCP Server Statistics
          console.log(chalk.yellow('🔗 MCP Server Stats:'));
          const mcpClients = agent.getMcpClients();
          const failedConnections = agent.getMcpFailedConnections();
          console.log(`  ${chalk.gray('Connected Servers:')} ${mcpClients.size}`);
          console.log(`  ${chalk.gray('Failed Connections:')} ${Object.keys(failedConnections).length}`);
          
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
              console.log(`  ${chalk.gray('Sample Tools:')} ${toolNames.join(', ')}${toolCount > 5 ? '...' : ''}`);
            }
          } catch (error) {
            console.log(`  ${chalk.gray('Tool Count:')} Error retrieving tools`);
          }
          console.log('');

          return true;
        } catch (error) {
          console.log(chalk.red(`❌ Failed to get statistics: ${error instanceof Error ? error.message : String(error)}`));
          return true;
        }
      }
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
              if (parts.length > 1) {
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
              } else if ('inputSchema' in toolDef && typeof toolDef.inputSchema === 'object' && toolDef.inputSchema !== null && 'description' in toolDef.inputSchema) {
                description = String(toolDef.inputSchema.description);
              }
            }

            toolsByServer[serverName].push({
              name: toolName,
              description: description
            });
          }

          // Display tools grouped by server
          for (const [serverName, tools] of Object.entries(toolsByServer)) {
            console.log(chalk.yellow(`📦 ${serverName.toUpperCase()}:`));
            
            tools.sort((a, b) => a.name.localeCompare(b.name));
            for (const tool of tools) {
              const truncatedDesc = tool.description.length > 80 
                ? tool.description.substring(0, 80) + '...' 
                : tool.description;
              console.log(`  ${chalk.cyan(tool.name)} - ${truncatedDesc}`);
            }
            console.log('');
          }

          console.log(chalk.gray(`Total: ${toolEntries.length} tools available`));
          return true;
        } catch (error) {
          console.log(chalk.red(`❌ Failed to list tools: ${error instanceof Error ? error.message : String(error)}`));
          return true;
        }
      }
    });

    // Prompt command
    this.registerCommand({
      name: 'prompt',
      description: 'Display current system prompt',
      category: 'system',
      handler: async (args: string[], agent: MemAgent) => {
        try {
          const systemPrompt = agent.promptManager.getInstruction();
          
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
                    console.log(chalk.gray('│ ') + (word.substring(0, 52) + '...').padEnd(55) + chalk.gray(' │'));
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
          console.log(chalk.red(`❌ Failed to get system prompt: ${error instanceof Error ? error.message : String(error)}`));
          return true;
        }
      }
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
      }
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
      console.log(chalk.red(`❌ Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`));
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
      console.log(chalk.red(`❌ Failed to create session: ${error instanceof Error ? error.message : String(error)}`));
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
      console.log(chalk.red(`❌ Failed to switch session: ${error instanceof Error ? error.message : String(error)}`));
      return false;
    }
  }

  /**
   * Session current subcommand handler
   */
  private async sessionCurrentHandler(args: string[], agent: MemAgent): Promise<boolean> {
    try {
      const currentSessionId = agent.getCurrentSessionId();
      const metadata = await agent.getSessionMetadata(currentSessionId);
      
      console.log(chalk.cyan('📍 Current Session:'));
      console.log('');
      console.log(`  ${this.formatSessionInfo(currentSessionId, metadata, true)}`);
      console.log('');
      
      return true;
    } catch (error) {
      console.log(chalk.red(`❌ Failed to get current session: ${error instanceof Error ? error.message : String(error)}`));
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
      console.log(chalk.red(`❌ Failed to delete session: ${error instanceof Error ? error.message : String(error)}`));
      return false;
    }
  }

  /**
   * Session help subcommand handler
   */
  private async sessionHelpHandler(args: string[], agent: MemAgent): Promise<boolean> {
    console.log(chalk.cyan('\n📋 Session Management Commands:\n'));
    
    console.log(chalk.yellow('Available subcommands:'));
    
    const subcommands = [
      '/session list - List all sessions with status and activity',
      '/session new [name] - Create new session (optional custom name)',
      '/session switch <id> - Switch to different session',
      '/session current - Show current session info',
      '/session delete <id> - Delete session (cannot delete active)',
      '/session help - Show this help message'
    ];
    
    subcommands.forEach(cmd => console.log(`  ${cmd}`));
    
    console.log('\n' + chalk.gray('💡 Sessions allow you to maintain separate conversations'));
    console.log(chalk.gray('💡 Use /session switch <id> to change sessions'));
    console.log(chalk.gray('💡 Session names can be custom or auto-generated UUIDs'));
    console.log('');
    
    return true;
  }
}

/**
 * Global command parser instance
 */
export const commandParser = new CommandParser(); 