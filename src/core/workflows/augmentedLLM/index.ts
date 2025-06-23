// ============================================================================
// Phase 1: Foundation Types and Schemas
// ============================================================================

// Core types and schemas
export * from './types.js';

// Memory interfaces and implementations
export * from './memory/types.js';
export * from './memory/simple-memory.js';

// Utility types and interfaces
export * from './utils/types.js';

// ============================================================================
// Phase 2: Core Protocol Interfaces
// ============================================================================

// Service interfaces and protocols
export * from './services/types.js';

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Main interfaces for easy import
export type {
	IAugmentedLLMService,
	IAugmentedLLMProtocol,
	IProviderToMCPConverter,
	IAgent,
	IContextDependent,
	IAugmentedLLMFactory,
	ILLMServiceEventEmitter,
	AugmentedLLMConfig,
	ToolInfo,
	LLMServiceEvents,
} from './services/types.js';

// Core type constraints
export type {
	MessageParamConstraint,
	MessageConstraint,
	ModelConstraint,
	MessageTypes,
	RequestParams,
	LLMError,
	Result,
} from './types.js';

// Memory types
export type { IMemory, MemoryConfig, MemoryStats, MemoryItem } from './memory/types.js';

// Utility types
export type {
	IContext,
	IModelSelector,
	IExecutor,
	ModelInfo,
	ContextConfig,
} from './utils/types.js';
