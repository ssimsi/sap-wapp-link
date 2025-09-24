import { EmailService } from './email-service.js';

// Test the customer reference functionality
async function testCustomerReference() {
  try {
    console.log('🧪 Testing customer reference functionality...\n');
    
    const emailService = new EmailService();
    
    // Test invoice data with customer reference
    const testInvoiceData = {
      invoiceNumber: '16841',
      customerName: 'RANGEL SRL',
      customerReference: '158581',  // This is the NumAtCard value
      series: 4,  // Factura series
      date: '2025-09-23',
      total: 2960956.15,
      salesPersonCode: 24,
      warehouse: '07'
    };
    
    console.log('📊 Test Invoice Data:');
    console.log(JSON.stringify(testInvoiceData, null, 2));
    console.log('\n');
    
    // Test email content generation
    const emailContent = emailService.getEmailContent(testInvoiceData);
    
    console.log('📧 Generated Email Content:');
    console.log('Subject:', emailContent.subject);
    console.log('Header Title:', emailContent.headerTitle);
    console.log('Greeting:', emailContent.greeting);
    console.log('Body Text:', emailContent.bodyText);
    console.log('Number Label:', emailContent.numberLabel);
    console.log('\n');
    
    // Test with Series 76 (Comprobante)
    const testComprobanteData = {
      ...testInvoiceData,
      series: 76,
      customerReference: '158582'
    };
    
    const comprobanteContent = emailService.getEmailContent(testComprobanteData);
    
    console.log('📋 Comprobante Email Content (Series 76):');
    console.log('Subject:', comprobanteContent.subject);
    console.log('Body Text:', comprobanteContent.bodyText);
    console.log('\n');
    
    // Test without customer reference (should fallback to invoice number)
    const testNoRefData = {
      ...testInvoiceData,
      customerReference: null
    };
    
    const noRefContent = emailService.getEmailContent(testNoRefData);
    
    console.log('🔄 Email Content without customer reference (fallback):');
    console.log('Subject:', noRefContent.subject);
    console.log('Body Text:', noRefContent.bodyText);
    
    console.log('\n✅ Customer reference test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCustomerReference();