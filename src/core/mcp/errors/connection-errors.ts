/**
 * Connection Errors - MCP Connection Specific Errors
 * 
 * Provides specialized error classes for different types of MCP connection failures,
 * enabling better error handling and recovery strategies.
 */

/**
 * Base class for all MCP connection-related errors
 */
export abstract class MCPConnectionError extends Error {
  public readonly serverName: string;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;
  public readonly errorCode: string;

  constructor(
    message: string,
    serverName: string,
    recoverable = true,
    errorCode = 'MCP_CONNECTION_ERROR'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.serverName = serverName;
    this.recoverable = recoverable;
    this.timestamp = new Date();
    this.errorCode = errorCode;

    // Ensure the prototype chain is correct
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to a serializable object
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      serverName: this.serverName,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      errorCode: this.errorCode,
      stack: this.stack,
    };
  }

  /**
   * Get a user-friendly error description
   */
  getUserFriendlyMessage(): string {
    return `Connection to server '${this.serverName}' failed: ${this.message}`;
  }
}

/**
 * Error thrown when initial connection to an MCP server fails
 */
export class ConnectionFailureError extends MCPConnectionError {
  public readonly attempt: number;
  public readonly cause?: Error;

  constructor(
    message: string,
    serverName: string,
    attempt = 1,
    cause?: Error,
    recoverable = true
  ) {
    super(message, serverName, recoverable, 'CONNECTION_FAILURE');
    this.attempt = attempt;
    this.cause = cause;
  }

  getUserFriendlyMessage(): string {
    const attemptText = this.attempt > 1 ? ` (attempt ${this.attempt})` : '';
    return `Failed to connect to server '${this.serverName}'${attemptText}: ${this.message}`;
  }
}

/**
 * Error thrown when connection times out
 */
export class ConnectionTimeoutError extends MCPConnectionError {
  public readonly timeoutMs: number;

  constructor(message: string, serverName: string, timeoutMs: number) {
    super(message, serverName, true, 'CONNECTION_TIMEOUT');
    this.timeoutMs = timeoutMs;
  }

  getUserFriendlyMessage(): string {
    return `Connection to server '${this.serverName}' timed out after ${this.timeoutMs}ms`;
  }
}

/**
 * Error thrown when an established connection is lost
 */
export class ConnectionLostError extends MCPConnectionError {
  public readonly lastSuccessfulOperation?: Date;
  public readonly cause?: Error;

  constructor(
    message: string,
    serverName: string,
    lastSuccessfulOperation?: Date,
    cause?: Error
  ) {
    super(message, serverName, true, 'CONNECTION_LOST');
    this.lastSuccessfulOperation = lastSuccessfulOperation;
    this.cause = cause;
  }

  getUserFriendlyMessage(): string {
    const lastOpText = this.lastSuccessfulOperation 
      ? ` (last successful operation: ${this.lastSuccessfulOperation.toLocaleString()})`
      : '';
    return `Lost connection to server '${this.serverName}'${lastOpText}: ${this.message}`;
  }
}

/**
 * Error thrown when transport-specific issues occur
 */
export class TransportError extends MCPConnectionError {
  public readonly transportType: 'stdio' | 'http' | 'sse' | 'websocket';
  public readonly transportDetails?: Record<string, any>;

  constructor(
    message: string,
    serverName: string,
    transportType: 'stdio' | 'http' | 'sse' | 'websocket',
    transportDetails?: Record<string, any>,
    recoverable = true
  ) {
    super(message, serverName, recoverable, 'TRANSPORT_ERROR');
    this.transportType = transportType;
    this.transportDetails = transportDetails;
  }

  getUserFriendlyMessage(): string {
    return `${this.transportType.toUpperCase()} transport error for server '${this.serverName}': ${this.message}`;
  }
}

/**
 * Error thrown when stdio process fails to start or exits unexpectedly
 */
export class StdioProcessError extends TransportError {
  public readonly exitCode?: number;
  public readonly signal?: string;
  public readonly command: string;
  public readonly args: string[];

