#!/usr/bin/env node
import { env } from '@core/env.js';
import { Command } from 'commander';
import pkg from '../../package.json' with { type: 'json' };
import { existsSync } from 'fs';
import { DEFAULT_CONFIG_PATH, logger, MemAgent } from '@core/index.js';
import { resolveConfigPath } from '@core/utils/path.js';
import { handleCliOptionsError, validateCliOptions } from './cli/utils/options.js';
import { loadAgentConfig } from '../core/brain/memAgent/loader.js';
import { startInteractiveCli, startMcpMode, startHeadlessCli } from './cli/cli.js';
import { ApiServer } from './api/server.js';

const program = new Command();

program
	.name('cipher')
	.description('Agent that can help to remember your vibe coding agent knowledge and reinforce it')
	.version(pkg.version, '-v, --version', 'output the current version')
	.argument(
		'[prompt...]',
		'Natural-language prompt to run once. If not passed, cipher will start in interactive mode'
	)
	.option('--no-verbose', 'Disable verbose output')
	.option('-a, --agent <path>', 'Path to agent config file', DEFAULT_CONFIG_PATH)
	.option('-s, --strict', 'Require all MCP server connections to succeed')
	.option('--new-session [sessionId]', 'Start with a new session (optionally specify session ID)')
	.option('--mode <mode>', 'The application mode for cipher memory agent - cli | mcp | api', 'cli')
	.option('--port <port>', 'Port for API server (only used with --mode api)', '3000')
	.option('--host <host>', 'Host for API server (only used with --mode api)', 'localhost');

