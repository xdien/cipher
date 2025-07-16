# CLI Coding Agents

> 🖥️ **Memory-powered CLI development workflow with Claude Code and Gemini CLI integration**

## Overview

This configuration demonstrates Cipher as a memory layer for CLI-based coding agents like Claude Code and Gemini CLI. Unlike traditional CLI tools that lose context between sessions, this setup provides persistent memory, project knowledge, and enhanced reasoning capabilities that grow with your development workflow.

CLI coding agents have become essential for modern development workflows, offering:
- **Command-line efficiency**: Work directly from your terminal without switching contexts
- **Project-aware assistance**: Access your entire codebase through integrated tools
- **Workflow integration**: Seamlessly blend into existing development processes
- **Cross-platform compatibility**: Works consistently across different operating systems

The key advantage of this setup is **persistent memory** - your CLI agents remember your coding patterns, project architecture, and previous solutions, making each interaction more contextual and valuable.

## Key Features Demonstrated

- **Memory-Enhanced CLI Agents**: Claude Code and Gemini CLI with persistent context
- **Project Memory**: Remembers codebase structure, patterns, and your preferences
- **Cross-Session Learning**: Builds on previous interactions for smarter assistance
- **Tool Integration**: Seamless access to filesystem, web research, and development tools
- **Flexible Deployment**: Works as MCP server for multiple CLI tools simultaneously

## Prerequisites

### Required Services & API Keys

