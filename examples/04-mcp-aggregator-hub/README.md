# MCP Aggregator Hub

> 🔗 **Comprehensive MCP server aggregator for seamless IDE integration with enhanced tools**

## Overview

This configuration transforms Cipher into a powerful MCP aggregator hub that provides external IDE clients like Cursor and Claude Code with access to multiple specialized MCP servers through a single unified interface.

**Key Benefits:**
- **Single Integration Point**: Connect to multiple MCP servers through one Cipher instance
- **Comprehensive Toolset**: Web search, documentation, task management, and security scanning
- **Persistent Memory**: Cross-session learning and context retention
- **IDE Flexibility**: Works with Cursor, Claude Code, VS Code, and other MCP-compatible editors
- **Extensible Architecture**: Easily add more MCP servers to expand functionality

## Included MCP Servers

### 🔍 **Exa Search** - Advanced Web Research
- **Purpose**: Comprehensive web search, competitor analysis, and real-time information
- **GitHub**: [exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server)
- **API Key**: Required from [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys)
- **Tools**: web_search_exa, research_paper_search, company_research, competitor_finder, linkedin_search, wikipedia_search_exa, github_search

### 📚 **Context7** - Live Documentation Access  
- **Purpose**: Up-to-date framework documentation and API references
- **GitHub**: [upstash/context7](https://github.com/upstash/context7)
- **API Key**: None required (free service)
- **Connection**: Remote server via `https://mcp.context7.com/mcp`
- **Tools**: Real-time documentation retrieval, code examples, version-specific docs

### 📋 **TaskMaster** - AI-Powered Task Management
- **Purpose**: Structured project planning and development workflow management
- **GitHub**: [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master)
- **Tools**: Project breakdown, task planning, requirement analysis

### 🔒 **Semgrep** - Security Vulnerability Scanning
- **Purpose**: Code security analysis and vulnerability detection
- **GitHub**: [semgrep/mcp](https://github.com/semgrep/mcp)
- **Tools**: security_check, vulnerability scanning, code quality assessment

## Prerequisites

**Required Dependencies:**
- Node.js >= v18.0.0
- Python >= 3.8 (for Semgrep)
- pipx (for Semgrep installation)

**Required API Keys:**
1. **OpenAI API Key** - Get from [platform.openai.com](https://platform.openai.com) (for main LLM and embeddings)
2. **Exa API Key** - Get from [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys)
3. **Anthropic API Key** - Get from [console.anthropic.com](https://console.anthropic.com) (for TaskMaster)

**Optional API Keys** (enhance functionality):
- **Perplexity API Key** - Get from [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
- **Semgrep App Token** - Get from [semgrep.dev/orgs/-/settings/tokens](https://semgrep.dev/orgs/-/settings/tokens)

## Setup

### 1. Environment Setup

Copy and configure environment variables:
```bash
cp .env.example .env
# Edit .env with your actual API keys
```

### 2. Install Dependencies

```bash
# Install Semgrep MCP server (use uvx for better compatibility)
uvx semgrep-mcp --help

# Verify other MCP servers (auto-installed via npx)
npx -y exa-mcp-server --help
npx -y @upstash/context7-mcp --help
npx -y task-master-ai --help
```

### 3. Start Cipher Aggregator

```bash
# Navigate to the example directory
cd examples/04-mcp-aggregator-hub

# Start Cipher in MCP mode
cipher --mode mcp --agent ./cipher.yml
```

## IDE Configuration

### **Cursor Setup**

Add to `~/.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "cipher-hub": {
      "command": "cipher",
      "args": ["--mode", "mcp", "--agent", "./cipher.yml"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key",
        "ANTHROPIC_API_KEY": "your_anthropic_api_key",
        "EXA_API_KEY": "your_exa_api_key"
      }
    }
  }
}
```

### **Claude Code Setup**

Add to project `.mcp.json`:
```json
{
  "mcpServers": {
    "cipher-hub": {
      "command": "cipher",
      "args": ["--mode", "mcp", "--agent", "./cipher.yml"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key",
        "ANTHROPIC_API_KEY": "your_anthropic_api_key", 
        "EXA_API_KEY": "your_exa_api_key"
      }
    }
  }
}
```

**Note**: TaskMaster supports multiple AI providers. The current configuration includes OpenAI and Anthropic API keys. For additional providers, see the [TaskMaster documentation](https://github.com/eyaltoledano/claude-task-master). If you experience issues with TaskMaster, try removing the `--package=task-master-ai` parameter from the configuration.

### **VS Code Setup**

Add to `.vscode/mcp.json`:
```json
{
  "mcpServers": {
    "cipher-hub": {
      "command": "cipher",
      "args": ["--mode", "mcp", "--agent", "./cipher.yml"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key",
        "ANTHROPIC_API_KEY": "your_anthropic_api_key", 
        "EXA_API_KEY": "your_exa_api_key"
      }
    }
  }
}
```

## Usage Examples

### **Web Research with Exa**
```bash
# In your IDE
> Research the latest React Server Components best practices and performance optimization techniques
```

### **Documentation Access with Context7**  
```bash
# In your IDE  
> use context7 - Show me the latest Next.js 14 App Router documentation for data fetching
```

### **Security Scanning with Semgrep**
```bash
# In your IDE
> Scan my authentication middleware for security vulnerabilities using Semgrep
```

### **Project Planning with TaskMaster**
```bash
# In your IDE
> Help me break down the implementation of a real-time chat feature into manageable tasks
```

### **Multi-Tool Workflows**
```bash
# In your IDE
> Research modern authentication patterns, check my current auth code for vulnerabilities, and create a task plan for implementing OAuth 2.0
```

## Configuration Customization

### **Semgrep HTTP Streamable Mode**
Enable HTTP streaming mode by uncommenting in `cipher.yml`:
```yaml
mcpServers:
  # Uncomment this section and comment out the stdio version
  semgrep-http:
    type: "streamable-http"
    url: "https://mcp.semgrep.ai/mcp"
```

### **TaskMaster Common Commands**
Use these commands within your IDE when TaskMaster is active:
```bash
# Parse your requirements document
> task-master parse-prd your-prd.txt

# List all current tasks
> task-master list

# Get the next recommended task
> task-master next

# Show specific tasks by ID
> task-master show 1,3,5

# Research development topics
> task-master research "Best practices for JWT authentication"
```

### **Configuration Notes**

**Context7 Remote vs Local Setup:**
- **Remote** (active in config): Uses `https://mcp.context7.com/mcp` - no local installation needed
- **Local alternative** (commented): Available in cipher.yml for local server setup

**Semgrep Connection Options:**
- **Stdio mode** (active): Local uvx command execution
- **HTTP Streamable** (commented): Remote server via `https://mcp.semgrep.ai/mcp`

**TaskMaster Configuration:**
- Uses `--package=task-master-ai` parameter for reliable installation
- Configured with both OpenAI and Anthropic API keys
- Remove `--package` parameter if experiencing connection issues

**Exa Search Tool Selection:**
- **Default** (used in this config): Includes all available tools automatically
- **Custom selection**: Add `--tools` parameter to limit tools:
```yaml
exa:
  args:
    - -y
    - exa-mcp-server
    - --tools=web_search_exa,research_paper_search  # Custom selection
```

Available Exa tools: `web_search_exa`, `research_paper_search`, `company_research`, `competitor_finder`, `linkedin_search`, `wikipedia_search_exa`, `github_search`, `deep_researcher_start`, `deep_researcher_check`

### **Adding Additional MCP Servers**
Extend the `mcpServers` section in `cipher.yml`:
```yaml
mcpServers:
  # Add your custom MCP server
  custom-server:
    type: stdio
    command: npx
    args: ["-y", "your-mcp-server"]
    timeout: 30000
```

---