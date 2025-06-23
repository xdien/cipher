/**
 * Context management utilities for logging
 */

import { EventContext } from '../types/index.js';

/**
 * Global context storage using AsyncLocalStorage-like pattern
 */
class ContextManager {
	private context: Map<string, any> = new Map();

	/**
	 * Set a context value
	 */
	set(key: string, value: any): void {
		this.context.set(key, value);
	}

	/**
	 * Get a context value
	 */
	get(key: string): any {
		return this.context.get(key);
	}

	/**
	 * Get all context as an object
	 */
	getAll(): Record<string, any> {
		return Object.fromEntries(this.context);
	}

	/**
	 * Clear all context
	 */
	clear(): void {
		this.context.clear();
	}

	/**
	 * Run a function with additional context
	 */
	async withContext<T>(contextData: Record<string, any>, fn: () => Promise<T>): Promise<T> {
		// Store current context
		const previousContext = new Map(this.context);

		try {
			// Merge new context
			for (const [key, value] of Object.entries(contextData)) {
				this.context.set(key, value);
			}

			return await fn();
		} finally {
			// Restore previous context
			this.context = previousContext;
		}
	}
}

// Global context manager instance
const globalContextManager = new ContextManager();

/**
 * Set global log context that will be included in all log events
 */
export function setGlobalLogContext(key: string, value: any): void {
	globalContextManager.set(key, value);
}

/**
 * Get global log context value
 */
export function getGlobalLogContext(key: string): any {
	return globalContextManager.get(key);
}

/**
 * Get all global log context
 */
export function getAllGlobalLogContext(): Record<string, any> {
	return globalContextManager.getAll();
}

/**
 * Clear all global log context
 */
export function clearGlobalLogContext(): void {
	globalContextManager.clear();
}

/**
 * Run a function with additional global log context
 */
export async function withGlobalLogContext<T>(
	contextData: Record<string, any>,
	fn: () => Promise<T>
): Promise<T> {
	return globalContextManager.withContext(contextData, fn);
}

/**
 * Merge multiple context objects with precedence (later objects override earlier ones)
 */
export function mergeContext(...contexts: (EventContext | undefined)[]): EventContext {
	const merged: EventContext = {};

	for (const context of contexts) {
		if (context) {
			Object.assign(merged, context);
		}
	}

	return merged;
}

/**
 * Create context from current environment
 */
export function createEnvironmentContext(): EventContext {
	const context: EventContext = {};

	// Add process information if available (Node.js)
	if (typeof process !== 'undefined') {
		context.processId = process.pid;
		context.nodeVersion = process.version;
		context.platform = process.platform;
	}

	// Add timestamp
	context.timestamp = new Date().toISOString();

	return context;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
	return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique trace ID for distributed tracing
 */
export function generateTraceId(): string {
	return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique span ID for distributed tracing
 */
export function generateSpanId(): string {
	return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique workflow ID
 */
export function generateWorkflowId(): string {
	return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
