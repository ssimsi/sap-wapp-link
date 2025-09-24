// Test the email service with warehouse and salesperson information
import { EmailService } from './email-service.js';

async function testWarehouseAndSalesperson() {
  console.log('🧪 Testing Warehouse and SalesPersonCode Extraction...');
  
  const emailService = new EmailService();
  
  try {
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Get a recent invoice to test with
    console.log('\n🔍 Getting recent invoice for testing...');
    const response = await emailService.sapConnection.get('/Invoices?$top=1&$select=DocNum,FolioNumberFrom,CardName,SalesPersonCode,Series&$orderby=DocEntry desc');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const testInvoice = response.data.value[0];
      const folioNumber = testInvoice.FolioNumberFrom;
      
      console.log('📋 Test Invoice:');
      console.log(`   DocNum: ${testInvoice.DocNum}`);
      console.log(`   FolioNumber: ${folioNumber}`);
      console.log(`   Customer: ${testInvoice.CardName}`);
      console.log(`   SalesPersonCode: ${testInvoice.SalesPersonCode}`);
      console.log(`   Series: ${testInvoice.Series}`);
      
      if (folioNumber) {
        console.log(`\n🧪 Testing findInvoiceInSAP with FolioNumber: ${folioNumber}`);
        
        // Test the updated findInvoiceInSAP method
        const foundInvoice = await emailService.findInvoiceInSAP(folioNumber.toString());
        
        if (foundInvoice) {
          console.log('\n✅ Invoice Data Retrieved:');
          console.log(`   DocNum: ${foundInvoice.docNum}`);
          console.log(`   Invoice Number: ${foundInvoice.invoiceNumber}`);
          console.log(`   Customer: ${foundInvoice.customerName}`);
          console.log(`   Date: ${foundInvoice.date}`);
          console.log(`   Total: ${foundInvoice.total}`);
          console.log(`   Series: ${foundInvoice.series}`);
          console.log(`   👤 SalesPersonCode: ${foundInvoice.salesPersonCode}`);
          console.log(`   🏢 Warehouse: ${foundInvoice.warehouse}`);
          console.log(`   📧 Email Sent: ${foundInvoice.emailSent || 'Not sent'}`);
          
          // Test email content generation
          console.log('\n📧 Testing email content with warehouse and salesperson...');
          const emailContent = emailService.getEmailContent(foundInvoice);
          console.log(`   Subject: ${emailContent.subject}`);
          
          console.log('\n📋 SUMMARY - All Required Fields:');
          console.log(`   ✅ Name: ${foundInvoice.customerName}`);
          console.log(`   ✅ Date: ${foundInvoice.date}`);
          console.log(`   ✅ FolioNumber: ${foundInvoice.invoiceNumber}`);
          console.log(`   ✅ Series: ${foundInvoice.series}`);
          console.log(`   ✅ SalesPersonCode: ${foundInvoice.salesPersonCode}`);
          console.log(`   ✅ Warehouse: ${foundInvoice.warehouse}`);
          
        } else {
          console.log('❌ Invoice not found with updated method');
        }
      } else {
        console.log('⚠️ No FolioNumberFrom found in test invoice');
      }
      
    } else {
      console.log('❌ No invoices found for testing');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testWarehouseAndSalesperson();