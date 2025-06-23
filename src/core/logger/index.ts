/**
 * Main exports for the TypeScript Logger system
 * Phase 1: Core Foundation implementation
 */

// Core exports
export * from './core/index.js';

// Type exports
export * from './types/index.js';

// Listener exports
export * from './listeners/index.js';

// Transport exports
export * from './transports/index.js';

// Utility exports
export {
	safeJsonStringify,
	sanitizeForLogging,
	truncateForLogging,
	setGlobalLogContext,
	getGlobalLogContext,
	getAllGlobalLogContext,
	clearGlobalLogContext,
	withGlobalLogContext,
	mergeContext,
	generateSessionId,
	generateRequestId,
	generateTraceId,
	generateSpanId,
} from './utils/index.js';

// Convenience re-exports
export { Logger, TimedOperation } from './core/logger.js';
export { AsyncEventBus } from './core/event-bus.js';
export { LoggingConfig } from './core/config.js';
export { ConsoleListener } from './listeners/console-listener.js';
export { ConsoleTransport, NoOpTransport } from './transports/index.js';
