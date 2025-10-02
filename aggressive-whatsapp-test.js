import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class AggressiveWhatsAppTest {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.authSuccess = false;
  }

  async start() {
    console.log('🚀 Aggressive WhatsApp Test Script');
    console.log('==================================');
    console.log('📱 Target number: +5491166161221');
    console.log('🔧 Using aggressive ready detection');
    console.log('==================================\n');

    try {
      await this.initializeClient();
      await this.waitForReadyAggressive();
      await this.sendTestMessage();
      
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    }
  }

  async initializeClient() {
    console.log('🔧 Initializing WhatsApp client with minimal config...\n');

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'aggressive-test-client',
        dataPath: './.wwebjs_auth_aggressive/'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--single-process',
          '--disable-gpu'
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
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Waiting for QR code scan...\n');
    });

    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp authentication successful!');
      this.authSuccess = true;
      
      // Start aggressive ready detection immediately after auth
      setTimeout(() => {
        this.forceReadyCheck();
      }, 2000);
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      throw new Error('Authentication failed');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready! (Ready event fired)');
      console.log(`📱 Connected as: ${this.client?.info?.pushname || 'Unknown'}`);
      this.isReady = true;
    });

    this.client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp disconnected:', reason);
      this.isReady = false;
    });

    // Loading screen monitoring
    this.client.on('loading_screen', (percent, message) => {
      console.log(`⚡ Loading: ${percent}% - ${message}`);
      
      // If we hit 100% loading, force ready check
      if (percent === 100) {
        console.log('🎯 Loading reached 100% - starting aggressive ready check in 3 seconds...');
        setTimeout(() => {
          this.forceReadyCheck();
        }, 3000);
      }
    });

    console.log('⏰ Starting WhatsApp initialization...');
    await this.client.initialize();
  }

  async forceReadyCheck() {
    if (this.isReady) {
      console.log('✅ Ready event already fired - no need to force');
      return;
    }

    console.log('🔧 Forcing ready check - attempting to verify client state...');
    
    try {
      // Try to get client state
      const state = await this.client.getState();
      console.log(`📱 Client state: ${state}`);
      
      if (state === 'CONNECTED') {
        console.log('🎯 Client is CONNECTED but ready event never fired - forcing ready!');
        this.isReady = true;
        return;
      }
      
      // Try to get client info
      const info = await this.client.info;
      if (info && info.wid) {
        console.log(`📱 Client info available: ${info.pushname || 'No name'}`);
        console.log('🎯 Client has info but ready event never fired - forcing ready!');
        this.isReady = true;
        return;
      }
      
    } catch (error) {
      console.log(`⚠️ State check failed: ${error.message}`);
    }
    
    // If authenticated but not ready, try alternative methods
    if (this.authSuccess && !this.isReady) {
      console.log('🔧 Authentication success but no ready - trying alternative ready detection...');
      
      // Wait a bit more and try again
      setTimeout(() => {
        this.alternativeReadyCheck();
      }, 5000);
    }
  }

  async alternativeReadyCheck() {
    if (this.isReady) return;
    
    console.log('🔧 Alternative ready check - testing basic functionality...');
    
    try {
      // Try to access client properties that would be available when ready
      const clientId = this.client.info?.wid?._serialized;
      if (clientId) {
        console.log('🎯 Client ID available - assuming ready!');
        this.isReady = true;
        return;
      }
      
      // Try to get contacts (this would fail if not ready)
      const contacts = await this.client.getContacts();
      if (contacts && contacts.length > 0) {
        console.log('🎯 Contacts available - client is ready!');
        this.isReady = true;
        return;
      }
      
    } catch (error) {
      console.log(`⚠️ Alternative check failed: ${error.message}`);
    }
    
    // Last resort - if we've been authenticated for more than 30 seconds, assume ready
    if (this.authSuccess) {
      console.log('🎯 Authentication was successful 30+ seconds ago - forcing ready as last resort!');
      this.isReady = true;
    }
  }

  async waitForReadyAggressive(timeout = 60000) {
    console.log('⏳ Waiting for WhatsApp to be ready (with aggressive detection)...');
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkReady = () => {
        const elapsed = Date.now() - startTime;
        
        if (this.isReady) {
          console.log(`✅ WhatsApp ready after ${elapsed/1000} seconds`);
          resolve();
        } else if (elapsed >= timeout) {
          reject(new Error(`Timeout waiting for WhatsApp ready (${timeout/1000}s)`));
        } else {
          // Log progress every 5 seconds
          if (elapsed % 5000 < 1000) {
            console.log(`⏳ Still waiting... (${Math.floor(elapsed/1000)}s/${Math.floor(timeout/1000)}s) Auth: ${this.authSuccess}`);
            
            // Try force check every 10 seconds after authentication
            if (this.authSuccess && elapsed % 10000 < 1000) {
              this.forceReadyCheck();
            }
          }
          
          setTimeout(checkReady, 1000);
        }
      };

      checkReady();
    });
  }

  async sendTestMessage() {
    console.log('\n📤 Sending test message...');
    
    const testPhone = '+5491166161221';
    const formattedNumber = '5491166161221'; 
    const chatId = `${formattedNumber}@c.us`;
    
    const message = [
      '🧪 *PRUEBA WHATSAPP AGRESIVA*',
      '',
      `📅 ${new Date().toLocaleString('es-AR')}`,
      '🔧 Script: aggressive-whatsapp-test.js',
      '⚡ Ready detection: AGGRESSIVE MODE',
      '',
      'Si recibes este mensaje, el método',
      'agresivo de detección funcionó!',
      '',
      '✅ Sistema operativo!'
    ].join('\n');

    try {
      const state = await this.client.getState();
      console.log(`📱 Final client state: ${state}`);
      
      console.log('📤 Sending message...');
      const result = await this.client.sendMessage(chatId, message);
      
      console.log('✅ Message sent successfully!');
      console.log(`📋 Message ID: ${result.id._serialized}`);
      
    } catch (error) {
      console.error('❌ Failed to send message:', error.message);
      throw error;
    }
  }
}

// Start the aggressive test
const test = new AggressiveWhatsAppTest();
test.start().catch(console.error);