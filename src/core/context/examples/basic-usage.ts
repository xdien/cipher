/**
 * Basic usage example of the Cipher context system
 */

import { Context, initializeContext, ContextDependent } from '../index.js';
import { Logger } from '../../logger/core/logger.js';

// Example of a component that depends on context
class ExampleComponent extends ContextDependent {
  constructor(context?: Context) {
    super(context);
  }

  // Example of synchronous context access using instance context
  public logInfo(message: string): void {
    const context = this.instanceContext;
    
    if (context?.logger) {
      context.logger.info(message, 'example');
    } else {
      console.log('No logger available:', message);
    }
  }

  // Example of async context access with fallback to global
  public async processData(data: any): Promise<void> {
    try {
      const context = await this.getContextAsync();
      
      if (context.logger) {
        context.logger.info(`Processing data: ${JSON.stringify(data)}`, 'process');
      }
      
      // Example of using other context components
      if (context.sessionId) {
        console.log(`Session ID: ${context.sessionId}`);
      }
    } catch (error) {
      console.error('Context access error:', error);
    }
  }
  
  // Example of temporary context switching
  public async withTemporaryContext(data: any): Promise<void> {
    // Create a test context
    const tempLogger = new Logger('temp');
    const tempContext = new Context({ logger: tempLogger });
    
    // Use the temporary context for an operation
    await this.useContextAsync(tempContext, async () => {
      const currentContext = await this.getContextAsync();
      currentContext.logger?.info('Using temporary context', 'temp');
      
      // Do something with the data
      console.log('Processing with temporary context:', data);
    });
    
    // Back to original context
    const context = await this.getContextAsync();
    context.logger?.info('Back to original context', 'example');
  }
}

// Example async function to show context initialization and usage
async function runExample() {
  console.log('Initializing context...');
  
  // Initialize the context with storeGlobally=true
  const context = await initializeContext({
    storeGlobally: true,
    config: {
      appName: 'CipherExample',
      debug: true
    },
    sessionId: 'example-session-123'
  });
  
  console.log(`Context initialized with session ID: ${context.sessionId}`);
  
  // Create a component with explicit context
  const explicitComponent = new ExampleComponent(context);
  explicitComponent.logInfo('This uses explicit context');
  
  // Create a component that will use global context
  const implicitComponent = new ExampleComponent();
  await implicitComponent.processData({ id: 1, name: 'test' });
  
  // Example of context switching
  await implicitComponent.withTemporaryContext({ id: 2, name: 'temporary' });
  
  console.log('Example completed successfully.');
}

// Run the example if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExample().catch(console.error);
}

export { runExample };
