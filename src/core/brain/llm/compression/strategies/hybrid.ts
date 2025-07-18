import {
	ICompressionStrategy,
	CompressionConfig,
	CompressionResult,
	CompressionContext,
} from '../types.js';
import { EnhancedInternalMessage } from '../../tokenizer/types.js';
import { MiddleRemovalStrategy } from './middle-removal.js';
import { OldestRemovalStrategy } from './oldest-removal.js';
import { getCompressionLevel } from '../utils.js';
import { logger } from '../../../../logger/index.js';

/**
 * Hybrid compression strategy
 * Combines middle-removal and oldest-removal strategies based on compression level
 */
export class HybridStrategy implements ICompressionStrategy {
	private config: CompressionConfig;
	private middleRemovalStrategy: MiddleRemovalStrategy;
	private oldestRemovalStrategy: OldestRemovalStrategy;

	constructor(config: CompressionConfig) {
		this.config = config;
		this.middleRemovalStrategy = new MiddleRemovalStrategy(config);
		this.oldestRemovalStrategy = new OldestRemovalStrategy(config);
	}

	async compress(
		messages: EnhancedInternalMessage[],
		context: CompressionContext
	): Promise<CompressionResult> {
		logger.debug('Starting hybrid compression', {
			originalCount: messages.length,
			compressionLevel: context.compressionLevel,
			targetTokens: context.targetTokenCount,
		});

		let strategy: ICompressionStrategy;
		let strategyName: string;

		// Choose strategy based on compression level and context
		switch (context.compressionLevel) {
			case 'soft':
				// Use middle removal for gentle compression
				strategy = this.middleRemovalStrategy;
				strategyName = 'hybrid-middle';
				break;

			case 'hard':
			case 'emergency':
				// Use oldest removal for aggressive compression
				strategy = this.oldestRemovalStrategy;
				strategyName = 'hybrid-oldest';
				break;

			default:
				// Default to middle removal for warning level
				strategy = this.middleRemovalStrategy;
				strategyName = 'hybrid-middle';
				break;
		}

		logger.debug(`Hybrid strategy selected: ${strategyName}`);

		// Execute the chosen strategy
		const result = await strategy.compress(messages, context);

		// Override strategy name to indicate hybrid approach
		return {
			...result,
			strategy: strategyName,
		};
	}

	shouldCompress(currentTokenCount: number, maxTokens: number, config: CompressionConfig): boolean {
		const ratio = currentTokenCount / maxTokens;
		return ratio >= config.compressionThreshold;
	}

	getStrategyName(): string {
		return 'hybrid';
	}

	getConfig(): CompressionConfig {
		return this.config;
	}

	/**
	 * Get the current compression level for diagnostic purposes
	 */
	getCurrentCompressionLevel(currentTokenCount: number, maxTokens: number): string {
		return getCompressionLevel(
			currentTokenCount,
			maxTokens,
			this.config.warningThreshold,
			this.config.compressionThreshold
		);
	}
}
