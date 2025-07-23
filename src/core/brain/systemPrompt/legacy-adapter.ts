/**
 * Legacy Adapter
 * 
 * Provides backward compatibility with the existing PromptManager interface.
 * This adapter allows existing code to continue working while providing
 * access to the new enhanced functionality.
 */

import { PromptManager } from './manager.js';
import { EnhancedPromptManager } from './enhanced-manager.js';
import { SystemPromptConfig, ProviderType } from './interfaces.js';
import { getBuiltInInstructions } from './tool-instructions.js';

export interface LegacyAdapterOptions {
  /** Whether to use enhanced features when available */
  enableEnhancedFeatures?: boolean;
  /** Additional context for enhanced mode */
  enhancedContext?: Record<string, any>;
}

/**
 * Adapter that provides the legacy PromptManager interface while
 * optionally using the enhanced manager underneath
 */
export class LegacyPromptManagerAdapter {
  private legacyManager: PromptManager;
  private enhancedManager: EnhancedPromptManager | undefined;
  private useEnhanced: boolean;
  private userInstruction: string = '';

  constructor(options: LegacyAdapterOptions = {}) {
    this.legacyManager = new PromptManager();
    this.useEnhanced = options.enableEnhancedFeatures || false;

    if (this.useEnhanced) {
      this.initializeEnhancedManager(options.enhancedContext);
    }
  }

  /**
   * Load user instruction (legacy interface)
   */
  public load(instruction: string): void {
    this.userInstruction = instruction;
    this.legacyManager.load(instruction);

    if (this.enhancedManager) {
      // Convert legacy instruction to enhanced configuration
      const config = this.createEnhancedConfig(instruction);
      this.enhancedManager.initialize(config).catch(error => {
        console.warn('Failed to initialize enhanced manager:', error);
        this.useEnhanced = false;
      });
    }
  }

  /**
   * Get the complete system prompt (legacy interface)
   */
  public getCompleteSystemPrompt(): string {
    if (this.useEnhanced && this.enhancedManager?.isInitialized()) {
      // Use enhanced manager - but this is async, so we need to handle it differently
      // For backward compatibility, we fall back to legacy for synchronous calls
      console.warn('Enhanced manager requires async calls. Use getEnhancedSystemPrompt() for enhanced features.');
    }

    // Fall back to legacy manager
    return this.legacyManager.getCompleteSystemPrompt();
  }

  /**
   * Get user instruction only (legacy interface)
   */
  public getUserInstruction(): string {
    return this.userInstruction;
  }

  /**
   * Get built-in instructions only (legacy interface)
   */
  public getBuiltInInstructions(): string {
    return this.legacyManager.getBuiltInInstructions();
  }

  /**
   * Get the instruction (legacy interface - alias for getUserInstruction)
   */
  public getInstruction(): string {
    return this.getUserInstruction();
  }

  /**
   * Enhanced feature: Get generation result with metadata
   */
  public async getEnhancedSystemPrompt(context?: Record<string, any>) {
    if (!this.enhancedManager?.isInitialized()) {
      throw new Error('Enhanced manager not available or not initialized');
    }

    const result = await this.enhancedManager.generateSystemPrompt(context);
    
    if (!result.success) {
      console.warn('Enhanced prompt generation failed, falling back to legacy');
      return this.legacyManager.getCompleteSystemPrompt();
    }

    return result.content;
  }

  /**
   * Enhanced feature: Get detailed generation result
   */
  public async getGenerationResult(context?: Record<string, any>) {
    if (!this.enhancedManager?.isInitialized()) {
      throw new Error('Enhanced manager not available or not initialized');
    }

    return await this.enhancedManager.generateSystemPrompt(context);
  }

  /**
   * Enhanced feature: Get performance statistics
   */
  public async getPerformanceStats() {
    if (!this.enhancedManager?.isInitialized()) {
      throw new Error('Enhanced manager not available or not initialized');
    }

    return await this.enhancedManager.getPerformanceStats();
  }

  /**
   * Enhanced feature: Enable/disable providers
   */
  public setProviderEnabled(providerId: string, enabled: boolean): void {
    if (!this.enhancedManager?.isInitialized()) {
      throw new Error('Enhanced manager not available or not initialized');
    }

    this.enhancedManager.setProviderEnabled(providerId, enabled);
  }

