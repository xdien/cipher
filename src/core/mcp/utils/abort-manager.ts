/**
 * AbortManager - Advanced Cancellation Management
 * 
 * Provides advanced cancellation and cleanup management for async operations,
 * extending the basic AbortController functionality with hierarchical cancellation
 * and cleanup callbacks.
 */

/**
 * Cleanup callback function type
 */
export type CleanupCallback = () => void | Promise<void>;

/**
 * Configuration for AbortManager
 */
export interface AbortManagerConfig {
  /** Timeout in milliseconds after which to auto-abort */
  timeout?: number;
  /** Parent abort signal to link with */
  parentSignal?: AbortSignal;
  /** Whether to run cleanup callbacks in reverse order */
  reverseCleanupOrder?: boolean;
}

/**
 * Enhanced abort controller with cleanup management and hierarchical cancellation
 */
export class AbortManager {
  private controller: AbortController;
  private cleanupCallbacks: CleanupCallback[] = [];
  private childManagers: Set<AbortManager> = new Set();
  private parentManager?: AbortManager;
  private timeoutId?: NodeJS.Timeout;
  private isAborted = false;
  private abortReason?: any;
  private config: AbortManagerConfig;

  constructor(config: AbortManagerConfig = {}) {
    this.config = config;
    this.controller = new AbortController();

    // Link with parent signal if provided
    if (config.parentSignal) {
      this.linkWithParentSignal(config.parentSignal);
    }

    // Set up timeout if configured
    if (config.timeout && config.timeout > 0) {
      this.timeoutId = setTimeout(() => {
        this.abort(new Error(`Operation timed out after ${config.timeout}ms`));
      }, config.timeout);
    }
  }

  /**
   * Get the abort signal
   * 
   * @returns AbortSignal that can be monitored
   */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /**
   * Check if the operation has been aborted
   * 
   * @returns True if aborted
   */
  get aborted(): boolean {
    return this.isAborted;
  }

  /**
   * Get the reason for abortion
   * 
   * @returns Abort reason if available
   */
  get reason(): any {
    return this.abortReason;
  }

  /**
   * Abort the operation with optional reason
   * 
   * @param reason Reason for aborting
   */
  abort(reason?: any): void {
    if (this.isAborted) {
      return;
    }

    this.isAborted = true;
    this.abortReason = reason;

    // Clear timeout if set
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    // Abort the controller
    this.controller.abort(reason);

    // Abort all child managers
    for (const child of this.childManagers) {
      child.abort(reason);
    }

    // Run cleanup callbacks
    this.runCleanupCallbacks();
  }

