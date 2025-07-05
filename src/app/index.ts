#!/usr/bin/env node
import { env } from '@core/env.js';
import { Command } from 'commander';
import pkg from '../../package.json' with { type: 'json' };
import { existsSync } from 'fs';
import { DEFAULT_CONFIG_PATH, logger, MemAgent } from '@core/index.js';
import { handleCliOptionsError, validateCliOptions } from './cli/utils/options.js';
import { loadAgentConfig } from '../core/brain/memAgent/loader.js';
import { startInteractiveCli, startMcpMode } from './cli/cli.js';

const program = new Command();

program
	.name('cipher')
	.description('Agent that can help to remember your vibe coding agent knowledge and reinforce it')
	.version(pkg.version, '-v, --version', 'output the current version')
	.option('--no-verbose', 'Disable verbose output')
	.option('--mode <mode>', 'The application mode for cipher memory agent - cli | mcp', 'cli');

program
	.description(
		'Cipher CLI allows you to interact with cipher memory agent in interactive mode.\n' +
			'Available modes:\n' +
			'  - cli: Interactive command-line interface\n' +
			'  - mcp: Model Context Protocol server mode'
	)
	.action(async () => {
		if (!existsSync('.env')) {
			logger.error('No .env file found, copy .env.example to .env and fill in the values');
			process.exit(1);
		}

		// Check if at least one API key is provided
		if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY && !env.OPENROUTER_API_KEY) {
			logger.error(
				'No API key found, please set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY in .env file'
			);
			logger.error('Available providers: OpenAI, Anthropic, OpenRouter');
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
			const configPath = DEFAULT_CONFIG_PATH;
			logger.info(`Loading agent config from ${configPath}`);

			// Check if config file exists
			if (!existsSync(configPath)) {
				logger.error(`Config file not found at ${configPath}`);
				logger.error(
					'Please ensure the config file exists or create one based on memAgent/cipher.yml'
				);
				process.exit(1);
			}

			const cfg = await loadAgentConfig(configPath);
			agent = new MemAgent(cfg);

			// Start the agent (initialize async services)
			await agent.start();

			// Print OpenAI embedder dimension after agent is started
			if (agent.services && agent.services.embeddingManager) {
				const embedder = agent.services.embeddingManager.getEmbedder('default');
			} else {
				console.log('No embeddingManager found in agent.services');
			}
		} catch (err) {
			logger.error(
				'Failed to load agent config:',
				err instanceof Error ? err.message : String(err)
			);
			process.exit(1);
		}

		// ——— Dispatch based on --mode ———
		switch (opts.mode) {
			case 'cli':
				await startInteractiveCli(agent);
				break;
			case 'mcp':
				await startMcpMode(agent);
				break;
			default:
				logger.error(`Unknown mode '${opts.mode}'. Use cli or mcp.`);
				process.exit(1);
		}
	});

program.parseAsync(process.argv);
