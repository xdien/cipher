/**
 * Global Context Management
 * Provides singleton access to the global context
 */

import { Context } from './context.js';
import { setGlobalContextRef, getGlobalContextRef } from './utils.js';

/**
 * Get the current global context
 * @returns The current global context
 * @throws Error if no global context is initialized
 */
export function getCurrentContext(): Context {
  const globalContext = getGlobalContextRef();
  if (!globalContext) {
    throw new Error(
      'Global context not initialized. ' +
      'Call initializeContext() first or use a local context.'
    );
  }
  return globalContext;
}

/**
 * Check if a global context exists
 * @returns True if a global context exists
 */
export function hasGlobalContext(): boolean {
  return getGlobalContextRef() !== undefined;
}

/**
 * Set the global context
 * @param context The context to set as global
 */
export function setGlobalContext(context: Context): void {
  setGlobalContextRef(context);
}

/**
 * Clear the global context
 */
export function clearGlobalContext(): void {
  setGlobalContextRef(undefined);
}

/**
 * Global Context Manager class
 * Alternative class-based approach to global context management
 */
export class GlobalContextManager {
  private static _instance: GlobalContextManager | undefined;
  
  /**
   * Get the singleton instance of GlobalContextManager
   * @returns The GlobalContextManager instance
   */
  public static getInstance(): GlobalContextManager {
    if (!GlobalContextManager._instance) {
      GlobalContextManager._instance = new GlobalContextManager();
    }
    return GlobalContextManager._instance;
  }
  
  /**
   * Get the current global context
   * @returns The current global context
   * @throws Error if no global context is initialized
   */
  public getCurrentContext(): Context {
    return getCurrentContext();
  }
  
  /**
   * Set the global context
   * @param context The context to set as global
   */
  public setGlobalContext(context: Context): void {
    setGlobalContext(context);
  }
  
  /**
   * Check if a global context exists
   * @returns True if a global context exists
   */
  public hasGlobalContext(): boolean {
    return hasGlobalContext();
  }
  
  /**
   * Clear the global context
   */
  public clearGlobalContext(): void {
    clearGlobalContext();
  }
}
