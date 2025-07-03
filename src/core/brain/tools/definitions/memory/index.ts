/**
 * Memory Tools Module
 *
 * This module exports all memory-related internal tools for the Cipher agent.
 * These tools handle fact extraction and knowledge processing.
 */

// Export all memory tools
export { extractKnowledgeTool } from './extract-knowledge.js';

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

/**
 * Get all memory tools as a map
 */
export async function getMemoryTools(): Promise<Record<string, InternalTool>> {
	const { extractKnowledgeTool } = await import('./extract-knowledge.js');

	return {
		[extractKnowledgeTool.name]: extractKnowledgeTool,
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
} as const;
