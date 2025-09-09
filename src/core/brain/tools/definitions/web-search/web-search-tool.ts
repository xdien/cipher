import { z } from 'zod';
import { InternalTool } from '../../types.js';
import { WebSearchManager } from './manager.js';
import { getWebSearchConfigFromEnv } from './factory.js';
import { createLogger } from '../../../../logger/index.js';
import { SearchOptions } from './types.js';
import { WebSearchInput, SearchResult } from './config.js';

const logger = createLogger({ level: process.env.LOG_LEVEL || 'info' });

// Global web search manager instance
let webSearchManager: WebSearchManager | null = null;

/**
 * Initialize the web search manager if not already initialized
 */
async function initializeWebSearchManager(): Promise<WebSearchManager> {
    if (!webSearchManager) {
        try {
            const config = await getWebSearchConfigFromEnv();
            if (!config) {
                throw new Error('No web search configuration available');
            }
            webSearchManager = new WebSearchManager(config);
            await webSearchManager.connect();
            logger.debug('Web search manager initialized successfully');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to initialize web search manager', { error: errorMessage });
            throw new Error(`Web search initialization failed: ${errorMessage}`);
        }
    }
    return webSearchManager;
}

/**
 * Web search tool implementation
 */
export const webSearchTool: InternalTool = {
    name: 'web_search',
    category: 'system',
    internal: true,
    agentAccessible: true,
    description: 'Search the web for real-time information about any topic. Use this tool when you need up-to-date information that might not be available in memory, or when you need to verify current facts. The search results will include relevant snippets and URLs from web pages.',
    parameters: {
        type: 'object',
        properties: {
            search_term: {
                type: 'string',
                description: 'The search term to look up on the web. Be specific and include relevant keywords for better results. For technical queries, include version numbers or dates if relevant.'
            },
            max_results: {
                type: 'number',
                minimum: 1,
                maximum: 20,
                default: 10,
                description: 'Maximum number of search results to return (1-20)'
            },
            safe_mode: {
                type: 'boolean',
                default: true,
                description: 'Enable safe search mode to filter explicit content'
            }
        },
        required: ['search_term']
    },
    handler: async (input: WebSearchInput) => {
        try {
            logger.debug('Executing web search', { 
                searchTerm: input.search_term,
                maxResults: input.max_results 
            });

            // Initialize the web search manager
            const manager = await initializeWebSearchManager();

            // Prepare search options
            const searchOptions: SearchOptions = {
                maxResults: input.max_results || 3,
                ...(input.safe_mode !== undefined && { safeMode: input.safe_mode }),
            };

            // Perform the search
            const searchResponse = await manager.search(input.search_term, searchOptions);
            
            // Debug: Print keyFacts for each result
            console.log('🔑 KeyFacts Debug:');
            searchResponse.results.forEach((result, index) => {
                console.log(`Result ${index + 1}: ${result.title}`);
                if (result.extractedContent?.llmOptimized?.keyFacts) {
                    console.log(`  KeyFacts (${result.extractedContent.llmOptimized.keyFacts.length}):`, 
                        result.extractedContent.llmOptimized.keyFacts);
                    console.log(`  Summary:`, result.extractedContent.llmOptimized.summary);
                    console.log(`  Content Type:`, result.extractedContent.llmOptimized.contentType);
                    console.log(`  Relevance Score:`, result.extractedContent.llmOptimized.relevanceScore);
                } else {
                    console.log(`  No LLM optimized content found`);
                    console.log(`  Has extractedContent:`, !!result.extractedContent);
                    console.log(`  Has llmOptimized:`, !!result.extractedContent?.llmOptimized);
                }
                console.log('---');
            });
            
            if (!searchResponse.success) {
                return {
                    success: false,
                    error: searchResponse.error || 'Search failed for unknown reason',
                    results: [],
                    metadata: {
                        query: input.search_term,
                        provider: searchResponse.provider,
                        executionTime: searchResponse.executionTime
                    }
                };
            }

            // Format results for LLM consumption
            const outputs = searchResponse.results.map((result, index) => {
                const formattedResult: any = {
                    rank: index + 1,
                    title: result.title,
                    url: result.url,
                    snippet: result.snippet,
                    domain: result.domain,
                    keyFacts: Array.isArray(result.extractedContent?.llmOptimized?.keyFacts)
                        ? result.extractedContent.llmOptimized.keyFacts.join('\n')
                        : undefined,

                };

                return formattedResult;
            });
            
            return {
                success: true,
                results: outputs,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Web search tool execution failed', { 
                searchTerm: input.search_term,
                error: errorMessage 
            });

            return {
                success: false,
                error: `Web search failed: ${errorMessage}`,
                results: [],
                metadata: {
                    query: input.search_term,
                    provider: 'unknown',
                    executionTime: 0
                }
            };
        }
    }
};

/**
 * Get web search tools (for integration with the tools system)
 */
export function getWebSearchTools(): Record<string, InternalTool> {
    return {
        web_search: webSearchTool
    };
}

/**
 * Cleanup function to disconnect the web search manager
 */
export async function cleanupWebSearch(): Promise<void> {
    if (webSearchManager) {
        await webSearchManager.disconnect();
        webSearchManager = null;
        logger.debug('Web search manager cleaned up');
    }
} 