/**
 * Main Logger class - Primary interface for logging events
 */

import { Event, EventType, EventContext } from '../types/index.js';
import { AsyncEventBus } from './event-bus.js';

export class Logger {
  private namespace: string;
  private sessionId?: string;
  private eventBus: AsyncEventBus;
  private defaultContext?: EventContext;

  constructor(
    namespace: string, 
    sessionId?: string, 
    defaultContext?: EventContext
  ) {
    this.namespace = namespace;
    this.sessionId = sessionId;
    this.defaultContext = defaultContext;
    this.eventBus = AsyncEventBus.getInstance();
  }

  /**
   * Create a child logger with extended namespace
   */
  public child(
    childNamespace: string, 
    additionalContext?: EventContext
  ): Logger {
    const fullNamespace = `${this.namespace}.${childNamespace}`;
    const mergedContext = {
      ...this.defaultContext,
      ...additionalContext,
    };
    
    return new Logger(fullNamespace, this.sessionId, mergedContext);
  }

  /**
   * Log a debug message
   */
  public debug(
    message: string,
    name?: string,
    context?: EventContext,
    data?: Record<string, any>
  ): void {
    this.emitEvent('debug', message, name, context, data);
  }

  /**
   * Log an info message
   */
  public info(
    message: string,
    name?: string,
    context?: EventContext,
    data?: Record<string, any>
  ): void {
    this.emitEvent('info', message, name, context, data);
  }

  /**
   * Log a warning message
   */
  public warning(
    message: string,
    name?: string,
    context?: EventContext,
    data?: Record<string, any>
  ): void {
    this.emitEvent('warning', message, name, context, data);
  }

  /**
   * Log an error message
   */
  public error(
    message: string,
    name?: string,
    context?: EventContext,
    data?: Record<string, any>
  ): void {
    this.emitEvent('error', message, name, context, data);
  }

  /**
   * Log a progress message
   */
  public progress(
    message: string,
    name?: string,
    percentage?: number,
    context?: EventContext,
    data?: Record<string, any>
  ): void {
    const progressData = {
      ...data,
      percentage: percentage ?? 0,
    };
    this.emitEvent('progress', message, name, context, progressData);
  }

  /**
   * Log an error with Error object or any error-like object
   */
  public exception(
    error: Error | any,
    message?: string,
    name?: string,
    context?: EventContext,
    data?: Record<string, any>
  ): void {
    let errorData: Record<string, any>;
    
    if (error instanceof Error) {
      // Handle actual Error objects
      errorData = {
        ...data,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
    } else {
      // Handle non-Error objects (preserve original structure)
      errorData = {
        ...data,
        error: error,
      };
    }

    this.emitEvent(
      'error',
      message || (error instanceof Error ? error.message : String(error)),
      name,
      context,
      errorData
    );
  }

  /**
   * Create a timed operation logger
   */
  public timer(operationName: string): TimedOperation {
    return new TimedOperation(this, operationName);
  }

  /**
   * Main event emission method
   */
  private emitEvent(
    type: EventType,
    message: string,
    name?: string,
    context?: EventContext,
    data?: Record<string, any>
  ): void {
    const event: Event = {
      type,
      name,
      namespace: this.namespace,
      message,
      timestamp: new Date(),
      data: data,
      context: {
        ...this.defaultContext,
        ...context,
        sessionId: this.sessionId || context?.sessionId,
      },
    };

    // Emit asynchronously without blocking
    this.eventBus.emit(event).catch((error) => {
      console.error('Failed to emit event:', error);
    });
  }

  /**
   * Get the logger's namespace
   */
  public get loggerNamespace(): string {
    return this.namespace;
  }

  /**
   * Get the logger's session ID
   */
  public get loggerSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Update the default context for this logger
   */
  public setDefaultContext(context: EventContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }
}

/**
 * Helper class for timed operations
 */
export class TimedOperation {
  private logger: Logger;
  private operationName: string;
  private startTime: Date;
  private context?: EventContext;

  constructor(logger: Logger, operationName: string) {
    this.logger = logger;
    this.operationName = operationName;
    this.startTime = new Date();
  }

  /**
   * Set context for the timed operation
   */
  public withContext(context: EventContext): TimedOperation {
    this.context = context;
    return this;
  }

  /**
   * Start the timer and log start event
   */
  public start(message?: string): TimedOperation {
    this.logger.info(
      message || `Starting ${this.operationName}`,
      this.operationName,
      this.context,
      { operation: 'start' }
    );
    return this;
  }

  /**
   * End the timer and log completion
   */
  public end(message?: string, data?: Record<string, any>): void {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    this.logger.info(
      message || `Completed ${this.operationName}`,
      this.operationName,
      this.context,
      {
        ...data,
        operation: 'end',
        duration_ms: duration,
        start_time: this.startTime.toISOString(),
        end_time: endTime.toISOString(),
      }
    );
  }

  /**
   * End the timer with an error
   */
  public error(error: Error, message?: string, data?: Record<string, any>): void {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    this.logger.exception(
      error,
      message || `Failed ${this.operationName}`,
      this.operationName,
      this.context,
      {
        ...data,
        operation: 'error',
        duration_ms: duration,
        start_time: this.startTime.toISOString(),
        end_time: endTime.toISOString(),
      }
    );
  }
}
