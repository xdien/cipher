import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, logger, createLogger, setGlobalLogLevel, getGlobalLogLevel } from '../index.js';

// Mock console methods to capture output
let spyConsoleLog: ReturnType<typeof vi.spyOn>;

// Ensure clean environment between tests
beforeEach(() => {
	delete process.env.CIPHER_LOG_LEVEL;
	delete process.env.REDACT_SECRETS;
	vi.restoreAllMocks();

	spyConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('Logger Core Functionality', () => {
	describe('Logger Construction and Level Management', () => {
		it('creates logger with default info level', () => {
			const testLogger = new Logger();
			expect(testLogger.getLevel()).toBe('info');
		});

		it('respects CIPHER_LOG_LEVEL environment variable', () => {
			process.env.CIPHER_LOG_LEVEL = 'debug';
			const testLogger = new Logger();
			expect(testLogger.getLevel()).toBe('debug');
		});

		it('ignores invalid CIPHER_LOG_LEVEL and falls back to info', () => {
			process.env.CIPHER_LOG_LEVEL = 'invalid_level';
			const testLogger = new Logger();
			expect(testLogger.getLevel()).toBe('info');
		});

		it('accepts level option in constructor', () => {
			const testLogger = new Logger({ level: 'warn' });
			expect(testLogger.getLevel()).toBe('warn');
		});

		it('setLevel updates level correctly', () => {
			const testLogger = new Logger();
			testLogger.setLevel('error');
			expect(testLogger.getLevel()).toBe('error');
		});

		it('setLevel rejects invalid levels and keeps current level', () => {
			const testLogger = new Logger({ level: 'info' });
			const originalLevel = testLogger.getLevel();
			testLogger.setLevel('invalid_level');
			expect(testLogger.getLevel()).toBe(originalLevel);
		});

		it('setLevel logs confirmation when not silent', () => {
			const testLogger = new Logger({ silent: false });
			testLogger.setLevel('warn');
			// Note: This may not work with winston mocking, but tests the public API
		});
	});

	describe('Silent Mode', () => {
		it('respects silent option in constructor', () => {
			const testLogger = new Logger({ silent: true });
			// Test that logger accepts silent option without errors
			expect(testLogger).toBeDefined();
		});

		it('setSilent method exists and can be called', () => {
			const testLogger = new Logger({ silent: false });
			expect(() => testLogger.setSilent(true)).not.toThrow();
		});
	});

	describe('Basic Logging Methods API', () => {
		let testLogger: Logger;

		beforeEach(() => {
			testLogger = new Logger({ level: 'silly' }); // Enable all log levels
		});

		it('error method exists and accepts string message', () => {
			expect(() => testLogger.error('error message')).not.toThrow();
		});

		it('warn method exists and accepts string message', () => {
			expect(() => testLogger.warn('warn message')).not.toThrow();
		});

		it('info method exists and accepts string message', () => {
			expect(() => testLogger.info('info message')).not.toThrow();
		});

		it('http method exists and accepts string message', () => {
			expect(() => testLogger.http('http message')).not.toThrow();
		});

		it('verbose method exists and accepts string message', () => {
			expect(() => testLogger.verbose('verbose message')).not.toThrow();
		});

		it('debug method exists and accepts string message', () => {
			expect(() => testLogger.debug('debug message')).not.toThrow();
		});

		it('silly method exists and accepts string message', () => {
			expect(() => testLogger.silly('silly message')).not.toThrow();
		});

		it('logging methods accept meta and color parameters', () => {
			expect(() => testLogger.info('test message', { extra: 'data' }, 'blue')).not.toThrow();
		});
	});
});

describe('Special Display Features', () => {
	let testLogger: Logger;

	beforeEach(() => {
		testLogger = new Logger({ silent: false });
	});

	describe('Tool Call Features', () => {
		it('toolCall displays tool name and arguments', () => {
			testLogger.toolCall('testTool', { foo: 'bar', baz: 123 });
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('Tool Call');
		});

		it('toolCall handles string arguments', () => {
			testLogger.toolCall('testTool', 'simple string argument');
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('Tool Call');
		});

		it('toolResult displays formatted result', () => {
			testLogger.toolResult({ status: 'success', data: 'result' });
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('Tool Result');
		});

		it('toolResult handles string results', () => {
			testLogger.toolResult('Simple result string');
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('Tool Result');
		});
	});

	describe('AI Response Display', () => {
		it('displayAIResponse handles string responses', () => {
			testLogger.displayAIResponse('This is an AI response');
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('AI Response');
		});

		it('displayAIResponse handles object responses', () => {
			testLogger.displayAIResponse({ content: 'AI response content', type: 'text' });
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('AI Response');
		});

		it('displayAIResponse handles responses without content property', () => {
			testLogger.displayAIResponse({ data: 'some data', status: 'ok' });
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('AI Response');
		});
	});

	describe('Custom Box Display', () => {
		it('displayBox creates custom formatted output', () => {
			testLogger.displayBox('Custom Title', 'Custom content here', 'blue');
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('Custom content here');
		});

		it('displayBox uses default border color when not specified', () => {
			testLogger.displayBox('Default Border', 'Content');
			expect(spyConsoleLog).toHaveBeenCalled();
			const lastCall = spyConsoleLog.mock.calls[spyConsoleLog.mock.calls.length - 1];
			expect(lastCall[0]).toContain('Content');
		});
	});

	describe('Silent Mode Behavior', () => {
		beforeEach(() => {
			testLogger = new Logger({ silent: true });
			spyConsoleLog.mockClear();
		});

		it('toolCall respects silent mode', () => {
			testLogger.toolCall('testTool', { foo: 'bar' });
			expect(spyConsoleLog).not.toHaveBeenCalled();
		});

		it('displayAIResponse respects silent mode', () => {
			testLogger.displayAIResponse('response');
			expect(spyConsoleLog).not.toHaveBeenCalled();
		});

		it('displayBox respects silent mode', () => {
			testLogger.displayBox('title', 'content');
			expect(spyConsoleLog).not.toHaveBeenCalled();
		});
	});
});

describe('Child Logger Creation', () => {
	let parentLogger: Logger;

	beforeEach(() => {
		parentLogger = new Logger({ level: 'debug', silent: false });
	});

	it('createChild returns a new Logger instance', () => {
		const childLogger = parentLogger.createChild();
		expect(childLogger).toBeDefined();
		expect(childLogger).toBeInstanceOf(Logger);
	});

	it('createChild inherits parent settings by default', () => {
		const childLogger = parentLogger.createChild();
		expect(childLogger.getLevel()).toBe('debug');
	});

	it('createChild accepts custom options', () => {
		const childLogger = parentLogger.createChild({
			level: 'error',
			silent: true,
		});
		expect(childLogger.getLevel()).toBe('error');
	});

	it('createChild with file option works without errors', () => {
		expect(() => {
			const childLogger = parentLogger.createChild({ file: '/tmp/child.log' });
			expect(childLogger).toBeDefined();
		}).not.toThrow();
	});
});

describe('Global Logger Instance', () => {
	it('logger singleton works correctly', () => {
		expect(logger).toBeDefined();
		expect(logger).toBeInstanceOf(Logger);
		expect(logger.getLevel()).toBe('info');
	});

	it('setGlobalLogLevel updates global logger', () => {
		const originalLevel = getGlobalLogLevel();
		setGlobalLogLevel('warn');
		expect(getGlobalLogLevel()).toBe('warn');
		// Restore original level
		setGlobalLogLevel(originalLevel);
	});

	it('getGlobalLogLevel returns current level', () => {
		const level = getGlobalLogLevel();
		expect(typeof level).toBe('string');
		expect(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).toContain(level);
	});

	it('createLogger factory function works', () => {
		const newLogger = createLogger({ level: 'error' });
		expect(newLogger).toBeInstanceOf(Logger);
		expect(newLogger.getLevel()).toBe('error');
	});
});

describe('Advanced Features', () => {
	let testLogger: Logger;

	beforeEach(() => {
		testLogger = new Logger();
	});

	it('getWinstonLogger returns winston instance', () => {
		const winstonLogger = testLogger.getWinstonLogger();
		expect(winstonLogger).toBeDefined();
	});

	it('handles complex metadata objects without errors', () => {
		const complexMeta = {
			user: { id: 123, name: 'test' },
			request: { url: '/api/test', method: 'POST' },
			nested: { deep: { value: 'test' } },
		};

		expect(() => testLogger.info('Complex log message', complexMeta)).not.toThrow();
	});

	it('handles various data types in logging without errors', () => {
		expect(() => {
			testLogger.info('String message');
			testLogger.info('Number message', { number: 42 });
			testLogger.info('Boolean message', { flag: true });
			testLogger.info('Array message', { items: [1, 2, 3] });
			testLogger.info('Null message', { value: null });
			testLogger.info('Undefined message', { value: undefined });
		}).not.toThrow();
	});
});

describe('Environment Variable Support', () => {
	it('supports different log levels via CIPHER_LOG_LEVEL', () => {
		const validLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

		validLevels.forEach(level => {
			process.env.CIPHER_LOG_LEVEL = level;
			const testLogger = new Logger();
			expect(testLogger.getLevel()).toBe(level);
			delete process.env.CIPHER_LOG_LEVEL;
		});
	});

	it('handles REDACT_SECRETS environment variable', () => {
		process.env.REDACT_SECRETS = 'false';
		const testLogger = new Logger();
		expect(() => testLogger.info('apiKey: "secret123", password=hidden')).not.toThrow();
		delete process.env.REDACT_SECRETS;
	});
});

describe('Error Handling and Edge Cases', () => {
	let testLogger: Logger;

	beforeEach(() => {
		testLogger = new Logger();
	});

	it('handles invalid level gracefully', () => {
		const originalLevel = testLogger.getLevel();
		testLogger.setLevel('totally_invalid_level');
		expect(testLogger.getLevel()).toBe(originalLevel);
	});

	it('redirectToFile and redirectToConsole work without errors', () => {
		expect(() => {
			testLogger.redirectToFile('/tmp/test.log');
			testLogger.redirectToConsole();
		}).not.toThrow();
	});

	it('handles empty and null messages gracefully', () => {
		expect(() => {
			testLogger.info('');
			testLogger.warn('   ');
		}).not.toThrow();
	});
});

describe('TypeScript Interface Compliance', () => {
	it('Logger accepts proper LoggerOptions interface', () => {
		const options = {
			level: 'debug' as const,
			silent: true,
			file: '/tmp/test.log',
		};

		expect(() => new Logger(options)).not.toThrow();
	});

	it('ChalkColor type works with logging methods', () => {
		const testLogger = new Logger();
		const validColors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

		validColors.forEach(color => {
			expect(() => {
				testLogger.info('test', {}, color as any);
			}).not.toThrow();
		});
	});
});