  constructor(
    message: string,
    serverName: string,
    command: string,
    args: string[],
    exitCode?: number,
    signal?: string
  ) {
    super(message, serverName, 'stdio', { command, args, exitCode, signal }, false);
    this.exitCode = exitCode;
    this.signal = signal;
    this.command = command;
    this.args = args;
  }

  getUserFriendlyMessage(): string {
    const commandText = `${this.command} ${this.args.join(' ')}`;
    const exitText = this.exitCode !== undefined 
      ? ` (exit code: ${this.exitCode})`
      : this.signal 
      ? ` (signal: ${this.signal})`
      : '';
    return `Stdio process for server '${this.serverName}' failed${exitText}: ${commandText}`;
  }
}

/**
 * Error thrown when HTTP/SSE server returns error responses
 */
export class HttpTransportError extends TransportError {
  public readonly statusCode?: number;
  public readonly statusText?: string;
  public readonly url: string;
  public readonly headers?: Record<string, string>;

  constructor(
    message: string,
    serverName: string,
    transportType: 'http' | 'sse',
    url: string,
    statusCode?: number,
    statusText?: string,
    headers?: Record<string, string>
  ) {
    const recoverable = statusCode ? statusCode >= 500 : true; // Server errors are recoverable
    super(message, serverName, transportType, { url, statusCode, statusText, headers }, recoverable);
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.url = url;
    this.headers = headers;
  }

  getUserFriendlyMessage(): string {
    const statusText = this.statusCode 
      ? ` (${this.statusCode}${this.statusText ? ` ${this.statusText}` : ''})`
      : '';
    return `HTTP error for server '${this.serverName}' at ${this.url}${statusText}: ${this.message}`;
  }
}

// Removed unused error types: AuthenticationError, CapabilityMismatchError

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends MCPConnectionError {
  public readonly configField?: string;
  public readonly configValue?: any;

  constructor(
    message: string,
    serverName: string,
    configField?: string,
    configValue?: any
  ) {
    super(message, serverName, false, 'CONFIGURATION_ERROR'); // Config errors are not recoverable
    this.configField = configField;
    this.configValue = configValue;
  }

  getUserFriendlyMessage(): string {
    const fieldText = this.configField ? ` in field '${this.configField}'` : '';
    return `Configuration error for server '${this.serverName}'${fieldText}: ${this.message}`;
  }
}

/**
 * Utility functions for working with connection errors
 */
export class ConnectionErrorUtils {
  /**
   * Check if an error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    if (error instanceof MCPConnectionError) {
      return error.recoverable;
    }
    // Unknown errors are considered recoverable by default
    return true;
  }

  /**
   * Extract server name from error if available
   */
  static getServerName(error: Error): string | undefined {
    if (error instanceof MCPConnectionError) {
      return error.serverName;
    }
    return undefined;
  }

  /**
   * Get error code from error if available
   */
  static getErrorCode(error: Error): string {
    if (error instanceof MCPConnectionError) {
      return error.errorCode;
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Convert any error to a standardized connection error
   */
  static normalize(error: Error, serverName: string): MCPConnectionError {
    if (error instanceof MCPConnectionError) {
      return error;
    }

    // Try to infer error type from message
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return new ConnectionTimeoutError(error.message, serverName, 0);
    }
    
    if (message.includes('econnrefused') || message.includes('connection refused')) {
      return new ConnectionFailureError(error.message, serverName, 1, error);
    }
    
    if (message.includes('enotfound') || message.includes('dns')) {
      return new ConnectionFailureError(error.message, serverName, 1, error, false);
    }

    // Default to generic connection failure
    return new ConnectionFailureError(error.message, serverName, 1, error);
  }

  /**
   * Create a summary of multiple connection errors
   */
  static summarizeErrors(errors: MCPConnectionError[]): string {
    const errorsByType = new Map<string, MCPConnectionError[]>();
    
    for (const error of errors) {
      const type = error.constructor.name;
      if (!errorsByType.has(type)) {
        errorsByType.set(type, []);
      }
      errorsByType.get(type)!.push(error);
    }

    const summaries: string[] = [];
    for (const [type, typeErrors] of errorsByType) {
      const servers = typeErrors.map(e => e.serverName).join(', ');
      summaries.push(`${type}: ${servers}`);
    }

    return summaries.join('; ');
  }
} 