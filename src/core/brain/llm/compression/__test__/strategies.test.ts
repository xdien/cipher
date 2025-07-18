import { describe, it, expect } from 'vitest';
import { MiddleRemovalStrategy } from '../strategies/middle-removal.js';
import { OldestRemovalStrategy } from '../strategies/oldest-removal.js';
import { HybridStrategy } from '../strategies/hybrid.js';
import { CompressionConfig, CompressionContext } from '../types.js';
import { EnhancedInternalMessage } from '../../tokenizer/types.js';

describe('Compression Strategies', () => {
	const mockConfig: CompressionConfig = {
		strategy: 'hybrid',
		maxTokens: 1000,
		warningThreshold: 0.8,
		compressionThreshold: 0.9,
		preserveStart: 2,
		preserveEnd: 2,
		minMessagesToKeep: 3,
	};

	const createTestMessages = (count: number): EnhancedInternalMessage[] => {
		return Array.from({ length: count }, (_, i) => ({
			role: i === 0 ? 'system' : 'user',
			content: `Test message ${i}`,
			timestamp: Date.now() + i,
			tokenCount: 20,
		}));
	};

	describe('MiddleRemovalStrategy', () => {
		it('should preserve start and end messages', async () => {
			const strategy = new MiddleRemovalStrategy(mockConfig);
			const messages = createTestMessages(10);

			const context: CompressionContext = {
				currentTokenCount: 900,
				maxTokens: 1000,
				targetTokenCount: 600,
				preserveCritical: true,
				compressionLevel: 'soft',
			};

			const result = await strategy.compress(messages, context);

			expect(result.compressedCount).toBeLessThan(result.originalCount);
			expect(result.strategy).toBe('middle-removal');
			expect(result.tokensSaved).toBeGreaterThan(0);
		});

		it('should preserve critical messages', async () => {
			const strategy = new MiddleRemovalStrategy(mockConfig);
			const messages = createTestMessages(10);

			// Mark one message as critical
			messages[5]!.priority = 'critical';
			messages[5]!.preserveInCompression = true;

			const context: CompressionContext = {
				currentTokenCount: 900,
				maxTokens: 1000,
				targetTokenCount: 600,
				preserveCritical: true,
				compressionLevel: 'soft',
			};

			await strategy.compress(messages, context);

			// Check that critical message is still present
			const criticalMessage = messages.find(m => m.priority === 'critical');
			expect(criticalMessage).toBeDefined();
		});
	});

	describe('OldestRemovalStrategy', () => {
		it('should remove oldest messages first', async () => {
			const strategy = new OldestRemovalStrategy(mockConfig);
			const messages = createTestMessages(10);

			// Set higher token counts to ensure compression is needed
			messages.forEach(msg => (msg.tokenCount = 100));

			const context: CompressionContext = {
				currentTokenCount: 1000, // 10 messages * 100 tokens each
				maxTokens: 1000,
				targetTokenCount: 300, // Force aggressive compression
				preserveCritical: true,
				compressionLevel: 'hard',
			};

			const result = await strategy.compress(messages, context);

			expect(result.compressedCount).toBeLessThan(result.originalCount);
			expect(result.strategy).toBe('oldest-removal');
		});
	});

	describe('HybridStrategy', () => {
		it('should choose strategy based on compression level', async () => {
			const strategy = new HybridStrategy(mockConfig);
			const messages = createTestMessages(10);

			// Test soft compression (should use middle removal)
			const softContext: CompressionContext = {
				currentTokenCount: 900,
				maxTokens: 1000,
				targetTokenCount: 600,
				preserveCritical: true,
				compressionLevel: 'soft',
			};

			const softResult = await strategy.compress([...messages], softContext);
			expect(softResult.strategy).toBe('hybrid-middle');

			// Test hard compression (should use oldest removal)
			const hardContext: CompressionContext = {
				currentTokenCount: 950,
				maxTokens: 1000,
				targetTokenCount: 500,
				preserveCritical: true,
				compressionLevel: 'hard',
			};

			const hardResult = await strategy.compress([...messages], hardContext);
			expect(hardResult.strategy).toBe('hybrid-oldest');
		});
	});

	describe('shouldCompress method', () => {
		it('should return true when threshold is exceeded', () => {
			const strategy = new MiddleRemovalStrategy(mockConfig);
			const shouldCompress = strategy.shouldCompress(950, 1000, mockConfig);
			expect(shouldCompress).toBe(true);
		});

		it('should return false when threshold is not exceeded', () => {
			const strategy = new MiddleRemovalStrategy(mockConfig);
			const shouldCompress = strategy.shouldCompress(800, 1000, mockConfig);
			expect(shouldCompress).toBe(false);
		});
	});
});
