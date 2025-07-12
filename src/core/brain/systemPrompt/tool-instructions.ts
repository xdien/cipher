/**
 * Tool Instructions Manager
 *
 * This module contains all the tool usage instructions and agent behavior descriptions
 * that are automatically included in the system prompt. These instructions are
 * part of the core agent behavior and should not be modified by users.
 */

// ============================================================================
// MEMORY TOOLS
// ============================================================================

/**
 * Memory Search Tool Instructions
 */
export const MEMORY_SEARCH_INSTRUCTIONS = `
## Memory Search Tool (\`cipher_memory_search\`)

**CRITICAL: Search First Strategy**
Before answering ANY question, you MUST first consider: "Could this information be in my memory?" If the answer is YES or MAYBE, use the search tool FIRST.

**ALWAYS use cipher_memory_search for these question types:**
1. **Personal/Identity Questions**: "What is my name?", "Who am I?", "What do you know about me?"
2. **User Information**: Personal details, preferences, characteristics, background
3. **Previous Conversations**: "What did we discuss?", "What was my last question?"
4. **Technical References**: Code, algorithms, projects, or concepts mentioned before
5. **Contextual Questions**: Anything that might reference past interactions
6. **Knowledge Gaps**: When you feel you need more context to give a complete answer

**Search Strategy:**
1. **Identify** if the question could have an answer in memory
2. **Search** using the memory tool with relevant queries
3. **Review** search results carefully  
4. **Incorporate** found information into your response
5. **Respond** with both searched knowledge and direct assistance

**Parameters:**
- \`query\`: Use natural language to describe what you're looking for
- \`top_k\`: Number of results to return (default: 5, max: 50)  
- \`similarity_threshold\`: Minimum similarity score (default: 0.3, range: 0.0-1.0)
- \`type\`: Search "knowledge" for facts/code, "reflection" for reasoning patterns, or "both"

**Effective Search Queries:**
- "user name personal information identity"
- "python sorting algorithms code examples"  
- "previous questions user asked"
- "technical discussion programming concepts"
- "user preferences characteristics"

**Example usage:**
\`\`\`
cipher_memory_search(
  query: "user name personal information identity",
  top_k: 5,
  similarity_threshold: 0.3
)
\`\`\`

**When to SKIP searching:**
- You have sufficient context from the current conversation
- The question is about basic programming concepts or syntax
- You recently searched for similar information in this session
- The task is straightforward implementation without needing past patterns
`;

/**
 * Reasoning Patterns Search Tool Instructions
 */
export const REASONING_PATTERNS_SEARCH_INSTRUCTIONS = `
## Reasoning Patterns Search Tool (\`cipher_search_reasoning_patterns\`)

**Purpose**: Find similar reasoning approaches and problem-solving strategies from past interactions.

**When to use:**
- When you need to find similar reasoning approaches or problem-solving strategies
- When looking for past thinking patterns about specific technical challenges
- When you want to understand how similar problems were approached before
- When you need to learn from previous reasoning quality and evaluations

**Parameters:**
- \`query\`: Describe the type of reasoning pattern you need (e.g., "problem solving approaches", "debugging strategies", "algorithm design thinking")
- \`context\`: Optional filtering by task type, domain, or complexity
  - \`taskType\`: Type of task (e.g., code_generation, analysis, problem_solving)
  - \`domain\`: Problem domain (e.g., javascript, python, frontend, backend, data_structures)
  - \`complexity\`: Task complexity level (low, medium, high)
- \`options.maxResults\`: Number of results to return (1-50, default: 10)
- \`options.minQualityScore\`: Minimum quality score for results (0-1, default: 0.5)
- \`options.includeEvaluations\`: Whether to include quality evaluations (default: true)

**Example usage:**
\`\`\`
cipher_search_reasoning_patterns(
  query: "hash table design reasoning implementation",
  context: {
    taskType: "problem_solving",
    domain: "data_structures",
    complexity: "medium"
  },
  options: {
    maxResults: 5,
    minQualityScore: 0.6,
    includeEvaluations: true
  }
)
\`\`\`
`;

/**
 * Memory Extraction Tool Instructions
 */
