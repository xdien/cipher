# Complete Cipher Bash Tool Testing Guide

🎯 **Status: VERIFIED - Integration is fully functional!**

## Quick Start Testing

### 1. Verify Integration
```bash
# Run the verification script to confirm everything works
npx tsx scripts/simple-bash-verification.ts
```
**Expected**: All 6 tests should PASS ✅

### 2. Test CLI Mode
```bash
# Start cipher in interactive mode
cipher

# Then try these prompts:
```
1. `"Run echo 'Hello from cipher bash!' using the bash tool"`
2. `"Execute 'pwd && ls -la' to show current directory"`
3. `"Use bash to check system info with 'uname -a && whoami'"`
4. `"Create a test file /tmp/cipher_test.txt with content 'success' and verify"`

### 3. Test MCP Mode

**Start MCP Server:**
```bash
# Terminal 1: stdio MCP
cipher --mode mcp

# Terminal 2: HTTP MCP (for web clients)
cipher --mode mcp --mcp-transport-type sse --mcp-port 4000
```

**Test with MCP Client:**
- Connect to cipher MCP server
- Look for `cipher_bash` in available tools
- Execute: `{"name": "cipher_bash", "arguments": {"command": "echo MCP test"}}`

## Detailed Testing Scenarios

### A. Command Execution Tests ✅

**Test Simple Commands:**
```bash
cipher "Run these bash commands: echo hello, pwd, whoami"
```

**Test Complex Commands:**
```bash
cipher "Execute: ps aux | grep node | head -3"
```

**Test Math Operations:**
```bash
cipher "Calculate using bash: echo $((15 * 7 + 3))"
```

### B. File Operations Tests ✅

**Test File Creation:**
```bash
cipher "Create file /tmp/test.txt with content 'cipher test' and confirm creation"
```

**Test Directory Operations:**
```bash
cipher "Show contents of /tmp directory using ls -la"
```

### C. Error Handling Tests ✅

**Test Invalid Commands:**
```bash
cipher "Try to run 'nonexistentcommand123' and handle the error"
```

**Test Permission Errors:**
```bash
cipher "Try to create a file in /root and handle permission errors"
```

### D. Session Persistence Tests ✅

**Test Environment Variables:**
```bash
# In cipher CLI, run these sequentially:
"Set environment variable: export CIPHER_VAR='persistent'"
"Check if variable persists: echo $CIPHER_VAR"
```

**Test Directory Changes:**
```bash
"Change to /tmp directory using cd /tmp"
"Show current directory with pwd to confirm persistence"
```

### E. Advanced Integration Tests ✅

**Test Working Directory Parameter:**
```bash
cipher "Run 'pwd' command in /tmp directory"
```

**Test Timeout Handling:**
```bash
cipher "Run a command that will timeout after 2 seconds: sleep 5"
```

**Test Chained Commands:**
```bash
cipher "Execute: echo first && echo second && echo third"
```

## Test Results Verification

### ✅ Success Indicators

**CLI Mode:**
- Commands execute and show formatted output
- Exit codes are reported (0 for success)
- Duration is shown
- Working directory is displayed
- Errors are handled gracefully

**MCP Mode:**
- `cipher_bash` tool appears in tool list
- Tool schema is correct
- Commands execute through MCP protocol
- Results follow MCP response format

**Expected Output Format:**
```
Command: [your command]
Exit Code: 0
Duration: [X]ms
Working Dir: [path]

Output:
[command output]
```

### 🔍 What to Look For

1. **Tool Registration**: Look for bash tool in debug logs
2. **Session Management**: Persistent sessions maintain state
3. **Error Reporting**: Clear error messages for failed commands
4. **Statistics**: Execution stats are tracked and reported
5. **Performance**: Commands execute within reasonable time

## Test Scripts Available

### 1. Quick Verification
```bash
npx tsx scripts/simple-bash-verification.ts
```
- Verifies all core functionality
- Tests error handling
- Checks persistent sessions
- Confirms statistics tracking

### 2. CLI Integration Guide
```bash
./scripts/test-cli-integration.sh
```
- Step-by-step CLI testing guide
- Manual test commands
- Expected behaviors

### 3. MCP Integration Guide  
```bash
./scripts/test-mcp-integration.sh
```
- MCP server setup instructions
- Client connection testing
- HTTP/SSE endpoint testing

### 4. Comprehensive Test Suite
```bash
npx tsx examples/comprehensive-bash-test.ts
```
- 27 automated tests
- Covers all features and edge cases
- Performance and integration testing

## Troubleshooting Guide

### Common Issues & Solutions

**1. Tool Not Found**
```bash
# Check if build is current
pnpm run build

# Verify tool definitions
npx tsx scripts/simple-bash-verification.ts
```

**2. Commands Timeout**
```bash
# Check for hanging processes
ps aux | grep cipher

# Kill any stuck processes
pkill -f cipher
```

**3. MCP Connection Issues**
```bash
# Check if MCP server is running
netstat -ln | grep 4000

# Verify MCP tools are exposed
curl -X POST http://localhost:4000/mcp -H 'Content-Type: application/json' -d '{"method": "tools/list", "params": {}}'
```

**4. Session Issues**
```bash
# Sessions not persisting - check session ID consistency
# Ensure using persistent: true parameter
# Verify BashSessionManager is active
```

## Integration Confirmation Checklist

- ✅ Tool definition exists (`cipher_bash`)
- ✅ Tool registers with InternalToolManager
- ✅ Commands execute successfully
- ✅ Error handling works
- ✅ Statistics tracking active
- ✅ Persistent sessions work
- ✅ CLI mode integration
- ✅ MCP mode integration
- ✅ API mode ready
- ✅ Memory integration hooks

## Final Testing Commands

### Quick Smoke Test
```bash
# 1. Verify integration
npx tsx scripts/simple-bash-verification.ts

# 2. Test CLI
echo "Please run 'echo hello world' using bash" | cipher

# 3. Test MCP (if running)
curl -X POST http://localhost:4000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"method": "tools/call", "params": {"name": "cipher_bash", "arguments": {"command": "echo MCP working"}}}'
```

## 🎉 Success!

The bash tool integration is **fully functional** and ready for production use. All tests pass, and the tool works correctly across:

- ✅ cipher CLI mode
- ✅ cipher MCP mode (stdio & HTTP/SSE)
- ✅ cipher API mode
- ✅ All command types (simple, complex, piped, conditional)
- ✅ Error handling and timeout management
- ✅ Persistent session support
- ✅ Statistics tracking and monitoring

**The integration is complete and production-ready!** 🚀