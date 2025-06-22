/**
 * MCP Aggregator Usage Examples
 * 
 * Demonstrates how to use the MCPAggregator to unify multiple MCP servers
 * under a single interface with intelligent routing and namespacing.
 */

import { 
  MCPAggregator,
  MCPAggregatorConfig,
  createNamespacedName,
  extractServerName,
  extractItemName,
  withTemporaryConnection,
} from '../index.js';
import { Context } from '../../context/context.js';

/**
 * Example 1: Basic aggregator setup with persistent connections
 */
export async function basicAggregatorExample() {
  console.log('=== Basic MCP Aggregator Example ===\n');

  // Create context
  const context = new Context({ sessionId: 'aggregator-example-session' });

  // Server configurations
  const serverConfigs = {
    'filesystem': {
      type: 'stdio' as const,
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
      timeout: 30000,
    },
    'brave-search': {
      type: 'stdio' as const,
      command: 'npx',
      args: ['@modelcontextprotocol/server-brave-search'],
      timeout: 30000,
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || '' },
    },
  };

  // Create aggregator with persistent connections
  const config: MCPAggregatorConfig = {
    connectionMode: 'persistent',
    context,
    enableParallelLoading: true,
    strictInitialization: false,
    namespacing: {
      enforceNamespacing: false,
      allowFallback: true,
    },
  };

  const aggregator = new MCPAggregator(config);

  try {
    // Initialize aggregator
    console.log('Initializing MCP aggregator...');
    await aggregator.initialize(['filesystem', 'brave-search'], {
      serverConfigs,
      connectionMode: 'persistent',
    });

    console.log('✓ Aggregator initialized successfully\n');

    // Demonstrate unified MCP interface
    console.log('=== Unified MCP Interface ===');

    // List all tools from all servers
    const toolsResult = await aggregator.listTools();
    console.log(`📂 Total tools available: ${toolsResult.tools.length}`);
    
    for (const tool of toolsResult.tools.slice(0, 5)) { // Show first 5 tools
      console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
    }

    // List all prompts
    const promptsResult = await aggregator.listPrompts();
    console.log(`\n💬 Total prompts available: ${promptsResult.prompts.length}`);
    
    for (const prompt of promptsResult.prompts.slice(0, 3)) { // Show first 3 prompts
      console.log(`  - ${prompt.name}: ${prompt.description || 'No description'}`);
    }

    // List all resources
    const resourcesResult = await aggregator.listResources();
    console.log(`\n📄 Total resources available: ${resourcesResult.resources.length}`);
    
    for (const resource of resourcesResult.resources.slice(0, 3)) { // Show first 3 resources
      console.log(`  - ${resource.uri}: ${resource.description || 'No description'}`);
    }

    // Demonstrate tool execution with automatic routing
    console.log('\n=== Tool Execution with Automatic Routing ===');

    try {
      // Execute a filesystem tool (should be routed to filesystem server)
      const result = await aggregator.callTool('filesystem_list_directory', { path: '/tmp' });
      console.log('✓ Filesystem tool executed successfully');
      console.log(`  Result type: ${typeof result.content}`);
    } catch (error) {
      console.log('- Filesystem tool execution failed (expected if server not available)');
    }

    // Get aggregator statistics
    const stats = await aggregator.getStatistics();
    console.log('\n=== Aggregator Statistics ===');
    console.log(`- Servers: ${stats.serverCount}`);
    console.log(`- Total tools: ${stats.totalTools}`);
    console.log(`- Total prompts: ${stats.totalPrompts}`);
    console.log(`- Total resources: ${stats.totalResources}`);
    console.log(`- Total operations: ${stats.totalOperations}`);
    console.log(`- Success rate: ${((stats.successfulOperations / stats.totalOperations) * 100).toFixed(1)}%`);
    console.log(`- Average response time: ${stats.averageResponseTime.toFixed(1)}ms`);
    console.log(`- Connection mode: ${stats.connectionMode}`);
    console.log(`- Uptime: ${(stats.uptime / 1000).toFixed(1)}s`);

  } catch (error) {
    console.error('Error in basic aggregator example:', error);
  } finally {
    await aggregator.shutdown();
    console.log('\n✓ Aggregator shut down gracefully');
  }
}