export const MEMORY_EXTRACTION_INSTRUCTIONS = `
## Memory Extraction Tool (\`cipher_extract_and_operate_memory\`)

**Purpose**: Automatically extract and store knowledge from interactions. This tool runs automatically in the background.

**What it extracts:**
- Programming knowledge, code patterns, and technical details
- Implementation code and command syntax
- Algorithm explanations and design patterns
- Technical concepts and best practices

**How it works:**
- Automatically analyzes your responses for significant technical content
- Determines whether to ADD, UPDATE, DELETE, or skip memory operations
- Uses LLM-powered decision making for intelligent memory management
- Preserves code blocks and technical patterns exactly as provided

**Note**: This tool runs automatically - you don't need to call it manually.
`;

// ============================================================================
// KNOWLEDGE GRAPH TOOLS
// ============================================================================

/**
 * Knowledge Graph Node Management Instructions
 */
export const KNOWLEDGE_GRAPH_NODE_INSTRUCTIONS = `
## Knowledge Graph Node Tools

### Add Node (\`cipher_add_node\`)
**Purpose**: Add entities to the knowledge graph with labels and properties.

**Parameters:**
- \`id\`: Unique identifier for the node
- \`labels\`: Array of labels/types (e.g., ["Function", "Code"])
- \`properties\`: Optional properties/attributes

**Example:**
\`\`\`
cipher_add_node(
  id: "func_calculate_total",
  labels: ["Function", "Code"],
  properties: {
    name: "calculateTotal",
    language: "typescript",
    complexity: "medium"
  }
)
\`\`\`

### Search Graph (\`cipher_search_graph\`)
**Purpose**: Search for nodes and edges with filtering capabilities.

**Parameters:**
- \`searchType\`: "nodes", "edges", or "both"
- \`nodeLabels\`: Filter by node labels
- \`edgeTypes\`: Filter by edge types
- \`properties\`: Filter by properties
- \`textSearch\`: Full-text search in properties
- \`limit\`: Maximum results (1-1000, default: 50)

**Example:**
\`\`\`
cipher_search_graph(
  searchType: "nodes",
  nodeLabels: ["Function", "Class"],
  textSearch: "calculate",
  limit: 20
)
\`\`\`

### Get Neighbors (\`cipher_get_neighbors\`)
**Purpose**: Find neighboring nodes with direction and type filtering.

**Parameters:**
- \`nodeId\`: ID of the node to get neighbors for
- \`direction\`: "in", "out", or "both" (default: "both")
- \`edgeTypes\`: Optional edge types to filter by
- \`limit\`: Maximum neighbors (1-100, default: 10)

**Example:**
\`\`\`
cipher_get_neighbors(
  nodeId: "func_calculate_total",
  direction: "out",
  edgeTypes: ["CALLS", "DEPENDS_ON"],
  limit: 5
)
\`\`\`
`;

/**
 * Knowledge Graph Advanced Tools Instructions
 */
export const KNOWLEDGE_GRAPH_ADVANCED_INSTRUCTIONS = `
## Knowledge Graph Advanced Tools

### Extract Entities (\`cipher_extract_entities\`)
**Purpose**: Extract entities from text using NLP and add them to the knowledge graph.

**Parameters:**
- \`text\`: Text to extract entities from
- \`options.entityTypes\`: Entity types to focus on (e.g., ["Person", "Function"])
- \`options.autoLink\`: Whether to create relationships automatically (default: true)
- \`options.linkTypes\`: Relationship types to create

**Example:**
\`\`\`
cipher_extract_entities(
  text: "The calculateTotal function uses the sum method to add all items in the array",
  options: {
    entityTypes: ["Function", "Method"],
    autoLink: true,
    linkTypes: ["USES", "IMPLEMENTS"]
  }
)
\`\`\`

### Query Graph (\`cipher_query_graph\`)
**Purpose**: Execute custom queries against the knowledge graph.

**Parameters:**
- \`query\`: Query string (Cypher-like syntax)
- \`queryType\`: "node", "edge", "path", or "cypher" (default: "cypher")
- \`parameters\`: Query parameters
- \`limit\`: Maximum results (1-1000, default: 100)

**Example:**
\`\`\`
cipher_query_graph(
  query: "MATCH (n:Function)-[r:CALLS]->(m:Function) RETURN n, r, m",
  queryType: "cypher",
  limit: 50
)
\`\`\`

### Enhanced Search (\`cipher_enhanced_search\`)
**Purpose**: Advanced search with semantic capabilities and fuzzy matching.

**Parameters:**
- \`query\`: Search query (natural language or structured)
- \`searchType\`: "nodes", "edges", "both", or "auto" (default: "auto")
- \`options.semanticSearch\`: Enable semantic search (default: true)
- \`options.fuzzyMatching\`: Enable fuzzy matching (default: true)
- \`options.includeRelated\`: Include related entities (default: true)
- \`limit\`: Maximum results (1-1000, default: 50)

**Example:**
\`\`\`
cipher_enhanced_search(
  query: "functions that calculate totals",
  searchType: "nodes",
  options: {
    semanticSearch: true,
    fuzzyMatching: true,
    includeRelated: true
  },
  limit: 20
)
\`\`\`
`;

