# Feature Execution Plan: User-Definable Custom Memory Types

## Overview

This document outlines the comprehensive execution plan for implementing user-definable custom memory types in the Cipher system. The feature will allow users to define their own memory types through YAML configuration while maintaining backward compatibility with the existing knowledge/reflection memory system.

## Feature Requirements Summary

- **Configuration**: YAML-based memory type definitions in same directory as `cipher.yml`
- **Environment Control**: `USE_CUSTOM_MEMORY` and `DISABLE_DEFAULT_MEMORY` flags
- **Schema Flexibility**: Base payload with optional custom field definitions
- **Tool Integration**: Orchestrated search/store operations with custom behaviors
- **Backward Compatibility**: Seamless fallback to existing dual-memory system
- **Collection Management**: Individual vector collections per custom memory type

## Implementation Phases

### Phase 1: Core Infrastructure Changes

#### 1.1 Configuration Schema Design
**Files to modify**: `/src/core/config/`
- Create `memory-config.schema.ts` with Zod schemas for YAML validation
- Define base memory type configuration interface
- Implement YAML parser with validation

**Complete YAML Configuration Structure**:
```yaml
# Custom Memory Configuration
# Location: {cipher_directory}/custom-memory-config.yml

# Global configuration
global:
  enabled: true
  fallback_to_default: true  # If custom config fails, use default memory
  max_memory_types: 50       # Optional limit (remove for unlimited)
  id_range_size: 100000      # Size of ID range per memory type
  
# Custom memory type definitions
custom_memory_types:
  - name: "research_notes"
    collection_name: "research_collection"
    description: "Stores research findings and references"
    priority: 1  # Higher number = higher priority for orchestrator
    
    # Vector storage configuration
    embedding:
      model: "text-embedding-3-small"
      dimension: 1536
      batch_size: 100
      timeout_ms: 30000
    
    # Vector store settings
    vector_store:
      similarity_threshold: 0.7
      max_results: 10
      rerank: true
      
    # Custom schema definition
    schema:
      version: "1.0"
      # Base fields (id, text, timestamp) are always included
      custom_fields:
        - name: "source_url"
          type: "string"
          required: false
          validation: "url"  # Built-in validation types
          description: "URL of the research source"
        - name: "research_domain"
          type: "string"
          required: true
          validation: "non_empty"
          description: "Domain/field of research"
        - name: "confidence_score"
          type: "number"
          required: false
          validation: "range"
          min_value: 0.0
          max_value: 1.0
          default: 0.5
        - name: "tags"
          type: "array"
          item_type: "string"
          required: false
          description: "Research topic tags"
        - name: "metadata"
          type: "object"
          required: false
          description: "Additional metadata as JSON object"
    
    # Behavioral rules for when to search/store
    behavior:
      search:
        # Multiple trigger types supported
        keyword_triggers: 
          - "research"
          - "study"
          - "paper"
          - "academic"
        pattern_triggers:
          - ".*research.*"
          - ".*study shows.*"
        semantic_triggers:
          - "asking about academic topics"
          - "requesting research information"
        # Custom conditions using simple expression language
        conditions: |
          contains_any(['research', 'academic', 'study']) OR
          semantic_similarity('research query', 0.7) OR
          has_domain_keywords(['science', 'technology', 'medicine'])
        # When NOT to search this memory type
        exclusions:
          - "code implementation"
          - "personal conversation"
      
      store:
        keyword_triggers:
          - "learned"
          - "discovered"
          - "research shows"
        pattern_triggers:
          - ".*according to.*"
          - ".*study found.*"
        semantic_triggers:
          - "sharing research findings"
          - "providing academic information"
        conditions: |
          is_factual_information() AND
          (has_source_reference() OR confidence > 0.8) AND
          relates_to_domain(['research', 'academic'])
        # Automatic field extraction rules
        field_extraction:
          source_url: "extract_urls_from_text()"
          research_domain: "classify_domain(text)"
          confidence_score: "calculate_confidence(context, sources)"
          tags: "extract_keywords(text, max=5)"
        # When NOT to store in this memory type
        exclusions:
          - "personal opinions"
          - "unverified claims"
  
  - name: "code_snippets"
    collection_name: "code_collection"
    description: "Stores code examples and implementation patterns"
    priority: 2
    
    embedding:
      model: "text-embedding-3-small"
      dimension: 1536
      # Code-specific embedding settings
      preprocessing:
        normalize_whitespace: true
        preserve_structure: true
        include_comments: true
    
    vector_store:
      similarity_threshold: 0.8  # Higher threshold for code similarity
      max_results: 5
      rerank: false
    
    schema:
      version: "1.0"
      custom_fields:
        - name: "language"
          type: "string"
          required: true
          validation: "enum"
          allowed_values: ["javascript", "typescript", "python", "java", "go", "rust", "other"]
        - name: "function_name"
          type: "string"
          required: false
          validation: "identifier"
        - name: "file_path"
          type: "string"
          required: false
          validation: "path"
        - name: "line_numbers"
          type: "object"
          required: false
          properties:
            start: "number"
            end: "number"
        - name: "complexity_score"
          type: "number"
          required: false
          validation: "range"
          min_value: 1
          max_value: 10
        - name: "dependencies"
          type: "array"
          item_type: "string"
          required: false
    
    behavior:
      search:
        keyword_triggers:
          - "code"
          - "implementation"
          - "function"
          - "example"
        pattern_triggers:
          - ".*how to implement.*"
          - ".*code example.*"
          - ".*function.*"
        semantic_triggers:
          - "asking for code help"
          - "requesting implementation examples"
        conditions: |
          is_code_related() OR
          mentions_programming_concepts() OR
          asks_for_implementation()
        
      store:
        keyword_triggers:
          - "function"
          - "class"
          - "method"
          - "implementation"
        pattern_triggers:
          - "```.*```"  # Code blocks
          - ".*\.js:|.*\.py:|.*\.ts:"  # File references
        conditions: |
          contains_code_block() OR
          is_implementation_discussion() OR
          references_specific_functions()
        field_extraction:
          language: "detect_programming_language(text)"
          function_name: "extract_function_names(text)"
          file_path: "extract_file_paths(text)"
          complexity_score: "calculate_code_complexity(text)"
          dependencies: "extract_imports_and_deps(text)"
  
  - name: "conversation_context"
    collection_name: "context_collection"
    description: "Stores conversational context and user preferences"
    priority: 3
    
    embedding:
      model: "text-embedding-3-small"
      dimension: 1536
      # Context-specific settings
      context_window: 5  # Include surrounding messages
      temporal_decay: true  # Reduce importance over time
    
    vector_store:
      similarity_threshold: 0.6
      max_results: 20
      time_decay_factor: 0.95  # Daily decay
    
    schema:
      version: "1.0"
      custom_fields:
        - name: "session_id"
          type: "string"
          required: true
        - name: "user_intent"
          type: "string"
          required: false
          validation: "enum"
          allowed_values: ["question", "request", "clarification", "feedback", "other"]
        - name: "topic_category"
          type: "string"
          required: false
        - name: "user_satisfaction"
          type: "number"
          required: false
          validation: "range"
          min_value: 1
          max_value: 5
        - name: "follow_up_needed"
          type: "boolean"
          required: false
          default: false
        - name: "context_relevance"
          type: "number"
          required: false
          validation: "range"
          min_value: 0.0
          max_value: 1.0
    
    behavior:
      search:
        # Always search context for continuity
        keyword_triggers: ["*"]  # Universal trigger
        conditions: "always_search_context()"
        
      store:
        keyword_triggers:
          - "remember"
          - "preference"
          - "context"
        conditions: |
          is_meaningful_interaction() AND
          (establishes_context() OR expresses_preference())
        field_extraction:
          user_intent: "classify_intent(text)"
          topic_category: "classify_topic(text)"
          context_relevance: "calculate_relevance(conversation_history)"

# Advanced configuration options
advanced:
  # Orchestrator configuration
  orchestrator:
    decision_algorithm: "priority_weighted"  # or "round_robin", "semantic_routing"
    parallel_search: true
    max_concurrent_searches: 3
    search_timeout_ms: 5000
    
  # Performance tuning
  performance:
    cache_enabled: true
    cache_ttl_seconds: 300
    batch_operations: true
    async_storage: true
    
  # Monitoring and logging
  monitoring:
    enable_metrics: true
    log_decisions: true
    performance_tracking: true
    usage_analytics: true
    
  # Error handling
  error_handling:
    retry_attempts: 3
    retry_delay_ms: 1000
    fallback_on_error: true
    strict_validation: false  # If false, ignore minor validation errors
```

