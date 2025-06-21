/**
 * Context class implementation
 * Central state container for the application
 */

import { IContext, ContextSchema, ISettings, IExecutor, ICipherApp, 
  IServerRegistry, IActivityRegistry, ISignalRegistry, IDecoratorRegistry, 
  IWorkflowRegistry, IHumanInputCallback, ISignalWaitCallback, IServerSession, 
  IModelSelector } from './types.js';
import { Logger } from '../logger/core/logger.js';

/**
 * Context class
 * Implements the IContext interface with proper type safety and validation
 */
export class Context implements IContext {
  // Core application components
  config?: ISettings;
  executor?: IExecutor;
  sessionId?: string;
  app?: ICipherApp;
  
  // Registries
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
  
  // Logger
  logger?: Logger;
  
  constructor(contextData: Partial<IContext> = {}) {
    // Validate the input data against the schema
    const validatedData = ContextSchema.parse(contextData);
    
    // Assign all properties
    Object.assign(this, validatedData);
  }
  
  /**
   * Create a new Context by merging with provided partial context
   * @param partial Partial context to merge with current context
   * @returns A new Context instance
   */
  public merge(partial: Partial<IContext>): Context {
    return new Context({
      ...this.toJSON(),
      ...partial
    });
  }
  
  /**
   * Convert context to a plain object
   * @returns Plain JavaScript object representation of the context
   */
  public toJSON(): IContext {
    const result: Partial<IContext> = {};
    
    // Get all property names in this context object
    const keys = Object.keys(this);
    
    // Copy all defined properties that are in the IContext interface
    keys.forEach(key => {
      const typedKey = key as keyof this;
      if (this[typedKey] !== undefined) {
        // Safe to cast since we're only including properties from this object
        (result as any)[key] = this[typedKey];
      }
    });
    
    return result as IContext;
  }
  
  /**
   * Create a child context with the same properties
   * but allowing for overrides
   * @param overrides Properties to override in the child context
   * @returns A new Context instance
   */
  public createChildContext(overrides: Partial<IContext> = {}): Context {
    return new Context({
      ...this.toJSON(),
      ...overrides
    });
  }
  
  /**
   * Check if the context has a specific component
   * @param key The key to check
   * @returns True if the component exists and is not undefined
   */
  public has<K extends keyof IContext>(key: K): boolean {
    return this[key] !== undefined;
  }
  
  /**
   * Get a component from the context with type safety
   * @param key The key to get
   * @returns The component or undefined
   */
  public get<K extends keyof IContext>(key: K): IContext[K] | undefined {
    return this[key];
  }
  
  /**
   * Set a component in the context
   * @param key The key to set
   * @param value The value to set
   */
  public set<K extends keyof IContext>(key: K, value: IContext[K]): void {
    (this as unknown as IContext)[key] = value;
  }
}