program
	.description(
		'Cipher CLI allows you to interact with cipher memory agent.\n' +
			'Run cipher in interactive mode with `cipher` or run a one-shot prompt with `cipher <prompt>`\n\n' +
			'Available modes:\n' +
			'  - cli: Interactive command-line interface (default)\n' +
			'  - mcp: Model Context Protocol server mode\n' +
			'  - api: REST API server mode\n\n' +
			'Options:\n' +
			'  -s, --strict: Require all MCP server connections to succeed (overrides individual server connection modes)\n' +
			'  --new-session [sessionId]: Start with a new session (optionally specify session ID)\n' +
			'  --port <port>: Port for API server (default: 3000, only used with --mode api)\n' +
			'  --host <host>: Host for API server (default: localhost, only used with --mode api)'
	)
	/**
	 * Main CLI action handler for the Cipher agent.
	 *
	 * Strict Mode Behavior:
	 * When the --strict flag is used, all MCP server connectionMode properties
	 * are overridden to 'strict', requiring all server connections to succeed.
	 * This takes precedence over individual server configuration settings.
	 *
	 * If any MCP server fails to connect in strict mode, the application will
	 * exit with an error. Without strict mode, failed connections are logged
	 * as warnings but don't prevent startup.
	 *
	 * New Session Behavior:
	 * When the --new-session flag is used, a new conversation session is created
	 * and made available for the CLI interaction. The session ID parameter is optional:
	 * - --new-session: Creates a session with auto-generated UUID
	 * - --new-session mySessionId: Creates a session with the specified ID
	 *
	 * Created sessions persist for the duration of the CLI session and follow
	 * the agent's session management lifecycle and TTL settings.
	 *
	 * One-Shot Mode Behavior:
	 * When prompt arguments are provided, cipher runs in headless mode:
	 * - Executes the prompt once and exits
	 * - Works with all existing flags and options
	 * - Example: cipher "help me debug this error"
	 */
	.action(async (prompt: string[] = []) => {
		// Process prompt arguments for one-shot mode
		const headlessInput = prompt.join(' ') || undefined;
		if (!existsSync('.env')) {
			logger.error('No .env file found, copy .env.example to .env and fill in the values');
			process.exit(1);
		}

		// Check if at least one API key is provided or Ollama is configured
		if (
			!env.OPENAI_API_KEY &&
			!env.ANTHROPIC_API_KEY &&
			!env.OPENROUTER_API_KEY &&
			!env.OLLAMA_BASE_URL
		) {
			logger.error(
				'No API key or Ollama configuration found, please set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or OLLAMA_BASE_URL in .env file'
			);
			logger.error('Available providers: OpenAI, Anthropic, OpenRouter, Ollama');
			process.exit(1);
		}

		const opts = program.opts();

		// validate cli options
		try {
			validateCliOptions(opts);
		} catch (err) {
			handleCliOptionsError(err);
		}

		// load agent config
		let agent: MemAgent;
		try {
			// Resolve the config path based on the provided agent option
			const configPath = resolveConfigPath(opts.agent);
			logger.info(`Loading agent config from ${configPath}`);

			// Check if config file exists
			if (!existsSync(configPath)) {
				logger.error(`Config file not found at ${configPath}`);
				if (opts.agent === DEFAULT_CONFIG_PATH) {
					logger.error(
						'Please ensure the config file exists or create one based on memAgent/cipher.yml'
					);
				} else {
					logger.error(`Please ensure the specified config file exists at ${configPath}`);
				}
				process.exit(1);
			}

			const cfg = await loadAgentConfig(configPath);

			// Apply --strict flag to all MCP server configs if specified
			if (opts.strict && cfg.mcpServers) {
				logger.info('Applying strict mode to all MCP server connections');
				for (const [serverName, serverConfig] of Object.entries(cfg.mcpServers)) {
					logger.debug(`Setting connection mode to strict for server: ${serverName}`);
					serverConfig.connectionMode = 'strict';
				}
			}

			agent = new MemAgent(cfg);

			// Start the agent (initialize async services)
			await agent.start();

			// Handle --new-session flag
			if (opts.newSession !== undefined) {
				try {
					// Use provided session ID or generate a random one
					const sessionId =
						typeof opts.newSession === 'string' && opts.newSession ? opts.newSession : undefined; // Let agent generate random ID

					const session = await agent.createSession(sessionId);

					logger.info(`Created and loaded new session: ${session.id}`, null, 'green');
				} catch (err) {
					logger.error(
						`Failed to create new session: ${err instanceof Error ? err.message : String(err)}`
					);
					process.exit(1);
				}
			}

			// Print OpenAI embedder dimension after agent is started
			if (agent.services && agent.services.embeddingManager) {
				const _embedder = agent.services.embeddingManager.getEmbedder('default');
			} else {
				console.log('No embeddingManager found in agent.services');
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);

			if (opts.strict) {
				logger.error(
					`Failed to load agent config from ${resolveConfigPath(opts.agent)} (strict mode enabled):`,
					errorMessage
				);
				logger.error(
					'Strict mode requires all MCP server connections to succeed. ' +
						'Check your MCP server configurations or run without --strict flag to allow lenient connections.'
				);
			} else {
				logger.error(
					`Failed to load agent config from ${resolveConfigPath(opts.agent)}:`,
					errorMessage
				);
			}
			process.exit(1);
		}

		// Handle one-shot mode if prompt arguments were provided
		if (headlessInput) {
			try {
				await startHeadlessCli(agent, headlessInput);
				process.exit(0);
			} catch (err) {
				logger.error(
					`Failed to execute headless command: ${err instanceof Error ? err.message : String(err)}`
				);
				process.exit(1);
			}
		}

		/**
		 * Start the API server mode
		 */
		async function startApiMode(agent: MemAgent, options: any): Promise<void> {
			const port = parseInt(options.port) || 3000;
			const host = options.host || 'localhost';

			logger.info(`Starting API server on ${host}:${port}`, null, 'green');

			const apiServer = new ApiServer(agent, {
				port,
				host,
				corsOrigins: ['http://localhost:3000', 'http://localhost:3001'], // Default CORS origins
				rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
				rateLimitMaxRequests: 100, // 100 requests per window
			});

			try {
				await apiServer.start();
				logger.info(`API server is running and ready to accept requests`, null, 'green');
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				logger.error(`Failed to start API server: ${errorMsg}`);
				process.exit(1);
			}
		}

		// ——— Dispatch based on --mode ———
		switch (opts.mode) {
			case 'cli':
				await startInteractiveCli(agent);
				break;
			case 'mcp':
				await startMcpMode(agent);
				break;
			case 'api':
				await startApiMode(agent, opts);
				break;
			default:
				logger.error(`Unknown mode '${opts.mode}'. Use cli, mcp, or api.`);
				process.exit(1);
		}
	});

program.parseAsync(process.argv);