#### 1.2 Environment Variable Integration
**Files to modify**: `/src/core/env.ts`

**New Environment Variables to Add**:
```typescript
// Custom Memory Control
USE_CUSTOM_MEMORY: z.boolean().default(false),
DISABLE_DEFAULT_MEMORY: z.boolean().default(false), // Auto-computed based on USE_CUSTOM_MEMORY
CUSTOM_MEMORY_CONFIG_PATH: z.string().optional(), // Override default config path

// Performance and Debugging
CUSTOM_MEMORY_DEBUG: z.boolean().default(false),
CUSTOM_MEMORY_METRICS: z.boolean().default(false),
CUSTOM_MEMORY_CACHE_ENABLED: z.boolean().default(true),

// Fallback Configuration
CUSTOM_MEMORY_STRICT_MODE: z.boolean().default(false), // Fail hard on config errors
CUSTOM_MEMORY_FALLBACK_ENABLED: z.boolean().default(true),
```

**Environment Variable Logic**:
1. When `USE_CUSTOM_MEMORY=true`, automatically set `DISABLE_DEFAULT_MEMORY=true`
2. Config path defaults to `{cipher_directory}/custom-memory-config.yml`
3. If custom config fails to load and `CUSTOM_MEMORY_FALLBACK_ENABLED=true`, revert to default memory
4. Debug mode enables verbose logging for memory operations
5. Strict mode prevents fallback on configuration errors

**Environment Validation Schema Updates**:
```typescript
// Add to existing env.ts schema
const customMemorySchema = z.object({
  USE_CUSTOM_MEMORY: z.boolean().default(false),
  DISABLE_DEFAULT_MEMORY: z.boolean().default(false),
  CUSTOM_MEMORY_CONFIG_PATH: z.string().optional(),
  CUSTOM_MEMORY_DEBUG: z.boolean().default(false),
  CUSTOM_MEMORY_METRICS: z.boolean().default(false),
  CUSTOM_MEMORY_CACHE_ENABLED: z.boolean().default(true),
  CUSTOM_MEMORY_STRICT_MODE: z.boolean().default(false),
  CUSTOM_MEMORY_FALLBACK_ENABLED: z.boolean().default(true),
}).transform((data) => {
  // Auto-compute DISABLE_DEFAULT_MEMORY
  if (data.USE_CUSTOM_MEMORY) {
    data.DISABLE_DEFAULT_MEMORY = true;
  }
  return data;
});
```

#### 1.3 Dynamic Collection Management
**Files to modify**: `/src/core/vector_storage/`

**Create `CustomCollectionManager.ts`** with the following capabilities:

```typescript
// Interface for the new CustomCollectionManager
interface CustomCollectionManager {
  // Collection lifecycle
  createCollection(memoryType: CustomMemoryType): Promise<void>;
  deleteCollection(collectionName: string): Promise<void>;
  listCollections(): Promise<CollectionInfo[]>;
  
  // Memory operations
  store(collectionName: string, payload: BasePayload): Promise<string>;
  search(collectionName: string, query: string, options: SearchOptions): Promise<SearchResult[]>;
  update(collectionName: string, id: string, payload: Partial<BasePayload>): Promise<void>;
  delete(collectionName: string, id: string): Promise<void>;
  
  // Health and metrics
  getCollectionHealth(collectionName: string): Promise<CollectionHealth>;
  getCollectionMetrics(collectionName: string): Promise<CollectionMetrics>;
  
  // Migration and backup
  migrateCollection(oldName: string, newName: string): Promise<void>;
  backupCollection(collectionName: string): Promise<BackupInfo>;
  restoreCollection(backupPath: string): Promise<void>;
}
```

