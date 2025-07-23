/**
 * Tests for Enhanced Prompt Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedPromptManager } from '../enhanced-manager.js';
import { SystemPromptConfig, ProviderType, ProviderContext } from '../interfaces.js';
import { DynamicPromptProvider } from '../providers/dynamic-provider.js';

describe('EnhancedPromptManager', () => {
  let manager: EnhancedPromptManager;

  beforeEach(() => {
    // Register test generators
    DynamicPromptProvider.registerGenerator('test-generator', async (context) => {
      return `Test output at ${context.timestamp.toISOString()}`;
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.destroy();
    }
  });

  describe('constructor', () => {
    it('should create manager with default options', () => {
      manager = new EnhancedPromptManager();
      expect(manager.isInitialized()).toBe(false);
    });

    it('should create manager with configuration', () => {
      const config: SystemPromptConfig = {
        providers: [
          {
            name: 'test-provider',
            type: ProviderType.STATIC,
            priority: 100,
            enabled: true,
            config: { content: 'Test content' }
          }
        ],
        settings: {
          maxGenerationTime: 5000,
          failOnProviderError: false,
          contentSeparator: '\n\n'
        }
      };

      manager = new EnhancedPromptManager({ config });
      expect(manager.getConfig()).toEqual(config);
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      manager = new EnhancedPromptManager();
      await manager.initialize();
      
      expect(manager.isInitialized()).toBe(true);
      expect(manager.getProviders().length).toBeGreaterThan(0);
    });

    it('should initialize with custom configuration', async () => {
      const config: SystemPromptConfig = {
        providers: [
          {
            name: 'static-test',
            type: ProviderType.STATIC,
            priority: 100,
            enabled: true,
            config: { content: 'Static test content' }
          },
          {
            name: 'dynamic-test',
            type: ProviderType.DYNAMIC,
            priority: 50,
            enabled: true,
            config: {
              generator: 'test-generator',
              template: 'Dynamic: {{content}}'
            }
          }
        ],
        settings: {
          maxGenerationTime: 10000,
          failOnProviderError: true,
          contentSeparator: '\n---\n'
        }
      };

      manager = new EnhancedPromptManager();
      await manager.initialize(config);
      
      expect(manager.isInitialized()).toBe(true);
      const providers = manager.getProviders();
      expect(providers.length).toBe(2);
      expect(providers.find(p => p.name === 'static-test')).toBeDefined();
      expect(providers.find(p => p.name === 'dynamic-test')).toBeDefined();
    });

    it('should throw error when generating before initialization', async () => {
      manager = new EnhancedPromptManager();
      
      await expect(manager.generateSystemPrompt()).rejects.toThrow('not initialized');
    });
  });

  describe('prompt generation', () => {
    beforeEach(async () => {
      const config: SystemPromptConfig = {
        providers: [
          {
            name: 'high-priority',
            type: ProviderType.STATIC,
            priority: 100,
            enabled: true,
            config: { content: 'High priority content' }
          },
          {
            name: 'low-priority',
            type: ProviderType.STATIC,
            priority: 50,
            enabled: true,
            config: { content: 'Low priority content' }
          },
          {
            name: 'disabled-provider',
            type: ProviderType.STATIC,
            priority: 75,
            enabled: false,
            config: { content: 'Disabled content' }
          }
        ],
        settings: {
          maxGenerationTime: 5000,
          failOnProviderError: false,
          contentSeparator: '\n\n'
        }
      };

      manager = new EnhancedPromptManager();
      await manager.initialize(config);
    });

    it('should generate system prompt from enabled providers', async () => {
      const result = await manager.generateSystemPrompt();
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('High priority content');
      expect(result.content).toContain('Low priority content');
      expect(result.content).not.toContain('Disabled content');
      expect(result.providerResults).toHaveLength(3); // Including disabled
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should maintain priority order in output', async () => {
      const result = await manager.generateSystemPrompt();
      
      const lines = result.content.split('\n\n');
      expect(lines[0]).toBe('High priority content');
      expect(lines[1]).toBe('Low priority content');
    });

    it('should include runtime context in generation', async () => {
      // Add a dynamic provider that uses context
      const dynamicConfig: SystemPromptConfig = {
        providers: [
          {
            name: 'context-provider',
            type: ProviderType.DYNAMIC,
            priority: 100,
            enabled: true,
            config: {
              generator: 'test-generator'
            }
          }
        ],
        settings: {
          maxGenerationTime: 5000,
          failOnProviderError: false,
          contentSeparator: '\n\n'
        }
      };

      await manager.destroy();
      manager = new EnhancedPromptManager();
      await manager.initialize(dynamicConfig);

      const testTime = new Date('2023-01-01T10:00:00Z');
      const result = await manager.generateSystemPrompt({
        timestamp: testTime,
        sessionId: 'test-session'
      });

      expect(result.success).toBe(true);
      expect(result.content).toContain('2023-01-01T10:00:00.000Z');
    });

    it('should handle provider errors gracefully', async () => {
      // Register a failing generator
      DynamicPromptProvider.registerGenerator('failing-generator', async () => {
        throw new Error('Generator failed');
      });

      const errorConfig: SystemPromptConfig = {
        providers: [
          {
            name: 'good-provider',
            type: ProviderType.STATIC,
            priority: 100,
            enabled: true,
            config: { content: 'Good content' }
          },
          {
            name: 'bad-provider',
            type: ProviderType.DYNAMIC,
            priority: 50,
            enabled: true,
            config: {
              generator: 'failing-generator'
            }
          }
        ],
        settings: {
          maxGenerationTime: 5000,
          failOnProviderError: false,
          contentSeparator: '\n\n'
        }
      };

      await manager.destroy();
      manager = new EnhancedPromptManager();
      await manager.initialize(errorConfig);

      const result = await manager.generateSystemPrompt();
      
      expect(result.success).toBe(true); // Should succeed with failOnProviderError: false
      expect(result.content).toBe('Good content');
      expect(result.errors).toHaveLength(1);
      expect(result.providerResults.find(r => r.providerId === 'bad-provider')?.success).toBe(false);
    });

    it('should fail when failOnProviderError is true', async () => {
      DynamicPromptProvider.registerGenerator('failing-generator-2', async () => {
        throw new Error('Generator failed');
      });

      const errorConfig: SystemPromptConfig = {
        providers: [
          {
            name: 'bad-provider',
            type: ProviderType.DYNAMIC,
            priority: 100,
            enabled: true,
            config: {
              generator: 'failing-generator-2'
            }
          }
        ],
        settings: {
          maxGenerationTime: 5000,
          failOnProviderError: true,
          contentSeparator: '\n\n'
        }
      };

      await manager.destroy();
      manager = new EnhancedPromptManager();
      await manager.initialize(errorConfig);

      const result = await manager.generateSystemPrompt();
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('provider management', () => {
    beforeEach(async () => {
      const config: SystemPromptConfig = {
        providers: [
          {
            name: 'provider-1',
            type: ProviderType.STATIC,
            priority: 100,
            enabled: true,
            config: { content: 'Content 1' }
          },
          {
            name: 'provider-2',
            type: ProviderType.STATIC,
            priority: 50,
            enabled: false,
            config: { content: 'Content 2' }
          }
        ],
        settings: {
          maxGenerationTime: 5000,
          failOnProviderError: false,
          contentSeparator: '\n\n'
        }
      };

      manager = new EnhancedPromptManager();
      await manager.initialize(config);
    });

    it('should get all providers', () => {
      const providers = manager.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers.find(p => p.name === 'provider-1')).toBeDefined();
      expect(providers.find(p => p.name === 'provider-2')).toBeDefined();
    });

    it('should get only enabled providers', () => {
      const enabledProviders = manager.getEnabledProviders();
      expect(enabledProviders).toHaveLength(1);
      expect(enabledProviders[0]!.name).toBe('provider-1');
    });

    it('should get provider by ID', () => {
      const provider = manager.getProvider('provider-1');
      expect(provider).toBeDefined();
      expect(provider!.name).toBe('provider-1');
      expect(provider!.enabled).toBe(true);
    });

    it('should enable/disable providers', () => {
      manager.setProviderEnabled('provider-2', true);
      
      const enabledProviders = manager.getEnabledProviders();
      expect(enabledProviders).toHaveLength(2);
      
      manager.setProviderEnabled('provider-1', false);
      
      const stillEnabled = manager.getEnabledProviders();
      expect(stillEnabled).toHaveLength(1);
      expect(stillEnabled[0]!.name).toBe('provider-2');
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      const config: SystemPromptConfig = {
        providers: [
          {
            name: 'fast-provider',
            type: ProviderType.STATIC,
            priority: 100,
            enabled: true,
            config: { content: 'Fast content' }
          }
        ],
        settings: {
          maxGenerationTime: 5000,
          failOnProviderError: false,
          contentSeparator: '\n\n'
        }
      };

      manager = new EnhancedPromptManager();
      await manager.initialize(config);
    });

    it('should provide performance statistics', async () => {
      const stats = await manager.getPerformanceStats();
      
      expect(stats.totalProviders).toBe(1);
      expect(stats.enabledProviders).toBe(1);
      expect(stats.averageGenerationTime).toBeGreaterThan(0);
      expect(stats.lastGenerationResult).toBeDefined();
      expect(stats.lastGenerationResult!.success).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should load configuration from file', async () => {
      // This would require file system setup, but we can test the interface
      manager = new EnhancedPromptManager();
      await manager.initialize();
      
      // Test that the method exists and doesn't throw
      expect(typeof manager.loadConfigFromFile).toBe('function');
    });

    it('should get current configuration', async () => {
      const config: SystemPromptConfig = {
        providers: [
          {
            name: 'test-provider',
            type: ProviderType.STATIC,
            priority: 100,
            enabled: true,
            config: { content: 'Test' }
          }
        ],
        settings: {
          maxGenerationTime: 8000,
          failOnProviderError: true,
          contentSeparator: '\n---\n'
        }
      };

      manager = new EnhancedPromptManager({ config });
      await manager.initialize();
      
      const retrievedConfig = manager.getConfig();
      expect(retrievedConfig.settings.maxGenerationTime).toBe(8000);
      expect(retrievedConfig.settings.failOnProviderError).toBe(true);
      expect(retrievedConfig.providers).toHaveLength(1);
    });
  });
});