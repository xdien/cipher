# Cipher

<div align="center">

<img src="./assets/cipher-logo.png" alt="Cipher Agent Logo" width="400" />

<p align="center">
<em>Memory-powered AI agent framework with MCP integration</em>
</p>

<p align="center">
<a href="LICENSE"><img src="https://img.shields.io/badge/License-Elastic%202.0-blue.svg" alt="License" /></a>
<img src="https://img.shields.io/badge/Status-Beta-orange.svg" alt="Beta" />
<a href="https://docs.byterover.dev/cipher/overview"><img src="https://img.shields.io/badge/Docs-Documentation-green.svg" alt="Documentation" /></a>
<a href="https://discord.com/invite/UMRrpNjh5W"><img src="https://img.shields.io/badge/Discord-Join%20Community-7289da" alt="Discord" /></a>
</p>

</div>

## Overview

Cipher is an opensource memory layer specifically designed for coding agents. Compatible with **Cursor, Windsurf, Claude Desktop, Claude Code, Gemini CLI, AWS's Kiro, VS Code, and Roo Code** through MCP, and coding agents, such as **Kimi K2**. (see more on [examples](./examples))

Built by [Byterover team](https://byterover.dev/)

**Key Features:**

- 🔌 MCP integration with any IDE you want.
- 🧠 Auto-generate AI coding memories that scale with your codebase.
- 🔄 Switch seamlessly between IDEs without losing memory and context.
- 🤝 Easily share coding memories across your dev team in real time.
- 🧬 Dual Memory Layer that captures System 1 (Programming Concepts & Business Logic & Past Interaction) and System 2 (reasoning steps of the model when generating code).
- ⚙️ Install on your IDE with zero configuration needed.

## Quick Start 🚀

### NPM Package (Recommended for Most Users)

```bash
# Install globally
npm install -g @byterover/cipher

# Or install locally in your project
npm install @byterover/cipher
```

### Docker

<details>
<summary>Show Docker Setup</summary>

```bash
# Clone and setup
git clone https://github.com/campfirein/cipher.git
cd cipher

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start with Docker
docker-compose up --build -d

# Test
curl http://localhost:3000/health
```

> **💡 Note:** Docker builds automatically skip the UI build step to avoid ARM64 compatibility issues with lightningcss. The UI is not included in the Docker image by default.
>
> To include the UI in the Docker build, use: `docker build --build-arg BUILD_UI=true .`
</details>

### From Source

```bash
pnpm i && pnpm run build && npm link
```

### CLI Usage 💻

<details>
<summary>Show CLI commands</summary>

```bash
# Interactive mode
cipher

# One-shot command
cipher "Add this to memory as common causes of 'CORS error' in local dev with Vite + Express."

# API server mode
cipher --mode api

# MCP server mode
cipher --mode mcp

# Web UI mode
cipher --mode ui
```

> **⚠️ Note:** When running MCP mode in terminal/shell, export all environment variables as Cipher won't read from `.env` file.
>
> **💡 Tip:** CLI mode automatically continues or creates the "default" session. Use `/session new <session-name>` to start a fresh session.

</details>

![Cipher Web UI](./assets/cipher_webUI.png)

_The Cipher Web UI provides an intuitive interface for interacting with memory-powered AI agents, featuring session management, tool integration, and real-time chat capabilities._

## Configuration

Cipher supports multiple configuration options for different deployment scenarios. The main configuration file is located at `memAgent/cipher.yml`.

### Basic Configuration ⚙️

<details>
<summary>Show YAML example</summary>

```yaml
# LLM Configuration
llm:
  provider: openai # openai, anthropic, openrouter, ollama, qwen
  model: gpt-4-turbo
  apiKey: $OPENAI_API_KEY

# System Prompt
systemPrompt: 'You are a helpful AI assistant with memory capabilities.'

# MCP Servers (optional)
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.']
```

</details>

### Detailed Configuration

For comprehensive configuration options including:

- **LLM Providers** - OpenAI, Anthropic, AWS Bedrock, Azure, Qwen, Ollama, LM Studio
- **Embedding Configuration** - Multiple embedding providers and settings
- **Vector Stores** - Qdrant, Milvus, In-Memory options
- **Chat History** - PostgreSQL, SQLite, In-Memory storage

📖 **See [Configuration Guide](./docs/configuration.md)** for complete details.

### Environment Variables 🔐

Create a `.env` file in your project root with these essential variables:

<details>
<summary>Show .env template</summary>

```bash
# ====================
# API Keys (At least one required)
# ====================
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GEMINI_API_KEY=your-gemini-api-key
QWEN_API_KEY=your-qwen-api-key

# ====================
# Vector Store (Optional - defaults to in-memory)
# ====================
VECTOR_STORE_TYPE=qdrant  # qdrant, milvus, or in-memory
VECTOR_STORE_URL=https://your-cluster.qdrant.io
VECTOR_STORE_API_KEY=your-qdrant-api-key

# ====================
# Chat History (Optional - defaults to SQLite)
# ====================
CIPHER_PG_URL=postgresql://user:pass@localhost:5432/cipher_db

# ====================
# Workspace Memory (Optional)
# ====================
USE_WORKSPACE_MEMORY=true
WORKSPACE_VECTOR_STORE_COLLECTION=workspace_memory

# ====================
# AWS Bedrock (Optional)
# ====================
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_DEFAULT_REGION=us-east-1

# ====================
# Advanced Options (Optional)
# ====================
# Logging and debugging
CIPHER_LOG_LEVEL=info  # error, warn, info, debug, silly
REDACT_SECRETS=true

# Vector store configuration
VECTOR_STORE_DIMENSION=1536
VECTOR_STORE_DISTANCE=Cosine  # Cosine, Euclidean, Dot, Manhattan
VECTOR_STORE_MAX_VECTORS=10000

# Memory search configuration
SEARCH_MEMORY_TYPE=both  # knowledge, reflection, both
DISABLE_REFLECTION_MEMORY=false
```

> **💡 Tip:** Copy `.env.example` to `.env` and fill in your values:
>
> ```bash
> cp .env.example .env
> ```

</details>

## MCP Server Usage

Cipher can run as an MCP (Model Context Protocol) server, allowing integration with MCP-compatible clients like Claude Desktop, Cursor, Windsurf, and other AI coding assistants.

### Quick Setup

To use Cipher as an MCP server in your MCP client configuration:

```json
{
	"mcpServers": {
		"cipher": {
			"type": "stdio",
			"command": "cipher",
			"args": ["--mode", "mcp"],
			"env": {
				"MCP_SERVER_MODE": "aggregator",
				"OPENAI_API_KEY": "your_openai_api_key",
				"ANTHROPIC_API_KEY": "your_anthropic_api_key"
			}
		}
	}
}
```

### Advanced MCP Features

Cipher supports advanced MCP features including:

- **Aggregator Mode** - Expose all tools and connected MCP servers
- **SSE Transport** - Real-time Server-Sent Events transport
- **Multiple Transport Types** - stdio, SSE, HTTP
- **Tool Conflict Resolution** - Handle tool name conflicts intelligently

📖 **See [MCP Integration Guide](./docs/mcp-integration.md)** for complete MCP setup and advanced features.

## Tutorial Video: Claude Code with Cipher MCP

Watch our comprehensive tutorial on how to integrate Cipher with Claude Code through MCP for enhanced coding assistance with persistent memory:

[![Cipher + Claude Code Tutorial](https://img.youtube.com/vi/AZh9Py6g07Y/maxresdefault.jpg)](https://www.youtube.com/watch?v=AZh9Py6g07Y)

> **Click the image above to watch the tutorial on YouTube.**

For detailed configuration instructions, see the [CLI Coding Agents guide](./examples/02-cli-coding-agents/README.md).

## Documentation

### 📚 Complete Documentation

| Topic                                                        | Description                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [Configuration](./docs/configuration.md)                     | Complete configuration guide including agent setup, embeddings, and vector stores |
| [LLM Providers](./docs/llm-providers.md)                     | Detailed setup for OpenAI, Anthropic, AWS, Azure, Qwen, Ollama, LM Studio         |
| [Embedding Configuration](./docs/embedding-configuration.md) | Embedding providers, fallback logic, and troubleshooting                          |
| [Vector Stores](./docs/vector-stores.md)                     | Qdrant, Milvus, In-Memory vector database configurations                          |
| [Chat History](./docs/chat-history.md)                       | PostgreSQL, SQLite session storage and management                                 |
| [CLI Reference](./docs/cli-reference.md)                     | Complete command-line interface documentation                                     |
| [MCP Integration](./docs/mcp-integration.md)                 | Advanced MCP server setup, aggregator mode, and IDE integrations                  |
| [Workspace Memory](./docs/workspace-memory.md)               | Team-aware memory system for collaborative development                            |
| [Examples](./docs/examples.md)                               | Real-world integration examples and use cases                                     |

### 🚀 Next Steps

For detailed documentation, visit:

- [Quick Start Guide](https://docs.byterover.dev/cipher/quickstart)
- [Configuration Guide](https://docs.byterover.dev/cipher/configuration)
- [Complete Documentation](https://docs.byterover.dev/cipher/overview)

## Contributing

We welcome contributions! Refer to our [Contributing Guide](./CONTRIBUTING.md) for more details.

## Community & Support

**cipher** is the opensource version of the agentic memory of [byterover](https://byterover.dev/) which is built and maintained by the byterover team.

- Join our [Discord](https://discord.com/invite/UMRrpNjh5W) to share projects, ask questions, or just say hi!
- If you enjoy cipher, please give us a ⭐ on GitHub—it helps a lot!
- Follow [@kevinnguyendn](https://x.com/kevinnguyendn) on X

## Contributors

Thanks to all these amazing people for contributing to cipher!

[Contributors](https://github.com/campfirein/cipher/graphs/contributors)

## MseeP.ai Security Assessment Badge

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/campfirein-cipher-badge.png)](https://mseep.ai/app/campfirein-cipher)

## Star History

<a href="https://star-history.com/#campfirein/cipher&Date">
  <img width="500" alt="Star History Chart" src="https://api.star-history.com/svg?repos=campfirein/cipher&type=Date&v=2">
</a>

## License

Elastic License 2.0. See [LICENSE](LICENSE) for full terms.
