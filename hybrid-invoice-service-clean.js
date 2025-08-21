import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import PDFCleanupService from './pdf-cleanup-service.js';
import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

// Load environment variables
console.log('🔧 Environment Loading:');
console.log(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);

if (!process.env.RAILWAY_ENVIRONMENT) {
  console.log('   📁 Loading .env.local for local development');
  dotenv.config({ path: '.env.local' });
} else {
  console.log('   🚂 Using Railway environment variables (skipping .env.local)');
}

// Debug: Check SAP variables immediately after environment setup
console.log('🔍 Post-Environment SAP Check:');
console.log(`   VITE_SAP_DATABASE: ${process.env.VITE_SAP_DATABASE ? '✅ Set' : '❌ Missing'} (${process.env.VITE_SAP_DATABASE})`);
console.log(`   VITE_SAP_USERNAME: ${process.env.VITE_SAP_USERNAME ? '✅ Set' : '❌ Missing'} (${process.env.VITE_SAP_USERNAME})`);
console.log(`   VITE_SAP_PASSWORD: ${process.env.VITE_SAP_PASSWORD ? '✅ Set' : '❌ Missing'} (length: ${process.env.VITE_SAP_PASSWORD?.length || 0})`);

class HybridInvoiceService {
  constructor() {
    this.whatsappClient = null;
    this.whatsappReady = false;
    this.pdfCleanupService = new PDFCleanupService();
    this.sapConnection = new SAPConnection();
    this.isRunning = false;
    this.processedInvoices = new Set();
    this.missedInvoices = [];
    
    // Session persistence tracking
    this.lastAuthTime = null;
    this.keepAliveInterval = null;
    
    // Session alert settings
    this.sessionAlertEmail = process.env.SESSION_ALERT_EMAIL || 'ssimsi@gmail.com';
    this.sessionExpiryHours = parseInt(process.env.SESSION_EXPIRY_HOURS) || 24;
    
    console.log('🔧 Configuration:');
    console.log(`   📧 Session alerts: ${this.sessionAlertEmail}`);
    console.log(`   ⏰ Session expiry check: ${this.sessionExpiryHours} hours`);
  }

  async start() {
    console.log('🚀 Starting Hybrid Invoice Service (SAP + WhatsApp)');
    console.log('==================================================');
    console.log('📧 PDF downloads handled by separate PDF Download Service');
    console.log('🔄 This service processes invoices from downloaded-pdfs folder');
    console.log('==================================================');

    await this.initializeWhatsApp();
    
    this.isRunning = true;
    
    // Watch for new PDFs and process them
    this.startInvoiceProcessing();
  }

  async initializeWhatsApp() {
    console.log('📱 Initializing WhatsApp Web client...');
    
    try {
      // Create WhatsApp client with session persistence
      this.whatsappClient = new Client({
        authStrategy: new LocalAuth({
          clientId: 'sap-invoice-service-session',
          dataPath: './whatsapp-session'
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
            '--disable-gpu'
          ]
        }
      });

      // Set up event handlers
      this.setupWhatsAppEvents();
      
      // Initialize WhatsApp
      await this.whatsappClient.initialize();
      
    } catch (error) {
      console.error('❌ Failed to initialize WhatsApp:', error.message);
      throw error;
    }
  }

  setupWhatsAppEvents() {
    // QR Code for authentication - Simple terminal display only
    this.whatsappClient.on('qr', (qr) => {
      console.log('\n📱 WhatsApp QR Code for Authentication:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 Instructions:');
      console.log('1. Open WhatsApp on your phone');
      console.log('2. Go to Settings → Linked Devices');
      console.log('3. Tap "Link a Device"');
      console.log('4. Scan the QR code below:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Terminal QR code
      qrcode.generate(qr, { small: true });
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⏳ Waiting for QR code scan...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });

    // Authentication events
    this.whatsappClient.on('authenticated', () => {
      console.log('🔐 WhatsApp authentication successful');
      this.lastAuthTime = Date.now();
    });

    this.whatsappClient.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      this.whatsappReady = false;
      this.sendSessionAlert('FAILURE', `Authentication failed: ${msg}`, 0)
        .catch(err => console.warn('⚠️ Failed to send failure alert:', err.message));
    });

