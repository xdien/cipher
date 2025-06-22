/**
 * MCP Module Index
 * 
 * Exports components for the Model Context Protocol module.
 */

// Client Types
export * from './types/client.js';
export * from './types/config.js';
export * from './types/enhanced-client.js';

// Client Implementations
export { MCPClient } from './client/base-client.js';
export { MCPAgentClientSession } from './client/agent-session.js';

// Convenience APIs - Simple functions for common MCP usage patterns
export {
  genClient,
  connect,
  disconnect,
  withTemporaryClient,
  validateServerRegistry,
  getServerStatuses,
  waitForServerHealth,
} from './client-utils.js';

// Managers - Connection pooling and lifecycle management
export * from './manager/index.js';

// Utils - Async Coordination Primitives
export * from './utils/index.js';

// Errors - Connection and Recovery Error Handling
export * from './errors/index.js';

// Recovery - Connection Recovery and Resilience
export * from './recovery/index.js';

// Connection - Server Connection Management
export * from './connection/index.js';

// Aggregator - Multi-Server Aggregation
export * from './aggregator/index.js';

// Registry - Server Configuration and Lifecycle Management
export * from './registry/index.js';