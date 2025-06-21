/**
 * Tests for the global context management
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { Context } from '../context.js';
import { getCurrentContext, hasGlobalContext, setGlobalContext, clearGlobalContext } from '../global-context.js';
import { Logger } from '../../logger/core/logger.js';

describe('Global Context Management', () => {
  beforeEach(() => {
    // Clear global context before each test
    clearGlobalContext();
  });

  afterEach(() => {
    // Clear global context after each test
    clearGlobalContext();
  });

  test('should set and get global context', () => {
    expect(hasGlobalContext()).toBe(false);
    
    const context = new Context({
      sessionId: 'global-test',
      logger: new Logger('global-test')
    });
    
    setGlobalContext(context);
    
    expect(hasGlobalContext()).toBe(true);
    expect(getCurrentContext()).toBe(context);
  });

  test('should throw when accessing non-existent global context', () => {
    expect(hasGlobalContext()).toBe(false);
    expect(() => getCurrentContext()).toThrow();
  });

  test('should clear global context', () => {
    const context = new Context({
      sessionId: 'global-test',
      logger: new Logger('global-test')
    });
    
    setGlobalContext(context);
    expect(hasGlobalContext()).toBe(true);
    
    clearGlobalContext();
    expect(hasGlobalContext()).toBe(false);
  });
});
