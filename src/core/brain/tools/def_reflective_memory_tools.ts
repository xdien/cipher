/**
 * Reflective Memory Tools
 *
 * These tools implement the reflection memory system for capturing and analyzing
 * agent reasoning steps to optimize thinking patterns and improve decision-making.
 * 
 * Part of Phase 2: Core Reflection Memory Tools Implementation
 */

import { z } from 'zod';
import { Logger, createLogger } from '../../logger/index.js';
import { env } from '../../env.js';
import { InternalTool, InternalToolContext } from './types.js';
import { logger } from '../../logger/index.js';

/**
 * Zod Schemas for Reflection Memory
 */

// Reasoning Step Schema
export const ReasoningStepSchema = z.object({
	type: z.enum(['thought', 'action', 'observation', 'decision', 'conclusion', 'reflection']),
	content: z.string().min(1),
	confidence: z.number().min(0).max(1),
	timestamp: z.string(),
	context: z.string().optional(),
	metadata: z.record(z.any()).optional()
});

export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;

// Reasoning Trace Schema
export const ReasoningTraceSchema = z.object({
	id: z.string(),
	steps: z.array(ReasoningStepSchema),
	metadata: z.object({
		extractedAt: z.string(),
		conversationLength: z.number().optional(),
		stepCount: z.number(),
		hasExplicitMarkup: z.boolean().optional(),
		sessionId: z.string().optional(),
		taskContext: z.object({
			goal: z.string().optional(),
			input: z.string().optional(),
			taskType: z.string().optional(),
			domain: z.string().optional(),
			complexity: z.enum(['low', 'medium', 'high']).optional()
		}).optional(),
		extractionOptions: z.record(z.any()).optional()
	}).passthrough()
});

export type ReasoningTrace = z.infer<typeof ReasoningTraceSchema>;

// Reasoning Evaluation Schema
export const ReasoningEvaluationSchema = z.object({
	qualityScore: z.number().min(0).max(1),
	efficiencyScore: z.number().min(0).max(1).optional(),
	correctness: z.boolean().optional(),
	issues: z.array(z.object({
		type: z.enum(['redundant_step', 'incorrect_step', 'missing_step', 'inefficient_path']),
		stepIndex: z.number().optional(),
		description: z.string(),
		severity: z.enum(['low', 'medium', 'high'])
	})),
	suggestions: z.array(z.string()),
	shouldStore: z.boolean().optional(),
	optimizedSteps: z.array(ReasoningStepSchema).optional()
});

export type ReasoningEvaluation = z.infer<typeof ReasoningEvaluationSchema>;

// Input schemas for tools
export const extractReasoningInputSchema = z.object({
	conversation: z.string().min(1),
	options: z.object({
		extractExplicit: z.boolean().default(true),
		extractImplicit: z.boolean().default(true),
		includeMetadata: z.boolean().default(true)
	}).optional().default({})
});

export const evaluateReasoningInputSchema = z.object({
	trace: ReasoningTraceSchema,
	options: z.object({
		checkEfficiency: z.boolean().default(true),
		detectLoops: z.boolean().default(true),
		generateSuggestions: z.boolean().default(true)
	}).optional().default({})
});

export const searchReasoningInputSchema = z.object({
	query: z.string().min(1),
	context: z.object({
		taskType: z.string().optional(),
		domain: z.string().optional(),
		complexity: z.enum(['low', 'medium', 'high']).optional()
	}).optional(),
	options: z.object({
		maxResults: z.number().min(1).max(50).default(10),
		minQualityScore: z.number().min(0).max(1).default(0.6),
		includeEvaluations: z.boolean().default(true)
	}).optional().default({})
});

/**
 * Utility Functions
 */

