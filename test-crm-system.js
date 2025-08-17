#!/usr/bin/env node

/**
 * Automated CRM System Test Suite
 * Tests all current system capabilities systematically
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  baseUrl: 'https://app.shabe.ai',
  endpoint: '/api/chat',
  testDelay: 2000, // 2 seconds between tests to avoid rate limiting
  maxRetries: 3,
  timeout: 10000
};

// Test Results Storage
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  partial: 0,
  details: []
};

// Test Categories
const TEST_CATEGORIES = {
  CONTACT_CRUD: 'Contact CRUD Operations',
  DATA_QUERIES: 'Data Queries (Database Expert)',
  INTENT_CLASSIFICATION: 'Intent Classification',
  ENTITY_EXTRACTION: 'Entity Extraction',
  CONVERSATION_FLOW: 'Conversation Flow',
  EDGE_CASES: 'Edge Cases'
};

/**
 * Make HTTP request to the chat API
 */
async function makeChatRequest(message, testName) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: message,
      userId: 'test-user'
    });

    const options = {
      hostname: CONFIG.baseUrl.replace('https://', '').replace('http://', ''),
      port: CONFIG.baseUrl.startsWith('https') ? 443 : 80,
      path: CONFIG.endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'CRM-Test-Suite/1.0'
      },
      timeout: CONFIG.timeout
    };

    const req = (CONFIG.baseUrl.startsWith('https') ? https : http).request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            response: response,
            rawData: data
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            response: null,
            rawData: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Analyze response for expected patterns
 */
function analyzeResponse(response, expectedPatterns) {
  const analysis = {
    success: false,
    score: 0,
    issues: [],
    matchedPatterns: []
  };

  if (!response || !response.response) {
    analysis.issues.push('No response received');
    return analysis;
  }

  const content = response.response.message || response.response.content || '';
  const lowerContent = content.toLowerCase();

  // Check for expected patterns
  for (const pattern of expectedPatterns) {
    if (lowerContent.includes(pattern.toLowerCase())) {
      analysis.matchedPatterns.push(pattern);
      analysis.score += 1;
    }
  }

  // Check for error indicators
  const errorIndicators = ['error', 'failed', 'could not', 'unable to', 'not found', 'invalid'];
  for (const indicator of errorIndicators) {
    if (lowerContent.includes(indicator)) {
      analysis.issues.push(`Error indicator found: "${indicator}"`);
    }
  }

  // Determine success
  if (analysis.score >= expectedPatterns.length * 0.7) {
    analysis.success = true;
  }

  return analysis;
}

/**
 * Run a single test
 */