  /**
   * Enhanced feature: Get provider information
   */
  public getProviders() {
    if (!this.enhancedManager?.isInitialized()) {
      throw new Error('Enhanced manager not available or not initialized');
    }

    return this.enhancedManager.getProviders().map(provider => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      priority: provider.priority,
      enabled: provider.enabled
    }));
  }

  /**
   * Check if enhanced features are available
   */
  public isEnhancedMode(): boolean {
    return this.useEnhanced && this.enhancedManager?.isInitialized() || false;
  }

  /**
   * Switch to enhanced mode (if not already enabled)
   */
  public async enableEnhancedMode(context?: Record<string, any>): Promise<void> {
    if (this.useEnhanced) {
      return; // Already enabled
    }

    this.useEnhanced = true;
    await this.initializeEnhancedManager(context);
    
    // Re-initialize with current user instruction
    if (this.userInstruction) {
      const config = this.createEnhancedConfig(this.userInstruction);
      await this.enhancedManager!.initialize(config);
    }
  }

  /**
   * Switch to legacy mode
   */
  public async disableEnhancedMode(): Promise<void> {
    if (!this.useEnhanced) {
      return; // Already disabled
    }

    this.useEnhanced = false;
    
    if (this.enhancedManager) {
      await this.enhancedManager.destroy();
      this.enhancedManager = undefined;
    }
  }

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    if (this.enhancedManager) {
      await this.enhancedManager.destroy();
    }
  }

  /**
   * Initialize enhanced manager
   */
  private async initializeEnhancedManager(context?: Record<string, any>): Promise<void> {
    this.enhancedManager = new EnhancedPromptManager({
      registerBuiltInGenerators: true,
      ...(context && { defaultContext: context })
    });

    if (this.userInstruction) {
      const config = this.createEnhancedConfig(this.userInstruction);
      await this.enhancedManager.initialize(config);
    }
  }

  /**
   * Convert legacy instruction to enhanced configuration
   */
  private createEnhancedConfig(instruction: string): SystemPromptConfig {
    return {
      providers: [
        {
          name: 'user-instruction',
          type: ProviderType.STATIC,
          priority: 100,
          enabled: true,
          config: {
            content: instruction
          }
        },
        {
          name: 'built-in-instructions',
          type: ProviderType.STATIC,
          priority: 0,
          enabled: true,
          config: {
            content: getBuiltInInstructions()
          }
        }
      ],
      settings: {
        maxGenerationTime: 5000,
        failOnProviderError: false,
        contentSeparator: '\n\n'
      }
    };
  }
}

/**
 * Migration utilities for upgrading from legacy to enhanced manager
 */
export class PromptManagerMigration {
  /**
   * Analyze current usage and recommend migration strategy
   */
  public static analyzeUsage(legacyManager: PromptManager): {
    canMigrate: boolean;
    recommendations: string[];
    warnings: string[];
  } {
    const recommendations: string[] = [];
    const warnings: string[] = [];
    let canMigrate = true;

    try {
      // Check if manager has user instruction
      const userInstruction = legacyManager.getUserInstruction();
      if (userInstruction) {
        recommendations.push('User instruction can be migrated to static provider');
      }

      // Check if built-in instructions are being used
      const builtInInstructions = legacyManager.getBuiltInInstructions();
      if (builtInInstructions) {
        recommendations.push('Built-in instructions will be preserved in enhanced mode');
      }

      recommendations.push('Consider adding dynamic context providers for session information');
      recommendations.push('File-based providers can be used for external prompt templates');

    } catch (error) {
      warnings.push(`Error analyzing legacy manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
      canMigrate = false;
    }

    return {
      canMigrate,
      recommendations,
      warnings
    };
  }

  /**
   * Create enhanced configuration from legacy manager
   */
  public static createEnhancedConfig(legacyManager: PromptManager): SystemPromptConfig {
    const userInstruction = legacyManager.getUserInstruction();
    
    const providers = [];

    // Add user instruction if present
    if (userInstruction && userInstruction.trim()) {
      providers.push({
        name: 'user-instruction',
        type: ProviderType.STATIC,
        priority: 100,
        enabled: true,
        config: {
          content: userInstruction
        }
      });
    }

    // Add built-in instructions
    providers.push({
      name: 'built-in-instructions',
      type: ProviderType.STATIC,
      priority: 0,
      enabled: true,
      config: {
        content: getBuiltInInstructions()
      }
    });

    return {
      providers,
      settings: {
        maxGenerationTime: 5000,
        failOnProviderError: false,
        contentSeparator: '\n\n'
      }
    };
  }

  /**
   * Perform migration from legacy to enhanced manager
   */
  public static async migrate(legacyManager: PromptManager): Promise<EnhancedPromptManager> {
    const config = this.createEnhancedConfig(legacyManager);
    
    const enhancedManager = new EnhancedPromptManager({
      config,
      registerBuiltInGenerators: true
    });

    await enhancedManager.initialize();
    
    return enhancedManager;
  }
}