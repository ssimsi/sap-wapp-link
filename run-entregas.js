#!/usr/bin/env node

import { EmailService } from './email-service.js';

async function runEntregasProcessing() {
  console.log('🚚 Starting Entregas Processing Service...\n');
  
  try {
    const emailService = new EmailService();
    
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Process all unsent entregas
    const result = await emailService.processUnsentEntregas();
    
    if (result.success) {
      console.log(`\n🎉 Entregas processing completed successfully!`);
      console.log(`📊 Final Results:`);
      console.log(`   • ${result.processed} entregas processed`);
      console.log(`   • ${result.sent} emails sent to warehouse`);
      console.log(`   • ${result.skipped} marked only (no warehouse 07)`);
      if (result.errors > 0) {
        console.log(`   • ${result.errors} errors encountered`);
      }
      console.log(`   • Completed in ${result.duration.toFixed(2)}s`);
    } else {
      console.error(`❌ Entregas processing failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Fatal error in entregas processing:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the entregas processing
runEntregasProcessing().then(() => {
  console.log('\n🏁 Entregas service finished');
  process.exit(0);
}).catch(error => {
  console.error('💥 Service crashed:', error);
  process.exit(1);
});