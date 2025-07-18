import { ICompressionStrategy, CompressionConfig, CompressionConfigSchema } from './types.js';
import { MiddleRemovalStrategy } from './strategies/middle-removal.js';
import { OldestRemovalStrategy } from './strategies/oldest-removal.js';
import { HybridStrategy } from './strategies/hybrid.js';
import { logger } from '../../../logger/index.js';

/**
 * Create a compression strategy instance based on configuration
 */
export function createCompressionStrategy(config: CompressionConfig): ICompressionStrategy {
	// Validate configuration
	const validatedConfig = CompressionConfigSchema.parse(config);

	logger.debug('Creating compression strategy', {
		strategy: validatedConfig.strategy,
		maxTokens: validatedConfig.maxTokens,
	});

	switch (validatedConfig.strategy) {
		case 'middle-removal':
			return new MiddleRemovalStrategy(validatedConfig);

		case 'oldest-removal':
			return new OldestRemovalStrategy(validatedConfig);

		case 'hybrid':
			return new HybridStrategy(validatedConfig);

		default:
			// Default to hybrid strategy for best balance
			return new HybridStrategy(validatedConfig);
	}
}

/**
 * Create a compression strategy with default configuration
 */
export function createDefaultCompressionStrategy(
	maxTokens: number,
	options?: Partial<CompressionConfig>
): ICompressionStrategy {
	const config: CompressionConfig = {
		strategy: 'hybrid',
		maxTokens,
		warningThreshold: 0.8,
		compressionThreshold: 0.9,
		preserveStart: 4,
		preserveEnd: 5,
		minMessagesToKeep: 4,
		...options,
	};

	return createCompressionStrategy(config);
}
