#!/bin/bash

# Cipher CLI Integration Test Script
# Tests the bash tool integration with cipher CLI

echo "🔧 Cipher CLI Integration Test"
echo "=============================="
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

# Test CLI mode with predefined prompts
echo "🚀 Testing CLI Mode with Bash Tool Integration"
echo ""

echo "Test 1: Simple bash command execution"
echo "Command: echo 'Hello from cipher bash integration!'"
echo "Expected: Should execute and show command output"
echo "Run: cipher \"Please use the bash tool to run 'echo 'Hello from cipher bash integration!''\""
echo ""
read -p "Press Enter to continue to next test..."

echo "Test 2: System information gathering"
echo "Command: uname -a && whoami"
echo "Expected: Should show system info and current user"
echo "Run: cipher \"Execute 'uname -a && whoami' using the bash tool and tell me about this system\""
echo ""
read -p "Press Enter to continue to next test..."

echo "Test 3: File operations"
echo "Command: Create and read a test file"
echo "Expected: Should create file, write content, and confirm creation"
echo "Run: cipher \"Use bash tool to create a file /tmp/cipher_test.txt with content 'Integration test successful' and then verify it was created\""
echo ""
read -p "Press Enter to continue to next test..."

echo "Test 4: Directory operations" 
echo "Command: pwd && ls -la | head -5"
echo "Expected: Should show current directory and file listing"
echo "Run: cipher \"Show me the current directory and its contents using bash commands\""
echo ""
read -p "Press Enter to continue to next test..."

echo "Test 5: Error handling"
echo "Command: nonexistentcommand"
echo "Expected: Should handle error gracefully and report failure"
echo "Run: cipher \"Try to run 'nonexistentcommand' using bash tool and handle any errors\""
echo ""
read -p "Press Enter to continue to next test..."

echo "Test 6: Complex command with pipes"
echo "Command: ps aux | grep node | head -3"
echo "Expected: Should execute piped command and show results"
echo "Run: cipher \"Use bash to find node processes with 'ps aux | grep node | head -3'\""
echo ""

echo "📋 Manual Testing Instructions:"
echo "1. Run each command above in a separate terminal"
echo "2. Verify the bash tool is being used (check debug logs)"
echo "3. Confirm command outputs are properly formatted"
echo "4. Check that exit codes are reported correctly"
echo "5. Ensure error handling works for invalid commands"
echo ""

echo "🔍 Interactive Testing Mode:"
echo "To test interactively, run: cipher"
echo "Then try these prompts:"
echo "- 'Run echo hello using bash'"
echo "- 'Execute pwd command'"
echo "- 'Show me system information with uname -a'"
echo "- 'Create a test file in /tmp'"
echo ""

echo "✅ CLI Integration test guide complete!"
echo "Run the commands above to verify bash tool integration works correctly."