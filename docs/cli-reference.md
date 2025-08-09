# CLI Reference

Complete command-line interface reference for Cipher, covering all modes, options, and commands.

## Basic Usage

```bash
# Interactive CLI mode
cipher

# One-shot command
cipher "Your prompt here"

# Server modes  
cipher --mode api        # REST API server
cipher --mode mcp        # MCP server  
cipher --mode ui         # Web UI server
```

## Command Syntax

```
cipher [prompt] [options]
cipher [options] [prompt]
```

## Global Options

### Core Options

| Option | Description | Example |
|--------|-------------|---------|
| `--mode <mode>` | Execution mode: `cli`, `api`, `mcp`, `ui` | `cipher --mode api` |
| `--agent <path>` | Custom configuration file path | `cipher --agent /path/to/config.yml` |
| `--new-session [id]` | Start with new session | `cipher --new-session project-alpha` |
| `--strict` | Strict MCP connections only | `cipher --mode mcp --strict` |
| `--help` | Show help information | `cipher --help` |
| `--version` | Show version information | `cipher --version` |

### API Mode Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--port <number>` | API server port | 3000 | `cipher --mode api --port 8080` |
| `--host <address>` | API server host | localhost | `cipher --mode api --host 0.0.0.0` |
| `--cors` | Enable CORS | false | `cipher --mode api --cors` |

### MCP Mode Options  

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--mcp-transport-type <type>` | Transport: `stdio`, `sse`, `streamable-http` | stdio | `cipher --mode mcp --mcp-transport-type sse` |
| `--mcp-port <number>` | MCP server port (for SSE/HTTP) | 3000 | `cipher --mode mcp --mcp-port 4000` |
| `--timeout <ms>` | Tool execution timeout | 60000 | `cipher --mode mcp --timeout 120000` |

### UI Mode Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--ui-port <number>` | Web UI port | 3001 | `cipher --mode ui --ui-port 8080` |
| `--ui-host <address>` | Web UI host | localhost | `cipher --mode ui --ui-host 0.0.0.0` |

## Execution Modes

### CLI Mode (Default)

Interactive command-line interface:

```bash
# Start interactive mode
cipher

# Direct prompt execution
cipher "Add this to memory: CORS issues in Vite are usually solved by configuring the proxy"

# With custom config
cipher --agent ./my-config.yml "What do I know about authentication?"
```

**Features:**
- Interactive chat interface
- Session management
- Memory integration
- Tool access

### API Mode

RESTful HTTP API server:

```bash
# Basic API server
cipher --mode api

# Custom port and host
cipher --mode api --port 8080 --host 0.0.0.0 --cors

# With custom agent config
cipher --mode api --agent ./production-config.yml
```

**API Endpoints:**
- `POST /api/chat` - Send messages
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `GET /api/config` - Get configuration

### MCP Mode

Model Context Protocol server:

```bash
# Standard MCP server (stdio)
cipher --mode mcp

# SSE transport
cipher --mode mcp --mcp-transport-type sse --mcp-port 4000

# HTTP transport  
cipher --mode mcp --mcp-transport-type http --mcp-port 4000

# Strict mode (reject invalid connections)
cipher --mode mcp --strict
```

**Environment Variables for MCP:**
```bash
# MCP server behavior
export MCP_SERVER_MODE=aggregator  # or 'default'
export AGGREGATOR_CONFLICT_RESOLUTION=prefix  # 'first-wins', 'error'
export AGGREGATOR_TIMEOUT=60000
```

### UI Mode

Web interface server:

```bash
# Start web UI
cipher --mode ui

# Custom port
cipher --mode ui --ui-port 8080

# Accessible from network
cipher --mode ui --ui-host 0.0.0.0 --ui-port 3001
```

**Access:** Open `http://localhost:3001` in your browser

## Interactive CLI Commands

When running in CLI mode, use these commands within the session:

### Session Management

| Command | Description | Example |
|---------|-------------|---------|
| `/session list` | List all sessions | `/session list` |
| `/session new [id]` | Create new session | `/session new project-beta` |
| `/session switch <id>` | Switch to session | `/session switch default` |
| `/session delete <id>` | Delete session | `/session delete old-session` |
| `/session rename <old> <new>` | Rename session | `/session rename temp project-final` |

### System Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/config` | Show current configuration | `/config` |
| `/stats` | Show usage statistics | `/stats` |
| `/help` | Show help | `/help` |
| `/clear` | Clear screen | `/clear` |
| `/exit` | Exit Cipher | `/exit` |

