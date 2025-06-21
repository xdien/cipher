/**
 * Context initialization logic
 */

import { v4 as uuidv4 } from 'uuid';
import { Context } from './context.js';
import { ISettings, ContextInitOptions } from './types.js';
import { setGlobalContext } from './global-context.js';
import { Logger } from '../logger/core/logger.js';

/**
 * Default settings if none provided
 * @returns Default settings object
 */
function getDefaultSettings(): ISettings {
  return {
    // TODO: Add default settings
  };
}

/**
 * Configure executor based on settings
 * @param config Application settings
 * @returns Configured executor
 */
async function configureExecutor(config: ISettings) {
  // TODO: Implement executor configuration
  return {
    uuid: () => uuidv4()
  };
}

/**
 * Configure workflow registry
 * @param config Application settings
 * @param executor The executor instance
 * @returns Configured workflow registry
 */
async function configureWorkflowRegistry(config: ISettings, executor: any) {
  // TODO: Implement workflow registry configuration
  return {};
}

/**
 * Configure logger for the application
 * @param config Application settings
 * @param sessionId Session ID for logging
 * @returns Configured logger
 */
function configureLogger(config: ISettings, sessionId: string): Logger {
  // Create a root logger with the session ID
  return new Logger('cipher', sessionId);
}

/**
 * Initialize the context
 * @param options Context initialization options
 * @returns Initialized Context instance
 */
export async function initializeContext(
  options: ContextInitOptions = {}
): Promise<Context> {
  // Use provided config or get default
  const config = options.config || getDefaultSettings();
  
  // Create initial context
  const context = new Context();
  context.config = config;
  
  // Configure server registry (placeholder)
  context.serverRegistry = {};
  
  // Configure executor
  context.executor = await configureExecutor(config);
  
  // Configure workflow registry
  context.workflowRegistry = await configureWorkflowRegistry(
    config,
    context.executor
  );
  
  // Generate session ID or use provided one
  context.sessionId = options.sessionId || context.executor.uuid();
  
  // Configure logger
  const logger = options.logger || configureLogger(config, context.sessionId);
  context.logger = logger;
  
  // Set registries from options or create empty ones
  context.taskRegistry = options.taskRegistry || {};
  context.signalRegistry = options.signalRegistry || {};
  context.decoratorRegistry = options.decoratorRegistry || {};
  
  // Store globally if requested
  if (options.storeGlobally) {
    setGlobalContext(context);
  }
  
  return context;
}

/**
 * Create a minimal context for testing
 * @param overrides Properties to override in the test context
 * @returns A minimal Context instance for testing
 */
export function createTestContext(overrides: Partial<Context> = {}): Context {
  const sessionId = uuidv4();
  const logger = new Logger('test', sessionId);
  
  return new Context({
    sessionId,
    logger,
    config: {},
    executor: {
      uuid: () => uuidv4()
    },
    ...overrides
  });
}
