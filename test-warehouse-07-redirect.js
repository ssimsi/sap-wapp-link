// Test warehouse 07 email redirection
import { EmailService } from './email-service.js';

async function testWarehouse07Redirection() {
  console.log('📧 Testing warehouse 07 email redirection...');
  
  const emailService = new EmailService();
  
  try {
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Look for an invoice with warehouse 07
    console.log('🔍 Looking for invoices with warehouse 07...');
    const response = await emailService.sapConnection.get('/Invoices?$top=10&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,Series,SalesPersonCode,DocEntry&$orderby=DocEntry desc');
    
    let warehouse07Invoice = null;
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      // Check each invoice for warehouse 07
      for (const invoice of response.data.value) {
        console.log(`📋 Checking invoice ${invoice.FolioNumberFrom}...`);
        const invoiceData = await emailService.findInvoiceInSAP(invoice.FolioNumberFrom.toString());
        
        if (invoiceData && invoiceData.warehouse === '07') {
          warehouse07Invoice = invoiceData;
          console.log(`✅ Found warehouse 07 invoice: ${invoiceData.invoiceNumber}`);
          console.log(`   Customer: ${invoiceData.customerName}`);
          console.log(`   Warehouse: ${invoiceData.warehouse}`);
          console.log(`   Series: ${invoiceData.series}`);
          break;
        }
      }
    }
    
    if (warehouse07Invoice) {
      // Test the email redirection
      console.log('\n📧 Testing email redirection for warehouse 07...');
      console.log(`Original customer would be: ${warehouse07Invoice.customerName}`);
      console.log(`But email will be redirected to: fcshksap@gmail.com`);
      
      // Send test email
      const success = await emailService.sendInvoiceEmail('original@customer.com', warehouse07Invoice, null);
      
      if (success) {
        console.log('\n✅ Warehouse 07 redirection test successful!');
        console.log('📬 Email should have been sent to fcshksap@gmail.com');
        console.log('📋 Invoice details included:');
        console.log(`   - Invoice: ${warehouse07Invoice.invoiceNumber}`);
        console.log(`   - Customer: ${warehouse07Invoice.customerName}`);
        console.log(`   - Warehouse: ${warehouse07Invoice.warehouse}`);
        console.log(`   - Series: ${warehouse07Invoice.series}`);
      } else {
        console.log('❌ Failed to send test email');
      }
    } else {
      // Create a mock invoice with warehouse 07 for testing
      console.log('\n🧪 No warehouse 07 invoices found, testing with mock data...');
      
      const mockInvoice = {
        docNum: '999999',
        invoiceNumber: 'TEST001',
        date: '2025-09-24',
        total: 100000,
        customerCode: 'TEST001',
        customerName: 'TEST CUSTOMER FOR WAREHOUSE 07',
        emailSent: 'N',
        series: 4,
        salesPersonCode: 20,
        warehouse: '07'  // This should trigger the redirection
      };
      
      console.log('📧 Testing with mock invoice...');
      const success = await emailService.sendInvoiceEmail('original@customer.com', mockInvoice, null);
      
      if (success) {
        console.log('\n✅ Mock warehouse 07 redirection test successful!');
        console.log('📬 Email should have been sent to fcshksap@gmail.com');
      } else {
        console.log('❌ Failed to send mock test email');
      }
    }
    
    console.log('\n📋 Warehouse Redirection Logic:');
    console.log('   • Warehouse 07 → fcshksap@gmail.com');
    console.log('   • All other warehouses → customer email');
    
  } catch (error) {
    console.error('❌ Warehouse test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testWarehouse07Redirection();