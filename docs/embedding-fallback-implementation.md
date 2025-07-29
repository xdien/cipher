# Embedding Fallback Implementation Guide

This document provides a detailed guide on how to implement the LLM-provider-based embedding fallback mechanism for new providers in the Cipher system.

## Overview

The Cipher system implements a sophisticated embedding fallback mechanism that:

1. **Strict Disable**: When embeddings are explicitly disabled, they are completely unavailable with no fallback
2. **LLM-Provider Fallback**: When no embedding configuration is provided, the system uses the same provider as the LLM with a default embedding model
3. **Tool Exclusion**: When embeddings are disabled, all embedding-dependent tools are excluded from registration

## Current Implementation

### Supported Providers

The current implementation supports fallback for these providers:

| LLM Provider | Default Embedding Model | API Key Required |
|--------------|-------------------------|------------------|
| OpenAI       | `text-embedding-3-small` | Yes (OPENAI_API_KEY) |
| Ollama       | `nomic-embed-text`      | No (uses baseUrl) |
| Gemini       | `gemini-embedding-001`  | Yes (GEMINI_API_KEY) |

### Architecture

The embedding fallback is implemented in several key components:

1. **Service Initializer** (`src/core/utils/service-initializer.ts`)
   - Detects embedding configuration status
   - Implements fallback logic via `createEmbeddingFromLLMProvider()`
   - Passes embedding status to tool registration

2. **Tool Registration** (`src/core/brain/tools/definitions/index.ts`)
   - Accepts `embeddingEnabled` parameter
   - Excludes embedding-dependent tools when disabled

3. **Memory Tools** (`src/core/brain/tools/definitions/memory/index.ts`)
   - Returns empty tool set when embeddings disabled
   - Logs warning about excluded tools

## Implementation Guide for New Providers

### Step 1: Add Embedding Provider Support

First, ensure your provider has embedding support in the embedding system:

```typescript
// src/core/brain/embedding/backend/your-provider.ts
export class YourProviderEmbedder implements Embedder {
  // Implementation details...
}
```

### Step 2: Add LLM Provider Support

Ensure your LLM provider is implemented:

```typescript
// src/core/brain/llm/services/your-provider.ts
export class YourProviderService implements ILLMService {
  // Implementation details...
}
```

### Step 3: Add to Embedding Configuration

Update the embedding configuration to support your provider:

```typescript
// src/core/brain/embedding/config.ts
export const YourProviderEmbeddingConfigSchema = z.discriminatedUnion('type', [
  // ... existing providers
  z.object({
    type: z.literal('your-provider'),
    apiKey: z.string().min(1),
    model: z.string().optional().default('your-default-embedding-model'),
    // Add provider-specific options
  }),
]);
```

### Step 4: Update Service Initializer

Add your provider to the `createEmbeddingFromLLMProvider` function:

```typescript
// src/core/utils/service-initializer.ts
async function createEmbeddingFromLLMProvider(
  embeddingManager: EmbeddingManager, 
  llmConfig: any
): Promise<{ embedder: any; info: any } | null> {
  const provider = llmConfig.provider?.toLowerCase();
  
  try {
    switch (provider) {
      // ... existing cases
      case 'your-provider': {
        // Check for required credentials
        if (!llmConfig.apiKey && !process.env.YOUR_PROVIDER_API_KEY) {
          logger.debug('No Your Provider API key available for embedding fallback');
          return null;
        }
        
        const embeddingConfig = {
          type: 'your-provider',
          apiKey: llmConfig.apiKey || process.env.YOUR_PROVIDER_API_KEY,
          model: 'your-default-embedding-model', // Choose appropriate default
          // Add any other required configuration
        };
        
        logger.info('Using Your Provider embedding fallback: your-default-embedding-model');
        return await embeddingManager.createEmbedderFromConfig(embeddingConfig, 'default');
      }
      // ... rest of cases
    }
  } catch (error) {
    // Error handling...
  }
}
```

### Step 5: Update LLM Factory

Add your provider to the LLM service factory:

```typescript
// src/core/brain/llm/services/factory.ts
import { YourProviderService } from './your-provider.js';

// In _createLLMService function:
case 'your-provider': {
  return new YourProviderService(
    apiKey,
    config.model,
    mcpManager,
    contextManager,
    config.maxIterations,
    unifiedToolManager
  );
}
```

### Step 6: Add Context Window Configuration

Add context window defaults for your provider:

```typescript
// src/core/brain/llm/services/factory.ts - in getDefaultContextWindow()
function getDefaultContextWindow(provider: string, model?: string): number {
  const defaults: Record<string, Record<string, number>> = {
    // ... existing providers
    'your-provider': {
      'model-name-1': 32000,
      'model-name-2': 128000,
      default: 32000,
    },
  };
  // ... rest of function
}
```

