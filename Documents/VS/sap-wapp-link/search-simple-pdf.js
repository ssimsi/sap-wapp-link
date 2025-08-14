import Imap from 'imap';
import { simpleParser } from 'mailparser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class SimplePDFSearcher {
  constructor() {
    this.imap = new Imap({
      user: process.env.EMAIL_USERNAME,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      tls: process.env.EMAIL_SECURE === 'true',
      tlsOptions: {
        rejectUnauthorized: false
      }
    });
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('✅ Connected to email server');
        resolve();
      });

      this.imap.once('error', (err) => {
        reject(err);
      });

      this.imap.connect();
    });
  }

  async selectInbox() {
    return new Promise((resolve, reject) => {
      this.imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ Opened inbox with ${box.messages.total} messages`);
          resolve(box);
        }
      });
    });
  }

  async searchRecentEmails() {
    return new Promise((resolve, reject) => {
      // Just search for all emails - we'll limit the results later
      this.imap.search(['ALL'], (err, results) => {
        if (err) {
          reject(err);
        } else {
          console.log(`🔍 Found ${results.length} total emails`);
          resolve(results || []);
        }
      });
    });
  }

  async fetchEmail(uid) {
    return new Promise((resolve, reject) => {
      const f = this.imap.fetch(uid, { 
        bodies: '',
        struct: true
      });

      f.on('message', (msg, seqno) => {
        let buffer = '';
        
        msg.on('body', (stream, info) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', async () => {
          try {
            const parsed = await simpleParser(buffer);
            resolve(parsed);
          } catch (parseError) {
            reject(parseError);
          }
        });
      });

      f.once('error', (err) => {
        reject(err);
      });

      f.once('end', () => {
        // Message fetch completed
      });
    });
  }

  async searchForPDF9008535() {
    console.log('🔍 Searching for Invoice 9008535 PDF');
    console.log('=' * 50);
    
    try {
      // Connect to email
      await this.connect();
      
      // Select inbox
      await this.selectInbox();
      
      // Search for recent emails
      const uids = await this.searchRecentEmails();
      
      if (uids.length === 0) {
        console.log('📭 No recent emails found');
        return;
      }

      // Limit search to recent 50 emails to avoid timeout
      const limitedUids = uids.slice(-50);
      console.log(`📧 Checking last ${limitedUids.length} emails for PDFs...`);
      
      let found9008535 = false;
      let pdfCount = 0;
      let emailsChecked = 0;
      
      for (const uid of limitedUids) {
        try {
          emailsChecked++;
          const email = await this.fetchEmail(uid);
          
          console.log(`\n📧 Email ${emailsChecked}/${limitedUids.length}:`);
          console.log(`   📅 Date: ${email.date ? email.date.toLocaleDateString() : 'Unknown'}`);
          console.log(`   👤 From: ${email.from?.text || 'Unknown'}`);
          console.log(`   📋 Subject: ${email.subject || 'No subject'}`);
          
          // Check attachments
          if (email.attachments && email.attachments.length > 0) {
            console.log(`   📎 Attachments (${email.attachments.length}):`);
            
            for (const attachment of email.attachments) {
              const filename = attachment.filename || attachment.generatedFileName || 'unnamed';
              console.log(`      📄 ${filename} (${attachment.size || 0} bytes)`);
              
              if (filename.toLowerCase().includes('.pdf')) {
                pdfCount++;
                
                // Check if this PDF is for invoice 9008535
                if (filename.includes('9008535')) {
                  console.log(`      🎯 FOUND! Invoice 9008535 PDF: ${filename}`);
                  found9008535 = true;
                  
                  console.log(`      📋 Email details:`);
                  console.log(`         📅 Date: ${email.date}`);
                  console.log(`         👤 From: ${email.from?.text}`);
                  console.log(`         📧 Subject: ${email.subject}`);
                  console.log(`         📄 PDF File: ${filename}`);
                  console.log(`         💾 Size: ${attachment.size} bytes`);
                  
                  // Check if the subject or body mentions the invoice
                  if (email.subject && email.subject.includes('9008535')) {
                    console.log(`      ✅ Subject also mentions 9008535`);
                  }
                  
                  if (email.text && email.text.includes('9008535')) {
                    console.log(`      ✅ Email body also mentions 9008535`);
                  }
                }
              }
            }
          } else {
            console.log(`   📎 No attachments`);
          }
          
          // Add small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (emailError) {
          console.log(`   ❌ Error processing email ${uid}: ${emailError.message}`);
        }
      }
      
      // Summary
      console.log('\n📊 Search Summary:');
      console.log(`   📧 Emails checked: ${emailsChecked}`);
      console.log(`   📄 PDFs found: ${pdfCount}`);
      console.log(`   🎯 Invoice 9008535: ${found9008535 ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
      
      if (!found9008535) {
        console.log('\n💡 Suggestions:');
        console.log('   1. Check if invoice 9008535 has been sent via email');
        console.log('   2. Verify the PDF filename contains "9008535"');
        console.log('   3. Check older emails (searched last 30 days)');
        console.log('   4. Confirm email is in the monitored inbox');
      }
      
    } catch (error) {
      console.error('❌ Search failed:', error.message);
    } finally {
      if (this.imap.state !== 'disconnected') {
        this.imap.end();
        console.log('\n📧 Email connection closed');
      }
    }
  }
}

// Run the search
const searcher = new SimplePDFSearcher();
searcher.searchForPDF9008535().then(() => {
  console.log('\n🏁 PDF search completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
