/**
 * Core Context system types and interfaces
 */

import { z } from 'zod';
import { Logger } from '../logger/core/logger.js';

/**
 * Placeholder interfaces - These should be replaced with actual implementations
 * when they're developed
 */
// TODO: Implement these interfaces when the actual components are developed
export interface ISettings {
  [key: string]: any;
}

export interface IExecutor {
  uuid(): string;
  // TODO: Add executor methods
}

export interface ICipherApp {
  // TODO: Add app methods
}

export interface IServerRegistry {
  initialize(settings?: any, configPath?: string): Promise<void>;
  addServer(serverName: string, serverConfig: any): Promise<void>;
  removeServer(serverName: string): Promise<void>;
  getServerNames(): string[];
  getEnabledServerNames(): string[];
  getServerConfig(serverName: string): any;
  setServerEnabled(serverName: string, enabled: boolean): void;
  registerInitHook(serverName: string, hook: any): void;
  unregisterInitHook(serverName: string): void;
  startServer(serverName: string, clientSessionFactory?: any, sessionId?: string): AsyncGenerator<any, void, unknown>;
  initializeServer(serverName: string, clientSessionFactory?: any, initHook?: any, sessionId?: string): AsyncGenerator<any, void, unknown>;
  getStatistics(): any;
  exportConfiguration(): any;
  saveConfiguration(filePath: string, format?: 'json' | 'yaml'): Promise<void>;
  shutdown(): Promise<void>;
}

export interface IActivityRegistry {
  // TODO: Add activity registry methods
}

export interface ISignalRegistry {
  // TODO: Add signal registry methods
}

export interface IDecoratorRegistry {
  // TODO: Add decorator registry methods
}

export interface IWorkflowRegistry {
  // TODO: Add workflow registry methods
}

export interface IHumanInputCallback {
  (prompt: string, options?: any): Promise<string>;
}

export interface ISignalWaitCallback {
  (signalName: string, timeout?: number): Promise<any>;
}

export interface IServerSession {
  // TODO: Add server session methods
}

export interface IModelSelector {
  // TODO: Add model selector methods
}

/**
 * Core Context interface
 * The central state container for the application
 */
export interface IContext {
  // Core application components
  config?: ISettings;
  executor?: IExecutor;
  sessionId?: string;
  app?: ICipherApp;
  
  // Registries for different components
  serverRegistry?: IServerRegistry;
  taskRegistry?: IActivityRegistry;
  signalRegistry?: ISignalRegistry;
  decoratorRegistry?: IDecoratorRegistry;
  workflowRegistry?: IWorkflowRegistry;
  
  // Runtime components
  humanInputHandler?: IHumanInputCallback;
  signalNotification?: ISignalWaitCallback;
  upstreamSession?: IServerSession;
  modelSelector?: IModelSelector;
  
  // Logger integration
  logger?: Logger;
}

/**
 * Zod schema for runtime validation of Context
 */
export const ContextSchema = z.object({
  config: z.any().optional(),
  executor: z.any().optional(),
  sessionId: z.string().optional(),
  app: z.any().optional(),
  serverRegistry: z.any().optional(),
  taskRegistry: z.any().optional(),
  signalRegistry: z.any().optional(),
  decoratorRegistry: z.any().optional(),
  workflowRegistry: z.any().optional(),
  humanInputHandler: z.function()
    .args(z.string(), z.any().optional())
    .returns(z.promise(z.string()))
    .optional(),
  signalNotification: z.function()
    .args(z.string(), z.number().optional())
    .returns(z.promise(z.any()))
    .optional(),
  upstreamSession: z.any().optional(),
  modelSelector: z.any().optional(),
  logger: z.any().optional(),
});

/**
 * Options for initializing a context
 */
export interface ContextInitOptions {
  config?: ISettings;
  taskRegistry?: IActivityRegistry;
  decoratorRegistry?: IDecoratorRegistry;
  signalRegistry?: ISignalRegistry;
  storeGlobally?: boolean;
  logger?: Logger;
  sessionId?: string;
}
