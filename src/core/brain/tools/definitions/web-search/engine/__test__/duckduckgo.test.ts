// import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// import { DuckDuckGoHtmlProvider } from '../duckduckgo.js';
// import { SearchOptions, RawResult } from '../../types.js';

// // Mock cheerio - create chainable jQuery-like elements without circular references
// const createMockElement = (text = '', attr = '', length = 1) => {
//   const element = {
//     find: vi.fn(),
//     first: vi.fn(),
//     each: vi.fn(),
//     text: vi.fn().mockReturnValue(text),
//     attr: vi.fn().mockReturnValue(attr),
//     length
//   };
  
//   // Set up the chaining behavior after element is created
//   element.find.mockReturnValue(element);
//   element.first.mockReturnValue(element);
  
//   return element;
// };

// // Create the main mock element for cheerio function calls
// const mockCheerioElement = createMockElement();

// // Create a proper cheerio $ function mock
// const mockCheerioFunction = vi.fn((selector: string | any) => {
//   // When called with an element (like $(el)), return a jQuery-like object
//   if (typeof selector !== 'string') {
//     return createMockElement();
//   }
//   // When called with a selector string (like $('div.result')), return the main element
//   return mockCheerioElement;
// });

// // Add properties that cheerio $ function should have
// Object.assign(mockCheerioFunction, {
//   find: vi.fn(() => mockCheerioElement),
//   each: vi.fn(),
//   text: vi.fn(),
//   attr: vi.fn(),
//   length: 1
// });

// vi.mock('cheerio', () => ({
//   load: vi.fn(() => mockCheerioFunction)
// }));

// // Mock node:url
// vi.mock('node:url', () => ({
//   URLSearchParams: class MockURLSearchParams {
//     private params: Record<string, string>;
    
//     constructor(params: Record<string, string>) {
//       this.params = params;
//     }
    
//     toString() {
//       const pairs = Object.entries(this.params).map(([key, value]) => 
//         value ? `${key}=${encodeURIComponent(String(value))}` : ''
//       ).filter(Boolean);
//       return pairs.join('&');
//     }
//   }
// }));

// describe('DuckDuckGoHtmlProvider', () => {
//   let provider: DuckDuckGoHtmlProvider;
//   let mockFetch: ReturnType<typeof vi.fn>;

//   beforeEach(() => {
//     // Reset all mocks
//     vi.clearAllMocks();
    
//     // Create provider instance
//     provider = new DuckDuckGoHtmlProvider();
    
//     // Mock fetch globally
//     mockFetch = vi.fn();
//     global.fetch = mockFetch;
    
//     // Reset the cheerio mock functions with default behavior
//     mockCheerioElement.find.mockReturnValue(mockCheerioElement);
//     mockCheerioElement.each.mockImplementation(() => {});
//     mockCheerioElement.text.mockReturnValue('');
//     mockCheerioElement.attr.mockReturnValue('');
    
//     // Reset the function to return default elements
//     mockCheerioFunction.mockImplementation((selector: string | any) => {
//       if (typeof selector !== 'string') {
//         // When called with $(el), return an element that can find title links
//         return createMockElement('', '', 0);
//       }
//       // When called with $('div.result'), return the main element for .each()
//       return mockCheerioElement;
//     });
//   });

//   afterEach(() => {
//     vi.restoreAllMocks();
//   });

//   describe('Constructor and Basic Properties', () => {
//     it('should initialize with correct name', () => {
//       expect(provider.name).toBe('duckduckgo-html');
//     });

//     it('should be ready when enabled', () => {
//       expect(provider.isReady()).toBe(true);
//     });

//     it('should validate config correctly', () => {
//       expect(provider.validateConfig()).toBe(true);
//     });

//     it('should fail validation when disabled', () => {
//       provider.updateConfig({ enabled: false });
//       expect(provider.validateConfig()).toBe(false);
//     });

//     it('should fail validation with short user agent', () => {
//       provider.updateConfig({ 
//         headers: { 'User-Agent': 'short' }
//       });
//       expect(provider.validateConfig()).toBe(false);
//     });
//   });

//   describe('URL Building', () => {
//     it('should build basic search URL', async () => {
//       const query = 'test query';
//       const options: SearchOptions = {};
      
//       // Mock successful fetch
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       // Mock empty results
//       mockCheerioElement.each.mockImplementation((callback: any) => {
//         // No results
//       });