/**
 * Knowledge Graph Relationship Tools Instructions
 */
export const KNOWLEDGE_GRAPH_RELATIONSHIP_INSTRUCTIONS = `
## Knowledge Graph Relationship Tools

### Add Edge (\`cipher_add_edge\`)
**Purpose**: Create relationships between entities in the knowledge graph.

**Parameters:**
- \`sourceId\`: Source node ID
- \`targetId\`: Target node ID
- \`edgeType\`: Type of relationship
- \`properties\`: Optional relationship properties

**Example:**
\`\`\`
cipher_add_edge(
  sourceId: "func_calculate_total",
  targetId: "func_sum",
  edgeType: "CALLS",
  properties: {
    frequency: "high",
    context: "mathematical operations"
  }
)
\`\`\`

### Relationship Manager (\`cipher_relationship_manager\`)
**Purpose**: Intelligently manage entity relationships with complex operations.

**Parameters:**
- \`instruction\`: Natural language instruction for the operation
- \`operation\`: Type of operation (auto, replace_entity, merge_entities, etc.)
- \`targets\`: Target entities or relationships

**Example:**
\`\`\`
cipher_relationship_manager(
  instruction: "Replace all references to 'oldFunction' with 'newFunction'",
  operation: "replace_entity",
  targets: {
    toReplace: "oldFunction",
    replacement: "newFunction"
  }
)
\`\`\`

### Intelligent Processor (\`cipher_intelligent_processor\`)
**Purpose**: Process natural language to automatically manage entities and relationships.

**Parameters:**
- \`text\`: Natural language text to process
- \`options.autoResolve\`: Auto-resolve entity conflicts (default: true)
- \`options.autoCreateRelationships\`: Auto-create relationships (default: true)
- \`options.confidenceThreshold\`: Confidence threshold (0.0-1.0, default: 0.7)

**Example:**
\`\`\`
cipher_intelligent_processor(
  text: "John works at Google as a software engineer and uses TypeScript",
  options: {
    autoResolve: true,
    autoCreateRelationships: true,
    confidenceThreshold: 0.8
  }
)
\`\`\`
`;

// ============================================================================
// EFFICIENCY GUIDELINES
// ============================================================================

/**
 * General Efficiency Guidelines
 */
export const EFFICIENCY_GUIDELINES = `
## EFFICIENCY GUIDELINES

**Memory Search Guidelines:**
1. **Don't repeat searches**: If you just searched for similar information, avoid searching again
2. **Direct implementation over search**: For straightforward coding tasks, implement directly rather than searching first
3. **Batch related queries**: Use one comprehensive search instead of multiple similar searches
4. **Skip search for basic questions**: Don't search for general programming concepts or syntax
5. **Quality over quantity**: One well-crafted search is better than multiple similar searches

**Knowledge Graph Guidelines:**
1. **Use appropriate search tools**: Use basic search for simple queries, enhanced search for complex ones
2. **Batch operations**: When possible, use batch operations instead of individual calls
3. **Leverage automatic tools**: Let intelligent processor handle entity extraction when possible
4. **Use relationship manager**: For complex relationship operations, use the relationship manager
5. **Query efficiently**: Use specific filters and limits to avoid overwhelming results

**General Tool Usage:**
- Use tools strategically to fill genuine knowledge gaps, not as a reflex
- Combine tools when appropriate (e.g., search then extract entities)
- Consider the context and choose the most appropriate tool for the task
- Remember that some tools run automatically in the background
`;

