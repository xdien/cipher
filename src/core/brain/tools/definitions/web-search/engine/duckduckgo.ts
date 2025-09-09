import { BaseProvider } from './base.js';
import { SearchResult, SearchOptions, ProviderConfig, ExtractedContent, InternalSearchResult } from '../types.js';
import puppeteer from 'puppeteer';

import {
  createInternalToolName,
  type InternalTool,
  type InternalToolHandler,
} from '../../../types.js';
import { logger } from '../../../../../logger/index.js';

// Define the DuckDuckGo search response interface
interface DuckDuckGoSearchResponse {
  success: boolean;
  results: SearchResult[];
  query: string;
  totalResults: number;
  executionTime: number;
  error?: string;
}


export class DuckDuckGoPuppeteerProvider extends BaseProvider {
  name = 'duckduckgo-puppeteer' as const;
  private browser: any = null;

  constructor(config?: Partial<ProviderConfig>) {
    super(config);
    // Apply configuration recommendations after initialization
    const recommendations = this.getConfigRecommendations();
    this.updateConfig({
      ...recommendations,
      ...config,
      headers: {
        ...recommendations.headers,
        ...config?.headers,
      },
    });
  }

  async search(query: string, opts: SearchOptions): Promise<InternalSearchResult[]> {
    let page: any = null;
    try {
      
      // Validate and sanitize query
      const sanitizedQuery = this.sanitizeQuery(query);
      if (!sanitizedQuery) {
        console.warn('DuckDuckGo Puppeteer: Empty or invalid query provided');
        return [];
      }

      // Launch browser if not already running
      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          ]
        });
      }

      page = await this.browser.newPage();
      
      // Set viewport and user agent to mimic real browser
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      // Build search URL
      const url = this.buildUrl(sanitizedQuery, opts);

      // Navigate to search page
      await page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });

      // Wait for search results to load
      try {
        // Wait for the main results container
        await page.waitForSelector('[data-testid="mainline"], .results--main', { 
          timeout: 15000 
        });
        
        // Wait a bit more for results to populate
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Wait for actual web result links (not DuckDuckGo internal links)
        await page.waitForFunction(() => {
          const externalLinks = Array.from(document.querySelectorAll('a[href^="http"]')).filter(link => {
            const href = link.getAttribute('href') || '';
            const title = link.textContent?.trim() || '';
            return !href.includes('duckduckgo.com') && 
                   !href.includes('site%3A') && 
                   !title.includes('Only include results for this site') &&
                   !title.includes('More Images') &&
                   !title.includes('News for') &&
                   !title.includes('Images for') &&
                   title.length > 10;
          });
          return externalLinks.length >= 3; // Wait for at least 3 actual web results
        }, { timeout: 15000 });
        
      } catch (e) {
        // Try waiting for any content that might contain results
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-puppeteer.png', fullPage: true });

      // Get page content for debugging
      const pageContent = await page.content();
      // Extract results using Puppeteer's page evaluation
      console.log("DEBUG 1")
      const evaluationResult = await page.evaluate((maxResults: number) => {
        const debugInfo: any = {
          title: document.title,
          url: window.location.href,
          hasAnomaly: false,
          selectorResults: {},
          totalLinks: 0,
          totalArticles: 0
        };
        
        // Check if we're seeing a CAPTCHA or anomaly modal
        const anomalyModal = document.querySelector('.anomaly-modal__title');
        if (anomalyModal) {
          console.log('DuckDuckGo Puppeteer: CAPTCHA/Anomaly detected:', anomalyModal.textContent);
          debugInfo.hasAnomaly = true;
          debugInfo.anomalyText = anomalyModal.textContent;
          return { results: [], debug: debugInfo };
        }

        // Try multiple selectors for modern DuckDuckGo
        const possibleSelectors = [
          '[data-testid="mainline"] article[data-testid="result"]', // Results in main area
          '[data-testid="mainline"] article', // Any articles in main area
          '.results--main article[data-testid="result"]',
          '.results--main article',
          'article[data-testid="result"]',
          'div[data-testid="result"]', 
          'li[data-layout="organic"]',
          'ol.react-results--main > li',
          '[data-testid="web-vertical"] > ol > li'
        ];
        let resultElements: Element[] = [];
        
        console.log("Going to test possible selectors:");
        for (const selector of possibleSelectors) {
          resultElements = Array.from(document.querySelectorAll(selector));
          
          if (resultElements.length > 0) {
            // Log some details about found elements
            
            // Check if these are site suggestions by looking at the links
            const firstLink = resultElements[0]?.querySelector('a[href]');
            const firstHref = firstLink?.getAttribute('href') || '';
            if (firstHref.includes('site%3A') || firstHref.startsWith('?q=')) {
              continue; // Keep looking for actual web results
            }
            break;
          }
        }
        
        // Since structured selectors often only find site suggestions, 
        // let's prioritize external links as the primary source
        const externalLinks = Array.from(document.querySelectorAll('a[href^="http"]')).filter(link => {
          const href = link.getAttribute('href') || '';
          const title = link.textContent?.trim() || '';
          return !href.includes('duckduckgo.com') && 
                 !href.includes('site%3A') && 
                 !title.includes('Only include results for this site') &&
                 !title.includes('More Images') &&
                 !title.includes('News for') &&
                 !title.includes('Images for') &&
                 !title.includes('More at') &&
                 !title.includes('All News') &&
                 !title.includes('All Images') &&
                 !title.startsWith('›') && // Skip breadcrumb navigation
                 title.length > 10; // Ensure it's a meaningful title
        });
        
        
        // Use external links as primary source if we have them
        if (externalLinks.length > 0) {
          resultElements = externalLinks.slice(0, 10);
        } else if (resultElements.length > 0) {
          // Fallback to structured elements if no external links found
          const firstLink = resultElements[0]?.querySelector('a[href]');
          const firstHref = firstLink?.getAttribute('href') || '';
          if (firstHref.includes('site%3A') || firstHref.startsWith('?q=')) {
            console.log(`DuckDuckGo Puppeteer: No good external links, keeping structured results for debugging`);
          }
        }

        // Collect debug information
        debugInfo.totalLinks = document.querySelectorAll('a[href]').length;
        debugInfo.totalArticles = document.querySelectorAll('article').length;
        
        // If no results found or only site suggestions, try external links as final fallback
        if (resultElements.length === 0) {
          const externalLinks = Array.from(document.querySelectorAll('a[href^="http"]')).filter(link => {
            const href = link.getAttribute('href') || '';
            const title = link.textContent?.trim() || '';
            return !href.includes('duckduckgo.com') && 
                   !href.includes('site%3A') && 
                   !title.includes('Only include results for this site') &&
                   !title.includes('More Images') &&
                   !title.includes('News for') &&
                   !title.includes('Images for') &&
                   !title.includes('More at') &&
                   !title.includes('All News') &&
                   !title.includes('All Images') &&
                   !title.startsWith('›') && // Skip breadcrumb navigation
                   title.length > 10; // Ensure it's a meaningful title
          });
          
          resultElements = externalLinks.slice(0, 10);
                 }
 
         const results: any[] = [];
         console.log('DuckDuckGo: Result elements:', resultElements);
        resultElements.slice(0, maxResults || 10).forEach((element, index) => {
          try {
            // Find title and URL - handle both article elements and direct link elements
            let titleElement;
            let href = '';
            let title = '';
            
            if (element.tagName.toLowerCase() === 'a') {
              // Element is a direct link
              titleElement = element as HTMLAnchorElement;
              href = titleElement.getAttribute('href') || '';
              title = titleElement.textContent?.trim() || '';
            } else {
              // Element is a container, find link inside
              titleElement = element.querySelector('h3 a, h2 a, [data-testid="result-title-a"], a[href]');
              if (!titleElement) {
                titleElement = element.querySelector('a[href^="http"]');
              }
              title = titleElement?.textContent?.trim() || '';
              href = titleElement?.getAttribute('href') || '';
            }

            // Find snippet/description
            let snippet = '';
            const snippetSelectors = [
              '[data-testid="result-snippet"]',
              '.result__snippet',
              '.result-snippet',
              '.snippet'
            ];

            for (const snippetSelector of snippetSelectors) {
              const snippetElement = element.querySelector(snippetSelector);
              if (snippetElement) {
                snippet = snippetElement.textContent?.trim() || '';
                break;
              }
            }

            // Fallback to general text content for snippet
            if (!snippet) {
              snippet = element.textContent?.replace(title, '').trim().slice(0, 200) || '';
            }
// FUCK
            // Filter out site suggestions and non-web results
            const isSiteSuggestion = href.includes('site%3A') || href.startsWith('?q=') || title.includes('Only include results for this site');
            const isValidWebResult = title && href && href.startsWith('http') && !isSiteSuggestion;
            console.log('DuckDuckGo: isValidWebResult:', isValidWebResult);
            if (isValidWebResult) {
              // Push to result array, this is the final result that will be returned to the user
              results.push({
                provider: 'duckduckgo',
                rankOnPage: results.length + 1, 
                url: href,
                title: title,
                snippet: snippet,
                domain: new URL(href).hostname,
                llmOptimized: {
                  keyFacts: [],
                  summary: snippet || title,
                  relevanceScore: 0.5, // Default score, will be updated if content is fetched
                  contentType: 'other' as const
                }
              });

            // console.log('DuckDuckGo: Result:',results);
            } else {
              console.log(`DuckDuckGo Puppeteer: Skipping non-web result: "${title}" - "${href}"`);
            }
          } catch (error) {
            console.warn('DuckDuckGo Puppeteer: Error extracting result:', error);
          }
        });
        return { results, debug: debugInfo };
      // }, Number(opts.maxResults) || 10);
      }, 1);
        console.log("DEBUG 4");
        console.log(evaluationResult.results, evaluationResult.results.length)
        // Optionally fetch HTML content for each result if requested
        if (evaluationResult.results.length > 0) {
          await this.fetchResultContent(evaluationResult.results, page, query);
        }

      return evaluationResult.results;

    } catch (error) {
      console.error('DuckDuckGo Puppeteer search error:', error);
      return [];
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private buildUrl(query: string, opts: SearchOptions): string {
    const params = new URLSearchParams({
      q: query,
      kl: opts.country ?? '',
      safe: opts.safeMode ? 'strict' : 'moderate',
      ia: 'web'
    });
    
    // Use the regular DuckDuckGo search endpoint
    return `https://duckduckgo.com/?${params.toString()}`;
  }

  private sanitizeQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }
    return query.trim().slice(0, 500);
  }

  /**
   * Fetch HTML content for each search result
   */
  private async fetchResultContent(results: any[], page: any, query: string = ''): Promise<void> {
    console.log("DEBUG 5");
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) {
        logger.warn(`DuckDuckGo Puppeteer: No URL found for result ${i + 1}`);
        continue;
      }
      try {
        logger.debug(`DuckDuckGo Puppeteer: Fetching content for ${i + 1}/${results.length}: ${result.url}`);
        
        // Navigate to the result URL
        await page.goto(result.url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
        
        // Wait a bit for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
                
        // Extract structured content if requested
        const extractedContent = await this.extractContentFromPage(page);
        // Generate LLM-optimized content
        if (extractedContent && query) {
          const llmOptimizedContent = this.generateLLMOptimizedContent(extractedContent, query);
          if (llmOptimizedContent) {
            // Update the llmOptimized field in the result to match InternalSearchResult interface
            result.llmOptimized = llmOptimizedContent;
          }
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`DuckDuckGo Puppeteer: Failed to fetch content for ${result.url}:`, errorMessage);
      }
    }
  }

  /**
   * Extract structured content from the current page
   */
  private async extractContentFromPage(page: any): Promise<ExtractedContent> {
    return await page.evaluate(() => {
      const extractedContent: ExtractedContent = {};

      // Extract page title
      extractedContent.pageTitle = document.title;

      // Extract meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        extractedContent.metaDescription = metaDescription.getAttribute('content') || '';
      }

      // Extract headings
      const headings: Array<{ level: number; text: string }> = [];
      for (let i = 1; i <= 6; i++) {
        const headerElements = document.querySelectorAll(`h${i}`);
        headerElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text) {
            headings.push({ level: i, text });
          }
        });
      }
      extractedContent.headings = headings;

      // Extract paragraphs
      const paragraphs: string[] = [];
      const paragraphElements = document.querySelectorAll('p');
      paragraphElements.forEach(p => {
        const text = p.textContent?.trim();
        if (text && text.length > 20) { // Skip very short paragraphs
          paragraphs.push(text);
        }
      });
      extractedContent.paragraphs = paragraphs;

      // Extract main content text (try common content selectors)
      const contentSelectors = [
        'article',
        'main',
        '.content',
        '#content',
        '.post-content',
        '.entry-content',
        '[role="main"]'
      ];
      
      let mainText = '';
      for (const selector of contentSelectors) {
        const contentEl = document.querySelector(selector);
        if (contentEl) {
          mainText = contentEl.textContent?.trim() || '';
          if (mainText.length > 100) break; // Found good content
        }
      }
      
      // Fallback to body if no main content found
      if (!mainText || mainText.length < 100) {
        mainText = document.body.textContent?.trim() || '';
      }
      
      extractedContent.mainText = mainText;
      extractedContent.wordCount = mainText.split(/\s+/).length;

      // Extract text from lists
      const listTexts: string[] = [];
      
      // Get text from unordered lists
      const ulElements = document.querySelectorAll('ul');
      ulElements.forEach(ul => {
        const items: string[] = [];
        const liElements = ul.querySelectorAll('li');
        liElements.forEach(li => {
          const text = li.textContent?.trim();
          if (text && text.length > 5) items.push(text);
        });
        if (items.length > 0) {
          listTexts.push(items.join(' • '));
        }
      });

      // Get text from ordered lists
      const olElements = document.querySelectorAll('ol');
      olElements.forEach(ol => {
        const items: string[] = [];
        const liElements = ol.querySelectorAll('li');
        liElements.forEach((li, index) => {
          const text = li.textContent?.trim();
          if (text && text.length > 5) items.push(`${index + 1}. ${text}`);
        });
        if (items.length > 0) {
          listTexts.push(items.join(' '));
        }
      });
      
      extractedContent.listText = listTexts.slice(0, 10); // Limit to first 10 lists

      // Extract text from tables and convert to readable format
      const tableTexts: string[] = [];
      const tableElements = document.querySelectorAll('table');
      tableElements.forEach(table => {
        const headers: string[] = [];
        const rows: string[][] = [];

        // Extract headers
        const headerElements = table.querySelectorAll('th');
        headerElements.forEach(th => {
          const text = th.textContent?.trim();
          if (text) headers.push(text);
        });

        // Extract rows
        const rowElements = table.querySelectorAll('tr');
        rowElements.forEach(tr => {
          const cells: string[] = [];
          const cellElements = tr.querySelectorAll('td');
          cellElements.forEach(td => {
            const text = td.textContent?.trim();
            if (text) cells.push(text);
          });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

        // Convert table to readable text format
        if (headers.length > 0 || rows.length > 0) {
          let tableText = '';
          if (headers.length > 0) {
            tableText += `Headers: ${headers.join(' | ')}. `;
          }
          if (rows.length > 0) {
            const rowTexts = rows.map(row => row.join(' | ')).slice(0, 5); // Limit to first 5 rows
            tableText += `Data: ${rowTexts.join('. ')}`;
          }
          if (tableText.length > 10) {
            tableTexts.push(tableText);
          }
        }
      });
      
      extractedContent.tableText = tableTexts.slice(0, 5); // Limit to first 5 tables

      return extractedContent;
    });
  }

  /**
   * Generate LLM-optimized content from extracted content
   */
  private generateLLMOptimizedContent(extractedContent: ExtractedContent, query: string): ExtractedContent['llmOptimized'] {
    if (!extractedContent.mainText) return undefined;

    // Extract key facts
    const keyFacts = this.extractKeyFacts(extractedContent);
    
    // Generate summary
    const summary = this.generateContentSummary(extractedContent, query);
    
    // Calculate relevance score
    const relevanceScore = this.calculateRelevanceScore(extractedContent, query);
    
    // Classify content type
    const contentType = this.classifyContentType(extractedContent);

    return {
      keyFacts,
      summary,
      relevanceScore,
      contentType
    };
  }

  /**
   * Extract key facts from content
   */
  private extractKeyFacts(content: ExtractedContent): string[] {
    const facts: string[] = [];
    
    // Extract from paragraphs - look for factual statements
    if (content.paragraphs) {
      content.paragraphs.forEach(para => {
        // Look for sentences with numbers, specific values, or definitive statements
        if (para.match(/\d+|port|version|API|endpoint|default|required|must|should/i) && para.length < 300) {
          facts.push(para.trim());
        }
      });
    }
    
    // Extract from table data - these are often key facts
    if (content.tableText) {
      content.tableText.forEach(table => {
        if (table.length < 500) {
          facts.push(table);
        }
      });
    }
    
    return facts.slice(0, 8); // Limit to most important facts
  }

  /**
   * Extract actionable instructions from content
   */
  private extractInstructions(content: ExtractedContent): string[] {
    const instructions: string[] = [];
    
    // Look for instruction-like paragraphs
    if (content.paragraphs) {
      content.paragraphs.forEach(para => {
        if (para.match(/^(To|You can|First|Next|Then|Finally|Step|Install|Run|Execute|Configure|Set|Create|Add|Remove)/i)) {
          instructions.push(para.trim());
        }
      });
    }
    
    // Extract from ordered lists - these are often instructions
    if (content.listText) {
      content.listText.forEach(list => {
        if (list.match(/^\d+\./)) {
          instructions.push(list);
        }
      });
    }
    
    return instructions.slice(0, 10); // Limit to key instructions
  }

  /**
   * Extract technical details like APIs, configurations, parameters
   */
  private extractTechnicalDetails(content: ExtractedContent): Record<string, string> {
    const details: Record<string, string> = {};
    
    // Extract from paragraphs
    if (content.paragraphs) {
      content.paragraphs.forEach(para => {
        // Look for API endpoints
        const apiMatch = para.match(/(?:API|endpoint|URL):\s*([^\s]+)/i);
        if (apiMatch && apiMatch[1]) {
          details['API Endpoint'] = apiMatch[1];
        }
        
        // Look for ports
        const portMatch = para.match(/port\s+(\d+)/i);
        if (portMatch && portMatch[1]) {
          details['Port'] = portMatch[1];
        }
        
        // Look for versions
        const versionMatch = para.match(/version\s+([^\s,]+)/i);
        if (versionMatch && versionMatch[1]) {
          details['Version'] = versionMatch[1];
        }
        
        // Look for authentication
        if (para.toLowerCase().includes('authentication') || para.toLowerCase().includes('auth')) {
          details['Authentication'] = para.substring(0, 200) + (para.length > 200 ? '...' : '');
        }
      });
    }
    
    return details;
  }

  /**
   * Generate a concise summary optimized for LLM understanding
   */
  private generateContentSummary(content: ExtractedContent, query: string): string {
    const summaryParts: string[] = [];
    
    if (content.pageTitle) {
      summaryParts.push(`Topic: ${content.pageTitle}`);
    }
    
    if (content.metaDescription) {
      summaryParts.push(content.metaDescription);
    }
    
    // Add most relevant paragraphs
    if (content.paragraphs) {
      const queryWords = query.toLowerCase().split(/\s+/);
      const relevantParagraphs = content.paragraphs
        .filter(para => {
          const paraLower = para.toLowerCase();
          return queryWords.some(word => paraLower.includes(word));
        })
        .slice(0, 2);
      
      if (relevantParagraphs.length > 0) {
        summaryParts.push(...relevantParagraphs);
      } else if (content.paragraphs.length > 0 && content.paragraphs[0]) {
        summaryParts.push(content.paragraphs[0]);
      }
    }
    
    return summaryParts.join(' ').substring(0, 800);
  }

  /**
   * Calculate relevance score based on query match
   */
  private calculateRelevanceScore(content: ExtractedContent, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const contentText = (content.mainText || '').toLowerCase();
    
    if (queryWords.length === 0 || !contentText) return 0;
    
    let matches = 0;
    let totalWords = queryWords.length;
    
    queryWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      const wordMatches = (contentText.match(regex) || []).length;
      if (wordMatches > 0) {
        matches += Math.min(wordMatches / 10, 1); // Cap influence of repeated words
      }
    });
    
    return parseFloat((Math.min(matches / totalWords, 1)).toFixed(2));
  }

  /**
   * Classify content type for better LLM understanding
   */
  private classifyContentType(content: ExtractedContent): 'documentation' | 'tutorial' | 'article' | 'reference' | 'forum' | 'news' | 'other' {
    const text = (content.mainText || '').toLowerCase();
    const title = (content.pageTitle || '').toLowerCase();
    
    if (title.includes('docs') || title.includes('documentation') || text.includes('api reference')) {
      return 'documentation';
    }
    
    if (title.includes('tutorial') || title.includes('guide') || text.includes('step by step')) {
      return 'tutorial';
    }
    
    if (title.includes('forum') || title.includes('discussion') || text.includes('asked') || text.includes('answered')) {
      return 'forum';
    }
    
    if (title.includes('news') || text.includes('published') || text.includes('breaking')) {
      return 'news';
    }
    
    if (text.includes('reference') || text.includes('specification')) {
      return 'reference';
    }
    
    if (text.includes('how to') || text.includes('tutorial')) {
      return 'tutorial';
    }
    
    return 'article';
  }

  /**
   * Clean up browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get provider-specific configuration recommendations
   */
  public getConfigRecommendations(): Partial<ProviderConfig> {
    return {
      timeout: 30000, // Longer timeout for browser operations
      maxRetries: 2,
      rateLimit: {
        requestsPerMinute: 10, // More conservative for browser-based scraping
        burstLimit: 3,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    };
  }
} 