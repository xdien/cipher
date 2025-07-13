/**
 * Embedding Factory Module
 *
 * Factory functions for creating embedding instances with proper validation,
 * error handling, and type safety. Supports multiple providers and
 * configuration methods.
 *
 * @module embedding/factory
 */

import { logger } from '../../logger/index.js';
import {
	parseEmbeddingConfigFromEnv,
	validateEmbeddingConfig,
	type OpenAIEmbeddingConfig as ZodOpenAIEmbeddingConfig,
} from './config.js';
import {
	type Embedder,
	type OpenAIEmbeddingConfig as InterfaceOpenAIEmbeddingConfig,
	EmbeddingError,
	EmbeddingValidationError,
	OpenAIEmbedder,
} from './backend/index.js';
import { PROVIDER_TYPES, ERROR_MESSAGES, LOG_PREFIXES, DEFAULTS } from './constants.js';

// Use Zod-inferred types for validation, but convert to interface types for backend
export type BackendConfig = ZodOpenAIEmbeddingConfig;

/**
 * Embedding factory interface
 *
 * Defines the contract for embedding factory implementations.
 * Each provider should implement this interface.
 */
export interface EmbeddingFactory {
	/**
	 * Create an embedder instance
	 *
	 * @param config - Provider-specific configuration
	 * @returns Promise resolving to embedder instance
	 */
	createEmbedder(config: BackendConfig): Promise<Embedder>;

	/**
	 * Validate configuration for this provider
	 *
	 * @param config - Configuration to validate
	 * @returns True if configuration is valid
	 */
	validateConfig(config: unknown): boolean;

	/**
	 * Get the provider type this factory supports
	 *
	 * @returns Provider type string
	 */
	getProviderType(): string;
}

/**
 * Convert Zod config to interface config for backend compatibility
 */
function convertToInterfaceConfig(config: BackendConfig): InterfaceOpenAIEmbeddingConfig {
	return {
		type: PROVIDER_TYPES.OPENAI,
		apiKey: config.apiKey,
		model: config.model,
		baseUrl: config.baseUrl,
		timeout: config.timeout,
		maxRetries: config.maxRetries,
		options: config.options,
		organization: config.organization,
		dimensions: config.dimensions,
	} as InterfaceOpenAIEmbeddingConfig;
}

/**
 * OpenAI Embedding Factory
 *
 * Factory implementation for creating OpenAI embedding instances.
 */
class OpenAIEmbeddingFactory implements EmbeddingFactory {
	async createEmbedder(config: BackendConfig): Promise<Embedder> {
		logger.debug(`${LOG_PREFIXES.FACTORY} Creating OpenAI embedder`, {
			model: config.model,
			baseUrl: config.baseUrl,
			hasOrganization: !!config.organization,
		});

		try {
			// Convert Zod config to interface config for backend compatibility
			const interfaceConfig = convertToInterfaceConfig(config);
			const embedder = new OpenAIEmbedder(interfaceConfig);

			// Test the connection
			const isHealthy = await embedder.isHealthy();
			if (!isHealthy) {
				throw new EmbeddingError(ERROR_MESSAGES.CONNECTION_FAILED('OpenAI'), 'openai');
			}

			logger.info(`${LOG_PREFIXES.FACTORY} Successfully created OpenAI embedder`, {
				model: config.model,
				dimension: embedder.getDimension(),
			});

			return embedder;
		} catch (error) {
			logger.error(`${LOG_PREFIXES.FACTORY} Failed to create OpenAI embedder`, {
				error: error instanceof Error ? error.message : String(error),
				model: config.model,
			});

			if (error instanceof EmbeddingError) {
				throw error;
			}

			throw new EmbeddingError(
				`Failed to create OpenAI embedder: ${error instanceof Error ? error.message : String(error)}`,
				'openai',
				error instanceof Error ? error : undefined
			);
		}
	}

	validateConfig(config: unknown): boolean {
		try {
			const validationResult = validateEmbeddingConfig(config);
			return validationResult.success && validationResult.data?.type === PROVIDER_TYPES.OPENAI;
		} catch {
			return false;
		}
	}

	getProviderType(): string {
		return PROVIDER_TYPES.OPENAI;
	}
}

/**
 * Registry of embedding factories
 */
const EMBEDDING_FACTORIES = new Map<string, EmbeddingFactory>([
	[PROVIDER_TYPES.OPENAI, new OpenAIEmbeddingFactory()],
]);

/**
 * Main factory function for creating embedding instances
 *
 * @param config - Embedding configuration
 * @returns Promise resolving to embedder instance
 * @throws {EmbeddingValidationError} If configuration is invalid
 * @throws {EmbeddingError} If embedder creation fails
 *
 * @example
 * ```typescript
 * const embedder = await createEmbedder({
 *   type: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'text-embedding-3-small'
 * });
 * ```
 */
