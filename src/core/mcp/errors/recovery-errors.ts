/**
 * Recovery Errors - Connection Recovery Specific Errors
 * 
 * Provides specialized error classes for connection recovery scenarios,
 * enabling sophisticated retry and fallback strategies.
 */

import { MCPConnectionError } from './connection-errors.js';

/**
 * Base class for recovery-related errors
 */
export abstract class RecoveryError extends Error {
  public readonly serverName: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, serverName: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.serverName = serverName;
    this.timestamp = new Date();
    this.context = context;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      serverName: this.serverName,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when all retry attempts have been exhausted
 */
export class RetryExhaustedError extends RecoveryError {
  public readonly attempts: number;
  public readonly lastError: Error;
  public readonly attemptHistory: Array<{
    attempt: number;
    timestamp: Date;
    error: Error;
    delayMs?: number;
  }>;

  constructor(
    message: string,
    serverName: string,
    attempts: number,
    lastError: Error,
    attemptHistory: Array<{
      attempt: number;
      timestamp: Date;
      error: Error;
      delayMs?: number;
    }>
  ) {
    super(message, serverName, { attempts, lastError: lastError.message });
    this.attempts = attempts;
    this.lastError = lastError;
    this.attemptHistory = attemptHistory;
  }

  /**
   * Get a summary of all retry attempts
   */
  getAttemptSummary(): string {
    const summaries = this.attemptHistory.map(attempt => {
      const delay = attempt.delayMs ? ` (after ${attempt.delayMs}ms delay)` : '';
      return `Attempt ${attempt.attempt}${delay}: ${attempt.error.message}`;
    });
    return summaries.join('\n');
  }

  /**
   * Get the total time spent on retry attempts
   */
  getTotalRetryTime(): number {
    if (this.attemptHistory.length < 2) return 0;
    
    const first = this.attemptHistory[0].timestamp;
    const last = this.attemptHistory[this.attemptHistory.length - 1].timestamp;
    return last.getTime() - first.getTime();
  }
}

/**
 * Error thrown when circuit breaker is open and preventing operations
 */
export class CircuitBreakerOpenError extends RecoveryError {
  public readonly failureCount: number;
  public readonly lastFailureTime: Date;
  public readonly nextRetryTime: Date;

  constructor(
    message: string,
    serverName: string,
    failureCount: number,
    lastFailureTime: Date,
    nextRetryTime: Date
  ) {
    super(message, serverName, {
      failureCount,
      lastFailureTime: lastFailureTime.toISOString(),
      nextRetryTime: nextRetryTime.toISOString(),
    });
    this.failureCount = failureCount;
    this.lastFailureTime = lastFailureTime;
    this.nextRetryTime = nextRetryTime;
  }

  /**
   * Get time remaining until circuit breaker allows retry
   */
  getTimeUntilRetry(): number {
    return Math.max(0, this.nextRetryTime.getTime() - Date.now());
  }

  /**
   * Check if circuit breaker should allow retry now
   */
  canRetryNow(): boolean {
    return Date.now() >= this.nextRetryTime.getTime();
  }
}

// Removed unused error types: RecoveryStrategyError, FallbackFailureError

/**
 * Error thrown when health check fails repeatedly
 */
export class HealthCheckFailureError extends RecoveryError {
  public readonly consecutiveFailures: number;
  public readonly lastSuccessfulCheck?: Date;
  public readonly healthCheckErrors: Error[];

  constructor(
    message: string,
    serverName: string,
    consecutiveFailures: number,
    healthCheckErrors: Error[],
    lastSuccessfulCheck?: Date
  ) {
    super(message, serverName, {
      consecutiveFailures,
      lastSuccessfulCheck: lastSuccessfulCheck?.toISOString(),
      errorCount: healthCheckErrors.length,
    });
    this.consecutiveFailures = consecutiveFailures;
    this.lastSuccessfulCheck = lastSuccessfulCheck;
    this.healthCheckErrors = healthCheckErrors;
  }

  /**
   * Get time since last successful health check
   */
  getTimeSinceLastSuccess(): number | undefined {
    if (!this.lastSuccessfulCheck) return undefined;
    return Date.now() - this.lastSuccessfulCheck.getTime();
  }

