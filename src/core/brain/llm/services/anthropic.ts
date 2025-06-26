import Anthropic from '@anthropic-ai/sdk';
import { ToolSet } from '../../../mcp/types.js';
import { MCPManager } from '../../../mcp/manager.js';
import { ContextManager } from '../messages/manager.js';
import { ImageData } from '../messages/types.js';
import { ILLMService, LLMServiceConfig } from './types.js';
import { logger } from '../../../logger/index.js';

export class AnthropicService implements ILLMService {
	private anthropic: Anthropic;
	private model: string;
	private mcpManager: MCPManager;
	private contextManager: ContextManager;
	private maxIterations: number;

	constructor(
		anthropic: Anthropic,
		model: string,
		mcpManager: MCPManager,
		contextManager: ContextManager,
		maxIterations: number = 5
	) {
		this.anthropic = anthropic;
		this.model = model;
		this.mcpManager = mcpManager;
		this.contextManager = contextManager;
		this.maxIterations = maxIterations;
	}

	async generate(userInput: string, imageData?: ImageData): Promise<string> {
		await this.contextManager.addUserMessage(userInput, imageData);
		const rawTools = await this.mcpManager.getAllTools();
		const formattedTools = this.formatToolsForAnthropic(rawTools);

		logger.silly(`Formatted tools: ${JSON.stringify(formattedTools, null, 2)}`);

		let iterationCount = 0;
		try {
			while (iterationCount < this.maxIterations) {
				iterationCount++;

				// Attempt to get a response, with retry logic
				const { response } = await this.getAIResponseWithRetries(formattedTools, userInput);

				// Extract text content and tool uses
				let textContent = '';
				const toolUses = [];

				for (const content of response.content) {
					if (content.type === 'text') {
						textContent += content.text;
					} else if (content.type === 'tool_use') {
						toolUses.push(content);
					}
				}

				// If there are no tool uses, we're done
				if (toolUses.length === 0) {
					// Add assistant message to history
					await this.contextManager.addAssistantMessage(textContent);
					return textContent;
				}

				// Transform tool uses into the format expected by ContextManager
				const formattedToolCalls = toolUses.map((toolUse: any) => ({
					id: toolUse.id,
					type: 'function' as const,
					function: {
						name: toolUse.name,
						arguments: JSON.stringify(toolUse.input),
					},
				}));

				// Add assistant message with tool calls to history
				await this.contextManager.addAssistantMessage(textContent, formattedToolCalls);

				// Handle tool uses
				for (const toolUse of toolUses) {
					logger.debug(`Tool call initiated: ${JSON.stringify(toolUse, null, 2)}`);
					const toolName = toolUse.name;
					const args = toolUse.input;
					const toolUseId = toolUse.id;

					// Execute tool
					try {
						const result = await this.mcpManager.executeTool(toolName, args);

						// Add tool result to message manager
						await this.contextManager.addToolResult(toolUseId, toolName, result);
					} catch (error) {
						// Handle tool execution error
						const errorMessage = error instanceof Error ? error.message : String(error);
						logger.error(`Tool execution error for ${toolName}: ${errorMessage}`);

						// Add error as tool result
						await this.contextManager.addToolResult(toolUseId, toolName, {
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
			logger.error(`Error in Anthropic service API call: ${errorMessage}`, { error });
			await this.contextManager.addAssistantMessage(`Error processing request: ${errorMessage}`);
			return `Error processing request: ${errorMessage}`;
		}
	}

	getAllTools(): Promise<ToolSet> {
		return this.mcpManager.getAllTools();
	}

	getConfig(): LLMServiceConfig {
		return {
			provider: 'anthropic',
			model: this.model,
		};
	}

	// Helper methods
	private async getAIResponseWithRetries(
		tools: any[],
		userInput: string
	): Promise<{ response: any }> {
		let attempts = 0;
		const MAX_ATTEMPTS = 3;

		// Add a log of the number of tools in response
		logger.debug(`Tools in response: ${tools.length}`);

		while (attempts < MAX_ATTEMPTS) {
			attempts++;
			try {
				// Use the new method that implements proper flow: get system prompt, compress history, format messages
				const formattedMessages = await this.contextManager.getFormattedMessage({
					role: 'user',
					content: userInput,
				});

				// For Anthropic, we need to separate system messages from the messages array
				const systemMessage = formattedMessages.find(msg => msg.role === 'system');
				const nonSystemMessages = formattedMessages.filter(msg => msg.role !== 'system');

				// Call Anthropic API
				const response = await this.anthropic.messages.create({
					model: this.model,
					messages: nonSystemMessages,
					...(systemMessage && { system: systemMessage.content }),
					tools: attempts === 1 ? tools : [], // Only offer tools on first attempt
					max_tokens: 4096,
				});

				logger.silly('ANTHROPIC MESSAGE RESPONSE: ', JSON.stringify(response, null, 2));

				if (!response || !response.content) {
					throw new Error('Received empty response from Anthropic API');
				}

				return { response };
			} catch (error) {
				const apiError = error as any;
				logger.error(
					`Error in Anthropic API call (Attempt ${attempts}/${MAX_ATTEMPTS}): ${apiError.message || JSON.stringify(apiError, null, 2)}`
				);

				if (
					apiError.error?.type === 'invalid_request_error' &&
					apiError.error?.message?.includes('maximum context length')
				) {
					logger.warn(
						`Context length exceeded. ContextManager compression might not be sufficient. Error details: ${JSON.stringify(apiError.error)}`
					);
				}

				if (attempts >= MAX_ATTEMPTS) {
					logger.error(`Failed to get response from Anthropic after ${MAX_ATTEMPTS} attempts.`);
					throw error;
				}

				await new Promise(resolve => setTimeout(resolve, 500 * attempts));
			}
		}

		throw new Error('Failed to get response after maximum retry attempts');
	}

	private formatToolsForAnthropic(tools: ToolSet): any[] {
		// Convert the ToolSet object to an array of tools in Anthropic's format
		return Object.entries(tools).map(([toolName, tool]) => {
			const input_schema: { type: string; properties: any; required: string[] } = {
				type: 'object',
				properties: {},
				required: [],
			};

			// Map tool parameters to JSON Schema format
			if (tool.parameters) {
				// The actual parameters structure appears to be a JSON Schema object
				const jsonSchemaParams = tool.parameters as any;

				if (jsonSchemaParams.type === 'object' && jsonSchemaParams.properties) {
					input_schema.properties = jsonSchemaParams.properties;
					if (Array.isArray(jsonSchemaParams.required)) {
						input_schema.required = jsonSchemaParams.required;
					}
				} else {
					logger.warn(`Unexpected parameters format for tool ${toolName}:`, jsonSchemaParams);
				}
			} else {
				// Handle case where tool might have no parameters
				logger.debug(`Tool ${toolName} has no defined parameters.`);
			}

			return {
				name: toolName,
				description: tool.description,
				input_schema: input_schema,
			};
		});
	}
}
