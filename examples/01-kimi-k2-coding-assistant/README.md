# Kimi K2 Coding Assistant

> 🚀 **Advanced coding companion powered by Moonshot AI's Kimi K2 model with comprehensive development tools**

## Overview

This configuration showcases Cipher as a high-performance coding assistant using Moonshot AI's Kimi K2 model via OpenRouter. Kimi K2 is specifically optimized for coding tasks, reasoning, and tool calling, making it an excellent choice for software development workflows.

The setup includes a comprehensive suite of MCP (Model Context Protocol) servers that provide seamless integration with your development environment, from file system operations to GitHub management and advanced web research.

## Key Features Demonstrated

### 🧠 **Advanced AI Model**
- **Kimi K2**: Moonshot AI's latest model optimized for coding and reasoning tasks
- **Tool Calling Excellence**: Superior performance in using development tools effectively
- **Extended Context**: Handles large codebases and complex architectural discussions

### 🔧 **Comprehensive Development Tools**
- **File System Operations**: Read, write, and analyze code files with security controls
- **GitHub Integration**: Repository management, issue tracking, pull request operations
- **Web Research**: Advanced documentation lookup and technology research via Firecrawl
- **Database Operations**: SQLite integration for project data management
- **Git Version Control**: Advanced git operations and repository analysis

### 🧠 **Intelligent Memory System**
- **Persistent Learning**: Remembers your coding patterns, preferences, and project context
- **Architecture Memory**: Builds understanding of your codebase structure over time
- **Reasoning Patterns**: Stores successful problem-solving approaches for reuse

### ⚡ **Performance Optimizations**
- **Dual LLM Strategy**: Kimi K2 for complex reasoning, GPT-4o-mini for quick evaluations
- **Extended Sessions**: 4-hour session TTL for long coding sessions
- **High Iteration Count**: 75 max iterations for complex multi-step tasks

## Prerequisites

### Required Services & API Keys

