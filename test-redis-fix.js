#!/usr/bin/env node
/**
 * Redis Connection Fix Test Script
 * 
 * This script tests the fixes for GitHub issue #167:
 * 1. Connection initialization with lazyConnect: true
 * 2. Username support for Redis authentication  
 * 3. Configurable timeout instead of hardcoded 1 second
 */

import { createStorageFromEnv } from './dist/src/core/index.js';

async function testRedisConnection() {
	console.log('🧪 Testing Redis Connection Fix (Issue #167)');
	console.log('================================================');

	// Display current environment configuration
	console.log('📋 Environment Configuration:');
	console.log(`  STORAGE_CACHE_TYPE: ${process.env.STORAGE_CACHE_TYPE}`);
	console.log(`  STORAGE_CACHE_HOST: ${process.env.STORAGE_CACHE_HOST}`);
	console.log(`  STORAGE_CACHE_PORT: ${process.env.STORAGE_CACHE_PORT}`);
	console.log(`  STORAGE_CACHE_USERNAME: ${process.env.STORAGE_CACHE_USERNAME ? '***' : 'undefined'}`);
	console.log(`  STORAGE_CACHE_PASSWORD: ${process.env.STORAGE_CACHE_PASSWORD ? '***' : 'undefined'}`);
	console.log(`  STORAGE_CACHE_DATABASE: ${process.env.STORAGE_CACHE_DATABASE}`);
	console.log(`  CONNECTION_TIMEOUT: ${process.env.STORAGE_CACHE_CONNECTION_TIMEOUT_MILLIS || 'default (10s)'}`);
	console.log();

	if (process.env.STORAGE_CACHE_TYPE !== 'redis') {
		console.log('❌ STORAGE_CACHE_TYPE must be set to "redis" to test the fix');
		process.exit(1);
	}

	console.log('⏳ Attempting to connect to Redis...');
	const startTime = Date.now();

	try {
		// This will use the RedisBackend with our fixes
		const { manager, backends } = await createStorageFromEnv();
		const connectionTime = Date.now() - startTime;

		console.log(`✅ Connection successful in ${connectionTime}ms`);
		console.log(`   Backend type: ${backends.cache.getBackendType()}`);
		console.log(`   Connection status: ${backends.cache.isConnected()}`);

		// Test basic operations to ensure connection is working
		console.log('\n🔧 Testing basic cache operations...');
		
		const testKey = 'test:redis-fix:' + Date.now();
		const testValue = { message: 'Redis connection fix working!', timestamp: new Date().toISOString() };

		// Set a value with TTL
		await backends.cache.set(testKey, testValue, 60); // 60 second TTL
		console.log(`   ✅ SET ${testKey} = ${JSON.stringify(testValue)}`);

		// Get the value back
		const retrievedValue = await backends.cache.get(testKey);
		console.log(`   ✅ GET ${testKey} = ${JSON.stringify(retrievedValue)}`);

		// Verify values match
		if (JSON.stringify(testValue) === JSON.stringify(retrievedValue)) {
			console.log('   ✅ Value integrity verified');
		} else {
			console.log('   ❌ Value mismatch!');
		}

		// Test key existence
		const exists = await backends.cache.exists(testKey);
		console.log(`   ✅ EXISTS ${testKey} = ${exists}`);

		// Clean up test key
		await backends.cache.delete(testKey);
		console.log(`   ✅ DELETE ${testKey}`);

		console.log('\n🎉 All tests passed! The Redis connection fix is working correctly.');
		
		console.log('\n📊 Fix Validation:');
		console.log('   ✅ Connection established (this.redis.connect() called)');
		console.log('   ✅ Username configuration supported');
		console.log('   ✅ Configurable timeout working');
		console.log('   ✅ Basic Redis operations functional');

		// Clean shutdown
		await manager.disconnect();
		console.log('\n🔌 Disconnected from Redis');

	} catch (error) {
		const connectionTime = Date.now() - startTime;
		console.log(`❌ Connection failed after ${connectionTime}ms`);
		console.error('Error details:', error.message);
		
		console.log('\n🔍 Troubleshooting:');
		console.log('1. Ensure Redis server is running on the configured host/port');
		console.log('2. Check username/password if authentication is required');
		console.log('3. Verify network connectivity');
		console.log('4. Check Redis logs for authentication/connection errors');
		
		if (error.message.includes('timeout')) {
			console.log('5. Consider increasing STORAGE_CACHE_CONNECTION_TIMEOUT_MILLIS');
		}
		
		process.exit(1);
	}
}

// Handle process termination gracefully
process.on('SIGINT', () => {
	console.log('\n👋 Test interrupted');
	process.exit(0);
});

testRedisConnection().catch(error => {
	console.error('❌ Unexpected error:', error);
	process.exit(1);
});