  /**
   * Get the most recent health check error
   */
  getLatestHealthCheckError(): Error | undefined {
    return this.healthCheckErrors[this.healthCheckErrors.length - 1];
  }
}

/**
 * Error thrown when recovery timeout is exceeded
 */
export class RecoveryTimeoutError extends RecoveryError {
  public readonly timeoutMs: number;
  public readonly startTime: Date;
  public readonly attempts: number;

  constructor(
    message: string,
    serverName: string,
    timeoutMs: number,
    startTime: Date,
    attempts: number
  ) {
    super(message, serverName, {
      timeoutMs,
      startTime: startTime.toISOString(),
      attempts,
      actualDuration: Date.now() - startTime.getTime(),
    });
    this.timeoutMs = timeoutMs;
    this.startTime = startTime;
    this.attempts = attempts;
  }

  /**
   * Get actual time spent on recovery attempts
   */
  getActualDuration(): number {
    return Date.now() - this.startTime.getTime();
  }
}

/**
 * Error thrown when a recovery operation is cancelled
 */
export class RecoveryCancelledError extends RecoveryError {
  public readonly reason: string;
  public readonly wasInProgress: boolean;

  constructor(
    message: string,
    serverName: string,
    reason: string,
    wasInProgress = true
  ) {
    super(message, serverName, { reason, wasInProgress });
    this.reason = reason;
    this.wasInProgress = wasInProgress;
  }
}

/**
 * Utility functions for working with recovery errors
 */
export class RecoveryErrorUtils {
  /**
   * Check if an error indicates that recovery should be attempted
   */
  static shouldAttemptRecovery(error: Error): boolean {
    // Circuit breaker open - should wait
    if (error instanceof CircuitBreakerOpenError) {
      return error.canRetryNow();
    }

    // Retry exhausted - should not retry
    if (error instanceof RetryExhaustedError) {
      return false;
    }

    // Recovery cancelled - should not retry
    if (error instanceof RecoveryCancelledError) {
      return false;
    }

    // Recovery timeout - should not retry immediately
    if (error instanceof RecoveryTimeoutError) {
      return false;
    }

    // MCP connection errors - check if recoverable
    if (error instanceof MCPConnectionError) {
      return error.recoverable;
    }

    // Other errors - attempt recovery
    return true;
  }

  /**
   * Extract recovery context from error
   */
  static getRecoveryContext(error: Error): Record<string, any> {
    if (error instanceof RecoveryError) {
      return error.context || {};
    }

    if (error instanceof MCPConnectionError) {
      return {
        serverName: error.serverName,
        recoverable: error.recoverable,
        errorCode: error.errorCode,
        timestamp: error.timestamp,
      };
    }

    return {};
  }

  /**
   * Calculate delay for next retry attempt based on error history
   */
  static calculateRetryDelay(
    errors: Error[],
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2
  ): number {
    const attempt = errors.length;
    const delay = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }

  /**
   * Check if an error pattern indicates a persistent issue
   */
  static isPersistentIssue(errors: Error[], windowMs = 300000): boolean {
    if (errors.length < 3) return false;

    const now = Date.now();
    const recentErrors = errors.filter(error => {
      const timestamp = error instanceof RecoveryError 
        ? error.timestamp.getTime()
        : error instanceof MCPConnectionError
        ? error.timestamp.getTime()
        : now; // Assume recent if no timestamp
      
      return (now - timestamp) <= windowMs;
    });

    // Persistent issue if we have many recent errors
    return recentErrors.length >= 3;
  }

  /**
   * Create a recovery summary from multiple errors
   */
  static createRecoverySummary(errors: Error[]): string {
    const errorCounts = new Map<string, number>();
    
    for (const error of errors) {
      const type = error.constructor.name;
      errorCounts.set(type, (errorCounts.get(type) || 0) + 1);
    }

    const summaries: string[] = [];
    for (const [type, count] of errorCounts) {
      summaries.push(`${type}: ${count}`);
    }

    return `Recovery attempts: ${errors.length} (${summaries.join(', ')})`;
  }
} 