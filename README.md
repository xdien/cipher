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

**Cipher is the coding agent that remembers everything.** Built on the [Model Context Protocol](https://modelcontextprotocol.io/introduction), cipher solves the memory loss problem in AI-assisted development.

Traditional AI coding assistants suffer from memory loss between sessions, leading to repetitive explanations and lost context. Cipher transforms any AI coding assistant into a **persistent coding companion** that:

- **Remembers** your codebase architecture, patterns, and project structure
- **Learns** your preferences and problem-solving approaches  
- **Builds context** over time with each session
- **Works with** Cursor IDE, Claude Desktop, Claude Code, and any MCP-compatible tool

## Documentation

For detailed documentation including:
- Complete API reference
- Advanced configuration options
- Docker deployment guides
- Extensive usage examples
- Troubleshooting guides

Visit our [full documentation](https://docs.cipher.dev) (coming soon) or explore the complete README sections below.

## Installation

### Quick Start with Docker (Recommended)

```bash
# Clone and setup
git clone https://github.com/campfirein/cipher.git
cd cipher

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start with Docker
docker-compose up -d

# Test
curl http://localhost:3000/health
```

### From Source

```bash
pnpm i && pnpm run build && npm link
```

### CLI Usage

```bash
# Interactive mode
cipher

# One-shot command
cipher "What is binary search?"

# API server mode
cipher --mode api

# MCP server mode
cipher --mode mcp
```

## Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`) and configure:

```bash
# Required: At least one API key
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: For local models (no API key needed)
OLLAMA_BASE_URL=http://localhost:11434/v1

# Application settings
NODE_ENV=production
CIPHER_LOG_LEVEL=info
```

## Run Modes

Cipher supports multiple operational modes to fit different usage patterns:

### CLI Mode (Interactive)

Interactive command-line interface for direct conversation with your memory-powered agent:

```bash
# Run in interactive CLI mode (default)
cipher

# Start with custom session
cipher --new-session my-project
```

**Key Features:**
- Real-time conversation with persistent memory
- Session management with `/session` commands
- Command history and tab completion
- Smart logging with AI thinking steps

### One-Shot Mode (Headless)

Execute a single prompt and exit:

```bash
# One-shot command execution
cipher "analyze this code"
cipher "remember I'm working on authentication"

# Works with all flags
cipher --strict "analyze this error"
cipher --new-session debug "fix this bug"
```

### API Mode (REST Server)

Run cipher as a REST API server:

```bash
# Start API server (default: localhost:3000)
cipher --mode api

# Custom host/port
cipher --mode api --host 0.0.0.0 --port 8080
```

**Features:**
- RESTful API endpoints for agent interaction
- Session management via HTTP requests
- Message processing with image support
- Health check endpoints

### MCP Server Mode

Run cipher as a Model Context Protocol server:

```bash
# Run as MCP server
cipher --mode mcp
```

**Features:**
- Full agent exposure as MCP server
- `ask_cipher` tool for MCP protocol interaction
- Agent resources and runtime statistics
- Integration with VS Code, Claude Desktop, and other MCP tools

### Common Options

```bash
# Use custom agent config
cipher --agent /path/to/config.yml

# Strict mode (all MCP connections must succeed)
cipher --strict

# Start with new session
cipher --new-session [sessionId]

# Show help
cipher --help
```

### CLI Commands

**Session Management:**
```bash
/session list                 # List all sessions
/session new [sessionId]      # Create new session
/session switch <sessionId>   # Switch to session
/session current              # Show current session
/session delete <sessionId>   # Delete session
```

**System Commands:**
```bash
/config                      # Show configuration
/stats                       # Show statistics
/tools                       # List MCP tools
/help                        # Show help
/clear                       # Reset conversation
/exit                        # Exit CLI
```

## API Usage

When running cipher in API mode (`--mode api`), it exposes a REST API for programmatic interaction with the agent.

### Starting the API Server

```bash
# Start API server on default port (3000)
cipher --mode api

# Start on custom host and port
cipher --mode api --host 0.0.0.0 --port 8080
```

### Key Endpoints

#### Health Check
```bash
GET /health
```

#### Message Processing
```bash
# Send message to agent
POST /api/message/sync
Content-Type: application/json

{
  "message": "Hello, how are you?",
  "sessionId": "my-session-id",        # Optional
  "images": ["base64-encoded-image"]   # Optional
}
```

#### Session Management
```bash
# List all sessions
GET /api/sessions

# Create new session
POST /api/sessions
{"sessionId": "custom-session-id"}  # Optional

# Get session history
GET /api/sessions/{sessionId}/history

# Switch to session
POST /api/sessions/{sessionId}/load

# Delete session
DELETE /api/sessions/{sessionId}
```

### Quick Examples

```bash
# Start API server
cipher --mode api

# Send a message
curl -X POST http://localhost:3000/api/message/sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, cipher!"}'

# Create a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-chat"}'
```

For detailed API documentation, client examples, and error handling, visit our [API Documentation](https://docs.cipher.dev/api).

## Docker Deployment

Deploy Cipher as a Docker container for production use.

### Quick Start with Docker

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 2. Start with Docker Compose (Recommended)
docker-compose up -d

# 3. Test the API
curl http://localhost:3000/health
```

### Manual Docker Commands

```bash
# Build the image
docker build -t cipher-api .

# Run with environment file
docker run -d -p 3000:3000 --name cipher-api --env-file .env cipher-api

# Run with individual environment variables
docker run -d -p 3000:3000 --name cipher-api \
  -e OPENAI_API_KEY="your_openai_api_key" \
  -e NODE_ENV=production \
  cipher-api
```

### Basic Testing

```bash
# Health check
curl http://localhost:3000/health

# Send a message
curl -X POST http://localhost:3000/api/message/sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'

# Create a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-test-session"}'
```

### Management Commands

```bash
# View containers
docker-compose ps

# View logs
docker-compose logs -f cipher-api

# Stop/start/restart
docker-compose stop/start/restart

# Remove containers
docker-compose down
```

### Troubleshooting

**Container won't start:**
- Check logs: `docker logs cipher-api`
- Verify API keys in `.env` file
- Ensure port 3000 is available

**API not responding:**
- Check container status: `docker ps`
- Test from inside container: `docker exec cipher-api wget -qO- http://localhost:3000/health`

For detailed Docker deployment guides, advanced configurations, and troubleshooting, visit our [Docker Documentation](https://docs.cipher.dev/docker).

## Usage

### CLI Mode (Interactive)

```bash
# Interactive mode (default)
cipher

# One-shot command
cipher "analyze this code"

# With custom session
cipher --new-session my-session
```

### API Mode (REST Server)

```bash
# Start API server
cipher --mode api

# Test the API
curl -X POST http://localhost:3000/api/message/sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

### MCP Server Mode

```bash
# Run as MCP server
cipher --mode mcp
```

**Note**: Ensure all required environment variables are properly configured in your `.env` file before running in MCP server mode, as the server needs access to your API keys and other configurations to function properly.

## Core Features

### Memory System
- **Layered Memory**: Improves with every interaction
- **Knowledge Graph**: Structured relationship storage
- **Reflection Mechanisms**: Learn from previous actions

### Session Management
- Multiple concurrent sessions
- Session persistence and switching
- CLI commands: `/session new`, `/session list`, `/session switch`

### LLM Providers

| Provider | Key Models | Benefits |
|----------|------------|----------|
| **OpenAI** | GPT-4.1, GPT-4.1-mini, o4-mini | Latest GPT models with excellent reasoning |
| **Anthropic** | Claude-4-Sonnet, Claude-3.5-Haiku, Claude-3-7-Sonnet | Superior code understanding and generation |
| **OpenRouter** | 200+ models from multiple providers | Access to all major models via single API |
| **Ollama** | Qwen3, Llama3.1, DeepSeek-R1, Phi4-Mini | Local models, no API costs, complete privacy |

### MCP Integration
- Automatic server lifecycle management
- Support for stdio, SSE, and HTTP connections
- Strict/lenient connection modes


## Contributing

We welcome contributions! Refer to our [Contributing Guide](./CONTRIBUTING.md) for more details.

## Community & Support

Join our [Discord](https://discord.com/invite/UMRrpNjh5W) to chat with the community and get support.

If you're enjoying this project, please give us a ⭐ on GitHub!

## Contributors

[Elastic License 2.0](LICENSE)
