import { MCPManager } from '../../../mcp/manager.js';
import { ContextManager } from '../messages/manager.js';
import { LLMConfig } from '../types.js';
import { ILLMService } from './types.js';
import OpenAI from 'openai';
import { logger } from '../../../logger/index.js';
import Anthropic from '@anthropic-ai/sdk';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';

function extractApiKey(config: LLMConfig): string {
	const provider = config.provider;

	// Get API key from config (already expanded)
	let apiKey = config.apiKey || '';

	if (!apiKey) {
		const errorMsg = `Error: API key for ${provider} not found`;
		logger.error(errorMsg);
		logger.error(`Please set your ${provider} API key in the config file or .env file`);
		throw new Error(errorMsg);
	}
	logger.debug('Verified API key');
	return apiKey;
}

function getOpenAICompatibleBaseURL(llmConfig: LLMConfig): string {
	if (llmConfig.baseURL) {
		return llmConfig.baseURL.replace(/\/$/, '');
	}
	// Check for environment variable as fallback
	if (process.env.OPENAI_BASE_URL) {
		return process.env.OPENAI_BASE_URL.replace(/\/$/, '');
	}
	return '';
}

function _createLLMService(
	config: LLMConfig,
	mcpManager: MCPManager,
	contextManager: ContextManager
): ILLMService {
	// Extract and validate API key
	const apiKey = extractApiKey(config);

	switch (config.provider.toLowerCase()) {
		case 'openai': {
			const baseURL = getOpenAICompatibleBaseURL(config);
			// This will correctly handle both cases:
			// 1. When baseURL is set, it will be included in the options
			// 2. When baseURL is undefined/null/empty, the spread operator won't add the baseURL property
			const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
			return new OpenAIService(
				openai,
				config.model,
				mcpManager,
				contextManager,
				config.maxIterations
			);
		}
		case 'anthropic': {
			const anthropic = new Anthropic({ apiKey });
			return new AnthropicService(
				anthropic,
				config.model,
				mcpManager,
				contextManager,
				config.maxIterations
			);
		}
		default:
			throw new Error(`Unsupported LLM provider: ${config.provider}`);
	}
}

export function createLLMService(
	config: LLMConfig,
	mcpManager: MCPManager,
	contextManager: ContextManager
): ILLMService {
	return _createLLMService(config, mcpManager, contextManager);
}
