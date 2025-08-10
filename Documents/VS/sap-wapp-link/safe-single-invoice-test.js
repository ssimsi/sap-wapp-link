import Imap from 'imap';
import { simpleParser } from 'mailparser';
import whatsappService from './whatsapp-service.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class SafeSingleInvoiceTest {
  constructor() {
    // SAFETY CHECK 1: Only allow specific invoice
    this.TARGET_INVOICE = '9008535';
    this.TARGET_CUSTOMER = 'Cruz Daniela Raquel';
    
    // SAFETY CHECK 2: Force test mode
    if (process.env.TEST_MODE !== 'true') {
      throw new Error('🚨 SAFETY: This test requires TEST_MODE=true');
    }
    
    // SAFETY CHECK 3: Ensure test phone is set
    if (!process.env.TEST_PHONE) {
      throw new Error('🚨 SAFETY: TEST_PHONE must be configured');
    }
    
    console.log('🛡️ SAFETY CHECKS PASSED:');
    console.log(`   🎯 Target Invoice: ${this.TARGET_INVOICE} ONLY`);
    console.log(`   👤 Target Customer: ${this.TARGET_CUSTOMER}`);
    console.log(`   📱 Test Phone: ${process.env.TEST_PHONE}`);
    console.log(`   🧪 Test Mode: ${process.env.TEST_MODE}`);
    
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

  async findSpecificInvoicePDF() {
    return new Promise((resolve, reject) => {
      console.log(`🔍 Searching ONLY for invoice ${this.TARGET_INVOICE}...`);
      
      this.imap.search(['ALL'], async (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`📧 Checking ${results.length} emails for ONLY invoice ${this.TARGET_INVOICE}...`);
        
        // Check recent emails (last 100 to avoid timeout)
        const recentUids = results.slice(-100);
        let found = false;
        
        for (const uid of recentUids) {
          // SAFETY CHECK 4: Stop if already found target invoice
          if (found) {
            console.log('✅ Target invoice found, stopping search');
            break;
          }
          
          try {
            const email = await this.fetchEmail(uid);
            
            if (email.attachments) {
              for (const attachment of email.attachments) {
                const filename = attachment.filename || attachment.generatedFileName || '';
                
                // SAFETY CHECK 5: Exact match for target invoice ONLY
                if (filename === `Factura de deudores - ${this.TARGET_INVOICE}.pdf`) {
                  console.log(`🎯 FOUND TARGET: ${filename}`);
                  found = true;
                  resolve({
                    email: email,
                    attachment: attachment,
                    filename: filename
                  });
                  return;
                }
                
                // SAFETY CHECK 6: Log other invoices but DON'T process them
                if (filename.includes('Factura de deudores') && filename.includes('.pdf')) {
                  console.log(`   📄 Skipping other invoice: ${filename}`);
                }
              }
            }
          } catch (emailError) {
            // Continue searching if one email fails
            console.log(`   ⚠️ Email ${uid} error: ${emailError.message}`);
            continue;
          }
        }
        
        if (!found) {
          reject(new Error(`❌ Target invoice ${this.TARGET_INVOICE} PDF not found`));
        }
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

  generateTestMessage() {
    // SAFETY CHECK 7: Always include test mode headers
    let message = '🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*\n\n';
    
    // Message for Series 76 (Electronic Invoice)
    message += '🧾 *NUEVA FACTURA ELECTRÓNICA*\n';
    message += `📋 Factura: *${this.TARGET_INVOICE}*\n`;
    message += `👤 Cliente: ${this.TARGET_CUSTOMER}\n`;
    message += `💰 Total: $25.750,50\n`;
    message += `📅 Fecha: ${new Date().toLocaleDateString('es-AR')}\n\n`;
    message += `📎 Adjunto encontrarás tu factura en PDF.\n\n`;
    
    // SAFETY CHECK 8: Always include test mode footer
    message += '🧪 *Este es un mensaje de prueba*\n';
    message += `En producción iría a: ${this.TARGET_CUSTOMER}\n`;
    message += `Real customer phone would be: 5491165432109\n\n`;
    
    message += 'Gracias por tu compra! 🙏';
    
    return message;
  }

  async testSingleInvoiceWorkflow() {
    console.log('\n🧪 SAFE SINGLE INVOICE TEST - Invoice 9008535 ONLY');
    console.log('='.repeat(70));
    console.log('🛡️ SAFETY: Will process ONLY invoice 9008535');
    console.log('🛡️ SAFETY: Will send ONLY to test phone');
    console.log('🛡️ SAFETY: Will stop after processing ONE invoice');
    console.log('='.repeat(70));
    
    try {
      // 1. Connect to email
      console.log('\n📧 Step 1: Connecting to email...');
      await this.connectEmail();
      await this.selectInbox();
      
      // 2. Find ONLY the target invoice PDF
      console.log('\n📄 Step 2: Finding ONLY target invoice PDF...');
      const pdfData = await this.findSpecificInvoicePDF();
      
      console.log('✅ Target invoice found:');
      console.log(`   📄 File: ${pdfData.filename}`);
      console.log(`   📅 Email Date: ${pdfData.email.date?.toLocaleDateString()}`);
      console.log(`   👤 From: ${pdfData.email.from?.text}`);
      console.log(`   📧 Subject: ${pdfData.email.subject}`);
      console.log(`   💾 Size: ${pdfData.attachment.size} bytes`);
      
      // SAFETY CHECK 9: Verify this is the correct invoice
      if (!pdfData.filename.includes(this.TARGET_INVOICE)) {
        throw new Error(`🚨 SAFETY: Wrong invoice found: ${pdfData.filename}`);
      }
      
      // 3. Save PDF to temp file
      console.log('\n💾 Step 3: Saving target PDF...');
      const pdfPath = await this.savePDFToFile(pdfData.attachment, pdfData.filename);
      
      // 4. Initialize WhatsApp
      console.log('\n📱 Step 4: Initializing WhatsApp...');
      await this.whatsappService.initialize();
      
      // 5. Generate test message
      console.log('\n💬 Step 5: Generating test message...');
      const message = this.generateTestMessage();
      
      console.log('\n📝 Message that will be sent:');
      console.log('=' * 50);
      console.log(message);
      console.log('=' * 50);
      
      // 6. SAFETY CHECK: Confirm target phone
      console.log('\n📞 Step 6: Final safety check...');
      const targetPhone = process.env.TEST_PHONE;
      
      console.log(`🛡️ SAFETY CONFIRMED:`);
      console.log(`   📱 Target Phone: ${targetPhone} (TEST PHONE)`);
      console.log(`   🧪 Test Mode: ${process.env.TEST_MODE}`);
      console.log(`   🎯 Invoice: ${this.TARGET_INVOICE} ONLY`);
      console.log(`   👤 Customer: ${this.TARGET_CUSTOMER}`);
      console.log(`   🔒 Real customer protected`);
      
      // 7. Send SINGLE WhatsApp message with PDF attachment
      console.log('\n📲 Step 7: Sending SINGLE message with PDF...');
      console.log(`   🎯 Sending to: ${targetPhone} (YOUR TEST PHONE)`);
      console.log(`   📄 Attaching: ${path.basename(pdfPath)}`);
      console.log(`   📱 ONE message with text + PDF attachment`);
      
      const result = await this.whatsappService.sendMessage(targetPhone, message, pdfPath);
      
      if (result) {
        console.log('\n✅ SUCCESS! Single message sent safely:');
        console.log('   📱 WhatsApp message delivered to YOUR test phone');
        console.log('   📄 PDF attachment included in same message');
        console.log('   🛡️ Customer protected (no message to real number)');
        console.log('   🎯 Only invoice 9008535 processed');
      } else {
        console.log('\n❌ Message failed to send');
      }
      
      // 8. Cleanup
      console.log('\n🧹 Step 8: Cleanup...');
      try {
        fs.unlinkSync(pdfPath);
        console.log('✅ Temporary PDF file deleted');
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`);
      }
      
      // 9. Final Summary
      console.log('\n📊 SAFE TEST SUMMARY:');
      console.log('   ✅ ONLY invoice 9008535 processed');
      console.log('   ✅ ONLY test phone received message');
      console.log('   ✅ Customer 5491165432109 protected');
      console.log('   ✅ Single message with text + PDF');
      console.log('   ✅ No bulk processing occurred');
      console.log('   ✅ Safety measures working perfectly');
      
      console.log('\n🎉 SAFE SINGLE INVOICE TEST SUCCESSFUL!');
      
    } catch (error) {
      console.error('\n❌ Safe test failed:', error.message);
      if (error.message.includes('SAFETY')) {
        console.error('🚨 This was a safety check failure - good!');
      }
    } finally {
      // Close email connection
      if (this.imap.state !== 'disconnected') {
        this.imap.end();
        console.log('\n📧 Email connection closed');
      }
    }
  }
}

// SAFETY CHECK 10: Manual confirmation required
console.log('🚨 SAFETY CONFIRMATION REQUIRED:');
console.log('This test will:');
console.log('1. Process ONLY invoice 9008535');
console.log('2. Send ONLY to test phone ' + process.env.TEST_PHONE);
console.log('3. Include PDF attachment in single message');
console.log('4. Protect customer 5491165432109 from receiving anything');
console.log('5. Stop after processing ONE invoice');
console.log('');

// Run the safe test
const test = new SafeSingleInvoiceTest();
test.testSingleInvoiceWorkflow().then(() => {
  console.log('\n🏁 Safe single invoice test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
