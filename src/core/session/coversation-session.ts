import { PromptManager } from '../brain/systemPrompt/manager.js';
import { ContextManager, ILLMService } from '../brain/llm/index.js';
import { MCPManager } from '../mcp/manager.js';
import { logger } from '../logger/index.js';
import { createContextManager } from '../brain/llm/messages/factory.js';
import { createLLMService } from '../brain/llm/services/factory.js';
import { MemAgentStateManager } from '../brain/memAgent/state-manager.js';

export class ConversationSession {
	private contextManager!: ContextManager;
	private llmService!: ILLMService;

	constructor(
		private services: {
			stateManager: MemAgentStateManager;
			promptManager: PromptManager;
			mcpManager: MCPManager;
		},
		public readonly id: string
	) {
		logger.debug('ConversationSession initialized with services', { services, id });
	}

	public async init(): Promise<void> {
		await this.initializeServices();
	}

	/**
	 * Initializes the services for the session
	 * @returns {Promise<void>}
	 */
	private async initializeServices(): Promise<void> {
		// Get current effective configuration for this session from state manager
		const llmConfig = this.services.stateManager.getLLMConfig(this.id);

		// Create session-specific message manager
		// NOTE: llmConfig comes from AgentStateManager which stores validated config,
		// so router should always be defined (has default in schema)
		this.contextManager = createContextManager(llmConfig, this.services.promptManager);

		// Create session-specific LLM service
		this.llmService = createLLMService(llmConfig, this.services.mcpManager, this.contextManager);

		logger.debug(`ChatSession ${this.id}: Services initialized with storage`);
	}

	public async run(
		input: string,
		imageDataInput?: { image: string; mimeType: string },
		stream?: boolean
	): Promise<string> {
		logger.debug(
			`Running session ${this.id} with input: ${input} and imageDataInput: ${imageDataInput} and stream: ${stream}`
		);
		const response = await this.llmService.generate(input, imageDataInput, stream);
		return response;
	}

	public getContextManager(): ContextManager {
		return this.contextManager;
	}

	public getLLMService(): ILLMService {
		return this.llmService;
	}
}