//       await provider.search(query, options);
//       expect(mockFetch).toHaveBeenCalledWith(
//         expect.stringContaining('https://duckduckgo.com/html?q=test%20query'),
//         expect.any(Object)
//       );
//     });

//     it('should include search options in URL', async () => {
//       const query = 'test';
//       const options: SearchOptions = {
//         country: 'us',
//         safeMode: true
//       };

//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       mockCheerioElement.each.mockImplementation((callback: any) => {});

//       await provider.search(query, options);

//       const fetchCall = mockFetch.mock.calls[0];
//       const url = fetchCall[0];
      
//       expect(url).toContain('q=test');
//       expect(url).toContain('kl=us');
//       expect(url).toContain('kd=1');
//       expect(url).toContain('safe=strict');
//       expect(url).toContain('ia=web');
//     });
//   });

//   describe('Query Sanitization', () => {
//     it('should handle empty queries', async () => {
//       const result = await provider.search('', {});
//       expect(result).toEqual([]);
//     });

//     it('should handle null/undefined queries', async () => {
//       const result1 = await provider.search(null as any, {});
//       const result2 = await provider.search(undefined as any, {});
//       expect(result1).toEqual([]);
//       expect(result2).toEqual([]);
//     });

//     it('should sanitize whitespace in queries', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       mockCheerioElement.each.mockImplementation((callback: any) => {});

//       await provider.search('  multiple   spaces  ', {});

//       const fetchCall = mockFetch.mock.calls[0];
//       const url = fetchCall[0];
//       expect(url).toContain('multiple%20spaces');
//     });

//     it('should limit query length', async () => {
//       const longQuery = 'a'.repeat(600);
      
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       mockCheerioElement.each.mockImplementation((callback: any) => {});

//       await provider.search(longQuery, {});

//       const fetchCall = mockFetch.mock.calls[0];
//       const url = fetchCall[0];
//       // Should be truncated to 500 characters
//       expect(url.length).toBeLessThan(600);
//     });
//   });

//   describe('HTML Parsing', () => {
//     it('should parse search results correctly', async () => {
//       const mockHtml = '<html><body></body></html>';
      
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve(mockHtml)
//       });

//       // Mock the cheerio function to return proper elements with data
//       mockCheerioFunction.mockImplementation((selector: string | any) => {
//         if (typeof selector !== 'string') {
//           // When called with $(el), return an element that can find title links
//           return createMockElement('Test Title', 'https://example.com', 1);
//         }
//         // When called with $('div.result'), return the main element for .each()
//         return mockCheerioElement;
//       });

//       // Mock the each implementation to simulate finding one result
//       mockCheerioElement.each.mockImplementation((callback: any) => {
//         // Call the callback with a mock element
//         callback(0, {});
//       });

//       const results = await provider.search('test', {});
//       expect(results).toHaveLength(1);
//       expect(results[0]).toMatchObject({
//         provider: 'duckduckgo-html',
//         rankOnPage: 1,
//         url: 'https://example.com/',
//         title: 'Test Title'
//       });
//     });

//     it('should handle malformed HTML gracefully', async () => {
//       const malformedHtml = '<html><body><div class="result">';
      
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve(malformedHtml)
//       });

//       mockCheerioElement.each.mockImplementation((callback: any) => {
//         // Simulate parsing error
//         throw new Error('Parsing error');
//       });

//       const results = await provider.search('test', {});
//       expect(results).toEqual([]);
//     });

//          it('should try alternative selectors when main selector fails', async () => {
//        mockFetch.mockResolvedValue({
//          ok: true,
//          headers: { get: () => 'text/html' },
//          text: () => Promise.resolve('<html></html>')
//        });

//        // Mock the cheerio function to simulate alternative selector behavior
//        let selectorCallCount = 0;
//        mockCheerioFunction.mockImplementation((selector: string | any) => {
//          if (typeof selector === 'string') {
//            if (selector === 'div.result') {
//              // First selector returns empty results
//              return createMockElement('', '', 0);
//            } else if (selector === 'div.web-result') {
//              // Second selector has results
//              const element = createMockElement();
//              element.each.mockImplementation((callback: any) => {
//                callback(0, {});
//              });
//              return element;
//            }
//          } else {
//            // When called with $(el), return element with alternative data
//            return createMockElement('Alternative Title', 'https://alt-example.com/', 1);
//          }
//          return mockCheerioElement;
//        });