**ID Range Allocation Strategy** (Detailed):
```typescript
// ID allocation system
const ID_RANGES = {
  // Legacy ranges (preserved for compatibility)
  KNOWLEDGE: { start: 1, end: 333333 },
  REFLECTION: { start: 666667, end: 999999 },
  
  // Custom memory ranges
  CUSTOM_BASE: 1000000,
  RANGE_SIZE: 100000, // Each custom type gets 100k IDs
  
  // Special ranges
  SYSTEM_RESERVED: { start: 500000, end: 599999 }, // For system use
  MIGRATION: { start: 600000, end: 666666 }, // For migration operations
};

// Dynamic ID range calculator
class IDRangeManager {
  private allocatedRanges = new Map<string, {start: number, end: number}>();
  private nextAvailableStart = ID_RANGES.CUSTOM_BASE;
  
  allocateRange(memoryTypeName: string): {start: number, end: number} {
    if (this.allocatedRanges.has(memoryTypeName)) {
      return this.allocatedRanges.get(memoryTypeName)!;
    }
    
    const range = {
      start: this.nextAvailableStart,
      end: this.nextAvailableStart + ID_RANGES.RANGE_SIZE - 1
    };
    
    this.allocatedRanges.set(memoryTypeName, range);
    this.nextAvailableStart += ID_RANGES.RANGE_SIZE;
    
    return range;
  }
  
  // Handle ID conflicts and gaps
  findAvailableRange(requestedSize: number = ID_RANGES.RANGE_SIZE): {start: number, end: number} {
    // Implementation to find gaps in allocated ranges
    // and return available space
  }
  
  // Validate ID belongs to correct memory type
  validateID(id: number, memoryTypeName: string): boolean {
    const range = this.allocatedRanges.get(memoryTypeName);
    return range ? (id >= range.start && id <= range.end) : false;
  }
}
```

**Collection Configuration Management**:
```typescript
// Per-collection configuration
interface CollectionConfig {
  name: string;
  memoryType: string;
  embeddingConfig: EmbeddingConfig;
  vectorStoreConfig: VectorStoreConfig;
  schema: CustomSchema;
  healthCheck: HealthCheckConfig;
  performance: PerformanceConfig;
}

// Collection health monitoring
interface CollectionHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  totalDocuments: number;
  indexStatus: string;
  lastUpdated: Date;
  errors: string[];
  warnings: string[];
  performance: {
    avgSearchTime: number;
    avgInsertTime: number;
    throughput: number;
  };
}
```

**Backward Compatibility Interface**:
```typescript
// Adapter to maintain existing DualCollectionVectorManager interface
class BackwardCompatibilityAdapter implements DualCollectionVectorManager {
  constructor(private customManager: CustomCollectionManager) {}
  
  // Map legacy methods to new system
  async searchKnowledge(query: string): Promise<SearchResult[]> {
    return this.customManager.search('knowledge_collection', query, {});
  }
  
  async storeKnowledge(payload: KnowledgePayload): Promise<string> {
    return this.customManager.store('knowledge_collection', payload);
  }
  
  // Similar mappings for reflection methods...
}
```

### Phase 2: Memory Type System Refactoring

#### 2.1 Abstract Memory Type Registry
**Files to create**: `/src/core/memory/`

**`MemoryTypeRegistry.ts`** - Central registry for all memory types:
```typescript
export class MemoryTypeRegistry {
  private memoryTypes = new Map<string, CustomMemoryType>();
  private defaultTypes = new Map<string, DefaultMemoryType>();
  private initializationOrder: string[] = [];
  
  // Registration methods
  registerCustomType(memoryType: CustomMemoryType): void {
    this.validateMemoryType(memoryType);
    this.memoryTypes.set(memoryType.name, memoryType);
    this.updateInitializationOrder();
  }
  
  registerDefaultType(name: string, type: DefaultMemoryType): void {
    this.defaultTypes.set(name, type);
  }
  
  // Retrieval methods
  getMemoryType(name: string): CustomMemoryType | DefaultMemoryType | null {
    return this.memoryTypes.get(name) || this.defaultTypes.get(name) || null;
  }
  
  getAllMemoryTypes(): (CustomMemoryType | DefaultMemoryType)[] {
    return [...this.memoryTypes.values(), ...this.defaultTypes.values()];
  }
  
  getActiveMemoryTypes(): (CustomMemoryType | DefaultMemoryType)[] {
    // Returns types that should be active based on environment configuration
    if (process.env.USE_CUSTOM_MEMORY === 'true') {
      return [...this.memoryTypes.values()];
    }
    return [...this.defaultTypes.values()];
  }
  
  // Priority-based ordering for orchestrator
  getMemoryTypesByPriority(): (CustomMemoryType | DefaultMemoryType)[] {
    const activeTypes = this.getActiveMemoryTypes();
    return activeTypes.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  // Validation and health checks
  validateMemoryType(memoryType: CustomMemoryType): void {
    // Comprehensive validation logic
    if (!memoryType.name || memoryType.name.trim().length === 0) {
      throw new Error('Memory type name is required');
    }
    
    if (this.memoryTypes.has(memoryType.name)) {
      throw new Error(`Memory type '${memoryType.name}' already exists`);
    }
    
    if (!memoryType.collectionName || memoryType.collectionName.trim().length === 0) {
      throw new Error('Collection name is required');
    }
    
    // Validate schema
    this.validateSchema(memoryType.schema);
    
    // Validate embedding configuration
    this.validateEmbeddingConfig(memoryType.embeddingConfig);
    
    // Validate behavior rules
    this.validateBehaviorRules(memoryType.behavior);
  }
  
  // Health monitoring
  async performHealthCheck(): Promise<RegistryHealthReport> {
    const report: RegistryHealthReport = {
      totalTypes: this.memoryTypes.size + this.defaultTypes.size,
      activeTypes: this.getActiveMemoryTypes().length,
      healthyTypes: 0,
      unhealthyTypes: [],
      warnings: [],
      timestamp: new Date()
    };
    
    for (const [name, type] of this.memoryTypes) {
      try {
        const health = await type.performHealthCheck();
        if (health.status === 'healthy') {
          report.healthyTypes++;
        } else {
          report.unhealthyTypes.push({name, status: health.status, errors: health.errors});
        }
      } catch (error) {
        report.unhealthyTypes.push({name, status: 'critical', errors: [error.message]});
      }
    }
    
    return report;
  }
  
  // Configuration management
  async reloadFromConfiguration(config: CustomMemoryConfig): Promise<void> {
    // Clear existing custom types
    this.memoryTypes.clear();
    
    // Load new types from configuration
    for (const typeConfig of config.custom_memory_types) {
      const memoryType = MemoryTypeFactory.createFromConfig(typeConfig);
      this.registerCustomType(memoryType);
    }
    
    // Initialize all types
    await this.initializeAllTypes();
  }
  
  private async initializeAllTypes(): Promise<void> {
    // Initialize in dependency order
    for (const typeName of this.initializationOrder) {
      const type = this.getMemoryType(typeName);
      if (type && !type.isInitialized()) {
        await type.initialize();
      }
    }
  }
}
```

