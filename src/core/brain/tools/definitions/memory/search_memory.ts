import { InternalTool, InternalToolContext } from '../../types.js';
import { logger } from '../../../../logger/index.js';
import { env } from '../../../../env.js';

/**
 * Memory Search Tool Result Interface
 */
interface MemorySearchResult {
  success: boolean;
  query: string;
  results: {
    id: string;
    text: string;
    tags: string[];
    confidence: number;
    reasoning: string;
    timestamp: string;
    similarity: number;
    code_pattern?: string;
    event?: string;
  }[];
  metadata: {
    totalResults: number;
    searchTime: number;
    embeddingTime: number;
    maxSimilarity: number;
    minSimilarity: number;
    averageSimilarity: number;
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
  description: 'Perform semantic search over stored memory entries to retrieve relevant knowledge and reasoning traces that can inform current decision-making.',
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant memories. Use natural language to describe what you are looking for.',
        minLength: 1,
        maxLength: 1000
      },
      top_k: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
        minimum: 1,
        maximum: 50,
        default: 5
      },
      type: {
        type: 'string',
        description: 'Type of memory to search. Defaults to environment variable SEARCH_MEMORY_TYPE (currently only "knowledge" is fully implemented).',
        enum: ['knowledge', 'reflection', 'both'],
        default: env.SEARCH_MEMORY_TYPE
      },
      similarity_threshold: {
        type: 'number',
        description: 'Minimum similarity score for results (0.0 to 1.0, default: 0.3)',
        minimum: 0.0,
        maximum: 1.0,
        default: 0.3
      },
      include_metadata: {
        type: 'boolean',
        description: 'Whether to include detailed metadata in results (default: true)',
        default: true
      }
    },
    required: ['query'],
    additionalProperties: false
  },
  handler: async (args: any, context?: InternalToolContext): Promise<MemorySearchResult> => {
    const startTime = Date.now();
    
    try {
      logger.info('MemorySearch: Processing search request', {
        query: args.query?.substring(0, 100) || 'undefined',
        top_k: args.top_k || 5,
        type: args.type || env.SEARCH_MEMORY_TYPE,
        similarity_threshold: args.similarity_threshold || 0.3
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

      // Validate memory type
      if (memoryType === 'reflection' || memoryType === 'both') {
        logger.warn('MemorySearch: Reflection memory not yet implemented, searching knowledge only', {
          requestedType: memoryType,
          envDefault: env.SEARCH_MEMORY_TYPE,
          fallbackTo: 'knowledge'
        });
      }

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
      const vectorStore = vectorStoreManager.getStore();

      if (!embedder || !vectorStore) {
        throw new Error('Embedder and VectorStore must be initialized and available');
      }

      if (!embedder.embed || typeof embedder.embed !== 'function') {
        throw new Error('Embedder is not properly initialized or missing embed() method');
      }

      // Generate embedding for the search query
      const embeddingStartTime = Date.now();
      logger.debug('MemorySearch: Generating embedding for query', {
        queryLength: query.length,
        queryPreview: query.substring(0, 50)
      });

      const queryEmbedding = await embedder.embed(query);
      const embeddingTime = Date.now() - embeddingStartTime;

      logger.debug('MemorySearch: Embedding generated successfully', {
        embeddingTime: `${embeddingTime}ms`,
        embeddingDimensions: Array.isArray(queryEmbedding) ? queryEmbedding.length : 'unknown'
      });

      // Perform vector similarity search
      const searchStartTime = Date.now();
      const rawResults = await vectorStore.search(queryEmbedding, topK * 2); // Search for more to filter
      const searchTime = Date.now() - searchStartTime;

      logger.debug('MemorySearch: Vector search completed', {
        searchTime: `${searchTime}ms`,
        rawResultCount: rawResults.length,
        topK: topK
      });

      // Filter results by similarity threshold and process
      const filteredResults = rawResults
        .filter(result => (result.score || 0) >= similarityThreshold)
        .slice(0, topK) // Limit to requested number of results
        .map(result => {
          const payload = result.payload || {};
          
          return {
            id: result.id || payload.id || 'unknown',
            text: payload.text || payload.data || 'No content available',
            tags: payload.tags || [],
            confidence: payload.confidence || 0,
            reasoning: payload.reasoning || 'No reasoning available',
            timestamp: payload.timestamp || new Date().toISOString(),
            similarity: result.score || 0,
            ...(payload.code_pattern && { code_pattern: payload.code_pattern }),
            ...(payload.event && { event: payload.event })
          };
        });

      // Calculate statistics
      const similarities = filteredResults.map(r => r.similarity);
      const totalResults = filteredResults.length;
      const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;
      const minSimilarity = similarities.length > 0 ? Math.min(...similarities) : 0;
      const averageSimilarity = similarities.length > 0 ? 
        similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length : 0;

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
          averageSimilarity
        },
        timestamp: new Date().toISOString()
      };

      logger.info('MemorySearch: Search completed successfully', {
        query: query.substring(0, 50),
        resultsFound: totalResults,
        maxSimilarity: maxSimilarity.toFixed(3),
        averageSimilarity: averageSimilarity.toFixed(3),
        totalTime: `${totalTime}ms`
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const totalTime = Date.now() - startTime;
      
      logger.error('MemorySearch: Search failed', {
        error: errorMessage,
        query: args.query?.substring(0, 50) || 'undefined',
        processingTime: `${totalTime}ms`
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
          averageSimilarity: 0
        },
        timestamp: new Date().toISOString()
      };
    }
  }
}; 