//        const results = await provider.search('test', {});
//        expect(results).toHaveLength(1);
//        expect(results[0].title).toBe('Alternative Title');
//        expect(results[0].url).toBe('https://alt-example.com/');
//      });
//   });

//   describe('Result Validation and Filtering', () => {
//     it('should filter out invalid results', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       const mockResults = [
//         { title: '', url: 'https://example.com' }, // Empty title
//         { title: 'Valid', url: '' }, // Empty URL
//         { title: 'Short', url: 'invalid-url' }, // Invalid URL
//         { title: 'DuckDuckGo Internal', url: 'https://duckduckgo.com/internal' }, // DuckDuckGo URL
//         { title: 'Valid Result', url: 'https://example.com' } // Valid
//       ];

//              // Mock the cheerio function with result-specific behavior
//        let currentResultIndex = 0;
//        mockCheerioFunction.mockImplementation((selector: string | any) => {
//          if (typeof selector === 'string') {
//            // Return element that will iterate over results
//            currentResultIndex = 0; // Reset for each new search
//            const element = createMockElement();
//            element.each.mockImplementation((callback: any) => {
//              mockResults.forEach((result, index) => {
//                currentResultIndex = index; // Set current index before callback
//                callback(index, { resultData: result }); // Pass result data in element
//              });
//            });
//            return element;
//          } else {
//            // When called with $(el), use the currentResultIndex to get the right data
//            if (currentResultIndex < mockResults.length) {
//              const result = mockResults[currentResultIndex];
//              return createMockElement(result.title, result.url, result.title ? 1 : 0);
//            }
//            return createMockElement('', '', 0);
//          }
//        });

//              const results = await provider.search('test', {});
       
//        // Should only have the valid result
//        expect(results).toHaveLength(1);
//        expect(results[0].title).toBe('Valid Result');
//     });

//     it('should remove duplicate URLs', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       const duplicateResults = [
//         { title: 'First', url: 'https://example.com' },
//         { title: 'Second', url: 'https://example.com/' }, // Same URL with trailing slash
//         { title: 'Third', url: 'https://different.com' }
//       ];

//              // Mock the cheerio function for duplicate results test
//        let currentDuplicateIndex = 0;
//        mockCheerioFunction.mockImplementation((selector: string | any) => {
//          if (typeof selector === 'string') {
//            currentDuplicateIndex = 0; // Reset for each new search
//            const element = createMockElement();
//            element.each.mockImplementation((callback: any) => {
//              duplicateResults.forEach((result, index) => {
//                currentDuplicateIndex = index; // Set current index before callback
//                callback(index, { resultData: result });
//              });
//            });
//            return element;
//          } else {
//            // Return different elements based on current index
//            if (currentDuplicateIndex < duplicateResults.length) {
//              const result = duplicateResults[currentDuplicateIndex];
//              return createMockElement(result.title, result.url, 1);
//            }
//            return createMockElement('', '', 0);
//          }
//        });

//       const results = await provider.search('test', {});
      
//       // Should remove duplicate (trailing slash handled)
//       expect(results).toHaveLength(2);
//       expect(results.map(r => r.title)).toEqual(['First', 'Third']);
//     });

//     it('should respect maxResults option', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       const manyResults = Array.from({ length: 30 }, (_, i) => ({
//         title: `Result ${i + 1}`,
//         url: `https://example${i}.com`
//       }));

//              // Mock the cheerio function for maxResults test with proper call tracking
//        let maxResultsCallIndex = 0;
//        mockCheerioFunction.mockImplementation((selector: string | any) => {
//          if (typeof selector === 'string') {
//            maxResultsCallIndex = 0; // Reset for each new search
//            const element = createMockElement();
//            element.each.mockImplementation((callback: any) => {
//              for (let index = 0; index < manyResults.length; index++) {
//                const shouldContinue = callback(index, {});
//                if (shouldContinue === false) {
//                  break;
//                }
//              }
//            });
//            return element;
//          } else {
//            // Return different elements based on call order
//            if (maxResultsCallIndex < manyResults.length) {
//              const result = manyResults[maxResultsCallIndex];
//              maxResultsCallIndex++;
//              return createMockElement(result.title, result.url, 1);
//            }
//            return createMockElement('', '', 0);
//          }
//        });

