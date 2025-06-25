import { LLMConfig } from '../llm/config.js';
import { AgentConfig } from './config.js';
import { logger } from '../../logger/index.js';

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
