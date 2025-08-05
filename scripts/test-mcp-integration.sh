#!/bin/bash

# Cipher MCP Integration Test Script
# Tests the bash tool integration with cipher MCP mode

echo "🔧 Cipher MCP Integration Test"
echo "==============================="
echo ""

# Build cipher first
echo "📦 Building cipher..."
pnpm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"
echo ""

echo "🚀 MCP Mode Testing Guide"
echo ""

echo "📋 Test Setup Options:"
echo ""
echo "Option 1: stdio MCP (for command line MCP clients)"
echo "Command: cipher --mode mcp"
echo "Use case: Direct stdio communication with MCP clients"
echo ""

echo "Option 2: HTTP MCP with Server-Sent Events"
echo "Command: cipher --mode mcp --mcp-transport-type sse --mcp-port 4000"
echo "Use case: Web-based MCP clients or HTTP integrations"
echo "Server URL: http://localhost:4000"
echo ""

echo "🧪 Test Scenarios:"
echo ""

echo "Test 1: Tool Discovery"
echo "Expected: cipher_bash tool should be listed in available tools"
echo "Verify: Tool schema includes bash command parameters"
echo "Check: Tool category is 'system'"
echo ""

echo "Test 2: Simple Command Execution"
echo "MCP Request: Use cipher_bash tool with command 'echo \"MCP integration test\"'"
echo "Expected: Command executes and returns formatted output"
echo "Verify: Exit code 0, proper duration reporting"
echo ""

echo "Test 3: System Information"
echo "MCP Request: Use cipher_bash tool with command 'whoami && hostname && date'"
echo "Expected: System info returned in structured format"
echo "Verify: Multiple command outputs properly formatted"
echo ""

echo "Test 4: Error Handling"
echo "MCP Request: Use cipher_bash tool with command 'invalidcommand123'"
echo "Expected: Error reported with non-zero exit code"
echo "Verify: Error message properly formatted"
echo ""

echo "Test 5: Persistent Session"
echo "MCP Request 1: Use cipher_bash with 'export MCP_TEST=value' and persistent=true"
echo "MCP Request 2: Use cipher_bash with 'echo \$MCP_TEST' and persistent=true, same sessionId"
echo "Expected: Variable persists between requests"
echo "Verify: Same session maintains state"
echo ""

echo "Test 6: Working Directory"
echo "MCP Request: Use cipher_bash with command 'pwd' and workingDir='/tmp'"
echo "Expected: Command executes in /tmp directory"
echo "Verify: Working directory parameter works"
echo ""

echo "Test 7: Timeout Handling"
echo "MCP Request: Use cipher_bash with command 'sleep 5' and timeout=2000"
echo "Expected: Command times out after 2 seconds"
echo "Verify: Timeout error properly reported"
echo ""

echo "🔧 Starting MCP Servers:"
echo ""

echo "Starting stdio MCP server..."
echo "Run in Terminal 1: cipher --mode mcp"
echo ""

echo "Starting HTTP/SSE MCP server..."
echo "Run in Terminal 2: cipher --mode mcp --mcp-transport-type sse --mcp-port 4000"
echo ""

echo "📱 MCP Client Testing:"
echo ""

echo "For Cursor/Windsurf/Claude Desktop:"
echo "1. Add cipher MCP server to client configuration"
echo "2. Connect to MCP server"
echo "3. Verify cipher_bash tool appears in available tools"
echo "4. Test each scenario above through the client"
echo ""

echo "For HTTP clients (curl testing):"
echo ""
echo "Test tool discovery:"
echo "curl -X POST http://localhost:4000/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{\"method\": \"tools/list\", \"params\": {}}'"
echo ""

echo "Test command execution:"
echo "curl -X POST http://localhost:4000/mcp \\
  -H 'Content-Type: application/json' \\
  -d '{
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"cipher_bash\",
      \"arguments\": {
        \"command\": \"echo \\\"HTTP MCP test\\\"\",
        \"timeout\": 30000
      }
    }
  }'"
echo ""

echo "🔍 Verification Checklist:"
echo ""
echo "✅ MCP server starts without errors"
echo "✅ cipher_bash tool is discoverable"
echo "✅ Tool schema is correct"
echo "✅ Commands execute successfully"
echo "✅ Error handling works"
echo "✅ Persistent sessions maintain state"
echo "✅ Timeout handling works"
echo "✅ Working directory parameter works"
echo ""

echo "📊 Expected MCP Tool Schema:"
echo "{"
echo "  \"name\": \"cipher_bash\","
echo "  \"description\": \"Execute bash commands in the system shell...\","
echo "  \"inputSchema\": {"
echo "    \"type\": \"object\","
echo "    \"properties\": {"
echo "      \"command\": { \"type\": \"string\" },"
echo "      \"timeout\": { \"type\": \"number\" },"
echo "      \"workingDir\": { \"type\": \"string\" },"
echo "      \"persistent\": { \"type\": \"boolean\" },"
echo "      \"sessionId\": { \"type\": \"string\" }"
echo "    },"
echo "    \"required\": [\"command\"]"
echo "  }"
echo "}"
echo ""

echo "🎯 Success Criteria:"
echo "- All MCP requests return proper responses"
echo "- Command execution works through MCP protocol"
echo "- Error handling provides meaningful feedback"
echo "- Tool integrates seamlessly with MCP clients"
echo "- Performance is acceptable for interactive use"
echo ""

echo "✅ MCP Integration test guide complete!"
echo "Follow the instructions above to test bash tool MCP integration."