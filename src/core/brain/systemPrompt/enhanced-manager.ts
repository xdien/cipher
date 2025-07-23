/**
 * Enhanced Prompt Manager
 * 
 * New plugin-based prompt manager that replaces the legacy PromptManager.
 * Provides extensible, configurable, and high-performance system prompt generation.
 */

import { 
  PromptProvider, 
  ProviderContext, 
  PromptGenerationResult, 
  ProviderResult, 
  SystemPromptConfig 
} from './interfaces.js';
import { SystemPromptConfigManager } from './config-manager.js';
import { providerRegistry } from './registry.js';
import { registerBuiltInGenerators } from './built-in-generators.js';

export interface EnhancedPromptManagerOptions {
  /** Configuration for the prompt manager */
  config?: SystemPromptConfig;
  /** Whether to automatically register built-in generators */
  registerBuiltInGenerators?: boolean;
  /** Custom context to merge with runtime context */
  defaultContext?: Partial<ProviderContext>;
}

export class EnhancedPromptManager {
  private configManager: SystemPromptConfigManager;
  private providers: Map<string, PromptProvider> = new Map();
  private defaultContext: Partial<ProviderContext>;
  private initialized: boolean = false;

  constructor(options: EnhancedPromptManagerOptions = {}) {
    this.configManager = new SystemPromptConfigManager();
    this.defaultContext = options.defaultContext || {};

    if (options.config) {
      this.configManager.loadFromObject(options.config);
    }

    // Register built-in generators by default
    if (options.registerBuiltInGenerators !== false) {
      this.initializeBuiltInGenerators();
    }
  }

  /**
   * Initialize the manager with configuration
   */
  public async initialize(config?: SystemPromptConfig): Promise<void> {
    if (config) {
      this.configManager.loadFromObject(config);
    }

    if (!this.configManager.isLoaded()) {
      // Use default configuration if none provided
      const defaultConfig = SystemPromptConfigManager.createDefault();
      this.configManager.loadFromObject(defaultConfig);
    }

    // Create provider instances
    await this.createProviders();
    
    this.initialized = true;
  }

  /**
   * Load configuration from file
   */
  public async loadConfigFromFile(filePath: string): Promise<void> {
    await this.configManager.loadFromFile(filePath);
    
    if (this.initialized) {
      // Recreate providers with new configuration
      await this.destroyProviders();
      await this.createProviders();
    }
  }

  /**
   * Generate complete system prompt
   */
  public async generateSystemPrompt(runtimeContext: Partial<ProviderContext> = {}): Promise<PromptGenerationResult> {
    this.ensureInitialized();

    const startTime = Date.now();
    const context = this.buildContext(runtimeContext);
    const settings = this.configManager.getSettings();
    const enabledProviders = this.getEnabledProviders();

    const providerResults: ProviderResult[] = [];
    const errors: Error[] = [];
    let success = true;

    // Generate content from all enabled providers, but track all providers in results
    const allProviders = Array.from(this.providers.values()).sort((a, b) => b.priority - a.priority);
    
    const promises = allProviders.map(async (provider): Promise<void> => {
      if (!provider.enabled) {
        // Add result for disabled provider
        providerResults.push({
          providerId: provider.id,
          content: '',
          generationTimeMs: 0,
          success: false,
          error: new Error('Provider is disabled')
        });
        return;
      }
      const providerStartTime = Date.now();
      
      try {
        const content = await this.executeWithTimeout(
          () => provider.generateContent(context),
          settings.maxGenerationTime
        );

        providerResults.push({
          providerId: provider.id,
          content,
          generationTimeMs: Date.now() - providerStartTime,
          success: true
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        
        providerResults.push({
          providerId: provider.id,
          content: '',
          generationTimeMs: Date.now() - providerStartTime,
          success: false,
          error: err
        });

        errors.push(err);
        
        if (settings.failOnProviderError) {
          success = false;
        }
      }
    });

    await Promise.all(promises);

    // Sort results by provider priority (to maintain order)
    providerResults.sort((a, b) => {
      const providerA = enabledProviders.find(p => p.id === a.providerId);
      const providerB = enabledProviders.find(p => p.id === b.providerId);
      return (providerB?.priority || 0) - (providerA?.priority || 0);
    });

    // Combine successful results
    const successfulResults = providerResults.filter(r => r.success && r.content.trim());
    const content = successfulResults
      .map(r => r.content)
      .join(settings.contentSeparator);

    return {
      content,
      providerResults,
      generationTimeMs: Date.now() - startTime,
      success: success && successfulResults.length > 0,
      errors
    };
  }

  /**
   * Get current configuration
   */
  public getConfig(): SystemPromptConfig {
    return this.configManager.getConfig();
  }

  /**
   * Get all providers (enabled and disabled)
   */
  public getProviders(): PromptProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get enabled providers sorted by priority
   */
  public getEnabledProviders(): PromptProvider[] {
    return Array.from(this.providers.values())
      .filter(provider => provider.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get a specific provider by ID
   */
  public getProvider(id: string): PromptProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Enable or disable a provider
   */
  public setProviderEnabled(id: string, enabled: boolean): void {
    const provider = this.providers.get(id);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  /**
   * Check if manager is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get performance statistics
   */
  public async getPerformanceStats(): Promise<{
    totalProviders: number;
    enabledProviders: number;
    averageGenerationTime: number;
    lastGenerationResult?: PromptGenerationResult;
  }> {
    const providers = this.getProviders();
    const enabledProviders = this.getEnabledProviders();
    
    // Generate a test prompt to measure performance
    const testResult = await this.generateSystemPrompt({
      timestamp: new Date(),
      sessionId: 'perf-test'
    });

    return {
      totalProviders: providers.length,
      enabledProviders: enabledProviders.length,
      averageGenerationTime: Math.max(testResult.generationTimeMs, 1), // Ensure at least 1ms
      lastGenerationResult: testResult
    };
  }

  /**
   * Destroy the manager and clean up resources
   */
  public async destroy(): Promise<void> {
    await this.destroyProviders();
    this.initialized = false;
  }

  /**
   * Initialize built-in generators
   */
  private async initializeBuiltInGenerators(): Promise<void> {
    await registerBuiltInGenerators();
  }

  /**
   * Create provider instances from configuration
   */
  private async createProviders(): Promise<void> {
    const providerConfigs = this.configManager.getProviders();

    for (const config of providerConfigs) {
      try {
        const provider = await providerRegistry.create(config);
        this.providers.set(provider.id, provider);
      } catch (error) {
        console.warn(`Failed to create provider '${config.name}':`, error);
      }
    }
  }

  /**
   * Destroy all provider instances
   */
  private async destroyProviders(): Promise<void> {
    const destroyPromises = Array.from(this.providers.values()).map(async (provider) => {
      try {
        await provider.destroy();
      } catch (error) {
        console.warn(`Failed to destroy provider '${provider.id}':`, error);
      }
    });

    await Promise.all(destroyPromises);
    this.providers.clear();
  }

  /**
   * Build context by merging default and runtime context
   */
  private buildContext(runtimeContext: Partial<ProviderContext>): ProviderContext {
    return {
      timestamp: new Date(),
      ...this.defaultContext,
      ...runtimeContext
    };
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EnhancedPromptManager is not initialized. Call initialize() first.');
    }
  }
}