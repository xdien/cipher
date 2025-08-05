# Cipher Bash Tool Integration Test Guide

This guide walks you through testing the new bash tool integration with cipher using both CLI and MCP modes.

## Prerequisites

1. **Build cipher**:
   ```bash
   cd /Users/namanh.ngco/Documents/Workspace/byterover/cipher
   pnpm run build
   ```

2. **Install cipher globally** (optional):
   ```bash
   npm install -g .
   ```

## Test Method 1: Cipher CLI Interactive Mode

### 1. Start Cipher CLI
```bash
# From cipher directory
pnpm run start
# OR if installed globally
cipher
```

### 2. Basic Bash Tool Tests

Once in the interactive CLI, test these commands:

**Test 1: Simple Command**
```
Can you run the command 'echo "Hello from cipher bash tool!"' for me?
```

**Test 2: System Information**
```
Please execute 'uname -a && pwd && whoami' to show system information
```

**Test 3: Directory Listing**
```
Run 'ls -la' to show the current directory contents
```

**Test 4: File Operations**
```
Create a test file with 'echo "test content" > /tmp/cipher_test.txt' and then read it back
```

**Test 5: Persistent Session**
```
Set an environment variable with 'export CIPHER_TEST="working"' and then echo it back in the same session
```

**Test 6: Working Directory**
```
Change to /tmp directory and show its contents
```

### 3. Advanced Tests

**Test 7: Complex Commands**
```
Run a piped command: 'ps aux | grep node | head -3'
```

**Test 8: Conditional Logic**
```
Execute: 'if [ -d "/tmp" ]; then echo "tmp exists"; else echo "tmp missing"; fi'
```

**Test 9: Math Operations**
```
Calculate: 'echo "Result: $((15 * 7 + 3))"'
```

## Test Method 2: Cipher MCP Mode

### 1. Start Cipher in MCP Mode

**Option A: stdio MCP (for command line clients)**
```bash
cipher --mode mcp
```

**Option B: HTTP MCP with SSE (for web clients)**
```bash
cipher --mode mcp --mcp-transport-type sse --mcp-port 4000
```

### 2. Test with MCP Client

If you have an MCP client (like Cursor, Windsurf, or Claude Desktop), connect to cipher and test:

**MCP Connection Settings:**
- **stdio**: Use the cipher command directly
- **HTTP/SSE**: Connect to `http://localhost:4000`

**Test Commands through MCP:**

1. **List Available Tools**:
   Ask the client to show available tools - you should see `cipher_bash`

2. **Execute Simple Command**:
   ```
   Use the cipher_bash tool to run: echo "MCP integration working!"
   ```

3. **System Check**:
   ```
   Use cipher_bash to check system info with: whoami && date
   ```

4. **Persistent Session Test**:
   ```
   First, use cipher_bash to set: export MCP_VAR="persistent"
   Then use cipher_bash to check: echo "Value: $MCP_VAR"
   ```

## Test Method 3: One-Shot Mode

### Test Bash Integration in One-Shot Mode

```bash
# Test 1: Simple command
cipher "Please run 'echo Hello from one-shot mode' using the bash tool"

# Test 2: System info  
cipher "Execute 'uname -a' and tell me about this system"

# Test 3: File operations
cipher "Create a file /tmp/oneshot.txt with content 'one-shot test' and confirm it was created"
```

## Expected Results

### ✅ Success Indicators

1. **Tool Availability**: `cipher_bash` appears in available tools
2. **Command Execution**: Commands execute and return output
3. **Exit Codes**: Proper exit code reporting (0 for success, non-zero for errors)
4. **Persistent Sessions**: Environment variables and directory changes persist
5. **Error Handling**: Invalid commands return appropriate error messages
6. **Statistics**: Tool execution statistics are tracked

### 🔍 What to Look For

**In CLI Mode:**
- Tool registration messages in debug output
- Command execution logs
- Proper response formatting
- Session persistence across multiple commands

**In MCP Mode:**
- Tool schema properly exposed to MCP clients
- Commands execute through MCP protocol
- Results returned in proper MCP format
- Error handling through MCP error responses

**Command Output Format:**
```
Command: [your command]
Exit Code: [0 or error code]
Duration: [execution time in ms]
Working Dir: [directory path]

Output:
[command output here]

[Error section if any errors occurred]
```

## Troubleshooting

### Common Issues

1. **Tool Not Found**:
   - Ensure cipher is built: `pnpm run build`
   - Check tool registration logs

2. **Commands Timeout**:
   - Default timeout is 30 seconds
   - Check for hanging processes
   - Use shorter test commands

3. **Persistent Sessions Not Working**:
   - Ensure using `persistent: true` parameter
   - Check session ID consistency
   - Verify session manager is active

4. **MCP Connection Issues**:
   - Verify MCP server is running
   - Check port availability (4000 for HTTP)
   - Ensure proper MCP client configuration

### Debug Commands

**Check Tool Registration:**
```bash
# Enable debug logging
CIPHER_LOG_LEVEL=debug cipher
```

**Verify Tool Statistics:**
In CLI mode, the tool manager tracks execution statistics automatically.

**Session Status:**
Check if sessions remain active between commands in persistent mode.

## Additional Test Scenarios

### Performance Testing
```bash
# Test rapid command execution
cipher "Execute these commands quickly: echo 1, echo 2, echo 3, echo 4, echo 5"
```

### Error Recovery Testing
```bash
# Test error handling
cipher "Run an invalid command 'nonexistentcommand' then run 'echo recovery test'"
```

### Integration Testing
```bash
# Test with memory integration
cipher "Run 'ps aux | head -5' and remember the process information for later"
```

This comprehensive test guide ensures the bash tool integration works correctly across all cipher modes and use cases.