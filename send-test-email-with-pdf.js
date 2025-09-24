// Send a test email with PDF attachment to ssimsi@gmail.com
import { EmailService } from './email-service.js';
import path from 'path';
import fs from 'fs';

async function sendTestEmailWithPDF() {
  console.log('📧 Sending test email with PDF attachment to ssimsi@gmail.com...');
  
  const emailService = new EmailService();
  
  try {
    // Initialize SAP connection to get real invoice data
    await emailService.initializeSapConnection();
    
    // Get a real invoice for testing
    console.log('🔍 Getting a sample invoice for test...');
    const response = await emailService.sapConnection.get('/Invoices?$top=1&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,Series,SalesPersonCode,DocEntry&$orderby=DocEntry desc');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      
      // Get full invoice data using our service method
      console.log(`📋 Testing with invoice FolioNumber: ${invoice.FolioNumberFrom}`);
      const testInvoiceData = await emailService.findInvoiceInSAP(invoice.FolioNumberFrom.toString());
      
      if (!testInvoiceData) {
        console.log('❌ Could not get invoice data');
        return;
      }
      
      console.log('📋 Test invoice data:');
      console.log(`   Invoice: ${testInvoiceData.invoiceNumber}`);
      console.log(`   Customer: ${testInvoiceData.customerName}`);
      console.log(`   Date: ${testInvoiceData.date}`);
      console.log(`   Total: ${testInvoiceData.total}`);
      console.log(`   Series: ${testInvoiceData.series}`);
      console.log(`   SalesPersonCode: ${testInvoiceData.salesPersonCode}`);
      console.log(`   Warehouse: ${testInvoiceData.warehouse}`);
      
      // Look for any available PDF to attach
      let pdfPath = null;
      const possiblePdfFolders = [
        path.join(process.cwd(), 'downloaded-pdfs'),
        path.join(process.cwd(), 'downloaded-pdfs', 'ORIGINALS'),
        process.cwd()
      ];
      
      console.log('\n📎 Looking for PDF files to attach...');
      
      for (const folder of possiblePdfFolders) {
        if (fs.existsSync(folder)) {
          const files = fs.readdirSync(folder);
          const pdfFiles = files.filter(file => file.endsWith('.pdf'));
          
          if (pdfFiles.length > 0) {
            pdfPath = path.join(folder, pdfFiles[0]);
            console.log(`📎 Found PDF in ${folder}: ${pdfFiles[0]}`);
            console.log(`📄 File size: ${fs.statSync(pdfPath).size} bytes`);
            break;
          }
        }
      }
      
      if (!pdfPath) {
        console.log('📎 No PDF files found, creating a test message about it');
      }
      
      // Send test email
      console.log('\n📧 Sending test email with complete invoice format...');
      const success = await emailService.sendInvoiceEmail('ssimsi@gmail.com', testInvoiceData, pdfPath);
      
      if (success) {
        console.log('✅ Test email sent successfully to ssimsi@gmail.com!');
        console.log('📬 Email includes:');
        console.log('   - Customer name in Spanish');
        console.log('   - Invoice number, date, and total');
        console.log('   - Warehouse (Depósito) information');
        console.log('   - Salesperson (Vendedor) code');
        console.log('   - Professional Simsiroglu branding');
        if (pdfPath) {
          console.log(`   - PDF attachment: ${path.basename(pdfPath)}`);
        } else {
          console.log('   - No PDF attachment (none found)');
        }
        console.log('\n📬 Please check your Gmail inbox for the complete formatted invoice email!');
      } else {
        console.log('❌ Failed to send test email');
      }
      
    } else {
      console.log('❌ No invoices found for testing');
    }
    
  } catch (error) {
    console.error('❌ Test email failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

sendTestEmailWithPDF();