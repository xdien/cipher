import { InternalToolManager } from '../../../manager.js';
import { UnifiedToolManager } from '../../../unified-tool-manager.js';
import { extractAndOperateMemoryTool } from '../extract_and_operate_memory.js';

(async () => {
  // Register the tool with InternalToolManager
  const internalToolManager = new InternalToolManager();
  await internalToolManager.initialize();
  internalToolManager.registerTool(extractAndOperateMemoryTool);

  // Check tool names in InternalToolManager
  const internalTools = internalToolManager.getAllTools();
  console.log('InternalToolManager tool names:', Object.keys(internalTools));

  // Check isInternalTool for both names
  console.log('isInternalTool("extract_and_operate_memory"):', internalToolManager.isInternalTool('extract_and_operate_memory'));
  console.log('isInternalTool("cipher_extract_and_operate_memory"):', internalToolManager.isInternalTool('cipher_extract_and_operate_memory'));

  // Set up UnifiedToolManager with only internal tools
  const mockMCPManager = {
    getAllTools: async () => ({}), // No MCP tools
    executeTool: async () => { throw new Error('Not implemented'); },
    clients: new Map(),
    failedConnections: new Map(),
    logger: console,
    toolCache: new Map(),
    initialized: true,
    isConnected: () => false,
    connect: async () => {},
    disconnect: async () => {},
    getAvailableTools: async () => ({}),
    executeToolCall: async () => { throw new Error('Not implemented'); },
    getToolSchema: () => null,
    listTools: async () => [],
    getConnectionStatus: () => ({ connected: [], failed: [] }),
    reloadConnections: async () => {},
    validateConnection: async () => true,
    getToolInfo: () => null,
    handleToolError: () => {},
    clearCache: () => {},
    getStats: () => ({ totalCalls: 0, successfulCalls: 0, failedCalls: 0 }),
    subscribe: () => {},
    unsubscribe: () => {},
    emit: () => {},
    on: () => {},
    off: () => {},
    once: () => {},
    removeListener: () => {},
    removeAllListeners: () => {},
    setMaxListeners: () => {},
    getMaxListeners: () => 10,
    listeners: () => [],
    listenerCount: () => 0,
    eventNames: () => [],
    prependListener: () => {},
    prependOnceListener: () => {},
    rawListeners: () => []
  } as any;
  
  const unifiedToolManager = new UnifiedToolManager(
    mockMCPManager, 
    internalToolManager, 
    { enableInternalTools: true, enableMcpTools: false }
  );

  // Check tool names in UnifiedToolManager
  const allTools = await unifiedToolManager.getAllTools();
  console.log('UnifiedToolManager tool names:', Object.keys(allTools));

  // Check isToolAvailable for both names
  console.log('isToolAvailable("extract_and_operate_memory"):', await unifiedToolManager.isToolAvailable('extract_and_operate_memory'));
  console.log('isToolAvailable("cipher_extract_and_operate_memory"):', await unifiedToolManager.isToolAvailable('cipher_extract_and_operate_memory'));
})(); 