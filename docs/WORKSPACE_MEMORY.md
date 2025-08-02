# Workspace Memory System

The workspace memory system is an optional memory type for the Cipher project that focuses on team collaboration, project progress tracking, and shared workspace context. Unlike the default knowledge and reflection memory systems that focus on technical knowledge and reasoning patterns, workspace memory is designed to capture and organize information about team activities, project status, and collaborative work.

## Overview

Workspace memory provides specialized tools and data structures for:
- **Team Collaboration**: Track team member activities, assignments, and contributions
- **Project Progress**: Monitor feature development, milestone completion, and project status
- **Bug Tracking**: Maintain context about issues, fixes, and resolution status
- **Work Context**: Capture repository information, branch details, and deployment status
- **Cross-team Knowledge**: Share information across different domains (frontend, backend, devops, etc.)

## Key Features

### 1. Environment Variable Controls
- `USE_WORKSPACE_MEMORY=true` - enables workspace memory system
- `DISABLE_DEFAULT_MEMORY=true` - when workspace memory is enabled, disables existing memory (knowledge & reflection)
- `WORKSPACE_VECTOR_STORE_TYPE` - allows different vector store type for workspace memory
- `WORKSPACE_VECTOR_STORE_COLLECTION=workspace_memory` - collection name for workspace memory

### 2. Two New Tools

#### `cipher_workspace_search`
- Searches workspace memory for team and project information
- Supports filtering by domain, team member, project, and status
- Returns workspace-specific context including team assignments, progress updates, and collaboration history

#### `cipher_workspace_store` 
- Background tool that automatically stores team-related information
- Uses intelligent filtering to identify workspace-relevant content
- Extracts structured information from natural language descriptions

### 3. Workspace Payload Structure
```typescript
interface WorkspacePayload {
  // Base fields
  id: string | number;
  text: string;
  tags: string[];
  timestamp: string;

  // Workspace-specific fields
  teamMember?: string;           // Name/ID of team member
  currentProgress?: {
    feature: string;             // Feature being worked on
    status: 'in-progress' | 'completed' | 'blocked' | 'reviewing';
    completion?: number;         // 0-100 percentage
  };

  bugsEncountered?: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in-progress' | 'fixed';
  }>;

  workContext?: {
    project?: string;            // Project identifier
    repository?: string;         // Git repo if relevant
    branch?: string;             // Current working branch
  };

  confidence: number;            // 0-1, confidence in information accuracy
  event: 'ADD' | 'UPDATE' | 'DELETE' | 'NONE';
  domain?: string;               // e.g., 'frontend', 'backend', 'devops'
}
```

## Configuration

### Environment Variables

```bash
# Enable workspace memory
USE_WORKSPACE_MEMORY=true

# Disable default memory (optional - enables workspace-only mode)
DISABLE_DEFAULT_MEMORY=true

# Workspace vector store configuration
WORKSPACE_VECTOR_STORE_TYPE=in-memory
WORKSPACE_VECTOR_STORE_COLLECTION=workspace_memory
```

### YAML Configuration

Create a `workspace-memory.yml` configuration file:

```yaml
enabled: true
disable_default_memory: true

tools:
  search:
    similarity_threshold: 0.7
    max_results: 10
    timeout_ms: 15000
  
  store:
    auto_extraction: true
    confidence_threshold: 0.6
    batch_processing: true

behavior:
  search_triggers:
    keywords: ["team", "project", "progress", "feature", "bug"]
    patterns: ["who.*working.*on", "what.*status.*of"]
  
  store_triggers:
    keywords: ["completed", "working on", "implemented", "fixed"]
    patterns: [".*completed.*feature", ".*working.*on.*task"]

vector_store:
  collection_name: "workspace_memory"
  similarity_threshold: 0.7
  max_results: 10
```

## Usage Examples

### Storing Workspace Information

The workspace store tool automatically captures team-related information:

```javascript
// These types of content are automatically detected and stored:

"John is working on the user authentication feature and it's 75% complete."
// Extracts: teamMember="John", progress={feature="user authentication", status="in-progress", completion=75}

"Sarah fixed a critical bug in the payment processing module."  
// Extracts: teamMember="Sarah", bugs=[{description="payment processing", severity="critical", status="fixed"}]

"Deployed version 2.1.0 to staging environment. Repository: github.com/company/app"
// Extracts: workContext={repository="company/app"}, domain="devops"
```

### Searching Workspace Memory

```javascript
// Search for team activities
await cipher_workspace_search({
  query: "What is John working on?",
  filters: { team_member: "John" }
});

// Search for project status
await cipher_workspace_search({
  query: "Status of authentication feature",
  filters: { status: "in-progress" }
});

// Search for recent bug fixes
await cipher_workspace_search({
  query: "Recent bug fixes",
  filters: { domain: "backend" }
});
```

## Integration with Tool Management

### Memory Mode Selection

When workspace memory is enabled, the system can operate in different modes:

