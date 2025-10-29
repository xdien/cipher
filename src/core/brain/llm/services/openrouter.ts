import { ToolSet } from '../../../mcp/types.js';
import { MCPManager } from '../../../mcp/manager.js';
import { UnifiedToolManager, CombinedToolSet } from '../../tools/unified-tool-manager.js';
import { ContextManager } from '../messages/manager.js';
import { ImageData } from '../messages/types.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import OpenAI from 'openai';
import { logger } from '../../../logger/index.js';
import { formatToolResult } from '../utils/tool-result-formatter.js';
import { EventManager } from '../../../events/event-manager.js';
import { SessionEvents } from '../../../events/event-types.js';
import { v4 as uuidv4 } from 'uuid';

export class OpenRouterService implements ILLMService {
	private client: OpenAI;
	private model: string;
	private fallbackModels: string[];
	private mcpManager: MCPManager;
	private unifiedToolManager: UnifiedToolManager | undefined;
	private contextManager: ContextManager;
	private maxIterations: number;
	private eventManager?: EventManager;

	constructor(
		client: OpenAI,
		model: string,
		mcpManager: MCPManager,
		contextManager: ContextManager,
		maxIterations: number = 5,
		unifiedToolManager?: UnifiedToolManager,
		fallbackModels: string[] = []
	) {
		this.client = client;
		this.model = model;
		this.fallbackModels = fallbackModels;
		this.mcpManager = mcpManager;
		this.unifiedToolManager = unifiedToolManager;
		this.contextManager = contextManager;
		this.maxIterations = maxIterations;
	}

	setEventManager(eventManager: EventManager): void {
		this.eventManager = eventManager;
	}

