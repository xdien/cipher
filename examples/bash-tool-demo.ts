#!/usr/bin/env npx tsx

/**
 * Bash Tool Demo
 * 
 * Demonstrates the bash command tool integration with cipher.
 * This shows how an agent can execute system commands through the new bash tool.
 */

import { getAllToolDefinitions } from '../src/core/brain/tools/definitions/index.js';
import { InternalToolManager } from '../src/core/brain/tools/manager.js';
import { BashSessionManager } from '../src/core/brain/tools/definitions/system/bash.js';

async function demonstrateBashTool() {
	console.log('🔧 Cipher Bash Tool Demo\n');

	// Initialize tool manager
	const toolManager = new InternalToolManager();
	await toolManager.initialize();

	// Load and register tools
	const tools = await getAllToolDefinitions();
	const bashTool = tools['cipher_bash'];
	
	if (!bashTool) {
		console.error('❌ Bash tool not found in definitions');
		return;
	}

	const result = toolManager.registerTool(bashTool);
	if (!result.success) {
		console.error(`❌ Failed to register bash tool: ${result.message}`);
		return;
	}

	console.log('✅ Bash tool registered successfully');
	console.log(`📋 Tool: ${bashTool.name}`);
	console.log(`📂 Category: ${bashTool.category}`);
	console.log(`📝 Description: ${bashTool.description}\n`);

	// Demo 1: Simple command execution
	console.log('🚀 Demo 1: Simple Command Execution');
	try {
		const result1 = await toolManager.executeTool(
			'cipher_bash',
			{ command: 'echo "Hello from Cipher Bash Tool!"' },
			{ sessionId: 'demo-session', userId: 'demo-user' }
		);
		
		console.log('📤 Command: echo "Hello from Cipher Bash Tool!"');
		console.log('📥 Result:');
		console.log(result1.content);
		console.log('');
	} catch (error) {
		console.error('❌ Demo 1 failed:', error);
	}

	// Demo 2: System information
	console.log('🚀 Demo 2: System Information');
	try {
		const result2 = await toolManager.executeTool(
			'cipher_bash',
			{ command: 'uname -a && pwd && whoami' },
			{ sessionId: 'demo-session', userId: 'demo-user' }
		);
		
		console.log('📤 Command: uname -a && pwd && whoami');
		console.log('📥 Result:');
		console.log(result2.content);
		console.log('');
	} catch (error) {
		console.error('❌ Demo 2 failed:', error);
	}

	// Demo 3: Persistent session (state preservation)
	console.log('🚀 Demo 3: Persistent Session (State Preservation)');
	try {
		// Set environment variable
		const result3a = await toolManager.executeTool(
			'cipher_bash',
			{ command: 'export DEMO_VAR="Persistent state works!"', persistent: true },
			{ sessionId: 'persistent-demo', userId: 'demo-user' }
		);
		
		console.log('📤 Command 1: export DEMO_VAR="Persistent state works!"');
		console.log('📥 Result 1:');
		console.log(result3a.content);
		console.log('');

		// Use the variable in a new command
		const result3b = await toolManager.executeTool(
			'cipher_bash',
			{ command: 'echo "Variable value: $DEMO_VAR"', persistent: true },
			{ sessionId: 'persistent-demo', userId: 'demo-user' }
		);
		
		console.log('📤 Command 2: echo "Variable value: $DEMO_VAR"');
		console.log('📥 Result 2:');
		console.log(result3b.content);
		console.log('');
	} catch (error) {
		console.error('❌ Demo 3 failed:', error);
	}

	// Demo 4: Working directory parameter
	console.log('🚀 Demo 4: Working Directory Parameter');
	try {
		const result4 = await toolManager.executeTool(
			'cipher_bash',
			{ command: 'pwd && ls -la', workingDir: '/tmp' },
			{ sessionId: 'demo-session', userId: 'demo-user' }
		);
		
		console.log('📤 Command: pwd && ls -la (in /tmp)');
		console.log('📥 Result:');
		console.log(result4.content);
		console.log('');
	} catch (error) {
		console.error('❌ Demo 4 failed:', error);
	}

	// Show statistics
	console.log('📊 Tool Execution Statistics');
	const stats = toolManager.getToolStats('cipher_bash');
	if (stats) {
		console.log(`   Total Executions: ${stats.totalExecutions}`);
		console.log(`   Successful: ${stats.successfulExecutions}`);
		console.log(`   Failed: ${stats.failedExecutions}`);
		console.log(`   Average Duration: ${stats.averageExecutionTime.toFixed(2)}ms`);
	}

	// Cleanup
	const sessionManager = BashSessionManager.getInstance();
	await sessionManager.closeAllSessions();
	await toolManager.shutdown();
	
	console.log('\n✅ Demo completed successfully!');
	console.log('🎯 The bash tool is now fully integrated with cipher and ready for use by agents.');
}

// Run the demo
demonstrateBashTool().catch(console.error);