1. **Workspace-only Mode**: `DISABLE_DEFAULT_MEMORY=true`
   - Only workspace tools are available
   - Focuses exclusively on team collaboration
   - Ideal for dedicated project management scenarios

2. **Hybrid Mode**: `DISABLE_DEFAULT_MEMORY=false` 
   - Both workspace and default memory tools are available
   - Provides comprehensive knowledge management
   - Suitable for development teams needing both technical and collaborative context

### Tool Registration

The workspace memory tools are automatically registered when enabled:

```javascript
// Tools are dynamically loaded based on configuration
const tools = await getMemoryTools({ embeddingEnabled: true });

// Available tools when workspace memory is enabled:
// - cipher_workspace_search (if USE_WORKSPACE_MEMORY=true)
// - cipher_workspace_store (if USE_WORKSPACE_MEMORY=true)
// - cipher_extract_and_operate_memory (if DISABLE_DEFAULT_MEMORY=false)
// - cipher_memory_search (if DISABLE_DEFAULT_MEMORY=false)
```

## Information Extraction

The workspace system uses intelligent pattern matching to extract structured information:

### Team Member Detection
- `@username` mentions
- "John is working on..."
- "assigned to Sarah"
- "developer Mike completed..."

### Progress Tracking
- Percentage completion: "75% complete"
- Status keywords: "completed", "in-progress", "blocked", "reviewing"
- Feature descriptions: "working on authentication feature"

### Bug Information
- Bug reports: "bug in payment module"
- Severity levels: "critical", "high", "medium", "low"
- Status tracking: "fixed", "open", "in-progress"

### Work Context
- Repository URLs: "github.com/company/repo"
- Branch information: "feature/authentication"
- Project names: "e-commerce project"

## Architecture Integration

### Vector Store Management

Workspace memory uses a separate vector collection to avoid conflicts with default memory:

```javascript
// Default memory uses: VECTOR_STORE_COLLECTION (default: 'default')
// Workspace memory uses: WORKSPACE_VECTOR_STORE_COLLECTION (default: 'workspace_memory')

// Different vector store types can be used:
// VECTOR_STORE_TYPE=qdrant
// WORKSPACE_VECTOR_STORE_TYPE=in-memory
```

### Error Handling and Fallbacks

The workspace memory system includes robust error handling:

- Graceful degradation when embeddings are disabled
- Fallback to heuristic processing when vector operations fail
- Automatic retry mechanisms for transient failures
- Comprehensive logging for debugging and monitoring

### Performance Considerations

- **Batch Processing**: Multiple workspace items processed efficiently
- **Caching**: Configurable TTL for search results
- **Async Operations**: Non-blocking storage operations
- **Similarity Thresholds**: Configurable to balance relevance vs. recall

## Migration and Compatibility

### Existing Installations

Workspace memory is fully optional and backward compatible:

1. Existing installations continue to work unchanged
2. Workspace memory can be enabled without affecting existing data
3. Default memory can be disabled independently
4. Configuration is additive - no breaking changes

### Data Isolation

- Workspace and default memory use separate collections
- No data mixing or conflicts
- Independent configuration and management
- Separate embedding and vector store settings

## Monitoring and Debugging

### Configuration Validation

The system includes built-in validation:

```javascript
import { validateWorkspaceMemorySetup } from './workspace-tools.js';

const validation = validateWorkspaceMemorySetup();
if (!validation.isValid) {
  console.error('Workspace memory configuration issues:', validation.issues);
}
```

### Logging

Comprehensive logging is provided for:
- Tool activation and deactivation
- Memory operations (ADD, UPDATE, DELETE)
- Search performance metrics
- Error conditions and fallbacks
- Configuration validation results

### Metrics

The system tracks:
- Memory operation success rates
- Search performance (embedding time, search time, similarity scores)
- Extraction success rates
- Tool usage patterns

## Best Practices

### Team Workflows

1. **Consistent Formatting**: Use consistent patterns for status updates
2. **Clear Attribution**: Include team member names in progress reports
3. **Context Information**: Include repository and branch information
4. **Status Updates**: Use standard status terms (completed, in-progress, blocked, reviewing)

### Configuration

1. **Collection Naming**: Use descriptive collection names
2. **Similarity Thresholds**: Tune based on team communication patterns
3. **Batch Processing**: Enable for better performance with large teams
4. **Cache Settings**: Adjust TTL based on update frequency

### Performance

1. **Embedding Models**: Choose appropriate models for team communication
2. **Vector Store**: Select vector store type based on scale and persistence needs
3. **Monitoring**: Set up alerts for memory operation failures
4. **Cleanup**: Implement retention policies for old workspace memories

## Future Enhancements

The workspace memory system is designed for extensibility:

- **Integration APIs**: REST endpoints for external tools
- **Webhook Support**: Real-time updates from project management tools
- **Custom Extractors**: Domain-specific information extraction
- **Analytics Dashboard**: Visual insights into team collaboration patterns
- **AI Insights**: Automated project health and team productivity analysis