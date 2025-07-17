import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseHistoryProvider } from '../database.js';
import type { InternalMessage } from '../../types.js';

const mockStorage = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
const mockLogger = { error: vi.fn(), warn: vi.fn() };

describe('DatabaseHistoryProvider', () => {
  let provider: DatabaseHistoryProvider;
  const sessionId = 'test-session';
  const message: InternalMessage = { role: 'user', content: 'hello' };

  beforeEach(() => {
    mockStorage.get.mockReset();
    mockStorage.set.mockReset();
    mockStorage.delete.mockReset();
    provider = new DatabaseHistoryProvider(mockStorage as any, mockLogger as any);
  });

  it('should save and retrieve messages in order', async () => {
    mockStorage.get.mockResolvedValueOnce([]);
    mockStorage.set.mockResolvedValueOnce(undefined);
    await provider.saveMessage(sessionId, message);
    expect(mockStorage.set).toHaveBeenCalledWith(
      `messages:${sessionId}`,
      [message]
    );
  });

  it('should enforce message limit', async () => {
    const many = Array(1005).fill(message);
    mockStorage.get.mockResolvedValueOnce(many);
    await provider.saveMessage(sessionId, message);
    const saved = mockStorage.set.mock.calls[0][1];
    expect(saved.length).toBeLessThanOrEqual(1000);
  });

  it('should clear history', async () => {
    mockStorage.delete.mockResolvedValueOnce(undefined);
    await provider.clearHistory(sessionId);
    expect(mockStorage.delete).toHaveBeenCalledWith(`messages:${sessionId}`);
  });

  it('should log and throw on error', async () => {
    mockStorage.get.mockRejectedValueOnce(new Error('fail'));
    await expect(provider.getHistory(sessionId)).rejects.toThrow('fail');
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
