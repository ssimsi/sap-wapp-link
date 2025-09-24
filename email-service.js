/**
 * Email Service for Invoice Delivery
 * 
 * WORKFLOW:
 * 1. PDFs are first downloaded to downloaded-pdfs/ORIGINALS/
 * 2. rename-invoice-pdfs.cjs processes them and moves to downloaded-pdfs/ with proper names
 * 3. This email-service.js processes the renamed PDFs from downloaded-pdfs/
 * 4. Matches with SAP using FolioNumber and sends via email
 * 5. Marks U_EmailSent = 'Y' in SAP when successfully sent
 */

import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import axios from 'axios';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    // Process PDFs from downloaded-pdfs folder (after rename-invoice-pdfs processing)
    // Workflow: ORIGINALS → rename-invoice-pdfs → downloaded-pdfs → email-service
    this.downloadsFolder = path.join(__dirname, 'downloaded-pdfs');
    this.originalsFolder = path.join(__dirname, 'downloaded-pdfs', 'ORIGINALS');
    this.sapConnection = null;
    this.emailTransporter = null;
    this.sapSessionId = null;
    
    // SAP Configuration from env.local
    this.sapConfig = {
      serviceLayerUrl: 'https://b1.ativy.com:50685/b1s/v1',
      database: 'PRDSHK',
      username: 'ssimsi',
      password: 'Sim1234$'
    };
    
    this.initializeEmailTransporter();
  }

  initializeEmailTransporter() {
    // Email configuration from env.local
    this.emailTransporter = nodemailer.createTransport({
      host: 'mail.simsiroglu.com.ar',
      port: 465,
      secure: true, // SSL/TLS
      auth: {
        user: 'no_responder@simsiroglu.com.ar',
        pass: 'Larrea*551'
      }
    });
  }

  async initializeSapConnection() {
    try {
      console.log('🔗 Connecting to SAP B1 Service Layer...');
      
      const loginUrl = `${this.sapConfig.serviceLayerUrl}/Login`;
      const loginData = {
        CompanyDB: this.sapConfig.database,
        UserName: this.sapConfig.username,
        Password: this.sapConfig.password
      };

      const response = await axios.post(loginUrl, loginData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });

      this.sapSessionId = response.data.SessionId;
      console.log('✅ SAP connection established');
      
      // Store session for subsequent requests
      this.sapConnection = axios.create({
        baseURL: this.sapConfig.serviceLayerUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': `B1SESSION=${this.sapSessionId}`
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      });
      
    } catch (error) {
      console.error('❌ SAP connection failed:', error.message);
      throw error;
    }
  }

  async getProcessedPDFs() {
    try {
      const files = fs.readdirSync(this.downloadsFolder);
      const pdfFiles = files.filter(file => 
        file.endsWith('.pdf') && 
        fs.statSync(path.join(this.downloadsFolder, file)).isFile() &&
        file !== 'ORIGINALS' // Skip the ORIGINALS folder
      );
      
      console.log(`📁 Found ${pdfFiles.length} processed PDF files in downloaded-pdfs folder`);
      console.log(`📋 Processing workflow: ORIGINALS → rename-invoice-pdfs → downloaded-pdfs → email-service`);
      return pdfFiles.map(file => ({
        filename: file,
        fullPath: path.join(this.downloadsFolder, file)
      }));
    } catch (error) {
      console.error('❌ Error reading downloaded-pdfs folder:', error.message);
      return [];
    }
  }

  async getOriginalPDFs() {
    try {
      if (!fs.existsSync(this.originalsFolder)) {
        console.log(`📂 ORIGINALS folder not found at ${this.originalsFolder}`);
        return [];
      }

      const files = fs.readdirSync(this.originalsFolder);
      const pdfFiles = files.filter(file => 
        file.endsWith('.pdf') && 
        fs.statSync(path.join(this.originalsFolder, file)).isFile()
      );
      
      console.log(`📁 Found ${pdfFiles.length} original PDF files in ORIGINALS folder`);
      return pdfFiles.map(file => ({
        filename: file,
        fullPath: path.join(this.originalsFolder, file)
      }));
    } catch (error) {
      console.error('❌ Error reading ORIGINALS folder:', error.message);
      return [];
    }
  }

  async extractInvoiceNumberFromFilename(filename) {
    try {
      // Format: Factura_de_deudores_[NUMBER].pdf
      const match = filename.match(/Factura_de_deudores_(\d+)\.pdf/);
      if (match) {
        return match[1]; // Return the number part
      }
      console.log(`⚠️ Could not extract invoice number from filename: ${filename}`);
      return null;
    } catch (error) {
      console.error('❌ Error extracting invoice number:', error.message);
      return null;
    }
  }

  async findInvoiceInSAP(invoiceNumber) {
    try {
      console.log(`🔍 Searching for invoice with FolioNumber ${invoiceNumber} in SAP...`);
      
      // Query invoices by FolioNumberFrom field - include SalesPersonCode and other needed fields
      const response = await this.sapConnection.get(`/Invoices?$filter=FolioNumberFrom eq ${invoiceNumber}&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,U_EmailSent,Series,SalesPersonCode,DocEntry`);
      
      if (response.data && response.data.value && response.data.value.length > 0) {
        const invoice = response.data.value[0];
        console.log(`✅ Found invoice: ${invoice.DocNum} for customer ${invoice.CardName}`);
        console.log(`� SalesPersonCode: ${invoice.SalesPersonCode}`);
        console.log(`�📄 Series: ${invoice.Series}`);
        
        // Get warehouse from DocumentLines
        let warehouse = 'No especificado';
        try {
          console.log(`🏢 Getting warehouse from DocumentLines for DocEntry ${invoice.DocEntry}...`);
          const linesResponse = await this.sapConnection.get(`/Invoices(${invoice.DocEntry})`);
          
          if (linesResponse.data && linesResponse.data.DocumentLines && linesResponse.data.DocumentLines.length > 0) {
            const firstLine = linesResponse.data.DocumentLines[0];
            warehouse = firstLine.WarehouseCode || 'No especificado';
            console.log(`📦 Warehouse found: ${warehouse}`);
          } else {
            console.log(`⚠️ No DocumentLines found for warehouse info`);
          }
        } catch (warehouseError) {
          console.log(`⚠️ Could not get warehouse info: ${warehouseError.message}`);
        }
        
        return {
          docNum: invoice.DocNum,
          invoiceNumber: invoice.FolioNumberFrom || invoiceNumber,
          date: invoice.DocDate,
          total: invoice.DocTotal,
          customerCode: invoice.CardCode,
          customerName: invoice.CardName,
          emailSent: invoice.U_EmailSent,
          series: invoice.Series,
          salesPersonCode: invoice.SalesPersonCode,
          warehouse: warehouse
        };
      } else {
        console.log(`❌ Invoice with FolioNumber ${invoiceNumber} not found in SAP`);
        return null;
      }
    } catch (error) {
      console.error('❌ Error searching invoice in SAP:', error.message);
      return null;
    }
  }

  async getCustomerEmailFromSAP(customerCode) {
    try {
      console.log(`📧 Searching for email for customer ${customerCode}...`);
      
      // Query customer to get all fields first to find email field
      const response = await this.sapConnection.get(`/BusinessPartners('${customerCode}')`);
      
      if (response.data) {
        const customer = response.data;
        
        // Check common email field names
        const possibleEmailFields = [
          'EmailAddress',
          'E_Mail', 
          'Email',
          'ContactPersons',
          'BPAddresses'
        ];
        
        console.log('📋 Available customer fields:', Object.keys(customer));
        
        // Try direct email fields first
        for (const field of ['EmailAddress', 'E_Mail', 'Email']) {
          if (customer[field] && customer[field].trim()) {
            console.log(`✅ Found email in ${field}: ${customer[field]}`);
            return customer[field];
          }
        }
        
        // Check contact persons
        if (customer.ContactPersons && customer.ContactPersons.length > 0) {
          for (const contact of customer.ContactPersons) {
            if (contact.E_Mail && contact.E_Mail.trim()) {
              console.log(`✅ Found email in ContactPersons: ${contact.E_Mail}`);
              return contact.E_Mail;
            }
          }
        }
        
        // Check addresses
        if (customer.BPAddresses && customer.BPAddresses.length > 0) {
          for (const address of customer.BPAddresses) {
            if (address.EmailAddress && address.EmailAddress.trim()) {
              console.log(`✅ Found email in BPAddresses: ${address.EmailAddress}`);
              return address.EmailAddress;
            }
          }
        }
        
        console.log(`❌ No email found for customer ${customerCode}`);
        console.log('🔍 Customer data structure:', JSON.stringify(customer, null, 2));
        return null;
      }
      
    } catch (error) {
      console.error(`❌ Error getting customer email for ${customerCode}:`, error.message);
      return null;
    }
  }

  getEmailContent(invoiceData) {
    // Different email content based on series
    if (invoiceData.series === 76) {
      return {
        subject: `Comprobante ${invoiceData.invoiceNumber} - Simsiroglu`,
        headerTitle: 'Comprobante electrónico emitido',
        greeting: `Estimado/a <strong>${invoiceData.customerName}</strong>,`,
        bodyText: 'Adjuntamos su comprobante de uso interno correspondiente:',
        numberLabel: 'Número de Comprobante:'
      };
    } else {
      // Default for series 4 and others
      return {
        subject: `Factura ${invoiceData.invoiceNumber} - Simsiroglu`,
        headerTitle: 'Factura Electrónica',
        greeting: `Estimado/a <strong>${invoiceData.customerName}</strong>,`,
        bodyText: 'Adjuntamos su factura correspondiente:',
        numberLabel: 'Número de Factura:'
      };
    }
  }

  async sendInvoiceEmail(customerEmail, invoiceData, pdfPath) {
    try {
      console.log(`📧 Sending email to ${customerEmail} for invoice ${invoiceData.invoiceNumber} (Series: ${invoiceData.series})`);
      
      const emailContent = this.getEmailContent(invoiceData);
      
      const mailOptions = {
        from: {
          name: 'Simsiroglu',
          address: 'no_responder@simsiroglu.com.ar'
        },
        to: customerEmail,
        subject: emailContent.subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <h2 style="color: #333; margin-top: 0;">${emailContent.headerTitle}</h2>
              
              <p>${emailContent.greeting}</p>
              
              <p>${emailContent.bodyText}</p>
              
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>${emailContent.numberLabel}</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${invoiceData.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Fecha:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${new Date(invoiceData.date).toLocaleDateString('es-AR')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Total:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">$${parseFloat(invoiceData.total).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Depósito:</strong></td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${invoiceData.warehouse}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong>Vendedor:</strong></td>
                    <td style="padding: 8px 0;">${invoiceData.salesPersonCode}</td>
                  </tr>
                </table>
              </div>
              
              <p><strong>Importante:</strong> Este es un email automático, por cualquier consulta escribir a info@simsiroglu.com.ar</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              
              <p style="text-align: center; color: #666; font-size: 14px; margin-bottom: 0;">
                <strong>Gracias por su compra.</strong>
              </p>
            </div>
          </div>
        `,
        attachments: pdfPath ? [
          {
            filename: path.basename(pdfPath),
            path: pdfPath,
            contentType: 'application/pdf'
          }
        ] : []
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully to ${customerEmail} (MessageId: ${result.messageId})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email to ${customerEmail}:`, error.message);
      return false;
    }
  }

  async markEmailSentInSAP(docNum) {
    try {
      console.log(`📝 Marking invoice ${docNum} as email sent in SAP...`);
      
      const updateData = {
        U_EmailSent: 'Y'
      };
      
      await this.sapConnection.patch(`/Invoices(${docNum})`, updateData);
      console.log(`✅ Invoice ${docNum} marked as email sent in SAP`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to mark invoice ${docNum} as email sent:`, error.message);
      return false;
    }
  }

  async processInvoiceEmails() {
    try {
      console.log('🚀 Starting email service...');
      
      // Initialize SAP connection
      await this.initializeSapConnection();
      
      // Get processed PDFs
      const pdfFiles = await this.getProcessedPDFs();
      
      if (pdfFiles.length === 0) {
        console.log('📭 No PDF files found to process');
        return;
      }

      console.log(`📧 Processing ${pdfFiles.length} invoices for email delivery...`);
      
      for (const pdfFile of pdfFiles) {
        try {
          console.log(`\n📄 Processing: ${pdfFile.filename}`);
          
          // Extract invoice number from filename
          const invoiceNumber = await this.extractInvoiceNumberFromFilename(pdfFile.filename);
          console.log(`🔍 Extracted invoice number: ${invoiceNumber}`);
          
          // Find invoice in SAP
          const invoiceData = await this.findInvoiceInSAP(invoiceNumber);
          if (!invoiceData) {
            console.log(`   ⚠️ Invoice ${invoiceNumber} not found in SAP`);
            continue;
          }
          
          // Get customer email
          const customerEmail = await this.getCustomerEmailFromSAP(invoiceData.customerCode);
          if (!customerEmail) {
            console.log(`   ⚠️ No email found for customer ${invoiceData.customerName}`);
            continue;
          }
          
          // Check if email already sent
          if (invoiceData.emailSent === 'Y') {
            console.log(`   ⚠️ Email already sent for invoice ${invoiceNumber}, skipping`);
            continue;
          }
          
          // Send email
          const success = await this.sendInvoiceEmail(customerEmail, invoiceData, pdfFile.fullPath);
          
          if (success) {
            // Mark as sent in SAP
            await this.markEmailSentInSAP(invoiceData.docNum);
            console.log(`   ✅ Email sent and marked in SAP for invoice ${invoiceNumber}`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing ${pdfFile.filename}:`, error.message);
        }
      }
      
      console.log('\n🏁 Email processing completed');
      
    } catch (error) {
      console.error('💥 Fatal error in email service:', error.message);
    }
  }
}

// Export the class for use in other modules
export { EmailService };

// Create and run the service only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const emailService = new EmailService();
  emailService.processInvoiceEmails().then(() => {
    console.log('📧 Email service finished');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Email service crashed:', error);
    process.exit(1);
  });
}