# MCP (Model Context Protocol) System Documentation

The MCP system in Cipher provides a comprehensive framework for connecting to and managing multiple Model Context Protocol servers. It features connection pooling, automatic resource discovery, health monitoring, and a unified interface for accessing tools, prompts, and resources across multiple MCP servers.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Components](#core-components)
- [Getting Started](#getting-started)
- [Usage Patterns](#usage-patterns)
- [Configuration](#configuration)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Overview

### Key Features

- **Multi-Server Aggregation**: Unified interface across multiple MCP servers
- **Connection Management**: Advanced connection pooling with health monitoring
- **Resource Discovery**: Automatic discovery and namespacing of tools, prompts, and resources
- **Transport Flexibility**: Support for stdio, HTTP, WebSocket, and SSE transports
- **Health Monitoring**: Circuit breakers, retry strategies, and automatic recovery
- **Type Safety**: Full TypeScript support with Zod-based configuration validation
- **Session Management**: Enhanced client sessions with logging and context tracking

### Server Types

The MCP system supports four transport types:

- `stdio`: Command-line based servers using stdin/stdout communication
- `http`: HTTP-based servers with REST-like endpoints
- `websocket`: WebSocket servers for real-time bidirectional communication  
- `sse`: Server-Sent Events for streaming communication

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Convenience    │    │   ServerRegistry │    │ ConnectionManager│
│     APIs        │───▶│                  │───▶│                 │
│                 │    │ - Configuration  │    │ - Connection    │
│ - genClient     │    │ - Lifecycle      │    │   Pooling       │
│ - connect       │    │ - Validation     │    │ - Health Checks │
│ - withTemp      │    │ - Hook System    │    │ - Recovery      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  MCPAggregator  │    │  ServerConnection│
                       │                 │    │                 │
                       │ - Resource      │    │ - Transport     │
                       │   Discovery     │    │   Factory       │
                       │ - Namespacing   │    │ - Session       │
                       │ - Routing       │    │   Management    │
                       │ - Statistics    │    │ - Health        │
                       └─────────────────┘    │   Monitoring    │
                                              └─────────────────┘
```

### Component Relationships

1. **Convenience APIs**: Simple functions for common usage patterns
2. **ServerRegistry**: Centralized server configuration and lifecycle management  
3. **MCPConnectionManager**: Connection pooling, health monitoring, and recovery
4. **MCPAggregator**: Unified interface that aggregates multiple servers
5. **ServerConnection**: Individual server connection with transport abstraction
6. **Transport Layer**: Support for different communication protocols

## Core Components

### ServerRegistry

The `ServerRegistry` manages server configurations and lifecycle:

```typescript
class ServerRegistry {
  constructor(config?: ServerRegistryConfig)
  
  // Configuration management
  async initialize(settings?: Settings, configPath?: string): Promise<void>
  async addServer(serverName: string, serverConfig: McpServerConfig): Promise<void>
  async removeServer(serverName: string): Promise<void>
  
  // Session lifecycle
  async *startServer(serverName: string, ...): AsyncGenerator<IEnhancedMCPClient>
  async *initializeServer(serverName: string, ...): AsyncGenerator<IEnhancedMCPClient>
  
  // Hook management
  registerInitHook(serverName: string, hook: InitHookCallable): void
  unregisterInitHook(serverName: string): void
}
```

### MCPConnectionManager

The `MCPConnectionManager` handles connection pooling and health monitoring:

```typescript
class MCPConnectionManager {
  constructor(config?: Partial<ConnectionPoolConfig>)
  
  // Lifecycle management
  async initialize(serverConfigs: ServerConfigs, context?: IContext): Promise<void>
  async shutdown(): Promise<void>
  
  // Connection management
  async getClient(serverName: string, options?: ConnectionRequestOptions): Promise<IEnhancedMCPClient>
  async addServer(serverName: string, serverConfig: McpServerConfig): Promise<void>
  async removeServer(serverName: string): Promise<void>
  
  // Health monitoring
  isServerHealthy(serverName: string): boolean
  async getStatistics(): Promise<ConnectionPoolStats>
  async performHealthCheck(): Promise<Map<string, boolean>>
}
```

### MCPAggregator

The `MCPAggregator` provides a unified interface across multiple servers:

```typescript
class MCPAggregator {
  constructor(config?: MCPAggregatorConfig)
  
  // Initialization
  async initialize(serverNames?: string[], options?: AggregatorOptions): Promise<void>
  async loadServers(force?: boolean): Promise<void>
  
  // MCP Server Interface
  async listTools(): Promise<ListToolsResult>
  async callTool(name: string, args?: any): Promise<CallToolResult>
  async listPrompts(): Promise<ListPromptsResult>
  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult>
  async listResources(): Promise<ListResourcesResult>
  async readResource(uri: string): Promise<ReadResourceResult>
  
  // Management
  async getStatistics(): Promise<AggregatorStatistics>
  async shutdown(): Promise<void>
}
```

### Configuration Structure

MCP server configurations follow a strict schema:

```typescript
interface McpServerConfig {
  type: 'stdio' | 'http' | 'websocket' | 'sse';
  name?: string;
  description?: string;
  timeout?: number;
  readTimeoutSeconds?: number;
  auth?: MCPServerAuthSettings;
  roots?: MCPRootSettings[];
  
  // Transport-specific fields
  command?: string;      // stdio
  args?: string[];       // stdio
  env?: Record<string, string>; // stdio
  url?: string;          // http, websocket, sse
  headers?: Record<string, string>; // http, websocket, sse
  protocols?: string[];  // websocket
}
```

## Getting Started

### Basic Setup

```typescript
import { ServerRegistry, MCPConnectionManager, Context } from '@cipher/mcp';

// Create context and components
const context = new Context({ sessionId: 'my-session' });
const serverRegistry = new ServerRegistry({ context });
const connectionManager = new MCPConnectionManager();

// Configure a server
const serverConfig = {
  type: 'stdio' as const,
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
  timeout: 30000,
};

// Initialize
await serverRegistry.initialize();
await serverRegistry.addServer('filesystem', serverConfig);
await connectionManager.initialize({ filesystem: serverConfig }, context);

// Use the connection
const client = await connectionManager.getClient('filesystem');
const tools = await client.getTools();
console.log('Available tools:', Object.keys(tools));

// Cleanup
await connectionManager.shutdown();
await serverRegistry.shutdown();
```

### Quick Example with Convenience API

```typescript
import { genClient, ServerRegistry } from '@cipher/mcp';

async function quickExample() {
  const serverRegistry = new ServerRegistry();
  await serverRegistry.initialize();
  
  await serverRegistry.addServer('filesystem', {
    type: 'stdio',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
  });
  
  // Automatic connection management
  for await (const client of genClient('filesystem', serverRegistry)) {
    const tools = await client.getTools();
    console.log('Tools:', Object.keys(tools));
    // Connection automatically cleaned up
    break;
  }
  
  await serverRegistry.shutdown();
}
```

## Usage Patterns

### 1. Ephemeral Connections

Use `genClient` for automatic connection management:

```typescript
import { genClient, ServerRegistry } from '@cipher/mcp';

const serverRegistry = new ServerRegistry();
await serverRegistry.initialize();
await serverRegistry.addServer('search', searchConfig);

// Connection automatically managed
for await (const client of genClient('search', serverRegistry)) {
  const tools = await client.getTools();
  // Use the client...
  // Connection cleaned up when exiting loop
  break;
}
```

### 2. Persistent Connections

Use `connect/disconnect` for long-lived connections:

```typescript
import { connect, disconnect, ServerRegistry, MCPConnectionManager } from '@cipher/mcp';

const serverRegistry = new ServerRegistry();
const connectionManager = new MCPConnectionManager();

await serverRegistry.initialize();
await serverRegistry.addServer('database', dbConfig);
await connectionManager.initialize({ database: dbConfig });

// Create persistent connection
const client = await connect('database', serverRegistry, connectionManager);

// Use multiple times
for (let i = 0; i < 10; i++) {
  await client.callTool('query', { sql: `SELECT * FROM table${i}` });
}

// Manually disconnect
await disconnect('database', connectionManager);
```

### 3. One-off Operations

Use `withTemporaryClient` for single operations:

```typescript
import { withTemporaryClient } from '@cipher/mcp';

const result = await withTemporaryClient(
  'filesystem',
  serverConfig,
  async (client) => {
    const tools = await client.getTools();
    const prompts = await client.listPrompts();
    return { toolCount: Object.keys(tools).length, promptCount: prompts.length };
  },
  { timeout: 10000 }
);
```

### 4. Multi-Server Aggregation

Use `MCPAggregator` for unified access to multiple servers:

```typescript
import { MCPAggregator } from '@cipher/mcp';

const aggregator = new MCPAggregator({
  connectionMode: 'persistent',
  enableParallelLoading: true,
});

await aggregator.initialize(['filesystem', 'search', 'database'], {
  serverConfigs: {
    filesystem: filesystemConfig,
    search: searchConfig,
    database: databaseConfig,
  },
});

// Unified interface across all servers
const allTools = await aggregator.listTools();
const allPrompts = await aggregator.listPrompts();

// Call tools from any server seamlessly
await aggregator.callTool('search_web', { query: 'TypeScript MCP' });
await aggregator.callTool('read_file', { path: '/tmp/example.txt' });
```

### 5. Configuration from Files

Load server configurations from JSON or YAML:

```typescript
// config.json
{
  "mcp": {
    "servers": {
      "filesystem": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-filesystem", "/tmp"]
      },
      "search": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-brave-search"],
        "env": { "BRAVE_API_KEY": "your-key" }
      }
    }
  }
}

// Load configuration
const serverRegistry = new ServerRegistry({ configPath: './config.json' });
await serverRegistry.initialize();
```

## Configuration

### ServerRegistry Configuration

```typescript
interface ServerRegistryConfig {
  configPath?: string;                    // Path to configuration file
  defaultSettings?: Settings;             // Default settings if no config
  context?: IContext;                     // Context for client sessions
  defaultTimeout?: number;                // Default timeout for operations
  strictValidation?: boolean;             // Whether to validate strictly
}
```

### ConnectionManager Configuration

```typescript
interface ConnectionPoolConfig {
  maxPoolSize?: number;                   // Maximum concurrent connections
  connectionTimeout?: number;             // Connection timeout in ms
  healthCheckInterval?: number;           // Health check interval in ms
  maxRetryAttempts?: number;             // Maximum retry attempts
  warmupOnStartup?: boolean;             // Whether to warm up connections
}
```

### Aggregator Configuration

```typescript
interface MCPAggregatorConfig {
  connectionMode?: 'persistent' | 'temporary';  // Connection strategy
  connectionStrategy?: ConnectionStrategyConfig; // Connection strategy config
  resourceMapping?: ResourceMapOptions;         // Resource mapping options
  namespacing?: NamespacingOptions;            // Namespacing configuration
  context?: IContext;                          // Context for sessions
  enableParallelLoading?: boolean;             // Parallel server loading
  serverLoadingTimeout?: number;               // Server loading timeout
  strictInitialization?: boolean;             // Strict initialization mode
}
```

### Server Configuration

```typescript
// Stdio server example
const stdioConfig: McpServerConfig = {
  type: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
  env: { NODE_ENV: 'production' },
  timeout: 30000,
  readTimeoutSeconds: 10,
};

// HTTP server example
const httpConfig: McpServerConfig = {
  type: 'http',
  url: 'https://api.example.com/mcp',
  headers: { 'Authorization': 'Bearer token' },
  timeout: 15000,
  auth: { apiKey: 'your-api-key' },
};

// WebSocket server example
const wsConfig: McpServerConfig = {
  type: 'websocket',
  url: 'wss://example.com/mcp',
  protocols: ['mcp-v1'],
  headers: { 'User-Agent': 'Cipher-MCP-Client' },
};
```

## Advanced Features

### Custom Session Factories

Create custom client sessions with enhanced functionality:

```typescript
import { ClientSessionFactory, TransportContext } from '@cipher/mcp';

const customSessionFactory: ClientSessionFactory = async (
  transportContext: TransportContext,
  readTimeout?: number
): Promise<IEnhancedMCPClient> => {
  // Create custom session with special configuration
  const session = new CustomMCPSession({
    transport: transportContext.transport,
    readTimeout,
    // Custom options
  });
  
  return session;
};

// Use with server registry
for await (const client of serverRegistry.initializeServer(
  'myserver',
  customSessionFactory
)) {
  // Use custom client
}
```

### Initialization Hooks

Register hooks for server initialization:

```typescript
import { InitHookCallable } from '@cipher/mcp';

const initHook: InitHookCallable = async (session, auth) => {
  if (!session) return false;
  
  // Perform custom initialization
  const tools = await session.getTools();
  if (Object.keys(tools).length === 0) {
    console.log('No tools available, skipping server');
    return false;
  }
  
  // Custom authentication or setup
  if (auth?.apiKey) {
    await session.callTool('authenticate', { apiKey: auth.apiKey });
  }
  
  return true; // Continue with this session
};

// Register hook
serverRegistry.registerInitHook('myserver', initHook);
```

### Health Monitoring and Recovery

Configure advanced health monitoring:

```typescript
const connectionManager = new MCPConnectionManager({
  healthCheckInterval: 30000,      // Check health every 30s
  maxRetryAttempts: 3,            // Retry failed connections 3 times
  connectionTimeout: 10000,       // 10s connection timeout
});

// Monitor health
setInterval(async () => {
  const healthCheck = await connectionManager.performHealthCheck();
  for (const [server, isHealthy] of healthCheck) {
    if (!isHealthy) {
      console.log(`Server ${server} is unhealthy`);
    }
  }
}, 60000);

// Get detailed statistics
const stats = await connectionManager.getStatistics();
console.log('Pool utilization:', stats.poolUtilization + '%');
console.log('Failed connections:', stats.failedConnections);
```

### Resource Namespacing

Configure how resources are namespaced across servers:

```typescript
const aggregator = new MCPAggregator({
  namespacing: {
    enableNamespacing: true,        // Enable namespacing
    separator: '::',                // Use :: as separator
    preventCollisions: true,        // Prevent name collisions
    aliasConflicts: false,         // Don't create aliases for conflicts
  },
});

// Results in namespaced resources:
// - filesystem::read_file
// - search::web_search  
// - database::execute_query
```

### Custom Transport Configuration

Configure transport-specific options:

```typescript
// Stdio with custom environment
const stdioConfig = {
  type: 'stdio' as const,
  command: 'node',
  args: ['server.js'],
  env: {
    NODE_ENV: 'production',
    DEBUG: 'mcp:*',
    API_KEY: process.env.API_KEY,
  },
  timeout: 45000,
};

// HTTP with authentication headers
const httpConfig = {
  type: 'http' as const,
  url: 'https://api.example.com/mcp',
  headers: {
    'Authorization': 'Bearer ' + process.env.API_TOKEN,
    'Content-Type': 'application/json',
    'User-Agent': 'Cipher-MCP/1.0',
  },
  timeout: 20000,
};

// WebSocket with subprotocols
const wsConfig = {
  type: 'websocket' as const,
  url: 'wss://mcp.example.com',
  protocols: ['mcp-v1', 'mcp-legacy'],
  headers: {
    'Origin': 'https://myapp.com',
  },
};
```

## Best Practices

### 1. Connection Management

Choose the right connection pattern for your use case:

```typescript
// Good: Use ephemeral connections for infrequent operations
for await (const client of genClient('filesystem', registry)) {
  await client.callTool('read_file', { path: '/tmp/config.json' });
  break; // One-time operation
}

// Good: Use persistent connections for frequent operations
const client = await connect('database', registry, connectionManager);
for (let i = 0; i < 1000; i++) {
  await client.callTool('query', { sql: `SELECT * FROM table WHERE id = ${i}` });
}
await disconnect('database', connectionManager);

// Avoid: Creating new connections for each operation
// This is inefficient and can overwhelm servers
```

### 2. Error Handling

Always handle connection failures gracefully:

```typescript
// Good: Proper error handling with fallbacks
try {
  const client = await connect('primary-search', registry, connectionManager);
  return await client.callTool('search', { query });
} catch (error) {
  console.log('Primary search failed, trying fallback');
  try {
    const fallbackClient = await connect('fallback-search', registry, connectionManager);
    return await fallbackClient.callTool('search', { query });
  } catch (fallbackError) {
    throw new Error('All search services unavailable');
  }
}
```

### 3. Resource Management

Always clean up connections:

```typescript
// Good: Proper cleanup with try/finally
const aggregator = new MCPAggregator();
try {
  await aggregator.initialize(serverNames, { serverConfigs });
  // Use aggregator...
} finally {
  await aggregator.shutdown(); // Always cleanup
}

// Better: Use managed patterns
await withTemporaryClient('server', config, async (client) => {
  // Automatic cleanup
  return await client.callTool('action', params);
});
```

### 4. Configuration Validation

Validate configurations early:

```typescript
// Good: Validate at startup
import { ConfigValidation } from '@cipher/mcp';

const serverConfig = {
  type: 'stdio',
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem'],
};

try {
  const validated = ConfigValidation.validateServerConfig(serverConfig);
  await serverRegistry.addServer('filesystem', validated);
} catch (error) {
  console.error('Invalid configuration:', error.message);
  process.exit(1);
}
```

### 5. Performance Optimization

Use aggregation for multi-server scenarios:

```typescript
// Good: Single aggregator for multiple servers
const aggregator = new MCPAggregator({
  enableParallelLoading: true,    // Load servers in parallel
  connectionMode: 'persistent',   // Reuse connections
});

await aggregator.initialize(['fs', 'search', 'db'], { serverConfigs });

// Single interface for all servers
const allTools = await aggregator.listTools();

// Avoid: Managing multiple individual connections
// This creates overhead and complexity
```

### 6. Health Monitoring

Implement proactive health monitoring:

```typescript
// Good: Regular health checks with alerting
const healthMonitor = setInterval(async () => {
  const unhealthyServers = [];
  const healthResults = await connectionManager.performHealthCheck();
  
  for (const [server, isHealthy] of healthResults) {
    if (!isHealthy) {
      unhealthyServers.push(server);
    }
  }
  
  if (unhealthyServers.length > 0) {
    console.warn('Unhealthy servers detected:', unhealthyServers);
    // Implement alerting logic
  }
}, 30000);

// Cleanup monitoring
process.on('SIGINT', () => clearInterval(healthMonitor));
```

## API Reference

### Convenience Functions

| Function | Description | Parameters |
|----------|-------------|------------|
| `genClient(serverName, registry, factory?, sessionId?)` | Create ephemeral connection | server name, registry, optional factory, session ID |
| `connect(serverName, registry, manager?, options?)` | Create persistent connection | server name, registry, optional manager, options |
| `disconnect(serverName, manager)` | Disconnect from server | server name or null for all, manager |
| `withTemporaryClient(name, config, operation, options?)` | Execute with temporary client | server name, config, operation function, options |

### ServerRegistry Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `initialize(settings?, configPath?)` | Initialize registry | optional settings, config path |
| `addServer(name, config)` | Add server configuration | server name, configuration |
| `removeServer(name)` | Remove server | server name |
| `startServer(name, factory?, sessionId?)` | Start server session | server name, optional factory, session ID |
| `registerInitHook(name, hook)` | Register initialization hook | server name, hook function |

### MCPConnectionManager Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `initialize(configs, context?)` | Initialize connection manager | server configs, optional context |
| `getClient(name, options?)` | Get client for server | server name, connection options |
| `addServer(name, config)` | Add server to pool | server name, configuration |
| `removeServer(name)` | Remove server from pool | server name |
| `isServerHealthy(name)` | Check server health | server name |
| `getStatistics()` | Get pool statistics | none |
| `performHealthCheck()` | Force health check | none |

### MCPAggregator Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `initialize(serverNames?, options?)` | Initialize aggregator | server names array, options |
| `loadServers(force?)` | Load server capabilities | force reload flag |
| `listTools()` | List all tools from all servers | none |
| `callTool(name, args?)` | Call tool by name | tool name, arguments |
| `listPrompts()` | List all prompts | none |
| `getPrompt(name, args?)` | Get prompt by name | prompt name, arguments |
| `listResources()` | List all resources | none |
| `readResource(uri)` | Read resource by URI | resource URI |
| `getStatistics()` | Get aggregator statistics | none |

### Configuration Types

```typescript
interface McpServerConfig {
  type: 'stdio' | 'http' | 'websocket' | 'sse';
  name?: string;
  timeout?: number;
  auth?: MCPServerAuthSettings;
  // Transport-specific fields...
}

interface ConnectionPoolConfig {
  maxPoolSize?: number;
  connectionTimeout?: number;
  healthCheckInterval?: number;
  maxRetryAttempts?: number;
  warmupOnStartup?: boolean;
}

interface MCPAggregatorConfig {
  connectionMode?: 'persistent' | 'temporary';
  enableParallelLoading?: boolean;
  serverLoadingTimeout?: number;
  strictInitialization?: boolean;
  context?: IContext;
}
```

---

This MCP system provides a robust foundation for integrating with Model Context Protocol servers, offering flexible connection management, automatic resource discovery, and unified access patterns. The modular architecture ensures that you can choose the appropriate level of abstraction for your specific use case, from simple one-off operations to complex multi-server orchestration. 