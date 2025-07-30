#!/usr/bin/env node

// Test script to verify that memory tools are exposed in aggregator mode even without embeddings
const core = require('./dist/src/core/index.cjs');

// Mock MCP Manager
const mockMcpManager = {
    getAllTools: async () => ({}),
    getClients: () => new Map(),
    getFailedConnections: () => ({}),
    executeTool: async () => 'mcp result',
};

async function testAggregatorWithoutEmbeddings() {
    console.log('=== Testing Aggregator Mode WITHOUT Embeddings ===');
    
    // Set aggregator mode
    process.env.MCP_SERVER_MODE = 'aggregator';
    
    try {
        // Create internal tool manager
        const internalToolManager = new core.InternalToolManager();
        await internalToolManager.initialize();
        
        // Register tools with embeddings DISABLED
        const result = await core.registerAllTools(internalToolManager, { embeddingEnabled: false });
        console.log('Tool registration result:', {
            total: result.total,
            registered: result.registered.length,
            failed: result.failed.length,
            registeredTools: result.registered
        });
        
        // Create unified tool manager in aggregator mode
        const unifiedToolManager = new core.UnifiedToolManager(mockMcpManager, internalToolManager, {
            mode: 'aggregator'
        });
        
        // Get all tools
        const allTools = await unifiedToolManager.getAllTools();
        
        console.log('\n=== Results ===');
        console.log('Total tools exposed:', Object.keys(allTools).length);
        console.log('Tool names:', Object.keys(allTools));
        
        // Check specific memory tools
        const hasExtractTool = 'cipher_extract_and_operate_memory' in allTools;
        const hasSearchTool = 'cipher_search_memory' in allTools || 'cipher_memory_search' in allTools;
        
        console.log('\n=== Memory Tools Check ===');
        console.log('cipher_extract_and_operate_memory:', hasExtractTool ? '✅ EXPOSED' : '❌ MISSING');
        console.log('cipher_search_memory/cipher_memory_search:', hasSearchTool ? '✅ EXPOSED' : '❌ MISSING');
        
        if (hasExtractTool && hasSearchTool) {
            console.log('\n🎉 SUCCESS: Both memory tools are exposed in aggregator mode without embeddings!');
        } else {
            console.log('\n❌ FAILURE: Memory tools are still missing');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testAggregatorWithoutEmbeddings();