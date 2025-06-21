/**
 * Tests for the ContextDependent mixin
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Context } from '../context.js';
import { ContextDependent } from '../context-dependent.js';
import { setGlobalContext, clearGlobalContext } from '../global-context.js';
import { Logger } from '../../logger/core/logger.js';

// Test implementation of ContextDependent
class TestComponent extends ContextDependent {
  constructor(context?: Context) {
    super(context);
  }

  // Expose protected methods for testing
  public getInstanceContext(): Context | undefined {
    return this.instanceContext;
  }

  public async getContextAsyncPublic(): Promise<Context> {
    return this.getContextAsync();
  }

  public getContextSyncPublic(): Context {
    return this.getContextSync();
  }
}

describe('ContextDependent', () => {
  // Sample contexts for testing
  let instanceContext: Context;
  let globalContext: Context;
  let component: TestComponent;

  beforeEach(() => {
    // Clear any global context before each test
    clearGlobalContext();
    
    // Create test contexts
    instanceContext = new Context({
      sessionId: 'instance-session',
      logger: new Logger('instance')
    });
    
    globalContext = new Context({
      sessionId: 'global-session',
      logger: new Logger('global')
    });
  });

  test('should use instance context when provided', async () => {
    // Set up global context as well
    setGlobalContext(globalContext);
    
    // Create component with instance context
    component = new TestComponent(instanceContext);
    
    // Should use instance context
    expect(component.getInstanceContext()).toBe(instanceContext);
    expect(await component.getContextAsyncPublic()).toBe(instanceContext);
    expect(component.getContextSyncPublic()).toBe(instanceContext);
  });

  test('should fall back to global context when no instance context', async () => {
    // Set up only global context
    setGlobalContext(globalContext);
    
    // Create component without instance context
    component = new TestComponent();
    
    // Should fall back to global context for async
    expect(component.getInstanceContext()).toBeUndefined();
    expect(await component.getContextAsyncPublic()).toBe(globalContext);
    
    // Should throw for sync when no instance context
    expect(() => component.getContextSyncPublic()).toThrow();
  });

  test('should throw when no context available', async () => {
    // Create component without any context
    component = new TestComponent();
    
    // Both methods should throw
    expect(component.getInstanceContext()).toBeUndefined();
    await expect(component.getContextAsyncPublic()).rejects.toThrow();
    expect(() => component.getContextSyncPublic()).toThrow();
  });

  test('should support temporary context switching', async () => {
    // Create component with instance context
    component = new TestComponent(instanceContext);
    
    // Test context to switch to
    const tempContext = new Context({
      sessionId: 'temp-session',
      logger: new Logger('temp')
    });
    
    // Use synchronous context switching
    const syncResult = component.useContext(tempContext, () => {
      // Should use temp context during operation
      expect(component.getInstanceContext()).toBe(tempContext);
      return 'sync-success';
    });
    
    expect(syncResult).toBe('sync-success');
    // Should restore original context after operation
    expect(component.getInstanceContext()).toBe(instanceContext);
    
    // Use async context switching
    const asyncResult = await component.useContextAsync(tempContext, async () => {
      // Should use temp context during operation
      expect(component.getInstanceContext()).toBe(tempContext);
      return 'async-success';
    });
    
    expect(asyncResult).toBe('async-success');
    // Should restore original context after operation
    expect(component.getInstanceContext()).toBe(instanceContext);
  });
});