	async generate(userInput: string, imageData?: ImageData): Promise<string> {
		await this.contextManager.addUserMessage(userInput, imageData);

		const messageId = uuidv4();
		const startTime = Date.now();

		// Try to get sessionId from contextManager if available, otherwise undefined
		const sessionId = (this.contextManager as any)?.sessionId;

		// Emit LLM response started event
		if (this.eventManager && sessionId) {
			this.eventManager.emitSessionEvent(sessionId, SessionEvents.LLM_RESPONSE_STARTED, {
				sessionId,
				messageId,
				model: this.model,
				timestamp: startTime,
			});
		}

		// Use unified tool manager if available, otherwise fall back to MCP manager
		let formattedTools: any[];
		if (this.unifiedToolManager) {
			formattedTools = await this.unifiedToolManager.getToolsForProvider('openrouter');
		} else {
			const rawTools = await this.mcpManager.getAllTools();
			formattedTools = this.formatToolsForOpenRouter(rawTools);
		}

		logger.silly(`Formatted tools for OpenRouter: ${JSON.stringify(formattedTools, null, 2)}`);

		let iterationCount = 0;
		try {
			while (iterationCount < this.maxIterations) {
				iterationCount++;

				// Attempt to get a response, with retry logic
				const { message } = await this.getAIResponseWithRetries(formattedTools, userInput);

				// If there are no tool calls, we're done
				if (!message.tool_calls || message.tool_calls.length === 0) {
					const responseText = message.content || '';
					// Add assistant message to history
					await this.contextManager.addAssistantMessage(responseText);

					// Emit LLM response completed event
					if (this.eventManager && sessionId) {
						this.eventManager.emitSessionEvent(sessionId, SessionEvents.LLM_RESPONSE_COMPLETED, {
							sessionId,
							messageId,
							model: this.model,
							duration: Date.now() - startTime,
							timestamp: Date.now(),
							response: responseText,
						});
					}

					return responseText;
				}

				// Log thinking steps when assistant provides reasoning before tool calls
				if (message.content && message.content.trim()) {
					logger.info(`💭 ${message.content.trim()}`);

					// Emit thinking event
					if (this.eventManager && sessionId) {
						this.eventManager.emitSessionEvent(sessionId, SessionEvents.LLM_THINKING, {
							sessionId,
							messageId,
							timestamp: Date.now(),
						});
					}
				}

				// Add assistant message with tool calls to history
				await this.contextManager.addAssistantMessage(message.content, message.tool_calls);

				// Handle tool calls
				for (const toolCall of message.tool_calls) {
					logger.debug(`OpenRouter tool call initiated: ${JSON.stringify(toolCall, null, 2)}`);
					logger.info(`🔧 Using tool: ${toolCall.function.name}`);
					const toolName = toolCall.function.name;
					let args: any = {};

					try {
						args = JSON.parse(toolCall.function.arguments);
					} catch (e) {
						logger.error(`Error parsing arguments for ${toolName}:`, e);
						await this.contextManager.addToolResult(toolCall.id, toolName, {
							error: `Failed to parse arguments: ${e}`,
						});
						continue;
					}

					// Execute tool
					try {
						let result: any;
						if (this.unifiedToolManager) {
							result = await this.unifiedToolManager.executeTool(toolName, args, sessionId);
						} else {
							result = await this.mcpManager.executeTool(toolName, args);
						}

						// Display formatted tool result
						const formattedResult = formatToolResult(toolName, result);
						logger.info(`📋 Tool Result:\n${formattedResult}`);

						// Add tool result to message manager
						await this.contextManager.addToolResult(toolCall.id, toolName, result);
					} catch (error) {
						// Handle tool execution error
						const errorMessage = error instanceof Error ? error.message : String(error);
						logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);

						// Add error as tool result
						await this.contextManager.addToolResult(toolCall.id, toolName, {
							error: errorMessage,
						});
					}
				}
			}

			// If we reached max iterations, return a message
			logger.warn(`Reached maximum iterations (${this.maxIterations}) for task.`);
			const finalResponse = 'Task completed but reached maximum tool call iterations.';
			await this.contextManager.addAssistantMessage(finalResponse);
			return finalResponse;
		} catch (error) {
			// Handle API errors
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error(`Error in OpenRouter service API call: ${errorMessage}`, { error });
			await this.contextManager.addAssistantMessage(`Error processing request: ${errorMessage}`);
			return `Error processing request: ${errorMessage}`;
		}
	}

	/**
	 * Direct generate method that bypasses conversation context
	 * Used for internal tool operations that shouldn't pollute conversation history
	 * @param userInput - The input to generate a response for
	 * @param systemPrompt - Optional system prompt to use
	 * @returns Promise<string> - The generated response
	 */
	async directGenerate(userInput: string, systemPrompt?: string): Promise<string> {
		try {
			logger.debug('OpenRouterService: Direct generate call (bypassing conversation context)', {
				inputLength: userInput.length,
				hasSystemPrompt: !!systemPrompt,
			});

			// Create a minimal message array for direct API call
			const messages: any[] = [];

			if (systemPrompt) {
				messages.push({
					role: 'system',
					content: systemPrompt,
				});
			}

			messages.push({
				role: 'user',
				content: userInput,
			});

			// Use OpenRouter's native fallback with models parameter
			const requestConfig: any = {
				model: this.model,
				messages: messages,
				// No tools for direct calls - this is for simple text generation
			};

			// Add fallback models if available (OpenRouter native fallback)
			if (this.fallbackModels.length > 0) {
				requestConfig.models = this.fallbackModels;
				logger.debug(`Direct generate using OpenRouter native fallback with models: ${this.fallbackModels.join(', ')}`);
			}

			// Make direct API call with native fallback support
			const response = await this.client.chat.completions.create(requestConfig);

			const responseText = response.choices[0]?.message?.content || '';

			// Log which model was actually used (OpenRouter returns this in response)
			const usedModel = response.model || this.model;
			if (usedModel !== this.model) {
				logger.info(`Direct generate used fallback model: ${usedModel}`);
			} else {
				logger.debug(`Direct generate used primary model: ${usedModel}`);
			}

			logger.debug('OpenRouterService: Direct generate completed', {
				responseLength: responseText.length,
				usedModel: usedModel,
			});

			return responseText;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('OpenRouterService: Direct generate failed', {
				error: errorMessage,
				inputLength: userInput.length,
			});
			throw new Error(`Direct generate failed: ${errorMessage}`);
		}
	}

	async getAllTools(): Promise<ToolSet | CombinedToolSet> {
		if (this.unifiedToolManager) {
			return await this.unifiedToolManager.getAllTools();
		}
		return this.mcpManager.getAllTools();
	}

	getConfig(): LLMServiceConfig {
		return {
			provider: 'openrouter',
			model: this.model,
		};
	}

	// Helper methods
	private async getAIResponseWithRetries(
		tools: any[],
		userInput: string
	): Promise<{ message: any }> {
		let attempts = 0;
		const MAX_ATTEMPTS = 3;

		// Add a log of the number of tools in response
		logger.debug(`Tools in OpenRouter response: ${tools.length}`);
		
		// Use OpenRouter's native fallback with models parameter
		const requestConfig: any = {
			model: this.model,
			messages: await this.contextManager.getFormattedMessage({
				role: 'user',
				content: userInput,
			}),
			tools: tools,
			tool_choice: 'auto',
		};

		// Add fallback models if available (OpenRouter native fallback)
		if (this.fallbackModels.length > 0) {
			requestConfig.models = this.fallbackModels;
			logger.debug(`Using OpenRouter native fallback with models: ${this.fallbackModels.join(', ')}`);
		}

		while (attempts < MAX_ATTEMPTS) {
			attempts++;
			
			try {
				logger.debug(`OpenRouter API call (attempt ${attempts}/${MAX_ATTEMPTS})`);
				
				// Call OpenRouter API with native fallback support
				const response = await this.client.chat.completions.create(requestConfig);

				logger.silly('OPENROUTER CHAT COMPLETION RESPONSE: ', JSON.stringify(response, null, 2));

				// Get the response message
				const message = response.choices[0]?.message;
				if (!message) {
					throw new Error('Received empty message from OpenRouter API');
				}

				// Log which model was actually used (OpenRouter returns this in response)
				const usedModel = response.model || this.model;
				if (usedModel !== this.model) {
					logger.info(`OpenRouter used fallback model: ${usedModel}`);
				} else {
					logger.debug(`OpenRouter used primary model: ${usedModel}`);
				}

				return { message };
			} catch (error) {
				const apiError = error as any;
				logger.error(
					`Error in OpenRouter API call (Attempt ${attempts}/${MAX_ATTEMPTS}): ${apiError.message || JSON.stringify(apiError, null, 2)}`,
					{ status: apiError.status, headers: apiError.headers }
				);

				if (apiError.status === 400 && apiError.error?.code === 'context_length_exceeded') {
					logger.warn(
						`Context length exceeded. ContextManager compression might not be sufficient. Error details: ${JSON.stringify(apiError.error)}`
					);
				}

				if (attempts >= MAX_ATTEMPTS) {
					logger.error(`Failed to get response from OpenRouter after ${MAX_ATTEMPTS} attempts.`);
					throw error;
				}

				// Wait before retrying (OpenRouter handles model fallback, we only retry on network errors)
				await new Promise(resolve => setTimeout(resolve, 500 * attempts));
			}
		}

		throw new Error('Failed to get response after maximum retry attempts');
	}

	private formatToolsForOpenRouter(tools: ToolSet): any[] {
		// OpenRouter uses the same format as OpenAI for tools
		// Convert the ToolSet object to an array of tools in OpenAI's format
		return Object.entries(tools).map(([name, tool]) => {
			return {
				type: 'function',
				function: {
					name,
					description: tool.description,
					parameters: tool.parameters,
				},
			};
		});
	}
}
