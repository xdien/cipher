#!/usr/bin/env node

// Test script to verify session-specific embedding fallback
import { promises as fs } from 'fs';
import path from 'path';

console.log('Testing session-specific embedding fallback behavior...');

// Create a test configuration with invalid embedding credentials
const testConfig = {
  llm: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: 'invalid-key-will-fail' // This will cause embedding failure
  },
  embedding: {
    type: 'openai',
    apiKey: 'invalid-embedding-key', // This will fail
    model: 'text-embedding-3-small'
  },
  storage: {
    type: 'in-memory'
  },
  vectorStorage: {
    type: 'in-memory'
  }
};

// Write test config
const configPath = 'memAgent/test-cipher.yml';
await fs.writeFile(configPath, `# Test configuration for embedding fallback
llm:
  provider: openai
  model: gpt-3.5-turbo
  apiKey: "invalid-key-will-fail"

embedding:
  type: openai
  apiKey: "invalid-embedding-key"
  model: text-embedding-3-small

storage:
  type: in-memory

vectorStorage:
  type: in-memory
`, 'utf8');

console.log('✅ Created test configuration with invalid embedding credentials');
console.log('✅ This should trigger session-specific fallback to chat-only mode');
console.log('📁 Config saved to:', configPath);
console.log('');
console.log('To test manually:');
console.log('1. Run: CIPHER_CONFIG=memAgent/test-cipher.yml npm run dev');
console.log('2. Try using a memory-related tool - it should be disabled');
console.log('3. Chat functionality should still work');
console.log('4. The session should continue in chat-only mode');

// Clean up
setTimeout(async () => {
  try {
    await fs.unlink(configPath);
    console.log('🧹 Cleaned up test configuration');
  } catch (error) {
    // File might not exist, ignore
  }
}, 5000);