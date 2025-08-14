import axios from 'axios';
import https from 'https';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log('🧪 SAFE TEST - INVOICE 9008425');
console.log('=' .repeat(60));
console.log('📋 This will send to TEST PHONE ONLY');
console.log('');

// Simple test - just connect to WhatsApp and send a basic message
const whatsapp = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp-session' }),
  puppeteer: { headless: true }
});

whatsapp.on('ready', async () => {
  console.log('✅ WhatsApp ready');
  
  try {
    // Basic test message for invoice 9008425
    const testMessage = `🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*

📄 *NUEVO DOCUMENTO EMITIDO*

📋 Comprobante: *9008425*
👤 Cliente: COHEN DANIEL
💰 Total: $114,000.00
📅 Fecha: 2025-08-01

📞 Este documento se envio al mail daniel_cohen@live.com.ar. El cliente no registra numero de celular.

📎 (PDF adjunto se buscaría en el email)

🧪 *Este es un mensaje de prueba*

Gracias por tu compra!`;

    console.log('📱 Sending test message...');
    await whatsapp.sendMessage(process.env.TEST_PHONE, testMessage);
    console.log('✅ Test message sent to:', process.env.TEST_PHONE);
    
    console.log('');
    console.log('📱 SALESPERSON MESSAGE (would be sent to Salon de Ventas):');
    console.log('=' .repeat(60));
    console.log(`📄 *NUEVO DOCUMENTO*

Hola Salon de Ventas,

Se ha emitido el siguiente comprobante de uso interno para el cliente COHEN DANIEL:

📋 **Comprobante Nº:** 9008425
📅 **Fecha:** 2025-08-01
💰 **Total:** $114,000.00

📞 Este documento se envio al mail daniel_cohen@live.com.ar. El cliente no registra numero de celular.

Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Simsiroglu`);
    console.log('=' .repeat(60));
    
    console.log('✅ Test completed successfully');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    process.exit(1);
  }
});

whatsapp.on('qr', (qr) => {
  console.log('📱 QR Code needed - please scan in WhatsApp Web');
});

console.log('📱 Starting WhatsApp...');
whatsapp.initialize();
