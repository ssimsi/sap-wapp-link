#!/usr/bin/env node

console.log('🧪 SAFE TEST - SALESPERSON MESSAGE GENERATION');
console.log('============================================================');
console.log('🔍 Testing with invoice:', process.argv[2] || 'NO INVOICE PROVIDED');
console.log('📋 This script ONLY generates messages, does NOT send anything');
console.log('');

if (process.argv.length < 3) {
  console.log('Usage: node safe-salesperson-test.js <DocNum>');
  console.log('Example: node safe-salesperson-test.js 9008535');
  process.exit(1);
}

console.log('✅ Script is working - this is just a basic test');
console.log('Next step: Add SAP connection logic');
