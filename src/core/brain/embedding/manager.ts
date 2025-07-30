/**
 * Embedding Manager Module
 *
 * Provides lifecycle management, health monitoring, and connection management
 * for embedding services. Manages multiple embedder instances and provides
 * centralized monitoring and cleanup capabilities.
 *
 * @module embedding/manager
 */

import { logger } from '../../logger/index.js';
import { type Embedder, type BackendConfig } from './backend/index.js';
import {
	createEmbedder,
	createEmbedderFromEnv,
	type BackendConfig as FactoryBackendConfig,
} from './factory.js';
import { LOG_PREFIXES } from './constants.js';
import { type EmbeddingConfig } from './config.js';
import { ResilientEmbedder, EmbeddingStatus } from './resilient-embedder.js';
import { CircuitBreakerManager } from './circuit-breaker.js';

/**
 * Health check result for an embedder instance
 */
export interface HealthCheckResult {
	/** Whether the embedder is healthy */
	healthy: boolean;
	/** Provider type */
	provider: string;
	/** Model being used */
	model: string;
	/** Embedding dimension */
	dimension?: number;
	/** Response time in milliseconds */
	responseTime?: number;
	/** Error message if unhealthy */
	error?: string;
	/** Timestamp of the health check */
	timestamp: Date;
}

/**
 * Information about an embedder instance
 */
export interface EmbedderInfo {
	/** Unique identifier for this embedder */
	id: string;
	/** Provider type */
	provider: string;
	/** Model being used */
	model: string;
	/** Embedding dimension */
	dimension: number;
	/** Configuration used */
	config: BackendConfig;
	/** Creation timestamp */
	createdAt: Date;
	/** Last health check result */
	lastHealthCheck?: HealthCheckResult;
}

/**
 * Statistics about embedding operations
 */
export interface EmbeddingStats {
	/** Total number of single embed operations */
	totalEmbeds: number;
	/** Total number of batch embed operations */
	totalBatchEmbeds: number;
	/** Total number of texts processed */
	totalTexts: number;
	/** Total processing time in milliseconds */
	totalProcessingTime: number;
	/** Number of successful operations */
	successfulOperations: number;
	/** Number of failed operations */
	failedOperations: number;
	/** Average processing time per operation */
	averageProcessingTime: number;
}

/**
 * Embedding Manager
 *
 * Manages the lifecycle of embedding instances, providing centralized
 * health monitoring, statistics collection, and resource cleanup.
 */
export class EmbeddingManager {
	private embedders = new Map<string, Embedder>();
	private embedderInfo = new Map<string, EmbedderInfo>();
	private resilientEmbedders = new Map<string, ResilientEmbedder>();
	private circuitBreakerManager = new CircuitBreakerManager();
	private stats: EmbeddingStats = {
		totalEmbeds: 0,
		totalBatchEmbeds: 0,
		totalTexts: 0,
		totalProcessingTime: 0,
		successfulOperations: 0,
		failedOperations: 0,
		averageProcessingTime: 0,
	};
	private healthCheckInterval: NodeJS.Timeout | undefined;
	private fallbackEnabled = true;

	constructor() {
		logger.debug(`${LOG_PREFIXES.MANAGER} Embedding manager with resilient fallback initialized`);
	}

