/**
 * Context utility functions
 * This file helps break circular dependencies
 */

import { Context } from './context.js';

/**
 * Global context instance
 * Using a direct reference for simplicity and reliability
 */
let _globalContext: Context | undefined;

/**
 * Set the global context
 * @param context The context to set as global or undefined to clear
 */
export function setGlobalContextRef(context: Context | undefined): void {
  _globalContext = context;
}

/**
 * Get the global context if available
 * @returns The global context or undefined if not set
 */
export function getGlobalContextRef(): Context | undefined {
  return _globalContext;
}
