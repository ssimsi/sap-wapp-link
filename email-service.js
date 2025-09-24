/**
 * Email Service for Invoice Delivery
 * 
 * WORKFLOW:
 * 1. PDFs are first downloaded to downloaded-pdfs/ORIGINALS/
 * 2. rename-invoice-pdfs.cjs processes the      // Query invoices by FolioNumberFrom field - include SalesPersonCode and other needed fields
      const response = await this.sapConnection.get(`/Invoices?$filter=FolioNumberFrom eq ${invoiceNumber}&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,U_EmailSent,Series,SalesPersonCode,DocEntry`);
      
      if (response.data && response.data.value && response.data.value.length > 0) {
        const invoice = response.data.value[0];
        console.log(`✅ Found invoice ${invoice.DocNum} - ${invoice.CardName}`);s to downloaded-pdfs/ with proper names
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
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

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
          const linesResponse = await this.sapConnection.get(`/Invoices(${invoice.DocEntry})`);
          
          if (linesResponse.data && linesResponse.data.DocumentLines && linesResponse.data.DocumentLines.length > 0) {
            const firstLine = linesResponse.data.DocumentLines[0];
            warehouse = firstLine.WarehouseCode || 'No especificado';
          }
        } catch (warehouseError) {
          console.log(`⚠️ Could not get warehouse: ${warehouseError.message}`);
        }
        
        return {
          docNum: invoice.DocNum,
          docEntry: invoice.DocEntry,
          invoiceNumber: invoice.FolioNumberFrom || invoiceNumber,
          date: invoice.DocDate,
          total: invoice.DocTotal,
          customerCode: invoice.CardCode,
          customerName: invoice.CardName,
          customerReference: invoice.NumAtCard,
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
        
        // Try direct email fields first
        for (const field of ['EmailAddress', 'E_Mail', 'Email']) {
          if (customer[field] && customer[field].trim()) {
            console.log(`✅ Found email: ${customer[field]}`);
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
        return null;
      }
      
    } catch (error) {
      console.error(`❌ Error getting customer email for ${customerCode}:`, error.message);
      return null;
    }
  }



  getSalespersonEmail(salesPersonCode) {
    try {
      // Look for salesperson email using SALES_PERSON_EMAIL_ prefix
      const emailKey = `SALES_PERSON_EMAIL_${salesPersonCode}`;
      const email = process.env[emailKey];
      
      if (email && email.trim() && email.includes('@')) {
        console.log(`📧 Found salesperson email for code ${salesPersonCode}: ${email}`);
        return email.trim();
      } else {
        console.log(`⚠️ No email found for salesperson code ${salesPersonCode}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error getting salesperson email for code ${salesPersonCode}:`, error.message);
      return null;
    }
  }

  getEmailContent(invoiceData) {
    // Use customer reference or fallback to invoice number
    const customerRef = invoiceData.customerReference || invoiceData.invoiceNumber;
    
    // Different email content based on series
    if (invoiceData.series === 76) {
      return {
        subject: `Su comprobante ref. ${customerRef} en Simsiroglu`,
        headerTitle: 'Comprobante electrónico emitido',
        greeting: `Estimado/a <strong>${invoiceData.customerName}</strong>,`,
        bodyText: `Adjuntamos su comprobante correspondiente a su operación ref. <strong>${customerRef}</strong>:`,
        numberLabel: 'Número de Comprobante:'
      };
    } else {
      // Default for series 4 and others
      return {
        subject: `Su factura de compra ref. ${customerRef} en Simsiroglu`,
        headerTitle: 'Factura Electrónica',
        greeting: `Estimado/a <strong>${invoiceData.customerName}</strong>,`,
        bodyText: `Adjuntamos su factura correspondiente a su compra ref. <strong>${customerRef}</strong>:`,
        numberLabel: 'Número de Factura:'
      };
    }
  }

  async sendInvoiceEmail(customerEmail, invoiceData, pdfPath) {
    try {
      console.log(`📧 Processing email for invoice ${invoiceData.invoiceNumber} (Series: ${invoiceData.series}, Warehouse: ${invoiceData.warehouse})`);
      
      // Determine all recipients
      const recipients = [];
      
      // 1. Send to customer if email available
      if (customerEmail && customerEmail.includes('@')) {
        recipients.push({ email: customerEmail, type: 'customer' });
        console.log(`📧 Customer email: ${customerEmail}`);
      } else {
        console.log(`⚠️ No customer email available - will send to salesperson/warehouse only`);
      }
      
      // 2. Always send to salesperson (if email exists)
      const salespersonEmail = this.getSalespersonEmail(invoiceData.salesPersonCode);
      if (salespersonEmail) {
        recipients.push({ email: salespersonEmail, type: 'salesperson' });
        console.log(`👤 Salesperson email: ${salespersonEmail}`);
      }
      
      // 3. If warehouse 07, also send to warehouse email
      if (invoiceData.warehouse === '07') {
        recipients.push({ email: 'sarandishk@gmail.com', type: 'warehouse' });
        console.log(`🏢 Warehouse 07 detected - adding: sarandishk@gmail.com`);
      }
      
      if (recipients.length === 0) {
        console.log(`❌ No valid email recipients found for invoice ${invoiceData.invoiceNumber}`);
        return false;
      }
      
      console.log(`📧 Sending to ${recipients.length} recipients: ${recipients.map(r => `${r.email} (${r.type})`).join(', ')}`);
      
      const emailContent = this.getEmailContent(invoiceData);
      
      // Prepare email template
      const htmlTemplate = `
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
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Referencia del Cliente:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${invoiceData.customerReference || invoiceData.invoiceNumber}</td>
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
      `;
      
      // Send email to all recipients
      let successCount = 0;
      const results = [];
      
      for (const recipient of recipients) {
        try {
          const mailOptions = {
            from: {
              name: 'Simsiroglu',
              address: 'no_responder@simsiroglu.com.ar'
            },
            to: recipient.email,
            subject: emailContent.subject,
            html: htmlTemplate,
            attachments: pdfPath ? [
              {
                filename: path.basename(pdfPath),
                path: pdfPath,
                contentType: 'application/pdf'
              }
            ] : []
          };

          const result = await this.emailTransporter.sendMail(mailOptions);
          console.log(`✅ Email sent to ${recipient.email} (${recipient.type}) - MessageId: ${result.messageId}`);
          results.push({ recipient: recipient.email, type: recipient.type, success: true, messageId: result.messageId });
          successCount++;
          
        } catch (error) {
          console.error(`❌ Failed to send email to ${recipient.email} (${recipient.type}):`, error.message);
          results.push({ recipient: recipient.email, type: recipient.type, success: false, error: error.message });
        }
      }
      
      console.log(`📊 Email summary: ${successCount}/${recipients.length} emails sent successfully`);
      
      // Return true if at least one email was sent successfully
      return successCount > 0;
      
    } catch (error) {
      console.error(`❌ Failed to process email for invoice ${invoiceData.invoiceNumber}:`, error.message);
      return false;
    }
  }

  async markEmailSentInSAP(docEntry) {
    try {
      console.log(`📝 Marking invoice DocEntry ${docEntry} as email sent in SAP...`);
      
      const updateData = {
        U_EmailSent: 'Y'
      };
      
      await this.sapConnection.patch(`/Invoices(${docEntry})`, updateData);
      console.log(`✅ Invoice DocEntry ${docEntry} marked as email sent in SAP`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to mark invoice DocEntry ${docEntry} as email sent:`, error.message);
      return false;
    }
  }

  async movePdfToEmailSentFolder(pdfPath) {
    try {
      const emailSentFolder = path.join(this.downloadsFolder, 'EMAIL SENT');
      
      // Create EMAIL SENT folder if it doesn't exist
      if (!fs.existsSync(emailSentFolder)) {
        fs.mkdirSync(emailSentFolder, { recursive: true });
        console.log(`📁 Created EMAIL SENT folder: ${emailSentFolder}`);
      }
      
      const filename = path.basename(pdfPath);
      const destinationPath = path.join(emailSentFolder, filename);
      
      // Move the file
      fs.renameSync(pdfPath, destinationPath);
      console.log(`📁 Moved ${filename} to EMAIL SENT folder`);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to move PDF to EMAIL SENT folder:`, error.message);
      return false;
    }
  }

  async getUnsentInvoicesFromSAP(fromDate = '2025-09-22', toDate = '2025-09-23') {
    try {
      console.log(`🔍 Querying SAP for unsent email invoices between ${fromDate} and ${toDate}...`);
      
      let allInvoices = [];
      let url = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate ge '${fromDate}' and DocDate le '${toDate}'&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,U_EmailSent,Series,SalesPersonCode,DocEntry,NumAtCard,Comments&$orderby=DocDate desc`;
      
      // Paginate through all results using $skip
      let skip = 0;
      const pageSize = 20; // SAP B1 default page size
      
      while (true) {
        const paginatedUrl = `${url}&$skip=${skip}&$top=${pageSize}`;
        console.log(`🔍 Fetching page ${Math.floor(skip / pageSize) + 1} (skip ${skip})...`);
        
        const response = await this.sapConnection.get(paginatedUrl);
        
        if (response.data && response.data.value && response.data.value.length > 0) {
          allInvoices.push(...response.data.value);
          
          // If we got fewer results than page size, we've reached the end
          if (response.data.value.length < pageSize) {
            break;
          }
          
          skip += pageSize;
        } else {
          break;
        }
      }
      
      if (allInvoices.length > 0) {
        console.log(`✅ Found ${allInvoices.length} unsent invoices in SAP between ${fromDate} and ${toDate} (across ${Math.ceil(allInvoices.length / pageSize)} pages)`);
        
        // Log the date range of found invoices
        const dates = allInvoices.map(inv => inv.DocDate).filter(Boolean);
        if (dates.length > 0) {
          const minDate = Math.min(...dates.map(d => new Date(d)));
          const maxDate = Math.max(...dates.map(d => new Date(d)));
          console.log(`📅 Invoice date range: ${new Date(minDate).toISOString().split('T')[0]} to ${new Date(maxDate).toISOString().split('T')[0]}`);
        }
        
        return allInvoices;
      } else {
        console.log(`📭 No unsent invoices found in SAP between ${fromDate} and ${toDate}`);
        return [];
      }
    } catch (error) {
      console.error('❌ Error querying unsent invoices from SAP:', error.message);
      return [];
    }
  }

  async findPDFForInvoice(folioNumber) {
    try {
      // Try different zero-padding patterns for PDF filename
      const patterns = [
        `Factura_de_deudores_${folioNumber}.pdf`,           // No padding: 14936
        `Factura_de_deudores_0${folioNumber}.pdf`,          // 1 zero: 014936  
        `Factura_de_deudores_00${folioNumber}.pdf`,         // 2 zeros: 0014936
        `Factura_de_deudores_000${folioNumber}.pdf`,        // 3 zeros: 00014936
        `Factura_de_deudores_0000${folioNumber}.pdf`,       // 4 zeros: 000014936
        `Factura_de_deudores_00000${folioNumber}.pdf`       // 5 zeros: 0000014936
      ];
      
      for (const filename of patterns) {
        const pdfPath = path.join(this.downloadsFolder, filename);
        if (fs.existsSync(pdfPath)) {
          console.log(`✅ Found PDF for invoice ${folioNumber}: ${filename}`);
          return {
            filename: filename,
            fullPath: pdfPath
          };
        }
      }
      
      console.log(`❌ PDF not found for invoice ${folioNumber} (tried multiple zero-padding patterns)`);
      return null;
    } catch (error) {
      console.error(`❌ Error looking for PDF for invoice ${folioNumber}:`, error.message);
      return null;
    }
  }

  async processInvoiceEmails() {
    try {
      console.log('🚀 Starting email service...');
      
      // Initialize SAP connection
      await this.initializeSapConnection();
      
      // Get unsent invoices from SAP first (September 22-23, 2025)
      const unsentInvoices = await this.getUnsentInvoicesFromSAP('2025-09-22', '2025-09-23');
      
      if (unsentInvoices.length === 0) {
        console.log('📭 No unsent invoices found in SAP');
        return;
      }

      console.log(`📧 Processing ${unsentInvoices.length} unsent invoices for email delivery...`);
      
      for (const invoice of unsentInvoices) {
        try {
          console.log(`\n📄 Processing invoice: ${invoice.FolioNumberFrom} (DocNum: ${invoice.DocNum})`);
          
          // Look for corresponding PDF file
          const pdfFile = await this.findPDFForInvoice(invoice.FolioNumberFrom);
          if (!pdfFile) {
            console.log(`   ⚠️ PDF not found for invoice ${invoice.FolioNumberFrom}, skipping`);
            continue;
          }
          
          // Get warehouse from DocumentLines
          let warehouse = 'No especificado';
          try {
            const linesResponse = await this.sapConnection.get(`/Invoices(${invoice.DocEntry})`);
            
            if (linesResponse.data && linesResponse.data.DocumentLines && linesResponse.data.DocumentLines.length > 0) {
              const firstLine = linesResponse.data.DocumentLines[0];
              warehouse = firstLine.WarehouseCode || 'No especificado';
            }
          } catch (warehouseError) {
            console.log(`⚠️ Could not get warehouse: ${warehouseError.message}`);
          }
          
          // Prepare invoice data
          const invoiceData = {
            docNum: invoice.DocNum,
            docEntry: invoice.DocEntry,
            invoiceNumber: invoice.FolioNumberFrom,
            date: invoice.DocDate,
            total: invoice.DocTotal,
            customerCode: invoice.CardCode,
            customerName: invoice.CardName,
            customerReference: invoice.NumAtCard,
            emailSent: invoice.U_EmailSent,
            series: invoice.Series,
            salesPersonCode: invoice.SalesPersonCode,
            warehouse: warehouse
          };
          
          console.log(`� Series: ${invoiceData.series}, Warehouse: ${invoiceData.warehouse}, Sales: ${invoiceData.salesPersonCode}, EmailSent: ${invoiceData.emailSent || 'null'}`);
          
          // Double-check: Skip if already marked as sent
          if (invoiceData.emailSent === 'Y') {
            console.log(`   ⚠️ Email already sent for invoice ${invoiceData.invoiceNumber} (U_EmailSent = 'Y'), skipping`);
            continue;
          }
          
          // Get customer email (but don't skip if missing - still send to salesperson/warehouse)
          const customerEmail = await this.getCustomerEmailFromSAP(invoiceData.customerCode);
          if (!customerEmail) {
            console.log(`   ⚠️ No email found for customer ${invoiceData.customerName}, but will still send to salesperson/warehouse`);
          }
          
          // Send email
          const success = await this.sendInvoiceEmail(customerEmail, invoiceData, pdfFile.fullPath);
          
          if (success) {
            // Mark as sent in SAP (PDFs remain in downloaded-pdfs folder)
            await this.markEmailSentInSAP(invoiceData.docEntry);
            console.log(`   ✅ Email sent and marked in SAP for invoice ${invoiceData.invoiceNumber}`);
          }
          
        } catch (error) {
          console.error(`❌ Error processing invoice ${invoice.FolioNumberFrom}:`, error.message);
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