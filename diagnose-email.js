// Diagnostic test for email sending issues
import { EmailService } from './email-service.js';
import fs from 'fs';
import path from 'path';

async function diagnoseEmailIssue() {
  console.log('🔍 Diagnosing email sending issue...');
  
  const emailService = new EmailService();
  
  try {
    // Check if logo file exists
    const logoPath = path.join(process.cwd(), 'Simsiroglu_SHK - fondo verde.png');
    console.log('📁 Checking logo file...');
    console.log(`   Logo path: ${logoPath}`);
    
    if (fs.existsSync(logoPath)) {
      const stats = fs.statSync(logoPath);
      console.log(`   ✅ Logo file exists (${stats.size} bytes)`);
    } else {
      console.log('   ❌ Logo file not found!');
      return;
    }
    
    // Test email transporter
    console.log('\n📧 Testing email transporter...');
    try {
      await emailService.emailTransporter.verify();
      console.log('   ✅ Email transporter connection verified');
    } catch (emailError) {
      console.log('   ❌ Email transporter failed:', emailError.message);
      return;
    }
    
    // Test SAP connection
    console.log('\n🔗 Testing SAP connection...');
    await emailService.initializeSapConnection();
    console.log('   ✅ SAP connection established');
    
    // Get simple invoice data
    console.log('\n📋 Getting invoice data...');
    const response = await emailService.sapConnection.get('/Invoices?$top=1&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,Series,SalesPersonCode,DocEntry&$orderby=DocEntry desc');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      const invoiceData = await emailService.findInvoiceInSAP(invoice.FolioNumberFrom.toString());
      
      console.log('   ✅ Invoice data retrieved');
      console.log(`      Invoice: ${invoiceData.invoiceNumber}`);
      console.log(`      Customer: ${invoiceData.customerName}`);
      console.log(`      Series: ${invoiceData.series}`);
      
      // Try sending a simple test email without attachments first
      console.log('\n📧 Attempting simple email (no attachments)...');
      
      const simpleMailOptions = {
        from: {
          name: 'Simsiroglu',
          address: 'no_responder@simsiroglu.com.ar'
        },
        to: 'ssimsi@gmail.com',
        subject: 'Test Email - Simple',
        html: '<p>Simple test email without attachments</p>'
      };
      
      try {
        const simpleResult = await emailService.emailTransporter.sendMail(simpleMailOptions);
        console.log(`   ✅ Simple email sent (MessageId: ${simpleResult.messageId})`);
        
        // Now try with logo attachment
        console.log('\n📧 Attempting email with logo attachment...');
        
        const logoMailOptions = {
          from: {
            name: 'Simsiroglu',
            address: 'no_responder@simsiroglu.com.ar'
          },
          to: 'ssimsi@gmail.com',
          subject: 'Test Email - With Logo',
          html: `
            <div>
              <p>Test email with logo attachment</p>
              <img src="cid:simsiroglu-logo" alt="Simsiroglu" style="max-width: 120px; height: auto;">
            </div>
          `,
          attachments: [
            {
              filename: 'simsiroglu-logo.png',
              path: logoPath,
              cid: 'simsiroglu-logo',
              contentDisposition: 'inline'
            }
          ]
        };
        
        const logoResult = await emailService.emailTransporter.sendMail(logoMailOptions);
        console.log(`   ✅ Logo email sent (MessageId: ${logoResult.messageId})`);
        
        // Now try the full invoice email
        console.log('\n📧 Attempting full invoice email...');
        const success = await emailService.sendInvoiceEmail('ssimsi@gmail.com', invoiceData, null);
        
        if (success) {
          console.log('   ✅ Full invoice email sent successfully!');
        } else {
          console.log('   ❌ Full invoice email failed');
        }
        
      } catch (emailSendError) {
        console.log('   ❌ Email sending failed:', emailSendError.message);
        console.log('   📋 Full error:', emailSendError);
      }
      
    } else {
      console.log('   ❌ No invoices found for testing');
    }
    
  } catch (error) {
    console.error('💥 Diagnostic failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    console.error('Full error:', error);
  }
}

diagnoseEmailIssue();