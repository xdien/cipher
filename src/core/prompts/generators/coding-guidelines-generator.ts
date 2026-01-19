/**
 * Coding guidelines prompt generator
 * Generates coding guidelines based on project files and patterns
 */

import type { MemAgent } from '../../brain/memAgent/agent.js';
import type { PromptGenerationArgs } from '../types.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../../logger/index.js';

/**
 * Generate coding guidelines prompt
 */
export async function generateCodingGuidelines(
	args: PromptGenerationArgs,
	agent: MemAgent
): Promise<string> {
	const { project_path } = args;

	if (!project_path || typeof project_path !== 'string') {
		return 'No project path provided. Please specify a project path to generate coding guidelines.';
	}

	let guidelines = '## Coding Guidelines\n\n';

	try {
		// Check for common guideline files
		const guidelineFiles = [
			'CONTRIBUTING.md',
			'CODING_STYLE.md',
			'README.md',
			'.eslintrc.js',
			'.eslintrc.json',
			'.prettierrc',
			'tsconfig.json',
		];

		const foundGuidelines: string[] = [];

		for (const file of guidelineFiles) {
			const filePath = join(project_path, file);
			try {
				const content = await fs.readFile(filePath, 'utf-8');
				foundGuidelines.push(`### From ${file}\n\n${extractRelevantSections(content, file)}\n`);
			} catch (error) {
				// File doesn't exist, skip
				logger.debug(`[Coding Guidelines] File not found: ${file}`);
			}
		}

		if (foundGuidelines.length > 0) {
			guidelines += foundGuidelines.join('\n');
		} else {
			guidelines += 'No specific coding guidelines found in project files.\n';
			guidelines += 'Following general best practices for the detected language.\n';
		}
	} catch (error) {
		logger.warn('[Coding Guidelines Generator] Error:', error);
		guidelines += 'Failed to analyze project guidelines.\n';
	}

	return guidelines;
}

/**
 * Extract relevant sections from guideline files
 */
function extractRelevantSections(content: string, filename: string): string {
	const maxLength = 500;

	// For JSON config files, format nicely
	if (filename.endsWith('.json') || filename.endsWith('.js')) {
		try {
			const config = filename.endsWith('.json') ? JSON.parse(content) : content;
			return `\`\`\`json\n${JSON.stringify(config, null, 2).substring(0, maxLength)}\n\`\`\``;
		} catch {
			return content.substring(0, maxLength);
		}
	}

	// For markdown files, extract key sections
	if (filename.endsWith('.md')) {
		const lines = content.split('\n');
		const relevantSections: string[] = [];
		let inRelevantSection = false;

		for (const line of lines) {
			// Look for sections about coding style, conventions, etc.
			if (
				line.match(/^#+\s*(coding|style|convention|guideline|standard|format)/i)
			) {
				inRelevantSection = true;
			} else if (line.match(/^#+\s/)) {
				inRelevantSection = false;
			}

			if (inRelevantSection) {
				relevantSections.push(line);
			}

			if (relevantSections.join('\n').length > maxLength) {
				break;
			}
		}

		return relevantSections.length > 0
			? relevantSections.join('\n')
			: content.substring(0, maxLength);
	}

	return content.substring(0, maxLength);
}
