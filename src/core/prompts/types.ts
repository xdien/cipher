/**
 * Types for dynamic MCP prompts system
 */

import type { MemAgent } from '../brain/memAgent/agent.js';

/**
 * Argument definition for a prompt template
 */
export interface PromptArgument {
	name: string;
	type: 'string' | 'number' | 'boolean' | 'string[]';
	description: string;
	required: boolean;
	default?: any;
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
	name: string;
	description: string;
	arguments?: PromptArgument[];
	example_prompts?: string[]; // Usage examples for Google Antigravity
	generator: (args: Record<string, any>, agent: MemAgent) => Promise<string>;
}

/**
 * Arguments passed from MCP client
 */
export interface PromptGenerationArgs {
	project_path?: string;
	include_history?: boolean;
	max_history?: number;
	session_id?: string;
	file_patterns?: string[];
	custom_rules?: string;
	[key: string]: any;
}
