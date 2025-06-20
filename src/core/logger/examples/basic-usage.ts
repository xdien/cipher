/**
 * Basic usage example for the TypeScript Logger system
 */

import { 
  Logger, 
  LoggingConfig,
  ConsoleTransport,
  generateSessionId,
  generateRequestId 
} from '../index.js';

/**
 * Example 1: Basic logging with default configuration
 */
async function basicLoggingExample(): Promise<void> {
  console.log('\n=== Basic Logging Example ===');
  
  // Configure logging system
  await LoggingConfig.configure({
    enableConsoleListener: true,
  });

  // Create a logger
  const logger = new Logger('app.example');

  // Log different types of messages
  logger.info('Application started', 'startup');
  logger.debug('Debug information', 'debug', undefined, { userId: 123 });
  logger.warning('This is a warning', 'validation');
  logger.error('An error occurred', 'error', undefined, { errorCode: 'E001' });
  logger.progress('Processing data', 'data-processing', 75);

  // Wait a bit for async processing
  await new Promise(resolve => setTimeout(resolve, 100));

  // Shutdown
  await LoggingConfig.shutdown();
}

/**
 * Example 2: Structured logging with context
 */
async function structuredLoggingExample(): Promise<void> {
  console.log('\n=== Structured Logging Example ===');

  const sessionId = generateSessionId();
  const requestId = generateRequestId();

  await LoggingConfig.configure();

  // Create logger with context
  const logger = new Logger('api.service', sessionId, {
    requestId,
    userId: 'user_123',
    version: '1.0.0',
  });

  // Create child logger
  const dbLogger = logger.child('database');

  logger.info('Processing request', 'request-start', undefined, {
    method: 'POST',
    path: '/api/users',
    ip: '192.168.1.1',
  });

  dbLogger.info('Connecting to database', 'db-connect');
  dbLogger.info('Query executed', 'db-query', undefined, {
    query: 'SELECT * FROM users WHERE id = ?',
    params: [123],
    duration_ms: 45,
  });

  logger.info('Request completed', 'request-end', undefined, {
    status: 200,
    response_size: 1024,
  });

  await new Promise(resolve => setTimeout(resolve, 100));
  await LoggingConfig.shutdown();
}

/**
 * Example 3: Timed operations
 */
async function timedOperationExample(): Promise<void> {
  console.log('\n=== Timed Operation Example ===');

  await LoggingConfig.configure();

  const logger = new Logger('app.processor');

  // Create a timed operation
  const timer = logger.timer('data-processing')
    .withContext({ batchId: 'batch_001' })
    .start('Starting data processing');

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 200));

  // Log progress
  logger.progress('Processing batch', 'batch-progress', 50, undefined, {
    processed: 500,
    total: 1000,
  });

  await new Promise(resolve => setTimeout(resolve, 150));

  // Complete the operation
  timer.end('Data processing completed', {
    processed: 1000,
    errors: 0,
  });

  await new Promise(resolve => setTimeout(resolve, 100));
  await LoggingConfig.shutdown();
}

/**
 * Example 4: Error handling
 */
async function errorHandlingExample(): Promise<void> {
  console.log('\n=== Error Handling Example ===');

  await LoggingConfig.configure();

  const logger = new Logger('app.service');

  try {
    // Simulate an operation that might fail
    throw new Error('Database connection failed');
  } catch (error) {
    if (error instanceof Error) {
      logger.exception(error, 'Failed to connect to database', 'db-error', undefined, {
        host: 'localhost',
        port: 5432,
        database: 'myapp',
      });
    }
  }

  // Timed operation with error
  const timer = logger.timer('risky-operation').start();
  
  try {
    await new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), 100)
    );
  } catch (error) {
    if (error instanceof Error) {
      timer.error(error, 'Operation failed due to timeout');
    }
  }

  await new Promise(resolve => setTimeout(resolve, 100));
  await LoggingConfig.shutdown();
}

/**
 * Example 5: Custom transport
 */
async function customTransportExample(): Promise<void> {
  console.log('\n=== Custom Transport Example ===');

  // Create a custom transport that logs to console with prefix
  const customTransport = new ConsoleTransport({
    format: 'pretty',
    colorize: true,
  });

  await LoggingConfig.configure({
    transport: customTransport,
    enableConsoleListener: false, // Disable default listener
  });

  const logger = new Logger('app.custom');

  logger.info('Using custom transport', 'transport-test');
  logger.warning('This goes through custom transport', 'custom-warning');

  await new Promise(resolve => setTimeout(resolve, 100));
  await LoggingConfig.shutdown();
}

/**
 * Run all examples
 */
async function runExamples(): Promise<void> {
  try {
    await basicLoggingExample();
    await structuredLoggingExample();
    await timedOperationExample();
    await errorHandlingExample();
    await customTransportExample();
    
    console.log('\n=== All examples completed successfully! ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in other files
export {
  basicLoggingExample,
  structuredLoggingExample,
  timedOperationExample,
  errorHandlingExample,
  customTransportExample,
  runExamples,
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}
