import EmailInvoiceMonitor from './email-invoice-monitor.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testEmailMonitoring() {
  console.log('🧪 Testing Email Invoice Monitoring');
  console.log('=====================================\n');

  // Check if email configuration is present
  const requiredEmailConfig = [
    'EMAIL_USERNAME',
    'EMAIL_PASSWORD',
    'EMAIL_HOST'
  ];

  const missingConfig = requiredEmailConfig.filter(key => !process.env[key]);
  
  if (missingConfig.length > 0) {
    console.log('⚠️ Email configuration missing. Please add to .env.local:');
    console.log('');
    missingConfig.forEach(key => {
      console.log(`${key}=your-value-here`);
    });
    console.log('');
    console.log('📝 Example configuration for Gmail:');
    console.log('EMAIL_HOST=imap.gmail.com');
    console.log('EMAIL_PORT=993');
    console.log('EMAIL_SECURE=true');
    console.log('EMAIL_USERNAME=your-email@gmail.com');
    console.log('EMAIL_PASSWORD=your-app-password');
    console.log('');
    console.log('🔑 For Gmail, you need to:');
    console.log('   1. Enable 2-factor authentication');
    console.log('   2. Generate an "App Password"');
    console.log('   3. Use the app password instead of your regular password');
    console.log('');
    console.log('🚀 Once configured, this service will:');
    console.log('   ✅ Monitor your email inbox for new invoices');
    console.log('   ✅ Extract PDF attachments automatically');
    console.log('   ✅ Read invoice details from the PDF');
    console.log('   ✅ Send via WhatsApp using existing service');
    console.log('   ✅ Track processed emails to avoid duplicates');
    return;
  }

  const monitor = new EmailInvoiceMonitor();

  try {
    console.log('🔌 Testing email connection...');
    await monitor.connect();
    
    console.log('📥 Opening inbox...');
    await monitor.openInbox();
    
    console.log('🔍 Searching for invoice emails...');
    const newInvoices = await monitor.checkForNewInvoices();
    
    if (newInvoices.length > 0) {
      console.log(`\n🎉 Found ${newInvoices.length} new invoice email(s)!`);
      
      newInvoices.forEach((invoice, index) => {
        console.log(`\n📧 Invoice Email ${index + 1}:`);
        console.log(`   Subject: ${invoice.email.subject}`);
        console.log(`   From: ${invoice.email.from}`);
        console.log(`   Date: ${invoice.email.date}`);
        console.log(`   PDFs: ${invoice.pdfs.length}`);
        
        invoice.pdfs.forEach((pdf, pdfIndex) => {
          console.log(`\n   📄 PDF ${pdfIndex + 1}: ${pdf.filename}`);
          if (pdf.invoiceInfo) {
            console.log(`      Invoice #: ${pdf.invoiceInfo.invoiceNumber || 'Not found'}`);
            console.log(`      Customer: ${pdf.invoiceInfo.customer || 'Not found'}`);
            console.log(`      Total: ${pdf.invoiceInfo.total || 'Not found'}`);
            console.log(`      Phone(s): ${pdf.invoiceInfo.phones?.join(', ') || 'Not found'}`);
          }
        });
      });
      
      console.log('\n🤖 In production, these would be sent via WhatsApp automatically!');
      
    } else {
      console.log('\n📪 No new invoice emails found.');
      console.log('💡 To test this system:');
      console.log('   1. Send an email with a PDF invoice to your monitored inbox');
      console.log('   2. Run this test again');
      console.log('   3. The system will extract invoice details and prepare for WhatsApp');
    }
    
    monitor.disconnect();
    console.log('\n✅ Email monitoring test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Email monitoring test failed:', error.message);
    
    if (error.message.includes('AUTHENTICATIONFAILED')) {
      console.log('\n🔑 Authentication failed. Please check:');
      console.log('   • Email username and password are correct');
      console.log('   • For Gmail: Use an "App Password" instead of your regular password');
      console.log('   • Enable 2-factor authentication first');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('\n🌐 Connection failed. Please check:');
      console.log('   • EMAIL_HOST setting is correct');
      console.log('   • Internet connection is working');
    }
    
    monitor.disconnect();
  }
}

testEmailMonitoring().catch(console.error);
