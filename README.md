# Cipher

<div align="center">

<img src="./assets/cipher-logo.png" alt="Cipher Agent Logo" width="400" />

<p align="center">
<em>Memory-powered AI agent framework with MCP integration</em>
</p>

<p align="center">
<a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License" /></a>
<a href="https://discord.com/invite/UMRrpNjh5W"><img src="https://img.shields.io/badge/Discord-Join%20Community-7289da" alt="Discord" /></a>
</p>

</div>

## Overview

*`cipher`* is a simple, composable framework to build memory for agents using [Model Context Protocol](https://modelcontextprotocol.io/introduction).

**Design Principal**:
`cipher` bring the fundamental and best practices for building agent's memory:

1. It handles the complexity of MCP server connection's lifecycle so you don't have to
2. It implements the best practices for layered memories which helps your agents learning the data you already have. the memory layers improves with every run - rquiring zero changes in your agent's implementation and zero human guidance.
3. The memory aligns closely with the congnitive structure of the human minds, offering robust and realtime tuning.
4. It implements the reflections mechanism; this is not just the way to diagnose the issues with your agent, they're valuable data for agent can learn from.

Altogether, `cipher` is the simplest and easiest way to build memory for agents using MCP that helps your agents to remember and learn from the previous actions.

Much like MCP. this project is in early development.

We welcome all kinds of [contributions](/CONTRIBUTING.md), feedbacks, and suggestions to help us improve this project.

## Get Started

```bash
# build from source
pnpm i && pnpm run build && npm link
```

## Run Modes

Cipher supports two operational modes to fit different usage patterns:

### CLI Mode (Interactive)

The default mode provides an interactive command-line interface for direct conversation with your memory-powered agent:

```bash
# Run in interactive CLI mode (default)
cipher
# or explicitly specify CLI mode
cipher --mode cli
```

**Features:**

- Real-time conversation with the agent
- Persistent memory throughout the session
- Memory learning from every interaction
- Graceful exit with `exit` or `quit` commands
- Signal handling (Ctrl+C) for clean shutdown

### MCP Server Mode

Runs cipher as a Model Context Protocol server, allowing other MCP-compatible tools to connect and utilize the agent's memory capabilities:

```bash
# Run as MCP server
cipher --mode mcp
```

**Features:**

- Exposes agent capabilities via MCP protocol
- Enables integration with other MCP-compatible tools
- Persistent memory across client connections
- *Note: This mode is currently in development*

### Prerequisites

Before running cipher in any mode, ensure you have:

1. **Environment Configuration**: Copy `.env.example` to `.env` and configure at least one API provider:

   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

2. **API Keys**: Set at least one of these in your `.env` file (or use Ollama for local models):
   - `OPENAI_API_KEY` for OpenAI models
   - `ANTHROPIC_API_KEY` for Anthropic Claude models
   - `OPENROUTER_API_KEY` for OpenRouter (200+ models)
   - `OLLAMA_BASE_URL` for Ollama local models (no API key required)

3. **Agent Configuration**: The agent uses `memAgent/cipher.yml` for configuration (included in the project)

### Additional Options

```bash
# Use custom agent config file
cipher --agent /path/to/custom/config.yml
cipher -a /path/to/custom/config.yml

# Require all MCP server connections to succeed (strict mode)
cipher --strict
cipher -s --strict

# Start with a new session
cipher --new-session                    # Auto-generated session ID
cipher --new-session myCustomSession    # Custom session ID

# Disable verbose output
cipher --no-verbose

# Show version
cipher --version

# Show help
cipher --help
```

### Command Line Interface

Cipher provides a rich interactive CLI with various commands for managing sessions, system information, and agent interactions:

#### Session Management Commands

```bash
# Session commands (alias: /s)
/session help                 # Show session management help
/session list                 # List all active sessions  
/session new [sessionId]      # Create new session (optional custom ID)
/session switch <sessionId>   # Switch to a different session
/session current              # Show current session information
/session delete <sessionId>   # Delete a session (cannot delete active session)

# Session command aliases
/s list                       # Same as /session list
/s new mySession             # Same as /session new mySession
/s sw sessionId              # Same as /session switch sessionId
/s curr                      # Same as /session current
/s del sessionId             # Same as /session delete sessionId
```

#### System Information Commands

```bash
# System and configuration
/config                      # Display current agent configuration
/stats                       # Show system statistics and metrics
/prompt                      # Display current system prompt
/tools                       # List all available MCP tools

# Basic commands
/help [command]              # Show help (alias: /h, /?)
/clear                       # Reset conversation history (alias: /reset)
/exit                        # Exit the CLI session (alias: /quit, /q)
```

#### Interactive Features

- **Tab Completion**: Use Tab key for command auto-completion
- **Command History**: Navigate previous commands with arrow keys
- **Colored Output**: Commands use color coding for better readability
- **Error Handling**: Comprehensive error messages with helpful guidance
- **Session Persistence**: Conversations are saved across sessions with memory integration

#### Usage Examples

**Session Management Workflow:**

```bash
# Start cipher and create a new session
cipher --new-session work-project

# In the CLI, create additional sessions
/session new personal-chat
/session new research-notes

# List all sessions
/session list

# Switch between sessions
/session switch work-project
/session current

# Delete a session (must switch away first)
/session switch personal-chat
/session delete research-notes
```

**Configuration and Startup:**

```bash
# Start with custom config and strict mode
cipher --agent ./my-config.yml --strict

# Start with new session and verbose logging
cipher --new-session experiment-1 --verbose

# Quick start with all features
cipher -a custom.yml -s --new-session main-session
```

## Configuration

Cipher uses a YAML configuration file (`memAgent/cipher.yml`) and environment variables for setup. The configuration is validated using strict schemas to ensure reliability.

### Configuration File Structure

The main configuration file is located at `memAgent/cipher.yml` and follows this structure:

```yaml
# LLM Configuration (Required)
llm:
  provider: openai                   # Required: 'openai', 'anthropic', 'openrouter', or 'ollama'
  model: gpt-4.1-mini                # Required: Model name for the provider
  apiKey: $OPENAI_API_KEY            # Required: API key (supports env vars with $VAR syntax, not needed for Ollama)
  maxIterations: 50                  # Optional: Max iterations for agentic loops (default: 50)
  baseURL: https://api.openai.com/v1 # Optional: Custom API base URL (OpenAI only)

# System Prompt (Required)
systemPrompt: "You are a helpful AI assistant with memory capabilities."

# MCP Servers Configuration (Optional)
mcpServers:
  filesystem:                        # Server name (can be any identifier)
    type: stdio                      # Connection type: 'stdio', 'sse', or 'http'
    command: npx                     # Command to launch the server
    args:                           # Arguments for the command
      - -y
      - "@modelcontextprotocol/server-filesystem" 
      - .
    env:                            # Environment variables for the server
      HOME: /Users/username
    timeout: 30000                  # Connection timeout in ms (default: 30000)
    connectionMode: lenient         # 'strict' or 'lenient' (default: lenient)

# Session Management (Optional)
sessions:
  maxSessions: 100                  # Maximum concurrent sessions (default: 100)
  sessionTTL: 3600000              # Session TTL in milliseconds (default: 1 hour)

# Agent Card (Optional) - for MCP server mode
agentCard:
  name: cipher                      # Agent name (default: cipher)
  description: "Custom description" # Agent description
  version: "1.0.0"                 # Version (default: 1.0.0)
  provider:
    organization: your-org          # Organization name
    url: https://your-site.com      # Organization URL
```

### Environment Variables

Create a `.env` file in the project root for sensitive configuration:

```bash
# API Keys (at least one required, EXCEPT for Ollama which is self-hosted)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# API Configuration (optional)
OPENAI_BASE_URL=https://api.openai.com/v1

# Ollama Configuration (for self-hosted local models - NO API KEY NEEDED)
OLLAMA_BASE_URL=http://localhost:11434/v1  # Points to your local Ollama instance

# Logger Configuration (optional)
CIPHER_LOG_LEVEL=info             # debug, info, warn, error
REDACT_SECRETS=true               # true/false - redact sensitive info in logs

# Storage Configuration (optional)
STORAGE_CACHE_TYPE=in-memory      # redis, in-memory
STORAGE_CACHE_HOST=localhost      # Redis host (if using redis)
STORAGE_CACHE_PORT=6379           # Redis port (if using redis)
STORAGE_CACHE_PASSWORD=           # Redis password (if using redis)
STORAGE_CACHE_DATABASE=0          # Redis database number (if using redis)

STORAGE_DATABASE_TYPE=in-memory   # sqlite, in-memory
STORAGE_DATABASE_PATH=./data      # SQLite database path (if using sqlite)
STORAGE_DATABASE_NAME=cipher.db   # SQLite database name (if using sqlite)
```

### LLM Provider Configuration

#### OpenAI

```yaml
llm:
  provider: openai
  model: gpt-4.1                     # or o4-mini, etc.
  apiKey: $OPENAI_API_KEY
  baseURL: https://api.openai.com/v1  # Optional: for custom endpoints
```

#### Anthropic Claude

```yaml
llm:
  provider: anthropic
  model: claude-4-sonnet-20250514    # or claude-3-7-sonnet-20250219, etc.
  apiKey: $ANTHROPIC_API_KEY
```

#### OpenRouter

```yaml
llm:
  provider: openrouter
  model: openai/gpt-4.1               # Any model available on OpenRouter
  apiKey: $OPENROUTER_API_KEY
```

#### Ollama (Self-Hosted Models)

```yaml
llm:
  provider: ollama
  model: qwen3:32b                   # Use larger models for better performance (see model selection guide below)
  # apiKey: NOT REQUIRED             # Ollama is self-hosted, no API key needed
  baseURL: $OLLAMA_BASE_URL          # Optional: defaults to http://localhost:11434/v1
  maxIterations: 50                  # Optional: for agentic tool calling loops
```

**Note**: Ollama is unique among providers as it runs locally on your machine. No API key or internet connection is required for inference - only the `OLLAMA_BASE_URL` environment variable pointing to your local Ollama instance.

**OpenRouter Model Examples:**
- `openai/gpt-4.1`, `openai/gpt-4.1-mini`
- `anthropic/claude-3.5-sonnet`, `anthropic/claude-3-haiku`
- `google/gemini-pro-1.5`, `meta-llama/llama-3.1-8b-instruct`
- See [OpenRouter models](https://openrouter.ai/models) for full list

### Connection Modes

MCP servers support two connection modes:

- **`lenient` (default)**: Failed connections are logged as warnings but don't prevent startup
- **`strict`**: Failed connections cause the application to exit with an error

You can override connection modes globally using the `--strict` CLI flag, which makes all MCP servers use strict mode regardless of their individual configuration.

```bash
# Force all MCP servers to use strict mode
cipher --strict

# Use individual server connection modes (default behavior)
cipher
```

### MCP Server Types

#### Stdio Servers (Local Processes)

```yaml
mcpServers:
  myserver:
    type: stdio
    command: node                  # or python, uvx, etc.
    args: ["server.js", "--port=3000"]
    env:
      API_KEY: $MY_API_KEY
    timeout: 30000
    connectionMode: lenient
```

#### SSE Servers (Server-Sent Events)

```yaml
mcpServers:
  sse_server:
    type: sse
    url: https://api.example.com/sse
    headers:
      Authorization: "Bearer $TOKEN"
    timeout: 30000
    connectionMode: strict
```

#### HTTP Servers (REST APIs)

```yaml
mcpServers:
  http_server:
    type: http
    url: https://api.example.com
    headers:
      Authorization: "Bearer $TOKEN"
      User-Agent: "Cipher/1.0"
    timeout: 30000
    connectionMode: lenient
```

### Configuration Validation

Cipher validates all configuration at startup:

- **LLM Provider**: Must be 'openai', 'anthropic', 'openrouter', or 'ollama'
- **API Keys**: Must be non-empty strings for cloud providers (OpenAI, Anthropic, OpenRouter). **NOT required for Ollama** since it's self-hosted
- **URLs**: Must be valid URLs when provided
- **Numbers**: Must be positive integers where specified
- **MCP Server Types**: Must be 'stdio', 'sse', or 'http'

### Environment Variable Expansion

You can use environment variables anywhere in the YAML configuration:

```yaml
llm:
  apiKey: $OPENAI_API_KEY          # Simple expansion
  baseURL: ${API_BASE_URL}         # Brace syntax
  model: ${MODEL_NAME:-gpt-4.1}      # With default value (syntax may vary)
```

### Configuration Loading

Cipher uses intelligent path resolution for configuration files:

1. **Default behavior**: Looks for `memAgent/cipher.yml` relative to the package installation root
2. **Custom config with `--agent`**: 
   - Absolute paths are used as-is
   - Relative paths are resolved relative to the current working directory
   - Default path is resolved relative to the package installation root
3. Environment variables are loaded from `.env` if present
4. Configuration is parsed, validated, and environment variables are expanded

**Examples:**
```bash
# Use default config (memAgent/cipher.yml in package root)
cipher

# Use custom config with absolute path
cipher --agent /home/user/my-config.yml

# Use custom config with relative path (relative to current directory)
cipher --agent ./configs/custom.yml

# Use config in current directory
cipher -a cipher-custom.yml
```

## Capabilities

### Session Management
Cipher provides advanced session management capabilities for maintaining separate conversation contexts:

- **Multiple Sessions**: Create and manage multiple conversation sessions simultaneously
- **Session Persistence**: Each session maintains its own conversation history and context
- **Session Switching**: Seamlessly switch between different sessions during CLI interactions
- **Memory Integration**: All sessions integrate with the agent's memory system for learning and retention
- **Session Lifecycle**: Automatic session cleanup with configurable TTL and maximum session limits
- **CLI Integration**: Full command-line interface for session operations with intuitive commands

**Key Features:**
- Auto-generated or custom session IDs
- Session metadata tracking (creation time, last activity, message count)
- Protection against deleting active sessions
- Session listing with visual indicators for the current active session
- Integration with the `--new-session` CLI flag for immediate session creation

### MCP Integration
Cipher handles all the complexity of MCP server connections and lifecycle management, providing seamless integration with MCP-compatible tools and services.

### Enhanced LLM Provider Support
Cipher now supports multiple LLM providers with seamless integration and advanced capabilities:

### Knowledge Graph Memory
Cipher features a sophisticated knowledge graph system that provides structured, persistent memory for agents. This system enables agents to build and maintain complex relationships between entities, concepts, and information across conversations.

#### Overview
The knowledge graph memory system transforms unstructured conversational data into a structured graph of entities and relationships. Unlike traditional flat memory systems, knowledge graphs excel at:

- **Relationship Modeling**: Capture complex relationships between entities (e.g., "John works at Google as a Software Engineer")
- **Semantic Search**: Find related information through graph traversal and relationship patterns
- **Knowledge Evolution**: Update and evolve understanding as new information becomes available
- **Contextual Retrieval**: Retrieve relevant information based on entity relationships and graph structure

#### Supported Backends

**Neo4j**
- Full-featured graph database with Cypher query support
- Advanced indexing and query optimization
- ACID transactions and data consistency
- Suitable for production workloads and complex graph operations

**In-Memory**
- Fast local storage ideal for development and testing
- No external dependencies required
- Configurable memory limits and indexing
- Automatic cleanup and garbage collection options

#### Configuration

**Environment Variables**
Add these to your `.env` file to configure knowledge graph functionality:

```bash
# Enable knowledge graph functionality
KNOWLEDGE_GRAPH_ENABLED=true

# Backend configuration
KNOWLEDGE_GRAPH_TYPE=neo4j              # or 'in-memory'

# Neo4j configuration (if using Neo4j backend)
KNOWLEDGE_GRAPH_HOST=localhost
KNOWLEDGE_GRAPH_PORT=7687
KNOWLEDGE_GRAPH_URI=bolt://localhost:7687    # Alternative to host/port
KNOWLEDGE_GRAPH_USERNAME=neo4j
KNOWLEDGE_GRAPH_PASSWORD=your_password
KNOWLEDGE_GRAPH_DATABASE=neo4j

# In-memory configuration (if using in-memory backend)
# No additional configuration required - uses sensible defaults
```

#### Backend Setup

**Neo4j Setup:**
1. **Install Neo4j**: Download from [neo4j.com](https://neo4j.com/download/)
2. **Start Neo4j**: Run Neo4j Desktop or server
3. **Create Database**: Set up your knowledge graph database
4. **Configure Authentication**: Set username/password
5. **Environment Variables**: Configure connection details in `.env`

```bash
# Example Neo4j configuration
KNOWLEDGE_GRAPH_ENABLED=true
KNOWLEDGE_GRAPH_TYPE=neo4j
KNOWLEDGE_GRAPH_HOST=localhost
KNOWLEDGE_GRAPH_PORT=7687
KNOWLEDGE_GRAPH_USERNAME=neo4j
KNOWLEDGE_GRAPH_PASSWORD=your_secure_password
KNOWLEDGE_GRAPH_DATABASE=knowledge
```

## LLM Providers

Cipher supports multiple LLM providers for maximum flexibility:

- **OpenAI**: Direct API integration for GPT models (`gpt-4.1`, `04-mini`, etc.)
- **Anthropic**: Native Claude API support (`claude-4-sonnet`, `claude-4-opus`, etc.)
- **OpenRouter**: Access to 200+ models from multiple providers through a single API
- **Ollama**: Self-hosted local models with no API costs (`qwen3:8b`, `llama3.1:8b`, `mistral:7b`, etc.) - **No API key required**

### OpenRouter Integration
OpenRouter provides access to a vast ecosystem of AI models through one unified API:

#### Supported Model Providers
- **OpenAI**: `openai/gpt-4.1`, `openai/gpt-4.1-mini`
- **Anthropic**: `anthropic/claude-4-sonnet`, `anthropic/claude-3.5-haiku`
- **Google**: `google/gemini-pro-2.5`
- **Meta**: `meta-llama/llama-3.1-8b-instruct`, `meta-llama/llama-3.1-70b-instruct`
- **Mistral**: `mistralai/mistral-7b-instruct`, `mistralai/mixtral-8x7b-instruct`
- **And 200+ more models**

#### Benefits of OpenRouter
- **Single API Key**: Access hundreds of models with one API key
- **Cost Optimization**: Choose the most cost-effective model for your use case
- **Model Diversity**: Access models from different providers without multiple integrations
- **Fallback Options**: Switch between models seamlessly if one is unavailable
- **Latest Models**: Access to cutting-edge models as soon as they're released

### Ollama Integration
Ollama enables you to run large language models locally on your machine for complete privacy and control:


We recommend these models that work great with tool calling:

**🚀 Best Performance** (if you have powerful hardware):
**DeepSeek-R1** and **Qwen3** are currently the top performers. DeepSeek-R1 offers GPT-4 level reasoning, while Qwen3 has excellent tool support across different sizes.

**🔥 High Performance** (good balance):
**Llama 3.1** and **Llama 3.3** from Meta are solid choices with great tool calling. **Hermes3** is fantastic for conversation, and **Qwen2.5** handles multiple languages really well.

**💡 For Coding**:
**Qwen2.5-Coder** is specifically designed for code generation and debugging. **DeepSeek Coder** and **Devstral** are also excellent coding assistants.

**🏃‍♂️ If you want something lightweight**:
**Phi4-Mini** from Microsoft is surprisingly capable for its size, and **Granite** from IBM offers good efficiency.

Pick any model from these families - start with smaller sizes like 8B or 14B if you're not sure about your hardware, then upgrade to 32B or 70B for better performance once you know what works.

#### Setup Instructions
1. **Install Ollama**: Download from [ollama.com](https://ollama.com)
2. **Choose & Pull a Model** (based on your hardware):
   ```bash
   # For high-end hardware (32GB+ VRAM)
   ollama pull qwen3:32b           # or llama3.1:70b
   
   # For mid-range hardware (8-16GB VRAM)  
   ollama pull qwen3:8b            # or llama3.1:8b
   
   # For resource-constrained hardware (4GB VRAM)
   ollama pull phi4-mini:3.8b      # or granite3.3:2b
   ```
3. **Set Environment**: `OLLAMA_BASE_URL=http://localhost:11434/v1`
4. **Configure Cipher**: Use `provider: ollama` in your `cipher.yml`
5. **Check Model Status**: `ollama list` to verify your model is available

#### Configuration Examples

**For High Performance (if you have good hardware):**
```yaml
llm:
  provider: ollama
  model: qwen3:32b                   # 32B model for excellent performance
  baseURL: $OLLAMA_BASE_URL          # Points to your local Ollama instance
  maxIterations: 50                  # For agentic tool calling loops
```

**For Maximum Performance (requires high-end hardware):**
```yaml
llm:
  provider: ollama
  model: llama3.1:70b                # 70B model for best results
  baseURL: $OLLAMA_BASE_URL          # Points to your local Ollama instance
  maxIterations: 50                  # For agentic tool calling loops
```

**For Balanced Performance/Resources:**
```yaml
llm:
  provider: ollama
  model: qwen3:8b                    # 8B model for good balance
  baseURL: $OLLAMA_BASE_URL          # Points to your local Ollama instance
  maxIterations: 50                  # For agentic tool calling loops
```


## Contributing

We welcome contributions! Refer to our [Contributing Guide](./CONTRIBUTING.md) for more details.

## Community & Support

Join our [Discord](https://discord.com/invite/UMRrpNjh5W) to chat with the community and get support.

If you're enjoying this project, please give us a ⭐ on GitHub!

## License

[Apache License 2.0](LICENSE)
