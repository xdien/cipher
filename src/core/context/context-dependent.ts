/**
 * ContextDependent mixin
 * Provides context access to components
 */

import { Context } from './context.js';
import { getGlobalContextRef } from './utils.js';

/**
 * Mixin class for components that need context access
 * Provides both global fallback and instance-specific context support
 */
export abstract class ContextDependent {
	private _context?: Context;

	constructor(context?: Context) {
		this._context = context;
	}

	/**
	 * Get context, with graceful fallback to global context if needed
	 * This returns the instance context if available immediately
	 * @returns Current instance context or undefined
	 */
	protected get instanceContext(): Context | undefined {
		return this._context;
	}

	/**
	 * Get context asynchronously, with graceful fallback to global context if needed
	 * @returns A promise that resolves to the context
	 * @throws Error if no context is available
	 */
	protected async getContextAsync(): Promise<Context> {
		// First try instance context
		if (this._context) {
			return this._context;
		}

		// Fall back to global context if available
		const globalContext = getGlobalContextRef();
		if (globalContext) {
			return globalContext;
		}

		throw new Error(
			`No context available for ${this.constructor.name}. ` +
				`Either initialize a Context first or pass context explicitly.`
		);
	}

	/**
	 * Get context synchronously, with graceful fallback to global context if needed
	 * This should only be used in contexts where you know the global context will be available
	 * @returns The context
	 * @throws Error if no context is available
	 */
	protected getContextSync(): Context {
		// First try instance context
		if (this._context) {
			return this._context;
		}

		throw new Error(
			`No context available for ${this.constructor.name}. ` +
				`Either initialize a Context first or pass context explicitly. ` +
				`If you need to access global context, use getContextAsync() instead.`
		);
	}

	/**
	 * Temporarily use a different context
	 * @param context The context to use temporarily
	 * @param operation The operation to perform with the temporary context
	 * @returns The result of the operation
	 */
	public useContext<T>(context: Context, operation: () => T): T {
		const oldContext = this._context;
		this._context = context;

		try {
			return operation();
		} finally {
			this._context = oldContext;
		}
	}

	/**
	 * Temporarily use a different context with async operations
	 * @param context The context to use temporarily
	 * @param operation The async operation to perform with the temporary context
	 * @returns A promise that resolves to the result of the operation
	 */
	public async useContextAsync<T>(context: Context, operation: () => Promise<T>): Promise<T> {
		const oldContext = this._context;
		this._context = context;

		try {
			return await operation();
		} finally {
			this._context = oldContext;
		}
	}

	/**
	 * Set a new context
	 * @param context The new context
	 */
	protected setContext(context: Context): void {
		this._context = context;
	}

	/**
	 * Check if an instance context is set
	 * @returns True if an instance context is set
	 */
	protected hasInstanceContext(): boolean {
		return this._context !== undefined;
	}
}
