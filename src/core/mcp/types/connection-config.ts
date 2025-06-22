/**
 * Connection Configuration Types - Enhanced MCP Connection Configuration
 * 
 * Provides comprehensive configuration types and validation schemas for
 * the persistent connection management system.
 */

import { z } from 'zod';

/**
 * Health check configuration schema
 */
export const HealthCheckConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().min(1000).default(30000), // 30 seconds minimum
  timeout: z.number().min(500).default(5000), // 5 seconds
  maxConsecutiveFailures: z.number().min(1).default(3),
  gracePeriod: z.number().min(0).default(5000), // 5 seconds
  enableMetrics: z.boolean().default(true),
  enableAutoRecovery: z.boolean().default(true),
  maxRecoveryAttempts: z.number().min(1).default(3),
  recoveryDelay: z.number().min(1000).default(10000), // 10 seconds
});

/**
 * Circuit breaker configuration schema
 */
export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().min(1).default(5),
  resetTimeoutMs: z.number().min(1000).default(60000), // 1 minute
  operationTimeoutMs: z.number().min(1000).default(30000), // 30 seconds
  successThreshold: z.number().min(1).default(2),
  rollingWindowMs: z.number().min(10000).default(60000), // 1 minute
  minimumOperations: z.number().min(1).default(5),
});

/**
 * Retry strategy configuration schema
 */
export const RetryStrategyConfigSchema = z.object({
  strategy: z.enum(['exponential', 'linear', 'fixed', 'immediate', 'custom']).default('exponential'),
  maxAttempts: z.number().min(1).default(3),
  baseDelayMs: z.number().min(0).default(1000),
  maxDelayMs: z.number().min(1000).default(30000),
  backoffMultiplier: z.number().min(1).default(2),
  jitter: z.boolean().default(true),
  jitterFactor: z.number().min(0).max(1).default(0.1),
  maxTotalTimeMs: z.number().min(1000).optional(),
});

/**
 * Connection pool configuration schema
 */
export const ConnectionPoolConfigSchema = z.object({
  persistentConnections: z.boolean().default(true),
  maxPoolSize: z.number().min(1).default(20),
  connectionTimeout: z.number().min(1000).default(60000),
  healthCheckInterval: z.number().min(1000).default(30000),
  maxRetryAttempts: z.number().min(1).default(3),
  idleTimeout: z.number().min(30000).default(300000), // 5 minutes
  enableConnectionWarming: z.boolean().default(true),
  warmupOnStartup: z.boolean().default(false),
});

/**
 * Lifecycle manager configuration schema
 */
export const LifecycleManagerConfigSchema = z.object({
  maxConcurrentConnections: z.number().min(1).default(20),
  enableAutoRecovery: z.boolean().default(true),
  maxRecoveryAttempts: z.number().min(1).default(3),
  recoveryDelay: z.number().min(1000).default(10000),
  connectionTimeout: z.number().min(1000).default(60000),
  shutdownTimeout: z.number().min(1000).default(30000),
  autoStartHealthMonitoring: z.boolean().default(true),
  healthMonitor: HealthCheckConfigSchema.partial().optional(),
});


/**
 * Type definitions
 */
export type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>;
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;
export type RetryStrategyConfig = z.infer<typeof RetryStrategyConfigSchema>;
export type ConnectionPoolConfig = z.infer<typeof ConnectionPoolConfigSchema>;
export type LifecycleManagerConfig = z.infer<typeof LifecycleManagerConfigSchema>;

/**
 * Default configurations
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  interval: 30000,
  timeout: 5000,
  maxConsecutiveFailures: 3,
  gracePeriod: 5000,
  enableMetrics: true,
  enableAutoRecovery: true,
  maxRecoveryAttempts: 3,
  recoveryDelay: 10000,
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  operationTimeoutMs: 30000,
  successThreshold: 2,
  rollingWindowMs: 60000,
  minimumOperations: 5,
};

export const DEFAULT_RETRY_STRATEGY_CONFIG: RetryStrategyConfig = {
  strategy: 'exponential',
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  jitterFactor: 0.1,
};

export const DEFAULT_CONNECTION_POOL_CONFIG: ConnectionPoolConfig = {
  persistentConnections: true,
  maxPoolSize: 20,
  connectionTimeout: 60000,
  healthCheckInterval: 30000,
  maxRetryAttempts: 3,
  idleTimeout: 300000,
  enableConnectionWarming: true,
  warmupOnStartup: false,
};

export const DEFAULT_LIFECYCLE_MANAGER_CONFIG: LifecycleManagerConfig = {
  maxConcurrentConnections: 20,
  enableAutoRecovery: true,
  maxRecoveryAttempts: 3,
  recoveryDelay: 10000,
  connectionTimeout: 60000,
  shutdownTimeout: 30000,
  autoStartHealthMonitoring: true,
};

/**
 * Configuration validation utilities
 */
export class ConfigurationValidator {
  /**
   * Validate health check configuration
   */
  static validateHealthCheckConfig(config: any): HealthCheckConfig {
    return HealthCheckConfigSchema.parse(config);
  }

  /**
   * Validate circuit breaker configuration
   */
  static validateCircuitBreakerConfig(config: any): CircuitBreakerConfig {
    return CircuitBreakerConfigSchema.parse(config);
  }

  /**
   * Validate retry strategy configuration
   */
  static validateRetryStrategyConfig(config: any): RetryStrategyConfig {
    return RetryStrategyConfigSchema.parse(config);
  }

  /**
   * Validate connection pool configuration
   */
  static validateConnectionPoolConfig(config: any): ConnectionPoolConfig {
    return ConnectionPoolConfigSchema.parse(config);
  }

  /**
   * Validate lifecycle manager configuration
   */
  static validateLifecycleManagerConfig(config: any): LifecycleManagerConfig {
    return LifecycleManagerConfigSchema.parse(config);
  }
} 