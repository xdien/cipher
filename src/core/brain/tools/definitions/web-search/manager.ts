import { createLogger, Logger } from "../../../../logger/index.js";
import { LOG_PREFIXES } from "./constants.js";
import { WebSearchConfig, WebSearchConfigSchema } from "./config.js";
import { BaseProvider } from "./engine/base.js";
import { createWebSearchProvider } from "./factory.js";
import { SearchOptions, SearchResponse, SearchResult, InternalSearchResult } from "./types.js";

export class WebSearchManager {
    private config: WebSearchConfig;
    private connected = false;
    private provider: BaseProvider | null = null;
    private readonly logger: Logger;
    private webSearchData = {
        type: 'unknown',
        isFallback: false,
        connectionTime: 0,
    };
    private connectionAttempts = 0;

    private static duckduckgoModule?: any;

    constructor(config: WebSearchConfig){
    
        const configWithFallback = config as any;
        if (configWithFallback._fallbackFrom) {
            this.webSearchData.isFallback = true;
            // Remove the marker before validation
            delete configWithFallback._fallbackFrom;
        }

        const validationResult = WebSearchConfigSchema.safeParse(config);
        if (!validationResult.success) {
            throw new Error('Invalid web search configuration');
        }

        this.config = validationResult.data;

        this.logger = createLogger({
            level: process.env.LOG_LEVEL || 'info',
        });

        this.logger.debug(`${LOG_PREFIXES.MANAGER} Initialized with configuration`, {
        });

        // Set the webSearchData type based on the engine
        this.webSearchData.type = this.config.engine;
    }

    public async connect(): Promise<void> {
        if (this.connected && this.provider) {
            this.logger.debug(`${LOG_PREFIXES.MANAGER} Already connected`, {
                type: this.webSearchData.type,
            });
            return;
        }

        this.connectionAttempts++;
        this.logger.debug(`${LOG_PREFIXES.MANAGER} Starting connection attempt ${this.connectionAttempts} for ${this.config.engine}`, {
            type: this.webSearchData.type,
        });

        try {
            const provider = createWebSearchProvider(this.config.engine, this.config.config);
            if (!provider) {
                throw new Error(`Failed to create provider for engine: ${this.config.engine}`);
            }
            this.provider = provider;
            this.connected = true;
            this.webSearchData.connectionTime = Date.now();
            this.logger.debug(`${LOG_PREFIXES.MANAGER} Connected to ${this.config.engine}`, {
                type: this.webSearchData.type,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`${LOG_PREFIXES.MANAGER} Failed to connect to ${this.config.engine}`, {
                type: this.webSearchData.type,
                error: errorMessage,
            });
            throw error;
        }
    };

    public async disconnect(): Promise<void> {
        this.connected = false;
        this.provider = null;
        this.logger.debug(`${LOG_PREFIXES.MANAGER} Disconnected from ${this.config.engine}`);
    }

    /**
     * Perform a web search using the configured provider
     */
    public async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
        const startTime = Date.now();
        
        try {
            // Ensure we're connected
            await this.connect();
            
            if (!this.provider) {
                throw new Error('No web search provider available');
            }

            this.logger.debug(`${LOG_PREFIXES.MANAGER} Starting search`, {
                query,
                engine: this.config.engine,
                options
            });

            // Merge options with config defaults
            const searchOptions: SearchOptions = {
                maxResults: this.config.maxResults || 10,
                timeout: this.config.timeout || 10000,
                ...options
            };

            // Perform the search
            const internalResults: InternalSearchResult[] = await this.provider.search(query, searchOptions);
            
            // Transform internal results to public SearchResult format
            const results: SearchResult[] = internalResults.map(result => ({
                title: result.title,
                url: result.url,
                snippet: result.snippet,
                // domain: result.metadata?.domain || this.extractDomain(result.url),
                // ...(result.extractedContent.llmOptimized)
            }));

            const executionTime = Date.now() - startTime;

            this.logger.debug(`${LOG_PREFIXES.MANAGER} Search completed`, {
                query,
                resultsCount: results.length,
                executionTime,
                engine: this.config.engine
            });

            return {
                results,
                executedQuery: query,
                executionTime,
                success: true,
                provider: this.config.engine,
                metadata: {
                    totalAvailable: results.length,
                    page: 1,
                    perPage: searchOptions.maxResults || 10,
                    hasMore: false // This would need to be determined by the provider
                }
            };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            this.logger.error(`${LOG_PREFIXES.MANAGER} Search failed`, {
                query,
                error: errorMessage,
                executionTime,
                engine: this.config.engine
            });

            return {
                results: [],
                executedQuery: query,
                executionTime,
                success: false,
                error: errorMessage,
                provider: this.config.engine
            };
        }
    }

    /**
     * Get the current provider instance
     */
    public getProvider(): BaseProvider | null {
        return this.provider;
    }

    /**
     * Check if the manager is connected and ready
     */
    public isConnected(): boolean {
        return this.connected && this.provider !== null;
    }

    /**
     * Get the current configuration
     */
    public getConfig(): WebSearchConfig {
        return { ...this.config };
    }

    /**
     * Get connection statistics
     */
    public getStats() {
        return {
            connected: this.connected,
            connectionAttempts: this.connectionAttempts,
            connectionTime: this.webSearchData.connectionTime,
            isFallback: this.webSearchData.isFallback,
            type: this.webSearchData.type,
            provider: this.provider?.getStats() || null
        };
    }

    /**
     * Extract domain from URL
     */
    private extractDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return '';
        }
    }
}