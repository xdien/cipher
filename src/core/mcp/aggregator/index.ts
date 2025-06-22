/**
 * MCP Aggregator Module Index
 * 
 * Exports all MCP aggregator components including the main aggregator class,
 * resource mapping, connection strategies, namespacing utilities.
 */

// Main aggregator
export {
  MCPAggregator,
  type MCPAggregatorConfig,
  type AggregatorOptions,
  type AggregatorStatistics,
} from './mcp-aggregator.js';

// Resource mapping and discovery
export * from './resource-maps.js';

// Connection strategies
export {
  type ConnectionStrategy,
  type ConnectionStrategyConfig,
  type ConnectionStrategyStats,
  type ConnectionMode,
  createConnectionStrategy,
  PersistentConnectionStrategy,
  TemporaryConnectionStrategy,
  withTemporaryConnection,
} from './connection-strategy.js';

// Namespacing utilities
export * from './namespacing.js'; 