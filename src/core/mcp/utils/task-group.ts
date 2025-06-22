/**
 * TaskGroup - Concurrent Task Management
 * 
 * Provides structured concurrency similar to Python's anyio.create_task_group()
 * for managing multiple async operations with proper cleanup and error handling.
 */

/**
 * Result of a task execution
 */
export interface TaskResult<T = any> {
  status: 'fulfilled' | 'rejected';
  value?: T;
  reason?: any;
  taskId: string;
}

/**
 * Configuration for TaskGroup behavior
 */
export interface TaskGroupConfig {
  /** Maximum number of concurrent tasks (0 = unlimited) */
  maxConcurrency?: number;
  /** Whether to abort all tasks when one fails */
  abortOnFirstError?: boolean;
  /** Timeout for individual tasks in milliseconds */
  taskTimeout?: number;
  /** Timeout for the entire group in milliseconds */
  groupTimeout?: number;
}

/**
 * A group for managing concurrent async tasks with proper cleanup
 * Similar to Python's anyio.create_task_group()
 */
export class TaskGroup {
  private tasks = new Map<string, Promise<any>>();
  private abortController = new AbortController();
  private isAborted = false;
  private isFinalized = false;
  private taskCounter = 0;
  private config: Required<TaskGroupConfig>;
  private semaphore?: AsyncSemaphore;

  constructor(config: TaskGroupConfig = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || 0,
      abortOnFirstError: config.abortOnFirstError || false,
      taskTimeout: config.taskTimeout || 0,
      groupTimeout: config.groupTimeout || 0,
    };

    if (this.config.maxConcurrency > 0) {
      this.semaphore = new AsyncSemaphore(this.config.maxConcurrency);
    }
  }

  /**
   * Start a new task in the group
   * 
   * @param taskFn Function to execute as a task
   * @param taskId Optional custom task ID
   * @returns Promise that resolves to the task result
   */
  async start<T>(taskFn: () => Promise<T>, taskId?: string): Promise<T> {
    if (this.isAborted) {
      throw new Error('TaskGroup has been aborted');
    }

    if (this.isFinalized) {
      throw new Error('TaskGroup has been finalized');
    }

    const id = taskId || `task-${++this.taskCounter}`;
    
    if (this.tasks.has(id)) {
      throw new Error(`Task with ID '${id}' already exists`);
    }

    // Create the task with proper error handling and timeout
    const task = this.createManagedTask(taskFn, id);
    this.tasks.set(id, task);

    // If abortOnFirstError is enabled, handle task failures
    if (this.config.abortOnFirstError) {
      task.catch(() => {
        if (!this.isAborted) {
          this.abort();
        }
      });
    }

    return task;
  }

  /**
   * Start a task without waiting for its completion
   * 
   * @param taskFn Function to execute as a background task
   * @param taskId Optional custom task ID
   * @returns Task ID for later reference
   */
  startInBackground<T>(taskFn: () => Promise<T>, taskId?: string): string {
    if (this.isAborted) {
      throw new Error('TaskGroup has been aborted');
    }

    if (this.isFinalized) {
      throw new Error('TaskGroup has been finalized');
    }

    const id = taskId || `background-task-${++this.taskCounter}`;
    
    if (this.tasks.has(id)) {
      throw new Error(`Task with ID '${id}' already exists`);
    }

    const task = this.createManagedTask(taskFn, id);
    this.tasks.set(id, task);

    // Handle background task errors
    task.catch((error) => {
      if (this.config.abortOnFirstError && !this.isAborted) {
        this.abort();
      }
    });

    return id;
  }

  /**
   * Wait for all tasks to complete
   * 
   * @returns Array of task results
   */
  async waitForAll(): Promise<TaskResult[]> {
    if (this.isFinalized) {
      throw new Error('TaskGroup has already been finalized');
    }

    try {
      let groupPromise: Promise<PromiseSettledResult<any>[]> = Promise.allSettled(
        Array.from(this.tasks.values())
      );

      // Apply group timeout if configured
      if (this.config.groupTimeout > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            this.abort();
            reject(new Error(`TaskGroup timed out after ${this.config.groupTimeout}ms`));
          }, this.config.groupTimeout);
        });

        groupPromise = Promise.race([groupPromise, timeoutPromise]);
      }

      const results = await groupPromise;
      
      return Array.from(this.tasks.keys()).map((taskId, index) => ({
        taskId,
        status: results[index].status,
        value: results[index].status === 'fulfilled' ? results[index].value : undefined,
        reason: results[index].status === 'rejected' ? results[index].reason : undefined,
      }));

    } finally {
      this.isFinalized = true;
    }
  }

  /**
   * Abort all tasks in the group
   */
  abort(): void {
    if (!this.isAborted) {
      this.isAborted = true;
      this.abortController.abort();
    }
  }

  /**
   * Get the abort signal for tasks to check
   * 
   * @returns AbortSignal that tasks can monitor
   */
  getAbortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Check if the task group has been aborted
   * 
   * @returns True if aborted
   */
  isGroupAborted(): boolean {
    return this.isAborted;
  }

  /**
   * Get the number of active tasks
   * 
   * @returns Number of running tasks
   */
  getActiveTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Get all task IDs
   * 
   * @returns Array of task IDs
   */
  getTaskIds(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Wait for a specific task by ID
   * 
   * @param taskId ID of the task to wait for
   * @returns Task result
   */
  async waitForTask<T>(taskId: string): Promise<T> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task with ID '${taskId}' not found`);
    }
    return task;
  }

  /**
   * Create a managed task with timeout and abort signal support
   */
  private async createManagedTask<T>(taskFn: () => Promise<T>, taskId: string): Promise<T> {
    // Apply concurrency control if configured
    if (this.semaphore) {
      await this.semaphore.acquire();
    }

    try {
      // Create the main task
      let taskPromise = taskFn();

      // Wrap with abort signal monitoring
      if (this.abortController.signal.aborted) {
        throw new Error(`Task '${taskId}' aborted before execution`);
      }

      // Apply task timeout if configured
      if (this.config.taskTimeout > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Task '${taskId}' timed out after ${this.config.taskTimeout}ms`));
          }, this.config.taskTimeout);
        });

        taskPromise = Promise.race([taskPromise, timeoutPromise]);
      }

      // Monitor abort signal during execution
      const abortPromise = new Promise<never>((_, reject) => {
        if (this.abortController.signal.aborted) {
          reject(new Error(`Task '${taskId}' was aborted`));
          return;
        }
        
        this.abortController.signal.addEventListener('abort', () => {
          reject(new Error(`Task '${taskId}' was aborted`));
        });
      });

      return await Promise.race([taskPromise, abortPromise]);

    } finally {
      // Release semaphore permit
      if (this.semaphore) {
        this.semaphore.release();
      }
    }
  }
}

/**
 * Simple semaphore for controlling concurrency
 */
class AsyncSemaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(initialPermits: number) {
    this.permits = initialPermits;
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    } else {
      this.permits++;
    }
  }

  getAvailablePermits(): number {
    return this.permits;
  }

  getQueueLength(): number {
    return this.waitQueue.length;
  }
} 