	/**
	 * Create and register an embedder instance
	 *
	 * @param config - Embedding configuration
	 * @param id - Optional custom ID for the embedder
	 * @returns Promise resolving to embedder instance and info
	 */
	async createEmbedder(
		config: BackendConfig,
		id?: string
	): Promise<{ embedder: Embedder; info: EmbedderInfo }> {
		const embedderId = id || this.generateId();

		logger.debug(`${LOG_PREFIXES.MANAGER} Creating embedder`, {
			id: embedderId,
			type: config.type,
		});

		try {
			const configWithApiKey = { ...config, apiKey: config.apiKey || '' };
			const baseEmbedder = await createEmbedder(configWithApiKey as any);

			// Wrap with resilient embedder for fault tolerance
			const resilientEmbedder = new ResilientEmbedder(
				baseEmbedder,
				config.type,
				{
					enableCircuitBreaker: this.fallbackEnabled,
					enableFallback: this.fallbackEnabled,
					healthCheckInterval: 300000, // 5 minutes
					maxConsecutiveFailures: 5,
					recoveryInterval: 60000, // 1 minute
				}
			);

			const info: EmbedderInfo = {
				id: embedderId,
				provider: config.type,
				model: config.model || 'unknown',
				dimension: baseEmbedder.getDimension(),
				config,
				createdAt: new Date(),
			};

			this.embedders.set(embedderId, resilientEmbedder);
			this.embedderInfo.set(embedderId, info);
			this.resilientEmbedders.set(embedderId, resilientEmbedder);

			logger.info(`${LOG_PREFIXES.MANAGER} Successfully created resilient embedder`, {
				id: embedderId,
				provider: info.provider,
				model: info.model,
				dimension: info.dimension,
				fallbackEnabled: this.fallbackEnabled,
			});

			return { embedder: resilientEmbedder, info };
		} catch (error) {
			logger.error(`${LOG_PREFIXES.MANAGER} Failed to create embedder`, {
				id: embedderId,
				type: config.type,
				error: error instanceof Error ? error.message : String(error),
			});

			throw error;
		}
	}

	/**
	 * Create and register an embedder from YAML configuration
	 *
	 * @param config - Embedding configuration from YAML
	 * @param id - Optional custom ID for the embedder
	 * @returns Promise resolving to embedder instance and info, or null
	 */
	async createEmbedderFromConfig(
		config: EmbeddingConfig,
		id?: string
	): Promise<{ embedder: Embedder; info: EmbedderInfo } | null> {
		logger.debug(`${LOG_PREFIXES.MANAGER} Creating embedder from YAML configuration`, {
			provider: config.type,
			model: config.model,
		});

		// Check if embeddings are explicitly disabled in config
		if ('disabled' in config && config.disabled) {
			logger.info(`${LOG_PREFIXES.MANAGER} Embeddings are disabled via YAML configuration`);
			return null;
		}

		const embedder = await createEmbedder(config as FactoryBackendConfig);
		if (!embedder) {
			logger.warn(`${LOG_PREFIXES.MANAGER} Failed to create embedder from YAML configuration`);
			return null;
		}

		const embedderId = id || this.generateId();
		const backendConfig = embedder.getConfig() as BackendConfig;

		const info: EmbedderInfo = {
			id: embedderId,
			provider: backendConfig.type,
			model: backendConfig.model || 'unknown',
			dimension: embedder.getDimension(),
			config: backendConfig,
			createdAt: new Date(),
		};

		this.embedders.set(embedderId, embedder);
		this.embedderInfo.set(embedderId, info);

		// Enhanced logging with provider-specific details
		const logDetails: any = {
			id: embedderId,
			provider: info.provider,
			model: info.model,
			dimension: info.dimension,
		};

		// Add provider-specific details
		if (info.provider === 'voyage') {
			logDetails.voyageModel = info.model;
			logDetails.voyageDimensions = info.dimension;
			logger.info(`${LOG_PREFIXES.MANAGER} Voyage embedder registered successfully from YAML`, logDetails);
		} else if (info.provider === 'openai') {
			logDetails.openaiModel = info.model;
			logDetails.openaiDimensions = info.dimension;
			logger.info(`${LOG_PREFIXES.MANAGER} OpenAI embedder registered successfully from YAML`, logDetails);
		} else if (info.provider === 'qwen') {
			logDetails.qwenModel = info.model;
			logDetails.qwenDimensions = info.dimension;
			logger.info(`${LOG_PREFIXES.MANAGER} Qwen embedder registered successfully from YAML`, logDetails);
		} else {
			logger.info(`${LOG_PREFIXES.MANAGER} Embedder registered successfully from YAML`, logDetails);
		}

		return { embedder, info };
	}

