import { LLMConfig } from '../llm/config.js';
import { AgentConfig } from './config.js';
import { logger } from '../../logger/index.js';
import { McpServerValidationResult, validateMcpServerConfig } from '../../mcp/validation.js';
import { McpServerConfig } from '../../mcp/types.js';

export interface SessionOverride {
	/** Override LLM config for this session */
	llm?: Partial<LLMConfig>;
}

export class MemAgentStateManager {
	private runtimeConfig: AgentConfig;
	private readonly baselineConfig: AgentConfig;
	private sessionOverrides: Map<string, SessionOverride> = new Map();

	constructor(staticConfig: AgentConfig) {
		this.baselineConfig = structuredClone(staticConfig);
		this.runtimeConfig = structuredClone(staticConfig);
		logger.debug('Initialized MemAgentStateManager with baseline config:', this.baselineConfig);
	}

	public addMcpServer(
		serverName: string,
		serverConfig: McpServerConfig
	): McpServerValidationResult {
		logger.debug(`Adding/updating MCP server: ${serverName}`);

		// Validate the server configuration
		const existingServerNames = Object.keys(this.runtimeConfig.mcpServers);
		const validation = validateMcpServerConfig(serverName, serverConfig, existingServerNames);

		if (!validation.isValid) {
			logger.warn('MCP server configuration validation failed', {
				serverName,
				errors: validation.errors.map(e => e.message),
				warnings: validation.warnings,
			});
			return validation;
		}

		// Log warnings if any
		if (validation.warnings.length > 0) {
			logger.warn('MCP server configuration warnings', {
				serverName,
				warnings: validation.warnings,
			});
		}

		const isUpdate = serverName in this.runtimeConfig.mcpServers;
		// Use the validated config with defaults applied from validation result
		this.runtimeConfig.mcpServers[serverName] = validation.config!;

		logger.info(`MCP server '${serverName}' ${isUpdate ? 'updated' : 'added'} successfully`);

		return validation;
	}

	public removeMcpServer(serverName: string): void {
		logger.debug(`Removing MCP server: ${serverName}`);

		if (serverName in this.runtimeConfig.mcpServers) {
			delete this.runtimeConfig.mcpServers[serverName];

			logger.info(`MCP server '${serverName}' removed successfully`);
		} else {
			logger.warn(`MCP server '${serverName}' not found for removal`);
		}
	}

	public getRuntimeConfig(sessionId?: string): Readonly<AgentConfig> {
		if (!sessionId) {
			return structuredClone(this.runtimeConfig);
		}

		const override = this.sessionOverrides.get(sessionId);
		if (!override) {
			return structuredClone(this.runtimeConfig);
		}

		return {
			...this.runtimeConfig,
			llm: { ...this.runtimeConfig.llm, ...override.llm },
		};
	}

	public getLLMConfig(sessionId?: string): Readonly<LLMConfig> {
		return this.getRuntimeConfig(sessionId).llm;
	}
}
