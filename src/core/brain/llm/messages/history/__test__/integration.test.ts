import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseHistoryProvider } from '../database.js';
import { StorageManager } from '../../../../../storage/manager.js';
import type { InternalMessage } from '../../types.js';

const mockLogger = { error: () => {}, warn: () => {}, debug: () => {} };

describe.skip('DatabaseHistoryProvider integration', () => {
	let provider: DatabaseHistoryProvider;
	let sessionId: string;
	let message: InternalMessage;

	const storageConfig: any = {
		cache: { type: 'in-memory' },
		database: { type: 'in-memory' },
	};

	beforeEach(async () => {
		sessionId = 'integration-session';
		message = { role: 'user', content: 'integration test' };
		const storageManager = new StorageManager(storageConfig);
		await storageManager.connect();
		const backends = storageManager.getBackends();
		provider = new DatabaseHistoryProvider(backends!.database, mockLogger as any);
	});

	it('should save and retrieve messages with real storage', async () => {
		await provider.clearHistory(sessionId);
		await provider.saveMessage(sessionId, message);
		const history = await provider.getHistory(sessionId);
		expect(history.length).toBeGreaterThan(0);
		expect(history[history.length - 1]).toEqual(message);
	});

	it('should clear history with real storage', async () => {
		await provider.saveMessage(sessionId, message);
		await provider.clearHistory(sessionId);
		const history = await provider.getHistory(sessionId);
		expect(history.length).toBe(0);
	});
});
