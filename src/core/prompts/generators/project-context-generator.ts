/**
 * Project context prompt generator
 * Generates context-aware prompts based on project files and structure
 */

import type { MemAgent } from '../../brain/memAgent/agent.js';
import type { PromptGenerationArgs } from '../types.js';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { logger } from '../../logger/index.js';

/**
 * Generate project context prompt
 */
export async function generateProjectContext(
	args: PromptGenerationArgs,
	agent: MemAgent
): Promise<string> {
	const { project_path, include_history = false } = args;

	let context = '';

	// Add project information if path provided
	if (project_path && typeof project_path === 'string') {
		try {
			const projectInfo = await analyzeProject(project_path);
			context += `## Project Context\n\n`;
			context += `**Project Path:** ${project_path}\n`;
			context += `**Project Type:** ${projectInfo.type}\n`;
			context += `**Main Language:** ${projectInfo.language}\n\n`;

			if (projectInfo.description) {
				context += `**Description:** ${projectInfo.description}\n\n`;
			}

			if (projectInfo.dependencies.length > 0) {
				context += `**Key Dependencies:**\n`;
				projectInfo.dependencies.slice(0, 10).forEach(dep => {
					context += `- ${dep}\n`;
				});
				context += '\n';
			}
		} catch (error) {
			logger.warn('[Project Context Generator] Failed to analyze project:', error);
			context += `## Project Context\n\n**Project Path:** ${project_path}\n\n`;
		}
	}

	// Note: Conversation history feature requires SessionManager.getRecentMessages() 
	// which is not yet implemented. Skipping for now.
	if (include_history) {
		context += `\n_Note: Conversation history feature is not yet available._\n`;
	}

	if (!context) {
		context = 'No specific project context available. Ready to assist with general tasks.';
	}

	return context;
}

interface ProjectInfo {
	type: string;
	language: string;
	description?: string;
	dependencies: string[];
}

/**
 * Analyze project structure and metadata
 */
async function analyzeProject(projectPath: string): Promise<ProjectInfo> {
	const result: ProjectInfo = {
		type: 'unknown',
		language: 'unknown',
		dependencies: [],
	};

	try {
		// Check for package.json (Node.js/TypeScript)
		const packageJsonPath = join(projectPath, 'package.json');
		const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
		const packageJson = JSON.parse(packageJsonContent);
		
		result.type = 'Node.js';
		
		// Check for TypeScript
		try {
			await fs.access(join(projectPath, 'tsconfig.json'));
			result.language = 'TypeScript';
		} catch {
			result.language = 'JavaScript';
		}
		
		result.description = packageJson.description;
		result.dependencies = [
			...Object.keys(packageJson.dependencies || {}),
			...Object.keys(packageJson.devDependencies || {}),
		];
		return result;
	} catch {
		// Not a Node.js project, continue checking
	}

	try {
		// Check for requirements.txt (Python)
		const requirementsPath = join(projectPath, 'requirements.txt');
		const requirements = await fs.readFile(requirementsPath, 'utf-8');
		
		result.type = 'Python';
		result.language = 'Python';
		result.dependencies = requirements
			.split('\n')
			.filter(line => line.trim() && !line.startsWith('#'))
			.map(line => line.split('==')[0].trim());
		return result;
	} catch {
		// Not a Python project, continue checking
	}

	try {
		// Check for Cargo.toml (Rust)
		await fs.access(join(projectPath, 'Cargo.toml'));
		result.type = 'Rust';
		result.language = 'Rust';
		return result;
	} catch {
		// Not a Rust project, continue checking
	}

	try {
		// Check for go.mod (Go)
		await fs.access(join(projectPath, 'go.mod'));
		result.type = 'Go';
		result.language = 'Go';
		return result;
	} catch {
		// Not a Go project
	}

	return result;
}
