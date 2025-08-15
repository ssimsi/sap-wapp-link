import SimpleWhatsAppService from './simple-whatsapp-service.js';
import EmailInvoiceMonitor from './email-invoice-monitor.js';
import EmailReporter from './email-reporter.js';
import PDFCleanupService from './pdf-cleanup-service.js';
import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';
import cron from 'node-cron';

// Load environment variables
dotenv.config({ path: '.env.local' });

class HybridInvoiceService {
  constructor() {
    this.whatsappService = new SimpleWhatsAppService();
    this.emailMonitor = new EmailInvoiceMonitor();
    this.emailReporter = new EmailReporter();
    this.pdfCleanupService = new PDFCleanupService();
    this.sapConnection = new SAPConnection();
    this.isRunning = false;
    this.processedInvoices = new Set();
    this.missedInvoices = [];
    this.emailCache = new Map(); // Cache emails to avoid repeated searches
  }

  async start() {
    console.log('🚀 Starting Hybrid Invoice Service (SAP + Email + WhatsApp)');
    console.log('===========================================================');
    
    // Show test mode status prominently
    if (process.env.TEST_MODE === 'true') {
      console.log('');
      console.log('🧪 ⚠️  TEST MODE ACTIVE ⚠️  🧪');
      console.log('================================');
      console.log(`📱 ALL WhatsApp messages will go to: ${process.env.TEST_PHONE}`);
      console.log('🔒 No messages will be sent to real customers');
      console.log('🧪 All messages will include test mode headers');
      console.log('================================');
      console.log('');
    } else {
      console.log('');
      console.log('🚨 PRODUCTION MODE - Messages enabled!');
      
      // Show customer message safety status
      if (process.env.DISABLE_CUSTOMER_MESSAGES === 'true') {
        console.log('');
        console.log('🔒 ⚠️  CUSTOMER MESSAGES DISABLED ⚠️  🔒');
        console.log('=========================================');
        console.log('📵 Customer notifications: DISABLED');
        console.log('👨‍💼 Salesperson notifications: ENABLED');
        console.log('🛡️ Extra safety mode active');
        console.log('=========================================');
      } else {
        console.log('📱 Customer notifications: ENABLED');
        console.log('👨‍💼 Salesperson notifications: ENABLED');
      }
      console.log('');
    }
    
    try {
      // Initialize WhatsApp service
      console.log('\n📱 Initializing WhatsApp service...');
      await this.whatsappService.initialize();
      
      // Test email connection
      console.log('\n📧 Testing email connection...');
      await this.emailMonitor.connect();
      await this.emailMonitor.openInbox();
      console.log('✅ Email connection successful');
      
      // Test SAP connection
      console.log('\n🔗 Testing SAP connection...');
      const sapConnected = await this.sapConnection.login();
      if (!sapConnected) {
        throw new Error('SAP connection failed');
      }
      console.log('✅ SAP connection successful');
      
      // Start monitoring
      this.isRunning = true;
      console.log('\n✅ Hybrid service started successfully!');
      console.log('🔄 Now monitoring SAP invoices and matching with email PDFs...');
      
      // Schedule invoice processing every 5 minutes
      cron.schedule('*/5 * * * *', () => {
        this.processNewInvoices().catch(console.error);
      });
      
      // Schedule daily email report at 6 PM
      cron.schedule('0 18 * * *', () => {
        this.sendDailyReport().catch(console.error);
      });
      
      // Start PDF cleanup service (runs daily at 5 AM)
      console.log('\n🧹 Starting PDF cleanup service...');
      this.pdfCleanupService.start();
      
      // Process immediately on start
      setTimeout(() => {
        this.processNewInvoices().catch(console.error);
      }, 5000);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('\n❌ Failed to start hybrid service:', error.message);
      await this.stop();
      process.exit(1);
    }
  }

