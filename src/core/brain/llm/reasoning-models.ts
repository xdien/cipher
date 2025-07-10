/**
 * LLM Reasoning Models Registry
 * 
 * Maintains a registry of LLM models that support reasoning/thinking capabilities.
 * These models have access to reflection memory tools for self-improvement.
 * 
 * Based on: https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking#supported-models
 */

export interface ReasoningModelInfo {
  provider: string;
  model: string;
  supportsReasoning: boolean;
  reasoningType: 'extended' | 'standard';
  description?: string;
}

/**
 * Registry of reasoning-capable models
 */
export const REASONING_MODELS: ReasoningModelInfo[] = [
  // Anthropic reasoning models with extended thinking
  {
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    supportsReasoning: true,
    reasoningType: 'extended',
    description: 'Claude Opus 4 with extended thinking capabilities'
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    supportsReasoning: true,
    reasoningType: 'extended',
    description: 'Claude Sonnet 4 with extended thinking capabilities'
  },
  {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet-20250219',
    supportsReasoning: true,
    reasoningType: 'extended',
    description: 'Claude Sonnet 3.7 with extended thinking capabilities'
  }
];

/**
 * Check if a given LLM model supports reasoning
 */
export function isReasoningModel(provider: string, model: string): boolean {
  return REASONING_MODELS.some(
    entry => entry.provider.toLowerCase() === provider.toLowerCase() && 
             entry.model.toLowerCase() === model.toLowerCase() &&
             entry.supportsReasoning
  );
}

/**
 * Get reasoning model info
 */
export function getReasoningModelInfo(provider: string, model: string): ReasoningModelInfo | null {
  return REASONING_MODELS.find(
    entry => entry.provider.toLowerCase() === provider.toLowerCase() && 
             entry.model.toLowerCase() === model.toLowerCase() &&
             entry.supportsReasoning
  ) || null;
}

/**
 * Get all reasoning models for a provider
 */
export function getReasoningModelsByProvider(provider: string): ReasoningModelInfo[] {
  return REASONING_MODELS.filter(
    entry => entry.provider.toLowerCase() === provider.toLowerCase() &&
             entry.supportsReasoning
  );
}

/**
 * Check if reflection memory should be enabled for this model
 */
export function shouldEnableReflectionMemory(provider: string, model: string): boolean {
  return isReasoningModel(provider, model);
} 