  /**
   * Add a cleanup callback to be run when aborted
   * 
   * @param callback Cleanup function to run
   * @returns Function to remove this cleanup callback
   */
  addCleanup(callback: CleanupCallback): () => void {
    if (this.isAborted) {
      // If already aborted, run cleanup immediately
      this.runSingleCleanup(callback);
      return () => {}; // No-op remover
    }

    this.cleanupCallbacks.push(callback);

    // Return a function to remove this callback
    return () => {
      const index = this.cleanupCallbacks.indexOf(callback);
      if (index >= 0) {
        this.cleanupCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Create a child abort manager that will be aborted when this one is
   * 
   * @param config Configuration for the child manager
   * @returns New child AbortManager
   */
  createChild(config: Omit<AbortManagerConfig, 'parentSignal'> = {}): AbortManager {
    const childConfig = {
      ...config,
      parentSignal: this.signal,
    };

    const child = new AbortManager(childConfig);
    child.parentManager = this;
    this.childManagers.add(child);

    // Remove child when it's disposed
    child.addCleanup(() => {
      this.childManagers.delete(child);
    });

    return child;
  }

  /**
   * Execute a function with automatic cleanup on abort
   * 
   * @param fn Function to execute
   * @param cleanup Optional cleanup function
   * @returns Promise that resolves with the function result or rejects if aborted
   */
  async execute<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    cleanup?: CleanupCallback
  ): Promise<T> {
    if (this.isAborted) {
      throw new Error('Cannot execute on aborted AbortManager');
    }

    let removeCleanup: (() => void) | undefined;
    
    if (cleanup) {
      removeCleanup = this.addCleanup(cleanup);
    }

    try {
      return await fn(this.signal);
    } finally {
      if (removeCleanup) {
        removeCleanup();
      }
    }
  }

  /**
   * Wait for abort signal
   * 
   * @returns Promise that resolves when aborted
   */
  async waitForAbort(): Promise<any> {
    if (this.isAborted) {
      return this.abortReason;
    }

    return new Promise((resolve) => {
      this.signal.addEventListener('abort', () => {
        resolve(this.abortReason);
      });
    });
  }

  /**
   * Create a promise that rejects when aborted
   * 
   * @param message Custom abort message
   * @returns Promise that never resolves but rejects when aborted
   */
  createAbortPromise(message = 'Operation was aborted'): Promise<never> {
    return new Promise((_, reject) => {
      if (this.isAborted) {
        reject(new Error(message));
        return;
      }

      this.signal.addEventListener('abort', () => {
        reject(new Error(message));
      });
    });
  }

  /**
   * Race a promise against the abort signal
   * 
   * @param promise Promise to race
   * @param abortMessage Message to use if aborted
   * @returns Promise that resolves with the original promise or rejects if aborted
   */
  async race<T>(promise: Promise<T>, abortMessage?: string): Promise<T> {
    return Promise.race([
      promise,
      this.createAbortPromise(abortMessage),
    ]);
  }

  /**
   * Combine multiple abort managers into one
   * 
   * @param managers Array of abort managers to combine
   * @returns New AbortManager that aborts when any of the input managers abort
   */
  static combine(managers: AbortManager[]): AbortManager {
    const combined = new AbortManager();

    for (const manager of managers) {
      if (manager.aborted) {
        combined.abort(manager.reason);
        break;
      }

      manager.signal.addEventListener('abort', () => {
        combined.abort(manager.reason);
      });
    }

    return combined;
  }

  /**
   * Create an AbortManager that aborts after a timeout
   * 
   * @param timeoutMs Timeout in milliseconds
   * @param reason Optional reason for timeout
   * @returns AbortManager that will auto-abort
   */
  static withTimeout(timeoutMs: number, reason?: any): AbortManager {
    return new AbortManager({
      timeout: timeoutMs,
    });
  }

  /**
   * Link with a parent abort signal
   */
  private linkWithParentSignal(parentSignal: AbortSignal): void {
    if (parentSignal.aborted) {
      this.abort(parentSignal.reason);
      return;
    }

    parentSignal.addEventListener('abort', () => {
      this.abort(parentSignal.reason);
    });
  }

  /**
   * Run all cleanup callbacks
   */
  private runCleanupCallbacks(): void {
    const callbacks = this.config.reverseCleanupOrder 
      ? [...this.cleanupCallbacks].reverse()
      : this.cleanupCallbacks;

    for (const callback of callbacks) {
      this.runSingleCleanup(callback);
    }

    this.cleanupCallbacks = [];
  }

  /**
   * Run a single cleanup callback with error handling
   */
  private runSingleCleanup(callback: CleanupCallback): void {
    try {
      const result = callback();
      if (result && typeof result.then === 'function') {
        // Handle async cleanup callback
        (result as Promise<void>).catch((error) => {
          console.error('Error in async cleanup callback:', error);
        });
      }
    } catch (error) {
      console.error('Error in cleanup callback:', error);
    }
  }

  /**
   * Clean up resources used by this abort manager
   */
  dispose(): void {
    this.abort('AbortManager disposed');
    
    if (this.parentManager) {
      this.parentManager.childManagers.delete(this);
    }
  }
} 