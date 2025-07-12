/**
 * Embedding Configuration Module
 *
 * Defines the configuration schemas for the embedding system using Zod for
 * runtime validation and type safety. Supports multiple embedding providers
 * with different configuration requirements.
 *
 * @module embedding/config
 */

import { z } from 'zod';
import { DEFAULTS, OPENAI_MODELS, PROVIDER_TYPES, ENV_VARS } from './constants.js';

/**
 * Base Embedding Configuration Schema
 *
 * Common configuration options shared by all embedding providers.
 * These options control model selection, timeouts, and retry behavior.
 */
const BaseEmbeddingSchema = z.object({
	/** API key for the provider (required for all providers) */
	apiKey: z.string().min(1).describe('API key for the embedding provider'),

	/** Model name to use for embeddings */
	model: z.string().min(1).optional().describe('Model name for embeddings'),

	/** Base URL for the provider API */
	baseUrl: z.string().url().optional().describe('Base URL for the provider API'),

	/** Request timeout in milliseconds */
	timeout: z
		.number()
		.int()
		.positive()
		.max(300000) // 5 minutes max
		.default(DEFAULTS.TIMEOUT)
		.describe('Request timeout in milliseconds'),

	/** Maximum number of retry attempts */
	maxRetries: z
		.number()
		.int()
		.min(0)
		.max(10)
		.default(DEFAULTS.MAX_RETRIES)
		.describe('Maximum retry attempts'),

	/** Provider-specific options */
	options: z.record(z.any()).optional().describe('Provider-specific configuration options'),
});

/**
 * OpenAI Embedding Configuration Schema
 *
 * Configuration specific to OpenAI embedding services.
 * Supports all OpenAI embedding models with validation.
 *
 * @example
 * ```typescript
 * const config: OpenAIEmbeddingConfig = {
 *   type: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'text-embedding-3-small'
 * };
 * ```
 */
const OpenAIEmbeddingSchema = BaseEmbeddingSchema.extend({
	type: z.literal(PROVIDER_TYPES.OPENAI),

	/** OpenAI embedding model */
	model: z
		.enum([
			OPENAI_MODELS.TEXT_EMBEDDING_3_SMALL,
			OPENAI_MODELS.TEXT_EMBEDDING_3_LARGE,
			OPENAI_MODELS.TEXT_EMBEDDING_ADA_002,
		] as const)
		.default(DEFAULTS.OPENAI_MODEL)
		.describe('OpenAI embedding model'),

	/** OpenAI organization ID */
	organization: z.string().optional().describe('OpenAI organization ID'),

	/** Custom dimensions for embedding-3 models */
	dimensions: z
		.number()
		.int()
		.positive()
		.max(3072)
		.optional()
		.describe('Custom embedding dimensions (embedding-3 models only)'),

	/** Base URL override */
	baseUrl: z.string().url().default(DEFAULTS.OPENAI_BASE_URL).describe('OpenAI API base URL'),
}).strict();

export type OpenAIEmbeddingConfig = z.infer<typeof OpenAIEmbeddingSchema>;

/**
 * Backend Configuration Union Schema
 *
 * Discriminated union of all supported embedding provider configurations.
 * Uses the 'type' field to determine which configuration schema to apply.
 */
const BackendConfigSchema = z
	.discriminatedUnion('type', [OpenAIEmbeddingSchema], {
		errorMap: (issue, ctx) => {
			if (issue.code === z.ZodIssueCode.invalid_union_discriminator) {
				return {
					message: `Invalid embedding provider type. Expected: ${Object.values(PROVIDER_TYPES).join(', ')}.`,
				};
			}
			return { message: ctx.defaultError };
		},
	})
	.describe('Backend configuration for embedding system')
	.superRefine((data, ctx) => {
		// Validate OpenAI-specific requirements
		if (data.type === PROVIDER_TYPES.OPENAI) {
			// Check if dimensions are specified for models that support it
			if (data.dimensions) {
				const supportsCustomDimensions =
					data.model === OPENAI_MODELS.TEXT_EMBEDDING_3_SMALL ||
					data.model === OPENAI_MODELS.TEXT_EMBEDDING_3_LARGE;

				if (!supportsCustomDimensions) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `Custom dimensions are only supported for embedding-3 models`,
						path: ['dimensions'],
					});
				}

				// Validate dimension range for specific models
				if (data.model === OPENAI_MODELS.TEXT_EMBEDDING_3_SMALL && data.dimensions > 1536) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: `text-embedding-3-small supports max 1536 dimensions`,
						path: ['dimensions'],
					});
				}
			}
		}

		// Validate API key format (basic checks)
		if (data.apiKey) {
			if (data.type === PROVIDER_TYPES.OPENAI && !data.apiKey.startsWith('sk-')) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'OpenAI API key should start with "sk-"',
					path: ['apiKey'],
				});
			}
		}
	});

