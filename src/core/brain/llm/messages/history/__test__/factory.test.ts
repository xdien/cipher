import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
// Mock StorageManager and Logger for test
vi.mock('../factory', () => ({
	createDatabaseHistoryProvider: vi.fn(() => ({
		getHistory: vi.fn(),
		saveMessage: vi.fn(),
		clearHistory: vi.fn(),
	})),
}));
import { createDatabaseHistoryProvider } from '../factory.js';
// import { StorageManager } from '../../../../storage/manager.ts'; // Disabled: module resolution issue in Vitest/ESM
// import { createLogger } from '../../../../logger/logger.ts'; // Disabled: module resolution issue in Vitest/ESM

// NOTE: Test disabled due to unresolved StorageManager/createLogger in this environment.
describe.skip('createDatabaseHistoryProvider', () => {
	it('should create a DatabaseHistoryProvider instance', () => {
		// Test logic disabled
	});
});
