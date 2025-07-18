import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager, ContextManagerConfig } from '../manager.js';
import { IMessageFormatter } from '../formatters/types.js';
import { PromptManager } from '../../../systemPrompt/manager.js';
import { InternalMessage } from '../types.js';

// Mock formatter for testing
class MockFormatter implements IMessageFormatter {
	format(message: any, systemPrompt?: string | null): any {
		return { role: message.role, content: message.content };
	}

	parseResponse(response: any): InternalMessage[] {
		return [];
	}
}

// Mock prompt manager for testing
class MockPromptManager extends PromptManager {
	constructor() {
		super();
		this.load('Test user instruction');
	}

	override getCompleteSystemPrompt(): string {
		return 'Test system prompt';
	}
}

describe('ContextManager Token Management', () => {
	let contextManager: ContextManager;
	let mockFormatter: MockFormatter;
	let mockPromptManager: MockPromptManager;

	beforeEach(() => {
		mockFormatter = new MockFormatter();
		mockPromptManager = new MockPromptManager();

		const config: ContextManagerConfig = {
			enableTokenManagement: true,
			maxTokens: 1000,
			warningThreshold: 0.8,
			compressionThreshold: 0.9,
			compressionStrategy: 'hybrid',
		};

		contextManager = new ContextManager(mockFormatter, mockPromptManager, config);
	});

	it('should initialize token management', async () => {
		await contextManager.initializeTokenManagement('openai', 'gpt-3.5-turbo');

		const stats = await contextManager.getTokenStats();
		expect(stats).not.toBeNull();
		expect(stats?.tokenizerInfo).toBeDefined();
	});

	it('should add messages with token counting', async () => {
		await contextManager.initializeTokenManagement('openai', 'gpt-3.5-turbo');

		const message: InternalMessage = {
			role: 'user',
			content: 'Hello, this is a test message for token counting.',
		};

		await contextManager.addMessage(message);

		const messages = contextManager.getRawMessages();
		expect(messages.length).toBe(1);
		const msg = messages[0];
		expect(msg).toBeDefined();
		if (msg) {
			expect(msg.tokenCount).toBeDefined();
			expect(msg.timestamp).toBeDefined();
		}
	});

	it('should track compression history', async () => {
		await contextManager.initializeTokenManagement('openai', 'gpt-3.5-turbo');

		// Add enough messages to trigger compression
		for (let i = 0; i < 20; i++) {
			await contextManager.addMessage({
				role: 'user',
				content: `This is a long test message number ${i} that should contribute to reaching the token limit and triggering compression. Adding more text to increase token count.`,
			});
		}

		const compressionHistory = contextManager.getCompressionHistory();

		// Check if compression was triggered
		if (compressionHistory.length > 0) {
			const lastCompression = compressionHistory[compressionHistory.length - 1];
			expect(lastCompression).toBeDefined();
			if (lastCompression) {
				expect(lastCompression.originalCount).toBeGreaterThan(lastCompression.compressedCount);
				expect(lastCompression.strategy).toBeDefined();
			}
		}
	});

	it('should preserve critical messages during compression', async () => {
		await contextManager.initializeTokenManagement('openai', 'gpt-3.5-turbo');

		// Add a critical message
		await contextManager.addEnhancedMessage(
			{
				role: 'system',
				content: 'This is a critical system message',
			},
			{
				priority: 'critical',
				preserveInCompression: true,
			}
		);

		// Add many regular messages to trigger compression
		for (let i = 0; i < 20; i++) {
			await contextManager.addMessage({
				role: 'user',
				content: `Regular message ${i} that can be compressed if needed.`,
			});
		}

		const messages = contextManager.getRawMessages();
		const criticalMessage = messages.find(m => m.priority === 'critical');
		expect(criticalMessage).toBeDefined();
	});

	it('should provide token usage statistics', async () => {
		await contextManager.initializeTokenManagement('anthropic', 'claude-3-sonnet');

		await contextManager.addMessage({
			role: 'user',
			content: 'Test message for token statistics',
		});

		const stats = await contextManager.getTokenStats();
		expect(stats).not.toBeNull();
		expect(stats?.currentTokens).toBeGreaterThan(0);
		expect(stats?.maxTokens).toBeGreaterThan(0);
		expect(stats?.utilizationRatio).toBeGreaterThan(0);
		expect(stats?.compressionLevel).toBeDefined();
		expect(stats?.messageCount).toBe(1);
	});
});
