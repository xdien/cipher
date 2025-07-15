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

## Table of Contents

- [Overview](#overview)
- [Documentation](#documentation)
- [Installation](#installation)
- [Configuration](#configuration)
- [Run Modes](#run-modes)
  - [CLI Mode (Interactive)](#cli-mode-interactive)
  - [One-Shot Mode (Headless)](#one-shot-mode-headless)
  - [API Mode (REST Server)](#api-mode-rest-server)
  - [MCP Server Mode](#mcp-server-mode)
- [Usage](#usage)
- [API Usage](#api-usage)
- [Docker Deployment](#docker-deployment)
- [Core Features](#core-features)
- [Contributing](#contributing)
- [Community & Support](#community--support)
- [License](#license)

## Overview

**Cipher is the coding agent that remembers everything.** Built on the [Model Context Protocol](https://modelcontextprotocol.io/introduction), cipher solves the biggest problem in AI-assisted development: your coding assistant forgetting everything between sessions.

### The Problem Every Developer Faces

Traditional AI coding assistants suffer from memory loss:
- 🔄 **Repetitive explanations** of the same codebase concepts
- 🧩 **Lost context** about project architecture and decisions  
- 📝 **Inconsistent coding patterns** across different sessions
- 🔍 **No learning** from past solutions and debugging approaches

### Cipher: Your Persistent Coding Companion

Cipher transforms any AI coding assistant into a **persistent coding companion** that grows smarter with every interaction:

**🧠 Persistent Memory System**
- Remembers your codebase architecture, patterns, and project structure
- Learns your preferences and problem-solving approaches
- Builds context over time with each session
- Maintains project history and decisions

**🔗 Works with Your Favorite Tools**
- **Cursor IDE**: Enhanced AI assistance with project memory
- **Claude Desktop**: Persistent context across coding sessions
- **Claude Code**: Command-line development with continuous memory
- **Any MCP-compatible tool**: Extensible to new platforms

**🚀 Immediate Benefits**
- Faster onboarding for new team members
- Consistent architecture and coding patterns
- Smarter debugging with past solution learning
- Team knowledge sharing and collective memory

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

Configure Cipher using environment variables and YAML config:

### Environment Variables (.env)

```bash
# Required: At least one API key (except Ollama)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Ollama (self-hosted, no API key needed)
OLLAMA_BASE_URL=http://localhost:11434/v1

# Application settings
NODE_ENV=development
CIPHER_LOG_LEVEL=info
NODE_ENV=production
CIPHER_LOG_LEVEL=info
```

## Run Modes

Cipher supports multiple operational modes to fit different usage patterns:

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
- Rich command system with slash commands
- Session management capabilities
- Graceful exit with `exit` or `quit` commands
- Signal handling (Ctrl+C) for clean shutdown
- Smart logging: Shows AI thinking steps (💭) and tool usage (🔧) in info mode, detailed context in debug mode

### One-Shot Mode (Headless)

Execute a single prompt and exit without starting an interactive session:

```bash
# One-shot command execution
cipher "what is ourn own logics of implementing the binary search tree?"
cipher task "store this logics (logics...) to the memory"

# Works with all existing flags
cipher --strict "analyze this code"
cipher --new-session debug-session "fix this bug"
cipher --mode cli "remember this important detail"
```

**Key Features:**

- **Quick Execution**: Run a single prompt and exit immediately
- **Full Compatibility**: Works with all existing CLI flags (`--strict`, `--new-session`, `--mode`, etc.)
- **Memory Integration**: All interactions are stored in memory for future reference
- **Processing Feedback**: Shows "🤔 Processing..." indicator while working
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Clean Exit**: Proper process termination after execution

**Usage Examples:**

```bash
# Simple one-shot command
cipher "What's the weather like?"

# Store information to memory
cipher "Remember that I'm working on the authentication module"

# Quick analysis with strict mode
cipher --strict "Analyze this error message for me"

# Create a new session and execute
cipher --new-session analysis-work "Help me understand this algorithm"

# Use with custom agent configuration
cipher --agent ./my-config.yml "Process this data"
```

The one-shot mode is perfect for:

- Quick queries that don't need ongoing conversation
- Storing information to memory from scripts
- Integrating cipher into automated workflows
- Testing prompts without starting interactive mode

## Using Custom Metadata in Cipher CLI

Firstly, start the interactive CLI

```sh
# Start with node command
node dist/cli.js
```

or

```sh
# Start with pnpm command
pnpm cli
```

Then, to send custom metadata with your message, use the `!meta` command:

```bash
# Command:
cipher> !meta key1=value1,key2=value2 Your message here

# Example:
cipher> !meta foo=bar,baz=qux The capital of France is Paris.
```

This attaches `{ foo: "bar", baz: "qux" }` as metadata to the message.

### API Mode (REST Server)

Runs cipher as a REST API server, allowing HTTP clients to interact with the agent programmatically:

```bash
# Run as API server (default: localhost:3000)
cipher --mode api

# Run on custom host/port
cipher --mode api --host 0.0.0.0 --port 8080
```

**Features:**

- RESTful API endpoints for agent interaction
- Session management via HTTP requests
- Message processing with image support
- Health check endpoints
- CORS support for web applications
- Request/response logging and security middleware
- Rate limiting for API protection

### MCP Server Mode

Runs cipher as a Model Context Protocol server, exposing the full AI agent as an MCP server that other MCP-compatible tools can connect to and interact with:

```bash
# Run as MCP server
cipher --mode mcp
```

**Features:**

- **Full Agent Exposure**: Exposes the complete Cipher agent as an MCP server
- **ask_cipher Tool**: Primary tool for chatting with the agent via MCP protocol
- **Agent Resources**: Exposes agent metadata and runtime statistics
- **System Prompts**: Access to current system prompts used by the agent
- **Session Management**: Maintains conversation context across MCP client connections
- **Stdio Transport**: Uses stdio for direct process communication with MCP clients
- **Log Redirection**: Automatically redirects logs to file to prevent stdio interference
- **Memory Integration**: Full access to agent's memory and learning capabilities

**Available MCP Capabilities:**

- **Tools**:
  - `ask_cipher`: Send messages to interact with the Cipher agent
    - Parameters: `message` (required), `session_id` (optional), `stream` (optional)
    - Returns: Agent response as formatted text

- **Resources**:
  - `cipher://agent/card`: Agent metadata and configuration information
  - `cipher://agent/stats`: Runtime statistics including session count, MCP connections, uptime, and memory usage

- **Prompts**:
  - `system_prompt`: Retrieve the current system prompt used by the agent

**Usage Example with MCP Client:**

```bash
# Start cipher as MCP server
cipher --mode mcp

# In another terminal, connect with an MCP client
# The server will be available via stdio transport
```

**Integration with MCP-compatible Tools:**

The MCP server mode allows Cipher to integrate with any MCP-compatible tool or client, including:

- VS Code extensions with MCP support
- Claude Desktop with MCP server configuration
- Custom MCP clients and tools
- Other AI agents that support MCP protocol

This mode transforms Cipher into a reusable agent service that can be accessed by multiple tools simultaneously while maintaining persistent memory and learning capabilities.

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
cipher -s

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

## API Usage

When running cipher in API mode (`--mode api`), it exposes a comprehensive REST API for programmatic interaction with the agent. The API provides endpoints for message processing, session management, and system information.

### Starting the API Server

```bash
# Start API server on default port (3000)
cipher --mode api

# Start on custom host and port
cipher --mode api --host 0.0.0.0 --port 8080

# Start with specific agent configuration
cipher --mode api --agent ./custom-config.yml --port 5000
```

### API Endpoints

#### Health Check

```bash
# Check if the API server is running
GET /health

# Response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "version": "1.0.0"
}
```

#### Message Processing

**Send Message to Agent**

```bash
# Process a message synchronously
POST /api/message/sync
Content-Type: application/json

{
  "message": "Hello, how are you?",
  "sessionId": "my-session-id",        # Optional: defaults to current session
  "images": ["base64-encoded-image"]   # Optional: array of base64 images
}

# Response:
{
  "success": true,
  "data": {
    "response": "Hello! I'm doing well, thank you for asking...",
    "sessionId": "my-session-id",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "req-123456"
}
```

**Reset Conversation**

```bash
# Reset current session's conversation history
POST /api/message/reset
Content-Type: application/json

{
  "sessionId": "my-session-id"  # Optional: defaults to current session
}

# Response:
{
  "success": true,
  "data": {
    "message": "Session my-session-id has been reset",
    "sessionId": "my-session-id",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "req-123456"
}
```

#### Session Management

**List All Sessions**

```bash
# Get all active sessions with metadata
GET /api/sessions

# Response:
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session-1",
        "messageCount": 15,
        "createdAt": "2024-01-15T09:00:00.000Z",
        "lastActivity": "2024-01-15T10:25:00.000Z"
      }
    ],
    "count": 1,
    "currentSession": "session-1"
  },
  "requestId": "req-123456"
}
```

**Create New Session**

```bash
# Create a new session
POST /api/sessions
Content-Type: application/json

{
  "sessionId": "custom-session-id"  # Optional: auto-generated if not provided
}

# Response:
{
  "success": true,
  "data": {
    "sessionId": "custom-session-id",
    "created": true,
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "req-123456"
}
```

**Get Current Session**

```bash
# Get current active session information
GET /api/sessions/current

# Response:
{
  "success": true,
  "data": {
    "sessionId": "current-session-id",
    "metadata": {
      "id": "current-session-id",
      "messageCount": 5,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "lastActivity": "2024-01-15T10:30:00.000Z"
    },
    "isCurrent": true
  },
  "requestId": "req-123456"
}
```

**Get Session Details**

```bash
# Get specific session information
GET /api/sessions/{sessionId}

# Response:
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "metadata": {
      "id": "session-123",
      "messageCount": 10,
      "createdAt": "2024-01-15T09:30:00.000Z",
      "lastActivity": "2024-01-15T10:15:00.000Z"
    },
    "isCurrent": false
  },
  "requestId": "req-123456"
}
```

**Load Session (Switch To)**

```bash
# Switch to a different session
POST /api/sessions/{sessionId}/load

# Response:
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "loaded": true,
    "currentSession": "session-123",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "req-123456"
}
```

**Get Session History**

```bash
# Get conversation history for a session
GET /api/sessions/{sessionId}/history

# Response:
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "history": [
      {
        "role": "user",
        "content": "Hello",
        "timestamp": "2024-01-15T10:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Hello! How can I help you today?",
        "timestamp": "2024-01-15T10:00:05.000Z"
      }
    ],
    "count": 2,
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "req-123456"
}
```

**Delete Session**

```bash
# Delete a session (cannot delete currently active session)
DELETE /api/sessions/{sessionId}

# Response:
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "deleted": true,
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "req-123456"
}
```

### Error Handling

The API uses standardized error responses:

```bash
# Example error response
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session session-123 not found",
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "requestId": "req-123456"
}
```

**Common Error Codes:**

- `VALIDATION_ERROR`: Invalid request parameters
- `SESSION_NOT_FOUND`: Session doesn't exist
- `INTERNAL_ERROR`: Server-side error
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `BAD_REQUEST`: Malformed request
- `UNAUTHORIZED`: Authentication required (if implemented)

### API Usage Examples

**Using curl:**

```bash
# Start cipher API server
cipher --mode api --port 3000

# Send a message
curl -X POST http://localhost:3000/api/message/sync \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather like?"}'

# Create a new session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "weather-chat"}'

# List all sessions
curl http://localhost:3000/api/sessions

# Get session history
curl http://localhost:3000/api/sessions/weather-chat/history
```

**Using JavaScript/Node.js:**

```javascript
// Example client for cipher API
class CipherClient {
	constructor(baseUrl = 'http://localhost:3000') {
		this.baseUrl = baseUrl;
	}

	async sendMessage(message, sessionId = null, images = null) {
		const response = await fetch(`${this.baseUrl}/api/message/sync`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				message,
				sessionId,
				images,
			}),
		});

		return response.json();
	}

	async createSession(sessionId = null) {
		const response = await fetch(`${this.baseUrl}/api/sessions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ sessionId }),
		});

		return response.json();
	}

	async listSessions() {
		const response = await fetch(`${this.baseUrl}/api/sessions`);
		return response.json();
	}

	async getSessionHistory(sessionId) {
		const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/history`);
		return response.json();
	}
}

// Usage example
const client = new CipherClient();

(async () => {
	// Create a new session
	const session = await client.createSession('my-chat');
	console.log('Created session:', session.data.sessionId);

	// Send a message
	const response = await client.sendMessage('Hello, cipher!', session.data.sessionId);
	console.log('Agent response:', response.data.response);

	// Get conversation history
	const history = await client.getSessionHistory(session.data.sessionId);
	console.log('Chat history:', history.data.history);
})();
```

**Using Python:**

```python
import requests
import json

class CipherClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()

    def send_message(self, message, session_id=None, images=None):
        url = f"{self.base_url}/api/message/sync"
        data = {"message": message}

        if session_id:
            data["sessionId"] = session_id
        if images:
            data["images"] = images

        response = self.session.post(url, json=data)
        return response.json()

    def create_session(self, session_id=None):
        url = f"{self.base_url}/api/sessions"
        data = {}
        if session_id:
            data["sessionId"] = session_id

        response = self.session.post(url, json=data)
        return response.json()

    def list_sessions(self):
        url = f"{self.base_url}/api/sessions"
        response = self.session.get(url)
        return response.json()

    def get_session_history(self, session_id):
        url = f"{self.base_url}/api/sessions/{session_id}/history"
        response = self.session.get(url)
        return response.json()

# Usage example
client = CipherClient()

# Create a new session
session = client.create_session("python-chat")
print(f"Created session: {session['data']['sessionId']}")

# Send a message
response = client.send_message("Hello from Python!", session['data']['sessionId'])
print(f"Agent response: {response['data']['response']}")

# Get conversation history
history = client.get_session_history(session['data']['sessionId'])
print(f"Chat history: {history['data']['history']}")
```

### API Server Configuration

The API server supports various configuration options:

```bash
# Custom host and port
cipher --mode api --host 0.0.0.0 --port 8080

# With custom agent configuration
cipher --mode api --agent ./my-config.yml --port 5000

# Combined with other options
cipher --mode api --host 0.0.0.0 --port 8080 --agent ./config.yml --strict
```

## Docker Deployment

Cipher can be easily deployed as a Docker container for production use. The Docker setup provides a secure, optimized environment for running Cipher in API mode.

### Quick Start with Docker

**Prerequisites:**

- Docker and Docker Compose installed on your system
- A configured `.env` file with your API keys

**Step 1: Prepare Environment**

```bash
# Copy and configure environment variables
cp .env.example .env

# Edit .env with your API keys
nano .env  # or use your preferred editor
```

**Step 2: Start with Docker Compose (Recommended)**

```bash
# Start the service
docker-compose up -d

# Check if it's running
docker-compose ps
```

**Step 3: Test the API**

```bash
# Health check
curl http://localhost:3000/health

# Should return: {"status":"healthy","timestamp":"...","uptime":...}
```

### Manual Docker Commands

If you prefer to use Docker directly without Docker Compose:

**Build the image:**

```bash
docker build -t cipher-api .
```

**Run with environment file:**

```bash
docker run -d -p 3000:3000 --name cipher-api --env-file .env cipher-api
```

**Run with individual environment variables:**

```bash
docker run -d -p 3000:3000 --name cipher-api \
  -e OPENAI_API_KEY="your_openai_api_key" \
  -e NODE_ENV=production \
  cipher-api
```

### Testing Your Docker Setup

Once your container is running, test all the key functionalities:

**1. Health Check**

```bash
curl http://localhost:3000/health
# Expected: {"status":"healthy","timestamp":"...","uptime":...}
```

**2. Send a Message**

```bash
curl -X POST http://localhost:3000/api/message/sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

**3. Session Management**

```bash
# Create a new session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-test-session"}'

# List all sessions
curl http://localhost:3000/api/sessions

# Send message to specific session
curl -X POST http://localhost:3000/api/message/sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about Docker", "sessionId": "my-test-session"}'

# Get conversation history
curl http://localhost:3000/api/sessions/my-test-session/history
```

**4. Validate Container Health**

```bash
# Check container status
docker ps

# View logs
docker logs cipher-api  # or docker-compose logs cipher-api

# Check container stats
docker stats cipher-api
```

### Troubleshooting Docker Setup

**Container won't start:**

```bash
# Check logs for errors
docker logs cipher-api

# Common issues:
# 1. Missing API keys - check your .env file
# 2. Port already in use - change port mapping
# 3. Invalid environment variables
```

**API not responding:**

```bash
# Check if container is running
docker ps

# Test from inside container
docker exec cipher-api wget -qO- http://localhost:3000/health

# Check port binding
docker port cipher-api
```

**Environment Variables not working:**

```bash
# Verify .env file exists and has proper format
cat .env

# Check if variables are loaded in container
docker exec cipher-api env | grep -E "(OPENAI|ANTHROPIC|OPENROUTER)"
```

### Docker Management Commands

```bash
# View running containers
docker-compose ps

# Stop the service
docker-compose stop

# Start the service
docker-compose start

# Restart the service
docker-compose restart

# View logs
docker-compose logs -f cipher-api

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes
docker-compose down -v
```

### Simple Test Script

For convenience, here's a simple test script you can save as `test-docker.sh`:

```bash
#!/bin/bash
# test-docker.sh - Simple Docker test script

echo "🐳 Testing Cipher Docker API..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}

    echo -n "Testing $description... "

    response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$url")
    status_code="${response: -3}"

    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL (HTTP $status_code)${NC}"
        echo "Response: $(cat /tmp/response.json)"
        return 1
    fi
}

# Test POST function
test_post() {
    local url=$1
    local data=$2
    local description=$3

    echo -n "Testing $description... "

    response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" -o /tmp/response.json "$url")
    status_code="${response: -3}"

    if [ "$status_code" -eq 200 ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL (HTTP $status_code)${NC}"
        echo "Response: $(cat /tmp/response.json)"
        return 1
    fi
}

# Wait for container to be ready
echo "Waiting for container to be ready..."
sleep 5

# Run tests
echo -e "${YELLOW}🧪 Running API Tests...${NC}"
echo

# Test 1: Health check
test_endpoint "http://localhost:3000/health" "Health Check"

# Test 2: Session list
test_endpoint "http://localhost:3000/api/sessions" "Session List"

# Test 3: Create session
test_post "http://localhost:3000/api/sessions" '{"sessionId": "test-session"}' "Create Session"

# Test 4: Send message
test_post "http://localhost:3000/api/message/sync" '{"message": "Hello Docker!"}' "Send Message"

# Test 5: Session history
test_endpoint "http://localhost:3000/api/sessions/test-session/history" "Session History"

echo
echo -e "${GREEN}🎉 All tests completed!${NC}"
echo "Container is ready to use at http://localhost:3000"
```

**Usage:**

```bash
# Make the script executable
chmod +x test-docker.sh

# Run the tests
./test-docker.sh
```

### Advanced Docker Configuration

#### Building the Docker Image

```bash
# Build the Docker image
docker build -t cipher-api .

# Build with custom build arguments
docker build --build-arg NODE_VERSION=20.18.1 -t cipher-api .
```

#### Running the Container

**Basic Usage:**

```bash
# Run with default configuration
docker run -p 3000:3000 --env-file .env cipher-api

# Run with custom port
docker run -p 8080:8080 --env-file .env -e PORT=8080 cipher-api

# Run in detached mode
docker run -d -p 3000:3000 --env-file .env --name cipher-api cipher-api
```

**With Custom Configuration:**

```bash
# Mount custom agent configuration
docker run -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/my-config.yml:/app/memAgent/cipher.yml \
  cipher-api

# Mount custom agent directory
docker run -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/my-agent:/app/memAgent \
  cipher-api
```

**Production Deployment:**

```bash
# Run with health checks and restart policy
docker run -d \
  --name cipher-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  --health-cmd="curl -f http://localhost:3000/health || exit 1" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  cipher-api
```

#### Docker Compose

For easier deployment and management, use Docker Compose:

```yaml
# Required: LLM Configuration
llm:
  provider: openai # openai, anthropic, openrouter, ollama
  model: gpt-4.1-mini
  apiKey: $OPENAI_API_KEY
  maxIterations: 50

# Required: System Prompt
systemPrompt: |
  You are an AI programming assistant focused on coding and reasoning tasks. You excel at:
  - Writing clean, efficient code
  - Debugging and problem-solving
  - Code review and optimization
  - Explaining complex technical concepts

# Optional: MCP Servers
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - '@modelcontextprotocol/server-filesystem'
      - .

# Alternative providers (uncomment to use)
# llm:
#   provider: anthropic
#   model: claude-3-5-haiku-20241022
#   apiKey: $ANTHROPIC_API_KEY
#   maxIterations: 50

# llm:
#   provider: ollama
#   model: qwen3:32b
#   baseURL: $OLLAMA_BASE_URL
#   maxIterations: 50
```

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

### OpenRouter (200+ Models)

```yaml
llm:
  provider: openrouter
  model: openai/gpt-4-turbo # Any OpenRouter model
  apiKey: $OPENROUTER_API_KEY
```

### Ollama (Self-Hosted, No API Key)

```yaml
llm:
  provider: ollama
  model: qwen2.5:32b # Recommended for best performance
  baseURL: $OLLAMA_BASE_URL
```

**Recommended Ollama Models:**

- **High Performance**: `qwen2.5:32b`, `llama3.1:70b`
- **Balanced**: `qwen2.5:8b`, `llama3.1:8b`
- **Lightweight**: `phi3:mini`, `granite3-dense:2b`

## CLI Reference

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

## Learn More

For detailed documentation including:
- Complete API reference
- Advanced configuration options
- Docker deployment guides
- Extensive usage examples
- Troubleshooting guides

Visit our [full documentation](https://docs.cipher.dev) (coming soon) or explore the complete README sections above.

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

## License

Elastic License 2.0. See [LICENSE](LICENSE) for full terms.