#!/usr/bin/env node

import { EmailService } from './email-service.js';

async function quickTest() {
  console.log('🧪 Quick test of complete email service...\n');
  
  try {
    const emailService = new EmailService();
    
    // Test just the summary report functionality
    console.log('📊 Testing summary report...');
    
    // Mock some stats
    const mockInvoiceStats = {
      processed: 5,
      emailsSent: 3,
      errors: 1,
      duration: 12.5
    };
    
    const mockEntregaStats = {
      processed: 8,
      sent: 2,
      skipped: 6,
      errors: 0,
      duration: 8.3,
      emailsSent: 2
    };
    
    const result = await emailService.sendProcessingSummary(mockInvoiceStats, mockEntregaStats);
    
    if (result.success) {
      console.log('✅ Summary report sent successfully to ssimsi@gmail.com');
    } else {
      console.error('❌ Failed to send summary report:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
quickTest().then(() => {
  console.log('\n🏁 Quick test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});