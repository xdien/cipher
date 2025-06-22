/**
 * MCP Errors - Connection and Recovery Error Classes
 * 
 * Exports all error classes and utilities for MCP connection error handling.
 */

// Connection errors
export {
  MCPConnectionError,
  ConnectionFailureError,
  ConnectionTimeoutError,
  ConnectionLostError,
  TransportError,
  StdioProcessError,
  HttpTransportError,
  ConfigurationError,
  ConnectionErrorUtils,
} from './connection-errors.js';

// Recovery errors
export {
  RecoveryError,
  RetryExhaustedError,
  CircuitBreakerOpenError,
  HealthCheckFailureError,
  RecoveryTimeoutError,
  RecoveryCancelledError,
  RecoveryErrorUtils,
} from './recovery-errors.js'; 