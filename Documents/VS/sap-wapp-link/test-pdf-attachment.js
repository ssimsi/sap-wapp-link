import HybridInvoiceService from './hybrid-invoice-service.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testPDFAttachment() {
  console.log('🧪 Testing PDF Attachment Search');
  console.log('================================\n');

  const hybridService = new HybridInvoiceService();
  
  try {
    // Initialize email connection
    console.log('📧 Connecting to email...');
    await hybridService.emailMonitor.connect();
    await hybridService.emailMonitor.openInbox();
    console.log('✅ Email connection successful\n');

    // Test with known DocNums from the debug output
    const testDocNums = ['9000016', '9000015', '9000014', '9000013'];
    
    for (const docNum of testDocNums) {
      console.log(`🔍 Testing PDF search for DocNum: ${docNum}`);
      console.log('----------------------------------------');
      
      const pdfPath = await hybridService.findInvoicePDF(docNum);
      
      if (pdfPath) {
        console.log(`✅ SUCCESS! Found PDF: ${pdfPath}`);
        
        // Check file size
        const fs = await import('fs');
        const stats = fs.default.statSync(pdfPath);
        console.log(`📊 PDF size: ${(stats.size / 1024).toFixed(1)} KB`);
        
        // Clean up test file
        fs.default.unlinkSync(pdfPath);
        console.log('🗑️ Cleaned up test file');
      } else {
        console.log(`❌ No PDF found for DocNum ${docNum}`);
      }
      
      console.log('');
    }

    // Disconnect
    hybridService.emailMonitor.disconnect();
    
    console.log('✅ PDF attachment test completed!');
    console.log('\n💡 If PDFs were found, the hybrid service should now work with attachments.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    hybridService.emailMonitor?.disconnect();
  }
}

testPDFAttachment().catch(console.error);
