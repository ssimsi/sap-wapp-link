// WhatsApp Invoice Service - Main Integration
// Connects SAP Business One to WhatsApp for automated invoice delivery

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import cron from 'node-cron';

// Load environment variables
dotenv.config({ path: '.env.local' });

// SAP Configuration (using your existing setup)
const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  baseUrl: 'https://b1.ativy.com:50685/b1s/v1',
  database: process.env.VITE_SAP_DATABASE,
  username: process.env.VITE_SAP_USERNAME || 'ssimsi',
  password: process.env.VITE_SAP_PASSWORD || 'Sim1234$'
};

// WhatsApp Service Class
class WhatsAppInvoiceService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.sessionId = null;
    this.cookies = null;
    this.sessionExpiry = null;
    
    // Tracking
    this.invoicesSent = 0;
    this.failedDeliveries = [];
    this.lastCheck = null;
    
    // Admin notifications
    this.adminPhone = process.env.ADMIN_PHONE;
    this.enableAdminNotifications = process.env.ENABLE_ADMIN_NOTIFICATIONS === 'true';
    
    console.log('🔧 WhatsApp Invoice Service initialized');
    console.log(`📱 Admin notifications: ${this.enableAdminNotifications ? 'enabled' : 'disabled'}`);
  }

  // Initialize WhatsApp client
  async initializeWhatsApp() {
    console.log('📱 Initializing WhatsApp client...');
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: process.env.WHATSAPP_SESSION_PATH || './whatsapp-session'
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

    // Event handlers
    this.client.on('qr', (qr) => {
      console.log('📱 WhatsApp QR Code:');
      qrcode.generate(qr, { small: true });
      console.log('👆 Scan this QR code with your WhatsApp mobile app');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready!');
      this.isReady = true;
      this.sendAdminNotification('🚀 WhatsApp Invoice Service is now online and ready to send invoices!');
    });

    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authenticated successfully');
    });

    this.client.on('disconnected', (reason) => {
      console.log('❌ WhatsApp disconnected:', reason);
      this.isReady = false;
      this.sendAdminNotification('⚠️ WhatsApp disconnected. Please restart the service.');
    });

    this.client.on('message', async (message) => {
      // Optional: Handle incoming messages (like delivery confirmations)
      if (message.body.toLowerCase().includes('recibido') || 
          message.body.toLowerCase().includes('gracias')) {
        console.log(`📨 Customer acknowledgment: ${message.from} - ${message.body}`);
      }
    });

    // Initialize the client
    await this.client.initialize();
  }

  // SAP Authentication (using your existing method)
  async loginToSAP() {
    if (this.sessionId && this.sessionExpiry && Date.now() < this.sessionExpiry) {
      console.log('✅ Using existing SAP session');
      return true;
    }

    console.log('🔐 Logging into SAP B1 Service Layer...');

    const loginData = JSON.stringify({
      CompanyDB: SAP_CONFIG.database,
      UserName: SAP_CONFIG.username,
      Password: SAP_CONFIG.password
    });

    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/Login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      },
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
              const jsonResponse = JSON.parse(responseBody);
              this.sessionId = jsonResponse.SessionId;
              this.cookies = res.headers['set-cookie'];
              
              // Set expiry to 25 minutes
              this.sessionExpiry = Date.now() + (25 * 60 * 1000);
              
              console.log(`✅ SAP login successful! Session: ${this.sessionId}`);
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

      req.on('timeout', () => {
        console.error('⏰ SAP login timed out');
        req.destroy();
        resolve(false);
      });

      req.write(loginData);
      req.end();
    });
  }

  // Make SAP API request
  async sapRequest(path, method = 'GET', body = null) {
    const loginSuccess = await this.loginToSAP();
    if (!loginSuccess) {
      throw new Error('Failed to authenticate with SAP');
    }

    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: `/b1s/v1${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; ')
      },
      timeout: 30000
    };

    if (body) {
      const bodyData = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              if (res.statusCode === 204 || responseBody.trim() === '') {
                resolve(null);
              } else {
                const jsonResponse = JSON.parse(responseBody);
                resolve(jsonResponse);
              }
            } else {
              reject(new Error(`SAP API error: ${res.statusCode} - ${responseBody}`));
            }
          } catch (error) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseBody);
            } else {
              reject(new Error(`SAP API error: ${res.statusCode} - ${responseBody}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`SAP request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('SAP request timed out'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  // Get pending invoices that need WhatsApp delivery
  async getPendingInvoices() {
    console.log('🔍 Scanning for pending invoices...');
    
    try {
      // SAFETY FILTER: Only process invoices from configured date onwards to avoid sending thousands of old invoices
      const fromDate = process.env.PROCESS_INVOICES_FROM_DATE || new Date().toISOString().split('T')[0];
      
      // Build and encode the query filter
      const filterQuery = `(U_WhatsAppSent eq 'N' or U_WhatsAppSent eq null) and DocDate ge '${fromDate}'`;
      const encodedFilter = encodeURIComponent(filterQuery);
      const query = `/Invoices?$filter=${encodedFilter}&$top=20`;
      
      console.log(`📅 Safety filter: Only processing invoices from ${fromDate} onwards`);
      console.log(`🔍 Filter: ${filterQuery}`);
      
      const response = await this.sapRequest(query);
      
      if (!response || !response.value) {
        console.log('📄 No pending invoices found');
        return [];
      }

      console.log(`📄 Found ${response.value.length} recent pending invoices`);
      
      // Get customer details for each invoice
      const invoicesWithCustomers = [];
      
      for (const invoice of response.value) {
        try {
          // Get customer details with all phone fields
          const customerResponse = await this.sapRequest(`/BusinessPartners('${invoice.CardCode}')`);
          
          if (customerResponse) {
            // Always include the invoice, even if no mobile number
            // We'll mark it as "sent" to prevent future bulk sending
            invoicesWithCustomers.push({
              ...invoice,
              customer: customerResponse
            });
            
            console.log(`📋 Invoice ${invoice.DocNum} for ${invoice.CardName}: Mobile = ${customerResponse.Cellular || 'None'}`);
          }
        } catch (customerError) {
          console.error(`❌ Error fetching customer ${invoice.CardCode}:`, customerError.message);
        }
      }

      return invoicesWithCustomers;

    } catch (error) {
      console.error('❌ Error fetching pending invoices:', error.message);
      return [];
    }
  }

  // Format phone number for WhatsApp (using Cellular field only)
  formatWhatsAppNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Skip if too short (less than 8 digits)
    if (cleaned.length < 8) {
      return null;
    }
    
    // Add country code if missing (assuming Argentina +54)
    if (cleaned.length === 10 && cleaned.startsWith('11')) {
      cleaned = '54' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '549' + cleaned;
    } else if (cleaned.length === 11 && !cleaned.startsWith('54')) {
      cleaned = '54' + cleaned;
    }
    
    // Format for WhatsApp (with @c.us suffix)
    return cleaned + '@c.us';
  }

  // Get sales person details for an invoice
  async getSalesPersonDetails(salesPersonCode) {
    if (!salesPersonCode || salesPersonCode === -1) {
      return null;
    }

    try {
      const response = await this.sapRequest(`/SalesPersons(${salesPersonCode})`);
      return response;
    } catch (error) {
      console.error(`❌ Error fetching sales person ${salesPersonCode}:`, error.message);
      return null;
    }
  }

  // Get sales person WhatsApp number from environment
  getSalesPersonWhatsApp(salesPersonCode) {
    // Check for specific sales person phone number
    const specificPhone = process.env[`SALES_PERSON_${salesPersonCode}`];
    if (specificPhone) {
      return this.formatWhatsAppNumber(specificPhone);
    }

    // Fallback to default sales person number
    const defaultPhone = process.env.SALES_PERSON_DEFAULT;
    if (defaultPhone) {
      return this.formatWhatsAppNumber(defaultPhone);
    }

    return null;
  }

  // Send sales person notification
  async sendSalesPersonNotification(invoice, salesPerson, customerSent) {
    if (!this.isReady) {
      console.log(`⚠️ WhatsApp not ready - skipping sales person notification`);
      return false;
    }

    const salesPersonWhatsApp = this.getSalesPersonWhatsApp(invoice.SalesPersonCode);
    if (!salesPersonWhatsApp) {
      console.log(`⚠️ No WhatsApp number configured for sales person ${invoice.SalesPersonCode}`);
      return false;
    }

    try {
      const status = customerSent ? '✅ ENVIADA' : '⚠️ NO ENVIADA (sin móvil)';
      
      // Get friendly name from environment variables
      const friendlyName = process.env[`SALES_PERSON_NAME_${invoice.SalesPersonCode}`];
      const salesPersonName = friendlyName || (salesPerson ? salesPerson.SalesEmployeeName : `Código ${invoice.SalesPersonCode}`);
      
      // Generate message based on series
      let message;
      if (invoice.Series === 4) {
        // Series 4 message
        message = `
🧾 *NUEVA FACTURA ELECTRÓNICA*

Hola ${salesPersonName},

Se ha emitido la siguiente factura para el cliente ${invoice.CardName}:

📋 **Factura Nº:** ${invoice.DocNum}
📅 **Fecha:** ${invoice.DocDate}
💰 **Total:** $${invoice.DocTotal} ${invoice.DocCurrency}

Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Simsiroglu
        `.trim();
      } else if (invoice.Series === 76) {
        // Series 76 message
        message = `
📄 *NUEVO DOCUMENTO*

Hola ${salesPersonName},

Se ha emitido el siguiente comprobante de uso interno para el cliente ${invoice.CardName}:

📋 **Comprobante Nº:** ${invoice.DocNum}
📅 **Fecha:** ${invoice.DocDate}
💰 **Total:** $${invoice.DocTotal} ${invoice.DocCurrency}

Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Simsiroglu
        `.trim();
      } else {
        // Default message for other series
        message = `
🧾 *NUEVA FACTURA ELECTRÓNICA*

Hola ${salesPersonName},

Se ha emitido la siguiente factura para el cliente ${invoice.CardName}:

📋 **Factura Nº:** ${invoice.DocNum}
📅 **Fecha:** ${invoice.DocDate}
💰 **Total:** $${invoice.DocTotal} ${invoice.DocCurrency}

Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Simsiroglu
        `.trim();
      }

      await this.client.sendMessage(salesPersonWhatsApp, message);
      console.log(`✅ Sales person notification sent to ${salesPersonName} (${salesPersonWhatsApp})`);
      
      return true;

    } catch (error) {
      console.error(`❌ Failed to send sales person notification:`, error.message);
      return false;
    }
  }
  getCustomerMobilePhone(customer) {
    // 🚨 SAFETY CHECK: In test mode, ALWAYS use test phone
    if (process.env.TEST_MODE === 'true') {
      console.log(`🧪 TEST MODE: Using test phone instead of customer ${customer.CardCode} Cellular field`);
      return process.env.TEST_PHONE;
    }
    
    // Only use the Cellular field - ignore Phone1 and Phone2
    const mobile = customer.Cellular;
    
    if (!mobile || mobile.trim() === '') {
      console.log(`⚠️ Customer ${customer.CardCode} has no mobile phone number in Cellular field`);
      return null;
    }
    
    return this.formatWhatsAppNumber(mobile);
  }

  // Generate invoice PDF (placeholder - you'll need to implement based on your SAP setup)
  async generateInvoicePDF(invoice) {
    console.log(`📄 Generating PDF for invoice ${invoice.DocNum}...`);
    
    try {
      // Option 1: Use SAP's built-in PDF generation
      const pdfQuery = `/Invoices(${invoice.DocEntry})/GetPDF`;
      const pdfResponse = await this.sapRequest(pdfQuery);
      
      if (pdfResponse) {
        // Save PDF to local file
        const invoiceDir = process.env.INVOICE_PDF_PATH || './invoices';
        await fs.mkdir(invoiceDir, { recursive: true });
        
        const filename = `invoice_${invoice.DocNum}_${Date.now()}.pdf`;
        const filepath = path.join(invoiceDir, filename);
        
        // Convert base64 to buffer and save
        const pdfBuffer = Buffer.from(pdfResponse, 'base64');
        await fs.writeFile(filepath, pdfBuffer);
        
        console.log(`✅ PDF saved: ${filepath}`);
        return filepath;
      }
      
      // Option 2: Fallback to creating a simple text receipt
      return await this.createSimpleInvoiceText(invoice);
      
    } catch (error) {
      console.error(`❌ Error generating PDF for invoice ${invoice.DocNum}:`, error.message);
      return await this.createSimpleInvoiceText(invoice);
    }
  }

  // Create simple text invoice (fallback)
  async createSimpleInvoiceText(invoice) {
    const invoiceText = `
🧾 FACTURA ELECTRÓNICA
━━━━━━━━━━━━━━━━━━━━━━

📋 Número: ${invoice.DocNum}
📅 Fecha: ${invoice.DocDate}
👤 Cliente: ${invoice.CardName}

💰 Total: $${invoice.DocTotal}
💱 Moneda: ${invoice.DocCurrency}

━━━━━━━━━━━━━━━━━━━━━━
${process.env.COMPANY_NAME || 'Tu Empresa'}
📧 Consultas: ${process.env.CONTACT_EMAIL || 'info@tuempresa.com'}
`;

    const invoiceDir = process.env.INVOICE_PDF_PATH || './invoices';
    await fs.mkdir(invoiceDir, { recursive: true });
    
    const filename = `invoice_${invoice.DocNum}_${Date.now()}.txt`;
    const filepath = path.join(invoiceDir, filename);
    
    await fs.writeFile(filepath, invoiceText, 'utf8');
    
    return filepath;
  }

  // Generate message based on invoice series (Series 4 vs Series 76)
  generateInvoiceMessage(invoice) {
    const isSeries4 = invoice.Series === 4;
    const isSeries76 = invoice.Series === 76;
    
    if (isSeries4) {
      // Message for Series 4
      return `
🧾 *NUEVA FACTURA ELECTRÓNICA*

Estimado/a ${invoice.customer.CardName},

Le enviamos su factura electrónica:

📋 **Factura Nº:** ${invoice.DocNum}
📅 **Fecha:** ${invoice.DocDate}
💰 **Total:** $${invoice.DocTotal} ${invoice.DocCurrency}

Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Simsiroglu
      `.trim();
    } else if (isSeries76) {
      // Message for Series 76
      return `
📄 *NUEVO DOCUMENTO*

Estimado/a ${invoice.customer.CardName},

Le enviamos su comprobante de uso interno:

📋 **Comprobante Nº:** ${invoice.DocNum}
📅 **Fecha:** ${invoice.DocDate}
💰 **Total:** $${invoice.DocTotal} ${invoice.DocCurrency}

Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Simsiroglu
      `.trim();
    } else {
      // Default message for other series
      return `
🧾 *NUEVA FACTURA ELECTRÓNICA*

Estimado/a ${invoice.customer.CardName},

Le enviamos su factura electrónica:

📋 **Factura Nº:** ${invoice.DocNum}
📅 **Fecha:** ${invoice.DocDate}
💰 **Total:** $${invoice.DocTotal} ${invoice.DocCurrency}

Si tiene alguna consulta, no dude en contactarnos.

Saludos cordiales,
Simsiroglu
      `.trim();
    }
  }

  // Send invoice via WhatsApp (or mark as sent if no mobile number)
  async sendInvoiceWhatsApp(invoice, filePath) {
    console.log(`📋 Processing invoice ${invoice.DocNum} for ${invoice.customer.CardName}...`);

    // Get mobile phone number (Cellular field only)
    const whatsappNumber = this.getCustomerMobilePhone(invoice.customer);
    
    if (!whatsappNumber) {
      console.log(`⚠️ No valid mobile number for ${invoice.customer.CardName} - marking as sent to prevent future bulk processing`);
      
      // Mark as sent even without mobile number to prevent bulk sending when they update their number
      await this.updateInvoiceWhatsAppStatus(invoice.DocEntry, 'Y', null, 'No mobile phone number in Cellular field');
      
      return false; // Not actually sent, but marked as processed
    }

    if (!this.isReady) {
      console.log(`⚠️ WhatsApp not ready - marking invoice as failed`);
      await this.updateInvoiceWhatsAppStatus(invoice.DocEntry, 'N', whatsappNumber, 'WhatsApp client not ready');
      throw new Error('WhatsApp client is not ready');
    }

    console.log(`📱 Sending invoice ${invoice.DocNum} to ${whatsappNumber}...`);

    try {
      // Prepare message based on series
      const message = this.generateInvoiceMessage(invoice);

      // Send text message first
      await this.client.sendMessage(whatsappNumber, message);

      // Send file if available
      if (filePath) {
        const media = MessageMedia.fromFilePath(filePath);
        await this.client.sendMessage(whatsappNumber, media);
      }

      console.log(`✅ Invoice ${invoice.DocNum} sent successfully to ${whatsappNumber}`);
      
      // Update invoice status in SAP
      await this.updateInvoiceWhatsAppStatus(invoice.DocEntry, 'Y', whatsappNumber);
      
      this.invoicesSent++;
      
      return true;

    } catch (error) {
      console.error(`❌ Failed to send invoice ${invoice.DocNum}:`, error.message);
      
      // Mark as failed in SAP
      await this.updateInvoiceWhatsAppStatus(invoice.DocEntry, 'N', whatsappNumber, error.message);
      
      // Track failed delivery
      this.failedDeliveries.push({
        invoice: invoice.DocNum,
        customer: invoice.customer.CardName,
        phone: whatsappNumber,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  // Update invoice WhatsApp status in SAP
  async updateInvoiceWhatsAppStatus(docEntry, status, phone = null, error = null) {
    try {
      const updateData = {
        U_WhatsAppSent: status,
        U_WhatsAppDate: new Date().toISOString()
      };

      // Add phone number if provided
      if (phone) {
        updateData.U_WhatsAppPhone = phone;
      }

      // Add error message if provided (truncate to fit field size)
      if (error) {
        updateData.U_WhatsAppError = error.substring(0, 250);
      }

      await this.sapRequest(`/Invoices(${docEntry})`, 'PATCH', updateData);
      console.log(`✅ Updated invoice ${docEntry} WhatsApp status to ${status}`);
    } catch (error) {
      console.error(`❌ Failed to update invoice status:`, error.message);
    }
  }

  // Send admin notification
  async sendAdminNotification(message) {
    if (!this.enableAdminNotifications || !this.adminPhone || !this.isReady) {
      return;
    }

    try {
      const adminWhatsApp = this.formatWhatsAppNumber(this.adminPhone);
      await this.client.sendMessage(adminWhatsApp, `🤖 ${message}`);
    } catch (error) {
      console.error('❌ Failed to send admin notification:', error.message);
    }
  }

  // Main process - check for new invoices and send them
  async processInvoices() {
    console.log('🔄 Starting invoice processing cycle...');
    this.lastCheck = new Date().toISOString();

    try {
      if (!this.isReady) {
        console.warn('⚠️ WhatsApp client not ready, skipping cycle');
        return;
      }

      const pendingInvoices = await this.getPendingInvoices();
      
      if (pendingInvoices.length === 0) {
        console.log('✅ No pending invoices to send');
        return;
      }

      console.log(`📄 Processing ${pendingInvoices.length} pending invoices...`);

      for (const invoice of pendingInvoices) {
        try {
          // Get sales person details
          const salesPerson = await this.getSalesPersonDetails(invoice.SalesPersonCode);
          console.log(`👤 Sales person: ${salesPerson ? salesPerson.SalesEmployeeName : 'Unknown'} (${invoice.SalesPersonCode})`);
          
          // Generate PDF/document
          const filePath = await this.generateInvoicePDF(invoice);
          
          // Send via WhatsApp to customer
          const customerSent = await this.sendInvoiceWhatsApp(invoice, filePath);
          
          // Send notification to sales person
          await this.sendSalesPersonNotification(invoice, salesPerson, customerSent);
          
          // Small delay between messages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (invoiceError) {
          console.error(`❌ Failed to process invoice ${invoice.DocNum}:`, invoiceError.message);
        }
      }

      // Send summary to admin
      if (this.invoicesSent > 0 || this.failedDeliveries.length > 0) {
        const summary = `📊 Resumen de envío de facturas:
✅ Enviadas: ${this.invoicesSent}
❌ Fallidas: ${this.failedDeliveries.length}`;
        
        await this.sendAdminNotification(summary);
      }

    } catch (error) {
      console.error('❌ Error in invoice processing cycle:', error.message);
      await this.sendAdminNotification(`❌ Error en el procesamiento de facturas: ${error.message}`);
    }
  }

  // Start the service
  async start() {
    console.log('🚀 Starting WhatsApp Invoice Service...');
    
    try {
      // Initialize WhatsApp
      await this.initializeWhatsApp();
      
      // Wait for WhatsApp to be ready
      while (!this.isReady) {
        console.log('⏳ Waiting for WhatsApp to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Schedule invoice processing every hour
      const interval = process.env.INVOICE_CHECK_INTERVAL || 3600000; // 1 hour default
      cron.schedule('0 * * * *', () => {
        this.processInvoices();
      });

      console.log(`⏰ Scheduled invoice processing every hour`);
      
      // Run first check immediately
      setTimeout(() => {
        this.processInvoices();
      }, 5000);

      console.log('✅ WhatsApp Invoice Service is running!');
      
    } catch (error) {
      console.error('❌ Failed to start service:', error.message);
      process.exit(1);
    }
  }

  // Get service status
  getStatus() {
    return {
      whatsappReady: this.isReady,
      sapConnected: this.sessionId !== null,
      invoicesSent: this.invoicesSent,
      failedDeliveries: this.failedDeliveries.length,
      lastCheck: this.lastCheck,
      uptime: process.uptime()
    };
  }
}

// Initialize and start the service
const service = new WhatsAppInvoiceService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down WhatsApp Invoice Service...');
  
  if (service.client) {
    await service.client.destroy();
  }
  
  console.log('✅ Service stopped gracefully');
  process.exit(0);
});

// Start the service
service.start().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});

export default service;
