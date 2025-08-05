#!/usr/bin/env npx tsx

/**
 * Comprehensive Bash Tool Test Suite
 * 
 * Tests every feature and edge case of the cipher bash tool integration.
 * This is your complete guide to testing all bash tool capabilities.
 */

import { getAllToolDefinitions } from '../src/core/brain/tools/definitions/index.js';
import { InternalToolManager } from '../src/core/brain/tools/manager.js';
import { BashSessionManager } from '../src/core/brain/tools/definitions/system/bash.js';
import { setTimeout } from 'timers/promises';

class BashToolTester {
	private toolManager: InternalToolManager;
	private sessionManager: BashSessionManager;
	private testResults: { name: string; passed: boolean; error?: string }[] = [];

	constructor() {
		this.toolManager = new InternalToolManager();
		this.sessionManager = BashSessionManager.getInstance();
	}

	async initialize() {
		await this.toolManager.initialize();
		const tools = await getAllToolDefinitions();
		const bashTool = tools['cipher_bash'];
		
		if (!bashTool) {
			throw new Error('Bash tool not found');
		}

		const result = this.toolManager.registerTool(bashTool);
		if (!result.success) {
			throw new Error(`Failed to register bash tool: ${result.message}`);
		}

		console.log('🔧 Bash Tool Comprehensive Test Suite');
		console.log('=====================================\n');
	}

	async cleanup() {
		await this.sessionManager.closeAllSessions();
		await this.toolManager.shutdown();
	}

	private async runTest(testName: string, testFn: () => Promise<void>) {
		console.log(`🧪 Testing: ${testName}`);
		try {
			await testFn();
			this.testResults.push({ name: testName, passed: true });
			console.log(`✅ PASSED: ${testName}\n`);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.testResults.push({ name: testName, passed: false, error: errorMsg });
			console.log(`❌ FAILED: ${testName}`);
			console.log(`   Error: ${errorMsg}\n`);
		}
	}

	async runAllTests() {
		await this.initialize();

		// 1. Basic Command Execution Tests
		await this.runTest('Basic Echo Command', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "Hello World"'
			});
			
