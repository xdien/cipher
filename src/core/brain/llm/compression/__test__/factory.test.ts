import { describe, it, expect } from 'vitest';
import { createCompressionStrategy, createDefaultCompressionStrategy } from '../factory.js';
import { CompressionConfig } from '../types.js';

describe('Compression Factory', () => {
	const mockConfig: CompressionConfig = {
		strategy: 'hybrid',
		maxTokens: 1000,
		warningThreshold: 0.8,
		compressionThreshold: 0.9,
		preserveStart: 4,
		preserveEnd: 5,
		minMessagesToKeep: 4,
	};

	it('should create middle-removal strategy', () => {
		const config = { ...mockConfig, strategy: 'middle-removal' as const };
		const strategy = createCompressionStrategy(config);

		expect(strategy).toBeDefined();
		expect(strategy.getStrategyName()).toBe('middle-removal');
	});

	it('should create oldest-removal strategy', () => {
		const config = { ...mockConfig, strategy: 'oldest-removal' as const };
		const strategy = createCompressionStrategy(config);

		expect(strategy).toBeDefined();
		expect(strategy.getStrategyName()).toBe('oldest-removal');
	});

	it('should create hybrid strategy', () => {
		const config = { ...mockConfig, strategy: 'hybrid' as const };
		const strategy = createCompressionStrategy(config);

		expect(strategy).toBeDefined();
		expect(strategy.getStrategyName()).toBe('hybrid');
	});

	it('should create default compression strategy', () => {
		const strategy = createDefaultCompressionStrategy(1000);

		expect(strategy).toBeDefined();
		expect(strategy.getStrategyName()).toBe('hybrid'); // Default is hybrid
		expect(strategy.getConfig().maxTokens).toBe(1000);
	});

	it('should validate configuration schema', () => {
		const invalidConfig = {
			strategy: 'invalid-strategy',
			maxTokens: -100, // Invalid negative value
		};

		expect(() => createCompressionStrategy(invalidConfig as any)).toThrow();
	});
});