/**
 * Example 2: Namespacing demonstration
 */
export async function namespacingExample() {
  console.log('\n=== Namespacing Example ===\n');

  // Demonstrate namespacing utilities
  console.log('Namespacing Utilities:');
  
  // Create namespaced names
  const toolName = createNamespacedName('filesystem', 'read_file');
  console.log(`- Namespaced tool: ${toolName}`);
  
  const promptName = createNamespacedName('brave-search', 'search_query');
  console.log(`- Namespaced prompt: ${promptName}`);

  // Parse namespaced names
  const serverNames = ['filesystem', 'brave-search', 'weather'];
  
  const extractedServer = extractServerName('filesystem_read_file', serverNames);
  const extractedItem = extractItemName('filesystem_read_file', serverNames);
  console.log(`- Extracted server: ${extractedServer}`);
  console.log(`- Extracted item: ${extractedItem}`);

  // Show both namespaced and non-namespaced access
  const aggregator = new MCPAggregator({
    connectionMode: 'temporary',
    namespacing: {
      enforceNamespacing: false, // Allow both namespaced and non-namespaced
      allowFallback: true,
    },
  });

  console.log('\nNamespacing allows both access patterns:');
  console.log('- Namespaced: filesystem_read_file');
  console.log('- Non-namespaced: read_file (fallback)');
}

/**
 * Example 3: Connection strategies comparison
 */
export async function connectionStrategiesExample() {
  console.log('\n=== Connection Strategies Example ===\n');

  const serverConfigs = {
    'filesystem': {
      type: 'stdio' as const,
      command: 'echo',
      args: ['test'],
      timeout: 30000,
    },
  };

  const context = new Context({ sessionId: 'strategies-example' });

  // Example 1: Persistent connections
  console.log('1. Persistent Connection Strategy:');
  const persistentAggregator = new MCPAggregator({
    connectionMode: 'persistent',
    context,
  });

  try {
    await persistentAggregator.initialize(['filesystem'], { serverConfigs });
    const persistentStats = await persistentAggregator.getStatistics();
    console.log(`   - Connection mode: ${persistentStats.connectionMode}`);
    console.log(`   - Connection reuse: Yes (pooled)`);
    console.log(`   - Best for: Multiple operations, long-running applications`);
  } catch (error) {
    console.log('   - Status: Failed to initialize (expected if server unavailable)');
  } finally {
    await persistentAggregator.shutdown();
  }

  // Example 2: Temporary connections
  console.log('\n2. Temporary Connection Strategy:');
  const temporaryAggregator = new MCPAggregator({
    connectionMode: 'temporary',
    context,
  });

  try {
    await temporaryAggregator.initialize(['filesystem'], { serverConfigs });
    const tempStats = await temporaryAggregator.getStatistics();
    console.log(`   - Connection mode: ${tempStats.connectionMode}`);
    console.log(`   - Connection reuse: No (created per operation)`);
    console.log(`   - Best for: Infrequent operations, resource-constrained environments`);
  } catch (error) {
    console.log('   - Status: Failed to initialize (expected if server unavailable)');
  } finally {
    await temporaryAggregator.shutdown();
  }

  // Example 3: Using withTemporaryConnection utility
  console.log('\n3. One-off Temporary Connection:');
  try {
    const result = await withTemporaryConnection(
      'filesystem',
      serverConfigs.filesystem,
      async (client) => {
        const tools = await client.getTools();
        return Object.keys(tools);
      },
      { timeout: 15000, context }
    );
    console.log(`   - Tools discovered: ${result.length}`);
    console.log(`   - Best for: Single operations, utility scripts`);
  } catch (error) {
    console.log('   - Status: Failed (expected if server unavailable)');
  }
}

/**
 * Example 4: Dynamic server management demonstration
 */
