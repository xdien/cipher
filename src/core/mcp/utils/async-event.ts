/**
 * AsyncEvent - Promise-based Event Coordination
 * 
 * Provides async event coordination similar to Python's anyio.Event
 * but using Promise-based patterns suitable for TypeScript/JavaScript.
 */

/**
 * An async event that can be set and waited on by multiple consumers
 * Similar to Python's anyio.Event but using Promise-based coordination
 */
export class AsyncEvent {
  private promise: Promise<void>;
  private resolve!: () => void;
  private isEventSet = false;

  constructor() {
    this.reset();
  }

  /**
   * Wait for the event to be set
   * 
   * @returns Promise that resolves when the event is set
   */
  async wait(): Promise<void> {
    return this.promise;
  }

  /**
   * Set the event, resolving all waiting promises
   */
  set(): void {
    if (!this.isEventSet) {
      this.isEventSet = true;
      this.resolve();
    }
  }

  /**
   * Clear the event, creating a new promise for future waiters
   */
  clear(): void {
    if (this.isEventSet) {
      this.reset();
    }
  }

  /**
   * Check if the event is currently set
   * 
   * @returns True if the event is set
   */
  isSet(): boolean {
    return this.isEventSet;
  }

  /**
   * Reset the event to its initial state
   */
  private reset(): void {
    this.isEventSet = false;
    this.promise = new Promise<void>((resolve) => {
      this.resolve = resolve;
    });
  }

  /**
   * Wait for the event with a timeout
   * 
   * @param timeoutMs Timeout in milliseconds
   * @returns Promise that resolves when event is set or rejects on timeout
   */
  async waitWithTimeout(timeoutMs: number): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Event wait timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([this.wait(), timeoutPromise]);
  }

  /**
   * Create an event that's already set
   * 
   * @returns A pre-set AsyncEvent
   */
  static createSet(): AsyncEvent {
    const event = new AsyncEvent();
    event.set();
    return event;
  }
} 