import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class EmailInvoiceMonitor {
  constructor() {
    this.imap = null;
    this.isConnected = false;
    this.processedEmails = this.loadProcessedEmails();
    this.tempPdfFolder = process.env.TEMP_PDF_FOLDER || './temp-pdfs';
    
    // Create temp folder if it doesn't exist
    if (!fs.existsSync(this.tempPdfFolder)) {
      fs.mkdirSync(this.tempPdfFolder, { recursive: true });
    }

    this.imapConfig = {
      user: process.env.EMAIL_USERNAME,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_HOST || 'imap.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 993,
      tls: process.env.EMAIL_SECURE === 'true',
      autotls: 'always',
      tlsOptions: {
        rejectUnauthorized: false
      }
    };

    console.log('📧 Email Invoice Monitor initialized');
    console.log(`   📁 Temp PDF folder: ${this.tempPdfFolder}`);
    console.log(`   🔍 Monitoring: ${this.imapConfig.user}@${this.imapConfig.host}`);
  }

  loadProcessedEmails() {
    const logFile = process.env.PROCESSED_EMAILS_LOG || './logs/processed-emails.json';
    try {
      if (fs.existsSync(logFile)) {
        const data = fs.readFileSync(logFile, 'utf8');
        return new Set(JSON.parse(data));
      }
    } catch (error) {
      console.log('⚠️ Could not load processed emails log, starting fresh');
    }
    return new Set();
  }

  saveProcessedEmails() {
    const logFile = process.env.PROCESSED_EMAILS_LOG || './logs/processed-emails.json';
    const logDir = path.dirname(logFile);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    try {
      fs.writeFileSync(logFile, JSON.stringify([...this.processedEmails], null, 2));
    } catch (error) {
      console.error('❌ Could not save processed emails log:', error.message);
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.imap = new Imap(this.imapConfig);

      this.imap.once('ready', () => {
        console.log('✅ Connected to email server');
        this.isConnected = true;
        resolve();
      });

      this.imap.once('error', (err) => {
        console.error('❌ IMAP connection error:', err);
        this.isConnected = false;
        reject(err);
      });

      this.imap.once('end', () => {
        console.log('📪 IMAP connection ended');
        this.isConnected = false;
      });

      this.imap.connect();
    });
  }

  async openInbox() {
    return new Promise((resolve, reject) => {
      const boxName = process.env.EMAIL_INBOX || 'INBOX';
      this.imap.openBox(boxName, false, (err, box) => {
        if (err) {
          reject(err);
        } else {
          console.log(`📥 Opened ${boxName} (${box.messages.total} messages)`);
          resolve(box);
        }
      });
    });
  }

  async searchForInvoiceEmails() {
    return new Promise((resolve, reject) => {
      // Search for recent unread emails (simplified for now)
      const searchCriteria = [
        'UNSEEN', // Only unread emails
        ['SINCE', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] // Last 7 days
      ];

      this.imap.search(searchCriteria, (err, results) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🔍 Found ${results.length} potential invoice emails`);
          resolve(results);
        }
      });
    });
  }

  async processEmail(uid) {
    return new Promise((resolve, reject) => {
      const f = this.imap.fetch(uid, { 
        bodies: '',
        markSeen: process.env.EMAIL_MARK_AS_READ === 'true'
      });

      f.on('message', (msg, seqno) => {
        let emailData = '';

        msg.on('body', (stream, info) => {
          stream.on('data', (chunk) => {
            emailData += chunk.toString('utf8');
          });
        });

        msg.once('end', async () => {
          try {
            const parsed = await simpleParser(emailData);
            console.log(`\n📧 Processing email: "${parsed.subject}"`);
            console.log(`   📤 From: ${parsed.from.text}`);
            console.log(`   📅 Date: ${parsed.date}`);

            // Check if we've already processed this email
            const emailId = `${parsed.messageId}_${parsed.date.getTime()}`;
            if (this.processedEmails.has(emailId)) {
              console.log('   ⏭️ Already processed, skipping');
              resolve({ skipped: true });
              return;
            }

            // Look for PDF attachments
            const pdfAttachments = parsed.attachments?.filter(
              att => att.contentType === 'application/pdf' || 
                     att.filename?.toLowerCase().endsWith('.pdf')
            ) || [];

            if (pdfAttachments.length === 0) {
              console.log('   📎 No PDF attachments found');
              resolve({ noPdf: true });
              return;
            }

            console.log(`   📎 Found ${pdfAttachments.length} PDF attachment(s)`);

            // Process each PDF attachment
            const processedPdfs = [];
            for (const attachment of pdfAttachments) {
              try {
                const pdfData = await this.processPdfAttachment(attachment, parsed);
                if (pdfData) {
                  processedPdfs.push(pdfData);
                }
              } catch (pdfError) {
                console.error(`   ❌ Error processing PDF ${attachment.filename}:`, pdfError.message);
              }
            }

            if (processedPdfs.length > 0) {
              // Mark as processed
              this.processedEmails.add(emailId);
              this.saveProcessedEmails();
              
              resolve({ 
                processed: true, 
                pdfs: processedPdfs,
                email: {
                  subject: parsed.subject,
                  from: parsed.from.text,
                  date: parsed.date
                }
              });
            } else {
              resolve({ noValidPdf: true });
            }

          } catch (parseError) {
            console.error('   ❌ Error parsing email:', parseError.message);
            reject(parseError);
          }
        });
      });

      f.once('error', (err) => {
        console.error('❌ Error fetching email:', err);
        reject(err);
      });
    });
  }

  async processPdfAttachment(attachment, emailData) {
    console.log(`   📄 Processing PDF: ${attachment.filename}`);
    
    try {
      // Save PDF temporarily
      const tempFileName = `${Date.now()}_${attachment.filename}`;
      const tempFilePath = path.join(this.tempPdfFolder, tempFileName);
      fs.writeFileSync(tempFilePath, attachment.content);
      
      console.log(`   💾 Saved PDF temporarily: ${tempFilePath}`);

      // For now, extract basic info from email and filename instead of PDF content
      const invoiceInfo = this.extractInvoiceInfoFromEmail(attachment.filename, emailData);
      
      if (invoiceInfo) {
        console.log(`   🎯 Extracted invoice info:`, invoiceInfo);
        
        return {
          filePath: tempFilePath,
          filename: attachment.filename,
          invoiceInfo: invoiceInfo
        };
      } else {
        console.log('   ⚠️ Could not extract invoice information');
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        return null;
      }

    } catch (error) {
      console.error(`   ❌ Error processing PDF ${attachment.filename}:`, error.message);
      return null;
    }
  }

  extractInvoiceInfoFromEmail(filename, emailData) {
    console.log(`   🔍 Extracting invoice details from email and filename...`);
    
    const extracted = {};

    // Extract from filename
    const filenamePatterns = {
      invoiceNumber: [
        /(?:factura|invoice|documento)[\s_-]*(\d+)/i,
        /(\d{6,})/g, // Long numbers in filename
        /([A-Z]?\d+(?:-\d+)?)/g
      ]
    };

    for (const pattern of filenamePatterns.invoiceNumber) {
      const match = filename.match(pattern);
      if (match) {
        extracted.invoiceNumber = match[1];
        break;
      }
    }

    // Extract from email subject
    const subjectPatterns = {
      invoiceNumber: [
        /(?:factura|invoice|documento)[\s]*(?:n[°º]?|number)?[\s]*:?[\s]*([A-Z]?\d+(?:-\d+)?)/i,
        /(\d{6,})/g
      ],
      customer: [
        /(?:para|for|cliente|customer)[\s]*:?[\s]*([^\n,]+)/i
      ]
    };

    const subject = emailData.subject || '';
    
    if (!extracted.invoiceNumber) {
      for (const pattern of subjectPatterns.invoiceNumber) {
        const match = subject.match(pattern);
        if (match) {
          extracted.invoiceNumber = match[1];
          break;
        }
      }
    }

    for (const pattern of subjectPatterns.customer) {
      const match = subject.match(pattern);
      if (match) {
        extracted.customer = match[1].trim();
        break;
      }
    }

    // Add email metadata
    extracted.emailSubject = emailData.subject;
    extracted.emailFrom = emailData.from.text;
    extracted.emailDate = emailData.date;
    extracted.filename = filename;

    // Always return some info even if minimal
    if (!extracted.invoiceNumber) {
      // Use timestamp as fallback identifier
      extracted.invoiceNumber = `EMAIL-${Date.now()}`;
    }

    if (!extracted.customer) {
      extracted.customer = 'Cliente (desde email)';
    }

    return extracted;
  }

  async checkForNewInvoices() {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      await this.openInbox();
      const emailIds = await this.searchForInvoiceEmails();

      if (emailIds.length === 0) {
        console.log('📪 No new invoice emails found');
        return [];
      }

      const processedInvoices = [];

      for (const uid of emailIds) {
        try {
          const result = await this.processEmail(uid);
          if (result.processed && result.pdfs) {
            processedInvoices.push({
              uid,
              email: result.email,
              pdfs: result.pdfs
            });
          }
        } catch (emailError) {
          console.error(`❌ Error processing email ${uid}:`, emailError.message);
        }
      }

      console.log(`✅ Processed ${processedInvoices.length} new invoice emails`);
      return processedInvoices;

    } catch (error) {
      console.error('❌ Error checking for new invoices:', error.message);
      throw error;
    }
  }

  async startMonitoring(whatsappService) {
    console.log('🚀 Starting email invoice monitoring...');
    
    const checkInterval = parseInt(process.env.EMAIL_CHECK_INTERVAL) || 30000;
    console.log(`⏰ Will check for new invoices every ${checkInterval/1000} seconds`);

    const monitor = async () => {
      try {
        console.log('\n🔍 Checking for new invoice emails...');
        const newInvoices = await this.checkForNewInvoices();

        for (const invoice of newInvoices) {
          console.log(`\n📤 Processing invoice email: "${invoice.email.subject}"`);
          
          for (const pdf of invoice.pdfs) {
            try {
              // Send via WhatsApp using existing service
              await this.sendInvoiceViaWhatsApp(pdf, whatsappService);
              
              // Clean up temp file after successful send
              if (fs.existsSync(pdf.filePath)) {
                fs.unlinkSync(pdf.filePath);
                console.log(`   🗑️ Cleaned up temp file: ${pdf.filename}`);
              }
              
            } catch (whatsappError) {
              console.error(`❌ Error sending ${pdf.filename} via WhatsApp:`, whatsappError.message);
            }
          }
        }

      } catch (monitorError) {
        console.error('❌ Error in monitoring cycle:', monitorError.message);
        
        // Try to reconnect if connection was lost
        if (!this.isConnected) {
          console.log('🔄 Attempting to reconnect to email server...');
          try {
            await this.connect();
          } catch (reconnectError) {
            console.error('❌ Reconnection failed:', reconnectError.message);
          }
        }
      }

      // Schedule next check
      setTimeout(monitor, checkInterval);
    };

    // Start monitoring
    monitor();
  }

  async sendInvoiceViaWhatsApp(pdfData, whatsappService) {
    const { invoiceInfo, filePath, filename } = pdfData;
    
    console.log(`   📱 Sending ${filename} via WhatsApp...`);
    
    // Try to find a phone number for the customer
    let customerPhone = null;
    
    if (invoiceInfo.phones && invoiceInfo.phones.length > 0) {
      // Use the first phone number found in the PDF
      customerPhone = invoiceInfo.phones[0];
      console.log(`   📞 Found customer phone in PDF: ${customerPhone}`);
    }

    // If no phone found, we could try to look up in SAP by customer name
    if (!customerPhone && invoiceInfo.customer) {
      console.log(`   🔍 Searching SAP for customer phone: ${invoiceInfo.customer}`);
      // This would require implementing customer lookup in SAP
      // For now, we'll use admin phone in test mode
      customerPhone = process.env.TEST_PHONE || process.env.ADMIN_PHONE;
    }

    if (!customerPhone) {
      console.log('   ⚠️ No customer phone found, using admin phone');
      customerPhone = process.env.ADMIN_PHONE;
    }

    // Format WhatsApp message
    const message = this.formatWhatsAppMessage(invoiceInfo);

    try {
      // Use existing WhatsApp service to send
      if (whatsappService && typeof whatsappService.sendMessage === 'function') {
        await whatsappService.sendMessage(customerPhone, message, filePath);
        console.log(`   ✅ Sent invoice ${invoiceInfo.invoiceNumber || filename} to ${customerPhone}`);
      } else {
        console.log(`   📝 Would send to ${customerPhone}: ${message}`);
        console.log(`   📎 With attachment: ${filename}`);
      }

    } catch (error) {
      console.error(`   ❌ WhatsApp send failed:`, error.message);
      throw error;
    }
  }

  formatWhatsAppMessage(invoiceInfo) {
    const lines = [];
    
    // Header
    lines.push('📄 *NUEVA FACTURA*');
    
    if (invoiceInfo.invoiceNumber) {
      lines.push(`📋 Factura: *${invoiceInfo.invoiceNumber}*`);
    }
    
    if (invoiceInfo.customer) {
      lines.push(`👤 Cliente: ${invoiceInfo.customer}`);
    }
    
    if (invoiceInfo.total) {
      lines.push(`💰 Total: $${invoiceInfo.total}`);
    }
    
    if (invoiceInfo.date) {
      lines.push(`📅 Fecha: ${invoiceInfo.date}`);
    }
    
    lines.push('');
    lines.push('📎 Adjunto encontrarás tu factura en PDF.');
    lines.push('');
    lines.push('Gracias por tu compra! 🙏');
    
    return lines.join('\n');
  }

  disconnect() {
    if (this.imap && this.isConnected) {
      this.imap.end();
    }
  }
}

export default EmailInvoiceMonitor;
