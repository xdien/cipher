/**
 * Prompt templates registry
 * Defines all available dynamic prompts for MCP clients
 */

import type { PromptTemplate } from './types.js';
import { generateProjectContext } from './generators/project-context-generator.js';
import { generateCodingGuidelines } from './generators/coding-guidelines-generator.js';

/**
 * Registry of all available prompt templates
 */
export const PROMPT_TEMPLATES: PromptTemplate[] = [
	{
		name: 'system_prompt',
		description: 'Get the current system prompt used by the Cipher agent',
		arguments: [],
		example_prompts: [
			'Show me the current system prompt',
			'What instructions is Cipher using?',
		],
		generator: async (args, agent) => {
			const systemPrompt = await agent.promptManager.generateSystemPrompt();
			return systemPrompt.content;
		},
	},
	{
		name: 'project_context',
		description:
			'Generate context-aware prompt based on project structure, files, and conversation history',
		arguments: [
			{
				name: 'project_path',
				type: 'string',
				description: 'Absolute path to the project directory',
				required: false,
			},
			{
				name: 'include_history',
				type: 'boolean',
				description: 'Include recent conversation history in the context',
				required: false,
				default: false,
			},
			{
				name: 'max_history',
				type: 'number',
				description: 'Maximum number of recent messages to include',
				required: false,
				default: 10,
			},
			{
				name: 'session_id',
				type: 'string',
				description: 'Session ID to retrieve conversation history from',
				required: false,
			},
		],
		example_prompts: [
			'Analyze my current project structure',
			'What type of project am I working on?',
			'Show me project dependencies and tech stack',
		],
		generator: generateProjectContext,
	},
	{
		name: 'coding_guidelines',
		description:
			'Generate coding guidelines and style rules from project configuration files',
		arguments: [
			{
				name: 'project_path',
				type: 'string',
				description: 'Absolute path to the project directory',
				required: true,
			},
			{
				name: 'file_patterns',
				type: 'string[]',
				description: 'Glob patterns for files to analyze (e.g., ["**/*.md", "**/.eslintrc*"])',
				required: false,
				default: ['**/*.md', '**/README*', '**/.eslintrc*'],
			},
		],
		example_prompts: [
			'What are the coding standards for this project?',
			'Show me the ESLint rules',
			'What style guide should I follow?',
		],
		generator: generateCodingGuidelines,
	},
	{
		name: 'memory_summary',
		description: 'Generate a summary of stored memories relevant to the current context',
		arguments: [
			{
				name: 'query',
				type: 'string',
				description: 'Search query to find relevant memories',
				required: false,
			},
			{
				name: 'limit',
				type: 'number',
				description: 'Maximum number of memories to include',
				required: false,
				default: 5,
			},
		],
		example_prompts: [
			'What do you remember about React hooks?',
			'Search memories for API authentication',
			'Find stored information about database schema',
		],
		generator: async (args, agent) => {
			const { query, limit = 5 } = args;

			if (!query || typeof query !== 'string') {
				return 'No query provided. Please specify a search query to retrieve relevant memories.';
			}

			try {
				// Note: Memory search feature requires implementation
				// For now, return a placeholder message
				return `## Memory Summary\n\n**Query:** ${query}\n\n_Memory search feature is not yet available in this prompt context._\n\nPlease use the \`ask_cipher\` tool for memory operations.`;
			} catch (error) {
				return `Failed to retrieve memories: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	},
];

/**
 * Get a prompt template by name
 */
export function getPromptTemplate(name: string): PromptTemplate | undefined {
	return PROMPT_TEMPLATES.find(template => template.name === name);
}

/**
 * Get all prompt template names
 */
export function getPromptTemplateNames(): string[] {
	return PROMPT_TEMPLATES.map(template => template.name);
}
