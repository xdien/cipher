/**
 * MCP Types - Type Definitions
 * 
 * Exports all MCP type definitions including client interfaces,
 * configuration schemas, and other type definitions.
 */

// Configuration types
export {
  type McpServerConfig,
  type ServerConfigs,
  McpServerConfigSchema,
  ServerConfigsSchema,
} from './config.js';

// Connection configuration types
export {
  type HealthCheckConfig,
  type CircuitBreakerConfig,
  type RetryStrategyConfig,
  type ConnectionPoolConfig,
  type LifecycleManagerConfig,
  HealthCheckConfigSchema,
  CircuitBreakerConfigSchema,
  RetryStrategyConfigSchema,
  ConnectionPoolConfigSchema,
  LifecycleManagerConfigSchema,
  ConfigurationValidator,
  DEFAULT_HEALTH_CHECK_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_RETRY_STRATEGY_CONFIG,
  DEFAULT_CONNECTION_POOL_CONFIG,
  DEFAULT_LIFECYCLE_MANAGER_CONFIG,
} from './connection-config.js';

// Enhanced client types
export {
  type IEnhancedMCPClient,
  type ISamplingCallback,
  type IListRootsCallback,
  type ISessionIdCallback,
  type SamplingParams,
  type SamplingResult,
  type Root,
  type MCPAgentSessionConfig,
} from './enhanced-client.js';

// Client types  
export {
  type IMCPClient,
  type ToolProvider,
  type ToolSet,
  type Tool,
} from './client.js'; 