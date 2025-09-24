// Send a test email to ssimsi@gmail.com
import { EmailService } from './email-service.js';
import path from 'path';
import fs from 'fs';

async function sendTestEmail() {
  console.log('📧 Sending test email to ssimsi@gmail.com...');
  
  const emailService = new EmailService();
  
  try {
    // Initialize SAP connection to get real invoice data
    await emailService.initializeSapConnection();
    
    // Get a real invoice for testing
    console.log('🔍 Getting a sample invoice for test...');
    const response = await emailService.sapConnection.get('/Invoices?$top=1&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,Series&$orderby=DocEntry desc');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      
      // Create test invoice data
      const testInvoiceData = {
        docNum: invoice.DocNum,
        invoiceNumber: invoice.FolioNumberFrom || invoice.DocNum,
        date: invoice.DocDate,
        total: invoice.DocTotal,
        customerCode: invoice.CardCode,
        customerName: invoice.CardName,
        series: invoice.Series
      };
      
      console.log('📋 Test invoice data:');
      console.log(`   Invoice: ${testInvoiceData.invoiceNumber}`);
      console.log(`   Customer: ${testInvoiceData.customerName}`);
      console.log(`   Date: ${testInvoiceData.date}`);
      console.log(`   Total: ${testInvoiceData.total}`);
      console.log(`   Series: ${testInvoiceData.series}`);
      
      // Check if we have any PDFs to attach (optional)
      let pdfPath = null;
      const downloadsFolder = path.join(process.cwd(), 'downloaded-pdfs');
      
      if (fs.existsSync(downloadsFolder)) {
        const files = fs.readdirSync(downloadsFolder);
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        
        if (pdfFiles.length > 0) {
          pdfPath = path.join(downloadsFolder, pdfFiles[0]);
          console.log(`📎 Using PDF attachment: ${pdfFiles[0]}`);
        } else {
          console.log('📎 No PDF files found, sending email without attachment');
        }
      }
      
      // Send test email
      console.log('\n📧 Sending test email...');
      const success = await emailService.sendInvoiceEmail('ssimsi@gmail.com', testInvoiceData, pdfPath);
      
      if (success) {
        console.log('✅ Test email sent successfully to ssimsi@gmail.com!');
        console.log('📬 Please check your inbox for the test invoice email');
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

sendTestEmail();