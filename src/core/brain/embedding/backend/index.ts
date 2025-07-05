/**
 * Embedding Backend Module Exports
 *
 * Central export point for all embedding backend implementations and types.
 * Provides a clean interface for accessing embedding providers and utilities.
 *
 * @module embedding/backend
 */

// Export core types and interfaces
export type {
	Embedder,
	EmbeddingConfig,
	OpenAIEmbeddingConfig,
	BackendConfig,
	EmbeddingResult,
	BatchEmbeddingResult,
} from './types.js';

// Export error classes
export {
	EmbeddingError,
	EmbeddingConnectionError,
	EmbeddingDimensionError,
	EmbeddingRateLimitError,
	EmbeddingQuotaError,
	EmbeddingValidationError,
} from './types.js';

// Export backend implementations
export { OpenAIEmbedder } from './openai.js';
