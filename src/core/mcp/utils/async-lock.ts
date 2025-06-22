/**
 * AsyncLock - Promise-based Mutual Exclusion
 * 
 * Provides async mutual exclusion for critical sections in TypeScript,
 * ensuring thread-safe access to shared resources.
 */

/**
 * An async lock for mutual exclusion
 * Ensures only one async operation can access a critical section at a time
 */
export class AsyncLock {
  private queue: Array<() => void> = [];
  private locked = false;

  /**
   * Acquire the lock
   * 
   * @returns Promise that resolves when the lock is acquired
   */
  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  /**
   * Release the lock
   * 
   * Allows the next queued operation to acquire the lock
   */
  release(): void {
    if (!this.locked) {
      throw new Error('Cannot release a lock that is not acquired');
    }

    const next = this.queue.shift();
    if (next) {
      // Pass the lock to the next waiter
      next();
    } else {
      // No one waiting, unlock
      this.locked = false;
    }
  }

  /**
   * Execute a function while holding the lock
   * 
   * Automatically acquires the lock, executes the function, and releases the lock
   * even if the function throws an error.
   * 
   * @param fn Function to execute while holding the lock
   * @returns Promise resolving to the function's return value
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Execute a synchronous function while holding the lock
   * 
   * @param fn Synchronous function to execute while holding the lock
   * @returns Promise resolving to the function's return value
   */
  async withLockSync<T>(fn: () => T): Promise<T> {
    await this.acquire();
    try {
      return fn();
    } finally {
      this.release();
    }
  }

  /**
   * Try to acquire the lock without waiting
   * 
   * @returns True if the lock was acquired, false if it's already held
   */
  tryAcquire(): boolean {
    if (this.locked) {
      return false;
    }
    
    this.locked = true;
    return true;
  }

  /**
   * Check if the lock is currently held
   * 
   * @returns True if the lock is currently held
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get the number of operations waiting for the lock
   * 
   * @returns Number of queued operations
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Acquire the lock with a timeout
   * 
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves when lock is acquired or rejects on timeout
   */
  async acquireWithTimeout(timeoutMs: number): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Lock acquisition timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([this.acquire(), timeoutPromise]);
  }

  /**
   * Execute a function while holding the lock with a timeout
   * 
   * @param fn Function to execute while holding the lock
   * @param timeoutMs Timeout in milliseconds for acquiring the lock
   * @returns Promise resolving to the function's return value
   */
  async withLockTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    await this.acquireWithTimeout(timeoutMs);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
} 