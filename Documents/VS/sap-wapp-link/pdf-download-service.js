import Imap from 'imap';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class PDFDownloadService {
  constructor() {
    // Set up directories and logging first
    this.pdfFolder = './downloaded-pdfs';
    
    // Ensure directories exist
    if (!fs.existsSync(this.pdfFolder)) {
      fs.mkdirSync(this.pdfFolder, { recursive: true });
    }
    
    // Ensure logs directory exists
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }
    this.logFile = './logs/pdf-download.log';
    
    // Setup duplicate prevention tracking
    this.processedEmailsFile = './logs/processed-emails.json';
    this.processedEmails = this.loadProcessedEmails();
    
    // Now we can safely log
    this.log('🔧 Initializing PDF Download Service...');
    this.log(`📧 Email User: ${process.env.EMAIL_USER || process.env.EMAIL_USERNAME || 'NOT SET'}`);
    this.log(`🔑 Email Password: ${process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET'}`);
    
    this.imap = new Imap({
      user: process.env.EMAIL_USER || process.env.EMAIL_USERNAME,
      password: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { servername: 'imap.gmail.com' }
    });
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync(this.logFile, logMessage);
  }

  loadProcessedEmails() {
    try {
      if (fs.existsSync(this.processedEmailsFile)) {
        const data = fs.readFileSync(this.processedEmailsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.log(`⚠️ Error loading processed emails file: ${error.message}`);
    }
    return { uids: [], lastUpdate: null };
  }

  saveProcessedEmails() {
    try {
      this.processedEmails.lastUpdate = new Date().toISOString();
      fs.writeFileSync(this.processedEmailsFile, JSON.stringify(this.processedEmails, null, 2));
    } catch (error) {
      this.log(`⚠️ Error saving processed emails file: ${error.message}`);
    }
  }

  isEmailAlreadyProcessed(uid) {
    return this.processedEmails.uids.includes(uid);
  }

  markEmailAsProcessed(uid) {
    if (!this.processedEmails.uids.includes(uid)) {
      this.processedEmails.uids.push(uid);
      this.saveProcessedEmails();
    }
  }

  fileAlreadyExists(originalName) {
    try {
      const files = fs.readdirSync(this.pdfFolder);
      return files.some(file => file.includes(originalName));
    } catch (error) {
      this.log(`⚠️ Error checking existing files: ${error.message}`);
      return false;
    }
  }

  async connectToEmail() {
    return new Promise((resolve, reject) => {
      this.log('🔌 Connecting to Gmail IMAP...');
      
      this.imap.once('ready', () => {
        this.log('✅ IMAP connection established');
        this.imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            this.log(`❌ Error opening INBOX: ${err.message}`);
            reject(err);
          } else {
            this.log(`📧 Connected to email inbox - Total messages: ${box.messages.total}`);
            this.log(`📊 Recent messages: ${box.messages.recent}`);
            this.log(`📬 Unseen messages: ${box.messages.unseen}`);
            resolve(box);
          }
        });
      });

      this.imap.once('error', (err) => {
        this.log(`❌ IMAP connection error: ${err.message}`);
        reject(err);
      });
      
      this.imap.connect();
    });
  }

  async searchEmailsFromToday() {
    return new Promise((resolve, reject) => {
      // Search for emails from today (00:00 AM today)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      const searchCriteria = [
        ['SINCE', today],
        ['FROM', 'no_responder@simsiroglu.com.ar']
      ];

      this.imap.search(searchCriteria, (err, results) => {
        if (err) {
          reject(err);
        } else {
          this.log(`🔍 Found ${results?.length || 0} emails from today`);
          resolve(results || []);
        }
      });
    });
  }

  async downloadPDFsFromEmail(uid) {
    return new Promise((resolve, reject) => {
      // Check if this email was already processed
      if (this.isEmailAlreadyProcessed(uid)) {
        this.log(`⏭️ Email UID ${uid} already processed, skipping...`);
        resolve([]);
        return;
      }

      const f = this.imap.fetch(uid, { bodies: '' });
      const downloadedFiles = [];

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
            
            this.log(`📧 Processing email UID ${uid}: "${parsed.subject}"`);
            
            // Look for PDF attachments
            const pdfAttachments = parsed.attachments?.filter(
              att => att.contentType === 'application/pdf' || 
                     att.filename?.toLowerCase().endsWith('.pdf')
            ) || [];

            if (pdfAttachments.length === 0) {
              this.log(`   📎 No PDF attachments found in email "${parsed.subject}"`);
              // Mark as processed even if no PDFs to avoid re-checking
              this.markEmailAsProcessed(uid);
              resolve(downloadedFiles);
              return;
            }

            this.log(`   📎 Found ${pdfAttachments.length} PDF attachment(s)`);
            
            // Download each PDF with duplicate checking
            for (const attachment of pdfAttachments) {
              try {
                const originalName = attachment.filename || `unknown-${Date.now()}.pdf`;
                
                // Check if this file already exists
                if (this.fileAlreadyExists(originalName)) {
                  this.log(`   ⏭️ File already exists, skipping: ${originalName}`);
                  continue;
                }
                
                // Add timestamp to filename to avoid conflicts
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `${timestamp}_${originalName}`;
                const filePath = path.join(this.pdfFolder, fileName);
                
                fs.writeFileSync(filePath, attachment.content);
                downloadedFiles.push({
                  originalName: originalName,
                  filePath: filePath,
                  size: attachment.size,
                  emailSubject: parsed.subject,
                  emailDate: parsed.date,
                  emailUID: uid
                });
                
                this.log(`   💾 Downloaded: ${fileName} (${attachment.size} bytes)`);
              } catch (saveError) {
                this.log(`   ❌ Error saving PDF ${attachment.filename}: ${saveError.message}`);
              }
            }
            
            // Mark email as processed after successful processing
            this.markEmailAsProcessed(uid);
            resolve(downloadedFiles);

          } catch (parseError) {
            this.log(`   ❌ Error parsing email: ${parseError.message}`);
            resolve(downloadedFiles);
          }
        });
      });

      f.once('error', (err) => {
        this.log(`❌ Error fetching email ${uid}: ${err.message}`);
        resolve(downloadedFiles);
      });
    });
  }

  async downloadAllPDFs() {
    try {
      this.log('🚀 Starting PDF download service...');
      
      await this.connectToEmail();
      
      const emailIds = await this.searchEmailsFromToday();
      
      if (emailIds.length === 0) {
        this.log('✅ No new emails found with PDFs from today');
        this.imap.end();
        return;
      }

      let totalDownloaded = 0;
      let totalSkipped = 0;
      
      // Process emails sequentially to avoid overwhelming the server
      for (const uid of emailIds) {
        try {
          if (this.isEmailAlreadyProcessed(uid)) {
            totalSkipped++;
            this.log(`⏭️ Skipping already processed email UID: ${uid}`);
            continue;
          }
          
          const downloadedFiles = await this.downloadPDFsFromEmail(uid);
          totalDownloaded += downloadedFiles.length;
        } catch (error) {
          this.log(`❌ Error processing email ${uid}: ${error.message}`);
        }
      }
      
      this.log(`✅ PDF download complete! Downloaded ${totalDownloaded} new PDFs, skipped ${totalSkipped} already processed emails from ${emailIds.length} total emails`);
      
      // Create a summary file of what was downloaded
      const summaryPath = path.join(this.pdfFolder, `download-summary-${new Date().toISOString().split('T')[0]}.json`);
      const summary = {
        downloadDate: new Date().toISOString(),
        emailsFound: emailIds.length,
        emailsSkipped: totalSkipped,
        emailsProcessed: emailIds.length - totalSkipped,
        pdfsDownloaded: totalDownloaded,
        folderPath: this.pdfFolder,
        totalProcessedEmails: this.processedEmails.uids.length
      };
      
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      
      this.imap.end();
      
    } catch (error) {
      this.log(`❌ PDF download service error: ${error.message}`);
      if (this.imap.state !== 'disconnected') {
        this.imap.end();
      }
    }
  }

  startScheduledService() {
    this.log('📅 PDF Download Service starting - scheduled to run at minute 40 of every hour');
    this.log(`📊 Currently tracking ${this.processedEmails.uids.length} processed emails`);
    
    // Run at minute 40 of every hour (when PDFs should be available)
    cron.schedule('40 * * * *', async () => {
      this.log('⏰ Scheduled PDF download starting...');
      await this.downloadAllPDFs();
    });

    // Clean up old processed email records weekly (every Sunday at 2 AM)
    cron.schedule('0 2 * * 0', () => {
      this.cleanupOldProcessedRecords();
    });

    this.log('✅ PDF Download Service scheduled successfully');
    this.log(`📁 PDFs will be downloaded to: ${path.resolve(this.pdfFolder)}`);
    
    // Calculate next run time
    const now = new Date();
    const nextRun = new Date(now);
    if (now.getMinutes() >= 40) {
      nextRun.setHours(nextRun.getHours() + 1);
    }
    nextRun.setMinutes(40, 0, 0);
    
    this.log(`⏱️ Next download: ${nextRun.toLocaleString()}`);
  }

  cleanupOldProcessedRecords() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const originalCount = this.processedEmails.uids.length;
      
      // For simplicity, we'll keep a maximum of 1000 most recent UIDs
      if (this.processedEmails.uids.length > 1000) {
        this.processedEmails.uids = this.processedEmails.uids.slice(-1000);
        this.saveProcessedEmails();
        
        const newCount = this.processedEmails.uids.length;
        this.log(`🧹 Cleaned up processed emails tracking: ${originalCount} → ${newCount} records`);
      } else {
        this.log(`🧹 Processed emails cleanup: ${originalCount} records (no cleanup needed)`);
      }
    } catch (error) {
      this.log(`❌ Error during processed emails cleanup: ${error.message}`);
    }
  }
}

// Start the service
const pdfService = new PDFDownloadService();

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--manual') || args.includes('--now')) {
  console.log('🔧 Manual PDF download triggered...');
  pdfService.downloadAllPDFs().then(() => {
    console.log('✅ Manual download completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Manual download failed:', error);
    process.exit(1);
  });
} else if (args.includes('--all-today')) {
  console.log('📅 Downloading all emails from today...');
  pdfService.downloadAllPDFs().then(() => {
    console.log('✅ Today\'s download completed');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Today\'s download failed:', error);
    process.exit(1);
  });
} else {
  pdfService.startScheduledService();
}

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n📴 PDF Download Service shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception in PDF Download Service:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection in PDF Download Service:', reason);
  process.exit(1);
});
