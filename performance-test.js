#!/usr/bin/env node

/**
 * Performance Testing Script for Session Optimizations
 * 
 * This script tests the performance improvements made to session loading and API efficiency.
 */

const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const TEST_ITERATIONS = process.env.TEST_ITERATIONS || 10;

async function performanceTest() {
    console.log('🚀 Starting Session Performance Tests...\n');
    
    const results = {
        sessionListTests: [],
        sessionHistoryTests: [],
        performanceStats: null
    };

    // Test 1: Session List Performance
    console.log('📋 Testing Session List Performance...');
    for (let i = 0; i < TEST_ITERATIONS; i++) {
        const start = Date.now();
        try {
            const response = await fetch(`${API_BASE}/api/sessions`);
            const data = await response.json();
            const duration = Date.now() - start;
            
            results.sessionListTests.push({
                iteration: i + 1,
                duration,
                sessionCount: data.data?.sessions?.length || 0,
                processingTime: data.data?.processingTime || 0,
                success: response.ok
            });
            
            console.log(`  ✅ Iteration ${i + 1}: ${duration}ms (${data.data?.sessions?.length || 0} sessions)`);
        } catch (error) {
            results.sessionListTests.push({
                iteration: i + 1,
                duration: Date.now() - start,
                error: error.message,
                success: false
            });
            console.log(`  ❌ Iteration ${i + 1}: Failed - ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Test 2: Session History Performance (if sessions exist)
    const sessionListResponse = await fetch(`${API_BASE}/api/sessions`);
    const sessionListData = await sessionListResponse.json();
    const sessions = sessionListData.data?.sessions || [];
    
    if (sessions.length > 0) {
        console.log('\n📚 Testing Session History Performance...');
        const testSessionId = sessions[0].id;
        
        for (let i = 0; i < Math.min(TEST_ITERATIONS, 5); i++) {
            const start = Date.now();
            try {
                const response = await fetch(`${API_BASE}/api/sessions/${testSessionId}/history`);
                const data = await response.json();
                const duration = Date.now() - start;
                
                results.sessionHistoryTests.push({
                    iteration: i + 1,
                    sessionId: testSessionId,
                    duration,
                    messageCount: data.data?.history?.length || 0,
                    processingTime: data.data?.processingTime || 0,
                    source: data.data?.source || 'unknown',
                    success: response.ok
                });
                
                console.log(`  ✅ Iteration ${i + 1}: ${duration}ms (${data.data?.history?.length || 0} messages, source: ${data.data?.source})`);
            } catch (error) {
                results.sessionHistoryTests.push({
                    iteration: i + 1,
                    sessionId: testSessionId,
                    duration: Date.now() - start,
                    error: error.message,
                    success: false
                });
                console.log(`  ❌ Iteration ${i + 1}: Failed - ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Test 3: Performance Stats
    console.log('\n📊 Getting Performance Statistics...');
    try {
        const response = await fetch(`${API_BASE}/api/sessions/stats`);
        const data = await response.json();
        results.performanceStats = data.data;
        console.log('  ✅ Performance stats retrieved successfully');
    } catch (error) {
        console.log(`  ❌ Failed to get performance stats: ${error.message}`);
    }

    // Analyze and report results
    console.log('\n📈 Performance Test Results:');
    console.log('=' .repeat(50));
    
    // Session List Analysis
    const successfulListTests = results.sessionListTests.filter(t => t.success);
    if (successfulListTests.length > 0) {
        const avgDuration = successfulListTests.reduce((sum, t) => sum + t.duration, 0) / successfulListTests.length;
        const minDuration = Math.min(...successfulListTests.map(t => t.duration));
        const maxDuration = Math.max(...successfulListTests.map(t => t.duration));
        const avgProcessingTime = successfulListTests.reduce((sum, t) => sum + (t.processingTime || 0), 0) / successfulListTests.length;
        
        console.log('\n🔍 Session List Performance:');
        console.log(`  • Average Response Time: ${avgDuration.toFixed(2)}ms`);
        console.log(`  • Fastest Response: ${minDuration}ms`);
        console.log(`  • Slowest Response: ${maxDuration}ms`);
        console.log(`  • Average Backend Processing: ${avgProcessingTime.toFixed(2)}ms`);
        console.log(`  • Success Rate: ${(successfulListTests.length / results.sessionListTests.length * 100).toFixed(1)}%`);
        
        // Performance Assessment
        if (avgDuration < 200) {
            console.log('  ✅ EXCELLENT: Session list loading is very fast!');
        } else if (avgDuration < 500) {
            console.log('  ✅ GOOD: Session list loading performance is acceptable');
        } else if (avgDuration < 1000) {
            console.log('  ⚠️  MODERATE: Session list loading could be improved');
        } else {
            console.log('  ❌ POOR: Session list loading is slow and needs optimization');
        }
    }

    // Session History Analysis
    const successfulHistoryTests = results.sessionHistoryTests.filter(t => t.success);
    if (successfulHistoryTests.length > 0) {
        const avgDuration = successfulHistoryTests.reduce((sum, t) => sum + t.duration, 0) / successfulHistoryTests.length;
        const minDuration = Math.min(...successfulHistoryTests.map(t => t.duration));
        const maxDuration = Math.max(...successfulHistoryTests.map(t => t.duration));
        const avgProcessingTime = successfulHistoryTests.reduce((sum, t) => sum + (t.processingTime || 0), 0) / successfulHistoryTests.length;
        
        console.log('\n📚 Session History Performance:');
        console.log(`  • Average Response Time: ${avgDuration.toFixed(2)}ms`);
        console.log(`  • Fastest Response: ${minDuration}ms`);
        console.log(`  • Slowest Response: ${maxDuration}ms`);
        console.log(`  • Average Backend Processing: ${avgProcessingTime.toFixed(2)}ms`);
        console.log(`  • Success Rate: ${(successfulHistoryTests.length / results.sessionHistoryTests.length * 100).toFixed(1)}%`);
        
        // Caching effectiveness
        const cacheHits = successfulHistoryTests.filter(t => t.source && t.source.includes('database')).length;
        if (cacheHits > 0) {
            console.log(`  • Database queries: ${cacheHits}/${successfulHistoryTests.length} (${(cacheHits/successfulHistoryTests.length*100).toFixed(1)}%)`);
        }
    }

    // Performance Stats Analysis
    if (results.performanceStats?.sessionStats?.performanceMetrics) {
        const metrics = results.performanceStats.sessionStats.performanceMetrics;
        console.log('\n🎯 System Performance Metrics:');
        console.log(`  • Cache Hit Rate: ${metrics.cacheHitRate}%`);
        console.log(`  • Parallel Load Ratio: ${metrics.parallelLoadRatio}%`);
        console.log(`  • Average Load Time: ${metrics.averageLoadTime.toFixed(2)}ms`);
        console.log(`  • Cache Size: ${metrics.cacheSize} entries`);
        console.log(`  • Active Sessions: ${results.performanceStats.sessionStats.activeSessions}`);
        console.log(`  • Storage Connected: ${results.performanceStats.sessionStats.storageConnected ? '✅' : '❌'}`);
        console.log(`  • Storage Type: ${results.performanceStats.sessionStats.storageType}`);
        
        // Memory usage
        if (results.performanceStats.runtimeStats?.memoryUsage) {
            const memory = results.performanceStats.runtimeStats.memoryUsage;
            console.log(`  • Memory Usage: ${(memory.heapUsed / 1024 / 1024).toFixed(2)}MB heap`);
            console.log(`  • Uptime: ${(results.performanceStats.runtimeStats.uptime / 60).toFixed(1)} minutes`);
        }
        
        // Performance assessment
        if (metrics.cacheHitRate > 80) {
            console.log('  ✅ EXCELLENT: Cache performance is optimal!');
        } else if (metrics.cacheHitRate > 60) {
            console.log('  ✅ GOOD: Cache performance is working well');
        } else if (metrics.cacheHitRate > 30) {
            console.log('  ⚠️  MODERATE: Cache could be more effective');
        } else {
            console.log('  ❌ POOR: Cache is not working effectively');
        }
    }

    console.log('\n🎉 Performance test completed!');
    
    // Save results to file
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-results-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`📁 Results saved to: ${filename}`);
    
    return results;
}

// Run the performance test
if (require.main === module) {
    performanceTest().catch(error => {
        console.error('❌ Performance test failed:', error);
        process.exit(1);
    });
}

module.exports = { performanceTest };