    // Ready event
    this.whatsappClient.on('ready', () => {
      console.log('✅ WhatsApp Web client is ready!');
      this.whatsappReady = true;
      
      // Start session monitoring
      this.startSessionKeepAlive();
      
      console.log(`📱 Connected as: ${this.whatsappClient?.info?.pushname || 'Unknown'}`);
    });

    // Disconnection event
    this.whatsappClient.on('disconnected', (reason) => {
      console.log('📱 WhatsApp disconnected:', reason);
      this.whatsappReady = false;
      this.stopSessionKeepAlive();
    });

    // Error handler
    this.whatsappClient.on('error', (error) => {
      console.log('⚠️ WhatsApp Client Error:', error.message);
    });
  }

  startSessionKeepAlive() {
    console.log('🔄 Starting session keep-alive monitoring');
    
    // Check session every 30 minutes
    this.keepAliveInterval = setInterval(async () => {
      try {
        if (this.whatsappReady) {
          const sessionAge = this.lastAuthTime ? (Date.now() - this.lastAuthTime) / (1000 * 60 * 60) : 0;
          
          console.log(`💚 Session health check - Age: ${sessionAge.toFixed(1)} hours`);
          
          // Alert if session is getting old (23 hours)
          if (sessionAge > (this.sessionExpiryHours - 1)) {
            await this.sendSessionAlert('WARNING', `Session age: ${sessionAge.toFixed(1)} hours - may expire soon`, sessionAge);
          }
        }
      } catch (error) {
        console.log('⚠️ Keep-alive check failed:', error.message);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  stopSessionKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('🛑 Stopped session keep-alive monitoring');
    }
  }

  async sendSessionAlert(type, message, sessionAge = 0) {
    const subject = `🔥 WhatsApp Session Alert - ${type}`;
    const body = `
WhatsApp Session Alert:

Type: ${type}
Message: ${message}
Session Age: ${sessionAge.toFixed(1)} hours
Time: ${new Date().toISOString()}

Service: SAP Invoice Processing
Environment: ${process.env.RAILWAY_ENVIRONMENT || 'local'}
    `;

    try {
      // Here you would implement email sending
      // For now, just log it
      console.log(`📧 SESSION ALERT: ${subject}\n${body}`);
    } catch (error) {
      console.warn('⚠️ Failed to send session alert:', error.message);
    }
  }

  startInvoiceProcessing() {
    console.log('📂 Starting invoice processing watch...');
    
    // Check for new PDFs every 30 seconds
    setInterval(async () => {
      if (this.whatsappReady) {
        await this.processNewInvoices();
      }
    }, 30000);
    
    // Also check immediately
    if (this.whatsappReady) {
      setTimeout(() => this.processNewInvoices(), 5000);
    }
  }

  async processNewInvoices() {
    const downloadedPdfsPath = './downloaded-pdfs';
    
    if (!fs.existsSync(downloadedPdfsPath)) {
      return;
    }
    
    try {
      const files = fs.readdirSync(downloadedPdfsPath);
      const pdfFiles = files.filter(file => file.endsWith('.pdf'));
      
      for (const pdfFile of pdfFiles) {
        const filePath = path.join(downloadedPdfsPath, pdfFile);
        
        if (!this.processedInvoices.has(pdfFile)) {
          console.log(`📄 Processing new invoice: ${pdfFile}`);
          await this.processInvoice(filePath);
          this.processedInvoices.add(pdfFile);
        }
      }
      
    } catch (error) {
      console.error('❌ Error processing invoices:', error.message);
    }
  }

  async processInvoice(filePath) {
    try {
      // Extract invoice number from filename
      const filename = path.basename(filePath);
      const invoiceMatch = filename.match(/(\d+)/);
      const invoiceNumber = invoiceMatch ? invoiceMatch[1] : 'Unknown';
      
      console.log(`💼 Processing invoice ${invoiceNumber} from ${filename}`);
      
      // Get invoice data from SAP
      const invoiceData = await this.sapConnection.getInvoiceData(invoiceNumber);
      
      if (invoiceData && invoiceData.CardCode) {
        // Get customer WhatsApp from SAP
        const whatsappNumber = await this.sapConnection.getCustomerWhatsApp(invoiceData.CardCode);
        
        if (whatsappNumber) {
          // Send invoice via WhatsApp
          await this.sendInvoiceViaWhatsApp(whatsappNumber, filePath, invoiceData);
          console.log(`✅ Invoice ${invoiceNumber} sent to ${whatsappNumber}`);
        } else {
          console.log(`⚠️ No WhatsApp number found for customer ${invoiceData.CardCode}`);
        }
      } else {
        console.log(`⚠️ Invoice data not found for ${invoiceNumber}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing invoice: ${error.message}`);
    }
  }

  async sendInvoiceViaWhatsApp(phoneNumber, pdfPath, invoiceData) {
    try {
      // Format phone number for WhatsApp
      const whatsappNumber = phoneNumber.replace(/[^\d]/g, '');
      const chatId = `${whatsappNumber}@c.us`;
      
      // Create message
      const message = `
🧾 *Invoice from SKH Trading*

📋 Invoice #: ${invoiceData.DocNum}
📅 Date: ${new Date(invoiceData.DocDate).toLocaleDateString()}
💰 Total: $${parseFloat(invoiceData.DocTotal).toFixed(2)}
👤 Customer: ${invoiceData.CardName}

📎 Please find your invoice attached as PDF.

Thank you for your business! 🙏
      `.trim();
      
      // Send PDF
      const media = MessageMedia.fromFilePath(pdfPath);
      await this.whatsappClient.sendMessage(chatId, media, { caption: message });
      
    } catch (error) {
      console.error('❌ Error sending WhatsApp message:', error.message);
      throw error;
    }
  }
}

// SAP Connection class (simplified)
class SAPConnection {
  constructor() {
    this.baseUrl = process.env.VITE_SAP_SERVICE_LAYER_URL || 'https://hanadepo:50000/b1s/v1';
    this.database = process.env.VITE_SAP_DATABASE;
    this.username = process.env.VITE_SAP_USERNAME;
    this.password = process.env.VITE_SAP_PASSWORD;
    this.sessionId = null;
  }

  async authenticate() {
    if (this.sessionId) return this.sessionId;

    const loginData = {
      CompanyDB: this.database,
      UserName: this.username,
      Password: this.password
    };

    try {
      const response = await this.makeRequest('POST', '/Login', loginData);
      this.sessionId = response.SessionId;
      return this.sessionId;
    } catch (error) {
      console.error('❌ SAP authentication failed:', error.message);
      throw error;
    }
  }

  async getInvoiceData(invoiceNumber) {
    await this.authenticate();
    
    try {
      const filter = `$filter=DocNum eq ${invoiceNumber}`;
      const response = await this.makeRequest('GET', `/Invoices?${filter}`);
      return response.value?.[0] || null;
    } catch (error) {
      console.error(`❌ Failed to get invoice ${invoiceNumber}:`, error.message);
      return null;
    }
  }

  async getCustomerWhatsApp(customerCode) {
    await this.authenticate();
    
    try {
      const filter = `$filter=CardCode eq '${customerCode}'`;
      const response = await this.makeRequest('GET', `/BusinessPartners?${filter}`);
      const customer = response.value?.[0];
      
      // Look for WhatsApp in various fields
      return customer?.Cellular || customer?.Phone1 || customer?.Phone2 || null;
    } catch (error) {
      console.error(`❌ Failed to get customer WhatsApp ${customerCode}:`, error.message);
      return null;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.sessionId) {
      options.headers['Cookie'] = `B1SESSION=${this.sessionId}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`SAP Error: ${parsedData.error?.message?.value || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse SAP response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`SAP request failed: ${error.message}`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }
}

// Initialize and start the service
const service = new HybridInvoiceService();

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  service.isRunning = false;
  service.stopSessionKeepAlive();
  if (service.whatsappClient) {
    await service.whatsappClient.destroy();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  service.isRunning = false;
  service.stopSessionKeepAlive();
  if (service.whatsappClient) {
    await service.whatsappClient.destroy();
  }
  process.exit(0);
});

// Start the service
service.start().catch((error) => {
  console.error('💥 Failed to start service:', error.message);
  process.exit(1);
});
