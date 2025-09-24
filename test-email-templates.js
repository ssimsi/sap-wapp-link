// Test different email templates based on series
import { EmailService } from './email-service.js';

async function testEmailTemplates() {
  console.log('📧 Testing different email templates based on series...');
  
  const emailService = new EmailService();
  
  try {
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Test Series 4 (Standard Invoice)
    console.log('\n1️⃣ Testing Series 4 (Standard Invoice Template)...');
    const series4Response = await emailService.sapConnection.get('/Invoices?$filter=Series eq 4&$top=1&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,Series,SalesPersonCode,DocEntry&$orderby=DocEntry desc');
    
    if (series4Response.data && series4Response.data.value && series4Response.data.value.length > 0) {
      const series4Invoice = series4Response.data.value[0];
      const series4Data = await emailService.findInvoiceInSAP(series4Invoice.FolioNumberFrom.toString());
      
      if (series4Data) {
        console.log(`📋 Series 4 Invoice: ${series4Data.invoiceNumber}`);
        console.log(`   Customer: ${series4Data.customerName}`);
        console.log(`   Series: ${series4Data.series}`);
        
        const series4Content = emailService.getEmailContent(series4Data);
        console.log('📄 Series 4 Email Template:');
        console.log(`   Subject: ${series4Content.subject}`);
        console.log(`   Header: ${series4Content.headerTitle}`);
        console.log(`   Body: ${series4Content.bodyText}`);
        console.log(`   Number Label: ${series4Content.numberLabel}`);
        
        // Send test email
        console.log('\n📧 Sending Series 4 test email to ssimsi@gmail.com...');
        await emailService.sendInvoiceEmail('ssimsi@gmail.com', series4Data, null);
      }
    } else {
      console.log('❌ No Series 4 invoices found');
    }
    
    // Test Series 76 (Internal Document)
    console.log('\n2️⃣ Testing Series 76 (Internal Document Template)...');
    const series76Response = await emailService.sapConnection.get('/Invoices?$filter=Series eq 76&$top=1&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,Series,SalesPersonCode,DocEntry&$orderby=DocEntry desc');
    
    if (series76Response.data && series76Response.data.value && series76Response.data.value.length > 0) {
      const series76Invoice = series76Response.data.value[0];
      const series76Data = await emailService.findInvoiceInSAP(series76Invoice.FolioNumberFrom.toString());
      
      if (series76Data) {
        console.log(`📋 Series 76 Invoice: ${series76Data.invoiceNumber}`);
        console.log(`   Customer: ${series76Data.customerName}`);
        console.log(`   Series: ${series76Data.series}`);
        
        const series76Content = emailService.getEmailContent(series76Data);
        console.log('📄 Series 76 Email Template:');
        console.log(`   Subject: ${series76Content.subject}`);
        console.log(`   Header: ${series76Content.headerTitle}`);
        console.log(`   Body: ${series76Content.bodyText}`);
        console.log(`   Number Label: ${series76Content.numberLabel}`);
        
        // Send test email
        console.log('\n📧 Sending Series 76 test email to ssimsi@gmail.com...');
        await emailService.sendInvoiceEmail('ssimsi@gmail.com', series76Data, null);
      }
    } else {
      console.log('❌ No Series 76 invoices found');
    }
    
    console.log('\n✅ Email template testing completed!');
    console.log('📬 Check your Gmail inbox for both email formats');
    console.log('\n📋 Template Summary:');
    console.log('   Series 4: "Factura Electrónica" with "Número de Factura"');
    console.log('   Series 76: "Comprobante electrónico emitido" with "Número de Comprobante"');
    console.log('   Footer: Changed to "info@simsiroglu.com.ar" for both templates');
    
  } catch (error) {
    console.error('❌ Template testing failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testEmailTemplates();