export async function createEmbedder(config: BackendConfig): Promise<Embedder> {
	logger.debug(`${LOG_PREFIXES.FACTORY} Creating embedder`, {
		type: config.type,
	});

	// Validate configuration
	const validationResult = validateEmbeddingConfig(config);
	if (!validationResult.success) {
		const errorMessage =
			validationResult.errors?.issues
				.map(issue => `${issue.path.join('.')}: ${issue.message}`)
				.join(', ') || 'Invalid configuration';

		logger.error(`${LOG_PREFIXES.FACTORY} Configuration validation failed`, {
			type: config.type,
			errors: errorMessage,
		});

		throw new EmbeddingValidationError(`Configuration validation failed: ${errorMessage}`);
	}

	// Get factory for provider type
	const factory = EMBEDDING_FACTORIES.get(config.type);
	if (!factory) {
		logger.error(`${LOG_PREFIXES.FACTORY} Unsupported provider type`, {
			type: config.type,
			supportedTypes: Array.from(EMBEDDING_FACTORIES.keys()),
		});

		throw new EmbeddingValidationError(ERROR_MESSAGES.PROVIDER_NOT_SUPPORTED(config.type));
	}

	// Create embedder instance
	return await factory.createEmbedder(config);
}

/**
 * Create OpenAI embedder with simplified configuration
 *
 * @param config - OpenAI-specific configuration
 * @returns Promise resolving to OpenAI embedder instance
 *
 * @example
 * ```typescript
 * const embedder = await createOpenAIEmbedder({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'text-embedding-3-small'
 * });
 * ```
 */
export async function createOpenAIEmbedder(
	config: Omit<ZodOpenAIEmbeddingConfig, 'type'>
): Promise<Embedder> {
	const openaiConfig: ZodOpenAIEmbeddingConfig = {
		type: PROVIDER_TYPES.OPENAI,
		apiKey: config.apiKey || '',
		model: config.model || DEFAULTS.OPENAI_MODEL,
		baseUrl: config.baseUrl || DEFAULTS.OPENAI_BASE_URL,
		timeout: config.timeout || DEFAULTS.TIMEOUT,
		maxRetries: config.maxRetries || DEFAULTS.MAX_RETRIES,
		...(config.organization && { organization: config.organization }),
		...(config.dimensions && { dimensions: config.dimensions }),
		...(config.options && { options: config.options }),
	};
	return createEmbedder(openaiConfig);
}

/**
 * Create embedder from environment variables
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns Promise resolving to embedder instance or null if config unavailable
 *
 * @example
 * ```typescript
 * // Requires OPENAI_API_KEY environment variable
 * const embedder = await createEmbedderFromEnv();
 * if (embedder) {
 *   const embedding = await embedder.embed('Hello world');
 * }
 * ```
 */
export async function createEmbedderFromEnv(
	env: Record<string, string | undefined> = process.env
): Promise<Embedder | null> {
	logger.debug(`${LOG_PREFIXES.FACTORY} Creating embedder from environment variables`);

	const config = parseEmbeddingConfigFromEnv(env);
	if (!config) {
		logger.warn(`${LOG_PREFIXES.FACTORY} No valid embedding configuration found in environment`);
		return null;
	}

	logger.debug(`${LOG_PREFIXES.FACTORY} Found valid embedding configuration in environment`, {
		type: config.type,
		model: config.model,
	});

	return createEmbedder(config as ZodOpenAIEmbeddingConfig);
}

/**
 * Create a default embedder with minimal configuration
 *
 * Uses OpenAI provider with default settings.
 * Requires OPENAI_API_KEY environment variable.
 *
 * @returns Promise resolving to default embedder instance
 * @throws {EmbeddingValidationError} If API key is not available
 *
 * @example
 * ```typescript
 * // Requires OPENAI_API_KEY environment variable
 * const embedder = await createDefaultEmbedder();
 * ```
 */
export async function createDefaultEmbedder(): Promise<Embedder> {
	logger.debug(`${LOG_PREFIXES.FACTORY} Creating default embedder`);

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new EmbeddingValidationError(ERROR_MESSAGES.API_KEY_REQUIRED('OpenAI'));
	}

	const openaiConfig: ZodOpenAIEmbeddingConfig = {
		type: PROVIDER_TYPES.OPENAI,
		apiKey,
		model: DEFAULTS.OPENAI_MODEL,
		baseUrl: DEFAULTS.OPENAI_BASE_URL,
		timeout: DEFAULTS.TIMEOUT,
		maxRetries: DEFAULTS.MAX_RETRIES,
	};
	return createEmbedder(openaiConfig);
}

/**
 * Check if a factory exists for the given provider type
 *
 * @param providerType - Provider type to check
 * @returns True if factory exists
 */
export function isEmbeddingFactory(providerType: string): boolean {
	return EMBEDDING_FACTORIES.has(providerType);
}

/**
 * Get all supported provider types
 *
 * @returns Array of supported provider type strings
 */
export function getSupportedProviders(): string[] {
	return Array.from(EMBEDDING_FACTORIES.keys());
}

/**
 * Get factory instance for a specific provider type
 *
 * @param providerType - Provider type
 * @returns Factory instance or undefined if not found
 */
export function getEmbeddingFactory(providerType: string): EmbeddingFactory | undefined {
	return EMBEDDING_FACTORIES.get(providerType);
}

/**
 * Register a new embedding factory
 *
 * @param providerType - Provider type
 * @param factory - Factory instance
 */
export function registerEmbeddingFactory(providerType: string, factory: EmbeddingFactory): void {
	logger.debug(`${LOG_PREFIXES.FACTORY} Registering embedding factory`, {
		providerType,
	});

	EMBEDDING_FACTORIES.set(providerType, factory);
}
