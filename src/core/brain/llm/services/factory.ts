import { MCPManager } from '../../../mcp/manager.js';
import { UnifiedToolManager } from '../../tools/unified-tool-manager.js';
import { ContextManager } from '../messages/manager.js';
import { LLMConfig } from '../config.js';
import { ILLMService } from './types.js';
import { env } from '../../../env.js';
import OpenAI from 'openai';
import { logger } from '../../../logger/index.js';
import Anthropic from '@anthropic-ai/sdk';
import { OpenAIService } from './openai.js';
import { AnthropicService } from './anthropic.js';
import { OpenRouterService } from './openrouter.js';
import { OllamaService } from './ollama.js';

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
			// This will correctly handle both cases:
			// 1. When baseURL is set, it will be included in the options
			// 2. When baseURL is undefined/null/empty, the spread operator won't add the baseURL property
			const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
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
			// OpenRouter uses OpenAI-compatible API but with specific headers
			const openai = new OpenAI({
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
			const anthropic = new Anthropic({ apiKey });
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
			// Ollama uses OpenAI-compatible API but runs locally
			const openai = new OpenAI({
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
	const service = _createLLMService(config, mcpManager, contextManager, unifiedToolManager);
	// Configure token-aware compression for the context manager
	configureCompressionForService(config, contextManager);

	return service;
}

/**
 * Configure compression settings for the context manager based on LLM config
 */
async function configureCompressionForService(
	config: LLMConfig,
	contextManager: ContextManager
): Promise<void> {
	try {
		// Extract provider and model info
		const provider = config.provider.toLowerCase();
		const model = config.model;

		// Get context window size from defaults since it's not in config
		const contextWindow = getDefaultContextWindow(provider, model);

		// Configure compression asynchronously to avoid blocking service creation
		setImmediate(async () => {
			try {
				await contextManager.configureCompression(provider, model, contextWindow);
				logger.debug('Token-aware compression configured for LLM service', {
					provider,
					model,
					contextWindow,
				});
			} catch (error) {
				logger.warn('Failed to configure compression for LLM service', {
					error: (error as Error).message,
					provider,
					model,
				});
			}
		});
	} catch (error) {
		logger.error('Error in compression configuration', { error });
	}
}

/**
 * Get default context window size for provider/model combinations
 */
function getDefaultContextWindow(provider: string, model?: string): number {
	const defaults: Record<string, Record<string, number>> = {
		openai: {
			'gpt-3.5-turbo': 16385,
			'gpt-4': 8192,
			'gpt-4-32k': 32768,
			'gpt-4-turbo': 128000,
			'gpt-4o': 128000,
			'gpt-4o-mini': 128000,
			'o1-preview': 128000,
			'o1-mini': 128000,
			default: 8192,
		},
		anthropic: {
			'claude-3-opus': 200000,
			'claude-3-sonnet': 200000,
			'claude-3-haiku': 200000,
			'claude-3-5-sonnet': 200000,
			'claude-2.1': 200000,
			'claude-2.0': 100000,
			'claude-instant-1.2': 100000,
			default: 200000,
		},
		google: {
			'gemini-pro': 32760,
			'gemini-pro-vision': 16384,
			'gemini-ultra': 32760,
			'gemini-1.5-pro': 1000000,
			'gemini-1.5-flash': 1000000,
			default: 32760,
		},
		ollama: {
			default: 8192, // Conservative default for local models
		},
		openrouter: {
			default: 8192, // Varies by model, conservative default
		},
	};

	const providerDefaults = defaults[provider];
	if (!providerDefaults) {
		return 8192; // Global fallback
	}

	return providerDefaults[model || 'default'] || providerDefaults.default || 8192;
}