1. **OpenRouter Account**
   - Sign up at [openrouter.ai](https://openrouter.ai)
   - Get your API key from the dashboard
   - Ensure you have credits for Kimi K2 model usage

2. **GitHub Personal Access Token**
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Create a token with `repo`, `user`, and `project` scopes
   - For organization repos, ensure appropriate permissions

3. **Firecrawl API Key**
   - Sign up at [firecrawl.dev](https://firecrawl.dev)
   - Get your API key from the dashboard
   - Used for advanced web scraping and documentation research

### Software Requirements

- Node.js 18+ (for MCP servers)
- Git (for version control operations)
- Cipher CLI installed and configured

## Quick Start

### 1. Environment Setup

Copy the environment template and configure your API keys:

```bash
# Copy the environment template
cp .env.example .env

# Edit with your API keys
nano .env  # or your preferred editor
```

Set these environment variables:
```bash
# Required
OPENROUTER_API_KEY=your_openrouter_api_key_here
GITHUB_TOKEN=your_github_personal_access_token
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# Optional - for enhanced logging
CIPHER_LOG_LEVEL=info
```

### 2. Launch the Coding Assistant

```bash
# Navigate to the example directory
cd examples/01-kimi-k2-coding-assistant

# Start Cipher with this configuration
cipher --agent ./cipher.yml --new-session coding-session

# Or use API mode for integration with other tools
cipher --mode api --agent ./cipher.yml --port 3000
```

### 3. Test the Setup

Once launched, test the key capabilities:

```bash
# Test file system access
cipher> Can you analyze the structure of my current project?

# Test GitHub integration
cipher> Show me the recent issues in this repository

# Test web research
cipher> Research the latest best practices for React Server Components

# Test memory and reasoning
cipher> Remember that I prefer TypeScript with strict mode and functional components
```

## Configuration Details

### LLM Configuration

```yaml
llm:
  provider: openrouter
  model: moonshotai/kimi-k2  # Optimized for coding tasks
  maxIterations: 75          # Extended for complex tasks
```

**Why Kimi K2?**
- Exceptional coding performance and reasoning capabilities
- Superior tool calling and function execution
- Strong understanding of software architecture patterns
- Excellent at debugging and code analysis

### MCP Server Breakdown

#### File System Server
```yaml
filesystem:
  type: stdio
  command: npx -y @modelcontextprotocol/server-filesystem
  connectionMode: strict  # Critical for file operations
```
**Capabilities**: Secure file read/write operations with configurable access controls

#### GitHub Server
```yaml
github:
  type: stdio
  command: npx -y @modelcontextprotocol/server-github
  connectionMode: strict  # Essential for repository operations
```
**Capabilities**: Repository management, file operations, issue tracking, pull request creation

#### Firecrawl Server
```yaml
firecrawl:
  type: stdio
  command: npx -y firecrawl-mcp
  connectionMode: lenient  # Fallback option
```
**Capabilities**: Advanced web scraping, documentation research, technology lookup

#### SQLite Server
```yaml
sqlite:
  type: stdio
  command: npx -y @modelcontextprotocol/server-sqlite
  connectionMode: lenient  # Optional for most tasks
```
**Capabilities**: Database operations, project data management, business intelligence

## Usage Examples

### Development Workflow Examples

#### 1. **Code Review and Analysis**
```bash
cipher> Please review the authentication middleware in src/middleware/auth.js and suggest improvements for security and performance.
```

The assistant will:
- Read and analyze the file using filesystem tools
- Research current security best practices via Firecrawl
- Provide detailed recommendations with code examples
- Remember your security preferences for future reviews

#### 2. **GitHub Repository Management**
```bash
cipher> Create a new feature branch for user authentication, then show me all open issues related to authentication.
```

The assistant will:
- Use Git tools to create and switch to the new branch
- Query GitHub API for authentication-related issues
- Provide a summary and suggest prioritization

#### 3. **Research-Driven Development**
```bash
cipher> I need to implement real-time notifications. Research the latest WebSocket vs Server-Sent Events approaches and recommend the best solution for a React app.
```

The assistant will:
- Use Firecrawl to research current documentation and articles
- Analyze your existing codebase to understand the architecture
- Provide a detailed comparison with implementation examples
- Store the research in memory for future reference

#### 4. **Database-Driven Features**
```bash
cipher> Design a database schema for a blog system and create the initial SQLite tables with sample data.
```

The assistant will:
- Design an appropriate database schema
- Use SQLite tools to create tables and relationships
- Insert meaningful sample data for testing
- Document the schema decisions for future reference

### Advanced Usage Patterns

#### Multi-File Refactoring
```bash
cipher> Refactor the user authentication system to use JWT tokens instead of sessions. Update all related files and maintain backward compatibility.
```

#### API Integration Development
```bash
cipher> Research the Stripe payment API documentation and implement a complete payment flow with error handling and webhooks.
```

#### Performance Optimization
```bash
cipher> Analyze the performance bottlenecks in my React application and implement optimizations using React.memo, useMemo, and code splitting.
```

## Troubleshooting

### Common Issues

#### 1. **MCP Server Connection Failures**
```bash
# Check if servers are accessible
npx -y @modelcontextprotocol/server-filesystem --help
npx -y @modelcontextprotocol/server-github --help
```

**Solutions:**
- Ensure Node.js 18+ is installed
- Check internet connectivity for npm packages
- Verify API keys are correctly set in environment

#### 2. **GitHub Token Issues**
```bash
# Test your GitHub token
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
```

**Solutions:**
- Ensure token has correct scopes (`repo`, `user`, `project`)
- Check token hasn't expired
- Verify organization permissions if working with org repos

#### 3. **Firecrawl API Errors**
**Solutions:**
- Check API key validity at [firecrawl.dev/app/api-keys](https://firecrawl.dev/app/api-keys)
- Verify account has sufficient credits
- Check rate limiting if getting 429 errors

#### 4. **OpenRouter Model Access**
**Solutions:**
- Ensure account has credits for Kimi K2 usage
- Check model availability status on OpenRouter
- Verify API key permissions

### Performance Tuning

#### For Large Codebases
```yaml
# Increase timeout for file operations
filesystem:
  timeout: 60000  # 1 minute for large projects
```

#### For Network-Heavy Tasks
```yaml
# Adjust Firecrawl retry settings
firecrawl:
  env:
    FIRECRAWL_RETRY_MAX_ATTEMPTS: '5'
    FIRECRAWL_RETRY_MAX_DELAY: '15000'
```

## Advanced Customization

### Custom File System Paths
```yaml
filesystem:
  args:
    - -y
    - '@modelcontextprotocol/server-filesystem'
    - /path/to/your/workspace  # Restrict to specific directory
```

### Additional MCP Servers

Add more development tools as needed:

```yaml
mcpServers:
  # Add Docker integration
  docker:
    type: stdio
    command: npx
    args: ["-y", "mcp-server-docker"]
    connectionMode: lenient
  
  # Add PostgreSQL for larger projects
  postgres:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-postgres"]
    env:
      POSTGRES_CONNECTION_STRING: $DATABASE_URL
    connectionMode: lenient
```

### Custom System Prompt

Modify the `systemPrompt` section to match your specific development style:

```yaml
systemPrompt: |
  You are a Senior [Your Language] Developer specializing in:
  - [Your specific tech stack]
  - [Your preferred frameworks]
  - [Your coding standards]
  
  Always follow these team conventions:
  - [Your team's coding standards]
  - [Your preferred testing approach]
  - [Your architecture patterns]
```

## Integration with IDEs

### VS Code Integration
The assistant can be integrated with VS Code through MCP server mode:

```bash
# Run as MCP server
cipher --mode mcp --agent ./cipher.yml

# Configure in VS Code settings
{
  "mcp.servers": {
    "cipher-coding": {
      "command": "cipher",
      "args": ["--mode", "mcp", "--agent", "./cipher.yml"]
    }
  }
}
```

### API Integration
Use API mode for custom integrations:

```bash
# Start API server
cipher --mode api --agent ./cipher.yml --port 3000

# Use in your scripts
curl -X POST http://localhost:3000/api/message/sync \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze this code for security issues"}'
```

## Next Steps

### Enhance Your Setup

1. **Add Project-Specific Tools**: Include MCP servers for your specific tech stack
2. **Custom Memory Tagging**: Use metadata to organize coding knowledge by project
3. **Team Integration**: Set up API mode for team-wide access
4. **CI/CD Integration**: Use the assistant in automated code review workflows

### Scale Up

1. **Multiple Projects**: Use different sessions for different codebases
2. **Team Knowledge Base**: Leverage the knowledge graph for shared team learnings
3. **Advanced Reasoning**: Implement custom reasoning patterns for your domain
4. **Performance Monitoring**: Track assistant effectiveness and optimize configurations

## Support and Community

- **Documentation**: [Cipher Documentation](https://github.com/your-org/cipher)
- **Issues**: Report bugs and request features
- **Discord**: Join the community for help and discussions
- **Examples**: Check other use cases in the examples directory

---

**Happy Coding!** 🚀

This configuration transforms Cipher into a powerful coding companion that learns and evolves with your development style. The combination of Kimi K2's advanced reasoning with comprehensive development tools creates an unparalleled coding assistance experience.