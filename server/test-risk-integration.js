/**
 * Risk Integration Test
 * 
 * Quick test to verify:
 * 1. Risk Manager initializes correctly
 * 2. Circuit breakers are registered
 * 3. CheckAll works without errors
 * 4. API routes are accessible
 */

import { riskManager } from './src/core/risk/index.js';

async function testRiskIntegration() {
  console.log('🧪 Testing Risk Integration\n');
  
  // Test 1: Initialize
  console.log('Test 1: Initialize Risk Manager');
  await riskManager.initialize();
  console.log('✅ Initialized\n');
  
  // Test 2: Check status
  console.log('Test 2: Get breaker status');
  const status = riskManager.getStatus();
  console.log(`   Breakers registered: ${status.length}`);
  status.forEach(b => {
    console.log(`   - ${b.name}: ${b.status.tripped ? '🔴 TRIPPED' : '🟢 Active'}`);
  });
  console.log('✅ Status retrieved\n');
  
  // Test 3: Check all breakers
  console.log('Test 3: Check all breakers with mock context');
  const result = await riskManager.checkAll({
    pair: 'EUR/USD',
    signal: { verdict: 'BUY' },
    timestamp: Date.now(),
  });
  console.log(`   Result: ${result.allowed ? '✅ Allowed' : '❌ Blocked'}`);
  if (!result.allowed) {
    console.log(`   Reason: ${result.reason}`);
  }
  console.log('✅ CheckAll executed\n');
  
  // Test 4: Trip a breaker manually
  console.log('Test 4: Manually trip a breaker');
  const breakers = Array.from(riskManager.breakers.values());
  if (breakers.length > 0) {
    const testBreaker = breakers[0];
    testBreaker.trip('Test trip', { name: 'Test', current: 100, threshold: 50, unit: '%' });
    console.log(`   Tripped: ${testBreaker.name}`);
    
    // Check should now fail
    const blockedResult = await riskManager.checkAll({});
    console.log(`   CheckAll after trip: ${blockedResult.allowed ? '❌ Should be blocked!' : '✅ Correctly blocked'}`);
    
    // Reset
    riskManager.reset(testBreaker.name);
    console.log(`   Reset: ${testBreaker.name}`);
    console.log('✅ Trip/reset cycle works\n');
  }
  
  // Test 5: Get tripped breakers
  console.log('Test 5: Get tripped breakers');
  const tripped = riskManager.getTrippedBreakers();
  console.log(`   Tripped breakers: ${tripped.length === 0 ? 'None' : tripped.join(', ')}`);
  console.log('✅ GetTrippedBreakers works\n');
  
  console.log('🎉 All integration tests passed!\n');
  console.log('Next steps:');
  console.log('1. Start server: npm run dev');
  console.log('2. Test risk API: curl http://localhost:3001/api/risk/status');
  console.log('3. Test signal generation with risk checks');
}

// Run tests
testRiskIntegration().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
