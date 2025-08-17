import SimpleWhatsAppService from './simple-whatsapp-service.js';
import fs from 'fs';

async function testSeparateMessages() {
  const whatsappService = new SimpleWhatsAppService();
  
  try {
    console.log('🚀 Starting WhatsApp service test for separate messages...');
    
    // Initialize WhatsApp
    await whatsappService.initialize();
    
    // Test message
    const testMessage = `🧪 TEST: Separate Message + PDF
    
📋 Testing separate message sending approach
⏰ Time: ${new Date().toLocaleString()}
🔗 This should arrive as a text message followed by a PDF attachment`;

    // Find a PDF file to test with
    const pdfFiles = fs.readdirSync('downloaded-pdfs').filter(f => f.endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      console.log('❌ No PDF files found in downloaded-pdfs directory');
      return;
    }
    
    const testPdfPath = `downloaded-pdfs/${pdfFiles[0]}`;
    console.log(`📄 Using test PDF: ${testPdfPath}`);
    
    // Send to test number (replace with your test number)
    const testPhoneNumber = '+5491165748855'; // Replace with your test number
    
    await whatsappService.sendMessage(testPhoneNumber, testMessage, testPdfPath);
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await whatsappService.stop();
  }
}

// Run the test
testSeparateMessages();
