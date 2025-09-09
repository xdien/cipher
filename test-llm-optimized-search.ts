// Test Enhanced LLM-Optimized DuckDuckGo Search
import { DuckDuckGoPuppeteerProvider } from './src/core/brain/tools/definitions/web-search/engine/duckduckgo.js';

async function testLLMOptimizedSearch() {
  const provider = new DuckDuckGoPuppeteerProvider();
  
  console.log('🤖 Testing LLM-Optimized DuckDuckGo Search Engine...\n');
  
  const testQueries = [
    // 'Connect to Milvus Cloud docs',
    // 'how to install Docker',
    // 'React useState tutorial'
    'how to install Docker'
  ];
  
  for (const query of testQueries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Query: "${query}"`);
    console.log(`${'='.repeat(80)}\n`);
    
    try {
      const results = await provider.search(query, {
        maxResults: 1,
        safeMode: false
      });
    //   console.log('DuckDuckGo: Results:', results);
      return;
    //   if (results.length === 0) {
    //     console.log('❌ No results found');
    //     continue;
    //   }
    //   let output: any[] = [];
    //   results.forEach((result, index) => {
    //     output.push(`${index + 1}. ${result.title}`);
    //     output.push(`🔗 URL: ${result.url}`);
    //     output.push('');
      
    //     console.log(result.llmOptimized.keyFacts);
    //     return;
    //   if (result.extractedContent?.llmOptimized) {
    //     const optimized = result.extractedContent.llmOptimized;

    //     if (optimized.keyFacts.length > 0) {
    //       output.push('🔑 KEY FACTS:');
    //       optimized.keyFacts.slice(0, 5).forEach((fact, idx) => {
    //         output.push(`${idx + 1}. ${fact}`);
    //       });
    //       output.push('');
    //     }

    //     if (optimized.summary.length > 0) {
    //         output.push('📋 SUMMARY:');
    //         output.push(optimized.summary);
    //         output.push('');
    //       }
    //     if (optimized.relevanceScore) {
    //         output.push('📋 RELEVANCE SCORE:');
    //         output.push(optimized.relevanceScore);
    //         output.push('');
    //     }

    //     if (optimized.contentType) {
    //         output.push('📋 CONTENT TYPE:');
    //         output.push(optimized.contentType);
    //         output.push('');
    //     }
    //     console.log(output.join('\n'));
    //   }
    // });
    // console.log('🔍 Output:', output);
    } catch (error) {
      console.error(`❌ Error processing query:`, error.message);
    }
    
    // Small delay between queries to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Clean up browser
  await provider.cleanup();
  console.log('\n🧹 Browser cleaned up successfully');
}

// Run the test
testLLMOptimizedSearch().catch(console.error); 