**`CustomMemoryType.ts`** - Class representing user-defined memory types:
```typescript
export class CustomMemoryType {
  public readonly name: string;
  public readonly collectionName: string;
  public readonly description: string;
  public readonly priority: number;
  public readonly schema: CustomSchema;
  public readonly embeddingConfig: EmbeddingConfig;
  public readonly vectorStoreConfig: VectorStoreConfig;
  public readonly behavior: BehaviorConfig;
  
  private initialized = false;
  private collectionManager: CollectionManager;
  private behaviorEngine: BehaviorEngine;
  private metrics: MemoryTypeMetrics;
  
  constructor(config: MemoryTypeConfig) {
    this.name = config.name;
    this.collectionName = config.collection_name;
    this.description = config.description || '';
    this.priority = config.priority || 0;
    this.schema = new CustomSchema(config.schema);
    this.embeddingConfig = new EmbeddingConfig(config.embedding);
    this.vectorStoreConfig = new VectorStoreConfig(config.vector_store);
    this.behavior = new BehaviorConfig(config.behavior);
    
    this.metrics = new MemoryTypeMetrics(this.name);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize collection
    this.collectionManager = new CollectionManager(this.collectionName, {
      embeddingConfig: this.embeddingConfig,
      vectorStoreConfig: this.vectorStoreConfig,
      schema: this.schema
    });
    
    await this.collectionManager.initialize();
    
    // Initialize behavior engine
    this.behaviorEngine = new BehaviorEngine(this.behavior, {
      memoryTypeName: this.name,
      schema: this.schema
    });
    
    this.initialized = true;
  }
  
  // Memory operations
  async store(payload: BasePayload, context: OperationContext): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    // Check if should store based on behavior rules
    const shouldStore = await this.behaviorEngine.shouldStore(payload, context);
    if (!shouldStore) {
      return null;
    }
    
    // Extract custom fields based on behavior rules
    const enhancedPayload = await this.behaviorEngine.extractFields(payload, context);
    
    // Validate against schema
    const validatedPayload = this.schema.validate(enhancedPayload);
    
    // Store in collection
    const id = await this.collectionManager.store(validatedPayload);
    
    // Update metrics
    this.metrics.recordStore(payload, id);
    
    return id;
  }
  
  async search(query: string, context: OperationContext): Promise<SearchResult[]> {
    if (!this.initialized) await this.initialize();
    
    // Check if should search based on behavior rules
    const shouldSearch = await this.behaviorEngine.shouldSearch(query, context);
    if (!shouldSearch) {
      return [];
    }
    
    // Perform search
    const results = await this.collectionManager.search(query, {
      ...this.vectorStoreConfig.searchOptions,
      context
    });
    
    // Update metrics
    this.metrics.recordSearch(query, results.length);
    
    return results;
  }
  
  // Health and diagnostics
  async performHealthCheck(): Promise<MemoryTypeHealth> {
    const health: MemoryTypeHealth = {
      name: this.name,
      status: 'healthy',
      errors: [],
      warnings: [],
      metrics: await this.metrics.getSnapshot(),
      timestamp: new Date()
    };
    
    try {
      // Check collection health
      const collectionHealth = await this.collectionManager.getHealth();
      if (collectionHealth.status !== 'healthy') {
        health.status = collectionHealth.status;
        health.errors.push(...collectionHealth.errors);
      }
      
      // Check behavior engine health
      const behaviorHealth = await this.behaviorEngine.getHealth();
      if (behaviorHealth.warnings.length > 0) {
        health.warnings.push(...behaviorHealth.warnings);
      }
      
      // Check schema compatibility
      const schemaHealth = await this.schema.validate();
      if (!schemaHealth.isValid) {
        health.status = 'degraded';
        health.errors.push(...schemaHealth.errors);
      }
      
    } catch (error) {
      health.status = 'critical';
      health.errors.push(`Health check failed: ${error.message}`);
    }
    
    return health;
  }
  
  // Configuration updates
  async updateConfiguration(newConfig: Partial<MemoryTypeConfig>): Promise<void> {
    // Validate new configuration
    const mergedConfig = { ...this.getConfiguration(), ...newConfig };
    MemoryTypeFactory.validateConfig(mergedConfig);
    
    // Apply updates
    if (newConfig.embedding) {
      await this.embeddingConfig.update(newConfig.embedding);
    }
    
    if (newConfig.vector_store) {
      await this.vectorStoreConfig.update(newConfig.vector_store);
    }
    
    if (newConfig.behavior) {
      await this.behavior.update(newConfig.behavior);
      this.behaviorEngine = new BehaviorEngine(this.behavior, {
        memoryTypeName: this.name,
        schema: this.schema
      });
    }
    
    if (newConfig.schema) {
      // Schema updates require careful migration
      await this.migrateSchema(newConfig.schema);
    }
  }
  
  // Getters and utility methods
  isInitialized(): boolean {
    return this.initialized;
  }
  
  getConfiguration(): MemoryTypeConfig {
    return {
      name: this.name,
      collection_name: this.collectionName,
      description: this.description,
      priority: this.priority,
      schema: this.schema.getConfig(),
      embedding: this.embeddingConfig.getConfig(),
      vector_store: this.vectorStoreConfig.getConfig(),
      behavior: this.behavior.getConfig()
    };
  }
  
  getMetrics(): MemoryTypeMetrics {
    return this.metrics;
  }
}
```