### Step 7: Update Configuration Schema

Add your provider to the LLM configuration schema:

```typescript
// src/core/brain/llm/config.ts
provider: z
  .string()
  .nonempty()
  .describe(
    "The LLM provider (e.g., 'openai', 'anthropic', 'openrouter', 'ollama', 'qwen', 'aws', 'azure', 'gemini', 'your-provider')"
  ),
```

## Provider-Specific Considerations

### API Key Management

Different providers handle authentication differently:

1. **API Key Based** (OpenAI, Gemini, Anthropic):
   ```typescript
   if (!llmConfig.apiKey && !process.env.PROVIDER_API_KEY) {
     logger.debug('No Provider API key available for embedding fallback');
     return null;
   }
   ```

2. **URL Based** (Ollama):
   ```typescript
   const baseUrl = llmConfig.baseUrl || process.env.PROVIDER_BASE_URL || 'http://localhost:11434';
   ```

3. **Complex Auth** (AWS, Azure):
   - May require special handling
   - Consider if embedding fallback is appropriate

### Default Model Selection

Choose appropriate default embedding models:

1. **Performance**: Balance between speed and quality
2. **Availability**: Ensure the model is commonly available
3. **Dimensions**: Consider compatibility with existing vector stores
4. **Cost**: For paid services, consider cost implications

### Error Handling

Implement robust error handling:

```typescript
try {
  return await embeddingManager.createEmbedderFromConfig(embeddingConfig, 'default');
} catch (error) {
  logger.warn(`Failed to create embedding from LLM provider ${provider}`, {
    error: error instanceof Error ? error.message : String(error)
  });
  return null;
}
```

## Testing

### Unit Tests

Create unit tests for your provider implementation:

```typescript
// src/core/utils/__test__/service-initializer.test.ts
describe('createEmbeddingFromLLMProvider', () => {
  it('should create YourProvider embedding from LLM config', async () => {
    const llmConfig = {
      provider: 'your-provider',
      apiKey: 'test-key',
      model: 'your-model'
    };
    
    const result = await createEmbeddingFromLLMProvider(mockEmbeddingManager, llmConfig);
    expect(result).toBeTruthy();
  });
});
```

### Integration Tests

Test the complete fallback mechanism:

```typescript
// Test embedding disable
// Test fallback behavior
// Test tool exclusion
```

## Configuration Examples

### YAML Configuration

```yaml
# Complete embedding configuration (no fallback needed)
llm:
  provider: your-provider
  model: your-llm-model
  apiKey: $YOUR_PROVIDER_API_KEY

embedding:
  type: your-provider
  apiKey: $YOUR_PROVIDER_API_KEY
  model: your-embedding-model

# Fallback configuration (uses LLM provider)
llm:
  provider: your-provider
  model: your-llm-model
  apiKey: $YOUR_PROVIDER_API_KEY
# embedding: not specified - will fallback to your-provider with default model

# Strictly disabled
llm:
  provider: your-provider
  model: your-llm-model
  apiKey: $YOUR_PROVIDER_API_KEY

embedding: false  # or null, or set DISABLE_EMBEDDINGS=true
```

### Environment Variables

```bash
# Provider credentials
YOUR_PROVIDER_API_KEY=your-api-key-here

# Explicit embedding disable
DISABLE_EMBEDDINGS=true
# or
EMBEDDING_DISABLED=true
```

## Best Practices

1. **Graceful Degradation**: Always handle cases where embedding creation fails
2. **Clear Logging**: Provide informative log messages about fallback decisions
3. **Performance**: Consider the performance characteristics of default embedding models
4. **Documentation**: Update configuration documentation when adding new providers
5. **Backwards Compatibility**: Ensure changes don't break existing configurations

## Troubleshooting

### Common Issues

1. **Missing API Keys**: Ensure environment variables are properly set
2. **Network Issues**: Handle network failures gracefully
3. **Model Availability**: Verify default embedding models are available
4. **Configuration Errors**: Validate configuration before attempting to create embedders

### Debugging

Enable debug logging to trace the fallback mechanism:

```typescript
logger.debug('Embedding fallback decision', {
  embeddingConfigExists: !!config.embedding,
  llmProvider: config.llm?.provider,
  explicitlyDisabled: /* check logic */
});
```

## Future Enhancements

Potential improvements to the fallback mechanism:

1. **Provider Compatibility Matrix**: More intelligent fallback based on provider capabilities
2. **Performance-Based Selection**: Choose embedding models based on performance requirements
3. **Cost Optimization**: Factor in cost when selecting default models
4. **Multi-Provider Fallback**: Cascade through multiple providers if primary fails
5. **Dynamic Model Selection**: Select embedding models based on LLM model characteristics

---

This implementation guide should help you add embedding fallback support for any new LLM provider in the Cipher system.