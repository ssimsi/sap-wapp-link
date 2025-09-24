// Test email with Simsiroglu logo
import { EmailService } from './email-service.js';

async function testEmailWithLogo() {
  console.log('📧 Testing email with Simsiroglu logo...');
  
  const emailService = new EmailService();
  
  try {
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Get a sample invoice for testing
    console.log('🔍 Getting a sample invoice for logo test...');
    const response = await emailService.sapConnection.get('/Invoices?$top=1&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,Series,SalesPersonCode,DocEntry&$orderby=DocEntry desc');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      
      // Get full invoice data
      console.log(`📋 Testing with invoice FolioNumber: ${invoice.FolioNumberFrom}`);
      const testInvoiceData = await emailService.findInvoiceInSAP(invoice.FolioNumberFrom.toString());
      
      if (!testInvoiceData) {
        console.log('❌ Could not get invoice data');
        return;
      }
      
      console.log('📋 Test invoice data:');
      console.log(`   Invoice: ${testInvoiceData.invoiceNumber}`);
      console.log(`   Customer: ${testInvoiceData.customerName}`);
      console.log(`   Series: ${testInvoiceData.series}`);
      console.log(`   Logo template: ${testInvoiceData.series === 76 ? 'Comprobante' : 'Factura'}`);
      
      // Send test email with logo
      console.log('\n📧 Sending email with Simsiroglu logo to ssimsi@gmail.com...');
      const success = await emailService.sendInvoiceEmail('ssimsi@gmail.com', testInvoiceData, null);
      
      if (success) {
        console.log('✅ Email with logo sent successfully!');
        console.log('📬 Email includes:');
        console.log('   - Professional invoice/comprobante template based on series');
        console.log('   - All invoice details (warehouse, salesperson, etc.)');
        console.log('   - Simsiroglu logo in signature (replacing text)');
        console.log('   - Updated footer with info@simsiroglu.com.ar');
        console.log('\n🖼️ The Simsiroglu logo should now appear at the bottom of the email!');
        console.log('📬 Please check your Gmail inbox for the updated email format.');
      } else {
        console.log('❌ Failed to send email with logo');
      }
      
    } else {
      console.log('❌ No invoices found for testing');
    }
    
  } catch (error) {
    console.error('❌ Logo test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testEmailWithLogo();