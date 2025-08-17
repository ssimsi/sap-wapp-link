import SimpleWhatsAppService from './simple-whatsapp-service.js';
import fs from 'fs';

console.log('🧪 Testing PDF with Caption using Non-Headless Browser');

async function testPDFCaption() {
    const whatsapp = new SimpleWhatsAppService();
    
    try {
        console.log('📱 Initializing WhatsApp service (browser window should open)...');
        await whatsapp.initialize();
        
        console.log('✅ WhatsApp initialized successfully!');
        
        // Test message
        const testMessage = `🧾 *TEST MESSAGE - PDF WITH CAPTION*

This is a test to verify that PDFs are sent WITH captions when using non-headless browser mode.

If you receive this message WITH the PDF attached, then the caption functionality is working! 🎉`;

        // Check if we have the PDF from previous tests
        const pdfPath = './temp-pdfs/Factura de deudores - 15571.pdf';
        
        if (fs.existsSync(pdfPath)) {
            console.log(`📎 Found test PDF: ${pdfPath}`);
            console.log('📱 Sending test message with PDF and caption...');
            
            // Send to admin phone for testing
            await whatsapp.sendMessage('5491165748855', testMessage, pdfPath);
            
            console.log('✅ Test message sent! Check your WhatsApp to verify if the caption appears with the PDF.');
        } else {
            console.log('❌ Test PDF not found. Sending text-only message...');
            await whatsapp.sendMessage('5491165748855', testMessage + '\n\n(PDF not available for test)');
        }
        
        console.log('🛑 Stopping WhatsApp service...');
        await whatsapp.stop();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        await whatsapp.stop();
    }
}

testPDFCaption();