//       const results = await provider.search('test', { maxResults: 5 });
      
//       expect(results.length).toBeLessThanOrEqual(5);
//     });
//   });

//   describe('Metadata Extraction', () => {
//     it('should extract domain from URL', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//              // Mock the cheerio function for domain extraction test
//        mockCheerioFunction.mockImplementation((selector: string | any) => {
//          if (typeof selector === 'string') {
//            const element = createMockElement();
//            element.each.mockImplementation((callback: any) => {
//              callback(0, {});
//            });
//            return element;
//          } else {
//            // When called with $(el), return element with domain data
//            return createMockElement('Test Title', 'https://example.com/path', 1);
//          }
//        });

//       const results = await provider.search('test', {});
      
//       expect(results[0].metadata?.domain).toBe('example.com');
//     });

//     it('should detect PDF content type', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//              // Mock the cheerio function for PDF content type test
//        mockCheerioFunction.mockImplementation((selector: string | any) => {
//          if (typeof selector === 'string') {
//            const element = createMockElement();
//            element.each.mockImplementation((callback: any) => {
//              callback(0, {});
//            });
//            return element;
//          } else {
//            // When called with $(el), return element with PDF data
//            return createMockElement('PDF Document', 'https://example.com/document.pdf', 1);
//          }
//        });

//       const results = await provider.search('test', {});
      
//       expect(results[0].metadata?.contentType).toBe('application/pdf');
//     });

//     it('should extract published date when available', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//              // Mock the cheerio function for published date test
//        mockCheerioFunction.mockImplementation((selector: string | any) => {
//          if (typeof selector === 'string') {
//            const element = createMockElement();
//            element.each.mockImplementation((callback: any) => {
//              callback(0, {});
//            });
//            return element;
//          } else {
//            // When called with $(el), return element with timestamp handling
//            const element = createMockElement('Test Title', 'https://example.com/', 1);
//            element.find.mockImplementation((selector: string) => {
//              if (selector.includes('timestamp')) {
//                return {
//                  length: 1,
//                  text: vi.fn().mockReturnValue('2024-01-15')
//                };
//              }
//              // Return the normal chainable element for other selectors
//              return createMockElement('Test Title', 'https://example.com/', 1);
//            });
//            return element;
//          }
//        });

//       const results = await provider.search('test', {});
      
//       expect(results[0].metadata?.publishedDate).toBe('2024-01-15');
//     });
//   });

//      describe('Error Handling', () => {
//      it('should handle fetch failures gracefully', async () => {
//        // Create fresh provider with no retries for this test
//        const testProvider = new DuckDuckGoHtmlProvider({ maxRetries: 0 });
       
//        // Create fresh mock for this test
//        const testMockFetch = vi.fn();
//        testMockFetch.mockRejectedValue(new Error('Network error'));
//        global.fetch = testMockFetch;

//        const results = await testProvider.search('test', {});
//        expect(results).toEqual([]);
//      }, 2000); // 2 second timeout

//      it('should handle HTTP errors gracefully', async () => {
//        // Create fresh provider with no retries for this test
//        const testProvider = new DuckDuckGoHtmlProvider({ maxRetries: 0 });
       
//        // Create fresh mock for this test
//        const testMockFetch = vi.fn();
//        testMockFetch.mockResolvedValue({
//          ok: false,
//          status: 429,
//          statusText: 'Too Many Requests'
//        });
//        global.fetch = testMockFetch;

//        const results = await testProvider.search('test', {});
//        expect(results).toEqual([]);
//      }, 2000); // 2 second timeout

//      it('should handle timeout errors', async () => {
//        // Create fresh provider with no retries for this test
//        const testProvider = new DuckDuckGoHtmlProvider({ maxRetries: 0 });
       
//        // Create fresh mock for this test
//        const testMockFetch = vi.fn();
//        testMockFetch.mockRejectedValue(new Error('timeout'));
//        global.fetch = testMockFetch;

//        const results = await testProvider.search('test', {});
//        expect(results).toEqual([]);
//      }, 2000); // 2 second timeout

//      it('should handle unexpected content types', async () => {
//        // Create fresh provider with no retries for this test
//        const testProvider = new DuckDuckGoHtmlProvider({ maxRetries: 0 });
       
