import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class WhatsAppConnectionTest {
  constructor() {
    this.whatsappClient = new Client({
      authStrategy: new LocalAuth({
        clientId: 'connection-test',
        dataPath: './whatsapp-session'
      }),
      puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    
    this.whatsappReady = false;
  }

  formatPhoneNumber(phone) {
    console.log(`🔧 Formatting phone number: ${phone}`);
    
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    console.log(`   📱 Cleaned: ${cleaned}`);
    
    // Ensure it starts with country code
    if (cleaned.startsWith('549')) {
      const formatted = `${cleaned}@c.us`;
      console.log(`   ✅ Already has 549 prefix: ${formatted}`);
      return formatted;
    } else if (cleaned.startsWith('11') && cleaned.length === 10) {
      const formatted = `549${cleaned}@c.us`;
      console.log(`   ✅ Added 549 prefix to 11: ${formatted}`);
      return formatted;
    } else {
      const formatted = `549${cleaned}@c.us`;
      console.log(`   ✅ Added 549 prefix: ${formatted}`);
      return formatted;
    }
  }

  async initializeWhatsApp() {
    return new Promise((resolve, reject) => {
      console.log('📱 Testing WhatsApp connection...');
      
      this.whatsappClient.on('qr', (qr) => {
        console.log('📱 QR Code received - should reuse existing session');
      });

      this.whatsappClient.on('authenticated', () => {
        console.log('✅ WhatsApp authenticated successfully');
      });

      this.whatsappClient.on('ready', async () => {
        console.log('✅ WhatsApp client is ready!');
        this.whatsappReady = true;
        
        // Test if we can get our own number
        try {
          const info = this.whatsappClient.info;
          console.log(`📱 Connected WhatsApp number: ${info.wid.user}@c.us`);
          console.log(`📱 WhatsApp name: ${info.pushname}`);
        } catch (e) {
          console.log('ℹ️ Could not get WhatsApp info');
        }
        
        resolve();
      });

      this.whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ WhatsApp authentication failed:', msg);
        reject(new Error('WhatsApp authentication failed'));
      });

      this.whatsappClient.on('disconnected', (reason) => {
        console.log('📱 WhatsApp disconnected:', reason);
        this.whatsappReady = false;
      });

      this.whatsappClient.initialize().catch(reject);
    });
  }

  async testConnection() {
    console.log('🧪 Testing WhatsApp Connection');
    console.log('='.repeat(40));
    
    try {
      // 1. Initialize WhatsApp
      await this.initializeWhatsApp();
      
      // 2. Test phone number formatting
      console.log('\n📞 Testing phone number formatting:');
      const testPhone = process.env.TEST_PHONE;
      console.log(`   🔧 Input: ${testPhone}`);
      const formatted = this.formatPhoneNumber(testPhone);
      console.log(`   📱 Formatted: ${formatted}`);
      
      // 3. Check if number exists in WhatsApp
      console.log('\n🔍 Checking if number exists in WhatsApp...');
      try {
        const numberCheck = await this.whatsappClient.getNumberId(formatted);
        if (numberCheck) {
          console.log(`✅ Number exists in WhatsApp: ${numberCheck._serialized}`);
        } else {
          console.log(`❌ Number does not exist in WhatsApp: ${formatted}`);
        }
      } catch (checkError) {
        console.log(`⚠️ Could not verify number: ${checkError.message}`);
      }
      
      // 4. Test sending a simple message
      console.log('\n📲 Testing simple message send...');
      try {
        const testMessage = '🧪 WhatsApp connection test - ignore this message';
        const result = await this.whatsappClient.sendMessage(formatted, testMessage);
        
        if (result) {
          console.log('✅ Test message sent successfully!');
          console.log(`   📱 Message ID: ${result.id._serialized}`);
          console.log(`   📅 Timestamp: ${new Date(result.timestamp * 1000)}`);
        } else {
          console.log('❌ Test message failed to send');
        }
      } catch (sendError) {
        console.log(`❌ Send error: ${sendError.message}`);
      }
      
      // 5. Get chat info
      console.log('\n💬 Getting chat information...');
      try {
        const chat = await this.whatsappClient.getChatById(formatted);
        console.log(`✅ Chat found: ${chat.name || 'No name'}`);
        console.log(`   📱 Is Group: ${chat.isGroup}`);
        console.log(`   📱 Messages: ${chat.unreadCount} unread`);
      } catch (chatError) {
        console.log(`⚠️ Could not get chat: ${chatError.message}`);
      }
      
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
    } finally {
      if (this.whatsappReady) {
        await this.whatsappClient.destroy();
        console.log('\n📱 WhatsApp client disconnected');
      }
    }
  }
}

// Run the connection test
console.log('🔧 WhatsApp Connection Diagnostic Test');
console.log(`📱 Testing with phone: ${process.env.TEST_PHONE}`);
console.log('');

const test = new WhatsAppConnectionTest();
test.testConnection().then(() => {
  console.log('\n🏁 Connection test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
