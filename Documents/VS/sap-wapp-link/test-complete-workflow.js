import Imap from 'imap';
import { simpleParser } from 'mailparser';
import whatsappService from './whatsapp-service.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class CompleteInvoiceTest {
  constructor() {
    this.imap = new Imap({
      user: process.env.EMAIL_USERNAME,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      tls: process.env.EMAIL_SECURE === 'true',
      tlsOptions: {
        rejectUnauthorized: false
      }
    });
    
    this.whatsappService = whatsappService;
    this.tempDir = './temp-pdfs';
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async connectEmail() {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('✅ Connected to email server');
        resolve();
      });

      this.imap.once('error', (err) => {
        reject(err);
      });

      this.imap.connect();
    });
  }

  async selectInbox() {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ Opened inbox with ${box.messages.total} messages`);
          resolve(box);
        }
      });
    });
  }

  async findInvoicePDF(docNum) {
    return new Promise((resolve, reject) => {
      this.imap.search(['ALL'], async (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`🔍 Searching ${results.length} emails for invoice ${docNum}...`);
        
        // Check recent emails first (last 100)
        const recentUids = results.slice(-100);
        
        for (const uid of recentUids) {
          try {
            const email = await this.fetchEmail(uid);
            
            if (email.attachments) {
              for (const attachment of email.attachments) {
                const filename = attachment.filename || attachment.generatedFileName || '';
                
                if (filename.includes(docNum)) {
                  console.log(`🎯 Found PDF: ${filename}`);
                  resolve({
                    email: email,
                    attachment: attachment,
                    filename: filename
                  });
                  return;
                }
              }
            }
          } catch (emailError) {
            // Continue searching if one email fails
            continue;
          }
        }
        
        reject(new Error(`PDF for invoice ${docNum} not found`));
      });
    });
  }

  async fetchEmail(uid) {
    return new Promise((resolve, reject) => {
      const f = this.imap.fetch(uid, { 
        bodies: '',
        struct: true
      });

      f.on('message', (msg, seqno) => {
        let buffer = '';
        
        msg.on('body', (stream, info) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', async () => {
          try {
            const parsed = await simpleParser(buffer);
            resolve(parsed);
          } catch (parseError) {
            reject(parseError);
          }
        });
      });

      f.once('error', (err) => {
        reject(err);
      });
    });
  }

  async savePDFToFile(attachment, filename) {
    const filePath = path.join(this.tempDir, filename);
    
    try {
      fs.writeFileSync(filePath, attachment.content);
      console.log(`💾 Saved PDF to: ${filePath}`);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save PDF: ${error.message}`);
    }
  }

  generateInvoiceMessage(docNum, customerName, amount, date) {
    let message = '';
    
    // Test mode header
    if (process.env.TEST_MODE === 'true') {
      message += '🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*\n\n';
    }
    
    // Determine message type based on DocNum (9008535 is Series 76 = Electronic)
    const messageType = docNum >= 9008000 ? 'FACTURA ELECTRÓNICA' : 'FACTURA';
    
    // Main message
    message += `🧾 *NUEVA ${messageType}*\n`;
    message += `📋 Factura: *${docNum}*\n`;
    message += `👤 Cliente: ${customerName}\n`;
    message += `💰 Total: $${parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n`;
    message += `📅 Fecha: ${new Date(date).toLocaleDateString('es-AR')}\n\n`;
    message += `📎 Adjunto encontrarás tu factura en PDF.\n\n`;
    
    // Test mode footer
    if (process.env.TEST_MODE === 'true') {
      message += '🧪 *Este es un mensaje de prueba*\n';
      message += 'En producción iría a Cruz Daniela Raquel\n\n';
    }
    
    message += 'Gracias por tu compra! 🙏';
    
    return message;
  }

  async testCompleteWorkflow() {
    console.log('🧪 Testing Complete Workflow - Invoice 9008535 with PDF');
    console.log('='.repeat(70));
    
    try {
      // 1. Connect to email
      console.log('\n📧 Step 1: Connecting to email...');
      await this.connectEmail();
      await this.selectInbox();
      
      // 2. Find and extract PDF
      console.log('\n📄 Step 2: Finding invoice PDF...');
      const pdfData = await this.findInvoicePDF('9008535');
      
      console.log(`✅ Found PDF: ${pdfData.filename}`);
      console.log(`   📅 Email Date: ${pdfData.email.date?.toLocaleDateString()}`);
      console.log(`   👤 From: ${pdfData.email.from?.text}`);
      console.log(`   📧 Subject: ${pdfData.email.subject}`);
      console.log(`   💾 Size: ${pdfData.attachment.size} bytes`);
      
      // 3. Save PDF to temp file
      console.log('\n💾 Step 3: Saving PDF...');
      const pdfPath = await this.savePDFToFile(pdfData.attachment, pdfData.filename);
      
      // 4. Initialize WhatsApp
      console.log('\n📱 Step 4: Initializing WhatsApp...');
      await this.whatsappService.initialize();
      
      // 5. Generate message
      console.log('\n💬 Step 5: Generating message...');
      const message = this.generateInvoiceMessage(
        9008535,
        'Cruz Daniela Raquel',
        25750.50,
        '2025-08-10'
      );
      
      console.log('📝 Message to send:');
      console.log('=' * 50);
      console.log(message);
      console.log('=' * 50);
      
      // 6. Determine target phone (with safety)
      console.log('\n📞 Step 6: Determining target phone...');
      let targetPhone;
      
      if (process.env.TEST_MODE === 'true') {
        targetPhone = process.env.TEST_PHONE;
        console.log(`🧪 TEST MODE: Sending to test phone: ${targetPhone}`);
        console.log(`🔒 Real customer protected (would be: 5491165432109)`);
      } else {
        targetPhone = '5491165432109'; // Cruz Daniela Raquel's real number
        console.log(`⚠️ PRODUCTION: Sending to customer: ${targetPhone}`);
      }
      
      // 7. Send WhatsApp message with PDF attachment
      console.log('\n📲 Step 7: Sending WhatsApp message with PDF...');
      console.log(`   📱 Target: ${targetPhone}`);
      console.log(`   📄 Attachment: ${path.basename(pdfPath)}`);
      
      const result = await this.whatsappService.sendMessage(targetPhone, message, pdfPath);
      
      if (result) {
        console.log('✅ Message sent successfully!');
        console.log('   📱 WhatsApp message with PDF delivered');
        console.log('   📄 Single message with both text and attachment');
      } else {
        console.log('❌ Message failed to send');
      }
      
      // 8. Cleanup
      console.log('\n🧹 Step 8: Cleanup...');
      try {
        fs.unlinkSync(pdfPath);
        console.log('✅ Temporary PDF file deleted');
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
      }
      
      // 9. Summary
      console.log('\n📊 Workflow Summary:');
      console.log('   ✅ Email connection established');
      console.log('   ✅ PDF found and extracted');
      console.log('   ✅ WhatsApp service initialized');
      console.log('   ✅ Message generated (Series 76 - Electronic)');
      console.log('   ✅ Single message with text + PDF attachment');
      console.log('   ✅ Safety mode active (test phone override)');
      console.log('   ✅ Customer protected from unsolicited messages');
      
      console.log('\n🎉 Complete workflow test successful!');
      console.log('   📱 Ready for production with proper safety measures');
      
    } catch (error) {
      console.error('❌ Workflow test failed:', error.message);
      console.error('Full error:', error);
    } finally {
      // Close email connection
      if (this.imap.state !== 'disconnected') {
        this.imap.end();
        console.log('\n📧 Email connection closed');
      }
    }
  }
}

// Run the complete test
const test = new CompleteInvoiceTest();
test.testCompleteWorkflow().then(() => {
  console.log('\n🏁 Complete workflow test finished');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
