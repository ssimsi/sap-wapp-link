// Test the email service with actual FolioNumber matching
import { EmailService } from './email-service.js';

async function testFolioNumberMatching() {
  console.log('🧪 Testing FolioNumber Matching...');
  
  const emailService = new EmailService();
  
  try {
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Get some invoices with FolioNumberFrom values
    console.log('\n🔍 Getting recent invoices with FolioNumberFrom...');
    const response = await emailService.sapConnection.get('/Invoices?$top=5&$select=DocNum,CardName,FolioNumberFrom,Series,U_EmailSent,U_WhatsAppSent&$orderby=DocEntry desc');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      console.log('\n📋 Recent Invoices:');
      response.data.value.forEach((invoice, index) => {
        console.log(`${index + 1}. DocNum: ${invoice.DocNum}, FolioNumber: ${invoice.FolioNumberFrom}, Series: ${invoice.Series}`);
        console.log(`   Customer: ${invoice.CardName}`);
        console.log(`   Email Sent: ${invoice.U_EmailSent || 'Not sent'}, WhatsApp Sent: ${invoice.U_WhatsAppSent || 'Not sent'}`);
        console.log('');
      });
      
      // Test with the first invoice's FolioNumber
      const testInvoice = response.data.value[0];
      const folioNumber = testInvoice.FolioNumberFrom;
      
      if (folioNumber) {
        console.log(`\n🧪 Testing search with FolioNumber: ${folioNumber}`);
        
        // Test the findInvoiceInSAP method
        const foundInvoice = await emailService.findInvoiceInSAP(folioNumber.toString());
        
        if (foundInvoice) {
          console.log('✅ Invoice found successfully:');
          console.log(`   DocNum: ${foundInvoice.docNum}`);
          console.log(`   Name: ${foundInvoice.customerName}`);
          console.log(`   Date: ${foundInvoice.date}`);
          console.log(`   Total: ${foundInvoice.total}`);
          console.log(`   Series: ${foundInvoice.series}`);
          console.log(`   Email Sent: ${foundInvoice.emailSent || 'Not sent'}`);
          
          // Test filename extraction (reverse)
          const testFilename = `Factura_de_deudores_${folioNumber}.pdf`;
          console.log(`\n🧪 Testing filename: ${testFilename}`);
          const extractedNumber = await emailService.extractInvoiceNumberFromFilename(testFilename);
          console.log(`✅ Extracted number: ${extractedNumber}`);
          
          if (extractedNumber === folioNumber.toString()) {
            console.log('✅ Filename extraction matches perfectly!');
          } else {
            console.log('❌ Filename extraction mismatch');
          }
          
          // Test customer email lookup
          console.log(`\n📧 Testing customer email for ${foundInvoice.customerCode}...`);
          const customerEmail = await emailService.getCustomerEmailFromSAP(foundInvoice.customerCode);
          console.log(`Customer email: ${customerEmail || 'NOT FOUND'}`);
          
        } else {
          console.log('❌ Invoice not found with FolioNumber search');
        }
      } else {
        console.log('⚠️ No FolioNumberFrom found in test invoice');
      }
      
    } else {
      console.log('❌ No invoices found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testFolioNumberMatching();