export type BackendConfig = z.infer<typeof BackendConfigSchema>;

/**
 * Embedding System Configuration Schema
 *
 * Top-level configuration for the embedding system.
 * Uses a single backend configuration.
 */
export const EmbeddingConfigSchema = BackendConfigSchema;

export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

/**
 * Environment-based Configuration Schema
 *
 * Allows configuration to be loaded from environment variables.
 * Useful for deployment scenarios where config is provided via env vars.
 */
export const EmbeddingEnvConfigSchema = z.object({
	/** Provider type from environment */
	type: z
		.enum([PROVIDER_TYPES.OPENAI] as const)
		.default(PROVIDER_TYPES.OPENAI)
		.describe('Embedding provider type'),

	/** API key from environment variables */
	apiKey: z.string().optional().describe('API key from environment variables'),

	/** Model from environment */
	model: z.string().optional().describe('Model name from environment'),

	/** Base URL from environment */
	baseUrl: z.string().url().optional().describe('Base URL from environment'),

	/** Timeout from environment */
	timeout: z
		.string()
		.transform(val => parseInt(val, 10))
		.pipe(z.number().int().positive())
		.optional()
		.describe('Timeout from environment (string converted to number)'),

	/** Max retries from environment */
	maxRetries: z
		.string()
		.transform(val => parseInt(val, 10))
		.pipe(z.number().int().min(0).max(10))
		.optional()
		.describe('Max retries from environment (string converted to number)'),
});

export type EmbeddingEnvConfig = z.infer<typeof EmbeddingEnvConfigSchema>;

/**
 * Parse and validate embedding configuration
 *
 * @param config - Raw configuration object
 * @returns Validated configuration
 * @throws {z.ZodError} If configuration is invalid
 */
export function parseEmbeddingConfig(config: unknown): EmbeddingConfig {
	return EmbeddingConfigSchema.parse(config);
}

/**
 * Parse embedding configuration from environment variables
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns Validated configuration or null if required env vars are missing
 */
export function parseEmbeddingConfigFromEnv(
	env: Record<string, string | undefined> = process.env
): EmbeddingConfig | null {
	try {
		// Try to build config from environment variables
		const rawConfig: any = {
			type: env[ENV_VARS.EMBEDDING_MODEL] ? PROVIDER_TYPES.OPENAI : PROVIDER_TYPES.OPENAI,
		};

		// Add OpenAI-specific config
		if (env[ENV_VARS.OPENAI_API_KEY]) {
			rawConfig.apiKey = env[ENV_VARS.OPENAI_API_KEY];
		} else {
			// No API key found, cannot create config
			return null;
		}

		if (env[ENV_VARS.EMBEDDING_MODEL]) {
			rawConfig.model = env[ENV_VARS.EMBEDDING_MODEL];
		}

		if (env[ENV_VARS.OPENAI_BASE_URL]) {
			rawConfig.baseUrl = env[ENV_VARS.OPENAI_BASE_URL];
		}

		if (env[ENV_VARS.OPENAI_ORG_ID]) {
			rawConfig.organization = env[ENV_VARS.OPENAI_ORG_ID];
		}

		if (env[ENV_VARS.EMBEDDING_TIMEOUT]) {
			rawConfig.timeout = parseInt(env[ENV_VARS.EMBEDDING_TIMEOUT] ?? '30000', 10);
		}

		if (env[ENV_VARS.EMBEDDING_MAX_RETRIES]) {
			rawConfig.maxRetries = parseInt(env[ENV_VARS.EMBEDDING_MAX_RETRIES] ?? '3', 10);
		}

		return parseEmbeddingConfig(rawConfig);
	} catch {
		// Configuration parsing failed
		return null;
	}
}

/**
 * Validate embedding configuration without throwing
 *
 * @param config - Raw configuration object
 * @returns Validation result with success flag and data/errors
 */
export function validateEmbeddingConfig(config: unknown): {
	success: boolean;
	data?: EmbeddingConfig;
	errors?: z.ZodError;
} {
	try {
		const data = parseEmbeddingConfig(config);
		return { success: true, data };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return { success: false, errors: error };
		}
		return { success: false, errors: error as z.ZodError };
	}
}