**`MemoryTypeFactory.ts`** - Factory for creating memory type instances:
```typescript
export class MemoryTypeFactory {
  private static readonly CONFIG_VALIDATORS = new Map<string, ConfigValidator>();
  private static readonly FIELD_VALIDATORS = new Map<string, FieldValidator>();
  
  static createFromConfig(config: MemoryTypeConfig): CustomMemoryType {
    // Validate configuration
    this.validateConfig(config);
    
    // Apply defaults
    const configWithDefaults = this.applyDefaults(config);
    
    // Create instance
    return new CustomMemoryType(configWithDefaults);
  }
  
  static createDefault(type: 'knowledge' | 'reflection'): DefaultMemoryType {
    switch (type) {
      case 'knowledge':
        return new KnowledgeMemoryType();
      case 'reflection':
        return new ReflectionMemoryType();
      default:
        throw new Error(`Unknown default memory type: ${type}`);
    }
  }
  
  static validateConfig(config: MemoryTypeConfig): void {
    // Basic validation
    if (!config.name || typeof config.name !== 'string') {
      throw new ConfigValidationError('Memory type name is required and must be a string');
    }
    
    if (!config.collection_name || typeof config.collection_name !== 'string') {
      throw new ConfigValidationError('Collection name is required and must be a string');
    }
    
    // Validate embedding configuration
    this.validateEmbeddingConfig(config.embedding);
    
    // Validate schema
    this.validateSchemaConfig(config.schema);
    
    // Validate behavior configuration
    this.validateBehaviorConfig(config.behavior);
    
    // Validate vector store configuration
    this.validateVectorStoreConfig(config.vector_store);
  }
  
  private static validateEmbeddingConfig(config: EmbeddingConfig): void {
    if (!config.model || typeof config.model !== 'string') {
      throw new ConfigValidationError('Embedding model is required');
    }
    
    if (!config.dimension || typeof config.dimension !== 'number' || config.dimension <= 0) {
      throw new ConfigValidationError('Embedding dimension must be a positive number');
    }
    
    // Validate model compatibility
    const supportedModels = [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002'
    ];
    
    if (!supportedModels.includes(config.model)) {
      throw new ConfigValidationError(`Unsupported embedding model: ${config.model}`);
    }
  }
  
  private static validateSchemaConfig(config: SchemaConfig): void {
    if (!config.custom_fields || !Array.isArray(config.custom_fields)) {
      // Custom fields are optional
      return;
    }
    
    for (const field of config.custom_fields) {
      this.validateFieldConfig(field);
    }
  }
  
  private static validateFieldConfig(field: FieldConfig): void {
    if (!field.name || typeof field.name !== 'string') {
      throw new ConfigValidationError('Field name is required and must be a string');
    }
    
    if (!field.type || typeof field.type !== 'string') {
      throw new ConfigValidationError('Field type is required and must be a string');
    }
    
    const supportedTypes = ['string', 'number', 'boolean', 'array', 'object'];
    if (!supportedTypes.includes(field.type)) {
      throw new ConfigValidationError(`Unsupported field type: ${field.type}`);
    }
    
    // Validate type-specific configurations
    if (field.type === 'array' && !field.item_type) {
      throw new ConfigValidationError('Array fields must specify item_type');
    }
    
    if (field.validation) {
      this.validateFieldValidation(field.validation, field.type);
    }
  }
  
  private static validateBehaviorConfig(config: BehaviorConfig): void {
    if (!config.search && !config.store) {
      throw new ConfigValidationError('At least one of search or store behavior must be defined');
    }
    
    if (config.search) {
      this.validateBehaviorRules(config.search, 'search');
    }
    
    if (config.store) {
      this.validateBehaviorRules(config.store, 'store');
    }
  }
  
  private static applyDefaults(config: MemoryTypeConfig): MemoryTypeConfig {
    const defaults = {
      priority: 0,
      description: '',
      embedding: {
        batch_size: 100,
        timeout_ms: 30000,
        ...config.embedding
      },
      vector_store: {
        similarity_threshold: 0.7,
        max_results: 10,
        rerank: false,
        ...config.vector_store
      },
      schema: {
        version: '1.0',
        custom_fields: [],
        ...config.schema
      }
    };
    
    return { ...defaults, ...config };
  }
  
  // Registration of custom validators
  static registerConfigValidator(name: string, validator: ConfigValidator): void {
    this.CONFIG_VALIDATORS.set(name, validator);
  }
  
  static registerFieldValidator(name: string, validator: FieldValidator): void {
    this.FIELD_VALIDATORS.set(name, validator);
  }
}
```

#### 2.2 Dynamic Schema System
**Files to modify**: `/src/core/brain/tools/definitions/memory/payloads.ts`

**Enhanced BasePayload Interface**:
```typescript
// Core interface that all memory payloads must implement
export interface BasePayload {
  // Mandatory fields (cannot be overridden)
  id: string;
  text: string;
  timestamp: Date;
  version: string; // Schema version for migration support
  
  // Semi-mandatory fields (can be customized but should exist)
  tags?: string[];
  confidence?: number;
  
  // Extension point for custom fields
  [key: string]: any;
}

// Extended base with common optional fields
export interface EnhancedBasePayload extends BasePayload {
  // Common optional fields that many memory types might use
  sourceSessionId?: string;
  userId?: string;
  contextHash?: string;
  lastModified?: Date;
  accessCount?: number;
  importance?: number; // 0-1 scale
  
  // Metadata and relationships
  metadata?: Record<string, any>;
  relationships?: {
    parentId?: string;
    childIds?: string[];
    relatedIds?: string[];
    groupId?: string;
  };
  
  // Quality and validation
  qualityScore?: number;
  validationStatus?: 'pending' | 'validated' | 'rejected';
  validatedBy?: string;
  validatedAt?: Date;
}
```

