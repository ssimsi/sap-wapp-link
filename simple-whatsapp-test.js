import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class SimpleWhatsAppTest {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  async start() {
    console.log('🚀 Simple WhatsApp Test Script');
    console.log('==============================');
    console.log('📱 Target number: +5491166161221');
    console.log('==============================\n');

    try {
      await this.initializeClient();
      await this.waitForReady();
      await this.sendTestMessage();
      
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  async initializeClient() {
    console.log('🔧 Initializing WhatsApp client...\n');

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'simple-test-client',
        dataPath: './.wwebjs_auth_test/'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 60000
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2409.2.html',
      }
    });

    // Event handlers
    this.client.on('qr', (qr) => {
      console.log('📱 WhatsApp Web QR Code:');
      console.log('👆 Scan this QR code with your WhatsApp mobile app\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Waiting for QR code scan...\n');
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp authentication successful!');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      throw new Error('Authentication failed');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready!');
      console.log(`📱 Connected as: ${this.client?.info?.pushname || 'Unknown'}`);
      this.isReady = true;
    });

    this.client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp disconnected:', reason);
      this.isReady = false;
    });

    console.log('⏰ Starting WhatsApp initialization...');
    await this.client.initialize();
  }

  async waitForReady(timeout = 120000) {
    console.log('⏳ Waiting for WhatsApp to be ready...');
    
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve();
        return;
      }

      const startTime = Date.now();
      
      const checkReady = () => {
        const elapsed = Date.now() - startTime;
        
        if (this.isReady) {
          console.log(`✅ WhatsApp ready after ${elapsed/1000} seconds`);
          resolve();
        } else if (elapsed >= timeout) {
          reject(new Error(`Timeout waiting for WhatsApp ready (${timeout/1000}s)`));
        } else {
          setTimeout(checkReady, 1000);
        }
      };

      checkReady();
    });
  }

  async sendTestMessage() {
    console.log('\n📤 Sending test message...');
    
    const testPhone = '+5491166161221';
    const formattedNumber = '5491166161221'; // Remove + and format
    const chatId = `${formattedNumber}@c.us`;
    
    const message = [
      '🧪 *PRUEBA DE WHATSAPP*',
      '',
      `📅 Fecha: ${new Date().toLocaleString('es-AR')}`,
      '🔧 Script: simple-whatsapp-test.js',
      '',
      'Este es un mensaje de prueba para verificar',
      'que WhatsApp Web funciona correctamente.',
      '',
      '✅ Si recibes este mensaje, el sistema funciona!'
    ].join('\n');

    try {
      // Check client state
      const state = await this.client.getState();
      console.log(`📱 Client state: ${state}`);
      
      if (state !== 'CONNECTED') {
        throw new Error(`Client state is ${state}, not CONNECTED`);
      }

      // Try to get chat info (this is where issues often occur)
      console.log(`🔍 Validating chat: ${chatId}`);
      
      try {
        const chat = await this.client.getChatById(chatId);
        console.log('✅ Chat validation successful');
      } catch (chatError) {
        console.log(`⚠️ Chat validation failed: ${chatError.message}`);
        
        // Try to get contact instead
        try {
          const contact = await this.client.getContactById(chatId);
          console.log(`📞 Contact found: ${contact ? contact.name || contact.pushname || 'Unnamed' : 'Not found'}`);
        } catch (contactError) {
          console.log(`❌ Contact validation also failed: ${contactError.message}`);
          throw new Error(`Cannot access chat or contact: ${contactError.message}`);
        }
      }

      // Send the message
      console.log('📤 Sending message...');
      const result = await this.client.sendMessage(chatId, message);
      
      console.log('✅ Message sent successfully!');
      console.log(`📋 Message ID: ${result.id._serialized}`);
      
    } catch (error) {
      console.error('❌ Failed to send message:', error.message);
      throw error;
    }
  }

  async cleanup() {
    if (this.client) {
      try {
        await this.client.destroy();
        console.log('🧹 Client cleaned up');
      } catch (error) {
        console.log('⚠️ Cleanup error:', error.message);
      }
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping test...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Stopping test...');
  process.exit(0);
});

// Start the test
const test = new SimpleWhatsAppTest();
test.start().catch(console.error);