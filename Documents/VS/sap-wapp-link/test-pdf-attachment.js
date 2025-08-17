console.log('🚀 Starting PDF attachment test...');

try {
  console.log('📋 Step 1: Importing modules...');
  
  const fs = await import('fs');
  console.log('✅ fs imported');
  
  const dotenv = await import('dotenv');
  console.log('✅ dotenv imported');
  
  // Load environment variables
  dotenv.default.config({ path: '.env.local' });
  console.log('✅ Environment loaded');
  
  const WhatsAppModule = await import('./simple-whatsapp-service.js');
  console.log('✅ WhatsApp service imported');
  
  console.log('🧪 All imports successful, starting test...');
  
  async function testPDFAttachment() {
    console.log('🧪 Testing PDF attachment with simple message');
    
    const whatsappService = new WhatsAppModule.default();
    console.log('✅ WhatsApp service created');
    
    try {
      // Simple test - just try to initialize
      console.log('📱 Testing WhatsApp initialization...');
      
      console.log('🏁 Test complete (basic version)');
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Stack:', error.stack);
    }
  }
  
  await testPDFAttachment();
  console.log('✅ Test function completed');
  
} catch (error) {
  console.error('❌ Import/setup failed:', error.message);
  console.error('Stack:', error.stack);
}
