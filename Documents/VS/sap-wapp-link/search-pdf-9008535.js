import EmailInvoiceMonitor from './email-invoice-monitor.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class PDFSearcher {
  constructor() {
    this.emailMonitor = new EmailInvoiceMonitor();
  }

  async searchForInvoice9008535() {
    console.log('🔍 Searching for PDF of Invoice 9008535');
    console.log('=' * 50);
    
    try {
      // Connect to email
      console.log('📧 Connecting to email inbox...');
      await this.emailMonitor.connect();
      console.log('✅ Email connection established');
      
      // Search for emails with PDFs
      console.log('\n📎 Searching for emails with PDF attachments...');
      const emails = await this.emailMonitor.searchForInvoiceEmails();
      
      console.log(`📬 Found ${emails.length} emails with attachments`);
      
      // Look for invoice 9008535 specifically
      console.log('\n🔍 Looking for invoice 9008535...');
      let found9008535 = false;
      
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        console.log(`\n📧 Email ${i + 1}:`);
        console.log(`   📅 Date: ${email.date}`);
        console.log(`   👤 From: ${email.from[0]?.address || 'Unknown'}`);
        console.log(`   📋 Subject: ${email.subject}`);
        
        // Check if this email has attachments
        if (email.attachments && email.attachments.length > 0) {
          console.log(`   📎 Attachments (${email.attachments.length}):`);
          
          for (const attachment of email.attachments) {
            console.log(`      📄 ${attachment.filename} (${attachment.size} bytes)`);
            
            // Check if filename contains 9008535
            if (attachment.filename.includes('9008535')) {
              console.log(`      🎯 FOUND! Invoice 9008535 PDF: ${attachment.filename}`);
              found9008535 = true;
              
              // Try to extract invoice info from this PDF
              console.log(`      🔍 Extracting invoice info from ${attachment.filename}...`);
              try {
                const invoiceInfo = await this.emailMonitor.extractInvoiceInfoFromPDF(attachment.content);
                console.log(`      ✅ Extraction successful:`);
                console.log(`         📋 Invoice Number: ${invoiceInfo.invoiceNumber || 'Not found'}`);
                console.log(`         👤 Customer: ${invoiceInfo.customer || 'Not found'}`);
                console.log(`         💰 Amount: ${invoiceInfo.amount || 'Not found'}`);
                console.log(`         📅 Date: ${invoiceInfo.date || 'Not found'}`);
                console.log(`         📞 Phones: ${invoiceInfo.phones?.join(', ') || 'None found'}`);
              } catch (extractError) {
                console.log(`      ❌ PDF extraction failed: ${extractError.message}`);
              }
            }
          }
        } else {
          console.log(`   📎 No attachments`);
        }
      }
      
      if (!found9008535) {
        console.log('\n❌ Invoice 9008535 PDF not found in email attachments');
        console.log('📝 Possible reasons:');
        console.log('   1. PDF not yet received in email');
        console.log('   2. PDF filename doesn\'t contain "9008535"');
        console.log('   3. Email not in the monitored inbox');
        console.log('   4. PDF in older emails (search limited)');
        
        // Show what PDFs we DID find
        console.log('\n📄 PDFs found in recent emails:');
        let pdfCount = 0;
        for (const email of emails) {
          if (email.attachments) {
            for (const attachment of email.attachments) {
              if (attachment.filename.toLowerCase().includes('.pdf')) {
                console.log(`   📄 ${attachment.filename} (${new Date(email.date).toLocaleDateString()})`);
                pdfCount++;
              }
            }
          }
        }
        
        if (pdfCount === 0) {
          console.log('   📭 No PDF attachments found in recent emails');
        }
      } else {
        console.log('\n✅ Successfully found invoice 9008535 PDF!');
      }
      
      // Close email connection
      await this.emailMonitor.disconnect();
      console.log('\n📧 Email connection closed');
      
    } catch (error) {
      console.error('❌ PDF search failed:', error.message);
      console.error('Full error:', error);
    }
  }
}

// Run the search
const searcher = new PDFSearcher();
searcher.searchForInvoice9008535().then(() => {
  console.log('\n🏁 PDF search completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