	/**
	 * Create embedder from environment variables
	 *
	 * @param id - Optional custom ID for the embedder
	 * @returns Promise resolving to embedder instance and info, or null
	 */
	async createEmbedderFromEnv(
		id?: string
	): Promise<{ embedder: Embedder; info: EmbedderInfo } | null> {
		logger.debug(`${LOG_PREFIXES.MANAGER} Creating embedder from environment`);

		// Check if embeddings are explicitly disabled
		if (process.env.DISABLE_EMBEDDINGS === 'true' || process.env.EMBEDDING_DISABLED === 'true') {
			logger.info(`${LOG_PREFIXES.MANAGER} Embeddings are disabled via environment variable`);
			return null;
		}

		const result = await createEmbedderFromEnv();
		if (!result) {
			logger.warn(`${LOG_PREFIXES.MANAGER} No embedder configuration found in environment`);
			return null;
		}

		const { embedder, info: factoryInfo } = result;
		const embedderId = id || this.generateId();
		const config = embedder.getConfig() as BackendConfig;

		const info: EmbedderInfo = {
			id: embedderId,
			provider: config.type,
			model: config.model || 'unknown',
			dimension: embedder.getDimension(),
			config,
			createdAt: new Date(),
		};

		this.embedders.set(embedderId, embedder);
		this.embedderInfo.set(embedderId, info);

		logger.info(`${LOG_PREFIXES.MANAGER} Successfully created embedder from environment`, {
			id: embedderId,
			provider: info.provider,
			model: info.model,
		});

		return { embedder, info };
	}

	/**
	 * Get embedder instance by ID
	 *
	 * @param id - Embedder ID
	 * @returns Embedder instance or undefined
	 */
	getEmbedder(id: string): Embedder | undefined {
		return this.embedders.get(id);
	}

	/**
	 * Get embedder information by ID
	 *
	 * @param id - Embedder ID
	 * @returns Embedder information or undefined
	 */
	getEmbedderInfo(id: string): EmbedderInfo | undefined {
		return this.embedderInfo.get(id);
	}

	/**
	 * Get all registered embedders
	 *
	 * @returns Map of embedder ID to embedder instance
	 */
	getAllEmbedders(): Map<string, Embedder> {
		return new Map(this.embedders);
	}

	/**
	 * Get all embedder information
	 *
	 * @returns Map of embedder ID to embedder information
	 */
	getAllEmbedderInfo(): Map<string, EmbedderInfo> {
		return new Map(this.embedderInfo);
	}

	/**
	 * Remove and disconnect an embedder
	 *
	 * @param id - Embedder ID
	 * @returns Promise resolving to true if removed, false if not found
	 */
	async removeEmbedder(id: string): Promise<boolean> {
		const embedder = this.embedders.get(id);
		if (!embedder) {
			logger.warn(`${LOG_PREFIXES.MANAGER} Embedder not found for removal`, { id });
			return false;
		}

		logger.debug(`${LOG_PREFIXES.MANAGER} Removing embedder`, { id });

		try {
			await embedder.disconnect();
			this.embedders.delete(id);
			this.embedderInfo.delete(id);

			logger.info(`${LOG_PREFIXES.MANAGER} Successfully removed embedder`, { id });
			return true;
		} catch (error) {
			logger.error(`${LOG_PREFIXES.MANAGER} Error disconnecting embedder`, {
				id,
				error: error instanceof Error ? error.message : String(error),
			});

			// Remove anyway to prevent memory leaks
			this.embedders.delete(id);
			this.embedderInfo.delete(id);
			return true;
		}
	}

