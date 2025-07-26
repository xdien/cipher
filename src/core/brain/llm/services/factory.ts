import { MCPManager } from '../../../mcp/manager.js';
import { UnifiedToolManager } from '../../tools/unified-tool-manager.js';
import { ContextManager } from '../messages/manager.js';
import { LLMConfig } from '../config.js';
import { ILLMService } from './types.js';
import { env } from '../../../env.js';
import { logger } from '../../../logger/index.js';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { OpenRouterService } from './openrouter.js';
import { OllamaService } from './ollama.js';
import { QwenService, QwenOptions } from './qwen.js';

function extractApiKey(config: LLMConfig): string {
	const provider = config.provider.toLowerCase();

	// Ollama doesn't require an API key since it's a local service
	if (provider === 'ollama') {
		return 'not-required';
	}

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

	// Provider-specific defaults and environment fallbacks
	const provider = llmConfig.provider.toLowerCase();

	if (provider === 'openrouter') {
		return 'https://openrouter.ai/api/v1';
	}

	if (provider === 'ollama') {
		// Use environment variable if set, otherwise default to localhost:11434
		return env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
	}

	// Check for environment variable as fallback for OpenAI
	if (provider === 'openai' && env.OPENAI_BASE_URL) {
		return env.OPENAI_BASE_URL.replace(/\/$/, '');
	}

	return '';
}

function _createLLMService(
	config: LLMConfig,
	mcpManager: MCPManager,
	contextManager: ContextManager,
	unifiedToolManager?: UnifiedToolManager
): ILLMService {
	// Extract and validate API key
	const apiKey = extractApiKey(config);

	switch (config.provider.toLowerCase()) {
		case 'openai': {
			const baseURL = getOpenAICompatibleBaseURL(config);
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const OpenAIClass = require('openai');
			const openai = new OpenAIClass({ apiKey, ...(baseURL ? { baseURL } : {}) });
			return new OpenAIService(
				openai,
				config.model,
				mcpManager,
				contextManager,
				config.maxIterations,
				unifiedToolManager
			);
		}
		case 'openrouter': {
			const baseURL = getOpenAICompatibleBaseURL(config);
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const OpenAIClass = require('openai');
			const openai = new OpenAIClass({
				apiKey,
				baseURL,
				defaultHeaders: {
					'HTTP-Referer': 'https://github.com/byterover/cipher',
					'X-Title': 'Cipher Memory Agent',
				},
			});
			return new OpenRouterService(
				openai,
				config.model,
				mcpManager,
				contextManager,
				config.maxIterations,
				unifiedToolManager
			);
		}
		case 'anthropic': {
			// Use require for Anthropic SDK for compatibility
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const AnthropicClass = require('@anthropic-ai/sdk');
			const anthropic = new AnthropicClass({ apiKey });
			return new AnthropicService(
				anthropic,
				config.model,
				mcpManager,
				contextManager,
				config.maxIterations,
				unifiedToolManager
			);
		}
		case 'ollama': {
			const baseURL = getOpenAICompatibleBaseURL(config);
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const OpenAIClass = require('openai');
			// Ollama uses OpenAI-compatible API but runs locally
			const openai = new OpenAIClass({
				apiKey: 'not-required', // Ollama doesn't require an API key
				baseURL,
			});
			return new OllamaService(
				openai,
				config.model,
				mcpManager,
				contextManager,
				config.maxIterations,
				unifiedToolManager
			);
		}
		case 'qwen': {
			// QwenService: OpenAI-compatible endpoint for Alibaba Cloud Qwen
			// Accepts Qwen-specific options via config.qwenOptions
			// Default endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
			const baseURL = config.baseURL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
			// Use require for OpenAI SDK for compatibility
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const OpenAIClass = require('openai');
			const openai = new OpenAIClass({ apiKey, baseURL });
			const qwenOptions: QwenOptions = config.qwenOptions || {};
			return new QwenService(
				openai,
				config.model,
				mcpManager,
				contextManager,
				config.maxIterations,
				qwenOptions,
				unifiedToolManager
			);
		}
		default:
			throw new Error(`Unsupported LLM provider: ${config.provider}`);
	}
}

export function createLLMService(
	config: LLMConfig,
	mcpManager: MCPManager,
	contextManager: ContextManager,
	unifiedToolManager?: UnifiedToolManager
): ILLMService {
	return _createLLMService(config, mcpManager, contextManager, unifiedToolManager);
}
