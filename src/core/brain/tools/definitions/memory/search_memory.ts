import { InternalTool, InternalToolContext } from '../../types.js';
import { logger } from '../../../../logger/index.js';
// Import payload migration utilities
import { KnowledgePayload, ReasoningPayload } from './payloads.js';
import { env } from '../../../../env.js';

/**
 * Memory Search Tool Result Interface
 */
interface MemorySearchResult {
	success: boolean;
	query: string;
	results: Array<{
		id: string;
		text: string;
		tags: string[];
		timestamp: string;
		similarity: number;
		source?: 'knowledge' | 'reflection';
		memoryType?: 'knowledge' | 'reflection';
		version?: number;
		// Knowledge memory fields
		confidence?: number;
		reasoning?: string;
		event?: string;
		domain?: string;
		qualitySource?: string;
		code_pattern?: string;
		old_memory?: string;
		// Reasoning memory fields
		reasoningSteps?: Array<{
			type: string;
			content: string;
			confidence?: number;
			[key: string]: any;
		}>;
		evaluation?: {
			qualityScore: number;
			issues: Array<{
				type: string;
				description: string;
				severity?: string;
				[key: string]: any;
			}>;
			suggestions: string[];
			[key: string]: any;
		};
		taskContext?: {
			goal?: string;
			input?: string;
			taskType?: string;
			domain?: string;
			complexity?: 'low' | 'medium' | 'high';
			conversationLength?: number;
			hasExplicitMarkup?: boolean;
			[key: string]: any;
		};
		stepCount?: number;
		stepTypes?: string[];
		issueCount?: number;
		sourceSessionId?: string;
	}>;
	metadata: {
		totalResults: number;
		searchTime: number;
		embeddingTime: number;
		maxSimilarity: number;
		minSimilarity: number;
		averageSimilarity: number;
		knowledgeResults?: number;
		reflectionResults?: number;
		searchMode: 'knowledge' | 'reflection' | 'both';
		usedFallback?: boolean;
	};
	timestamp: string;
}

/**
 * Memory Search Tool
 *
 * This tool enables semantic retrieval from the agent's memory system.
 * It searches over stored knowledge memories using vector similarity search
 * and returns relevant entries that can inform the current reasoning process.
 */