async function runTest(testCase, retryCount = 0) {
  const { name, message, category, expectedPatterns, description } = testCase;
  
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`📝 Message: "${message}"`);
  console.log(`📋 Category: ${category}`);
  
  try {
    const result = await makeChatRequest(message, name);
    
    if (result.statusCode !== 200) {
      throw new Error(`HTTP ${result.statusCode}: ${result.rawData}`);
    }

    const analysis = analyzeResponse(result, expectedPatterns);
    
    const testResult = {
      name,
      category,
      message,
      description,
      statusCode: result.statusCode,
      response: result.response,
      analysis,
      timestamp: new Date().toISOString()
    };

    // Determine test outcome
    if (analysis.success && analysis.issues.length === 0) {
      testResult.outcome = 'PASSED';
      testResults.passed++;
      console.log(`✅ PASSED: ${name}`);
    } else if (analysis.score > 0) {
      testResult.outcome = 'PARTIAL';
      testResults.partial++;
      console.log(`⚠️  PARTIAL: ${name} (Score: ${analysis.score}/${expectedPatterns.length})`);
    } else {
      testResult.outcome = 'FAILED';
      testResults.failed++;
      console.log(`❌ FAILED: ${name}`);
    }

    if (analysis.issues.length > 0) {
      console.log(`   Issues: ${analysis.issues.join(', ')}`);
    }

    testResults.total++;
    testResults.details.push(testResult);
    
    return testResult;

  } catch (error) {
    console.log(`❌ ERROR: ${name} - ${error.message}`);
    
    if (retryCount < CONFIG.maxRetries) {
      console.log(`   Retrying... (${retryCount + 1}/${CONFIG.maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.testDelay * 2));
      return runTest(testCase, retryCount + 1);
    }

    const testResult = {
      name,
      category,
      message,
      description,
      error: error.message,
      outcome: 'FAILED',
      timestamp: new Date().toISOString()
    };

    testResults.total++;
    testResults.failed++;
    testResults.details.push(testResult);
    
    return testResult;
  }
}

/**
 * Test Cases Definition
 */
const TEST_CASES = [
  // Contact CRUD Tests
  {
    name: "Contact Creation - Basic Prompt",
    message: "create a new contact",
    category: TEST_CATEGORIES.CONTACT_CRUD,
    description: "Should show data collection prompt",
    expectedPatterns: ["create", "contact", "information", "required", "optional"]
  },
  {
    name: "Contact Creation - With Data",
    message: "create a contact: first name Aisha, last name Khan, email aisha@northshield.io, title Head of IT, company NorthShield",
    category: TEST_CATEGORIES.CONTACT_CRUD,
    description: "Should create contact successfully",
    expectedPatterns: ["created successfully", "contact details", "added to your database"]
  },
  {
    name: "Contact Update - With Data",
    message: "update mocha gobal's title to CEO",
    category: TEST_CATEGORIES.CONTACT_CRUD,
    description: "Should update contact successfully",
    expectedPatterns: ["updated successfully", "contact", "field", "new value"]
  },
  {
    name: "Contact Update - Basic Prompt",
    message: "update a contact",
    category: TEST_CATEGORIES.CONTACT_CRUD,
    description: "Should show update data collection prompt",
    expectedPatterns: ["update", "contact", "provide", "field", "value"]
  },

  // Data Query Tests
  {
    name: "Contact Count Query",
    message: "how many contacts do I have",
    category: TEST_CATEGORIES.DATA_QUERIES,
    description: "Should return contact count",
    expectedPatterns: ["contacts", "have", "count", "number"]
  },
  {
    name: "Contact List Query",
    message: "list all contacts",
    category: TEST_CATEGORIES.DATA_QUERIES,
    description: "Should return list of contacts",
    expectedPatterns: ["contacts", "list", "names", "details"]
  },
  {
    name: "Contact Details Query",
    message: "show me sarah johnson's details",
    category: TEST_CATEGORIES.DATA_QUERIES,
    description: "Should return specific contact details",
    expectedPatterns: ["details", "contact", "email", "phone", "company"]
  },
  {
    name: "Account Count Query",
    message: "how many accounts do I have",
    category: TEST_CATEGORIES.DATA_QUERIES,
    description: "Should return account count",
    expectedPatterns: ["accounts", "have", "count", "number"]
  },
  {
    name: "Deal Count Query",
    message: "how many deals do I have",
    category: TEST_CATEGORIES.DATA_QUERIES,
    description: "Should return deal count",
    expectedPatterns: ["deals", "have", "count", "number"]
  },

  // Intent Classification Tests
  {
    name: "Intent - Create Contact",
    message: "create a new contacts",
    category: TEST_CATEGORIES.INTENT_CLASSIFICATION,
    description: "Should classify as create_contact",
    expectedPatterns: ["create", "contact", "information", "required"]
  },
  {
    name: "Intent - Update Contact",
    message: "update contact details",
    category: TEST_CATEGORIES.INTENT_CLASSIFICATION,
    description: "Should classify as update_contact",
    expectedPatterns: ["update", "contact", "provide", "field"]
  },
  {
    name: "Intent - View Data",
    message: "how many contacts",
    category: TEST_CATEGORIES.INTENT_CLASSIFICATION,
    description: "Should classify as view_data",
    expectedPatterns: ["contacts", "have", "count", "number"]
  },

  // Entity Extraction Tests
  {
    name: "Entity - Contact Name",
    message: "update mocha gobal's title to CEO",
    category: TEST_CATEGORIES.ENTITY_EXTRACTION,
    description: "Should extract contact name and field",
    expectedPatterns: ["mocha gobal", "title", "CEO", "updated"]
  },
  {
    name: "Entity - Email",
    message: "create contact: John Smith, john@example.com",
    category: TEST_CATEGORIES.ENTITY_EXTRACTION,
    description: "Should extract name and email",
    expectedPatterns: ["John Smith", "john@example.com", "created"]
  },

  // Edge Cases
  {
    name: "Edge Case - Invalid Contact",
    message: "update nonexistent contact's email",
    category: TEST_CATEGORIES.EDGE_CASES,
    description: "Should handle missing contact gracefully",
    expectedPatterns: ["could not find", "not found", "available contacts", "check spelling"]
  },
  {
    name: "Edge Case - Partial Data",
    message: "create contact: John Smith",
    category: TEST_CATEGORIES.EDGE_CASES,
    description: "Should ask for missing required information",
    expectedPatterns: ["need more information", "required", "missing", "provide"]
  },
  {
    name: "Edge Case - Empty Query",
    message: "test",
    category: TEST_CATEGORIES.EDGE_CASES,
    description: "Should handle unclear input",
    expectedPatterns: ["not sure", "clarification", "specific", "help"]
  }
];

/**
 * Generate test report
 */
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 CRM SYSTEM TEST REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📈 Overall Results:`);
  console.log(`   Total Tests: ${testResults.total}`);
  console.log(`   ✅ Passed: ${testResults.passed} (${((testResults.passed/testResults.total)*100).toFixed(1)}%)`);
  console.log(`   ⚠️  Partial: ${testResults.partial} (${((testResults.partial/testResults.total)*100).toFixed(1)}%)`);
  console.log(`   ❌ Failed: ${testResults.failed} (${((testResults.failed/testResults.total)*100).toFixed(1)}%)`);
  
  // Category breakdown
  console.log(`\n📋 Results by Category:`);
  const categoryResults = {};
  
  testResults.details.forEach(test => {
    if (!categoryResults[test.category]) {
      categoryResults[test.category] = { total: 0, passed: 0, partial: 0, failed: 0 };
    }
    categoryResults[test.category].total++;
    categoryResults[test.category][test.outcome.toLowerCase()]++;
  });
  
  Object.entries(categoryResults).forEach(([category, results]) => {
    const passRate = ((results.passed / results.total) * 100).toFixed(1);
    console.log(`   ${category}: ${results.passed}/${results.total} passed (${passRate}%)`);
  });
  
  // Failed tests
  const failedTests = testResults.details.filter(t => t.outcome === 'FAILED');
  if (failedTests.length > 0) {
    console.log(`\n❌ Failed Tests:`);
    failedTests.forEach(test => {
      console.log(`   • ${test.name}: ${test.error || 'No response or unexpected response'}`);
    });
  }
  
  // Partial tests
  const partialTests = testResults.details.filter(t => t.outcome === 'PARTIAL');
  if (partialTests.length > 0) {
    console.log(`\n⚠️  Partial Tests:`);
    partialTests.forEach(test => {
      console.log(`   • ${test.name}: Score ${test.analysis.score}/${test.analysis.matchedPatterns.length}`);
      if (test.analysis.issues.length > 0) {
        console.log(`   Issues: ${test.analysis.issues.join(', ')}`);
      }
    });
  }
  
  console.log(`\n🎯 Recommendations:`);
  if (testResults.failed > testResults.total * 0.3) {
    console.log(`   • High failure rate detected. Review API connectivity and system status.`);
  }
  if (testResults.partial > testResults.total * 0.2) {
    console.log(`   • Many partial successes. Consider improving response patterns.`);
  }
  if (testResults.passed > testResults.total * 0.8) {
    console.log(`   • Excellent success rate! System is working well.`);
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Main test runner
 */
async function runTestSuite() {
  console.log('🚀 Starting CRM System Test Suite');
  console.log(`📍 Testing: ${CONFIG.baseUrl}${CONFIG.endpoint}`);
  console.log(`⏱️  Test delay: ${CONFIG.testDelay}ms between tests`);
  console.log(`🔄 Max retries: ${CONFIG.maxRetries}`);
  
  const startTime = Date.now();
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    await runTest(testCase);
    
    // Add delay between tests (except for the last one)
    if (i < TEST_CASES.length - 1) {
      console.log(`   ⏳ Waiting ${CONFIG.testDelay}ms before next test...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.testDelay));
    }
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  console.log(`\n⏱️  Test suite completed in ${duration.toFixed(1)} seconds`);
  
  generateReport();
  
  // Save detailed results to file
  const fs = require('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      partial: testResults.partial,
      failed: testResults.failed
    },
    details: testResults.details
  };
  
  fs.writeFileSync('test-results.json', JSON.stringify(reportData, null, 2));
  console.log(`📄 Detailed results saved to: test-results.json`);
}

// Run the test suite
if (require.main === module) {
  runTestSuite().catch(console.error);
}

module.exports = { runTestSuite, TEST_CASES, CONFIG };