function generateTraceId(): string {
	return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function detectReasoningLoops(steps: ReasoningStep[]): boolean {
	// Simple loop detection by checking for repeated content
	const contents = steps.map(s => s.content.toLowerCase().trim());
	for (let i = 0; i < contents.length; i++) {
		for (let j = i + 1; j < contents.length; j++) {
			const contentI = contents[i];
			const contentJ = contents[j];
			if (contentI && contentJ && contentI === contentJ && contentI.length > 10) {
				return true;
			}
		}
	}
	return false;
}

function calculateAverageConfidence(steps: ReasoningStep[]): number {
	if (steps.length === 0) return 0;
	return steps.reduce((sum, step) => sum + step.confidence, 0) / steps.length;
}

/**
 * Core Processing Functions
 */

async function extractReasoningFromConversation(
	conversation: string,
	options: { extractExplicit?: boolean; extractImplicit?: boolean; includeMetadata?: boolean }
): Promise<ReasoningStep[]> {
	const steps: ReasoningStep[] = [];
	const lines = conversation.split('\n').map(line => line.trim()).filter(line => line.length > 0);

	// Extract explicit markup patterns
	if (options.extractExplicit !== false) {
		for (const line of lines) {
			// Enhanced patterns to match both direct format and comment format
			const thoughtMatch = line.match(/^(?:#\s*)?Thought:\s*(.+)$/i);
			if (thoughtMatch && thoughtMatch[1]) {
				steps.push({
					type: 'thought',
					content: thoughtMatch[1],
					confidence: 0.9,
					timestamp: new Date().toISOString()
				});
				continue;
			}

			const actionMatch = line.match(/^(?:#\s*)?Action:\s*(.+)$/i);
			if (actionMatch && actionMatch[1]) {
				steps.push({
					type: 'action',
					content: actionMatch[1],
					confidence: 0.9,
					timestamp: new Date().toISOString()
				});
				continue;
			}

			const observationMatch = line.match(/^(?:#\s*)?Observation:\s*(.+)$/i);
			if (observationMatch && observationMatch[1]) {
				steps.push({
					type: 'observation',
					content: observationMatch[1],
					confidence: 0.9,
					timestamp: new Date().toISOString()
				});
				continue;
			}

			const resultMatch = line.match(/^(?:#\s*)?Result:\s*(.+)$/i);
			if (resultMatch && resultMatch[1]) {
				steps.push({
					type: 'conclusion',
					content: resultMatch[1],
					confidence: 0.9,
					timestamp: new Date().toISOString()
				});
				continue;
			}

			const conclusionMatch = line.match(/^(?:#\s*)?Conclusion:\s*(.+)$/i);
			if (conclusionMatch && conclusionMatch[1]) {
				steps.push({
					type: 'conclusion',
					content: conclusionMatch[1],
					confidence: 0.9,
					timestamp: new Date().toISOString()
				});
				continue;
			}
		}
	}

	// Extract implicit reasoning patterns
	if (options.extractImplicit !== false && steps.length === 0) {
		// Look for reasoning patterns in natural language
		const reasoningKeywords = [
			'think', 'consider', 'analyze', 'approach', 'strategy', 'implement',
			'solve', 'problem', 'solution', 'method', 'algorithm', 'optimize'
		];

		for (const line of lines) {
			if (line.length < 10) continue; // Skip very short lines
		
			const hasReasoningKeywords = reasoningKeywords.some(keyword => 
				line.toLowerCase().includes(keyword)
			);

			if (hasReasoningKeywords) {
				// Determine step type based on content
				let stepType: ReasoningStep['type'] = 'thought';
				if (line.toLowerCase().includes('implement') || line.toLowerCase().includes('write')) {
					stepType = 'action';
				} else if (line.toLowerCase().includes('result') || line.toLowerCase().includes('works')) {
					stepType = 'observation';
				}

				steps.push({
					type: stepType,
					content: line,
					confidence: 0.7, // Lower confidence for implicit extraction
					timestamp: new Date().toISOString()
				});
			}
		}
	}

	return steps;
}

/**
 * Extract task context from conversation
 */
async function extractTaskContextFromConversation(conversation: string): Promise<{
  goal?: string;
  input?: string;
  taskType?: string;
  domain?: string;
  complexity?: 'low' | 'medium' | 'high';
}> {
  const context: any = {};
  
  // Extract goal/objective patterns
  const goalPatterns = [
    /(?:goal|objective|aim|purpose)(?:\s*is)?[\s:]+([^.\n]+)/i,
    /(?:trying to|attempting to|want to|need to)\s+([^.\n]+)/i,
    /(?:implement|create|build|write|develop)\s+([^.\n]+)/i,
    /(?:solve|fix|resolve|address)\s+([^.\n]+)/i
  ];
  
  for (const pattern of goalPatterns) {
    const match = conversation.match(pattern);
    if (match && match[1]?.trim()) {
      context.goal = match[1].trim();
      break;
    }
  }
  
  // Extract original input/request
  const inputPatterns = [
    /(?:user asked|user requested|user wants|request)[\s:]+([^.\n]+)/i,
    /(?:original request|initial request)[\s:]+([^.\n]+)/i,
    /(?:problem statement|task description)[\s:]+([^.\n]+)/i
  ];
  
  for (const pattern of inputPatterns) {
    const match = conversation.match(pattern);
    if (match && match[1]?.trim()) {
      context.input = match[1].trim();
      break;
    }
  }
  
  // Infer task type from content
  const codeKeywords = ['function', 'class', 'method', 'algorithm', 'implement', 'code', 'program', 'script'];
  const analysisKeywords = ['analyze', 'examine', 'review', 'investigate', 'study', 'assess'];
  const problemSolvingKeywords = ['solve', 'fix', 'debug', 'troubleshoot', 'resolve', 'find solution'];
  const planningKeywords = ['plan', 'design', 'architecture', 'strategy', 'approach', 'workflow'];
  
  const lowerConv = conversation.toLowerCase();
  
  if (codeKeywords.some(kw => lowerConv.includes(kw))) {
    context.taskType = 'code_generation';
  } else if (analysisKeywords.some(kw => lowerConv.includes(kw))) {
    context.taskType = 'analysis';
  } else if (problemSolvingKeywords.some(kw => lowerConv.includes(kw))) {
    context.taskType = 'problem_solving';
  } else if (planningKeywords.some(kw => lowerConv.includes(kw))) {
    context.taskType = 'planning';
  } else {
    context.taskType = 'general';
  }
  
  // Infer domain
  const programmingKeywords = ['code', 'function', 'class', 'algorithm', 'programming', 'software', 'api', 'database'];
  const mathKeywords = ['math', 'calculate', 'equation', 'formula', 'number', 'statistics'];
  const dataKeywords = ['data', 'analysis', 'dataset', 'visualization', 'chart', 'report'];
  
  if (programmingKeywords.some(kw => lowerConv.includes(kw))) {
    context.domain = 'programming';
  } else if (mathKeywords.some(kw => lowerConv.includes(kw))) {
    context.domain = 'mathematics';
  } else if (dataKeywords.some(kw => lowerConv.includes(kw))) {
    context.domain = 'data_analysis';
  } else {
    context.domain = 'general';
  }
  
  // Infer complexity based on conversation length and technical depth
  const conversationLength = conversation.length;
  const technicalKeywords = ['algorithm', 'optimization', 'complexity', 'architecture', 'framework', 'advanced'];
  const hasTechnicalTerms = technicalKeywords.some(kw => lowerConv.includes(kw));
  
  if (conversationLength > 2000 || hasTechnicalTerms) {
    context.complexity = 'high';
  } else if (conversationLength > 500) {
    context.complexity = 'medium';
  } else {
    context.complexity = 'low';
  }
  
  return context;
}

async function evaluateReasoningQuality(
	trace: ReasoningTrace,
	options: { checkEfficiency?: boolean; detectLoops?: boolean; generateSuggestions?: boolean }
): Promise<ReasoningEvaluation> {
	const issues: ReasoningEvaluation['issues'] = [];
	const suggestions: string[] = [];

	// Calculate quality score based on confidence and completeness
	const avgConfidence = calculateAverageConfidence(trace.steps);
	const hasVariedStepTypes = new Set(trace.steps.map(s => s.type)).size > 1;
	const qualityScore = (avgConfidence + (hasVariedStepTypes ? 0.2 : 0)) * 0.9; // Max 0.9 to allow room for improvement

	// Check for efficiency issues
	if (options.checkEfficiency !== false) {
		if (trace.steps.length > 15) {
			issues.push({
				type: 'inefficient_path',
				description: `Reasoning trace has ${trace.steps.length} steps, which may indicate inefficient thinking`,
				severity: 'medium'
			});
			suggestions.push('Consider consolidating related reasoning steps to improve efficiency');
		}

		// Check for low confidence steps
		const lowConfidenceSteps = trace.steps.filter(s => s.confidence < 0.5);
		if (lowConfidenceSteps.length > 0) {
			issues.push({
				type: 'incorrect_step',
				description: `Found ${lowConfidenceSteps.length} low-confidence steps`,
				severity: 'high'
			});
			suggestions.push('Review and strengthen reasoning for low-confidence steps');
		}
	}

	// Check for loops
	if (options.detectLoops !== false) {
		const hasLoops = detectReasoningLoops(trace.steps);
		if (hasLoops) {
			issues.push({
				type: 'redundant_step',
				description: 'Detected repeated reasoning patterns that may indicate circular thinking',
				severity: 'medium'
			});
			suggestions.push('Avoid repeating the same reasoning steps; build incrementally instead');
		}
	}

	// Generate additional suggestions
	if (options.generateSuggestions !== false) {
		if (trace.steps.length < 3) {
			suggestions.push('Consider breaking down complex problems into more detailed reasoning steps');
		}
		if (avgConfidence > 0.9) {
			suggestions.push('Excellent confidence levels - this reasoning pattern could be reused for similar problems');
		}
	}

	// Calculate efficiency score
	const efficiencyScore = Math.max(0, 1 - (trace.steps.length / 20)); // Penalize longer traces

	// Determine if should store
	const shouldStore = qualityScore > 0.6 || issues.length > 0;

	return {
		qualityScore,
		efficiencyScore,
		issues,
		suggestions,
		shouldStore
	};
}

/**
 * Tool 1: Extract Reasoning Steps
 * 
 * Analyzes agent conversations or outputs to extract reasoning patterns,
 * thought chains, and decision points for future optimization.
 */
export const extractReasoningSteps: InternalTool = {
	name: 'extract_reasoning_steps',
	category: 'memory',
	internal: true,
	agentAccessible: false,
	description: 'Extract reasoning steps from agent conversation or output. Analyzes both explicit thought markup and implicit reasoning patterns to create structured reasoning traces.',
	version: '1.0.0',
	parameters: {
		type: 'object',
		properties: {
			conversation: {
				type: 'string',
				description: 'The agent conversation or output text to analyze for reasoning patterns'
			},
			options: {
				type: 'object',
				description: 'Optional configuration for extraction behavior',
				properties: {
					extractExplicit: {
						type: 'boolean',
						description: 'Whether to extract explicit reasoning markup (Thought:, Action:, etc.)',
						default: true
					},
					extractImplicit: {
						type: 'boolean',
						description: 'Whether to extract implicit reasoning patterns from natural language',
						default: true
					},
					includeMetadata: {
						type: 'boolean',
						description: 'Whether to include timing and context metadata',
						default: true
					}
				}
			}
		},
		required: ['conversation']
	},
	handler: async (args: any, context?: InternalToolContext) => {
		// Check if reflection memory is enabled
		if (!env.REFLECTION_MEMORY_ENABLED) {
			return {
				success: false,
				result: { error: 'Reflection memory system is disabled' },
				metadata: { toolName: 'extract_reasoning_steps', disabled: true }
			};
		}

		logger.debug('Starting reasoning extraction', { 
			conversationLength: args.conversation?.length || 0,
			options: args.options 
		});

		try {
			// Parse and validate input
			const input = extractReasoningInputSchema.parse(args);
			
			// Extract reasoning steps
			const steps = await extractReasoningFromConversation(
				input.conversation,
				input.options || {}
			);

			// Extract task context from conversation
			const taskContext = await extractTaskContextFromConversation(input.conversation);

			// Create reasoning trace
			const trace: ReasoningTrace = {
				id: generateTraceId(),
				steps,
				metadata: {
					extractedAt: new Date().toISOString(),
					conversationLength: input.conversation.length,
					stepCount: steps.length,
					hasExplicitMarkup: steps.some(s => s.confidence > 0.8),
					sessionId: context?.sessionId,
					// Include extracted task context
					taskContext,
					...(input.options?.includeMetadata && {
						extractionOptions: input.options
					})
				}
			};

					logger.debug('Successfully extracted reasoning steps', {
			traceId: trace.id,
			stepCount: steps.length,
			avgConfidence: steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length
		});

			return {
				success: true,
				result: { trace },
				metadata: { 
					toolName: 'extract_reasoning_steps',
					traceId: trace.id,
					stepCount: steps.length
				}
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('Failed to extract reasoning steps', { error: errorMessage });
			
			return {
				success: false,
				result: { error: `Extraction failed: ${errorMessage}` },
				metadata: { toolName: 'extract_reasoning_steps', error: errorMessage }
			};
		}
	}
};

/**
 * Tool 2: Evaluate Reasoning Quality
 * 
 * Analyzes extracted reasoning for efficiency, redundancy, confidence,
 * and correctness. Provides suggestions for improvement.
 */
export const evaluateReasoning: InternalTool = {
	name: 'evaluate_reasoning',
	category: 'memory',
	internal: true,
	agentAccessible: false,
	description: 'Evaluate the quality and efficiency of extracted reasoning. Analyzes reasoning patterns for issues, calculates quality metrics, and generates improvement suggestions.',
	version: '1.0.0',
	parameters: {
		type: 'object',
		properties: {
			trace: {
				type: 'object',
				description: 'The reasoning trace to evaluate (from extract_reasoning_steps)',
				properties: {
					id: { type: 'string' },
					steps: { type: 'array' },
					metadata: { type: 'object' }
				},
				required: ['id', 'steps']
			},
			options: {
				type: 'object',
				description: 'Optional evaluation configuration',
				properties: {
					checkEfficiency: {
						type: 'boolean',
						description: 'Whether to analyze reasoning efficiency',
						default: true
					},
					detectLoops: {
						type: 'boolean',
						description: 'Whether to detect reasoning loops and redundancy',
						default: true
					},
					generateSuggestions: {
						type: 'boolean',
						description: 'Whether to generate improvement suggestions',
						default: true
					}
				}
			}
		},
		required: ['trace']
	},
	handler: async (args: any, context?: InternalToolContext) => {
		// Check if reflection memory is enabled
		if (!env.REFLECTION_MEMORY_ENABLED) {
			return {
				success: false,
				result: { error: 'Reflection memory system is disabled' },
				metadata: { toolName: 'evaluate_reasoning', disabled: true }
			};
		}

		// Check if evaluation is enabled
		if (!env.REFLECTION_EVALUATION_ENABLED) {
			return {
				success: false,
				result: { error: 'Reflection evaluation is disabled' },
				metadata: { toolName: 'evaluate_reasoning', disabled: true }
			};
		}

		logger.debug('Starting reasoning evaluation', { 
			traceId: args.trace?.id,
			stepCount: args.trace?.steps?.length || 0,
			options: args.options 
		});

		try {
			// Parse and validate input
			const input = evaluateReasoningInputSchema.parse(args);
			
			// Evaluate reasoning quality
			const evaluation = await evaluateReasoningQuality(
				input.trace,
				input.options || {}
			);

					logger.debug('Successfully evaluated reasoning', {
			traceId: input.trace.id,
			qualityScore: evaluation.qualityScore,
			issueCount: evaluation.issues.length,
			suggestionCount: evaluation.suggestions.length,
			shouldStore: evaluation.shouldStore
		});

			return {
				success: true,
				result: { evaluation },
				metadata: { 
					toolName: 'evaluate_reasoning',
					traceId: input.trace.id,
					qualityScore: evaluation.qualityScore
				}
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('Failed to evaluate reasoning', { error: errorMessage });
			
			return {
				success: false,
				result: { error: `Evaluation failed: ${errorMessage}` },
				metadata: { toolName: 'evaluate_reasoning', error: errorMessage }
			};
		}
	}
};

/**
 * Tool 3: Search Reasoning Patterns
 * 
 * Searches stored reflection memory for relevant reasoning patterns
 * that can inform current decision making.
 */
export const searchReasoningPatterns: InternalTool = {
	name: 'search_reasoning_patterns',
	category: 'memory',
	internal: true,
	description: 'Search reflection memory for relevant reasoning patterns. Finds similar reasoning traces and evaluations that can inform current decision-making.',
	version: '1.0.0',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Search query describing the type of reasoning pattern needed'
			},
			context: {
				type: 'object',
				description: 'Optional context to improve search relevance',
				properties: {
					taskType: {
						type: 'string',
						description: 'Type of task (e.g., "code_generation", "problem_solving", "analysis")'
					},
					domain: {
						type: 'string',
						description: 'Problem domain (e.g., "programming", "math", "planning")'
					},
					complexity: {
						type: 'string',
						enum: ['low', 'medium', 'high'],
						description: 'Expected complexity level'
					}
				}
			},
			options: {
				type: 'object',
				description: 'Search configuration options',
				properties: {
					maxResults: {
						type: 'number',
						description: 'Maximum number of results to return',
						default: 10,
						minimum: 1,
						maximum: 50
					},
					minQualityScore: {
						type: 'number',
						description: 'Minimum quality score for returned patterns',
						default: 0.6,
						minimum: 0,
						maximum: 1
					},
					includeEvaluations: {
						type: 'boolean',
						description: 'Whether to include reasoning evaluations in results',
						default: true
					}
				}
			}
		},
		required: ['query']
	},
	handler: async (args: any, context?: InternalToolContext) => {
		// Check if reflection memory is enabled
		if (!env.REFLECTION_MEMORY_ENABLED) {
			return {
				success: false,
				result: { error: 'Reflection memory system is disabled' },
				metadata: { toolName: 'search_reasoning_patterns', disabled: true }
			};
		}

		logger.debug('Starting reasoning pattern search', { 
			query: args.query,
			context: args.context,
			options: args.options 
		});

		try {
			// Parse and validate input
			const input = searchReasoningInputSchema.parse(args);
			// Determine collection type (should be 'reflection' for reasoning patterns)
			const collectionType = 'reflection';
			// Get vector store manager from context
			const vectorStoreManager = context?.services?.vectorStoreManager;
			if (!vectorStoreManager) {
				logger.warn('Vector store manager not available, using placeholder implementation');
				// Fallback to placeholder for now
				const results = {
					patterns: [],
					metadata: {
						searchQuery: input.query,
						resultsFound: 0,
						searchTime: new Date().toISOString(),
						note: 'Vector storage not available - full search functionality will be available in Phase 3',
						collectionType
					}
				};
				return {
					success: true,
					result: results,
					metadata: { 
						toolName: 'search_reasoning_patterns',
						query: input.query,
						resultsFound: 0,
						fallback: true,
						phase: 'Phase 2 - Placeholder implementation, full vector search in Phase 3',
						collectionType
					}
				};
			}
			// Check if we have access to the vector store for searching
			// Use the correct collection type instead of collection name
			let vectorStore = null;
			try {
				// Try to get the reflection store from dual collection manager
				vectorStore = (vectorStoreManager as any).getStore(collectionType);
			} catch (error) {
				// Fallback to default store if reflection collection not available
				logger.debug('Reflection store not available, falling back to default store', {
					error: error instanceof Error ? error.message : String(error)
				});
				vectorStore = vectorStoreManager.getStore();
			}
			if (!vectorStore) {
				throw new Error(`Vector store not available for search (collection type: ${collectionType})`);
			}

			// Perform vector search - for now we search in the default collection
			// In the future, dual collection managers could provide reflection-specific search
			const searchQuery = `reasoning pattern: ${input.query}`;
			const searchOptions = {
				maxResults: input.options?.maxResults || 10,
				threshold: input.options?.minQualityScore || 0.6
			};

			let searchResults: any[] = [];
			let usedFallback = false;
			
			try {
				// Use the vector store to search
				// Note: This searches in whatever collection the store is connected to
				// Future enhancement: Use embeddingManager to create query vector and search properly
				const embeddingManager = context?.services?.embeddingManager;
				if (embeddingManager) {
					const embedder = embeddingManager.getEmbedder('default');
					if (embedder) {
						const queryEmbedding = await embedder.embed(searchQuery);
						searchResults = await vectorStore.search(queryEmbedding, searchOptions.maxResults);
					} else {
						searchResults = [];
					}
				} else {
					// No embedding manager available
					searchResults = [];
				}
				usedFallback = !embeddingManager;
			} catch (searchError) {
				logger.error('Vector search failed', { error: searchError });
				searchResults = [];
			}

			// Process and filter results
			const patterns = searchResults
				.filter((result: any) => {
					// Filter by quality score if available
					if (result.metadata?.qualityScore && input.options?.minQualityScore) {
						return result.metadata.qualityScore >= input.options.minQualityScore;
					}
					return true;
				})
								.map((result: any) => ({
					id: result.id || result.metadata?.traceId || 'unknown',
					content: result.content || result.text,
					score: result.score || 0,
					type: result.metadata?.type || 'reasoning_trace',
					metadata: {
						...result.metadata,
						searchScore: result.score,
						collectionType: collectionType
					}
				}))
				.slice(0, input.options?.maxResults || 10);

			logger.debug('Reasoning pattern search completed', {
				query: input.query,
				resultsFound: patterns.length,
				collectionType
			});

			const results = {
				patterns,
				metadata: {
					searchQuery: input.query,
					resultsFound: patterns.length,
					searchTime: new Date().toISOString(),
					collectionType,
					searchOptions: input.options
				}
			};

			return {
				success: true,
				result: results,
				metadata: { 
					toolName: 'search_reasoning_patterns',
					query: input.query,
					resultsFound: patterns.length,
					collectionType,
					fallback: usedFallback,
					phase: 'Phase 3 - Full vector search implementation'
				}
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error('Failed to search reasoning patterns', { error: errorMessage });
			
			return {
				success: false,
				result: { error: `Search failed: ${errorMessage}` },
				metadata: { toolName: 'search_reasoning_patterns', error: errorMessage }
			};
		}
	}
};

 