**CustomPayloadBuilder Implementation**:
```typescript
export class CustomPayloadBuilder {
  private schema: CustomSchema;
  private validators: Map<string, FieldValidator>;
  private transformers: Map<string, FieldTransformer>;
  
  constructor(schema: CustomSchema) {
    this.schema = schema;
    this.validators = new Map();
    this.transformers = new Map();
    this.initializeBuiltInValidators();
    this.initializeBuiltInTransformers();
  }
  
  // Build payload class dynamically based on schema
  buildPayloadClass(): PayloadClass {
    const schema = this.schema;
    const validators = this.validators;
    const transformers = this.transformers;
    
    return class DynamicPayload implements BasePayload {
      // Mandatory fields
      id: string;
      text: string;
      timestamp: Date;
      version: string;
      
      // Dynamic fields based on schema
      [key: string]: any;
      
      constructor(data: Record<string, any>) {
        // Set mandatory fields
        this.id = data.id || this.generateId();
        this.text = data.text || '';
        this.timestamp = data.timestamp || new Date();
        this.version = schema.version;
        
        // Process custom fields
        for (const fieldConfig of schema.customFields) {
          this.setField(fieldConfig, data[fieldConfig.name]);
        }
        
        // Validate entire payload
        this.validate();
      }
      
      private setField(fieldConfig: FieldConfig, value: any): void {
        // Apply default value if none provided
        if (value === undefined && fieldConfig.default !== undefined) {
          value = fieldConfig.default;
        }
        
        // Check required fields
        if (fieldConfig.required && (value === undefined || value === null)) {
          throw new ValidationError(`Required field '${fieldConfig.name}' is missing`);
        }
        
        // Skip if optional and not provided
        if (!fieldConfig.required && (value === undefined || value === null)) {
          return;
        }
        
        // Apply transformers
        if (transformers.has(fieldConfig.name)) {
          value = transformers.get(fieldConfig.name)!.transform(value, fieldConfig);
        }
        
        // Type conversion
        value = this.convertType(value, fieldConfig.type);
        
        // Apply validators
        if (fieldConfig.validation) {
          this.validateField(fieldConfig, value);
        }
        
        // Set the field
        this[fieldConfig.name] = value;
      }
      
      private convertType(value: any, targetType: string): any {
        switch (targetType) {
          case 'string':
            return String(value);
          case 'number':
            const num = Number(value);
            if (isNaN(num)) throw new ValidationError(`Cannot convert '${value}' to number`);
            return num;
          case 'boolean':
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
              const lower = value.toLowerCase();
              if (['true', '1', 'yes', 'on'].includes(lower)) return true;
              if (['false', '0', 'no', 'off'].includes(lower)) return false;
            }
            throw new ValidationError(`Cannot convert '${value}' to boolean`);
          case 'array':
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
              try {
                return JSON.parse(value);
              } catch {
                return value.split(',').map(s => s.trim());
              }
            }
            throw new ValidationError(`Cannot convert '${value}' to array`);
          case 'object':
            if (typeof value === 'object' && value !== null) return value;
            if (typeof value === 'string') {
              try {
                return JSON.parse(value);
              } catch {
                throw new ValidationError(`Cannot parse '${value}' as JSON object`);
              }
            }
            throw new ValidationError(`Cannot convert '${value}' to object`);
          default:
            return value;
        }
      }
      
      private validateField(fieldConfig: FieldConfig, value: any): void {
        const validationType = fieldConfig.validation;
        
        switch (validationType) {
          case 'non_empty':
            if (typeof value === 'string' && value.trim().length === 0) {
              throw new ValidationError(`Field '${fieldConfig.name}' cannot be empty`);
            }
            break;
            
          case 'url':
            try {
              new URL(value);
            } catch {
              throw new ValidationError(`Field '${fieldConfig.name}' must be a valid URL`);
            }
            break;
            
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
              throw new ValidationError(`Field '${fieldConfig.name}' must be a valid email`);
            }
            break;
            
          case 'range':
            if (typeof value === 'number') {
              if (fieldConfig.min_value !== undefined && value < fieldConfig.min_value) {
                throw new ValidationError(`Field '${fieldConfig.name}' must be >= ${fieldConfig.min_value}`);
              }
              if (fieldConfig.max_value !== undefined && value > fieldConfig.max_value) {
                throw new ValidationError(`Field '${fieldConfig.name}' must be <= ${fieldConfig.max_value}`);
              }
            }
            break;
            
          case 'enum':
            if (fieldConfig.allowed_values && !fieldConfig.allowed_values.includes(value)) {
              throw new ValidationError(`Field '${fieldConfig.name}' must be one of: ${fieldConfig.allowed_values.join(', ')}`);
            }
            break;
            
          case 'regex':
            if (fieldConfig.pattern) {
              const regex = new RegExp(fieldConfig.pattern);
              if (!regex.test(value)) {
                throw new ValidationError(`Field '${fieldConfig.name}' does not match required pattern`);
              }
            }
            break;
            
          case 'custom':
            if (validators.has(fieldConfig.name)) {
              const validator = validators.get(fieldConfig.name)!;
              const result = validator.validate(value, fieldConfig);
              if (!result.isValid) {
                throw new ValidationError(`Field '${fieldConfig.name}' validation failed: ${result.errors.join(', ')}`);
              }
            }
            break;
        }
      }
      
      private validate(): void {
        // Cross-field validation
        const crossValidations = schema.crossValidations || [];
        for (const validation of crossValidations) {
          this.performCrossValidation(validation);
        }
        
        // Business logic validation
        const businessRules = schema.businessRules || [];
        for (const rule of businessRules) {
          this.validateBusinessRule(rule);
        }
      }
      
      private generateId(): string {
        return `${schema.memoryTypeName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Serialization methods
      toJSON(): Record<string, any> {
        const result: Record<string, any> = {};
        
        // Include all enumerable properties
        for (const key in this) {
          if (this.hasOwnProperty(key)) {
            result[key] = this[key];
          }
        }
        
        return result;
      }
      
      static fromJSON(data: Record<string, any>): DynamicPayload {
        return new DynamicPayload(data);
      }
      
      // Utility methods
      getFieldValue(fieldName: string): any {
        return this[fieldName];
      }
      
      setFieldValue(fieldName: string, value: any): void {
        const fieldConfig = schema.customFields.find(f => f.name === fieldName);
        if (!fieldConfig) {
          throw new Error(`Unknown field: ${fieldName}`);
        }
        this.setField(fieldConfig, value);
      }
      
      getSchema(): CustomSchema {
        return schema;
      }
      
      clone(): DynamicPayload {
        return new DynamicPayload(this.toJSON());
      }
    };
  }
  
  // Built-in validators
  private initializeBuiltInValidators(): void {
    this.validators.set('uuid', {
      validate: (value: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return {
          isValid: uuidRegex.test(value),
          errors: uuidRegex.test(value) ? [] : ['Must be a valid UUID']
        };
      }
    });
    
    this.validators.set('json', {
      validate: (value: string) => {
        try {
          JSON.parse(value);
          return { isValid: true, errors: [] };
        } catch {
          return { isValid: false, errors: ['Must be valid JSON'] };
        }
      }
    });
    
    this.validators.set('positive_number', {
      validate: (value: number) => {
        return {
          isValid: typeof value === 'number' && value > 0,
          errors: (typeof value === 'number' && value > 0) ? [] : ['Must be a positive number']
        };
      }
    });
  }
  
  // Built-in transformers
  private initializeBuiltInTransformers(): void {
    this.transformers.set('lowercase', {
      transform: (value: string) => value.toLowerCase()
    });
    
    this.transformers.set('uppercase', {
      transform: (value: string) => value.toUpperCase()
    });
    
    this.transformers.set('trim', {
      transform: (value: string) => value.trim()
    });
    
    this.transformers.set('normalize_url', {
      transform: (value: string) => {
        try {
          const url = new URL(value);
          return url.toString();
        } catch {
          return value;
        }
      }
    });
  }
  
  // Registration methods for extensibility
  registerValidator(name: string, validator: FieldValidator): void {
    this.validators.set(name, validator);
  }
  
  registerTransformer(name: string, transformer: FieldTransformer): void {
    this.transformers.set(name, transformer);
  }
}
```

**Backward Compatibility Preservation**:
```typescript
// Maintain existing interfaces for backward compatibility
export interface KnowledgePayload extends EnhancedBasePayload {
  tags: string[];
  confidence: number;
  reasoning: string;
  event: 'ADD' | 'UPDATE' | 'DELETE' | 'NONE';
  domain?: string;
  sourceSessionId?: string;
  qualitySource: 'similarity' | 'llm' | 'heuristic';
  code_pattern?: string;
  old_memory?: string;
}

