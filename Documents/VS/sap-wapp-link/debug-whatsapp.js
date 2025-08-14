import WhatsAppService from './whatsapp-service.js';

async function debugWhatsApp() {
  console.log('🧪 DEBUG: Testing WhatsApp connection');
  
  try {
    const whatsapp = new WhatsAppService();
    console.log('📱 Initializing WhatsApp...');
    
    await whatsapp.initialize();
    console.log('✅ WhatsApp initialized');
    
    // Test a simple message
    const testPhone = '5491166161221';
    const testMessage = 'Test message from debug script';
    
    console.log(`📱 Sending test message to ${testPhone}...`);
    const result = await whatsapp.sendMessage(testPhone, testMessage);
    
    console.log('✅ Message sent result:', result);
    
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    console.error('❌ Full error:', error);
  }
}

debugWhatsApp();