### Available CLI Commands (Actual Implementation)

| Command | Description | Example |
|---------|-------------|---------|
| `/help [command]` | Show help information | `/help session` |
| `/exit` | Exit the CLI session | `/exit` |
| `/clear` | Reset conversation history for current session | `/clear` |
| `/config` | Display current configuration | `/config` |
| `/stats` | Show system statistics and metrics | `/stats` |
| `/tools` | List all available tools | `/tools` |
| `/prompt` | Display current system prompt | `/prompt` |
| `/session <subcommand>` | Manage conversation sessions | `/session list` |

### Session Management Subcommands

| Subcommand | Description | Example |
|------------|-------------|---------|
| `/session list` | List all sessions with status and activity | `/session list` |
| `/session new [name]` | Create new session (optional custom name) | `/session new project-alpha` |
| `/session switch <id>` | Switch to different session | `/session switch default` |
| `/session current` | Show current session info | `/session current` |
| `/session delete <id>` | Delete session (cannot delete active) | `/session delete old-session` |
| `/session delete all` | Delete all sessions except active | `/session delete all` |

### Advanced Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/prompt-stats` | Show system prompt performance statistics | `/prompt-stats --detailed` |
| `/prompt-providers <subcommand>` | Manage system prompt providers | `/prompt-providers list` |
| `/show-prompt` | Display system prompt with enhanced formatting | `/show-prompt --detailed` |

## Configuration File

Specify custom configuration with `--agent`:

```bash
cipher --agent /path/to/custom-config.yml
```

**Default locations:**
1. `./memAgent/cipher.yml`
2. `~/.config/cipher/cipher.yml` 
3. `/etc/cipher/cipher.yml`

## Environment Variables

Set these in your `.env` file or environment:

### Core Settings
```bash
# LLM Configuration
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key

# Memory Settings  
USE_WORKSPACE_MEMORY=true
DISABLE_REFLECTION_MEMORY=false

# Vector Store
VECTOR_STORE_TYPE=qdrant
VECTOR_STORE_URL=your-endpoint

# Chat History
CIPHER_PG_URL=postgresql://user:pass@host:5432/db
```

### MCP-Specific Settings
```bash
# MCP server mode
MCP_SERVER_MODE=aggregator  # or 'default'
AGGREGATOR_CONFLICT_RESOLUTION=prefix
AGGREGATOR_TIMEOUT=60000

# Transport settings
MCP_TRANSPORT_TYPE=stdio  # stdio, sse, http
MCP_PORT=3000
```

## Examples

### Development Setup
```bash
# Start with in-memory storage for testing
VECTOR_STORE_TYPE=in-memory cipher

# Start API server for development
cipher --mode api --port 8080 --cors

# Test MCP integration
cipher --mode mcp --mcp-transport-type sse --mcp-port 4000
```

### Production Deployment
```bash
# Production API server
cipher --mode api --port 3000 --host 0.0.0.0 --agent /etc/cipher/production.yml

# MCP server with custom timeout
cipher --mode mcp --timeout 120000 --agent /etc/cipher/mcp-config.yml

# Web UI for team access
cipher --mode ui --ui-port 80 --ui-host 0.0.0.0
```

### Team Collaboration
```bash
# Start workspace memory session
USE_WORKSPACE_MEMORY=true cipher --new-session team-project

# Switch between team sessions
cipher
> /session switch team-frontend
> /session switch team-backend
```

### Memory Management
```bash
# Search specific memories
cipher "What do I know about React hooks?"

# Add structured knowledge
cipher "Remember: Next.js 13+ uses app directory structure with layout.tsx and page.tsx files"

# Memory statistics
cipher
> /memory stats
> /stats
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Connection error |
| 4 | Authentication error |
| 5 | Permission error |

## Troubleshooting

### Common Issues

**Command not found:**
```bash
# Install globally
npm install -g @byterover/cipher

# Or use npx
npx @byterover/cipher --help
```

**Configuration errors:**
```bash
# Check configuration
cipher --config

# Use verbose logging
DEBUG=cipher:* cipher --mode api
```

**MCP connection issues:**
```bash  
# Test MCP server
cipher --mode mcp --timeout 30000

# Check MCP transport
cipher --mode mcp --mcp-transport-type http --mcp-port 4000
```

## Related Documentation

- [Configuration](./configuration.md) - Main configuration options
- [MCP Integration](./mcp-integration.md) - MCP server setup and usage  
- [Chat History](./chat-history.md) - Session storage and management