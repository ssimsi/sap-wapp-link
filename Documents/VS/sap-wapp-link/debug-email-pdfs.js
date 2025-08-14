import EmailInvoiceMonitor from './email-invoice-monitor.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugEmailPDFSearch() {
  console.log('🔍 Debugging Email PDF Search');
  console.log('=============================\n');

  const emailMonitor = new EmailInvoiceMonitor();

  try {
    console.log('📧 Connecting to email...');
    await emailMonitor.connect();
    await emailMonitor.openInbox();
    console.log('✅ Email connection successful\n');

    // Get recent emails to see what's available
    console.log('📬 Searching for recent emails with attachments...');
    
    const searchCriteria = [
      ['SINCE', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] // Last 7 days
    ];

    const emailIds = await searchEmails(emailMonitor.imap, searchCriteria);
    console.log(`📧 Found ${emailIds.length} emails in the last 7 days\n`);

    if (emailIds.length === 0) {
      console.log('⚠️ No emails found in the last 7 days');
      console.log('💡 Try checking:');
      console.log('   - Email inbox has recent emails');
      console.log('   - Email connection is to the correct account');
      emailMonitor.disconnect();
      return;
    }

    // Process first few emails to see their content
    const emailsToCheck = emailIds.slice(0, Math.min(5, emailIds.length));
    console.log(`🔍 Examining first ${emailsToCheck.length} emails for PDF attachments:\n`);

    for (let i = 0; i < emailsToCheck.length; i++) {
      const uid = emailsToCheck[i];
      console.log(`📧 Email ${i + 1}/${emailsToCheck.length} (UID: ${uid})`);
      
      try {
        const emailInfo = await examineEmail(emailMonitor.imap, uid);
        console.log(`   Subject: "${emailInfo.subject}"`);
        console.log(`   From: ${emailInfo.from}`);
        console.log(`   Date: ${emailInfo.date}`);
        console.log(`   Attachments: ${emailInfo.attachments.length}`);
        
        if (emailInfo.attachments.length > 0) {
          emailInfo.attachments.forEach((att, index) => {
            console.log(`     ${index + 1}. ${att.filename} (${att.contentType}) - ${att.size} bytes`);
          });
          
          // Check if any attachment is a PDF
          const pdfAttachments = emailInfo.attachments.filter(att => 
            att.contentType === 'application/pdf' || 
            att.filename?.toLowerCase().endsWith('.pdf')
          );
          
          if (pdfAttachments.length > 0) {
            console.log(`   ✅ Found ${pdfAttachments.length} PDF attachment(s)!`);
            
            // Try to extract DocNum from subject
            const docNumMatches = emailInfo.subject.match(/(\d{6,})/g);
            if (docNumMatches) {
              console.log(`   📋 Potential DocNum(s) in subject: ${docNumMatches.join(', ')}`);
            } else {
              console.log(`   ⚠️ No DocNum pattern found in subject`);
            }
          } else {
            console.log(`   📎 Attachments found but none are PDFs`);
          }
        } else {
          console.log(`   📭 No attachments`);
        }
        
        console.log('');
        
      } catch (emailError) {
        console.log(`   ❌ Error examining email: ${emailError.message}\n`);
      }
    }

    // Now test specific DocNum search
    console.log('🔍 Testing DocNum-based search...');
    console.log('Enter a DocNum to search for (or we can try common patterns):\n');
    
    // Try searching for common invoice number patterns
    const testDocNums = ['9000016', '9000015', '9000014', '9000013', '9000012'];
    
    for (const docNum of testDocNums) {
      console.log(`🔍 Searching for emails with DocNum: ${docNum}`);
      
      const docNumSearchCriteria = [
        ['SINCE', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)],
        ['SUBJECT', docNum]
      ];
      
      const docNumEmails = await searchEmails(emailMonitor.imap, docNumSearchCriteria);
      console.log(`   📧 Found ${docNumEmails.length} email(s) with "${docNum}" in subject`);
      
      if (docNumEmails.length > 0) {
        const emailInfo = await examineEmail(emailMonitor.imap, docNumEmails[0]);
        console.log(`   📧 Subject: "${emailInfo.subject}"`);
        
        const pdfAttachments = emailInfo.attachments.filter(att => 
          att.contentType === 'application/pdf' || 
          att.filename?.toLowerCase().endsWith('.pdf')
        );
        
        if (pdfAttachments.length > 0) {
          console.log(`   ✅ Found PDF! ${pdfAttachments[0].filename}`);
          console.log(`   📊 This DocNum search would work for the hybrid service!`);
          break;
        } else {
          console.log(`   ⚠️ Email found but no PDF attachment`);
        }
      }
    }

    emailMonitor.disconnect();
    console.log('\n✅ Email PDF debugging completed');
    
  } catch (error) {
    console.error('❌ Error debugging email PDFs:', error.message);
    emailMonitor.disconnect();
  }
}

function searchEmails(imap, criteria) {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results || []);
      }
    });
  });
}

function examineEmail(imap, uid) {
  return new Promise((resolve, reject) => {
    const f = imap.fetch(uid, { bodies: '' });

    f.on('message', (msg, seqno) => {
      let emailData = '';

      msg.on('body', (stream, info) => {
        stream.on('data', (chunk) => {
          emailData += chunk.toString('utf8');
        });
      });

      msg.once('end', async () => {
        try {
          const { simpleParser } = await import('mailparser');
          const parsed = await simpleParser(emailData);
          
          const attachmentInfo = (parsed.attachments || []).map(att => ({
            filename: att.filename || 'unnamed',
            contentType: att.contentType || 'unknown',
            size: att.content ? att.content.length : 0
          }));
          
          resolve({
            subject: parsed.subject || 'No subject',
            from: parsed.from?.text || 'Unknown sender',
            date: parsed.date || 'Unknown date',
            attachments: attachmentInfo
          });
          
        } catch (parseError) {
          reject(parseError);
        }
      });
    });

    f.once('error', (err) => {
      reject(err);
    });
  });
}

debugEmailPDFSearch().catch(console.error);
