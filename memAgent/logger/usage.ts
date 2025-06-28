/**
 * Simple usage example for the Winston/Chalk/Boxen Logger system
 */

import { logger, createLogger, ChalkColor } from '../../src/core/logger/logger.js';
import { env } from '../../src/core/env.js';


/**
 * Example 1: Basic logging with the singleton logger
 */
function basicLoggingExample(): void {
	console.log('\n=== Basic Logging Example ===');

	// Using the singleton logger
	logger.info('Application started successfully', null, 'green');
	logger.warn('This is a warning message');
	logger.error('An error occurred', { errorCode: 'E001' });
	logger.debug('Debug information', { userId: 123 });
	logger.verbose('Verbose logging');
	logger.http('HTTP request received', { method: 'GET', path: '/api/users' });
	logger.silly('Silly level message');
}

/**
 * Example 2: Custom logger instance with different configuration
 */
function customLoggerExample(): void {
	console.log('\n=== Custom Logger Example ===');

	// Create a custom logger with debug level
	const customLogger = createLogger({ level: 'debug' });
	
	customLogger.info('Custom logger instance');
	customLogger.debug('This debug message will show because level is set to debug');
	
	// Create another logger that logs to file
	const fileLogger = createLogger({ 
		level: 'info',
		file: './logs/app.log'
	});
	
	fileLogger.info('This will be written to file');
	fileLogger.error('File error logging');
}

/**
 * Example 3: AI and Tool specific features
 */
function aiToolExample(): void {
	console.log('\n=== AI & Tool Features Example ===');

	// Display AI response
	logger.displayAIResponse({
		content: 'This is a simulated AI response with some helpful information about your request.'
	});

	// Tool call display
	logger.toolCall('readFile', {
		path: './README.md',
		encoding: 'utf8'
	});

	// Tool result display
	logger.toolResult({
		success: true,
		data: 'File content would be here...',
		size: 1024
	});

	// Custom box display
	logger.displayBox('💡 Pro Tip', 'Always use structured logging for better debugging!', 'cyan');
}

/**
 * Example 4: Security redaction features
 */
function securityExample(): void {
	console.log('\n=== Security Redaction Example ===');

	// These will be automatically redacted
	logger.info('User login with apiKey=sk-1234567890abcdef');
	logger.warn('Password: "mySecretPassword123" was rejected');
	logger.error('Token validation failed', { token: 'bearer_abc123xyz' });
	
	// Custom sensitive data
	logger.debug('Connection string: password=mypass123&secret=topsecret');
}

/**
 * Example 5: Dynamic configuration
 */
function configurationExample(): void {
	console.log('\n=== Configuration Example ===');

	logger.info('Current log level: ' + logger.getLevel());
	
	// Change log level
	logger.setLevel('debug');
	logger.debug('This debug message will now show');
	
	// Reset to info level
	logger.setLevel('info');
	logger.debug('This debug message will NOT show');
	
	// Create a child logger
	const childLogger = logger.createChild({ level: 'verbose' });
	childLogger.verbose('Child logger with different level');
}

/**
 * Example 6: Color customization
 */
function colorExample(): void {
	console.log('\n=== Color Customization Example ===');

	const colors: ChalkColor[] = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
	
	colors.forEach(color => {
		logger.info(`This message is in ${color}`, null, color);
	});
}

/**
 * Example 7: Environment variable control
 */
function environmentExample(): void {
	console.log('\n=== Environment Variables Example ===');
	
	console.log('Current environment settings:');
	console.log('- CIPHER_LOG_LEVEL:', env.CIPHER_LOG_LEVEL || 'not set (defaults to info)');
console.log('- REDACT_SECRETS:', env.REDACT_SECRETS || 'not set (defaults to true)');
	
	logger.info('Log level can be controlled via CIPHER_LOG_LEVEL environment variable');
	logger.info('Secret redaction can be disabled via REDACT_SECRETS=false');
}

/**
 * Run all examples
 */
async function runAllExamples(): Promise<void> {
	try {
		basicLoggingExample();
		await new Promise(resolve => setTimeout(resolve, 500));
		
		customLoggerExample();
		await new Promise(resolve => setTimeout(resolve, 500));
		
		aiToolExample();
		await new Promise(resolve => setTimeout(resolve, 500));
		
		securityExample();
		await new Promise(resolve => setTimeout(resolve, 500));
		
		configurationExample();
		await new Promise(resolve => setTimeout(resolve, 500));
		
		colorExample();
		await new Promise(resolve => setTimeout(resolve, 500));
		
		environmentExample();
		
		console.log('\n=== All logger examples completed! ===');
	} catch (error) {
		console.error('Example failed:', error);
	}
}

// Export individual examples for selective usage
export {
	basicLoggingExample,
	customLoggerExample,
	aiToolExample,
	securityExample,
	configurationExample,
	colorExample,
	environmentExample,
	runAllExamples,
};

// Run all examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runAllExamples();
}
