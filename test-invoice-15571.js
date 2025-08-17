import HybridInvoiceService from './hybrid-invoice-service.js';

async function testInvoice15571() {
  const service = new HybridInvoiceService();
  
  try {
    console.log('🚀 Testing invoice 15571 with separate messages approach...');
    
    // Process the specific invoice
    await service.processInvoiceWithEmail(15571);
    
    console.log('✅ Invoice 15571 processing completed!');
    
  } catch (error) {
    console.error('❌ Invoice processing failed:', error);
  }
}

// Run the test
testInvoice15571();