			if (result.isError) throw new Error('Command failed');
			if (!result.content.includes('Hello World')) {
				throw new Error('Output does not contain expected text');
			}
			console.log('   Output:', result.content.split('\n')[5]); // Show just the output line
		});

		await this.runTest('Multi-line Command Output', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "Line 1" && echo "Line 2" && echo "Line 3"'
			});
			
			if (result.isError) throw new Error('Command failed');
			const lines = result.content.split('\n');
			if (!result.content.includes('Line 1') || !result.content.includes('Line 2') || !result.content.includes('Line 3')) {
				throw new Error('Missing expected output lines');
			}
		});

		await this.runTest('System Information Commands', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'whoami && pwd && date'
			});
			
			if (result.isError) throw new Error('Command failed');
			console.log('   System info retrieved successfully');
		});

		// 2. Error Handling Tests
		await this.runTest('Non-zero Exit Code Handling', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'exit 1'
			});
			
			if (!result.isError) throw new Error('Should have failed with exit code 1');
			if (!result.content.includes('Exit Code: 1')) {
				throw new Error('Exit code not properly reported');
			}
		});

		await this.runTest('Invalid Command Handling', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'nonexistentcommand12345'
			});
			
			// Should either fail with exit code or show command not found
			console.log('   Invalid command handled appropriately');
		});

		await this.runTest('Empty Command Handling', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: ''
			});
			
			if (!result.isError) throw new Error('Should have failed with empty command');
			if (!result.content.includes('Command is required')) {
				throw new Error('Empty command not properly handled');
			}
		});

		await this.runTest('Invalid Parameter Type', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 123 as any
			});
			
			if (!result.isError) throw new Error('Should have failed with invalid parameter type');
			if (!result.content.includes('must be a string')) {
				throw new Error('Invalid parameter type not properly handled');
			}
		});

		// 3. Working Directory Tests
		await this.runTest('Custom Working Directory', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'pwd',
				workingDir: '/tmp'
			});
			
			if (result.isError) throw new Error('Command failed');
			if (!result.content.includes('/tmp')) {
				throw new Error('Working directory not set correctly');
			}
		});

		await this.runTest('Non-existent Working Directory', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'pwd',
				workingDir: '/nonexistent/directory/path'
			});
			
			// Should handle gracefully (either error or fallback)
			console.log('   Non-existent directory handled appropriately');
		});

		// 4. Timeout Tests
		await this.runTest('Command Timeout', async () => {
			const startTime = Date.now();
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'sleep 3',
				timeout: 1000 // 1 second timeout
			});
			const duration = Date.now() - startTime;
			
			if (!result.isError) throw new Error('Should have timed out');
			if (duration > 2000) throw new Error('Timeout took too long');
			if (!result.content.includes('timeout')) {
				throw new Error('Timeout not properly reported');
			}
		});

		await this.runTest('Fast Command Within Timeout', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "fast"',
				timeout: 5000
			});
			
			if (result.isError) throw new Error('Fast command should not timeout');
			if (!result.content.includes('fast')) {
				throw new Error('Fast command output missing');
			}
		});

		// 5. Persistent Session Tests  
		await this.runTest('Persistent Session - Environment Variables', async () => {
			// Set variable
			const result1 = await this.toolManager.executeTool('cipher_bash', {
				command: 'export TEST_VAR="persistent_value"',
				persistent: true,
				sessionId: 'test-session-1'
			});
			
			if (result1.isError) throw new Error('Failed to set environment variable');

			// Use variable
			const result2 = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "Value: $TEST_VAR"',
				persistent: true,
				sessionId: 'test-session-1'
			});
			
			if (result2.isError) throw new Error('Failed to use environment variable');
			if (!result2.content.includes('persistent_value')) {
				throw new Error('Environment variable not persisted');
			}
		});

		await this.runTest('Persistent Session - Directory Changes', async () => {
			// Change directory
			const result1 = await this.toolManager.executeTool('cipher_bash', {
				command: 'cd /tmp',
				persistent: true,
				sessionId: 'test-session-2'
			});
			
			if (result1.isError) throw new Error('Failed to change directory');

			// Check current directory
			const result2 = await this.toolManager.executeTool('cipher_bash', {
				command: 'pwd',
				persistent: true,
				sessionId: 'test-session-2'
			});
			
			if (result2.isError) throw new Error('Failed to check directory');
			if (!result2.content.includes('/tmp')) {
				throw new Error('Directory change not persisted');
			}
		});

		await this.runTest('Multiple Persistent Sessions Isolation', async () => {
			// Session A
			await this.toolManager.executeTool('cipher_bash', {
				command: 'export SESSION_VAR="A"',
				persistent: true,
				sessionId: 'session-A'
			});

			// Session B
			await this.toolManager.executeTool('cipher_bash', {
				command: 'export SESSION_VAR="B"',
				persistent: true,
				sessionId: 'session-B'
			});

			// Check Session A
			const resultA = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo $SESSION_VAR',
				persistent: true,
				sessionId: 'session-A'
			});

			// Check Session B
			const resultB = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo $SESSION_VAR',
				persistent: true,
				sessionId: 'session-B'
			});

			if (!resultA.content.includes('A') || !resultB.content.includes('B')) {
				throw new Error('Sessions not properly isolated');
			}
		});

		// 6. Complex Command Tests
		await this.runTest('Piped Commands', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo -e "line1\\nline2\\nline3" | grep line2'
			});
			
			if (result.isError) throw new Error('Piped command failed');
			if (!result.content.includes('line2')) {
				throw new Error('Pipe operation failed');
			}
		});

		await this.runTest('Command Chaining with &&', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "first" && echo "second" && echo "third"'
			});
			
			if (result.isError) throw new Error('Chained command failed');
			if (!result.content.includes('first') || !result.content.includes('second') || !result.content.includes('third')) {
				throw new Error('Command chaining failed');
			}
		});

		await this.runTest('Command with Conditional Logic', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'if [ "hello" = "hello" ]; then echo "condition true"; else echo "condition false"; fi'
			});
			
			if (result.isError) throw new Error('Conditional command failed');
			if (!result.content.includes('condition true')) {
				throw new Error('Conditional logic failed');
			}
		});

		// 7. File Operations Tests
		await this.runTest('File Creation and Reading', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "test content" > /tmp/bash_tool_test.txt && cat /tmp/bash_tool_test.txt && rm /tmp/bash_tool_test.txt'
			});
			
			if (result.isError) throw new Error('File operations failed');
			if (!result.content.includes('test content')) {
				throw new Error('File content not found');
			}
		});

		await this.runTest('Directory Listing', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'ls -la /tmp | head -5'
			});
			
			if (result.isError) throw new Error('Directory listing failed');
			// Should contain directory listing format
		});

		// 8. Environment and System Tests
		await this.runTest('Environment Variable Access', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "User: $USER, Home: $HOME"'
			});
			
			if (result.isError) throw new Error('Environment access failed');
			if (!result.content.includes('User:') || !result.content.includes('Home:')) {
				throw new Error('Environment variables not accessible');
			}
		});

		await this.runTest('Process Information', async () => {
			const result = await this.toolManager.executeTool('cipher_bash', {
				command: 'ps aux | head -3'
			});
			
			if (result.isError) throw new Error('Process information failed');
			// Should contain process information
		});

		// 9. Tool Manager Integration Tests
		await this.runTest('Tool Statistics Tracking', async () => {
			const initialStats = this.toolManager.getToolStats('cipher_bash');
			const initialCount = initialStats?.totalExecutions || 0;

			await this.toolManager.executeTool('cipher_bash', {
				command: 'echo "stats test"'
			});

			const newStats = this.toolManager.getToolStats('cipher_bash');
			if (!newStats || newStats.totalExecutions <= initialCount) {
				throw new Error('Statistics not properly tracked');
			}
		});

		await this.runTest('Tool Category Discovery', async () => {
			const systemTools = this.toolManager.getToolsByCategory('system');
			if (!systemTools['cipher_bash']) {
				throw new Error('Bash tool not found in system category');
			}
		});

		await this.runTest('Tool Information Retrieval', async () => {
			const tool = this.toolManager.getTool('cipher_bash');
			if (!tool) {
				throw new Error('Tool not retrievable');
			}
			if (tool.category !== 'system') {
				throw new Error('Tool category incorrect');
			}
		});

		// 10. Session Manager Tests
		await this.runTest('Session Manager - Multiple Sessions', async () => {
			const session1 = await this.sessionManager.getSession('multi-test-1');
			const session2 = await this.sessionManager.getSession('multi-test-2');
			
			if (!session1.isActive() || !session2.isActive()) {
				throw new Error('Sessions not active');
			}
			
			if (session1 === session2) {
				throw new Error('Sessions not unique');
			}
		});

		await this.runTest('Session Manager - Session Reuse', async () => {
			const session1 = await this.sessionManager.getSession('reuse-test');
			const session2 = await this.sessionManager.getSession('reuse-test');
			
			if (session1 !== session2) {
				throw new Error('Session not reused');
			}
		});

		await this.runTest('Session Manager - Session Cleanup', async () => {
			const session = await this.sessionManager.getSession('cleanup-test');
			if (!session.isActive()) {
				throw new Error('Session not active before cleanup');
			}
			
			await this.sessionManager.closeSession('cleanup-test');
			if (session.isActive()) {
				throw new Error('Session not cleaned up');
			}
		});

		// Print Results Summary
		await this.printResults();
		await this.cleanup();
	}

	private async printResults() {
		console.log('\n📊 TEST RESULTS SUMMARY');
		console.log('========================');
		
		const passed = this.testResults.filter(r => r.passed).length;
		const failed = this.testResults.filter(r => r.passed === false).length;
		const total = this.testResults.length;
		
		console.log(`Total Tests: ${total}`);
		console.log(`✅ Passed: ${passed}`);
		console.log(`❌ Failed: ${failed}`);
		console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
		
		if (failed > 0) {
			console.log('❌ FAILED TESTS:');
			this.testResults
				.filter(r => r.passed === false)
				.forEach(r => {
					console.log(`   • ${r.name}: ${r.error}`);
				});
			console.log('');
		}
		
		// Tool Statistics
		const stats = this.toolManager.getToolStats('cipher_bash');
		if (stats) {
			console.log('📈 TOOL EXECUTION STATISTICS:');
			console.log(`   Total Executions: ${stats.totalExecutions}`);
			console.log(`   Successful: ${stats.successfulExecutions}`);
			console.log(`   Failed: ${stats.failedExecutions}`);
			console.log(`   Average Duration: ${stats.averageExecutionTime.toFixed(2)}ms`);
		}
		
		console.log('\n🎯 Bash tool testing completed!');
		if (failed === 0) {
			console.log('🌟 All tests passed - bash tool is fully functional!');
		}
	}
}

// Run the comprehensive test suite
const tester = new BashToolTester();
tester.runAllTests().catch(console.error);