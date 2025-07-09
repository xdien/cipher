import { PromptManager } from '../brain/systemPrompt/manager.js';
import { ContextManager, ILLMService } from '../brain/llm/index.js';
import { MCPManager } from '../mcp/manager.js';
import { UnifiedToolManager } from '../brain/tools/unified-tool-manager.js';
import { logger } from '../logger/index.js';
import { createContextManager } from '../brain/llm/messages/factory.js';
import { createLLMService } from '../brain/llm/services/factory.js';
import { MemAgentStateManager } from '../brain/memAgent/state-manager.js';
import type { ZodSchema } from 'zod';

export class ConversationSession {
	private contextManager!: ContextManager;
	private llmService!: ILLMService;

	private sessionMemoryMetadata?: Record<string, any>;
	private mergeMetadata?: (sessionMeta: Record<string, any>, runMeta: Record<string, any>) => Record<string, any>;
	private metadataSchema?: ZodSchema<any>;
	private beforeMemoryExtraction?: (meta: Record<string, any>, context: Record<string, any>) => void;

	/**
	 * @param services - Required dependencies for the session, including unifiedToolManager
	 * @param id - Session identifier
	 * @param options - Optional advanced metadata options
	 */
	constructor(
		private services: {
			stateManager: MemAgentStateManager;
			promptManager: PromptManager;
			mcpManager: MCPManager;
			unifiedToolManager: UnifiedToolManager;
		},
		public readonly id: string,
		options?: {
			sessionMemoryMetadata?: Record<string, any>;
			mergeMetadata?: (sessionMeta: Record<string, any>, runMeta: Record<string, any>) => Record<string, any>;
			metadataSchema?: ZodSchema<any>;
			beforeMemoryExtraction?: (meta: Record<string, any>, context: Record<string, any>) => void;
		}
	) {
		logger.debug('ConversationSession initialized with services', { services, id });
		if (options?.sessionMemoryMetadata && typeof options.sessionMemoryMetadata === 'object' && !Array.isArray(options.sessionMemoryMetadata)) {
			this.sessionMemoryMetadata = options.sessionMemoryMetadata;
		}
		if (options?.mergeMetadata) this.mergeMetadata = options.mergeMetadata;
		if (options?.metadataSchema) this.metadataSchema = options.metadataSchema;
		if (options?.beforeMemoryExtraction) this.beforeMemoryExtraction = options.beforeMemoryExtraction;
	}

	/**
	 * Update session-level memory metadata after construction.
	 */
	public updateSessionMetadata(newMeta: Record<string, any>) {
		this.sessionMemoryMetadata = { ...this.sessionMemoryMetadata, ...newMeta };
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
		this.llmService = createLLMService(
			llmConfig,
			this.services.mcpManager,
			this.contextManager,
			this.services.unifiedToolManager
		);

		logger.debug(`ChatSession ${this.id}: Services initialized`);
	}

	/**
	 * Extract session-level metadata, merging defaults, session, and per-run metadata.
	 * Uses custom merge and validation if provided.
	 */
	private getSessionMetadata(runMeta?: Record<string, any>): Record<string, any> {
		const base = {
			sessionId: this.id,
			source: 'conversation-session',
			timestamp: new Date().toISOString(),
		};
		const sessionMeta = this.sessionMemoryMetadata || {};
		const customMeta = (runMeta && typeof runMeta === 'object' && !Array.isArray(runMeta)) ? runMeta : {};
		let merged = this.mergeMetadata
			? this.mergeMetadata(sessionMeta, customMeta)
			: { ...base, ...sessionMeta, ...customMeta };
		if (this.metadataSchema && !this.metadataSchema.safeParse(merged).success) {
			logger.warn('ConversationSession: Metadata validation failed, using session-level metadata only.');
			merged = { ...base, ...sessionMeta };
		}
		return merged;
	}

	/**
	 * Run a conversation session with input, optional image data, streaming, and custom options.
	 * @param input - User input string
	 * @param imageDataInput - Optional image data
	 * @param stream - Optional stream flag
	 * @param options - Optional parameters for memory extraction:
	 *   - memoryMetadata: Custom metadata to attach to memory extraction (merged with session defaults)
	 *   - contextOverrides: Overrides for context fields passed to memory extraction
	 * @returns The generated assistant response as a string
	 */
	public async run(
		input: string,
		imageDataInput?: { image: string; mimeType: string },
		stream?: boolean,
		options?: {
			memoryMetadata?: Record<string, any>;
			contextOverrides?: Record<string, any>;
		}
	): Promise<string> {
		console.log('ConversationSession.run called');
		logger.debug(
			`Running session ${this.id} with input: ${input} and imageDataInput: ${imageDataInput} and stream: ${stream}`
		);

		// Generate response
		const response = await this.llmService.generate(input, imageDataInput, stream);

		// Prepare merged metadata and context
		const mergedMeta = this.getSessionMetadata(options?.memoryMetadata);
		const defaultContext = {
			sessionId: this.id,
			conversationTopic: 'Interactive CLI session',
			recentMessages: this.extractComprehensiveInteractionData(input, response)
		};
		const mergedContext = {
			...defaultContext,
			...(options?.contextOverrides && typeof options.contextOverrides === 'object' && !Array.isArray(options.contextOverrides) ? options.contextOverrides : {})
		};
		if (this.beforeMemoryExtraction) {
			this.beforeMemoryExtraction(mergedMeta, mergedContext);
		}

		// PROGRAMMATIC ENFORCEMENT: Automatically call extract_and_operate_memory after every interaction
		await this.enforceMemoryExtraction(input, response, options);

		return response;
	}

