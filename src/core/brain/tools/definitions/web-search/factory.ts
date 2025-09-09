import { createLogger } from "../../../../logger/index.js";
import { env } from "../../../../env.js";
import { DuckDuckGoPuppeteerProvider } from "./engine/duckduckgo.js";
import { BaseProvider } from "./engine/base.js";
import { WebSearchConfig, WebSearchConfigSchema } from "./config.js";

const logger = createLogger({ level: env.CIPHER_LOG_LEVEL });

export function createWebSearchProvider(searchEngine: string, searchEngineConfig?: any): BaseProvider | null {
    if (searchEngine === 'duckduckgo') {
        return new DuckDuckGoPuppeteerProvider(searchEngineConfig);
    }
    logger.error('Unknown web search engine', { searchEngine });
    return null;
}

export function getDefaultWebSearchConfig(): WebSearchConfig  {
    return {
        engine: 'duckduckgo' as const,
        headless: true,
        maxResults: 10,
        timeout: 10000, 
        proxy: undefined,
        config: {
            timeout: 10000,
            maxRetries: 2,
            rateLimit: {
                requestsPerMinute: 10,
                burstLimit: 3,
            },
        }
    }
}

export async function getWebSearchConfigFromEnv(agentConfig?: any): Promise<WebSearchConfig | null> {

    let searchEngine = env.WEB_SEARCH_ENGINE ;
    let searchEngineConfig = agentConfig?.webSearch?.[searchEngine];


    if (!searchEngine || !searchEngineConfig) {
        logger.warn('No web search configuration found for engine', { searchEngine });
        logger.info('Using default web search configuration');  
        searchEngine = 'duckduckgo';
        searchEngineConfig = getDefaultWebSearchConfig().config;
    }

    if (searchEngine === 'duckduckgo') {
        return {
            engine: 'duckduckgo' as const,
            headless: true,
            maxResults: 3,
            timeout: 10000,
            proxy: undefined,
            config: searchEngineConfig || {},
        };
    }
    return null;
}

export async function createWebSearchProviderFromEnv(searchToolConfig?: any): Promise<BaseProvider | null> {
    
    const config = await getWebSearchConfigFromEnv(searchToolConfig);
    if (!config) {
        return null;
    }

    return createWebSearchProvider(config.engine, config.config);
}