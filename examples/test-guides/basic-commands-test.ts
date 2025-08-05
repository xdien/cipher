#!/usr/bin/env npx tsx

/**
 * Basic Commands Test Guide
 * Test the fundamental command execution capabilities
 */

import { getAllToolDefinitions } from '../../src/core/brain/tools/definitions/index.js';
import { InternalToolManager } from '../../src/core/brain/tools/manager.js';

async function testBasicCommands() {
	console.log('🧪 Basic Commands Test Guide');
	console.log('============================\n');

	const toolManager = new InternalToolManager();
	await toolManager.initialize();
	
	const tools = await getAllToolDefinitions();
	const bashTool = tools['cipher_bash'];
	toolManager.registerTool(bashTool);

	// Test 1: Simple echo
	console.log('1️⃣ Test: Simple Echo Command');
	const result1 = await toolManager.executeTool('cipher_bash', {
		command: 'echo "Hello, Cipher Bash Tool!"'
	});
	console.log('Command:', 'echo "Hello, Cipher Bash Tool!"');
	console.log('Success:', !result1.isError);
	console.log('Output:', result1.content.split('\n')[5]);
	console.log('');

	// Test 2: System info
	console.log('2️⃣ Test: System Information');
	const result2 = await toolManager.executeTool('cipher_bash', {
		command: 'whoami && hostname && date'
	});
	console.log('Command:', 'whoami && hostname && date');
	console.log('Success:', !result2.isError);
	console.log('Output preview:', result2.content.split('\n')[5]);
	console.log('');

	// Test 3: Math operations
	console.log('3️⃣ Test: Math Operations');
	const result3 = await toolManager.executeTool('cipher_bash', {
		command: 'echo "2 + 3 = $((2 + 3))" && echo "10 * 5 = $((10 * 5))"'
	});
	console.log('Command:', 'echo "2 + 3 = $((2 + 3))" && echo "10 * 5 = $((10 * 5))"');
	console.log('Success:', !result3.isError);
	console.log('Output preview:', result3.content.split('\n')[5]);
	console.log('');

	// Test 4: Current directory operations
	console.log('4️⃣ Test: Directory Operations');
	const result4 = await toolManager.executeTool('cipher_bash', {
		command: 'pwd && ls -la | head -5'
	});
	console.log('Command:', 'pwd && ls -la | head -5');
	console.log('Success:', !result4.isError);
	console.log('Shows current directory and files');
	console.log('');

	await toolManager.shutdown();
	console.log('✅ Basic commands testing completed!');
}

testBasicCommands().catch(console.error);