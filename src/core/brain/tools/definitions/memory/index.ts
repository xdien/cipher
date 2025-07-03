/**
 * Memory Tools Module
 *
 * This module exports all memory-related internal tools for the Cipher agent.
 * These tools handle fact extraction, knowledge processing, and memory operations.
 */

// Export all memory tools
export { extractKnowledgeTool } from './extract-knowledge.js';
// TODO: Re-enable when tests are updated to handle multiple tools
// export { memoryOperationTool } from './memory_operation.js';

// Export types for better developer experience
import type { InternalTool } from '../../types.js';

/**
 * Collection of all memory tools
 */
export const memoryTools: InternalTool[] = [
	// Import and re-export with dynamic imports to avoid circular dependencies
];

// Load tools dynamically to avoid potential circular dependencies
import('./extract-knowledge.js').then(module => memoryTools.push(module.extractKnowledgeTool));
// TODO: Re-enable when tests are updated to handle multiple tools
// import('./memory_operation.js').then(module => memoryTools.push(module.memoryOperationTool));

/**
 * Get all memory tools as a map
 */
export async function getMemoryTools(): Promise<Record<string, InternalTool>> {
	const { extractKnowledgeTool } = await import('./extract-knowledge.js');
	// TODO: Re-enable when tests are updated to handle multiple tools
	// const { memoryOperationTool } = await import('./memory_operation.js');

	return {
		[extractKnowledgeTool.name]: extractKnowledgeTool,
		// TODO: Re-enable when tests are updated to handle multiple tools
		// [memoryOperationTool.name]: memoryOperationTool,
	};
}

/**
 * Memory tool categories and descriptions
 */
export const MEMORY_TOOL_INFO = {
	extract_knowledge: {
		category: 'memory',
		purpose: 'Extract and process facts from interactions',
		useCase:
			'Use when you need to capture important technical information, code patterns, or implementation details for future reference',
	},
	memory_operation: {
		category: 'memory',
		purpose: 'Process extracted knowledge and determine memory operations (ADD, UPDATE, DELETE)',
		useCase:
			'Use after extracting knowledge to intelligently manage memory by analyzing similarity with existing memories and making informed decisions about memory operations',
	},
} as const;
