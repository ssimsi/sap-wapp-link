import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

function checkTestModeConfiguration() {
  console.log('🧪 Test Mode Configuration Check');
  console.log('================================\n');

  // Check test mode setting
  const testMode = process.env.TEST_MODE;
  const testPhone = process.env.TEST_PHONE;
  const adminPhone = process.env.ADMIN_PHONE;

  console.log(`TEST_MODE: ${testMode}`);
  console.log(`TEST_PHONE: ${testPhone}`);
  console.log(`ADMIN_PHONE: ${adminPhone}`);

  console.log('\n📊 Status:');
  
  if (testMode === 'true') {
    console.log('✅ TEST MODE is ACTIVE');
    console.log('🔒 All WhatsApp messages will be sent to the test phone');
    
    if (testPhone && testPhone.length >= 10) {
      console.log(`📱 Test phone number: ${testPhone}`);
    } else {
      console.log('⚠️ TEST_PHONE is not properly configured');
    }
    
    console.log('\n🧪 Safety Features Active:');
    console.log('   ✅ Messages redirected to test phone');
    console.log('   ✅ Test mode headers added to messages');
    console.log('   ✅ No real customers will receive messages');
    
  } else {
    console.log('🚨 PRODUCTION MODE is ACTIVE');
    console.log('⚠️ Messages will be sent to real customers!');
    console.log('\n💡 To enable test mode, set in .env.local:');
    console.log('   TEST_MODE=true');
    console.log('   TEST_PHONE=5491166161221');
  }

  console.log('\n🔧 To change test mode:');
  console.log('1. Edit .env.local file');
  console.log('2. Set TEST_MODE=true (for testing) or TEST_MODE=false (for production)');
  console.log('3. Set TEST_PHONE to your admin phone number');
  console.log('4. Restart the service');

  console.log('\n📱 Example WhatsApp message preview:');
  console.log('=====================================');
  
  const sampleMessage = generateSampleMessage(testMode === 'true');
  console.log(sampleMessage);
  console.log('=====================================');
}

function generateSampleMessage(isTestMode) {
  const lines = [];
  
  if (isTestMode) {
    lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
    lines.push('');
  }
  
  lines.push('🧾 *NUEVA FACTURA ELECTRÓNICA*');
  lines.push('📋 Factura: *9000123*');
  lines.push('👤 Cliente: Cliente Ejemplo S.A.');
  lines.push('💰 Total: $15,750.00');
  lines.push('📅 Fecha: 2025-08-10');
  lines.push('');
  lines.push('📎 Adjunto encontrarás tu factura en PDF.');
  lines.push('');
  
  if (isTestMode) {
    lines.push('🧪 *Este es un mensaje de prueba*');
    lines.push('En producción iría al cliente real');
    lines.push('');
  }
  
  lines.push('Gracias por tu compra! 🙏');
  
  return lines.join('\n');
}

checkTestModeConfiguration();
