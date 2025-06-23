/**
 * Tests for the Context class
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { Context } from '../context.js';
import { Logger } from '../../logger/core/logger.js';

describe('Context', () => {
	let context: Context;

	beforeEach(() => {
		context = new Context({
			sessionId: 'test-session',
			config: { testSetting: true },
			logger: new Logger('test'),
		});
	});

	test('should create a context with properties', () => {
		expect(context.sessionId).toBe('test-session');
		expect(context.config).toEqual({ testSetting: true });
		expect(context.logger).toBeInstanceOf(Logger);
	});

	test('should get and set properties', () => {
		expect(context.get('sessionId')).toBe('test-session');

		context.set('sessionId', 'new-session');
		expect(context.sessionId).toBe('new-session');
	});

	test('should check if properties exist', () => {
		expect(context.has('sessionId')).toBe(true);
		// @ts-expect-error - Testing non-existent property
		expect(context.has('nonExistentProperty')).toBe(false);
	});

	test('should convert to JSON', () => {
		const json = context.toJSON();
		expect(json.sessionId).toBe('test-session');
		expect(json.config).toEqual({ testSetting: true });
		expect(json.logger).toBeInstanceOf(Logger);
	});

	test('should create child context', () => {
		const childContext = context.createChildContext({
			sessionId: 'child-session',
		});

		expect(childContext.sessionId).toBe('child-session');
		expect(childContext.config).toEqual({ testSetting: true });
		expect(childContext.logger).toBeInstanceOf(Logger);
	});
});