1. **Anthropic API Key** (for Claude models)
   - Sign up at [console.anthropic.com](https://console.anthropic.com)
   - Create an API key in your account settings
   - Used for Claude Code integration

2. **OpenAI API Key** (always required for embeddings)
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Create an API key in your account settings
   - Required for Cipher's memory embedding system

3. **Optional: Google AI API Key** (for Gemini CLI)
   - Get API key from [Google AI Studio](https://aistudio.google.com)
   - Used for Gemini CLI integration

### Software Requirements

- Node.js 18+ (for MCP servers and Cipher)
- Claude Code CLI (optional, for Claude Code integration)
- Gemini CLI (optional, for Gemini CLI integration)
- Git (for version control operations)

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
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional - for Gemini CLI
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Optional - for enhanced logging
CIPHER_LOG_LEVEL=info
```

### 2. Install CLI Tools

#### Claude Code Installation
```bash
# Install Claude Code
curl -fsSL https://claude.ai/install.sh | sh

# Verify installation
claude --version
```

#### Gemini CLI Installation (Optional)
```bash
# Install Gemini CLI
npm install -g @google/gemini-cli

# Verify installation
gemini --version
```

### 3. Configure MCP Servers

#### For Claude Code

Add Cipher as an MCP server using the CLI wizard:

```bash
# Navigate to the example directory
cd examples/02-cli-coding-agents

# Add cipher as user-scoped server (available across all projects)
claude mcp add cipher -s user \
  -e ANTHROPIC_API_KEY=your_anthropic_api_key \
  -e OPENAI_API_KEY=your_openai_api_key \
  -- npx -y cipher --mode mcp --agent ./cipher.yml

# Or add as project-scoped server (specific to current project)
claude mcp add cipher -s project \
  -e ANTHROPIC_API_KEY=your_anthropic_api_key \
  -e OPENAI_API_KEY=your_openai_api_key \
  -- npx -y cipher --mode mcp --agent ./cipher.yml
```

#### For Gemini CLI

Configure Gemini CLI settings:

```bash
# Initialize Gemini CLI configuration
gemini config init

# Add cipher MCP server to settings.json
```

Add this to your Gemini CLI `settings.json`:
```json
{
  "mcpServers": {
    "cipher": {
      "command": "npx",
      "args": ["-y", "cipher", "--mode", "mcp", "--agent", "./cipher.yml"],
      "env": {
        "ANTHROPIC_API_KEY": "your_anthropic_api_key",
        "OPENAI_API_KEY": "your_openai_api_key"
      },
      "timeout": 15000
    }
  }
}
```

### 4. Test the Setup

#### With Claude Code
```bash
# Start Claude Code
claude

# Test memory and file access
> Can you analyze my current project structure and remember the architecture patterns?

# Test learning capabilities
> Remember that I prefer TypeScript with strict mode and use React functional components
```

#### With Gemini CLI
```bash
# Check MCP server status
gemini /mcp

# Test cipher integration
gemini "Use cipher to analyze my codebase and suggest improvements"

# Test memory features
gemini "Ask cipher to remember my coding preferences and project structure"
```

## Configuration Details

### LLM Configuration

```yaml
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022  # Optimized for coding tasks
  maxIterations: 50                  # Balanced for CLI interactions
```

**Why Claude 3.5 Sonnet?**
- Excellent coding performance and reasoning
- Superior tool calling capabilities
- Strong understanding of CLI development workflows
- Efficient token usage for extended sessions

### MCP Server Breakdown

#### File System Server
```yaml
filesystem:
  type: stdio
  command: npx -y @modelcontextprotocol/server-filesystem
  connectionMode: strict  # Secure file operations
```
**Capabilities**: Complete file system access for code analysis, reading documentation, and project navigation

#### Memory Integration
The configuration includes Cipher's persistent memory system that:
- Stores project knowledge across sessions
- Learns from your coding patterns and preferences
- Maintains context about your development workflow
- Builds a knowledge graph of your projects and decisions

## Usage Examples

### Development Workflow Examples

#### 1. **Project Analysis and Memory Building**
```bash
# With Claude Code
claude> Analyze my entire project structure, understand the architecture, and remember the key patterns for future sessions.

# With Gemini CLI
gemini "Use cipher to learn about my project structure and coding conventions"
```

The agent will:
- Scan your project files using filesystem tools
- Identify architecture patterns and conventions
- Store knowledge in persistent memory for future sessions
- Provide immediate insights about your codebase

#### 2. **Context-Aware Code Reviews**
```bash
# With Claude Code
claude> Review the authentication changes in my last commit, considering the security patterns you've learned about my project.

# With Gemini CLI
gemini "Ask cipher to review my recent authentication changes using the project knowledge it has learned"
```

The agent will:
- Access your project files and git history
- Apply previously learned security patterns and preferences
- Provide contextual feedback based on your project's specific requirements
- Update its knowledge with new patterns discovered

#### 3. **Cross-Session Problem Solving**
```bash
# Session 1
claude> Help me debug this performance issue in my React component.

# Session 2 (later)
claude> Apply the performance optimization techniques we discussed yesterday to this new component.
```

The agent will:
- Remember previous debugging sessions and solutions
- Apply learned optimization techniques to new problems
- Build on previous conversations for more effective assistance
- Maintain context about your performance requirements and constraints

#### 4. **Documentation and Knowledge Building**
```bash
# With Claude Code
claude> Create comprehensive documentation for my API endpoints, using the patterns you've learned from my existing docs.

# With Gemini CLI
gemini "Generate API documentation using cipher's knowledge of my documentation style"
```

The agent will:
- Analyze existing documentation patterns in your project
- Apply consistent styling and structure based on learned preferences
- Generate documentation that matches your team's standards
- Store documentation patterns for future use

### Advanced CLI Workflows

#### Multi-Project Memory Management
```bash
# Switch project context
claude /session new project-alpha
claude> This is my e-commerce project. Remember the microservices architecture and payment integration patterns.

# Later, switch to another project
claude /session new project-beta
claude> This is my blog platform. Note the different tech stack and content management patterns.
```

#### Command-Line Integration Scripts
```bash
# Create a shell function for quick cipher access
cipher-analyze() {
    echo "Analyzing project with cipher memory..."
    claude "Analyze the current directory structure and update project knowledge"
}

# Add to your .bashrc or .zshrc
alias cipher-review="claude 'Review recent changes using project context'"
alias cipher-docs="claude 'Update documentation based on recent code changes'"
```

## Integration Patterns

### IDE Integration

While primarily CLI-focused, this setup can complement IDE workflows:

```bash
# Use CLI for analysis, then work in IDE
claude> Analyze this codebase and identify areas that need refactoring
# Apply insights in your preferred IDE

# Quick CLI reviews during development
claude> Quick review of the changes in ./src/components/Auth.tsx
```

### CI/CD Integration

Integrate with development workflows:

```bash
# Pre-commit analysis
git add . && claude "Review these changes for potential issues before commit"

# Documentation updates
claude "Update README.md based on recent feature additions"

# Code quality checks
claude "Analyze code quality and suggest improvements for the modified files"
```

## Troubleshooting

### Common Issues

#### 1. **MCP Server Connection Failures**
```bash
# Check cipher installation
npx cipher --version

# Test MCP mode
npx cipher --mode mcp --agent ./cipher.yml

# Check CLI tool configuration
claude mcp list
gemini /mcp
```

**Solutions:**
- Ensure Node.js 18+ is installed
- Verify environment variables are set correctly
- Check that cipher is accessible via npx

#### 2. **Memory Persistence Issues**
**Solutions:**
- Verify write permissions in the working directory
- Check disk space for memory storage
- Ensure sessions are properly configured in cipher.yml

#### 3. **API Authentication Errors**
**Solutions:**
- Verify API keys are correct and not expired
- Check API key permissions and rate limits
- Ensure environment variables are properly exported

### Performance Optimization

#### For Large Codebases
```yaml
# Increase timeout for file operations
filesystem:
  timeout: 60000  # 1 minute for large projects

# Optimize memory settings
sessions:
  maxSessions: 25
  sessionTTL: 7200000  # 2 hours
```

#### For Network Efficiency
```yaml
# Adjust connection settings
llm:
  timeout: 45000
  retryAttempts: 3
```

## Advanced Customization

### Custom CLI Commands

Create project-specific commands:

```bash
# Add to your shell configuration
alias cipher-start="cd ~/projects && cipher --mode mcp --agent ./cipher.yml"
alias cipher-analyze="claude 'Analyze current project and update knowledge'"
alias cipher-review="claude 'Review recent changes with project context'"
```

### Multi-Model Support

Configure different models for different tasks:

```yaml
# Primary model for complex reasoning
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022

# Fast model for quick evaluations
evalLlm:
  provider: anthropic
  model: claude-3-haiku-20240307
```

### Team Configuration

Set up shared knowledge for team environments:

```yaml
systemPrompt: |
  You are a team coding assistant that knows our:
  - Architecture patterns: [Your team patterns]
  - Code standards: [Your team standards]
  - Review criteria: [Your team criteria]
  
  Always maintain consistency with team conventions and previous decisions.
```

## Next Steps

### Enhance Your CLI Workflow

1. **Create Custom Commands**: Build shell functions for common development tasks
2. **Integrate with Git**: Use cipher for commit message generation and code reviews
3. **Team Knowledge**: Share cipher configurations across your development team
4. **Automation**: Integrate with scripts and development automation tools

### Scale Your Setup

1. **Multiple Projects**: Use different sessions for different codebases
2. **Team Sharing**: Set up API mode for team-wide access to shared knowledge
3. **CI/CD Integration**: Use cipher in automated development workflows
4. **Knowledge Management**: Build comprehensive project documentation and decisions

## Support and Community

- **Documentation**: [Cipher Documentation](https://docs.byterover.dev/cipher/overview)
- **CLI Integration Guide**: [MCP Connections](https://docs.byterover.dev/cipher/connections)
- **Issues**: Report bugs and request features
- **Discord**: Join the community for help and discussions

---

**Happy CLI Coding!** 🖥️

This configuration transforms your CLI development workflow with persistent memory and intelligent assistance. The combination of Claude Code or Gemini CLI with Cipher's memory system creates a powerful development environment that learns and evolves with your coding practices.