	/**
	 * Perform health check on a specific embedder
	 *
	 * @param id - Embedder ID
	 * @returns Promise resolving to health check result
	 */
	async checkHealth(id: string): Promise<HealthCheckResult | null> {
		const embedder = this.embedders.get(id);
		const info = this.embedderInfo.get(id);

		if (!embedder || !info) {
			logger.warn(`${LOG_PREFIXES.HEALTH} Embedder not found for health check`, { id });
			return null;
		}

		logger.silly(`${LOG_PREFIXES.HEALTH} Performing health check`, { id });

		const startTime = Date.now();
		try {
			const healthy = await embedder.isHealthy();
			const responseTime = Date.now() - startTime;

			const result: HealthCheckResult = {
				healthy,
				provider: info.provider,
				model: info.model || 'unknown',
				dimension: info.dimension,
				responseTime,
				timestamp: new Date(),
			};

			// Update embedder info with latest health check
			this.embedderInfo.set(id, {
				...info,
				lastHealthCheck: result,
			});

			logger.debug(`${LOG_PREFIXES.HEALTH} Health check completed`, {
				id,
				healthy,
				responseTime,
			});

			return result;
		} catch (error) {
			const responseTime = Date.now() - startTime;
			const result: HealthCheckResult = {
				healthy: false,
				provider: info.provider,
				model: info.model || 'unknown',
				dimension: info.dimension,
				responseTime,
				error: error instanceof Error ? error.message : String(error),
				timestamp: new Date(),
			};

			// Update embedder info with latest health check
			this.embedderInfo.set(id, {
				...info,
				lastHealthCheck: result,
			});

			logger.warn(`${LOG_PREFIXES.HEALTH} Health check failed`, {
				id,
				error: result.error,
				responseTime,
			});

			return result;
		}
	}

	/**
	 * Perform health check on all embedders
	 *
	 * @returns Promise resolving to map of embedder ID to health check result
	 */
	async checkAllHealth(): Promise<Map<string, HealthCheckResult>> {
		logger.debug(`${LOG_PREFIXES.HEALTH} Performing health check on all embedders`);

		const results = new Map<string, HealthCheckResult>();
		const healthCheckPromises = Array.from(this.embedders.keys()).map(async id => {
			const result = await this.checkHealth(id);
			if (result) {
				results.set(id, result);
			}
		});

		await Promise.all(healthCheckPromises);

		logger.debug(`${LOG_PREFIXES.HEALTH} Completed health check on all embedders`, {
			total: this.embedders.size,
			checked: results.size,
		});

		return results;
	}

