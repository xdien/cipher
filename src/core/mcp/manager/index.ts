/**
 * MCP Manager Components
 *
 * Provides connection pooling and lifecycle management for MCP servers.
 */

// Connection Manager - Pure connection pooling and lifecycle management
export {
	MCPConnectionManager,
	type ConnectionPoolStats,
	type ConnectionRequestOptions,
} from './connection-manager.js';

/**
 * Manager types for different use cases:
 *
 * 1. **EnhancedMCPManager** - Use when you need:
 *    - Tool execution confirmation patterns
 *    - Agent-specific policies and hooks
 *    - Session metadata management
 *    - Before/after execution handling
 *
 * 2. **MCPConnectionManager** - Use when you need:
 *    - Raw connection pooling
 *    - Health monitoring and statistics
 *    - Low-level connection lifecycle management
 *    - Performance optimization for connection reuse
 *
 * 3. **MCPAggregator** (from ../aggregator/) - Use when you need:
 *    - Unified MCP interface across multiple servers
 *    - Resource discovery and routing
 *    - Namespacing and conflict resolution
 *    - High-level tool/prompt/resource access
 */