export async function dynamicServerManagementExample() {
  console.log('\n=== Dynamic Server Management Example ===\n');

  const aggregator = new MCPAggregator({
    connectionMode: 'persistent',
    enableParallelLoading: true,
    strictInitialization: false,
  });

  try {
    console.log('Dynamic server management features:');
    
    // Initialize empty aggregator
    await aggregator.initialize();
    console.log('✓ Initialized empty aggregator');

    // Add servers dynamically
    const serverConfig = {
      type: 'stdio' as const,
      command: 'echo',
      args: ['test'],
      timeout: 30000,
    };

    try {
      await aggregator.addServer('dynamic-server', serverConfig);
      console.log('✓ Added server dynamically');

      const serverNames = aggregator.getServerNames();
      console.log(`Active servers: ${serverNames.join(', ')}`);

      const capabilities = await aggregator.getServerCapabilities('dynamic-server');
      console.log(`Server capabilities:`, capabilities);

      await aggregator.removeServer('dynamic-server');
      console.log('✓ Removed server dynamically');

    } catch (error) {
      console.log('- Dynamic server management failed (expected if server unavailable)');
    }

  } catch (error) {
    console.log('Dynamic server management example failed:', error);
  } finally {
    await aggregator.shutdown();
  }
}

/**
 * Example 5: Advanced configuration features
 */
export async function advancedConfigurationExample() {
  console.log('\n=== Advanced Configuration Example ===\n');

  const context = new Context({ sessionId: 'advanced-config-session' });

  const aggregator = new MCPAggregator({
    connectionMode: 'persistent',
    context,
    enableParallelLoading: true,
    strictInitialization: false,
    serverLoadingTimeout: 30000,
    resourceMapping: {
      allowUpdates: true,
      mergeAliases: true,
    },
    namespacing: {
      enforceNamespacing: false,
      allowFallback: true,
      separator: '_',
    },
    connectionStrategy: {
      mode: 'persistent',
      poolConfig: {
        persistentConnections: true,
        maxPoolSize: 10,
        connectionTimeout: 30000,
        idleTimeout: 300000,
        enableConnectionWarming: true,
      },
    },
  });

  try {
    console.log('Advanced configuration features:');
    console.log('✓ Parallel server loading enabled');
    console.log('✓ Graceful failure handling (non-strict)');
    console.log('✓ Configurable timeouts');
    console.log('✓ Flexible resource mapping');
    console.log('✓ Customizable namespacing');
    console.log('✓ Connection pooling configuration');

    await aggregator.initialize();
    console.log('✓ Initialized with advanced configuration');

    const stats = await aggregator.getStatistics();
    console.log('\nConfiguration statistics:');
    console.log(`- Connection mode: ${stats.connectionMode}`);
    console.log(`- Resource mapping stats:`, stats.resourceMapStats);
    console.log(`- Connection stats:`, stats.connectionStats);

  } catch (error) {
    console.log('Advanced configuration example failed:', error);
  } finally {
    await aggregator.shutdown();
  }
}

/**
 * Example 6: Error handling and resilience
 */
export async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===\n');

  const aggregator = new MCPAggregator({
    connectionMode: 'persistent',
    strictInitialization: false, // Allow partial failures
    enableParallelLoading: true,
  });

  try {
    // Mix of valid and invalid server configs
    const serverConfigs = {
      'valid-server': {
        type: 'stdio' as const,
        command: 'echo',
        args: ['test'],
        timeout: 30000,
      },
      'invalid-server': {
        type: 'stdio' as const,
        command: 'nonexistent-command',
        args: ['fail'],
        timeout: 5000,
      },
    };

    console.log('Testing graceful failure handling...');
    
    await aggregator.initialize(['valid-server', 'invalid-server'], {
      serverConfigs,
    });

    console.log('✓ Aggregator initialized with partial failures');

    const stats = await aggregator.getStatistics();
    console.log(`- Servers initialized: ${stats.serverCount}`);
    console.log(`- Connection errors: ${stats.connectionStats.connectionErrors}`);

    // Test individual server status
    const serverNames = aggregator.getServerNames();
    console.log(`- Available servers: ${serverNames.join(', ')}`);

  } catch (error) {
    console.log('Error handling example failed:', error);
  } finally {
    await aggregator.shutdown();
  }
}

/**
 * Run all aggregator examples
 */
async function runAllAggregatorExamples() {
  try {
    await basicAggregatorExample();
    await namespacingExample();
    await connectionStrategiesExample();
    await dynamicServerManagementExample();
    await advancedConfigurationExample();
    await errorHandlingExample();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All MCP Aggregator examples completed successfully!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('Example execution failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllAggregatorExamples().catch(console.error);
}
