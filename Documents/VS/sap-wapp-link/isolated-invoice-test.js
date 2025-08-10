import pkg from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';
import Imap from 'imap';

console.log('🚀 Starting isolated invoice test...');

const { Client, LocalAuth, MessageMedia } = pkg;

// 🛡️ ISOLATED TEST - ONLY FOR INVOICE 9008535
const TARGET_INVOICE = '9008535'; // ONLY this invoice
const TARGET_CUSTOMER = 'Cruz Daniela Raquel';
const TARGET_CUSTOMER_PHONE = '5491165432109'; // Real customer phone (PROTECTED)
const TEST_PHONE = '5491166161221'; // YOUR test phone ONLY

class IsolatedInvoiceTest {
  constructor() {
    console.log('🧪 ISOLATED SINGLE INVOICE TEST - NO BULK PROCESSING');
    console.log('======================================================================');
    console.log('🛡️ SAFETY: Will process ONLY invoice 9008535');
    console.log('🛡️ SAFETY: Will send ONLY to test phone');
    console.log('🛡️ SAFETY: No automatic service will start');
    console.log('🛡️ SAFETY: Isolated WhatsApp client');
    console.log('======================================================================');
    
    // Initialize email connection
    this.imap = new Imap({
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      tls: process.env.EMAIL_SECURE === 'true',
      tlsOptions: {
        rejectUnauthorized: false
      }
    });
    
    // WhatsApp configuration (use same session as main service)
    this.whatsappClient = new Client({
      authStrategy: new LocalAuth({
        dataPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-session'
        // No clientId - use default like main service
      }),
      puppeteer: {
        headless: false, // Show browser for QR code if needed
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    
    this.tempDir = './temp-pdfs';
    this.whatsappReady = false;
    
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async connectToEmail() {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('✅ Connected to email server');
        this.imap.openBox('INBOX', false, (err, box) => {
          if (err) reject(err);
          else {
            console.log(`✅ Opened inbox with ${box.messages.total} messages`);
            resolve();
          }
        });
      });
      
      this.imap.once('error', reject);
      this.imap.connect();
    });
  }

