import { EmailService } from './email-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testInvoice90063114() {
  try {
    console.log('🧪 Testing invoice 90063114 specifically...');
    
    const emailService = new EmailService();
    
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Find the specific invoice in SAP
    const invoiceData = await emailService.findInvoiceInSAP('90063114');
    if (!invoiceData) {
      console.log('❌ Invoice 90063114 not found in SAP');
      return;
    }
    
    console.log('📄 Invoice data:', invoiceData);
    
    // Look for PDF file
    const pdfFile = await emailService.findPDFForInvoice('90063114');
    if (!pdfFile) {
      console.log('❌ PDF not found for invoice 90063114');
      return;
    }
    
    console.log('📁 PDF file:', pdfFile);
    
    // Use ssimsi@gmail.com instead of customer email
    const testEmail = 'ssimsi@gmail.com';
    console.log(`📧 Using test email: ${testEmail}`);
    
    // Test salesperson email lookup
    console.log(`🔍 Testing salesperson email lookup for code: ${invoiceData.salesPersonCode}`);
    const salespersonEmail = emailService.getSalespersonEmail(invoiceData.salesPersonCode);
    console.log(`👤 Salesperson email result: ${salespersonEmail}`);
    
    // Send email
    console.log('📧 Sending test email...');
    const success = await emailService.sendInvoiceEmail(testEmail, invoiceData, pdfFile.fullPath);
    
    if (success) {
      console.log('✅ Email sent successfully');
      
      // Mark as sent in SAP (use DocEntry from SAP query)
      console.log('📝 Marking as sent in SAP...');
      console.log(`🔍 Using DocEntry: ${invoiceData.docEntry || 'NOT FOUND'}`);
      const marked = await emailService.markEmailSentInSAP(invoiceData.docEntry, pdfFile.fullPath);
      
      if (marked) {
        console.log('✅ Successfully marked as sent in SAP and moved PDF');
        
        // Verify it was marked in SAP
        console.log('🔍 Verifying U_EmailSent field in SAP...');
        const verifyData = await emailService.findInvoiceInSAP('90063114');
        console.log(`📋 U_EmailSent status: ${verifyData?.emailSent}`);
      } else {
        console.log('❌ Failed to mark as sent in SAP');
      }
    } else {
      console.log('❌ Email sending failed');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the test
testInvoice90063114().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});