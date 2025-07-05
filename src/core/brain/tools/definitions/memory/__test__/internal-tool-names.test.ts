import { InternalToolManager } from '../../../manager.js';
import { UnifiedToolManager } from '../../../unified-tool-manager.js';
import { extractAndOperateMemoryTool } from '../extract_and_operate_memory.js';

(async () => {
  // Register the tool with InternalToolManager
  const internalToolManager = new InternalToolManager();
  internalToolManager.registerTool(extractAndOperateMemoryTool);

  // Check tool names in InternalToolManager
  const internalTools = internalToolManager.getAllTools();
  console.log('InternalToolManager tool names:', Object.keys(internalTools));

  // Check isInternalTool for both names
  console.log('isInternalTool("extract_and_operate_memory"):', internalToolManager.isInternalTool('extract_and_operate_memory'));
  console.log('isInternalTool("cipher_extract_and_operate_memory"):', internalToolManager.isInternalTool('cipher_extract_and_operate_memory'));

  // Set up UnifiedToolManager with only internal tools
  const unifiedToolManager = new UnifiedToolManager({
    getAllTools: () => ({}), // No MCP tools
    executeTool: async () => { throw new Error('Not implemented'); }
  }, internalToolManager, { enableInternalTools: true, enableMcpTools: false });

  // Check tool names in UnifiedToolManager
  const allTools = await unifiedToolManager.getAllTools();
  console.log('UnifiedToolManager tool names:', Object.keys(allTools));

  // Check isToolAvailable for both names
  console.log('isToolAvailable("extract_and_operate_memory"):', await unifiedToolManager.isToolAvailable('extract_and_operate_memory'));
  console.log('isToolAvailable("cipher_extract_and_operate_memory"):', await unifiedToolManager.isToolAvailable('cipher_extract_and_operate_memory'));
})(); 