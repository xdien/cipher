import { PromptManager } from '../brain/systemPrompt/manager.js';
import { ContextManager, ILLMService } from '../brain/llm/index.js';
import { MCPManager } from '../mcp/manager.js';
import { UnifiedToolManager } from '../brain/tools/unified-tool-manager.js';
import { logger } from '../logger/index.js';
import { env } from '../env.js';
import { createContextManager } from '../brain/llm/messages/factory.js';
import { createLLMService } from '../brain/llm/services/factory.js';
import { MemAgentStateManager } from '../brain/memAgent/state-manager.js';
import { ReasoningContentDetector } from '../brain/reasoning/content-detector.js';
import { SearchContextManager } from '../brain/reasoning/search-context-manager.js';
import { createDatabaseHistoryProvider } from '../brain/llm/messages/history/factory.js';
import { StorageManager } from '../storage/manager.js';
import { Logger } from '../logger/index.js';
import type { ZodSchema } from 'zod';
import { setImmediate } from 'timers';

// ... existing code ...

export class ConversationSession {
	private contextManager!: ContextManager;
	private llmService!: ILLMService;
	private reasoningDetector?: ReasoningContentDetector;
	private searchContextManager?: SearchContextManager;

	private sessionMemoryMetadata?: Record<string, any>;
	private mergeMetadata?: (
		sessionMeta: Record<string, any>,
		runMeta: Record<string, any>
	) => Record<string, any>;
	private metadataSchema?: ZodSchema<any>;
	private beforeMemoryExtraction?: (
		meta: Record<string, any>,
		context: Record<string, any>
	) => void;

	private historyProvider?: ReturnType<typeof createDatabaseHistoryProvider>;

	constructor(
		private services: {
			stateManager: MemAgentStateManager;
			promptManager: PromptManager;
			mcpManager: MCPManager;
			unifiedToolManager: UnifiedToolManager;
			storageManager?: StorageManager;
			logger?: Logger;
		},
		public readonly id: string,
		options?: {
			sessionMemoryMetadata?: Record<string, any>;
			mergeMetadata?: (
				sessionMeta: Record<string, any>,
				runMeta: Record<string, any>
			) => Record<string, any>;
			metadataSchema?: ZodSchema<any>;
			beforeMemoryExtraction?: (meta: Record<string, any>, context: Record<string, any>) => void;
			enableHistory?: boolean;
		}
	) {
		logger.debug('ConversationSession initialized with services', { services, id });
		if (
			options?.sessionMemoryMetadata &&
			typeof options.sessionMemoryMetadata === 'object' &&
			!Array.isArray(options.sessionMemoryMetadata)
		) {
			this.sessionMemoryMetadata = options.sessionMemoryMetadata;
		}
		if (options?.mergeMetadata) this.mergeMetadata = options.mergeMetadata;
		if (options?.metadataSchema) this.metadataSchema = options.metadataSchema;
		if (options?.beforeMemoryExtraction)
			this.beforeMemoryExtraction = options.beforeMemoryExtraction;
		// Initialize history provider if enabled
		if (options?.enableHistory !== false && services.storageManager && services.logger) {
			const backends = services.storageManager.getBackends();
			if (backends) {
				this.historyProvider = createDatabaseHistoryProvider(backends.database, services.logger);
			}
		}
	}

	public updateSessionMetadata(newMeta: Record<string, any>) {
		this.sessionMemoryMetadata = { ...this.sessionMemoryMetadata, ...newMeta };
	}

	public async init(): Promise<void> {
		await this.initializeServices();
	}

	private async initializeServices(): Promise<void> {
		const llmConfig = this.services.stateManager.getLLMConfig(this.id);
		// Pass historyProvider and sessionId to ContextManager
		this.contextManager = createContextManager(
			llmConfig,
			this.services.promptManager,
			this.historyProvider,
			this.id
		);
		if (this.historyProvider) {
			await this.contextManager.restoreHistory();
		}
		this.llmService = createLLMService(
			llmConfig,
			this.services.mcpManager,
			this.contextManager,
			this.services.unifiedToolManager
		);
		logger.debug(`ChatSession ${this.id}: Services initialized`);
	}

	public async run(
		input: string,
		imageDataInput?: { image: string; mimeType: string },
		stream: boolean = false,
		options?: {
			memoryMetadata?: Record<string, any>;
			contextOverrides?: Record<string, any>;
		}
	): Promise<{ response: string | null; backgroundOperations: Promise<void> }> {
		if (!this.llmService) {
			throw new Error('ConversationSession is not initialized. Call init() before run().');
		}
		if (typeof input !== 'string' || input.trim() === '') {
			throw new Error('Input must be a non-empty string');
		}
		if (imageDataInput) {
			if (
				typeof imageDataInput.image !== 'string' ||
				imageDataInput.image.trim() === '' ||
				typeof imageDataInput.mimeType !== 'string' ||
				imageDataInput.mimeType.trim() === ''
			) {
				throw new Error('imageDataInput must have image and mimeType as non-empty strings');
			}
		}
		// Coerce stream to boolean
		if (typeof stream !== 'boolean') {
			 
			console.warn('stream parameter should be boolean; coercing to boolean.');
			stream = !!stream;
		}
		// Warn on unknown option keys
		if (
			options &&
			Object.keys(options).some(k => !['memoryMetadata', 'contextOverrides'].includes(k))
		) {
			 
			console.warn('Unknown option keys passed to ConversationSession.run:', Object.keys(options));
		}
		// Call llmService.generate
		try {
			const responsePromise = this.llmService.generate(input, imageDataInput, stream);
			// Optionally, handle background operations (e.g., memory extraction, etc.)
			// For now, just return a resolved promise as placeholder
			const backgroundOperations = Promise.resolve();
			const response = await responsePromise;
			return { response, backgroundOperations };
		} catch (error) {
			throw error;
		}
	}

	public getContextManager() {
		return this.contextManager;
	}
	public getLLMService() {
		return this.llmService;
	}
	public getUnifiedToolManager() {
		return this.services.unifiedToolManager;
	}
}
