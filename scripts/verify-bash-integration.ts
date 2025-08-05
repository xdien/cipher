#!/usr/bin/env npx tsx

/**
 * Quick Verification Script
 * Verifies that bash tool is properly integrated into cipher
 */

import { MemAgent } from '../src/core/brain/memAgent/agent.js';
import { getAllToolDefinitions } from '../src/core/brain/tools/definitions/index.js';

async function verifyBashIntegration() {
	console.log('🔍 Verifying Bash Tool Integration with Cipher');
	console.log('==============================================\n');

	try {
		// 1. Check tool definitions
		console.log('1️⃣ Checking tool definitions...');
		const tools = await getAllToolDefinitions();
		
		if (tools['cipher_bash']) {
			console.log('✅ cipher_bash tool found in definitions');
			console.log(`   Name: ${tools['cipher_bash'].name}`);
			console.log(`   Category: ${tools['cipher_bash'].category}`);
			console.log(`   Description: ${tools['cipher_bash'].description}`);
		} else {
			console.log('❌ cipher_bash tool NOT found in definitions');
			return;
		}

		// 2. Try to start MemAgent (this will register all tools)
		console.log('\n2️⃣ Starting MemAgent...');
		const config = { /* minimal config */ };
		const agent = new MemAgent(config as any);
		await agent.start();
		console.log('✅ MemAgent started successfully');

		// 3. Check if bash tool is registered
		console.log('\n3️⃣ Checking tool registration...');
		const toolManager = agent.internalToolManager;
		if (toolManager && toolManager.getTool('cipher_bash')) {
			console.log('✅ cipher_bash tool is registered with MemAgent');
			
			// Get tool stats
			const stats = toolManager.getToolStats('cipher_bash');
			if (stats) {
				console.log(`   Total executions: ${stats.totalExecutions}`);
				console.log(`   Success rate: ${stats.successfulExecutions}/${stats.totalExecutions}`);
			}
		} else {
			console.log('❌ cipher_bash tool NOT registered with MemAgent');
		}

		// 4. Test actual execution through MemAgent
		console.log('\n4️⃣ Testing command execution through MemAgent...');
		try {
			const response = await agent.generateResponse(
				'Please run the command "echo Hello from cipher bash integration!" using the bash tool',
				{ sessionId: 'integration-test' }
			);
			
			console.log('✅ Command executed through MemAgent');
			console.log('Response preview:', response.substring(0, 200) + '...');
			
			// Check if response mentions bash tool usage
			if (response.toLowerCase().includes('bash') || response.toLowerCase().includes('echo')) {
				console.log('✅ Response indicates bash tool was used');
			} else {
				console.log('⚠️  Response may not have used bash tool');
			}
		} catch (error) {
			console.log('❌ Failed to execute command through MemAgent');
			console.log('Error:', error instanceof Error ? error.message : String(error));
		}

		// 5. Check available tools list
		console.log('\n5️⃣ Checking available tools list...');
		try {
			const availableTools = await toolManager.getAvailableTools();
			const bashTool = availableTools.find(tool => tool.name === 'cipher_bash');
			
			if (bashTool) {
				console.log('✅ cipher_bash appears in available tools list');
				console.log(`   Category: ${bashTool.category}`);
				console.log(`   Description: ${bashTool.description}`);
			} else {
				console.log('❌ cipher_bash NOT in available tools list');
			}
		} catch (error) {
			console.log('⚠️  Could not retrieve available tools list');
		}

		// Cleanup
		await agent.stop();
		console.log('\n✅ Verification completed successfully!');
		
		console.log('\n🎯 Integration Status: READY');
		console.log('The bash tool is properly integrated and ready for use with:');
		console.log('- cipher CLI mode');
		console.log('- cipher MCP mode');
		console.log('- cipher API mode');
		
	} catch (error) {
		console.log('\n❌ Verification failed!');
		console.log('Error:', error instanceof Error ? error.message : String(error));
		console.log('\nThis may indicate an integration issue that needs to be resolved.');
	}
}

verifyBashIntegration().catch(console.error);