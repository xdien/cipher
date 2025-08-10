/**
 * Memory Payload Structures (V2 Only - Simplified)
 *
 * Clean, optimized payload structures for both knowledge and reasoning memory.
 * No migration complexity - all data is V2 format after collection cleanup.
 */

export interface BasePayload {
	id: number;
	text: string;
	timestamp: string;
	version: 2; // Always V2 after cleanup
	// Cross-tool sharing identifiers
	userId?: string;
	projectId?: string;
	workspaceMode?: 'shared' | 'isolated';
}

/**
 * Knowledge Memory Payload - For factual information and patterns
 */
export interface KnowledgePayload extends BasePayload {
	tags: string[];
	confidence: number;
	reasoning: string;
	event: 'ADD' | 'UPDATE' | 'DELETE' | 'NONE';
	// Enhanced V2 fields
	domain?: string;
	sourceSessionId?: string;
	qualitySource: 'similarity' | 'llm' | 'heuristic';
	// Optional existing fields
	code_pattern?: string;
	old_memory?: string;
}

/**
 * Reasoning Memory Payload - Simplified format focusing on reasoning steps and evaluation
 * Append-only, stores raw reasoning steps + evaluation
 */
export interface ReasoningPayload extends BasePayload {
	tags: string[]; // Simplified: ['reasoning']
	// APPEND-ONLY: No event field - always appends new reasoning traces
	// RAW DATA STORAGE: Store complete reasoning steps and evaluation (no extraction)
	reasoningSteps: Array<{
		type: string;
		content: string;
		[key: string]: any; // Preserve any additional step data (except confidence/timestamp)
	}>;
	evaluation: {
		qualityScore: number;
		issues: Array<{
			type: string;
			description: string;
			severity?: string;
			[key: string]: any; // Preserve any additional issue data
		}>;
		suggestions: string[];
		[key: string]: any; // Preserve any additional evaluation data
	};
	context: string; // Single context field for reasoning steps
	stepCount: number; // Computed: reasoningSteps.length
	stepTypes: string[]; // Computed: unique step types
	issueCount: number; // Computed: evaluation.issues.length
	sourceSessionId?: string;
}

/**
 * Create new knowledge payload (V2 format)
 */
export function createKnowledgePayload(
	id: number,
	text: string,
	tags: string[],
	confidence: number,
	reasoning: string,
	event: 'ADD' | 'UPDATE' | 'DELETE' | 'NONE',
	options: {
		domain?: string;
		sourceSessionId?: string;
		qualitySource: 'similarity' | 'llm' | 'heuristic';
		code_pattern?: string;
		old_memory?: string;
		userId?: string;
		projectId?: string;
		workspaceMode?: 'shared' | 'isolated';
	}
): KnowledgePayload {
	// Import env here to avoid circular dependencies
	const { env } = require('../../../../env.js');
	
	return {
		id,
		text,
		tags,
		confidence,
		reasoning,
		event,
		timestamp: new Date().toISOString(),
		version: 2,
		...(options.domain && { domain: options.domain }),
		...(options.sourceSessionId && { sourceSessionId: options.sourceSessionId }),
		qualitySource: options.qualitySource,
		...(options.code_pattern && { code_pattern: options.code_pattern }),
		...(options.old_memory && { old_memory: options.old_memory }),
		// Add cross-tool sharing identifiers (env vars take precedence for security)
		userId: env.CIPHER_USER_ID || options.userId,
		projectId: env.CIPHER_PROJECT_NAME || options.projectId,
		workspaceMode: env.CIPHER_WORKSPACE_MODE || options.workspaceMode || 'isolated',
	};
}

/**
 * Create new reasoning payload (simplified format)
 */
export function createReasoningPayload(
	id: number,
	text: string,
	reasoningSteps: Array<{
		type: string;
		content: string;
		[key: string]: any;
	}>,
	evaluation: {
		qualityScore: number;
		issues: Array<{
			type: string;
			description: string;
			severity?: string;
			[key: string]: any;
		}>;
		suggestions: string[];
		[key: string]: any;
	},
	context: string,
	options: {
		sourceSessionId?: string;
		userId?: string;
		projectId?: string;
		workspaceMode?: 'shared' | 'isolated';
	} = {}
): ReasoningPayload {
	// Import env here to avoid circular dependencies
	const { env } = require('../../../../env.js');
	
	// Compute derived metrics from raw data
	const stepCount = reasoningSteps.length;
	const stepTypes = Array.from(new Set(reasoningSteps.map(step => step.type)));
	const issueCount = evaluation.issues.length;

	return {
		id,
		text,
		timestamp: new Date().toISOString(),
		version: 2,
		tags: ['reasoning'],
		reasoningSteps,
		evaluation,
		context,
		stepCount,
		stepTypes,
		issueCount,
		...(options.sourceSessionId && { sourceSessionId: options.sourceSessionId }),
		// Add cross-tool sharing identifiers (env vars take precedence for security)
		userId: env.CIPHER_USER_ID || options.userId,
		projectId: env.CIPHER_PROJECT_NAME || options.projectId,
		workspaceMode: env.CIPHER_WORKSPACE_MODE || options.workspaceMode || 'isolated',
	};
}
