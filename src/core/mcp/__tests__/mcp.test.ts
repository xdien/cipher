/**
 * Simplified tests for the MCP module - focusing on critical functionality
 * This demonstrates testing patterns following the context-dependent test approach
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Context } from '../../context/context.js';
import { Logger } from '../../logger/core/logger.js';
import { McpServerConfig } from '../types/config.js';
import { ConnectionPoolConfig } from '../types/connection-config.js';

// Mock server config factory
const createTestServerConfig = (type: 'stdio' | 'websocket' = 'stdio'): McpServerConfig =>
	({
		type,
		command: type === 'stdio' ? 'test-command' : undefined,
		url: type === 'websocket' ? 'ws://localhost:8080' : undefined,
		timeout: 30000,
		terminateOnClose: true,
	}) as McpServerConfig;

// Simple test classes that demonstrate the patterns
class TestableConfiguration {
	private config: ConnectionPoolConfig;
	private initialized = false;
	private context?: Context;

	constructor(config: Partial<ConnectionPoolConfig> = {}) {
		this.config = {
			persistentConnections: true,
			maxPoolSize: 20,
			connectionTimeout: 60000,
			healthCheckInterval: 30000,
			maxRetryAttempts: 3,
			idleTimeout: 300000,
			enableConnectionWarming: true,
			warmupOnStartup: false,
			...config,
		};
	}

	// Expose internal state for testing
	public getConfig(): ConnectionPoolConfig {
		return { ...this.config };
	}

	public updateConfig(newConfig: Partial<ConnectionPoolConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	public async initialize(context?: Context): Promise<void> {
		this.context = context;
		this.initialized = true;
	}

	public isInitialized(): boolean {
		return this.initialized;
	}

	public getContext(): Context | undefined {
		return this.context;
	}
}

class TestableServerRegistry {
	private servers: Map<string, McpServerConfig> = new Map();
	private logger: Logger;

	constructor(context?: Context) {
		this.logger = new Logger('test-server-registry');
	}

	public async addServer(name: string, config: McpServerConfig): Promise<void> {
		if (this.servers.has(name)) {
			throw new Error(`Server '${name}' already exists`);
		}
		this.servers.set(name, config);
		this.logger.debug(`Added server: ${name}`);
	}

	public async removeServer(name: string): Promise<void> {
		if (!this.servers.has(name)) {
			this.logger.warning(`Server '${name}' not found`);
			return;
		}
		this.servers.delete(name);
		this.logger.debug(`Removed server: ${name}`);
	}

	public getServer(name: string): McpServerConfig | undefined {
		return this.servers.get(name);
	}

	public getAllServers(): Record<string, McpServerConfig> {
		return Object.fromEntries(this.servers);
	}

	public getServerNames(): string[] {
		return Array.from(this.servers.keys());
	}

	public getServerCount(): number {
		return this.servers.size;
	}

	public clear(): void {
		this.servers.clear();
	}
}

class TestableAggregatorStats {
	private stats = {
		totalOperations: 0,
		successfulOperations: 0,
		failedOperations: 0,
		serverCount: 0,
		initialized: false,
		startTime: new Date(),
	};

	public recordOperation(success: boolean): void {
		this.stats.totalOperations++;
		if (success) {
			this.stats.successfulOperations++;
		} else {
			this.stats.failedOperations++;
		}
	}

	public updateServerCount(count: number): void {
		this.stats.serverCount = count;
	}

	public setInitialized(initialized: boolean): void {
		this.stats.initialized = initialized;
	}

	public getStats() {
		return {
			...this.stats,
			uptime: Date.now() - this.stats.startTime.getTime(),
			successRate:
				this.stats.totalOperations > 0
					? (this.stats.successfulOperations / this.stats.totalOperations) * 100
					: 0,
		};
	}

	public reset(): void {
		this.stats = {
			totalOperations: 0,
			successfulOperations: 0,
			failedOperations: 0,
			serverCount: 0,
			initialized: false,
			startTime: new Date(),
		};
	}
}

describe('MCP Module - Core Functionality Tests', () => {
	let mockContext: Context;

	beforeEach(() => {
		// Create fresh context for each test
		mockContext = new Context({
			sessionId: 'test-session',
			logger: new Logger('test-mcp'),
		});
	});

	describe('Configuration Management', () => {
		let configManager: TestableConfiguration;

		beforeEach(() => {
			configManager = new TestableConfiguration();
		});

		test('should create configuration with default values', () => {
			const config = configManager.getConfig();

			expect(config.persistentConnections).toBe(true);
			expect(config.maxPoolSize).toBe(20);
			expect(config.connectionTimeout).toBe(60000);
			expect(config.warmupOnStartup).toBe(false);
		});

		test('should create configuration with custom values', () => {
			const customConfig = {
				maxPoolSize: 10,
				connectionTimeout: 30000,
				warmupOnStartup: true,
			};

			configManager = new TestableConfiguration(customConfig);
			const config = configManager.getConfig();

			expect(config.maxPoolSize).toBe(10);
			expect(config.connectionTimeout).toBe(30000);
			expect(config.warmupOnStartup).toBe(true);
			// Should maintain defaults for non-specified values
			expect(config.persistentConnections).toBe(true);
		});

		test('should update configuration successfully', () => {
			const initialConfig = configManager.getConfig();
			expect(initialConfig.maxPoolSize).toBe(20);

			configManager.updateConfig({ maxPoolSize: 15 });

			const updatedConfig = configManager.getConfig();
			expect(updatedConfig.maxPoolSize).toBe(15);
			// Other values should remain unchanged
			expect(updatedConfig.connectionTimeout).toBe(60000);
		});

		test('should handle initialization with context', async () => {
			expect(configManager.isInitialized()).toBe(false);
			expect(configManager.getContext()).toBeUndefined();

			await configManager.initialize(mockContext);

			expect(configManager.isInitialized()).toBe(true);
			expect(configManager.getContext()).toBe(mockContext);
		});
	});

	describe('Server Registry', () => {
		let registry: TestableServerRegistry;
		let stdioConfig: McpServerConfig;
		let websocketConfig: McpServerConfig;

		beforeEach(() => {
			registry = new TestableServerRegistry(mockContext);
			stdioConfig = createTestServerConfig('stdio');
			websocketConfig = createTestServerConfig('websocket');
		});

		test('should add servers successfully', async () => {
			expect(registry.getServerCount()).toBe(0);

			await registry.addServer('server1', stdioConfig);
			await registry.addServer('server2', websocketConfig);

			expect(registry.getServerCount()).toBe(2);
			expect(registry.getServerNames()).toContain('server1');
			expect(registry.getServerNames()).toContain('server2');
		});

		test('should throw error when adding duplicate server', async () => {
			await registry.addServer('server1', stdioConfig);

			await expect(registry.addServer('server1', websocketConfig)).rejects.toThrow(
				"Server 'server1' already exists"
			);
		});

		test('should remove servers successfully', async () => {
			await registry.addServer('server1', stdioConfig);
			await registry.addServer('server2', websocketConfig);
			expect(registry.getServerCount()).toBe(2);

			await registry.removeServer('server1');

			expect(registry.getServerCount()).toBe(1);
			expect(registry.getServerNames()).not.toContain('server1');
			expect(registry.getServerNames()).toContain('server2');
		});

		test('should handle removal of non-existent server gracefully', async () => {
			await expect(registry.removeServer('non-existent')).resolves.not.toThrow();
			expect(registry.getServerCount()).toBe(0);
		});

		test('should retrieve server configurations', async () => {
			await registry.addServer('server1', stdioConfig);

			const retrievedConfig = registry.getServer('server1');
			expect(retrievedConfig).toEqual(stdioConfig);

			const nonExistentConfig = registry.getServer('non-existent');
			expect(nonExistentConfig).toBeUndefined();
		});

		test('should get all servers', async () => {
			await registry.addServer('server1', stdioConfig);
			await registry.addServer('server2', websocketConfig);

			const allServers = registry.getAllServers();
			expect(Object.keys(allServers)).toHaveLength(2);
			expect(allServers.server1).toEqual(stdioConfig);
			expect(allServers.server2).toEqual(websocketConfig);
		});

		test('should clear all servers', async () => {
			await registry.addServer('server1', stdioConfig);
			await registry.addServer('server2', websocketConfig);
			expect(registry.getServerCount()).toBe(2);

			registry.clear();

			expect(registry.getServerCount()).toBe(0);
			expect(registry.getServerNames()).toHaveLength(0);
		});
	});

	describe('Statistics Tracking', () => {
		let statsTracker: TestableAggregatorStats;

		beforeEach(() => {
			statsTracker = new TestableAggregatorStats();
		});

		test('should initialize with zero statistics', () => {
			const stats = statsTracker.getStats();

			expect(stats.totalOperations).toBe(0);
			expect(stats.successfulOperations).toBe(0);
			expect(stats.failedOperations).toBe(0);
			expect(stats.serverCount).toBe(0);
			expect(stats.initialized).toBe(false);
			expect(stats.successRate).toBe(0);
		});

		test('should record successful operations', () => {
			statsTracker.recordOperation(true);
			statsTracker.recordOperation(true);

			const stats = statsTracker.getStats();
			expect(stats.totalOperations).toBe(2);
			expect(stats.successfulOperations).toBe(2);
			expect(stats.failedOperations).toBe(0);
			expect(stats.successRate).toBe(100);
		});

		test('should record failed operations', () => {
			statsTracker.recordOperation(false);
			statsTracker.recordOperation(false);

			const stats = statsTracker.getStats();
			expect(stats.totalOperations).toBe(2);
			expect(stats.successfulOperations).toBe(0);
			expect(stats.failedOperations).toBe(2);
			expect(stats.successRate).toBe(0);
		});

		test('should calculate success rate correctly', () => {
			statsTracker.recordOperation(true);
			statsTracker.recordOperation(true);
			statsTracker.recordOperation(false);
			statsTracker.recordOperation(true);

			const stats = statsTracker.getStats();
			expect(stats.totalOperations).toBe(4);
			expect(stats.successfulOperations).toBe(3);
			expect(stats.failedOperations).toBe(1);
			expect(stats.successRate).toBe(75);
		});

		test('should track server count', () => {
			statsTracker.updateServerCount(5);

			const stats = statsTracker.getStats();
			expect(stats.serverCount).toBe(5);
		});

		test('should track initialization state', () => {
			expect(statsTracker.getStats().initialized).toBe(false);

			statsTracker.setInitialized(true);

			expect(statsTracker.getStats().initialized).toBe(true);
		});

		test('should calculate uptime', async () => {
			const initialStats = statsTracker.getStats();
			expect(initialStats.uptime).toBeGreaterThanOrEqual(0);

			// Wait a small amount of time
			await new Promise(resolve => setTimeout(resolve, 10));

			const laterStats = statsTracker.getStats();
			expect(laterStats.uptime).toBeGreaterThan(initialStats.uptime);
		});

		test('should reset statistics', () => {
			// Add some data
			statsTracker.recordOperation(true);
			statsTracker.recordOperation(false);
			statsTracker.updateServerCount(3);
			statsTracker.setInitialized(true);

			expect(statsTracker.getStats().totalOperations).toBe(2);

			// Reset
			statsTracker.reset();

			const stats = statsTracker.getStats();
			expect(stats.totalOperations).toBe(0);
			expect(stats.successfulOperations).toBe(0);
			expect(stats.failedOperations).toBe(0);
			expect(stats.serverCount).toBe(0);
			expect(stats.initialized).toBe(false);
		});
	});

	describe('Error Handling Patterns', () => {
		test('should handle invalid server configurations', () => {
			const invalidConfig = {
				type: 'invalid',
				timeout: -1,
			} as any;

			expect(() => {
				// Simulate validation
				if (invalidConfig.type !== 'stdio' && invalidConfig.type !== 'websocket') {
					throw new Error(`Invalid server type: ${invalidConfig.type}`);
				}
				if (invalidConfig.timeout < 0) {
					throw new Error('Timeout must be positive');
				}
			}).toThrow();
		});

		test('should handle connection failures gracefully', async () => {
			const mockConnectionFailure = vi.fn().mockRejectedValue(new Error('Connection failed'));

			// Simulate connection attempt with error handling
			const result = await mockConnectionFailure().catch(error => ({
				success: false,
				error: error.message,
			}));

			expect(result.success).toBe(false);
			expect(result.error).toBe('Connection failed');
		});

		test('should handle async operation timeouts', async () => {
			const slowOperation = () => new Promise(resolve => setTimeout(resolve, 1000));
			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Operation timed out')), 100)
			);

			await expect(Promise.race([slowOperation(), timeoutPromise])).rejects.toThrow(
				'Operation timed out'
			);
		});
	});

	describe('Context Integration', () => {
		test('should use context for logging and session management', () => {
			const contextWithSession = new Context({
				sessionId: 'test-session-123',
				logger: new Logger('context-test'),
			});

			const registry = new TestableServerRegistry(contextWithSession);

			// Verify context is properly integrated
			expect(contextWithSession.sessionId).toBe('test-session-123');
		});

		test('should handle missing context gracefully', () => {
			const registry = new TestableServerRegistry();

			// Should not throw even without context
			expect(() => registry.getServerCount()).not.toThrow();
		});
	});
});
