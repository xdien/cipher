#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Workspace Memory Example
 * 
 * This example demonstrates how to use the workspace memory system
 * for team collaboration and project progress tracking.
 */

async function demonstrateWorkspaceMemory() {
    console.log('🚀 Workspace Memory Demonstration\n');
    
    console.log('✅ Workspace Memory System Overview');
    console.log('📝 Environment Variables:');
    console.log('   USE_WORKSPACE_MEMORY=true');
    console.log('   DISABLE_DEFAULT_MEMORY=true');
    console.log('   WORKSPACE_VECTOR_STORE_COLLECTION=workspace_memory');
    console.log();

    // Example team collaboration scenarios
    const teamScenarios = [
        {
            title: "Team Progress Update",
            content: "John is working on the user authentication feature and it's 75% complete. The API integration is done but still need to implement the frontend components."
        },
        {
            title: "Bug Report",
            content: "Sarah fixed a critical bug in the payment processing module. The issue was causing transaction failures and has been deployed to production."
        },
        {
            title: "Project Milestone",
            content: "The team completed the MVP milestone for the e-commerce project. Repository: github.com/company/ecommerce, branch: feature/mvp-release"
        },
        {
            title: "Code Review Assignment",
            content: "@mike please review the pull request for the search functionality. It's ready for testing and should be merged before the deadline."
        },
        {
            title: "Deployment Status",
            content: "DevOps team deployed version 2.1.0 to staging environment. Testing phase is in progress and QA team is reviewing the new features."
        }
    ];

    console.log('📊 Processing team collaboration scenarios...\n');

    for (const scenario of teamScenarios) {
        console.log(`📌 ${scenario.title}`);
        console.log(`💬 "${scenario.content}"`);
        
        // This would extract workspace information like:
        // - Team member: John, Sarah, @mike
        // - Progress: 75% complete, completed, in progress
        // - Project context: e-commerce project, github.com/company/ecommerce
        // - Status: working on, fixed, deployed, ready for testing
        // - Domain: frontend, backend, devops, QA
        
        console.log('🔍 Extracted workspace info:');
        
        // Simulate extraction results
        const extractedInfo = extractWorkspaceInfo(scenario.content);
        Object.entries(extractedInfo).forEach(([key, value]) => {
            if (value) {
                console.log(`   ${key}: ${JSON.stringify(value)}`);
            }
        });
        
        console.log('');
    }

    console.log('🔍 Example workspace memory search queries:\n');
    
    const searchQueries = [
        "What is John working on?",
        "Show me recent bug fixes",
        "What's the status of the e-commerce project?",
        "Who needs code review assignments?",
        "What deployments happened recently?"
    ];

    searchQueries.forEach(query => {
        console.log(`❓ "${query}"`);
        console.log(`   → Would search workspace memory for: team members, progress, bugs, projects, deployments`);
    });

    console.log('\n✨ Workspace memory enables:');
    console.log('   • Team collaboration tracking');
    console.log('   • Project progress monitoring');
    console.log('   • Bug and issue management');
    console.log('   • Code review coordination');
    console.log('   • Deployment and release tracking');
    console.log('   • Cross-team knowledge sharing');
}

// Simple extraction function for demo
function extractWorkspaceInfo(content) {
    const info = {};
    
    // Extract team member
    const teamMemberPatterns = [
        /([A-Z][a-z]+)\s+(?:is working on|completed|fixed|implemented)/i,
        /@([a-zA-Z_]+)/,
        /(?:team|developer)\s+([a-zA-Z]+)/i
    ];
    
    for (const pattern of teamMemberPatterns) {
        const match = content.match(pattern);
        if (match) {
            info.teamMember = match[1].replace('@', '');
            break;
        }
    }
    
    // Extract progress
    const progressMatch = content.match(/(\d+)%\s+complete/i);
    if (progressMatch) {
        info.progress = { completion: parseInt(progressMatch[1]) };
    }
    
    // Extract status
    if (/\b(?:completed|done|finished)\b/i.test(content)) {
        info.status = 'completed';
    } else if (/\b(?:working on|in progress)\b/i.test(content)) {
        info.status = 'in-progress';
    } else if (/\b(?:blocked|waiting)\b/i.test(content)) {
        info.status = 'blocked';
    } else if (/\b(?:review|testing)\b/i.test(content)) {
        info.status = 'reviewing';
    }
    
    // Extract repository
    const repoMatch = content.match(/github\.com\/([a-zA-Z0-9_/-]+)/i);
    if (repoMatch) {
        info.repository = repoMatch[1];
    }
    
    // Extract branch
    const branchMatch = content.match(/branch:\s*([a-zA-Z0-9_/-]+)/i);
    if (branchMatch) {
        info.branch = branchMatch[1];
    }
    
    // Extract domain
    if (/\b(?:frontend|ui|ux)\b/i.test(content)) {
        info.domain = 'frontend';
    } else if (/\b(?:backend|api|server)\b/i.test(content)) {
        info.domain = 'backend';
    } else if (/\b(?:devops|deployment|staging|production)\b/i.test(content)) {
        info.domain = 'devops';
    } else if (/\b(?:qa|testing|review)\b/i.test(content)) {
        info.domain = 'quality-assurance';
    }
    
    return info;
}

// Run the demonstration
demonstrateWorkspaceMemory().catch(console.error);