# MCP Aggregator Hub

> 🔗 **Comprehensive MCP server aggregator for seamless IDE integration with enhanced tools**

## Overview

This configuration transforms Cipher into a powerful MCP (Model Context Protocol) aggregator hub that provides external IDE clients like Cursor and Claude Code with access to multiple specialized MCP servers through a single unified interface.

**Key Benefits:**
- **Single Integration Point**: Connect to multiple MCP servers through one Cipher instance
- **Comprehensive Toolset**: Web search, documentation, task management, and security scanning
- **Persistent Memory**: Cross-session learning and context retention
- **IDE Flexibility**: Works with Cursor, Claude Code, VS Code, and other MCP-compatible editors

## Included MCP Servers

### 🔍 **Exa Search** - Advanced Web Research
- **Purpose**: Comprehensive web search, competitor analysis, and real-time information
- **GitHub**: [exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server)
- **Tools**: web_search_exa, research_paper_search, company_research, competitor_finder

### 📚 **Context7** - Live Documentation Access  
- **Purpose**: Up-to-date framework documentation and API references
- **GitHub**: [upstash/context7](https://github.com/upstash/context7)
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
1. **Anthropic API Key** - Get from [console.anthropic.com](https://console.anthropic.com)
2. **OpenAI API Key** - Get from [platform.openai.com](https://platform.openai.com)
3. **Exa API Key** - Get from [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys)

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
# Install Semgrep MCP server
pipx install semgrep-mcp

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
        "ANTHROPIC_API_KEY": "your_anthropic_api_key",
        "OPENAI_API_KEY": "your_openai_api_key",
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
        "ANTHROPIC_API_KEY": "your_anthropic_api_key", 
        "OPENAI_API_KEY": "your_openai_api_key",
        "EXA_API_KEY": "your_exa_api_key"
      }
    }
  }
}
```

**Note**: For Claude Code, TaskMaster can run without API keys. Uncomment the `taskmaster-claude-code` section in `cipher.yml` if using Claude Code exclusively.

### **VS Code Setup**

Add to `.vscode/mcp.json`:
```json
{
  "mcpServers": {
    "cipher-hub": {
      "command": "cipher",
      "args": ["--mode", "mcp", "--agent", "./cipher.yml"],
      "env": {
        "ANTHROPIC_API_KEY": "your_anthropic_api_key",
        "OPENAI_API_KEY": "your_openai_api_key", 
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

### **Adjusting File System Access**
Edit `cipher.yml` filesystem configuration:
```yaml
filesystem:
  args:
    - /your/workspace/path  # Change to your development directory
```

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

## Troubleshooting

### **Connection Issues**
```bash
# Verify MCP servers
npx -y exa-mcp-server --help
npx -y @upstash/context7-mcp --help
pipx run semgrep-mcp --help

# Check Cipher MCP mode
cipher --mode mcp --agent ./cipher.yml --test
```

### **Common Solutions**
- **API Key Issues**: Verify all required keys are set in `.env`
- **Semgrep Installation**: Ensure `pipx` is installed: `pip install pipx`
- **Node.js Version**: Ensure Node.js >= v18.0.0
- **Permission Issues**: Check file permissions for MCP server executables
- **IDE Configuration**: Restart IDE after configuration changes

### **Performance Optimization**
- **Timeout Adjustment**: Increase timeout values in `cipher.yml` for slower networks
- **Concurrent Requests**: Adjust `maxConcurrentRequests` based on system capabilities  
- **Memory Usage**: Monitor memory usage with multiple MCP servers running

## Advanced Features

### **Tool Routing**
The aggregator automatically routes requests to appropriate MCP servers based on context and request type.

### **Fallback Handling**
If one MCP server is unavailable, the aggregator gracefully handles fallbacks to alternative tools.

### **Persistent Memory**
All interactions are stored and learned from, improving responses over time across all integrated tools.

---

This setup provides a comprehensive development environment with integrated web search, documentation access, task management, and security scanning - all accessible through your favorite IDE's MCP integration.