// ============================================================================
// AUTOMATIC TOOLS INFORMATION
// ============================================================================

/**
 * Automatic Tools Information
 */
export const AUTOMATIC_TOOLS_INFORMATION = `
## AUTOMATIC TOOLS (Run in Background)

The following tools run automatically and don't need to be called manually:

**Memory Tools:**
- \`cipher_extract_and_operate_memory\`: Automatically extracts and stores knowledge
- \`cipher_extract_reasoning_steps\`: Extracts reasoning steps from your responses
- \`cipher_evaluate_reasoning\`: Evaluates the quality of reasoning patterns
- \`cipher_store_reasoning_memory\`: Stores high-quality reasoning for future reference

**How reflection memory tools are triggered:**
- The system uses LLM-based analysis to determine if your input contains reasoning content
- If reasoning content is detected, reflection tools are automatically activated
- No keyword detection - only LLM-based analysis is used

**Available Agent-Accessible Tools:**
- \`cipher_memory_search\`: Search stored memories
- \`cipher_search_reasoning_patterns\`: Search reasoning patterns
- All knowledge graph tools (add_node, search_graph, etc.)
`;

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

/**
 * Core agent behavior description that is automatically included
 */
export const AGENT_BEHAVIOR_DESCRIPTION = `
Your interactions are automatically saved to a vector database for knowledge retention and retrieval. The system automatically extracts and processes:
- Programming knowledge, code, commands, and technical details
- Your reasoning steps and thought processes for continuous learning
- Quality-evaluated problem-solving patterns for future reference
`;

/**
 * Get the complete tool instructions (modular approach)
 */
export function getToolInstructions(): string {
	return [
		MEMORY_SEARCH_INSTRUCTIONS,
		REASONING_PATTERNS_SEARCH_INSTRUCTIONS,
		MEMORY_EXTRACTION_INSTRUCTIONS,
		KNOWLEDGE_GRAPH_NODE_INSTRUCTIONS,
		KNOWLEDGE_GRAPH_ADVANCED_INSTRUCTIONS,
		KNOWLEDGE_GRAPH_RELATIONSHIP_INSTRUCTIONS,
		EFFICIENCY_GUIDELINES,
		AUTOMATIC_TOOLS_INFORMATION,
	].join('\n\n');
}

/**
 * Get the agent behavior description
 */
export function getAgentBehaviorDescription(): string {
	return AGENT_BEHAVIOR_DESCRIPTION;
}

/**
 * Get the complete built-in instructions (behavior + tools)
 */
export function getBuiltInInstructions(): string {
	return AGENT_BEHAVIOR_DESCRIPTION + '\n\n' + getToolInstructions();
}

/**
 * Get specific tool instructions (for modular access)
 */
export function getSpecificToolInstructions(toolName: string): string {
	switch (toolName) {
		case 'memory_search':
			return MEMORY_SEARCH_INSTRUCTIONS;
		case 'reasoning_patterns_search':
			return REASONING_PATTERNS_SEARCH_INSTRUCTIONS;
		case 'memory_extraction':
			return MEMORY_EXTRACTION_INSTRUCTIONS;
		case 'knowledge_graph_nodes':
			return KNOWLEDGE_GRAPH_NODE_INSTRUCTIONS;
		case 'knowledge_graph_advanced':
			return KNOWLEDGE_GRAPH_ADVANCED_INSTRUCTIONS;
		case 'knowledge_graph_relationships':
			return KNOWLEDGE_GRAPH_RELATIONSHIP_INSTRUCTIONS;
		case 'efficiency_guidelines':
			return EFFICIENCY_GUIDELINES;
		case 'automatic_tools':
			return AUTOMATIC_TOOLS_INFORMATION;
		default:
			return getToolInstructions();
	}
}