//        // Create fresh mock for this test
//        const testMockFetch = vi.fn();
//        testMockFetch.mockResolvedValue({
//          ok: true,
//          headers: { get: () => 'application/json' },
//          text: () => Promise.resolve('{"error": "not html"}')
//        });
//        global.fetch = testMockFetch;

//        const results = await testProvider.search('test', {});
//        expect(results).toEqual([]);
//      }, 2000); // 2 second timeout
//    });

//   describe('Configuration', () => {
//     it('should provide recommended configuration', () => {
//       const recommendations = provider.getConfigRecommendations();
      
//       expect(recommendations.timeout).toBe(15000);
//       expect(recommendations.maxRetries).toBe(2);
//       expect(recommendations.rateLimit?.requestsPerMinute).toBe(30);
//       expect(recommendations.headers).toBeDefined();
//       expect(recommendations.headers?.['User-Agent']).toContain('CipherBot');
//     });

//     it('should update configuration correctly', () => {
//       const newConfig = {
//         timeout: 20000,
//         maxRetries: 5
//       };

//       provider.updateConfig(newConfig);
//       const config = provider.getConfig();

//       expect(config.timeout).toBe(20000);
//       expect(config.maxRetries).toBe(5);
//     });

//     it('should maintain default headers when updating config', () => {
//       provider.updateConfig({ timeout: 20000 });
//       const config = provider.getConfig();

//       expect(config.headers?.['User-Agent']).toBeDefined();
//       expect(config.headers?.['Accept']).toBeDefined();
//     });
//   });

//   describe('Statistics', () => {
//     it('should track request statistics', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       mockCheerioElement.each.mockImplementation((callback: any) => {});

//       const initialStats = provider.getStats();
//       expect(initialStats.requestCount).toBe(0);

//       await provider.search('test', {});

//       const updatedStats = provider.getStats();
//       expect(updatedStats.requestCount).toBe(1);
//       expect(updatedStats.lastRequestTime).toBeGreaterThan(0);
//     });

//     it('should reset statistics correctly', async () => {
//       mockFetch.mockResolvedValue({
//         ok: true,
//         headers: { get: () => 'text/html' },
//         text: () => Promise.resolve('<html></html>')
//       });

//       mockCheerioElement.each.mockImplementation((callback: any) => {});

//       await provider.search('test', {});
      
//       provider.resetStats();
//       const stats = provider.getStats();
      
//       expect(stats.requestCount).toBe(0);
//       expect(stats.lastRequestTime).toBe(0);
//     });
//   });
// });

// describe('DuckDuckGoHtmlProvider Integration Tests', () => {
//   let provider: DuckDuckGoHtmlProvider;

//   beforeEach(() => {
//     provider = new DuckDuckGoHtmlProvider();
//     // Skip integration tests in CI unless specifically enabled
//     if (process.env.CI && !process.env.RUN_INTEGRATION_TESTS) {
//       return;
//     }
//   });

//   it.skipIf(process.env.CI && !process.env.RUN_INTEGRATION_TESTS)(
//     'should perform real search against DuckDuckGo', 
//     async () => {
//       const results = await provider.search('TypeScript programming language', {
//         maxResults: 3,
//         safeMode: true
//       });

//       expect(results).toBeDefined();
//       expect(Array.isArray(results)).toBe(true);
      
//       if (results.length > 0) {
//         const firstResult = results[0];
//         expect(firstResult.provider).toBe('duckduckgo-html');
//         expect(firstResult.title).toBeTruthy();
//         expect(firstResult.url).toMatch(/^https?:\/\//);
//         expect(firstResult.rankOnPage).toBeGreaterThan(0);
//         expect(firstResult.metadata?.domain).toBeTruthy();
//       }
//     }, 
//     30000 // 30 second timeout for real network request
//   );

//   it.skipIf(process.env.CI && !process.env.RUN_INTEGRATION_TESTS)(
//     'should handle rate limiting correctly',
//     async () => {
//       const promises = Array.from({ length: 5 }, () => 
//         provider.search(`test query ${Math.random()}`, { maxResults: 1 })
//       );

//       const results = await Promise.all(promises);
      
//       // All requests should complete without errors
//       results.forEach(result => {
//         expect(Array.isArray(result)).toBe(true);
//       });
//     },
//     60000 // 60 second timeout for multiple requests
//   );
// }); 