export const searchMemoryTool: InternalTool = {
	name: 'memory_search',
	category: 'memory',
	internal: true,
	agentAccessible: true, // Agent-accessible: one of two search tools available to agent
	description:
		'Perform semantic search over stored memory entries to retrieve relevant knowledge and reasoning traces that can inform current decision-making.',
	version: '1.0.0',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description:
					'The search query to find relevant memories. Use natural language to describe what you are looking for.',
				minLength: 1,
				maxLength: 1000,
			},
			top_k: {
				type: 'number',
				description: 'Maximum number of results to return (default: 5)',
				minimum: 1,
				maximum: 50,
				default: 5,
			},
			type: {
				type: 'string',
				description:
					'Type of memory to search. Defaults to environment variable SEARCH_MEMORY_TYPE (currently only "knowledge" is fully implemented).',
				enum: ['knowledge', 'reflection', 'both'],
				default: env.SEARCH_MEMORY_TYPE,
			},
			similarity_threshold: {
				type: 'number',
				description: 'Minimum similarity score for results (0.0 to 1.0, default: 0.3)',
				minimum: 0.0,
				maximum: 1.0,
				default: 0.3,
			},
			include_metadata: {
				type: 'boolean',
				description: 'Whether to include detailed metadata in results (default: true)',
				default: true,
			},
		},
		required: ['query'],
	},
	handler: async (args: any, context?: InternalToolContext): Promise<MemorySearchResult> => {
		const startTime = Date.now();

		try {
			logger.debug('MemorySearch: Processing search request', {
				query: args.query?.substring(0, 100) || 'undefined',
				top_k: args.top_k || 5,
				type: args.type || env.SEARCH_MEMORY_TYPE,
				similarity_threshold: args.similarity_threshold || 0.3,
			});

			// Validate required parameters
			if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
				throw new Error('Query is required and must be a non-empty string');
			}

			// Set defaults
			const query = args.query.trim();
			const topK = Math.max(1, Math.min(50, args.top_k || 5));
			const memoryType = args.type || env.SEARCH_MEMORY_TYPE;
			const similarityThreshold = Math.max(0.0, Math.min(1.0, args.similarity_threshold || 0.3));
			const includeMetadata = args.include_metadata !== false;

			// Get required services from context
			if (!context?.services) {
				throw new Error('InternalToolContext.services is required for memory search');
			}

			const embeddingManager = context.services.embeddingManager;
			const vectorStoreManager = context.services.vectorStoreManager;

			if (!embeddingManager || !vectorStoreManager) {
				throw new Error('EmbeddingManager and VectorStoreManager are required in context.services');
			}

			const embedder = embeddingManager.getEmbedder('default');

			if (!embedder?.embed || typeof embedder.embed !== 'function') {
				throw new Error('Embedder is not properly initialized or missing embed() method');
			}

			// Generate embedding for the search query
			const embeddingStartTime = Date.now();
			logger.debug('MemorySearch: Generating embedding for query', {
				queryLength: query.length,
				queryPreview: query.substring(0, 50),
			});

			const queryEmbedding = await embedder?.embed(query);
			const embeddingTime = Date.now() - embeddingStartTime;

			logger.debug('MemorySearch: Embedding generated successfully', {
				embeddingTime: `${embeddingTime}ms`,
				embeddingDimensions: Array.isArray(queryEmbedding) ? queryEmbedding.length : 'unknown',
			});
			// Detect vector store manager type and perform appropriate search
			const searchStartTime = Date.now();
			let allResults: any[] = [];
			let knowledgeResultCount = 0;
			let reflectionResultCount = 0;
			let usedFallback = false;

			// Check if we have a DualCollectionVectorManager
			const isDualManager =
				vectorStoreManager.constructor.name === 'DualCollectionVectorManager' ||
				(typeof vectorStoreManager.getStore === 'function' &&
					vectorStoreManager.getStore.length === 1); // getStore(type) signature

			if (isDualManager && (memoryType === 'both' || memoryType === 'reflection')) {
				logger.debug(
					'MemorySearch: Using DualCollectionVectorManager for multi-collection search',
					{
						requestedType: memoryType,
						isDualManager: true,
					}
				);

				try {
					// Search knowledge collection if needed
					if (memoryType === 'both' || memoryType === 'knowledge') {
						let knowledgeStore = null;
						try {
							// Try dual manager API first
							knowledgeStore = (vectorStoreManager as any).getStore('knowledge');
						} catch {
							// Fallback to single collection API
							knowledgeStore = vectorStoreManager.getStore();
						}

						if (knowledgeStore) {
							const knowledgeResults = await knowledgeStore.search(queryEmbedding, topK * 2);
							knowledgeResultCount = knowledgeResults.length;

							// Mark results with source
							const markedKnowledgeResults = knowledgeResults.map((result: any) => ({
								...result,
								payload: {
									...result.payload,
									source: 'knowledge',
									memoryType: 'knowledge',
								},
							}));

							allResults.push(...markedKnowledgeResults);

							logger.debug('MemorySearch: Knowledge collection search completed', {
								resultsFound: knowledgeResultCount,
							});
						}
					}

					// Search reflection collection if needed
					if (memoryType === 'both' || memoryType === 'reflection') {
						let reflectionStore = null;
						try {
							// Try dual manager API
							reflectionStore = (vectorStoreManager as any).getStore('reflection');
						} catch {
							// Reflection not available in single collection manager
							if (memoryType === 'reflection') {
								throw new Error('Reflection memory collection not available');
							}
						}

						if (reflectionStore) {
							const reflectionResults = await reflectionStore.search(queryEmbedding, topK * 2);
							reflectionResultCount = reflectionResults.length;

							// Mark results with source and extract reflection-specific metadata
							const markedReflectionResults = reflectionResults.map((result: any) => ({
								...result,
								payload: {
									...result.payload,
									source: 'reflection',
									memoryType: 'reflection',
									// Extract reflection-specific fields from metadata
									...(result.payload?.qualityScore && {
										qualityScore: result.payload.qualityScore,
									}),
									...(result.payload?.stepTypes && { stepTypes: result.payload.stepTypes }),
									...(result.payload?.issueCount && { issueCount: result.payload.issueCount }),
									...(result.payload?.traceId && { traceId: result.payload.traceId }),
								},
							}));

							allResults.push(...markedReflectionResults);

							logger.debug('MemorySearch: Reflection collection search completed', {
								resultsFound: reflectionResultCount,
							});
						} else if (memoryType === 'reflection') {
							// Reflection requested but not available
							throw new Error('Reflection memory collection not available');
						}
					}
				} catch (error) {
					logger.warn(
						'MemorySearch: Dual collection search failed, falling back to knowledge only',
						{
							error: error instanceof Error ? error.message : String(error),
							requestedType: memoryType,
						}
					);

					// Fallback to knowledge collection only
					usedFallback = true;
					const knowledgeStore = vectorStoreManager.getStore();
					if (knowledgeStore) {
						const fallbackResults = await knowledgeStore.search(queryEmbedding, topK * 2);
						allResults = fallbackResults.map((result: any) => ({
							...result,
							payload: {
								...result.payload,
								source: 'knowledge',
								memoryType: 'knowledge',
							},
						}));
						knowledgeResultCount = allResults.length;
					}
				}
			} else {
				// Single collection manager or knowledge-only search
				logger.debug('MemorySearch: Using single collection search', {
					requestedType: memoryType,
					isDualManager: false,
				});

				if (memoryType === 'reflection') {
					throw new Error(
						'Reflection memory search requires DualCollectionVectorManager but single collection manager detected'
					);
				}

				const vectorStore = vectorStoreManager.getStore();
				if (!vectorStore) {
					throw new Error('VectorStore not available');
				}

				const singleResults = await vectorStore.search(queryEmbedding, topK * 2);
				allResults = singleResults.map((result: any) => ({
					...result,
					payload: {
						...result.payload,
						source: 'knowledge',
						memoryType: 'knowledge',
					},
				}));
				knowledgeResultCount = allResults.length;
			}

			const searchTime = Date.now() - searchStartTime;

			logger.debug('MemorySearch: All searches completed', {
				searchTime: `${searchTime}ms`,
				totalResults: allResults.length,
				knowledgeResults: knowledgeResultCount,
				reflectionResults: reflectionResultCount,
				requestedType: memoryType,
			});

			// Merge, rank, and filter results
			const filteredResults = allResults
				.filter(result => (result.score || 0) >= similarityThreshold)
				.sort((a, b) => (b.score || 0) - (a.score || 0)) // Sort by similarity score descending
				.slice(0, topK) // Take top K results overall
				.map(result => {
					const rawPayload = result.payload || {};

					// All data is V2 format after collection cleanup - no migration needed
					const payload = rawPayload as KnowledgePayload | ReasoningPayload;

					// Detect if this is knowledge or reasoning memory based on structure
					const isReasoningMemory =
						rawPayload.source === 'reflection' ||
						rawPayload.memoryType === 'reflection' ||
						(rawPayload.tags && rawPayload.tags.includes('reasoning')) ||
						'reasoningSteps' in rawPayload;

					// Return unified result format with V2 payload data
					const baseResult = {
						id: result.id || payload.id || 'unknown',
						text: payload.text || 'No content available',
						tags: payload.tags || [],
						timestamp: payload.timestamp || new Date().toISOString(),
						similarity: result.score || 0,
						version: payload.version || 2, // All data is V2 after cleanup
						...(rawPayload.source && { source: rawPayload.source }),
						...(rawPayload.memoryType && { memoryType: rawPayload.memoryType }),
					};

					// Add type-specific fields based on payload type
					if (isReasoningMemory) {
						// Reasoning memory - return raw reasoning steps and evaluation
						const reasoningPayload = payload as ReasoningPayload;
						return {
							...baseResult,
							reasoningSteps: reasoningPayload.reasoningSteps,
							evaluation: reasoningPayload.evaluation,
							taskContext: reasoningPayload.taskContext,
							// Computed metrics for convenience
							stepCount: reasoningPayload.stepCount,
							stepTypes: reasoningPayload.stepTypes,
							issueCount: reasoningPayload.issueCount,
							sourceSessionId: reasoningPayload.sourceSessionId,
						};
					} else {
						// Knowledge memory
						const knowledgePayload = payload as KnowledgePayload;
						return {
							...baseResult,
							confidence: knowledgePayload.confidence || 0,
							reasoning: knowledgePayload.reasoning || 'No reasoning available',
							event: knowledgePayload.event,
							domain: knowledgePayload.domain,
							qualitySource: knowledgePayload.qualitySource,
							sourceSessionId: knowledgePayload.sourceSessionId,
							...(knowledgePayload.code_pattern && { code_pattern: knowledgePayload.code_pattern }),
							...(knowledgePayload.old_memory && { old_memory: knowledgePayload.old_memory }),
						};
					}
				});

			// Calculate memory type breakdown from filtered results
			const finalKnowledgeCount = filteredResults.filter(r => r.source === 'knowledge').length;
			const finalReflectionCount = filteredResults.filter(r => r.source === 'reflection').length;

			// Calculate statistics
			const totalResults = filteredResults.length;
			const similarities = filteredResults.map(r => r.similarity);
			const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;
			const minSimilarity = similarities.length > 0 ? Math.min(...similarities) : 0;
			const averageSimilarity =
				similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0;

			const totalTime = Date.now() - startTime;

			// Prepare result
			const result: MemorySearchResult = {
				success: true,
				query: query,
				results: filteredResults,
				metadata: {
					totalResults,
					searchTime: totalTime,
					embeddingTime,
					maxSimilarity,
					minSimilarity,
					averageSimilarity,
					knowledgeResults: finalKnowledgeCount,
					reflectionResults: finalReflectionCount,
					searchMode: memoryType as 'knowledge' | 'reflection' | 'both',
					usedFallback,
				},
				timestamp: new Date().toISOString(),
			};

			logger.debug('MemorySearch: Search completed successfully', {
				query: query.substring(0, 50),
				resultsFound: totalResults,
				knowledgeResults: finalKnowledgeCount,
				reflectionResults: finalReflectionCount,
				searchMode: memoryType,
				maxSimilarity: maxSimilarity.toFixed(3),
				averageSimilarity: averageSimilarity.toFixed(3),
				totalTime: `${totalTime}ms`,
				usedFallback,
			});

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const totalTime = Date.now() - startTime;

			logger.error('MemorySearch: Search failed', {
				error: errorMessage,
				query: args.query?.substring(0, 50) || 'undefined',
				processingTime: `${totalTime}ms`,
			});

			return {
				success: false,
				query: args.query || 'undefined',
				results: [],
				metadata: {
					totalResults: 0,
					searchTime: totalTime,
					embeddingTime: 0,
					maxSimilarity: 0,
					minSimilarity: 0,
					averageSimilarity: 0,
					knowledgeResults: 0,
					reflectionResults: 0,
					searchMode: 'knowledge',
					usedFallback: true,
				},
				timestamp: new Date().toISOString(),
			};
		}
	},
};
