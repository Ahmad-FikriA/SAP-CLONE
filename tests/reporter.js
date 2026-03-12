'use strict';

/**
 * Test Summary Reporter
 * Shows comprehensive test results
 */

class TestReporter {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      modules: {},
      startTime: Date.now(),
    };
  }

  onTestResult(test, testResult, aggregatedResult) {
    const moduleName = testResult.testFilePath.split('/').pop().replace('.test.js', '');
    
    this.results.modules[moduleName] = {
      total: testResult.numTotalTests,
      passed: testResult.numPassingTests,
      failed: testResult.numFailingTests,
      skipped: testResult.numPendingTests,
      duration: testResult.perfStats.runtime,
    };

    this.results.total += testResult.numTotalTests;
    this.results.passed += testResult.numPassingTests;
    this.results.failed += testResult.numFailingTests;
    this.results.skipped += testResult.numPendingTests;
  }

  onRunComplete(contexts, results) {
    const duration = ((Date.now() - this.results.startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('                    📊 API TEST SUMMARY');
    console.log('='.repeat(70));
    
    // Module results
    console.log('\n📁 Module Results:');
    console.log('-'.repeat(70));
    Object.entries(this.results.modules).forEach(([module, stats]) => {
      const status = stats.failed > 0 ? '❌' : stats.skipped > 0 ? '⚠️' : '✅';
      const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(
        `${status} ${module.padEnd(20)} | ` +
        `Tests: ${stats.total.toString().padStart(3)} | ` +
        `Passed: ${stats.passed.toString().padStart(3)} | ` +
        `Failed: ${stats.failed.toString().padStart(3)} | ` +
        `Rate: ${passRate}%`
      );
    });
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📈 Overall Summary:');
    console.log('-'.repeat(70));
    console.log(`   Total Tests:     ${this.results.total}`);
    console.log(`   ✅ Passed:       ${this.results.passed}`);
    console.log(`   ❌ Failed:       ${this.results.failed}`);
    console.log(`   ⚠️  Skipped:      ${this.results.skipped}`);
    console.log(`   ⏱️  Duration:     ${duration}s`);
    
    const passRate = this.results.total > 0 
      ? ((this.results.passed / this.results.total) * 100).toFixed(1) 
      : 0;
    
    console.log(`   📊 Pass Rate:     ${passRate}%`);
    console.log('='.repeat(70));
    
    // Final status
    if (this.results.failed === 0) {
      console.log('\n🎉 All tests passed! API is working correctly.\n');
    } else {
      console.log(`\n⚠️  ${this.results.failed} test(s) failed. Please review the errors above.\n`);
    }
  }
}

module.exports = TestReporter;
