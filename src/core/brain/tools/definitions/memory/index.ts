/**
 * Memory Tools Module
 *
 * This module exports all memory-related internal tools for the Cipher agent.
 * These tools handle fact extraction, knowledge processing, memory operations, and memory search.
 */

// Export all memory tools
// export { extractKnowledgeTool } from './extract-knowledge.js';
// export { memoryOperationTool } from './memory_operation.js';
import { extractAndOperateMemoryTool } from './extract_and_operate_memory.js';
import { searchMemoryTool } from './search_memory.js';

// Export individual tools
export { extractAndOperateMemoryTool } from './extract_and_operate_memory.js';
export { searchMemoryTool } from './search_memory.js';

// Export types for better developer experience
import type { InternalTool } from '../../types.js';

/**
 * Collection of all memory tools
 */
export const memoryTools: InternalTool[] = [
	extractAndOperateMemoryTool,
	searchMemoryTool
];

// Load tools dynamically to avoid potential circular dependencies
// import('./extract-knowledge.js').then(module => memoryTools.push(module.extractKnowledgeTool));
// import('./memory_operation.js').then(module => memoryTools.push(module.memoryOperationTool));

/**
 * Get all memory tools as a map
 */
export async function getMemoryTools(): Promise<Record<string, InternalTool>> {
	return {
		[extractAndOperateMemoryTool.name]: extractAndOperateMemoryTool,
		[searchMemoryTool.name]: searchMemoryTool,
	};
}

/**
 * Memory tool categories and descriptions
 */
export const MEMORY_TOOL_INFO = {
	extract_and_operate_memory: {
		category: 'memory',
		purpose: 'Extract knowledge facts from raw interaction(s) and immediately process them to determine memory operations (ADD, UPDATE, DELETE, NONE) in a single atomic step.',
		useCase:
			'Use when you need to capture important technical information, code patterns, or implementation details and immediately manage memory in a single, atomic operation.',
	},
	memory_search: {
		category: 'memory',
		purpose: 'Perform semantic search over stored memory entries to retrieve relevant knowledge and reasoning traces that can inform current decision-making.',
		useCase:
			'Use when you need to find previously stored knowledge, code patterns, or technical information that may be relevant to answering current questions or solving problems.',
	},
	// extract_knowledge: { ... },
	// memory_operation: { ... },
} as const;