  async processNewInvoices() {
    console.log('\n🔍 Processing new invoices from SAP...');
    
    try {
      // Get new invoices from SAP (reuse existing logic)
      const newInvoices = await this.getNewInvoicesFromSAP();
      
      if (newInvoices.length === 0) {
        console.log('📪 No new invoices found in SAP');
        return;
      }
      
      console.log(`📋 Found ${newInvoices.length} new invoice(s) in SAP`);
      
      for (const  invoice of newInvoices) {
        try {
          await this.processInvoiceWithEmail(invoice);
        } catch (invoiceError) {
          console.error(`❌ Error processing invoice ${invoice.DocNum}:`, invoiceError.message);
          this.missedInvoices.push({
            invoice,
            error: invoiceError.message,
            timestamp: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error in processNewInvoices:', error.message);
    }
  }

  async getNewInvoicesFromSAP() {
    const fromDate = process.env.PROCESS_INVOICES_FROM_DATE || '2025-08-08';
    
    try {
      // Get invoices that haven't been sent via WhatsApp yet
      // Properly encode the OData query to avoid unescaped characters
      const filter = `DocDate ge '${fromDate}' and (U_WhatsAppSent eq null or U_WhatsAppSent eq 'N')`;
      const orderby = 'DocEntry desc';
      const select = 'DocEntry,DocNum,CardCode,CardName,DocTotal,DocDate,Series,SalesPersonCode,U_WhatsAppSent,U_WhatsAppDate,U_WhatsAppPhone,Comments';
      
      const query = `/b1s/v1/Invoices?${encodeURI(`$filter=${filter}&$orderby=${orderby}&$top=50&$select=${select}`)}`;
      
      console.log('🔍 SAP Query:', query);
      
      const invoicesResponse = await this.sapConnection.makeRequest(query);
      
      return invoicesResponse.value || [];
      
    } catch (error) {
      console.error('❌ Error getting invoices from SAP:', error.message);
      return [];
    }
  }

  async processInvoiceWithEmail(invoice) {
    console.log(`\n📄 Processing Invoice ${invoice.DocNum} (DocEntry: ${invoice.DocEntry})`);
    
    // Safety check - ensure test mode is respected
    if (process.env.TEST_MODE === 'true') {
      console.log(`🧪 TEST MODE ACTIVE - All messages will go to ${process.env.TEST_PHONE}`);
    }
    
    // 1. Generate WhatsApp message from SAP data
    const whatsappMessage = this.generateWhatsAppMessage(invoice);
    
    // 2. Search for corresponding PDF in email (using invoice date for faster search)
    const pdfPath = await this.findInvoicePDF(invoice.DocNum, invoice.DocDate, invoice.Series);
    
    if (!pdfPath) {
      console.log(`⚠️ No PDF found for invoice ${invoice.DocNum} - adding to missed list`);
      this.missedInvoices.push({
        invoice,
        error: 'PDF not found in email',
        timestamp: new Date()
      });
      return;
    }
    
    // 3. Get customer phone number
    const customerPhone = this.getCustomerPhone(invoice);
    
    if (!customerPhone) {
      console.log(`⚠️ No phone number for invoice ${invoice.DocNum} - using admin phone`);
    }
    
    // 4. Determine phone to use with safety checks
    let phoneToUse;
    let messageTarget;
    
    // SAFETY CHECK: If customer messages are disabled, skip customer and only notify salesperson
    if (process.env.DISABLE_CUSTOMER_MESSAGES === 'true') {
      console.log(`🔒 CUSTOMER MESSAGES DISABLED - Skipping customer notification for invoice ${invoice.DocNum}`);
      console.log(`   📋 Customer would have been: ${customerPhone || 'No phone available'}`);
      
      // Skip customer message completely, only send salesperson notification
      await this.markInvoiceAsSent(invoice.DocEntry);
      await this.sendSalespersonNotification(invoice);
      
      // Clean up temp PDF
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      
      console.log(`✅ Invoice ${invoice.DocNum} marked as sent (customer message disabled, salesperson notified)`);
      this.processedInvoices.add(invoice.DocNum);
      return;
    }
    
    // Normal logic: Send to customer
    if (process.env.TEST_MODE === 'true') {
      phoneToUse = process.env.TEST_PHONE;
      messageTarget = 'TEST MODE';
    } else {
      phoneToUse = customerPhone || process.env.ADMIN_PHONE;
      messageTarget = customerPhone ? 'Customer' : 'Admin (no customer phone)';
    }
    
    console.log(`📱 Sending to ${messageTarget}: ${phoneToUse}`);
    
    try {
      await this.whatsappService.sendMessage(phoneToUse, whatsappMessage, pdfPath);
      
      // 5. Mark as sent in SAP
      await this.markInvoiceAsSent(invoice.DocEntry);
      
      // 6. Send salesperson notification
      await this.sendSalespersonNotification(invoice);
      
      // 7. Clean up temp PDF
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      
      console.log(`✅ Successfully sent invoice ${invoice.DocNum} via WhatsApp`);
      this.processedInvoices.add(invoice.DocNum);
      
    } catch (whatsappError) {
      console.error(`❌ WhatsApp send failed for ${invoice.DocNum}:`, whatsappError.message);
      throw whatsappError;
    }
  }

  async findInvoicePDF(docNum, invoiceDate, series) {
    console.log(`   🔍 Searching email for PDF with filename containing DocNum: ${docNum}`);
    console.log(`   📅 Invoice date: ${invoiceDate}, Series: ${series}`);
    
    try {
      // Use invoice date for more efficient search (search same day + 1 day buffer)
      const invoiceDateObj = new Date(invoiceDate);
      const searchFromDate = new Date(invoiceDateObj);
      searchFromDate.setDate(invoiceDateObj.getDate() - 1); // 1 day before
      const searchToDate = new Date(invoiceDateObj);
      searchToDate.setDate(invoiceDateObj.getDate() + 1); // 1 day after
      
      console.log(`   📆 Searching emails from ${searchFromDate.toDateString()} to ${searchToDate.toDateString()}`);
      
      // Search emails for the specific date range
      const searchCriteria = [
        ['SINCE', searchFromDate],
        ['BEFORE', searchToDate]
      ];
      
      const emailIds = await this.searchEmails(searchCriteria);
      
      if (emailIds.length === 0) {
        console.log(`   📪 No emails found in date range for invoice date ${invoiceDate}`);
        return null;
      }
      
      console.log(`   📧 Found ${emailIds.length} email(s) in date range, searching for PDF with DocNum ${docNum}`);
      
      // Search through emails for PDF with matching filename
      for (const uid of emailIds) {
        const pdfPath = await this.extractPDFFromEmail(uid, docNum, series);
        if (pdfPath) {
          console.log(`   ✅ Found matching PDF: ${pdfPath}`);
          return pdfPath;
        }
      }
      
      console.log(`   ❌ No PDF found with filename containing DocNum ${docNum} in date range`);
      return null;
      
    } catch (error) {
      console.error(`   ❌ Error searching for PDF: ${error.message}`);
      return null;
    }
  }

  async searchEmails(criteria) {
    return new Promise((resolve, reject) => {
      this.emailMonitor.imap.search(criteria, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results || []);
        }
      });
    });
  }

  async extractPDFFromEmail(uid, docNum, series) {
    return new Promise((resolve, reject) => {
      const f = this.emailMonitor.imap.fetch(uid, { bodies: '' });

      f.on('message', (msg, seqno) => {
        let emailData = '';

        msg.on('body', (stream, info) => {
          stream.on('data', (chunk) => {
            emailData += chunk.toString('utf8');
          });
        });

        msg.once('end', async () => {
          try {
            const { simpleParser } = await import('mailparser');
            const parsed = await simpleParser(emailData);
            
            console.log(`     📧 Checking email: "${parsed.subject}"`);
            
            // Look for PDF attachments
            const pdfAttachments = parsed.attachments?.filter(
              att => att.contentType === 'application/pdf' || 
                     att.filename?.toLowerCase().endsWith('.pdf')
            ) || [];

            if (pdfAttachments.length === 0) {
              console.log('     📎 No PDF attachments found in this email');
              resolve(null);
              return;
            }

            console.log(`     📎 Found ${pdfAttachments.length} PDF attachment(s)`);
            
            // Search for PDF with filename containing the DocNum
            let matchingPdf = null;
            for (const attachment of pdfAttachments) {
              console.log(`       🔍 Checking PDF: ${attachment.filename}`);
              
              // Check if filename contains the DocNum
              if (attachment.filename && attachment.filename.includes(docNum.toString())) {
                console.log(`       ✅ MATCH! PDF ${attachment.filename} contains DocNum ${docNum}`);
                matchingPdf = attachment;
                break;
              }
            }

            if (!matchingPdf) {
              console.log(`     ❌ No PDF filename contains DocNum ${docNum}`);
              resolve(null);
              return;
            }

            // Save the matching PDF attachment with appropriate filename
            let finalFileName;
            
            // Series detection: 7 digits AND starts with 9 = Series 76
            const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
            
            if (isSeries76) {
              // For Series 76, rename to Comprobante_XXXXXXX.pdf
              finalFileName = `Comprobante_${docNum}.pdf`;
              console.log(`     🎯 Series 76 detected (7 digits, starts with 9) - renaming PDF to: ${finalFileName}`);
            } else {
              // For Series 4, keep original filename format
              finalFileName = matchingPdf.filename;
              console.log(`     📋 Series 4 detected - keeping original filename: ${finalFileName}`);
            }
            
            const tempFilePath = `./temp-pdfs/${finalFileName}`;
            
            // Ensure directory exists
            if (!fs.existsSync('./temp-pdfs')) {
              fs.mkdirSync('./temp-pdfs', { recursive: true });
            }
            
            fs.writeFileSync(tempFilePath, matchingPdf.content);
            console.log(`     💾 Saved matching PDF: ${tempFilePath}`);
            
            resolve(tempFilePath);

          } catch (parseError) {
            console.error('     ❌ Error parsing email:', parseError.message);
            resolve(null);
          }
        });
      });

      f.once('error', (err) => {
        console.error('❌ Error fetching email:', err);
        resolve(null);
      });
    });
  }

  async sendSalespersonNotification(invoice) {
    try {
      // Get salesperson code from invoice (assuming it's in SalesPersonCode field)
      if (!invoice.SalesPersonCode) {
        console.log(`   ⚠️ No salesperson code found for invoice ${invoice.DocNum}`);
        return;
      }

      // Get salesperson phone from environment variables
      const salesPersonPhone = process.env[`SALES_PERSON_${invoice.SalesPersonCode}`];
      if (!salesPersonPhone) {
        console.log(`   ⚠️ No phone configured for salesperson ${invoice.SalesPersonCode}`);
        return;
      }

      // Get friendly name from environment variables
      const friendlyName = process.env[`SALES_PERSON_NAME_${invoice.SalesPersonCode}`];
      const salesPersonName = friendlyName || `Código ${invoice.SalesPersonCode}`;

      console.log(`   👨‍💼 Sending notification to salesperson: ${salesPersonName} (${salesPersonPhone})`);

      // Generate salesperson message with delivery status
      const salespersonMessage = await this.generateSalespersonMessage(invoice, salesPersonName);

      // Send to salesperson (in test mode, this also goes to test phone)
      const phoneToUse = process.env.TEST_MODE === 'true' ? process.env.TEST_PHONE : salesPersonPhone;
      
      await this.whatsappService.sendMessage(phoneToUse, salespersonMessage);
      
      console.log(`   ✅ Salesperson notification sent to ${salesPersonName}`);

    } catch (error) {
      console.error(`   ❌ Error sending salesperson notification: ${error.message}`);
    }
  }

  generateWhatsAppMessage(invoice) {
    const lines = [];
    
    // Add test mode header if active
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
      lines.push('');
    }
    
    // Series detection based on DocNum: 7 digits AND starts with 9 = Series 76
    const docNum = invoice.DocNum.toString();
    const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
    
    // Determine message type based on detected Series
    if (isSeries76) {
      lines.push('📄 *NUEVO DOCUMENTO EMITIDO*');
      lines.push('');
      lines.push(`📋 Comprobante: *${invoice.DocNum}*`);
      console.log(`📄 Series 76 message generated for invoice ${docNum}`);
    } else {
      lines.push('🧾 *NUEVA FACTURA EMITIDA*');
      lines.push(`📋 Factura: *${invoice.DocNum}*`);
      console.log(`🧾 Series 4 message generated for invoice ${docNum}`);
    }
    
    lines.push(`👤 Cliente: ${invoice.CardName}`);
    lines.push(`💰 Total: $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
    lines.push(`📅 Fecha: ${invoice.DocDate}`);
    
    if (invoice.Comments && !isSeries76) {
      lines.push(`📝 Comentarios: ${invoice.Comments}`);
    }
    
    lines.push('');
    lines.push('📎 Adjunto encontrarás tu factura en PDF.');
    lines.push('');
    
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *Este es un mensaje de prueba*');
      lines.push('En producción iría al cliente real');
      lines.push('');
    }
    
    lines.push('Gracias por tu compra!');
    
    return lines.join('\n');
  }

  async generateSalespersonMessage(invoice, salespersonName) {
    const lines = [];
    
    // Add test mode header if active
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
      lines.push('');
    }
    
    // Series detection based on DocNum: 7 digits AND starts with 9 = Series 76
    const docNum = invoice.DocNum.toString();
    const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
    
    if (isSeries76) {
      // Series 76 - Salesperson message
      lines.push('📄 *NUEVO DOCUMENTO*');
      lines.push('');
      lines.push(`Hola ${salespersonName},`);
      lines.push('');
      lines.push(`Se ha emitido el siguiente comprobante de uso interno para el cliente ${invoice.CardName}:`);
      lines.push('');
      lines.push(`📋 **Comprobante Nº:** ${invoice.DocNum}`);
      lines.push(`📅 **Fecha:** ${invoice.DocDate}`);
      lines.push(`💰 **Total:** $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
      console.log(`📄 Series 76 salesperson message generated for ${salespersonName}`);
    } else {
      // Series 4 - Salesperson message
      lines.push('🧾 *NUEVA FACTURA EMITIDA*');
      lines.push('');
      lines.push(`Hola ${salespersonName},`);
      lines.push('');
      lines.push(`Se ha emitido la siguiente factura para el cliente ${invoice.CardName}:`);
      lines.push('');
      lines.push(`📋 **Factura Nº:** ${invoice.DocNum}`);
      lines.push(`📅 **Fecha:** ${invoice.DocDate}`);
      lines.push(`💰 **Total:** $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
      console.log(`🧾 Series 4 salesperson message generated for ${salespersonName}`);
    }
    
    // Get customer details to check email and phone status
    let deliveryStatus = '';
    try {
      console.log(`   📋 Fetching customer details for ${invoice.CardCode}...`);
      const customerResponse = await this.sapConnection.makeRequest(
        `/b1s/v1/BusinessPartners('${invoice.CardCode}')?$select=CardCode,CardName,EmailAddress,Cellular,Phone1`
      );
      
      const customer = customerResponse;
      const hasEmail = customer.EmailAddress && customer.EmailAddress.trim() !== '';
      const hasCellular = customer.Cellular && customer.Cellular.trim() !== '';
      
      console.log(`   📧 Email: ${hasEmail ? customer.EmailAddress : 'None'}`);
      console.log(`   📱 Cellular: ${hasCellular ? customer.Cellular : 'None'}`);
      
      // Determine delivery status based on available contact methods
      if (hasEmail && hasCellular) {
        deliveryStatus = `Este documento fue enviado al cliente al mail ${customer.EmailAddress}, y al numero ${customer.Cellular}`;
      } else if (hasEmail && !hasCellular) {
        deliveryStatus = `Este documento se envio al mail ${customer.EmailAddress}. El cliente no registra numero de celular`;
      } else if (!hasEmail && hasCellular) {
        deliveryStatus = `Este documento se envio al numero ${customer.Cellular}. El cliente no registra casilla de mail`;
      } else {
        deliveryStatus = `El cliente no registra mail ni numero de celular en su ficha. Por favor reenviar`;
      }
      
    } catch (error) {
      console.error(`   ❌ Error fetching customer details: ${error.message}`);
      deliveryStatus = `No se pudo verificar los datos de contacto del cliente. Por favor revisar manualmente`;
    }
    
    lines.push('');
    lines.push(`📞 **Estado de entrega:** ${deliveryStatus}`);
    lines.push('');
    lines.push('Si tiene alguna consulta, no dude en contactarnos.');
    lines.push('');
    lines.push('Saludos cordiales,');
    lines.push('Simsiroglu');
    
    if (process.env.TEST_MODE === 'true') {
      lines.push('');
      lines.push('🧪 *Este es un mensaje de prueba*');
      lines.push(`En producción iría al vendedor: ${salespersonName}`);
    }
    
    return lines.join('\n');
  }

  getCustomerPhone(invoice) {
    // 🚨 SAFETY CHECK: In test mode, ALWAYS use test phone
    if (process.env.TEST_MODE === 'true') {
      console.log(`🧪 TEST MODE: Using test phone instead of customer invoice phone`);
      return process.env.TEST_PHONE;
    }
    
    // Try to get phone from invoice data
    if (invoice.U_WhatsAppPhone && invoice.U_WhatsAppPhone.length >= 10) {
      return invoice.U_WhatsAppPhone;
    }
    
    // Could add logic here to look up customer phone in SAP
    // For now, return null and use admin phone
    return null;
  }

  async markInvoiceAsSent(docEntry) {
    try {
      const updateData = {
        U_WhatsAppSent: 'Y',
        U_WhatsAppDate: new Date().toISOString().split('T')[0],
        U_WhatsAppRetries: 1
      };
      
      await this.sapConnection.makeRequest(
        `/b1s/v1/Invoices(${docEntry})`,
        'PATCH',
        updateData
      );
      
      console.log(`   ✅ Marked invoice ${docEntry} as sent in SAP`);
      
    } catch (error) {
      console.error(`   ❌ Failed to mark invoice ${docEntry} as sent:`, error.message);
    }
  }

  async sendDailyReport() {
    if (this.missedInvoices.length === 0) {
      console.log('📧 No missed invoices to report today');
      return;
    }
    
    console.log(`📧 Sending daily report for ${this.missedInvoices.length} missed invoices`);
    
    try {
      // Send email report to ssimsi@gmail.com
      await this.emailReporter.sendDailyReport(this.missedInvoices);
      
      // Also send summary via WhatsApp to admin
      const whatsappSummary = [
        '📊 *REPORTE DIARIO*',
        `📅 ${new Date().toLocaleDateString('es-AR')}`,
        `📋 ${this.missedInvoices.length} facturas no enviadas`,
        '',
        '📧 Reporte detallado enviado a ssimsi@gmail.com',
        '',
        '� Revisar configuración del servicio'
      ].join('\n');
      
      await this.whatsappService.sendMessage(process.env.ADMIN_PHONE, whatsappSummary);
      
      // Clear missed invoices after reporting
      this.missedInvoices = [];
      
    } catch (error) {
      console.error('❌ Failed to send daily report:', error.message);
    }
  }

  async stop() {
    if (!this.isRunning) return;
    
    console.log('\n🛑 Stopping Hybrid Invoice Service...');
    
    try {
      if (this.emailMonitor) {
        this.emailMonitor.disconnect();
        console.log('📧 Email monitoring stopped');
      }
      
      if (this.whatsappService) {
        await this.whatsappService.stop();
        console.log('📱 WhatsApp service stopped');
      }
      
      if (this.pdfCleanupService) {
        this.pdfCleanupService.stop();
        console.log('🧹 PDF cleanup service stopped');
      }
      
      this.isRunning = false;
      console.log('✅ Hybrid service stopped gracefully');
      
    } catch (error) {
      console.error('❌ Error stopping service:', error.message);
    }
    
    process.exit(0);
  }
}

// Simple SAP connection class (reusing existing logic)
class SAPConnection {
  constructor() {
    this.sessionId = null;
    this.cookies = null;
  }

  async login() {
    console.log('🔐 Logging into SAP...');
    
    const loginData = JSON.stringify({
      CompanyDB: process.env.VITE_SAP_DATABASE,
      UserName: process.env.VITE_SAP_USERNAME,
      Password: process.env.VITE_SAP_PASSWORD
    });

    const options = {
      hostname: 'b1.ativy.com',
      port: 50685,
      path: '/b1s/v1/Login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      },
      rejectUnauthorized: false,
      timeout: 30000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const data = JSON.parse(responseBody);
              this.sessionId = data.SessionId;
              this.cookies = res.headers['set-cookie'];
              console.log('✅ SAP login successful!');
              resolve(true);
            } else {
              console.error('❌ SAP login failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ SAP login error:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ SAP login request failed:', error.message);
        resolve(false);
      });

      req.write(loginData);
      req.end();
    });
  }

  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'b1.ativy.com',
        port: 50685,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': this.cookies ? this.cookies.join('; ') : ''
        },
        rejectUnauthorized: false,
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const responseData = JSON.parse(responseBody);
              resolve(responseData);
            } else {
              console.error(`❌ Request failed (${res.statusCode}):`, responseBody);
              reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
            }
          } catch (error) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseBody);
            } else {
              reject(error);
            }
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }
}

// Start the service if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new HybridInvoiceService();
  service.start().catch(console.error);
}

export default HybridInvoiceService;