	/**
	 * Programmatically enforce memory extraction after each user interaction
	 * This ensures the extract_and_operate_memory tool is always called, regardless of AI decisions
	 */
	private async enforceMemoryExtraction(userInput: string, aiResponse: string, options?: {
		memoryMetadata?: Record<string, any>;
		contextOverrides?: Record<string, any>;
	}): Promise<void> {
		console.log('ConversationSession.enforceMemoryExtraction called');
		console.log('enforceMemoryExtraction: unifiedToolManager at entry', this.services.unifiedToolManager, typeof this.services.unifiedToolManager);
		try {
			logger.info('ConversationSession: Enforcing memory extraction for interaction');

			// Check if the unifiedToolManager is available
			if (!this.services.unifiedToolManager) {
				logger.warn(
					'ConversationSession: UnifiedToolManager not available, skipping memory extraction'
				);
				return;
			}

			// unifiedToolManager is now always required and injected; no global mock debug needed

			// Extract comprehensive interaction data including tool usage
			const comprehensiveInteractionData = this.extractComprehensiveInteractionData(userInput, aiResponse);

			// Prepare context with overrides
			const defaultContext = {
				sessionId: this.id,
				conversationTopic: 'Interactive CLI session',
				recentMessages: comprehensiveInteractionData
			};
			const mergedContext = {
				...defaultContext,
				...(options?.contextOverrides && typeof options.contextOverrides === 'object' && !Array.isArray(options.contextOverrides) ? options.contextOverrides : {})
			};

			// Prepare memory metadata (merge session-level and per-run, per-run takes precedence)
			let memoryMetadata: Record<string, any> = {};
			if (options?.memoryMetadata !== undefined) {
				if (typeof options.memoryMetadata === 'object' && !Array.isArray(options.memoryMetadata)) {
					memoryMetadata = this.getSessionMetadata(options.memoryMetadata);
				} else {
					logger.warn('ConversationSession: Invalid memoryMetadata provided, expected a plain object. Using session-level or default metadata.');
					memoryMetadata = this.getSessionMetadata();
				}
			} else {
				memoryMetadata = this.getSessionMetadata();
			}

			// Call the extract_and_operate_memory tool directly (with cipher_ prefix)
			const memoryResult = await this.services.unifiedToolManager.executeTool(
				'cipher_extract_and_operate_memory',
				{
					interaction: comprehensiveInteractionData,
					context: mergedContext,
					memoryMetadata,
					options: {
						similarityThreshold: 0.7,
						maxSimilarResults: 5,
						useLLMDecisions: true,
						confidenceThreshold: 0.4,
						enableDeleteOperations: true,
					},
				}
			);

			logger.info('ConversationSession: Memory extraction completed', {
				success: memoryResult.success,
				extractedFacts: memoryResult.extraction?.extracted || 0,
				totalMemoryActions: memoryResult.memory?.length || 0,
				actionBreakdown: memoryResult.memory
					? {
							ADD: memoryResult.memory.filter((a: any) => a.event === 'ADD').length,
							UPDATE: memoryResult.memory.filter((a: any) => a.event === 'UPDATE').length,
							DELETE: memoryResult.memory.filter((a: any) => a.event === 'DELETE').length,
							NONE: memoryResult.memory.filter((a: any) => a.event === 'NONE').length,
						}
					: {},
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('ConversationSession: Memory extraction failed', {
				error: errorMessage,
			});
			// Don't throw error to avoid breaking the main conversation flow
		}
	}

	/**
	 * Extract comprehensive interaction data including tool calls and results
	 * This captures the complete technical workflow, not just user input and final response
	 */
	private extractComprehensiveInteractionData(userInput: string, aiResponse: string): string[] {
		const interactionData: string[] = [];

		// Start with the user input
		interactionData.push(`User: ${userInput}`);

		// Get recent messages from context manager to extract tool usage
		const recentMessages = this.contextManager.getRawMessages();

		// Find messages from this current interaction (after the user input)
		// We'll look for the most recent assistant and tool messages
		const currentInteractionMessages = [];
		let foundUserMessage = false;

		// Process messages in reverse to get the most recent interaction
		for (let i = recentMessages.length - 1; i >= 0; i--) {
			const message = recentMessages[i];

			if (!message) {
				continue;
			}

			// Skip if we haven't reached the current user message yet
			if (!foundUserMessage) {
				if (
					message.role === 'user' &&
					Array.isArray(message.content) &&
					message.content.length > 0 &&
					message.content[0] &&
					message.content[0].type === 'text' &&
					'text' in message.content[0] &&
					message.content[0].text === userInput
				) {
					foundUserMessage = true;
				}
				continue;
			}

			// Add messages from this interaction
			if (message.role === 'assistant' || message.role === 'tool') {
				currentInteractionMessages.unshift(message);
			} else {
				// Stop when we hit another user message (previous interaction)
				break;
			}
		}

		// Process the interaction messages to extract technical details
		const toolsUsed: string[] = [];
		const toolResults: string[] = [];

		for (const message of currentInteractionMessages) {
			if (!message) {
				continue;
			}

			if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
				// Extract tool calls
				for (const toolCall of message.toolCalls) {
					const toolName = toolCall.function.name;
					let args = '';
					try {
						const parsedArgs = JSON.parse(toolCall.function.arguments);
						// Summarize key arguments for memory (avoid storing full large content)
						const keyArgs = this.summarizeToolArguments(toolName, parsedArgs);
						args = keyArgs ? ` with ${keyArgs}` : '';
					} catch (e) {
						// If parsing fails, just note that there were arguments
						args = ' with arguments';
					}
					toolsUsed.push(`${toolName}${args}`);
				}
			} else if (message.role === 'tool') {
				// Extract tool results (summarized)
				const toolName = message.name || 'unknown_tool';
				const resultSummary = this.summarizeToolResult(toolName, message.content);
				toolResults.push(`${toolName}: ${resultSummary}`);
			}
		}

		// Add tool usage information to interaction data
		if (toolsUsed.length > 0) {
			interactionData.push(`Tools used: ${toolsUsed.join(', ')}`);
		}

		if (toolResults.length > 0) {
			interactionData.push(`Tool results: ${toolResults.join('; ')}`);
		}

		// Finally add the assistant response
		interactionData.push(`Assistant: ${aiResponse}`);

		logger.debug('ConversationSession: Extracted comprehensive interaction data', {
			userInput: userInput.substring(0, 50),
			toolsUsed: toolsUsed.length,
			toolResults: toolResults.length,
			totalDataPoints: interactionData.length,
		});

		return interactionData;
	}

	/**
	 * Summarize tool arguments for memory storage
	 */
	private summarizeToolArguments(toolName: string, args: any): string {
		switch (toolName) {
			case 'read_file':
				return args.path ? `path: ${args.path}` : 'file read';
			case 'write_file':
				return args.path ? `path: ${args.path}` : 'file write';
			case 'list_files':
				return args.path ? `directory: ${args.path}` : 'directory listing';
			case 'cipher_memory_search':
				return args.query
					? `query: "${args.query.substring(0, 50)}${args.query.length > 50 ? '...' : ''}"`
					: 'memory search';
			default:
				// For other tools, try to extract key identifying information
				if (args.query)
					return `query: "${args.query.substring(0, 30)}${args.query.length > 30 ? '...' : ''}"`;
				if (args.path) return `path: ${args.path}`;
				if (args.file) return `file: ${args.file}`;
				return 'arguments provided';
		}
	}

	/**
	 * Summarize tool results for memory storage
	 */
	private summarizeToolResult(toolName: string, content: any): string {
		try {
			// Handle string content
			if (typeof content === 'string') {
				const parsed = JSON.parse(content);
				return this.formatToolResultSummary(toolName, parsed);
			}

			// Handle object content
			if (typeof content === 'object') {
				return this.formatToolResultSummary(toolName, content);
			}

			return 'result received';
		} catch (e) {
			// If parsing fails, provide a basic summary
			const contentStr = String(content);
			return contentStr.length > 100 ? `${contentStr.substring(0, 100)}...` : contentStr;
		}
	}

	/**
	 * Format tool result summary based on tool type
	 */
	private formatToolResultSummary(toolName: string, result: any): string {
		switch (toolName) {
			case 'read_file':
				if (result.content && Array.isArray(result.content) && result.content.length > 0) {
					const text = result.content[0].text || '';
					const lines = text.split('\n').length;
					const size = text.length;
					return `file read (${lines} lines, ${size} chars)`;
				}
				return 'file read';

			case 'cipher_memory_search':
				if (result.results && Array.isArray(result.results)) {
					return `found ${result.results.length} memory entries`;
				}
				return 'memory search completed';

			case 'list_files':
				if (result.content && Array.isArray(result.content)) {
					const files = result.content.filter((item: any) => item.type === 'file').length;
					const dirs = result.content.filter((item: any) => item.type === 'directory').length;
					return `listed ${files} files, ${dirs} directories`;
				}
				return 'directory listing';

			default:
				// Generic result summary
				if (result.success !== undefined) {
					return result.success ? 'completed successfully' : 'failed';
				}
				if (result.error) {
					return `error: ${String(result.error).substring(0, 50)}`;
				}
				return 'completed';
		}
	}

	public getContextManager(): ContextManager {
		return this.contextManager;
	}

	public getLLMService(): ILLMService {
		return this.llmService;
	}

	public getUnifiedToolManager(): UnifiedToolManager {
		return this.services.unifiedToolManager;
	}
}