export interface ReasoningPayload extends EnhancedBasePayload {
  tags: string[];
  reasoningSteps: Array<{
    type: string;
    content: string;
    [key: string]: any;
  }>;
  evaluation: {
    qualityScore: number;
    issues: Array<{ type: string; description: string; severity?: string; }>;
    suggestions: string[];
  };
  context: string;
  stepCount: number;
  stepTypes: string[];
  issueCount: number;
}

// Factory methods for creating legacy payload types
export class PayloadFactory {
  static createKnowledgePayload(data: Partial<KnowledgePayload>): KnowledgePayload {
    const defaults: Partial<KnowledgePayload> = {
      tags: [],
      confidence: 0.5,
      reasoning: '',
      event: 'ADD',
      qualitySource: 'heuristic',
      version: '2.0'
    };
    
    return { ...defaults, ...data } as KnowledgePayload;
  }
  
  static createReasoningPayload(data: Partial<ReasoningPayload>): ReasoningPayload {
    const defaults: Partial<ReasoningPayload> = {
      tags: ['reasoning'],
      reasoningSteps: [],
      evaluation: {
        qualityScore: 0.5,
        issues: [],
        suggestions: []
      },
      context: '',
      stepCount: 0,
      stepTypes: [],
      issueCount: 0,
      version: '2.0'
    };
    
    return { ...defaults, ...data } as ReasoningPayload;
  }
  
