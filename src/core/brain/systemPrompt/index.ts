/**
 * System Prompt Architecture - Main Exports
 * 
 * This module provides a complete plugin-based system prompt management solution
 * with backward compatibility for existing code.
 */

// Core interfaces and types
export * from './interfaces.js';

// Provider implementations
export * from './providers/index.js';

// Registry and configuration
export { providerRegistry, DefaultProviderRegistry } from './registry.js';
export { SystemPromptConfigManager } from './config-manager.js';
export * from './config-schemas.js';

// Built-in generators
export * from './built-in-generators.js';

// Enhanced manager
export { EnhancedPromptManager } from './enhanced-manager.js';

// Legacy compatibility
export { LegacyPromptManagerAdapter, PromptManagerMigration } from './legacy-adapter.js';

// Legacy manager (for backward compatibility)
export { PromptManager } from './manager.js';
export { getBuiltInInstructions } from './tool-instructions.js';