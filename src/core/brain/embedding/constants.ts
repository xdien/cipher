/**
 * Embedding System Constants
 *
 * Centralized constants for the embedding system including defaults,
 * supported models, timeouts, and other configuration values.
 *
 * @module embedding/constants
 */

/**
 * Supported embedding provider types
 */
export const PROVIDER_TYPES = {
	OPENAI: 'openai',
} as const;

/**
 * OpenAI embedding models with their specifications
 */
export const OPENAI_MODELS = {
	/** Latest small embedding model (1536 dimensions) */
	TEXT_EMBEDDING_3_SMALL: 'text-embedding-3-small',
	/** Latest large embedding model (3072 dimensions) */
	TEXT_EMBEDDING_3_LARGE: 'text-embedding-3-large',
	/** Legacy Ada v2 model (1536 dimensions) */
	TEXT_EMBEDDING_ADA_002: 'text-embedding-ada-002',
} as const;

/**
 * Model dimension specifications
 */
export const MODEL_DIMENSIONS = {
	[OPENAI_MODELS.TEXT_EMBEDDING_3_SMALL]: 1536,
	[OPENAI_MODELS.TEXT_EMBEDDING_3_LARGE]: 3072,
	[OPENAI_MODELS.TEXT_EMBEDDING_ADA_002]: 1536,
} as const;

/**
 * Maximum input limits for different models
 */
export const MODEL_INPUT_LIMITS = {
	[OPENAI_MODELS.TEXT_EMBEDDING_3_SMALL]: 8191, // tokens
	[OPENAI_MODELS.TEXT_EMBEDDING_3_LARGE]: 8191, // tokens
	[OPENAI_MODELS.TEXT_EMBEDDING_ADA_002]: 8191, // tokens
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
	/** Default OpenAI model */
	OPENAI_MODEL: OPENAI_MODELS.TEXT_EMBEDDING_3_SMALL,

	/** Default request timeout in milliseconds */
	TIMEOUT: 30000, // 30 seconds

	/** Default maximum retry attempts */
	MAX_RETRIES: 3,

	/** Default batch size for batch operations */
	BATCH_SIZE: 100,

	/** Default OpenAI API base URL */
	OPENAI_BASE_URL: 'https://api.openai.com/v1',

	/** Default embedding dimension */
	DIMENSION: MODEL_DIMENSIONS[OPENAI_MODELS.TEXT_EMBEDDING_3_SMALL],
} as const;

/**
 * Rate limiting and retry configuration
 */
export const RETRY_CONFIG = {
	/** Initial retry delay in milliseconds */
	INITIAL_DELAY: 1000,

	/** Maximum retry delay in milliseconds */
	MAX_DELAY: 60000,

	/** Backoff multiplier for exponential backoff */
	BACKOFF_MULTIPLIER: 2,

	/** Jitter factor for randomizing retry delays */
	JITTER_FACTOR: 0.1,
} as const;

/**
 * Validation limits
 */
export const VALIDATION_LIMITS = {
	/** Maximum text length for single embedding */
	MAX_TEXT_LENGTH: 32768, // characters

	/** Maximum number of texts in batch operation */
	MAX_BATCH_SIZE: 2048,

	/** Minimum text length (empty strings not allowed) */
	MIN_TEXT_LENGTH: 1,
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
	PROVIDER_NOT_SUPPORTED: (provider: string) =>
		`Embedding provider '${provider}' is not supported`,

	MODEL_NOT_SUPPORTED: (model: string, provider: string) =>
		`Model '${model}' is not supported by provider '${provider}'`,

	API_KEY_REQUIRED: (provider: string) => `API key is required for provider '${provider}'`,

	CONNECTION_FAILED: (provider: string) => `Failed to connect to ${provider} embedding service`,

	TEXT_TOO_LONG: (length: number, max: number) =>
		`Text length ${length} exceeds maximum of ${max} characters`,

	BATCH_TOO_LARGE: (size: number, max: number) =>
		`Batch size ${size} exceeds maximum of ${max} items`,

	EMPTY_TEXT: 'Text cannot be empty',

	DIMENSION_MISMATCH: (expected: number, actual: number) =>
		`Expected embedding dimension ${expected}, but got ${actual}`,

	RATE_LIMIT_EXCEEDED: 'Rate limit exceeded for embedding provider',

	QUOTA_EXCEEDED: 'API quota exceeded for embedding provider',

	INVALID_API_KEY: (provider: string) => `Invalid API key for provider '${provider}'`,

	REQUEST_TIMEOUT: (timeout: number) => `Request timed out after ${timeout}ms`,
} as const;

/**
 * Log prefixes for different operations
 */
export const LOG_PREFIXES = {
	EMBEDDING: '[EMBEDDING]',
	OPENAI: '[EMBEDDING:OPENAI]',
	FACTORY: '[EMBEDDING:FACTORY]',
	MANAGER: '[EMBEDDING:MANAGER]',
	HEALTH: '[EMBEDDING:HEALTH]',
	BATCH: '[EMBEDDING:BATCH]',
} as const;

/**
 * Environment variable names
 */
export const ENV_VARS = {
	OPENAI_API_KEY: 'OPENAI_API_KEY',
	OPENAI_ORG_ID: 'OPENAI_ORG_ID',
	OPENAI_BASE_URL: 'OPENAI_BASE_URL',
	EMBEDDING_MODEL: 'EMBEDDING_MODEL',
	EMBEDDING_TIMEOUT: 'EMBEDDING_TIMEOUT',
	EMBEDDING_MAX_RETRIES: 'EMBEDDING_MAX_RETRIES',
} as const;

/**
 * HTTP status codes for API responses
 */
export const HTTP_STATUS = {
	OK: 200,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Content types for API requests
 */
export const CONTENT_TYPES = {
	JSON: 'application/json',
} as const; 