  static createCustomPayload(memoryTypeName: string, schema: CustomSchema, data: Record<string, any>): BasePayload {
    const builder = new CustomPayloadBuilder(schema);
    const PayloadClass = builder.buildPayloadClass();
    return new PayloadClass(data);
  }
}
```

#### 2.3 Memory Behavior Engine
**Files to create**: `/src/core/memory/behavior/`
- `BehaviorEngine.ts`: Evaluates when to search/store based on YAML rules
- `TriggerMatcher.ts`: Pattern matching for search/store triggers
- `ConditionEvaluator.ts`: Evaluates custom conditions

### Phase 3: Tool System Integration

#### 3.1 Memory Orchestrator
**Files to create**: `/src/core/brain/tools/definitions/memory/orchestrator/`
- `MemoryOrchestrator.ts`: Decides which memory types to search/store
- Replace direct calls to knowledge/reflection tools with orchestrated calls
- Implement priority-based memory type selection

#### 3.2 Enhanced Tool Definitions
**Files to modify**: `/src/core/brain/tools/definitions/memory/`
- Update `memory_operation.ts` to handle multiple memory types
- Modify `search_memory.ts` to orchestrate across custom memory types
- Enhance tool parameter handling for memory type selection

#### 3.3 Tool Registration System
**Files to modify**: `/src/core/brain/tools/definitions/memory/index.ts`
- Implement conditional tool registration based on `USE_CUSTOM_MEMORY`
- Maintain existing tool names and behaviors for backward compatibility

### Phase 4: Configuration Loading and Validation

#### 4.1 Configuration Loader
**Files to create**: `/src/core/config/memory/`
- `MemoryConfigLoader.ts`: Loads and validates YAML configuration
- `ConfigValidator.ts`: Comprehensive validation with error reporting
- `ConfigDefaults.ts`: Default configurations and fallback values

#### 4.2 Runtime Configuration Management
**Files to create**: `/src/core/config/memory/runtime/`
- `RuntimeMemoryConfig.ts`: Runtime memory type management
- `ConfigReloader.ts`: Hot-reload capability for configuration changes
- `MigrationHandler.ts`: Handles transitions between memory systems

### Phase 5: Embedding and Vector Store Integration

#### 5.1 Custom Embedding Support
**Files to modify**: `/src/core/vector_storage/managers/`
- Extend vector store managers to support per-memory-type embedding configs
- Implement embedding model switching based on memory type configuration
- Add dimension validation and compatibility checks

#### 5.2 Collection Lifecycle Management
**Files to create**: `/src/core/vector_storage/lifecycle/`
- `CollectionLifecycleManager.ts`: Create/delete collections dynamically
- `CollectionHealthChecker.ts`: Validate collection states and configurations
- `CollectionMigrator.ts`: Handle collection schema migrations

### Phase 6: Backward Compatibility Layer

#### 6.1 Compatibility Interface
**Files to create**: `/src/core/compatibility/`
- `LegacyMemoryAdapter.ts`: Adapts legacy calls to new system
- `DualCollectionCompat.ts`: Maintains existing DualCollectionVectorManager interface
- `EnvironmentCompat.ts`: Ensures existing env vars continue working

#### 6.2 Fallback Mechanism
**Files to modify**: Core initialization files
- Implement robust fallback to dual-memory system on configuration errors
- Add comprehensive error handling and logging
- Ensure graceful degradation when custom config is invalid

### Phase 7: Testing and Validation

#### 7.1 Unit Tests
**Files to create**: `/tests/unit/memory/`
- Test custom memory type creation and validation
- Test YAML configuration parsing and validation
- Test memory orchestrator logic
- Test backward compatibility scenarios

#### 7.2 Integration Tests
**Files to create**: `/tests/integration/memory/`
- Test end-to-end custom memory workflows
- Test migration between memory systems
- Test performance with multiple memory types
- Test error handling and fallback scenarios

#### 7.3 Configuration Validation Tests
**Files to create**: `/tests/config/`
- Test various YAML configuration scenarios
- Test invalid configuration handling
- Test environment variable interactions

## Implementation Priority and Dependencies

### Critical Path Items:
1. **Phase 1.1**: Configuration schema design (foundational)
2. **Phase 1.3**: Dynamic collection management (core infrastructure)
3. **Phase 2.1**: Memory type registry (architectural foundation)
4. **Phase 3.1**: Memory orchestrator (behavior coordination)
5. **Phase 4.1**: Configuration loader (feature activation)

### Parallel Development Opportunities:
- Schema system (Phase 2.2) can be developed alongside configuration loading (Phase 4)
- Tool integration (Phase 3) can be developed alongside embedding support (Phase 5)
- Testing (Phase 7) should be developed incrementally with each phase

## File Structure Changes

### New Directory Structure:
```
src/core/
├── config/
│   └── memory/
│       ├── MemoryConfigLoader.ts
│       ├── memory-config.schema.ts
│       └── runtime/
├── memory/
│   ├── MemoryTypeRegistry.ts
│   ├── CustomMemoryType.ts
│   ├── MemoryTypeFactory.ts
│   └── behavior/
│       ├── BehaviorEngine.ts
│       ├── TriggerMatcher.ts
│       └── ConditionEvaluator.ts
├── brain/tools/definitions/memory/orchestrator/
│   └── MemoryOrchestrator.ts
├── vector_storage/
│   ├── CustomCollectionManager.ts
│   └── lifecycle/
└── compatibility/
    ├── LegacyMemoryAdapter.ts
    └── DualCollectionCompat.ts
```

## Configuration File Location

The custom memory configuration file should be located at:
```
{cipher_directory}/custom-memory-config.yml
```

This places it alongside the existing `cipher.yml` configuration file.

## Risk Mitigation Strategies

### 1. Configuration Validation
- Comprehensive YAML schema validation
- Runtime configuration validation
- Clear error messages and debugging information

### 2. Performance Considerations
- Lazy loading of memory types
- Efficient ID range management
- Optimized orchestrator decision making

### 3. Backward Compatibility
- Extensive compatibility testing
- Graceful fallback mechanisms
- Preservation of existing API contracts

### 4. Migration Safety
- Atomic configuration changes
- Rollback capabilities
- Data integrity validation

## Success Criteria

1. **Functional Requirements**:
   - Users can define custom memory types via YAML configuration
   - Custom memory types work seamlessly with existing tool system
   - Backward compatibility is maintained for existing installations
   - Memory orchestrator correctly routes search/store operations

2. **Performance Requirements**:
   - No significant performance degradation compared to existing system
   - Memory type selection overhead < 10ms per operation
   - Configuration loading time < 1 second

3. **Quality Requirements**:
   - 95%+ test coverage for new components
   - Zero breaking changes to existing API
   - Comprehensive error handling and logging
   - Clear documentation and examples


## Post-Implementation Tasks

1. **Documentation**: Create comprehensive user guide for custom memory types
2. **Examples**: Provide sample YAML configurations for common use cases
3. **Migration Tools**: Create utilities to help users migrate from dual-memory system
4. **Performance Monitoring**: Implement metrics for custom memory type usage
5. **Community Feedback**: Gather user feedback and iterate on the feature

---

This execution plan provides a comprehensive roadmap for implementing user-definable custom memory types while maintaining system stability and backward compatibility. Each phase builds upon the previous ones, ensuring a structured and manageable implementation process.