import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

class SimpleWhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  async initialize() {
    console.log('🔧 Initializing WhatsApp Web client...');
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'hybrid-service'
      }),
      puppeteer: {
        headless: false, 
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    // QR Code for authentication
    this.client.on('qr', (qr) => {
      console.log('\n📱 WhatsApp Web QR Code:');
      console.log('👆 Scan this QR code with your WhatsApp mobile app');
      console.log('📱 Open WhatsApp > Settings > Linked Devices > Link a Device');
      console.log('📷 Point your camera at this QR code:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Waiting for QR code scan...\n');
    });

    // Ready event
    this.client.on('ready', () => {
      console.log('✅ WhatsApp Web client is ready!');
      this.isReady = true;
    });

    // Authentication events
    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp authentication successful');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
    });

    // Disconnection event
    this.client.on('disconnected', (reason) => {
      console.log('📱 WhatsApp disconnected:', reason);
      this.isReady = false;
    });

    // Initialize the client
    await this.client.initialize();
    
    // Wait for ready state
    await this.waitForReady();
  }

  async waitForReady() {
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve();
        return;
      }

      const checkReady = () => {
        if (this.isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 1000);
        }
      };

      checkReady();
    });
  }

  async sendMessage(phoneNumber, message, pdfPath = null) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Format phone number for WhatsApp
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;

      console.log(`📱 Sending WhatsApp message to ${phoneNumber}...`);
      console.log(`🔍 DEBUG: pdfPath provided: ${pdfPath}`);
      console.log(`🔍 DEBUG: pdfPath exists: ${pdfPath ? fs.existsSync(pdfPath) : 'No path provided'}`);

      // If PDF is provided, send message with PDF attachment
      if (pdfPath && fs.existsSync(pdfPath)) {
        console.log(`📎 Sending message with PDF attachment: ${path.basename(pdfPath)}`);
        console.log(`📄 PDF file size: ${fs.statSync(pdfPath).size} bytes`);
        
        const media = MessageMedia.fromFilePath(pdfPath);
        
        console.log(`🔍 DEBUG: Media object created, mimetype: ${media.mimetype}`);
        console.log(`🔍 DEBUG: Setting caption: ${message.substring(0, 100)}...`);
        
        // Set caption on media object
        media.caption = message;
        
        // Send the media with caption
        await this.client.sendMessage(chatId, media);
        console.log(`✅ Message with PDF attachment sent to ${phoneNumber}`);
      } else {
        // Send text message only if no PDF
        console.log(`⚠️ No PDF provided or file doesn't exist, sending text only`);
        await this.client.sendMessage(chatId, message);
        console.log(`✅ Text message sent to ${phoneNumber}`);
      }

      return true;

    } catch (error) {
      console.error(`❌ Failed to send WhatsApp message to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Remove leading + if present
    if (cleaned.startsWith('54')) {
      return cleaned;
    }
    
    // Add Argentina country code if not present
    if (!cleaned.startsWith('54')) {
      cleaned = '54' + cleaned;
    }
    
    return cleaned;
  }

  async stop() {
    if (this.client) {
      console.log('🛑 Stopping WhatsApp client...');
      await this.client.destroy();
      this.isReady = false;
      console.log('✅ WhatsApp client stopped');
    }
  }
}

export default SimpleWhatsAppService;
