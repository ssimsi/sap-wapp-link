import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import EmailInvoiceMonitor from './email-invoice-monitor.js';
import EmailReporter from './email-reporter.js';
import PDFCleanupService from './pdf-cleanup-service.js';
import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

// Load environment variables
dotenv.config({ path: '.env.local' });

class HybridInvoiceService {
  constructor() {
    this.whatsappClient = null;
    this.whatsappReady = false;
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
      await this.initializeWhatsApp();
      
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
      
      // Schedule invoice processing every hour at X:50
      cron.schedule('50 * * * *', () => {
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

  async initializeWhatsApp() {
    console.log('🔧 Initializing WhatsApp Web client...');
    
    this.whatsappClient = new Client({
      authStrategy: new LocalAuth({
        clientId: 'hybrid-service'
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

    // QR Code for authentication
    this.whatsappClient.on('qr', (qr) => {
      console.log('\n📱 WhatsApp Web QR Code:');
      console.log('👆 Scan this QR code with your WhatsApp mobile app');
      console.log('📱 Open WhatsApp > Settings > Linked Devices > Link a Device');
      console.log('📷 Point your camera at this QR code:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Waiting for QR code scan...\n');
    });

    // Ready event
    this.whatsappClient.on('ready', () => {
      console.log('✅ WhatsApp Web client is ready!');
      this.whatsappReady = true;
    });

    // Authentication events
    this.whatsappClient.on('authenticated', () => {
      console.log('🔐 WhatsApp authentication successful');
    });

    this.whatsappClient.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
    });

    // Disconnection event
    this.whatsappClient.on('disconnected', (reason) => {
      console.log('📱 WhatsApp disconnected:', reason);
      this.whatsappReady = false;
    });

    // Initialize the client
    await this.whatsappClient.initialize();
    
    // Wait for ready state
    await this.waitForWhatsAppReady();
  }

  async waitForWhatsAppReady() {
    return new Promise((resolve) => {
      if (this.whatsappReady) {
        resolve();
        return;
      }

      const checkReady = () => {
        if (this.whatsappReady) {
          resolve();
        } else {
          setTimeout(checkReady, 1000);
        }
      };

      checkReady();
    });
  }

  async sendWhatsAppMessage(phoneNumber, message, pdfPath = null) {
    if (!this.whatsappReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Format phone number for WhatsApp
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;

      console.log(`📱 Sending WhatsApp message to ${phoneNumber}...`);
      console.log(`🔍 DEBUG: pdfPath provided: ${pdfPath}`);
      console.log(`🔍 DEBUG: pdfPath exists: ${pdfPath ? fs.existsSync(pdfPath) : 'No path provided'}`);

      // If PDF is provided, send PDF with text as caption in ONE message
      if (pdfPath && fs.existsSync(pdfPath)) {
        console.log(`📎 Sending PDF with caption as single message: ${path.basename(pdfPath)}`);
        console.log(`📄 PDF file size: ${fs.statSync(pdfPath).size} bytes`);
        console.log(`📝 Caption text: ${message}`);
        
        // Create MessageMedia object from file path
        const media = MessageMedia.fromFilePath(pdfPath);
        console.log(`🔍 Media object created, mimetype: ${media.mimetype}`);
        
        // Send PDF with caption using the options parameter (THIS is what worked before)
        console.log(`� Sending PDF with caption using options parameter...`);
        const result = await this.whatsappClient.sendMessage(chatId, media, { caption: message });
        console.log(`✅ PDF with caption sent successfully to ${phoneNumber}`);
        console.log(`🔍 Send result:`, result ? 'Success' : 'Unknown');
        
      } else {
        // If no PDF, just send text message
        console.log(`📝 Sending text-only message (no PDF provided)...`);
        const result = await this.whatsappClient.sendMessage(chatId, message);
        console.log(`✅ Text message sent to ${phoneNumber}`);
        console.log(`🔍 Send result:`, result ? 'Success' : 'Unknown');
      }

      return true;

    } catch (error) {
      console.error(`❌ Failed to send WhatsApp message to ${phoneNumber}:`, error.message);
      console.log(`🔍 DEBUG: Error details:`, error);
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
    
    // 1. CRITICAL: Search for PDF FIRST - no PDF = no processing at all
    const pdfPath = await this.findInvoicePDF(invoice.DocNum, invoice.DocDate, invoice.Series);
    
    if (!pdfPath) {
      console.log(`🚫 CRITICAL: No PDF found for invoice ${invoice.DocNum} - STOPPING ALL PROCESSING`);
      console.log(`📋 NO WhatsApp messages will be sent (customer OR salesperson)`);
      this.missedInvoices.push({
        invoice,
        error: 'PDF not found - no processing done',
        timestamp: new Date()
      });
      return;
    }
    
    console.log(`✅ PDF found for invoice ${invoice.DocNum} - proceeding with message generation`);
    
    // 2. Generate WhatsApp message from SAP data
    const whatsappMessage = this.generateWhatsAppMessage(invoice);
    
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
      await this.sendSalespersonNotification(invoice, pdfPath);
      
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
      await this.sendWhatsAppMessage(phoneToUse, whatsappMessage, pdfPath);
      
      // 5. Mark as sent in SAP
      await this.markInvoiceAsSent(invoice.DocEntry);
      
      // 6. Send salesperson notification
      await this.sendSalespersonNotification(invoice, pdfPath);
      
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
    console.log(`   🔍 Searching downloaded PDFs folder ONLY for DocNum: ${docNum}`);
    console.log(`   📅 Invoice date: ${invoiceDate}, Series: ${series}`);
    
    try {
      // ONLY search in downloaded folder - NO EMAIL SEARCH!
      const localPdfPath = await this.findPDFInDownloadedFolder(docNum, series);
      if (localPdfPath) {
        console.log(`   ✅ Found PDF in downloaded folder: ${localPdfPath}`);
        return localPdfPath;
      }
      
      console.log(`   ❌ PDF not found in downloaded folder for DocNum ${docNum}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error searching downloaded PDFs for ${docNum}:`, error.message);
      return null;
    }
  }

  async findPDFInDownloadedFolder(docNum, series) {
    const downloadedPdfFolder = './downloaded-pdfs';
    
    try {
      // Check if downloaded-pdfs folder exists
      if (!fs.existsSync(downloadedPdfFolder)) {
        console.log(`   📁 Downloaded PDFs folder does not exist: ${downloadedPdfFolder}`);
        return null;
      }
      
      // Get all PDF files in the folder
      const files = fs.readdirSync(downloadedPdfFolder);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      
      console.log(`   📄 Searching through ${pdfFiles.length} downloaded PDFs for DocNum ${docNum}`);
      
      // Search for PDF containing the DocNum in filename
      for (const pdfFile of pdfFiles) {
        // Extract the original filename from timestamped filename
        // Format: "2025-08-15T14-30-00-123Z_original-filename.pdf"
        const originalName = pdfFile.includes('_') ? pdfFile.split('_').slice(1).join('_') : pdfFile;
        
        console.log(`     🔍 Checking: ${originalName} for DocNum ${docNum}`);
        
        if (originalName.includes(docNum)) {
          const fullPath = path.join(downloadedPdfFolder, pdfFile);
          console.log(`     ✅ MATCH FOUND! PDF ${originalName} contains DocNum ${docNum}`);
          
          // Copy to temp-pdfs folder with proper naming for the hybrid service
          const tempPdfFolder = './temp-pdfs';
          if (!fs.existsSync(tempPdfFolder)) {
            fs.mkdirSync(tempPdfFolder, { recursive: true });
          }
          
          // Generate final filename based on series
          let finalFileName;
          const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
          
          if (isSeries76) {
            finalFileName = `Comprobante_${docNum}.pdf`;
            console.log(`     🎯 Series 76 detected - renaming to: ${finalFileName}`);
          } else {
            finalFileName = originalName;
            console.log(`     📋 Series 4 detected - keeping original name: ${finalFileName}`);
          }
          
          const finalPath = path.join(tempPdfFolder, finalFileName);
          
          // Copy the file to temp folder
          fs.copyFileSync(fullPath, finalPath);
          console.log(`     💾 Copied PDF to: ${finalPath}`);
          
          return finalPath;
        }
      }
      
      console.log(`   ❌ No downloaded PDF found with DocNum ${docNum}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error searching downloaded PDFs folder:`, error.message);
      return null;
    }
  }

  async sendSalespersonNotification(invoice, pdfPath = null) {
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
      
      await this.sendWhatsAppMessage(phoneToUse, salespersonMessage, pdfPath);
      
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
    
    // Deduplicate missed invoices by DocNum, keeping the latest error for each invoice
    const seenInvoices = new Set();
    const uniqueMissedInvoices = [];
    
    // Process in reverse order to get the latest error for each invoice
    for (let i = this.missedInvoices.length - 1; i >= 0; i--) {
      const item = this.missedInvoices[i];
      const docNum = item.invoice.DocNum;
      
      if (!seenInvoices.has(docNum)) {
        seenInvoices.add(docNum);
        uniqueMissedInvoices.unshift(item); // Add to beginning to maintain chronological order
      }
    }
    
    console.log(`📧 Sending daily report: ${this.missedInvoices.length} total errors, ${uniqueMissedInvoices.length} unique invoices`);
    
    try {
      // Send email report to ssimsi@gmail.com with deduplicated invoices
      await this.emailReporter.sendDailyReport(uniqueMissedInvoices);
      
      // Also send summary via WhatsApp to admin
      const whatsappSummary = [
        '📊 *REPORTE DIARIO*',
        `📅 ${new Date().toLocaleDateString('es-AR')}`,
        `📋 ${uniqueMissedInvoices.length} facturas no enviadas (de ${this.missedInvoices.length} errores totales)`,
        '',
        '📧 Reporte detallado enviado a ssimsi@gmail.com',
        '',
        '⚙️ Revisar configuración del servicio'
      ].join('\n');
      
      await this.sendWhatsAppMessage(process.env.ADMIN_PHONE, whatsappSummary);
      
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
      
      if (this.whatsappClient) {
        console.log('🛑 Stopping WhatsApp client...');
        await this.whatsappClient.destroy();
        this.whatsappReady = false;
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