	/**
	 * Start periodic health checks
	 *
	 * @param intervalMs - Health check interval in milliseconds (default: 5 minutes)
	 */
	startHealthChecks(intervalMs: number = 5 * 60 * 1000): void {
		if (this.healthCheckInterval) {
			logger.warn(`${LOG_PREFIXES.HEALTH} Health checks already running`);
			return;
		}

		logger.info(`${LOG_PREFIXES.HEALTH} Starting periodic health checks`, {
			intervalMs,
		});

		this.healthCheckInterval = setInterval(async () => {
			try {
				await this.checkAllHealth();
			} catch (error) {
				logger.error(`${LOG_PREFIXES.HEALTH} Error during periodic health check`, {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}, intervalMs);
	}

	/**
	 * Stop periodic health checks
	 */
	stopHealthChecks(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = undefined;
			logger.info(`${LOG_PREFIXES.HEALTH} Stopped periodic health checks`);
		}
	}

	/**
	 * Get current statistics
	 *
	 * @returns Current embedding statistics
	 */
	getStats(): EmbeddingStats {
		// Calculate average processing time
		const avgTime =
			this.stats.totalProcessingTime > 0 && this.stats.successfulOperations > 0
				? this.stats.totalProcessingTime / this.stats.successfulOperations
				: 0;

		return {
			...this.stats,
			averageProcessingTime: avgTime,
		};
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		logger.debug(`${LOG_PREFIXES.MANAGER} Resetting embedding statistics`);

		this.stats = {
			totalEmbeds: 0,
			totalBatchEmbeds: 0,
			totalTexts: 0,
			totalProcessingTime: 0,
			successfulOperations: 0,
			failedOperations: 0,
			averageProcessingTime: 0,
		};
	}

	/**
	 * Update statistics (called internally after operations)
	 */
	private updateStats(
		type: 'embed' | 'batch',
		textCount: number,
		processingTime: number,
		success: boolean
	): void {
		if (type === 'embed') {
			this.stats.totalEmbeds++;
		} else {
			this.stats.totalBatchEmbeds++;
		}

		this.stats.totalTexts += textCount;

		if (success) {
			this.stats.successfulOperations++;
			this.stats.totalProcessingTime += processingTime;
		} else {
			this.stats.failedOperations++;
		}
	}

	/**
	 * Get embedding status for all embedders
	 */
	getEmbeddingStatus(): Record<string, {
		status: EmbeddingStatus;
		provider: string;
		isHealthy: boolean;
		stats: any;
	}> {
		const status: Record<string, any> = {};
		
		for (const [id, resilientEmbedder] of this.resilientEmbedders) {
			const info = this.embedderInfo.get(id);
			if (info) {
				status[id] = {
					status: resilientEmbedder.getStatus(),
					provider: info.provider,
					isHealthy: resilientEmbedder.getStatus() === EmbeddingStatus.HEALTHY,
					stats: resilientEmbedder.getStats(),
				};
			}
		}

		return status;
	}

	/**
	 * Check if any embeddings are currently available
	 */
	hasAvailableEmbeddings(): boolean {
		for (const resilientEmbedder of this.resilientEmbedders.values()) {
			const status = resilientEmbedder.getStatus();
			if (status === EmbeddingStatus.HEALTHY || status === EmbeddingStatus.RECOVERING) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Get circuit breaker statistics
	 */
	getCircuitBreakerStats() {
		return this.circuitBreakerManager.getAllStats();
	}

	/**
	 * Reset all circuit breakers and recover from disabled state
	 */
	resetAllEmbedders(): void {
		logger.info(`${LOG_PREFIXES.MANAGER} Resetting all embedders to healthy state`);
		
		// Reset circuit breakers
		this.circuitBreakerManager.resetAll();
		
		// Reset all resilient embedders
		for (const resilientEmbedder of this.resilientEmbedders.values()) {
			resilientEmbedder.reset();
		}
		
		logger.info(`${LOG_PREFIXES.MANAGER} All embedders reset successfully`);
	}

	/**
	 * Force disable all embeddings (emergency fallback)
	 */
	forceDisableAllEmbeddings(): void {
		logger.warn(`${LOG_PREFIXES.MANAGER} Force disabling all embeddings - switching to chat-only mode`);
		
		for (const resilientEmbedder of this.resilientEmbedders.values()) {
			resilientEmbedder.forceDisable();
		}
		
		this.fallbackEnabled = false;
	}

	/**
	 * Enable fallback functionality
	 */
	enableFallback(): void {
		this.fallbackEnabled = true;
		logger.info(`${LOG_PREFIXES.MANAGER} Embedding fallback enabled`);
	}

	/**
	 * Disable fallback functionality
	 */
	disableFallback(): void {
		this.fallbackEnabled = false;
		logger.info(`${LOG_PREFIXES.MANAGER} Embedding fallback disabled`);
	}

	/**
	 * Disconnect all embedders and cleanup
	 */
	async disconnect(): Promise<void> {
		logger.info(`${LOG_PREFIXES.MANAGER} Disconnecting all embedders`);

		// Stop health checks
		this.stopHealthChecks();

		// Disconnect all embedders
		const disconnectPromises = Array.from(this.embedders.entries()).map(async ([id, embedder]) => {
			try {
				await embedder.disconnect();
				logger.debug(`${LOG_PREFIXES.MANAGER} Disconnected embedder`, { id });
			} catch (error) {
				logger.warn(`${LOG_PREFIXES.MANAGER} Error disconnecting embedder`, {
					id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		});

		await Promise.all(disconnectPromises);

		// Clear all maps
		this.embedders.clear();
		this.embedderInfo.clear();
		this.resilientEmbedders.clear();

		logger.info(`${LOG_PREFIXES.MANAGER} Successfully disconnected all embedders`);
	}

	/**
	 * Generate a unique ID for embedders
	 */
	private generateId(): string {
		return `embedder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
