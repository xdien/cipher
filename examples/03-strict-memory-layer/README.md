# Strict Memory Layer

> 🧠 **Pure memory service for external agents with focused retrieval and storage operations**

## Overview

This configuration positions Cipher as a dedicated memory layer for external clients and agents. Unlike general-purpose AI assistants, this setup is strictly focused on two core functions:

- **Information Retrieval**: Comprehensive search across stored knowledge and memories
- **Information Storage**: Persistent storage of knowledge and contextual information

**Key Benefits:**
- **Focused Functionality**: Single-purpose memory operations without distractions
- **Automatic Tool Usage**: Clients don't need to explicitly call memory tools
- **Comprehensive Results**: Detailed, structured responses for all retrieval operations
- **Optimized Latency**: Fast responses with background storage operations

## Prerequisites

**Required API Keys:**

1. **Anthropic API Key** - Get from [console.anthropic.com](https://console.anthropic.com)
2. **OpenAI API Key** - Get from [platform.openai.com](https://platform.openai.com) (required for embeddings)

## Setup

### 1. Environment Setup

Set your API keys:
```bash
export ANTHROPIC_API_KEY=your_anthropic_api_key
export OPENAI_API_KEY=your_openai_api_key
```

### 2. Launch as MCP Server

```bash
# Navigate to the example directory
cd examples/03-strict-memory-layer

# Start Cipher in MCP server mode
cipher --mode mcp --agent ./cipher.yml
```

### 3. Client Integration

#### Claude Code Configuration
```bash
# Add cipher as memory layer server
claude mcp add cipher-memory -s user \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -- npx -y cipher --mode mcp --agent ./cipher.yml
```

#### Custom MCP Client Configuration
```json
{
  "mcpServers": {
    "cipher-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "cipher", "--mode", "mcp", "--agent", "./cipher.yml"],
      "env": {
        "ANTHROPIC_API_KEY": "your_anthropic_api_key",
        "OPENAI_API_KEY": "your_openai_api_key"
      }
    }
  }
}
```

### 4. Test the Setup

**Storage Operations:**
```bash
# Client agents can store information naturally
client> Remember that our API rate limit is 1000 requests per minute
client> Store this deployment configuration for the production environment
```

**Retrieval Operations:**
```bash
# Comprehensive retrieval without explicit tool calls
client> What do you know about our API configuration?
client> Find information about deployment procedures
```

## Configuration

The `cipher.yml` file is optimized for memory operations:

### Core Settings
```yaml
# Strict focus on memory operations
systemPrompt: |
  You are a MEMORY LAYER focused solely on:
  - RETRIEVAL: Comprehensive search and detailed results
  - STORAGE: Efficient information storage
  
# No external MCP servers - uses built-in tools only
mcpServers: {}  # Empty - relies on internal vector DB operations
```

### Memory Optimization
- **Fast Responses**: Storage operations run in background after response
- **Comprehensive Search**: Always provides detailed, structured results
- **Automatic Tool Usage**: Clients don't need to explicitly request memory operations

## Usage Examples

**Natural Storage:**
```bash
# Agents store information without explicit tool calls
agent> Our new authentication system uses JWT tokens with 24-hour expiration
agent> The database migration completed successfully at 2024-01-15 14:30 UTC
```

**Comprehensive Retrieval:**
```bash
# Detailed retrieval with structured responses
agent> What authentication systems do we use?

Response:
• JWT Token System
  - Token Type: JWT (JSON Web Tokens)
  - Expiration: 24-hour duration
  - Implementation: Recently deployed
  - Status: Active

• Related Information
  - Database migration completed: 2024-01-15 14:30 UTC
  - System dependencies: [retrieved details]
```

**Context-Aware Operations:**
```bash
# Memory layer understands context automatically
agent> Update the token expiration to 12 hours
agent> What were the recent database changes?
```

## MCP Server Details

### Available Tool
- **ask_cipher**: Single tool for all memory operations
  - Automatically determines if operation is storage or retrieval
  - Provides comprehensive, structured responses
  - Optimized for external agent integration

### Tool Behavior
- **Storage Mode**: Quick acknowledgment, background processing
- **Retrieval Mode**: Comprehensive search with detailed, structured results
- **Auto-Detection**: Automatically identifies operation type from context

## Client Integration Patterns

**For External Agents:**
```python
# Agents can interact naturally without explicit tool management
await mcp_client.call_tool("ask_cipher", {
    "query": "Store the new API endpoint configuration"
})

await mcp_client.call_tool("ask_cipher", {
    "query": "What are our current API endpoints?"
})
```

**Response Format:**
All retrieval responses follow a structured format:
- Bullet-point organization
- Comprehensive details
- Related information when relevant
- Clear categorization

## Troubleshooting

**Connection Issues:**
```bash
# Verify cipher installation
npx cipher --version

# Test MCP mode
cipher --mode mcp --help
```

**Common Solutions:**
- Verify API keys are set correctly
- Ensure OpenAI API key is available (required for embeddings)
- Check that cipher is running in MCP mode
- Verify client MCP configuration

**Performance Optimization:**
- Storage operations run in background for optimal response time
- Retrieval operations prioritize comprehensive results
- Built-in vector database handles all search operations

---

This configuration provides a pure memory layer service, optimized for external agents that need reliable information storage and comprehensive retrieval capabilities.