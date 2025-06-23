import { z } from 'zod';
import { ModelPreferences, ProviderConfig } from '../types.js';

// ============================================================================
// Model Selection Types
// ============================================================================

/**
 * Model information for selection
 */
export const ModelInfoSchema = z.object({
	name: z.string(),
	provider: z.string(),
	costTier: z.enum(['low', 'medium', 'high']),
	speedTier: z.enum(['slow', 'medium', 'fast']),
	intelligenceTier: z.enum(['low', 'medium', 'high']),
	contextLength: z.number().positive(),
	inputCostPer1kTokens: z.number().nonnegative(),
	outputCostPer1kTokens: z.number().nonnegative(),
	supportsTools: z.boolean(),
	supportsVision: z.boolean(),
	supportsStreaming: z.boolean(),
	maxOutputTokens: z.number().positive().optional(),
	deprecated: z.boolean().default(false),
});

export type ModelInfo = z.infer<typeof ModelInfoSchema>;

/**
 * Model selector interface
 */
export interface IModelSelector {
	/**
	 * Select the best model based on preferences
	 */
	selectBestModel(preferences?: ModelPreferences, provider?: string): ModelInfo;

	/**
	 * Get all available models
	 */
	getAvailableModels(provider?: string): ModelInfo[];

	/**
	 * Get model information by name
	 */
	getModelInfo(modelName: string): ModelInfo | null;

	/**
	 * Check if a model supports specific features
	 */
	supportsFeatures(modelName: string, features: ModelFeature[]): boolean;

	/**
	 * Estimate cost for a request
	 */
	estimateCost(modelName: string, inputTokens: number, outputTokens: number): number;
}

/**
 * Model features that can be checked
 */
export enum ModelFeature {
	TOOLS = 'tools',
	VISION = 'vision',
	STREAMING = 'streaming',
	FUNCTION_CALLING = 'function_calling',
	JSON_MODE = 'json_mode',
}

// ============================================================================
// Context and Execution Types
// ============================================================================

/**
 * Execution context interface
 */
export interface IExecutor {
	/**
	 * Generate a unique identifier
	 */
	uuid(): string;

	/**
	 * Execute an async operation with timeout
	 */
	executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T>;

	/**
	 * Execute operations in parallel with concurrency limit
	 */
	executeParallel<T>(operations: (() => Promise<T>)[], concurrency: number): Promise<T[]>;

	/**
	 * Retry an operation with exponential backoff
	 */
	retry<T>(operation: () => Promise<T>, maxAttempts: number, baseDelayMs: number): Promise<T>;
}

/**
 * Context interface for LLM operations
 */
export interface IContext {
	/**
	 * Executor for async operations
	 */
	executor: IExecutor;

	/**
	 * Model selector for choosing appropriate models
	 */
	modelSelector: IModelSelector;

	/**
	 * Whether tracing is enabled
	 */
	tracingEnabled: boolean;

	/**
	 * Provider configurations
	 */
	providers: Map<string, ProviderConfig>;

	/**
	 * Global configuration
	 */
	config: ContextConfig;
}

export const ContextConfigSchema = z.object({
	defaultTimeout: z.number().positive().default(30000),
	maxConcurrency: z.number().positive().default(10),
	retryAttempts: z.number().min(0).max(10).default(3),
	retryBaseDelay: z.number().positive().default(1000),
	enableTracing: z.boolean().default(false),
	enableMetrics: z.boolean().default(false),
	logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a default context
 */
export function createDefaultContext(): IContext {
	return {
		executor: createDefaultExecutor(),
		modelSelector: createDefaultModelSelector(),
		tracingEnabled: false,
		providers: new Map(),
		config: {
			defaultTimeout: 30000,
			maxConcurrency: 10,
			retryAttempts: 3,
			retryBaseDelay: 1000,
			enableTracing: false,
			enableMetrics: false,
			logLevel: 'info',
		},
	};
}

/**
 * Create a default executor
 */
function createDefaultExecutor(): IExecutor {
	return {
		uuid: () => crypto.randomUUID(),

		executeWithTimeout: async <T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> => {
			return Promise.race([
				operation(),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
				),
			]);
		},

		executeParallel: async <T>(
			operations: (() => Promise<T>)[],
			concurrency: number
		): Promise<T[]> => {
			const results: T[] = [];
			const executing: Promise<void>[] = [];

			for (let i = 0; i < operations.length; i++) {
				const promise = operations[i]().then(result => {
					results[i] = result;
				});
				executing.push(promise);

				if (executing.length >= concurrency) {
					await Promise.race(executing);
					executing.splice(
						executing.findIndex(p => p === promise),
						1
					);
				}
			}

			await Promise.all(executing);
			return results;
		},

		retry: async <T>(
			operation: () => Promise<T>,
			maxAttempts: number,
			baseDelayMs: number
		): Promise<T> => {
			let lastError: Error;

			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				try {
					return await operation();
				} catch (error) {
					lastError = error as Error;

					if (attempt === maxAttempts) {
						throw lastError;
					}

					const delay = baseDelayMs * Math.pow(2, attempt - 1);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}

			throw lastError!;
		},
	};
}

/**
 * Create a default model selector
 */
function createDefaultModelSelector(): IModelSelector {
	// This would be implemented with actual model data
	return {
		selectBestModel: (preferences?: ModelPreferences, provider?: string) => {
			// Default fallback model
			return {
				name: 'gpt-4.1-mini',
				provider: 'openai',
				costTier: 'medium' as const,
				speedTier: 'fast' as const,
				intelligenceTier: 'medium' as const,
				contextLength: 4096,
				inputCostPer1kTokens: 0.001,
				outputCostPer1kTokens: 0.002,
				supportsTools: true,
				supportsVision: false,
				supportsStreaming: true,
				deprecated: false,
			};
		},

		getAvailableModels: () => [],
		getModelInfo: () => null,
		supportsFeatures: () => false,
		estimateCost: () => 0,
	};
}
