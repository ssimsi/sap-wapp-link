import HybridInvoiceService from './hybrid-invoice-service.js';
import EmailReporter from './email-reporter.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testHybridService() {
  console.log('🧪 Testing Hybrid Invoice Service (SAP + Email + WhatsApp)');
  console.log('===========================================================\n');

  // Test email reporter setup
  console.log('1. 📧 Testing email reporter configuration...');
  const emailReporter = new EmailReporter();
  const emailOk = await emailReporter.testEmailSetup();
  
  if (!emailOk) {
    console.log('❌ Email configuration issue. Check EMAIL_USERNAME and EMAIL_PASSWORD in .env.local');
    return;
  }
  console.log('✅ Email reporter configuration OK\n');

  // Test hybrid service initialization
  console.log('2. 🔧 Testing hybrid service initialization...');
  const hybridService = new HybridInvoiceService();
  
  try {
    // Test individual components without starting the full service
    console.log('\n   📱 Testing WhatsApp initialization...');
    await hybridService.whatsappService.initialize();
    console.log('   ✅ WhatsApp service initialized');
    
    console.log('\n   📧 Testing email connection...');
    await hybridService.emailMonitor.connect();
    await hybridService.emailMonitor.openInbox();
    console.log('   ✅ Email connection successful');
    
    console.log('\n   🔗 Testing SAP connection...');
    const sapConnected = await hybridService.sapConnection.login();
    if (sapConnected) {
      console.log('   ✅ SAP connection successful');
    } else {
      console.log('   ❌ SAP connection failed');
      return;
    }
    
    console.log('\n3. 🔍 Testing invoice retrieval from SAP...');
    const newInvoices = await hybridService.getNewInvoicesFromSAP();
    console.log(`   📋 Found ${newInvoices.length} unprocessed invoices in SAP`);
    
    if (newInvoices.length > 0) {
      const testInvoice = newInvoices[0];
      console.log(`\n   📄 Test invoice: ${testInvoice.DocNum}`);
      console.log(`      Customer: ${testInvoice.CardName}`);
      console.log(`      Total: $${testInvoice.DocTotal}`);
      console.log(`      Date: ${testInvoice.DocDate}`);
      
      // Test message generation
      const whatsappMessage = hybridService.generateWhatsAppMessage(testInvoice);
      console.log('\n   📱 Generated WhatsApp message:');
      console.log('   ================================');
      console.log(whatsappMessage);
      console.log('   ================================');
      
      // Test PDF search (without actually sending)
      console.log(`\n   🔍 Testing PDF search for invoice ${testInvoice.DocNum}...`);
      const pdfPath = await hybridService.findInvoicePDF(testInvoice.DocNum);
      
      if (pdfPath) {
        console.log(`   ✅ Found PDF: ${pdfPath}`);
        console.log('   📤 Ready to send via WhatsApp!');
        
        // Clean up test PDF
        const fs = await import('fs');
        if (fs.default.existsSync(pdfPath)) {
          fs.default.unlinkSync(pdfPath);
          console.log('   🗑️ Cleaned up test PDF');
        }
      } else {
        console.log(`   ⚠️ No PDF found for invoice ${testInvoice.DocNum}`);
        console.log('   💡 Make sure emails with PDFs contain the DocNum in the subject');
      }
    }
    
    console.log('\n4. 📊 Testing email reporting...');
    
    // Create a test missed invoice for reporting
    const testMissedInvoice = {
      invoice: {
        DocNum: 'TEST-001',
        CardName: 'Cliente de Prueba',
        DocTotal: 1500.00
      },
      error: 'PDF not found in email',
      timestamp: new Date()
    };
    
    console.log('   📧 Sending test report email...');
    const reportSent = await emailReporter.sendDailyReport([testMissedInvoice]);
    
    if (reportSent) {
      console.log('   ✅ Test report sent to ssimsi@gmail.com');
    } else {
      console.log('   ❌ Failed to send test report');
    }
    
    // Cleanup
    hybridService.emailMonitor.disconnect();
    await hybridService.whatsappService.stop();
    
    console.log('\n✅ Hybrid service test completed successfully!');
    console.log('\n🚀 Ready to start the full service with:');
    console.log('   npm run start-hybrid');
    console.log('\n📋 The service will:');
    console.log('   ✅ Monitor SAP for new invoices every 5 minutes');
    console.log('   ✅ Search email for corresponding PDFs using DocNum');
    console.log('   ✅ Send WhatsApp messages with SAP data + Email PDFs');
    console.log('   ✅ Send daily reports at 6 PM for any missed invoices');
    console.log('   ✅ Mark invoices as sent in SAP to avoid duplicates');
    
  } catch (error) {
    console.error('\n❌ Hybrid service test failed:', error.message);
    
    // Cleanup on error
    try {
      hybridService.emailMonitor?.disconnect();
      await hybridService.whatsappService?.stop();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

testHybridService().catch(console.error);
