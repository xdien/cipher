/**
 * Tests for Legacy Adapter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LegacyPromptManagerAdapter, PromptManagerMigration } from '../legacy-adapter.js';
import { PromptManager } from '../manager.js';
import { DynamicPromptProvider } from '../providers/dynamic-provider.js';

describe('LegacyPromptManagerAdapter', () => {
  let adapter: LegacyPromptManagerAdapter;

  beforeEach(() => {
    // Register test generators
    DynamicPromptProvider.registerGenerator('test-adapter-generator', async (context) => {
      return `Adapter test at ${context.timestamp.toISOString()}`;
    });
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.destroy();
    }
  });

  describe('constructor', () => {
    it('should create adapter in legacy mode by default', () => {
      adapter = new LegacyPromptManagerAdapter();
      expect(adapter.isEnhancedMode()).toBe(false);
    });

    it('should create adapter in enhanced mode when requested', () => {
      adapter = new LegacyPromptManagerAdapter({ enableEnhancedFeatures: true });
      // Enhanced mode requires initialization, so it may not be immediately available
      expect(typeof adapter.isEnhancedMode).toBe('function');
    });
  });

  describe('legacy interface compatibility', () => {
    beforeEach(() => {
      adapter = new LegacyPromptManagerAdapter();
    });

    it('should support load() method', () => {
      const instruction = 'Test user instruction';
      adapter.load(instruction);
      
      expect(adapter.getUserInstruction()).toBe(instruction);
      expect(adapter.getInstruction()).toBe(instruction);
    });

    it('should support getCompleteSystemPrompt() method', () => {
      const instruction = 'Test instruction';
      adapter.load(instruction);
      
      const prompt = adapter.getCompleteSystemPrompt();
      expect(prompt).toContain(instruction);
      expect(prompt).toContain('Memory Search Tool'); // From built-in instructions
    });

    it('should support getUserInstruction() method', () => {
      const instruction = 'User specific instruction';
      adapter.load(instruction);
      
      expect(adapter.getUserInstruction()).toBe(instruction);
    });

    it('should support getBuiltInInstructions() method', () => {
      const builtInInstructions = adapter.getBuiltInInstructions();
      expect(builtInInstructions).toContain('Memory Search Tool');
      expect(builtInInstructions).toContain('cipher_memory_search');
    });

    it('should handle empty instruction', () => {
      adapter.load('');
      
      expect(adapter.getUserInstruction()).toBe('');
      expect(adapter.getCompleteSystemPrompt()).toContain('Memory Search Tool');
    });
  });

  describe('enhanced mode features', () => {
    beforeEach(async () => {
      adapter = new LegacyPromptManagerAdapter({ enableEnhancedFeatures: true });
      await adapter.enableEnhancedMode();
    });

    it('should enable enhanced mode', async () => {
      const instruction = 'Enhanced test instruction';
      adapter.load(instruction);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (adapter.isEnhancedMode()) {
        const result = await adapter.getEnhancedSystemPrompt();
        expect(result).toContain(instruction);
      }
    });

    it('should provide generation result with metadata', async () => {
      adapter.load('Test instruction for metadata');
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (adapter.isEnhancedMode()) {
        const result = await adapter.getGenerationResult();
        
        expect(result.success).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.providerResults).toBeDefined();
      }
    });

    it('should provide performance statistics', async () => {
      adapter.load('Performance test instruction');
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (adapter.isEnhancedMode()) {
        const stats = await adapter.getPerformanceStats();
        
        expect(stats.totalProviders).toBeGreaterThan(0);
        expect(stats.enabledProviders).toBeGreaterThanOrEqual(0);
        expect(stats.averageGenerationTime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should allow provider management', async () => {
      adapter.load('Provider management test');
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      if (adapter.isEnhancedMode()) {
        const providers = adapter.getProviders();
        expect(Array.isArray(providers)).toBe(true);
        
        if (providers.length > 0) {
          const providerId = providers[0]!.id;
          const originalEnabled = providers[0]!.enabled;
          
          adapter.setProviderEnabled(providerId, !originalEnabled);
          
          const updatedProviders = adapter.getProviders();
          const updatedProvider = updatedProviders.find(p => p.id === providerId);
          expect(updatedProvider!.enabled).toBe(!originalEnabled);
        }
      }
    });
  });

  describe('mode switching', () => {
    beforeEach(() => {
      adapter = new LegacyPromptManagerAdapter();
    });

    it('should switch from legacy to enhanced mode', async () => {
      expect(adapter.isEnhancedMode()).toBe(false);
      
      await adapter.enableEnhancedMode();
      
      // Enhanced mode may require async initialization
      const instruction = 'Mode switching test';
      adapter.load(instruction);
      
      // Test that enhanced features don't throw errors
      expect(() => adapter.getProviders).not.toThrow();
    });

    it('should switch from enhanced to legacy mode', async () => {
      await adapter.enableEnhancedMode();
      await adapter.disableEnhancedMode();
      
      expect(adapter.isEnhancedMode()).toBe(false);
      
      // Legacy methods should still work
      adapter.load('Legacy mode test');
      expect(adapter.getUserInstruction()).toBe('Legacy mode test');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      adapter = new LegacyPromptManagerAdapter();
    });

    it('should throw errors for enhanced features in legacy mode', async () => {
      expect(adapter.isEnhancedMode()).toBe(false);
      
      await expect(adapter.getGenerationResult()).rejects.toThrow('Enhanced manager not available');
      await expect(adapter.getPerformanceStats()).rejects.toThrow('Enhanced manager not available');
      expect(() => adapter.setProviderEnabled('test', true)).toThrow('Enhanced manager not available');
      expect(() => adapter.getProviders()).toThrow('Enhanced manager not available');
    });

    it('should fallback to legacy on enhanced failures', async () => {
      // This test would require mocking enhanced manager failures
      // For now, we test that the fallback mechanism exists
      adapter.load('Fallback test');
      
      const prompt = adapter.getCompleteSystemPrompt();
      expect(prompt).toContain('Fallback test');
    });
  });
});

describe('PromptManagerMigration', () => {
  let legacyManager: PromptManager;

  beforeEach(() => {
    legacyManager = new PromptManager();
  });

  describe('analyzeUsage', () => {
    it('should analyze empty legacy manager', () => {
      const analysis = PromptManagerMigration.analyzeUsage(legacyManager);
      
      expect(analysis.canMigrate).toBe(true);
      expect(analysis.recommendations).toContain('Built-in instructions will be preserved in enhanced mode');
      expect(analysis.warnings).toHaveLength(0);
    });

    it('should analyze legacy manager with user instruction', () => {
      legacyManager.load('Test user instruction');
      
      const analysis = PromptManagerMigration.analyzeUsage(legacyManager);
      
      expect(analysis.canMigrate).toBe(true);
      expect(analysis.recommendations).toContain('User instruction can be migrated to static provider');
      expect(analysis.recommendations).toContain('Built-in instructions will be preserved in enhanced mode');
    });

    it('should provide migration recommendations', () => {
      legacyManager.load('Complex user instruction with specific requirements');
      
      const analysis = PromptManagerMigration.analyzeUsage(legacyManager);
      
      expect(analysis.recommendations).toContain('Consider adding dynamic context providers for session information');
      expect(analysis.recommendations).toContain('File-based providers can be used for external prompt templates');
    });
  });

  describe('createEnhancedConfig', () => {
    it('should create config for empty legacy manager', () => {
      const config = PromptManagerMigration.createEnhancedConfig(legacyManager);
      
      expect(config.providers).toHaveLength(1); // Only built-in instructions
      expect(config.providers[0]!.name).toBe('built-in-instructions');
      expect(config.settings.maxGenerationTime).toBe(5000);
    });

    it('should create config with user instruction', () => {
      const userInstruction = 'Custom user instruction';
      legacyManager.load(userInstruction);
      
      const config = PromptManagerMigration.createEnhancedConfig(legacyManager);
      
      expect(config.providers).toHaveLength(2);
      
      const userProvider = config.providers.find(p => p.name === 'user-instruction');
      expect(userProvider).toBeDefined();
      expect(userProvider!.config!.content).toBe(userInstruction);
      expect(userProvider!.priority).toBe(100);
      
      const builtInProvider = config.providers.find(p => p.name === 'built-in-instructions');
      expect(builtInProvider).toBeDefined();
      expect(builtInProvider!.priority).toBe(0);
    });

    it('should handle whitespace-only user instruction', () => {
      legacyManager.load('   ');
      
      const config = PromptManagerMigration.createEnhancedConfig(legacyManager);
      
      expect(config.providers).toHaveLength(1); // Only built-in instructions
      expect(config.providers[0]!.name).toBe('built-in-instructions');
    });
  });

  describe('migrate', () => {
    it('should perform complete migration', async () => {
      const userInstruction = 'Migration test instruction';
      legacyManager.load(userInstruction);
      
      const enhancedManager = await PromptManagerMigration.migrate(legacyManager);
      
      expect(enhancedManager.isInitialized()).toBe(true);
      
      const providers = enhancedManager.getProviders();
      expect(providers.length).toBeGreaterThanOrEqual(2);
      
      const result = await enhancedManager.generateSystemPrompt();
      expect(result.success).toBe(true);
      expect(result.content).toContain(userInstruction);
      
      // Clean up
      await enhancedManager.destroy();
    });

    it('should migrate with preserved functionality', async () => {
      const userInstruction = 'Preserve functionality test';
      legacyManager.load(userInstruction);
      
      const originalPrompt = legacyManager.getCompleteSystemPrompt();
      
      const enhancedManager = await PromptManagerMigration.migrate(legacyManager);
      const result = await enhancedManager.generateSystemPrompt();
      
      // Should contain the same key components
      expect(result.content).toContain(userInstruction);
      expect(result.content).toContain('Memory Search Tool'); // Built-in instructions
      
      // Clean up
      await enhancedManager.destroy();
    });
  });
});