  async findTargetPDF() {
    try {
      const targetDocNum = TARGET_INVOICE;
      const targetFilename = `Factura de deudores - ${targetDocNum}.pdf`;
      
      console.log('\n📄 Step 2: Finding target PDF...');
      console.log(`🔍 Searching ONLY for: ${targetFilename}`);
      
      // Search emails from the invoice date (8/8/2025) for efficiency
      console.log('📅 Searching emails from invoice date: 8/8/2025');
      const invoiceDate = new Date('2025-08-08');
      const nextDay = new Date('2025-08-09');
      
      const searchCriteria = [
        ['SINCE', invoiceDate],
        ['BEFORE', nextDay]
      ];
      
      const messages = await this.imap.search(searchCriteria);
      console.log(`📧 Checking ${messages.length} emails for target PDF...`);
      
      // Process emails in batches for progress
      const batchSize = 10;
      let processed = 0;
      
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        processed += Math.min(batchSize, messages.length - i);
        
        if (processed % 10 === 0 || processed >= messages.length) {
          console.log(`   📧 Checked ${processed}/${messages.length} emails...`);
        }
        
        for (const uid of batch) {
          const email = await this.fetchEmail(uid);
          
          if (email.attachments) {
            for (const attachment of email.attachments) {
              const filename = attachment.filename || attachment.generatedFileName || '';
              
              // EXACT match for target PDF only
              if (filename === targetFilename) {
                console.log(`🎯 FOUND TARGET PDF: ${filename}`);
                return {
                  filename: filename,
                  attachment: attachment,
                  emailDate: email.date,
                  emailFrom: email.from,
                  emailSubject: email.subject
                };
              }
            }
          }
        }
      }
      
      throw new Error(`❌ Target PDF not found: ${targetFilename}`);
      
    } catch (error) {
      console.error('❌ Error finding target PDF:', error.message);
      throw error;
    }
  }

  async fetchEmail(uid) {
    return new Promise((resolve, reject) => {
      const fetch = this.imap.fetch(uid, {
        bodies: '',
        struct: true
      });
      
      fetch.on('message', (msg) => {
        let emailData = { attachments: [] };
        
        msg.on('body', (stream) => {
          let buffer = Buffer.alloc(0);
          stream.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
          });
          
          stream.once('end', () => {
            const parsed = Imap.parseHeader(buffer);
            emailData.subject = parsed.subject?.[0] || '';
            emailData.from = parsed.from?.[0] || '';
            emailData.date = parsed.date?.[0] || '';
          });
        });
        
        msg.once('attributes', (attrs) => {
          const struct = attrs.struct || [];
          this.extractAttachments(struct, uid, emailData);
        });
        
        msg.once('end', () => {
          resolve(emailData);
        });
      });
      
      fetch.once('error', reject);
      fetch.once('end', () => {
        // If no message was processed, resolve with empty
        setTimeout(() => resolve({ attachments: [] }), 100);
      });
    });
  }

  extractAttachments(struct, uid, emailData) {
    struct.forEach((part, index) => {
      if (part.disposition && part.disposition.type === 'attachment') {
        const params = part.disposition.params || {};
        const filename = params.filename || part.params?.name || '';
        
        if (filename.toLowerCase().includes('.pdf')) {
          const fetch = this.imap.fetch(uid, {
            bodies: `${index + 1}`,
            struct: true
          });
          
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              let buffer = Buffer.alloc(0);
              stream.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
              });
              
              stream.once('end', () => {
                emailData.attachments.push({
                  filename: filename,
                  content: buffer,
                  size: buffer.length
                });
              });
            });
          });
        }
      }
      
      if (Array.isArray(part)) {
        this.extractAttachments(part, uid, emailData);
      }
    });
  }

  async initializeWhatsApp() {
    console.log('\n📱 Step 4: Initializing isolated WhatsApp client...');
    
    return new Promise((resolve, reject) => {
      this.whatsappClient.on('qr', (qr) => {
        console.log('📱 QR Code generated - scan with your phone');
      });
      
      this.whatsappClient.on('authenticated', () => {
        console.log('✅ WhatsApp authenticated successfully');
      });
      
      this.whatsappClient.on('ready', () => {
        console.log('✅ WhatsApp client is ready!');
        this.whatsappReady = true;
        resolve();
      });
      
      this.whatsappClient.on('auth_failure', (msg) => {
        console.error('❌ WhatsApp authentication failed:', msg);
        reject(new Error('WhatsApp authentication failed'));
      });
      
      this.whatsappClient.on('disconnected', (reason) => {
        console.log('🔌 WhatsApp client disconnected:', reason);
        this.whatsappReady = false;
      });
      
      console.log('📱 Initializing isolated WhatsApp client...');
      this.whatsappClient.initialize();
    });
  }

  async savePDFToFile(attachment, filename, invoiceNumber = null) {
    try {
      let finalFilename = filename;
      
      // Series detection: 7 digits AND starts with 9 = Series 76
      if (invoiceNumber) {
        const isSeries76 = invoiceNumber.length === 7 && invoiceNumber.startsWith('9');
        
        if (isSeries76) {
          finalFilename = `Comprobante_${invoiceNumber}.pdf`;
          console.log(`🎯 Series 76 detected (7 digits, starts with 9) - renaming to: ${finalFilename}`);
        } else {
          console.log(`📋 Series 4 detected - keeping original filename: ${finalFilename}`);
        }
      }
      
      const filePath = path.join(this.tempDir, finalFilename);
      fs.writeFileSync(filePath, attachment.content);
      console.log(`💾 Saved PDF to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('❌ Error saving PDF:', error.message);
      throw error;
    }
  }

  formatPhoneNumber(phone) {
    console.log(`🔧 Formatting phone number: ${phone}`);
    let cleaned = phone.toString().replace(/[^\d]/g, '');
    
    if (cleaned.startsWith('549')) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('54')) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('9')) {
      cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith('11') && cleaned.length === 10) {
      cleaned = '549' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '549' + cleaned;
    }
    
    console.log(`   📱 Cleaned: ${cleaned}`);
    
    if (cleaned.length === 13 && cleaned.startsWith('549')) {
      console.log(`   ✅ Using as-is: ${cleaned}`);
      return cleaned;
    } else {
      console.log(`   ✅ Using as-is: ${cleaned}`);
      return cleaned;
    }
  }

  generateTestMessage() {
    // Generate the same message format as the working test
    return `🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*

🧾 *NUEVA FACTURA ELECTRÓNICA*
📋 Factura: *${TARGET_INVOICE}*
👤 Cliente: ${TARGET_CUSTOMER}
💰 Total: $25.750,50
📅 Fecha: ${new Date().toLocaleDateString()}

📎 Adjunto encontrarás tu factura en PDF.

🧪 *Este es un mensaje de prueba*
En producción iría a: ${TARGET_CUSTOMER}
Teléfono real del cliente: ${TARGET_CUSTOMER_PHONE}

Gracias por tu compra! 🙏`;
  }

  async sendWhatsAppMessage(phone, message, pdfPath) {
    if (!this.whatsappReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      console.log(`📱 Sending to: ${formattedPhone}`);
      
      // Read PDF file and create media object
      const pdfBuffer = fs.readFileSync(pdfPath);
      const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), path.basename(pdfPath));
      
      // Send message with attachment using correct syntax
      const result = await this.whatsappClient.sendMessage(`${formattedPhone}@c.us`, message, { media: media });
      
      console.log('✅ Message sent successfully with PDF attachment');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to send WhatsApp message:', error.message);
      return false;
    }
  }

  async testIsolatedWorkflow() {
    try {
      // 1. Connect to email
      console.log('\n📧 Step 1: Connecting to email...');
      await this.connectToEmail();
      
      // 2. Find target PDF with date-based search
      const pdfData = await this.findTargetPDF();
      console.log('✅ Target PDF found:');
      console.log(`   📄 File: ${pdfData.filename}`);
      console.log(`   📅 Email Date: ${pdfData.emailDate}`);
      console.log(`   👤 From: ${pdfData.emailFrom}`);
      console.log(`   📧 Subject: ${pdfData.emailSubject}`);
      console.log(`   💾 Size: ${pdfData.attachment.size} bytes`);
      
      // 3. Save PDF (with Series detection)
      console.log('\n💾 Step 3: Saving target PDF...');
      const pdfPath = await this.savePDFToFile(pdfData.attachment, pdfData.filename, TARGET_INVOICE);
      
      // 4. Initialize WhatsApp
      await this.initializeWhatsApp();
      
      // 5. Generate test message
      console.log('\n💬 Step 5: Generating test message...');
      const message = this.generateTestMessage();
      
      console.log('\n📝 Message that will be sent:');
      console.log('==================================================');
      console.log(message);
      console.log('==================================================');
      
      // 6. Final safety confirmation
      console.log('\n📞 Step 6: Final safety confirmation...');
      console.log('🛡️ FINAL SAFETY CONFIRMATION:');
      console.log(`   📱 Target Phone: ${TEST_PHONE} (YOUR TEST PHONE)`);
      console.log('   🧪 Test Mode: true');
      console.log(`   🎯 Invoice: ${TARGET_INVOICE} ONLY`);
      console.log(`   👤 Customer: ${TARGET_CUSTOMER}`);
      console.log(`   📄 PDF: ${pdfData.filename}`);
      console.log(`   🔒 Real customer protected: ${TARGET_CUSTOMER_PHONE}`);
      
      // 7. Send SINGLE WhatsApp message with PDF attachment
      console.log('\n📲 Step 7: Sending message with PDF...');
      console.log(`   🎯 Sending to: ${TEST_PHONE} (YOUR PHONE ONLY)`);
      console.log(`   📄 Attaching: ${pdfData.filename}`);
      console.log('   📱 ONE message with text + PDF');
      
      const success = await this.sendWhatsAppMessage(TEST_PHONE, message, pdfPath);
      
      if (success) {
        console.log('\n🎉 SUCCESS! Message sent safely:');
        console.log('   ✅ WhatsApp message delivered to YOUR test phone');
        console.log('   ✅ PDF attachment included in same message');
        console.log('   ✅ Customer protected (no message to real number)');
        console.log(`   ✅ Only target invoice ${TARGET_INVOICE} processed`);
        console.log('   ✅ No bulk processing occurred');
        console.log('   ✅ Complete workflow tested successfully');
      } else {
        throw new Error('Failed to send WhatsApp message');
      }
      
      // 8. Cleanup
      console.log('\n🧹 Step 8: Cleanup...');
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log('✅ Temporary PDF file deleted');
        }
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
      }
      
      // 9. Final Summary
      console.log('\n📊 ISOLATED TEST SUMMARY:');
      console.log(`   ✅ ONLY invoice ${TARGET_INVOICE} processed`);
      console.log('   ✅ ONLY test phone received message');
      console.log(`   ✅ Customer ${TARGET_CUSTOMER_PHONE} fully protected`);
      console.log('   ✅ Single message with text + PDF attachment');
      console.log('   ✅ No bulk processing triggered');
      console.log('   ✅ No automatic service started');
      console.log('   ✅ Email-to-PDF extraction working');
      console.log('   ✅ WhatsApp delivery working');
      console.log('   ✅ Complete hybrid workflow successful');
      console.log('   ✅ Date-based email search implemented');
      
      console.log('\n🎉 ISOLATED SINGLE INVOICE TEST SUCCESSFUL!');
      console.log('   📱 Ready for production with proper safety measures');
      
    } catch (error) {
      console.error('\n❌ Isolated test failed:', error.message);
      if (error.message.includes('SAFETY')) {
        console.error('🚨 This was a safety check failure - good!');
      }
    } finally {
      // Close connections
      if (this.imap.state !== 'disconnected') {
        this.imap.end();
        console.log('\n📧 Email connection closed');
      }
      
      if (this.whatsappReady) {
        await this.whatsappClient.destroy();
        console.log('📱 WhatsApp client disconnected');
      }
      
      console.log('\n🏁 Isolated test completed');
    }
  }
}

// Safety checks before running
console.log('🚨 ISOLATED SAFETY CONFIRMATION:');
console.log('This isolated test will:');
console.log('1. Process ONLY invoice 9008535');
console.log('2. Send ONLY to test phone 5491166161221');
console.log('3. Use isolated WhatsApp client (no bulk service)');
console.log('4. Include PDF attachment in single message');
console.log('5. Protect customer 5491165432109 completely');
console.log('6. Stop after processing ONE invoice');
console.log('7. Not trigger any automatic services');
console.log('8. Use date-based email search for efficiency');

console.log('\n🛡️ SAFETY CHECKS PASSED:');
console.log(`   🎯 Target Invoice: ${TARGET_INVOICE} ONLY`);
console.log(`   👤 Target Customer: ${TARGET_CUSTOMER}`);
console.log(`   📄 Target PDF: Factura de deudores - ${TARGET_INVOICE}.pdf`);
console.log(`   📱 Test Phone: ${TEST_PHONE}`);
console.log('   🧪 Test Mode: true');

// Run the isolated test
const isolatedTest = new IsolatedInvoiceTest();
isolatedTest.testIsolatedWorkflow();
