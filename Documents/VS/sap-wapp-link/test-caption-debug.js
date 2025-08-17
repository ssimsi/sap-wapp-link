import SimpleWhatsAppService from './simple-whatsapp-service.js';
import path from 'path';
import fs from 'fs';

const testCaptionApproach = async () => {
  console.log('🧪 Testing Caption Approach with Debug Info');
  
  const whatsapp = new SimpleWhatsAppService();
  
  try {
    await whatsapp.initialize();
    
    // Test with a PDF that we know exists
    const testMessage = "🧾 TEST CAPTION: This is a test message with PDF attachment.\n\n📄 File: test-invoice.pdf\n💰 Total: $123.45";
    const pdfPath = path.join(process.cwd(), 'downloaded-pdfs', '2025-08-16T00-09-10-820Z_Factura de deudores - 15544.pdf');
    
    console.log('\n📋 Test Details:');
    console.log(`📱 Phone: 5491165748855 (Alvaro - test number)`);
    console.log(`📝 Message: ${testMessage}`);
    console.log(`📄 PDF: ${pdfPath}`);
    console.log(`📁 PDF exists: ${fs.existsSync(pdfPath)}`);
    
    console.log('\n🚀 Sending test message with caption...');
    await whatsapp.sendMessage('5491165748855', testMessage, pdfPath);
    
    console.log('\n✅ Test completed successfully!');
    console.log('📱 Check WhatsApp to see if the PDF has the caption text');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await whatsapp.stop();
  }
};

testCaptionApproach();
