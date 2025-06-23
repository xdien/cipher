/**
 * Comprehensive tests for the TypeScript Logger system using Vitest
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	Logger,
	LoggingConfig,
	AsyncEventBus,
	Event,
	EventListener,
	NoOpTransport,
	generateSessionId,
	generateRequestId,
} from '../index.js';

/**
 * Test event listener that captures events for verification
 */
class TestEventListener implements EventListener {
	public capturedEvents: Event[] = [];

	async handleEvent(event: Event): Promise<void> {
		this.capturedEvents.push(event);
	}

	clear(): void {
		this.capturedEvents = [];
	}

	getEventsByType(type: string): Event[] {
		return this.capturedEvents.filter(event => event.type === type);
	}

	getEventsByNamespace(namespace: string): Event[] {
		return this.capturedEvents.filter(event => event.namespace === namespace);
	}

	getLastEvent(): Event | undefined {
		return this.capturedEvents[this.capturedEvents.length - 1];
	}
}

describe('Logger System', () => {
	let testListener: TestEventListener;

	beforeEach(async () => {
		// Reset event bus singleton before each test
		AsyncEventBus.reset();
		testListener = new TestEventListener();

		// Configure with test listener and no-op transport
		await LoggingConfig.configure({
			transport: new NoOpTransport(),
			enableConsoleListener: false,
		});

		LoggingConfig.addListener('test', testListener);
	});

	afterEach(async () => {
		await LoggingConfig.shutdown();
		testListener.clear();
	});

	describe('Basic Logging Functionality', () => {
		it('should create logger with correct namespace', () => {
			const logger = new Logger('app.service');
			expect(logger.loggerNamespace).toBe('app.service');
		});

		it('should log different event types correctly', async () => {
			const logger = new Logger('test.app');

			logger.info('Info message', 'test-info');
			logger.debug('Debug message', 'test-debug');
			logger.warning('Warning message', 'test-warning');
			logger.error('Error message', 'test-error');
			logger.progress('Progress message', 'test-progress', 75);

			// Wait for async processing
			await new Promise(resolve => setTimeout(resolve, 50));

			expect(testListener.capturedEvents).toHaveLength(5);

			const eventTypes = testListener.capturedEvents.map(e => e.type);
			expect(eventTypes).toEqual(['info', 'debug', 'warning', 'error', 'progress']);
		});

		it('should include correct event data', async () => {
			const logger = new Logger('test.app');
			const testData = { userId: 123, action: 'login' };

			logger.info('User logged in', 'user-login', undefined, testData);

			await new Promise(resolve => setTimeout(resolve, 50));

			const event = testListener.getLastEvent();
			expect(event).toBeDefined();
			expect(event!.type).toBe('info');
			expect(event!.message).toBe('User logged in');
			expect(event!.name).toBe('user-login');
			expect(event!.namespace).toBe('test.app');
			expect(event!.data).toMatchObject(testData);
			expect(event!.timestamp).toBeInstanceOf(Date);
		});

		it('should handle progress events with percentage', async () => {
			const logger = new Logger('test.progress');

			logger.progress('Processing data', 'data-process', 42);

			await new Promise(resolve => setTimeout(resolve, 50));

			const progressEvent = testListener.getEventsByType('progress')[0];
			expect(progressEvent).toBeDefined();
			expect(progressEvent.data.percentage).toBe(42);
		});
	});

	describe('Child Logger Functionality', () => {
		it('should create child logger with extended namespace', () => {
			const parent = new Logger('app');
			const child = parent.child('service');

			expect(child.loggerNamespace).toBe('app.service');
		});

		it('should inherit parent context in child logger', async () => {
			const sessionId = generateSessionId();
			const parent = new Logger('app', sessionId, { userId: 'user_123' });
			const child = parent.child('service', { requestId: 'req_456' });

			child.info('Child message');

			await new Promise(resolve => setTimeout(resolve, 50));

			const event = testListener.getLastEvent();
			expect(event!.context).toMatchObject({
				userId: 'user_123',
				requestId: 'req_456',
			});
			expect(child.loggerSessionId).toBe(sessionId);
		});

		it('should maintain separate namespaces for different children', () => {
			const parent = new Logger('app');
			const child1 = parent.child('service1');
			const child2 = parent.child('service2');

			expect(child1.loggerNamespace).toBe('app.service1');
			expect(child2.loggerNamespace).toBe('app.service2');
		});
	});

	describe('Timed Operations', () => {
		it('should create and complete timed operations', async () => {
			const logger = new Logger('timer.test');
			const timer = logger.timer('test-operation');

			timer.start('Starting test');
			await new Promise(resolve => setTimeout(resolve, 100));
			timer.end('Test completed', { result: 'success' });

			await new Promise(resolve => setTimeout(resolve, 50));

			const events = testListener.capturedEvents;
			expect(events).toHaveLength(2);

			const startEvent = events[0];
			const endEvent = events[1];

			expect(startEvent.data.operation).toBe('start');
			expect(endEvent.data.operation).toBe('end');
			expect(endEvent.data.duration_ms).toBeGreaterThan(90);
			expect(endEvent.data.result).toBe('success');
		});

		it('should handle timer errors correctly', async () => {
			const logger = new Logger('timer.test');
			const timer = logger.timer('failing-operation').start();
			const testError = new Error('Operation failed');

			// Add small delay to ensure duration > 0
			await new Promise(resolve => setTimeout(resolve, 10));
			timer.error(testError, 'Operation failed');

			await new Promise(resolve => setTimeout(resolve, 50));

			const events = testListener.capturedEvents;
			expect(events).toHaveLength(2);

			const errorEvent = events[1];
			expect(errorEvent.type).toBe('error');
			expect(errorEvent.data.error.message).toBe('Operation failed');
			expect(errorEvent.data.duration_ms).toBeGreaterThan(0);
		});

		it('should support timer context', async () => {
			const logger = new Logger('timer.test');
			const timer = logger.timer('context-operation').withContext({ batchId: 'batch_001' }).start();

			timer.end('Completed');

			await new Promise(resolve => setTimeout(resolve, 50));

			const events = testListener.capturedEvents;
			events.forEach(event => {
				expect(event.context).toMatchObject({ batchId: 'batch_001' });
			});
		});
	});

	describe('Error Handling', () => {
		it('should handle exception logging correctly', async () => {
			const logger = new Logger('error.test');
			const testError = new Error('Test error message');
			testError.stack = 'Error: Test error message\n    at test.js:1:1';

			logger.exception(testError, 'Custom error message', 'error-test');

			await new Promise(resolve => setTimeout(resolve, 50));

			const errorEvent = testListener.getEventsByType('error')[0];
			expect(errorEvent).toBeDefined();
			expect(errorEvent.message).toBe('Custom error message');
			expect(errorEvent.data.error.name).toBe('Error');
			expect(errorEvent.data.error.message).toBe('Test error message');
			expect(errorEvent.data.error.stack).toContain('Error: Test error message');
		});

		it('should handle non-Error objects in exception logging', async () => {
			const logger = new Logger('error.test');
			const nonError = { message: 'Not an error object', code: 500 };

			logger.exception(nonError as any, 'Custom message');

			await new Promise(resolve => setTimeout(resolve, 50));

			const errorEvent = testListener.getEventsByType('error')[0];
			expect(errorEvent.data.error).toEqual(nonError);
		});
	});

	describe('Event Bus Functionality', () => {
		it('should maintain singleton pattern', () => {
			const bus1 = AsyncEventBus.getInstance();
			const bus2 = AsyncEventBus.getInstance();

			expect(bus1).toBe(bus2);
		});

		it('should reset singleton correctly', () => {
			const bus1 = AsyncEventBus.getInstance();
			AsyncEventBus.reset();
			const bus2 = AsyncEventBus.getInstance();

			expect(bus1).not.toBe(bus2);
		});

		it('should process events asynchronously', async () => {
			const logger = new Logger('async.test');
			const startTime = Date.now();

			// Log multiple events quickly
			for (let i = 0; i < 5; i++) {
				logger.info(`Message ${i}`, `msg-${i}`);
			}

			// Should return immediately (async processing)
			const immediateTime = Date.now();
			expect(immediateTime - startTime).toBeLessThan(50);

			// Wait for processing
			await new Promise(resolve => setTimeout(resolve, 100));

			expect(testListener.capturedEvents).toHaveLength(5);
		});

		it('should handle listener errors gracefully', async () => {
			const errorListener: EventListener = {
				async handleEvent() {
					throw new Error('Listener error');
				},
			};

			LoggingConfig.addListener('error-listener', errorListener);

			const logger = new Logger('error.test');

			// This should not throw despite listener error
			expect(() => {
				logger.info('Test message');
			}).not.toThrow();

			await new Promise(resolve => setTimeout(resolve, 50));

			// Test listener should still receive the event
			expect(testListener.capturedEvents).toHaveLength(1);
		});
	});

	describe('Configuration Management', () => {
		it('should configure with console listener enabled', async () => {
			await LoggingConfig.shutdown();

			// Capture console.log output during test
			const originalConsoleLog = console.log;
			let capturedOutput = '';
			console.log = (...args: any[]) => {
				capturedOutput += args.join(' ') + '\n';
			};

			try {
				await LoggingConfig.configure({
					enableConsoleListener: true,
					transport: new NoOpTransport(),
				});

				const logger = new Logger('config.test');
				logger.info('Test message');

				await new Promise(resolve => setTimeout(resolve, 50));

				// Verify console output was captured
				expect(capturedOutput).toContain('Test message');
				expect(capturedOutput).toContain('[INFO]');
				expect(capturedOutput).toContain('[config.test]');
			} finally {
				// Restore original console.log
				console.log = originalConsoleLog;
				await LoggingConfig.shutdown();
			}
		});

		it('should add and remove listeners correctly', async () => {
			const customListener = new TestEventListener();

			LoggingConfig.addListener('custom', customListener);

			const logger = new Logger('listener.test');
			logger.info('Test message');

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(customListener.capturedEvents).toHaveLength(1);

			LoggingConfig.removeListener('custom');
			customListener.clear();

			logger.info('Another message');
			await new Promise(resolve => setTimeout(resolve, 50));

			expect(customListener.capturedEvents).toHaveLength(0);
		});

		it('should execute with managed configuration', async () => {
			let capturedEvent: Event | undefined;

			await LoggingConfig.managed(
				{
					transport: new NoOpTransport(),
					enableConsoleListener: false,
				},
				async () => {
					const customListener = new TestEventListener();
					LoggingConfig.addListener('managed-test', customListener);

					const logger = new Logger('managed.test');
					logger.info('Managed context message');

					await new Promise(resolve => setTimeout(resolve, 50));
					capturedEvent = customListener.getLastEvent();
				}
			);

			expect(capturedEvent).toBeDefined();
			expect(capturedEvent!.message).toBe('Managed context message');
		});
	});

	describe('Utility Functions', () => {
		it('should generate unique session IDs', () => {
			const id1 = generateSessionId();
			const id2 = generateSessionId();

			expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
			expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
			expect(id1).not.toBe(id2);
		});

		it('should generate unique request IDs', () => {
			const id1 = generateRequestId();
			const id2 = generateRequestId();

			expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
			expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
			expect(id1).not.toBe(id2);
		});
	});

	describe('Performance and Edge Cases', () => {
		it('should handle rapid logging without blocking', async () => {
			const logger = new Logger('performance.test');
			const startTime = Date.now();

			// Log 100 messages rapidly
			for (let i = 0; i < 100; i++) {
				logger.info(`Message ${i}`, `msg-${i}`);
			}

			const endTime = Date.now();
			expect(endTime - startTime).toBeLessThan(100); // Should be very fast

			// Wait for processing
			await new Promise(resolve => setTimeout(resolve, 200));

			expect(testListener.capturedEvents).toHaveLength(100);
		});

		it('should handle empty and null data gracefully', async () => {
			const logger = new Logger('edge.test');

			logger.info('Empty data', 'empty', undefined, {});
			logger.info('Null data', 'null', undefined, null as any);
			logger.info('Undefined data', 'undefined', undefined, undefined as any);

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(testListener.capturedEvents).toHaveLength(3);

			const events = testListener.capturedEvents;
			expect(events[0].data).toEqual({});
			expect(events[1].data).toBeNull();
			expect(events[2].data).toBeUndefined();
		});

		it('should handle very long messages', async () => {
			const logger = new Logger('long.test');
			const longMessage = 'A'.repeat(10000);

			logger.info(longMessage, 'long-message');

			await new Promise(resolve => setTimeout(resolve, 50));

			const event = testListener.getLastEvent();
			expect(event!.message).toBe(longMessage);
		});

		it('should handle circular references in data', async () => {
			const logger = new Logger('circular.test');
			const circularObj: any = { name: 'test' };
			circularObj.self = circularObj;

			// Should not throw
			expect(() => {
				logger.info('Circular data', 'circular', undefined, circularObj);
			}).not.toThrow();

			await new Promise(resolve => setTimeout(resolve, 50));

			expect(testListener.capturedEvents).toHaveLength(1);
		});
	});
});
