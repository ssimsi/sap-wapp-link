import fs from 'fs';
import path from 'path';

function setupEmailConfiguration() {
  console.log('📧 Email Configuration Setup');
  console.log('============================\n');

  const envPath = '.env.local';
  let envContent = '';

  // Read existing .env.local if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Found existing .env.local file');
  } else {
    console.log('⚠️ No .env.local file found, will create one');
  }

  // Email configuration template
  const emailConfig = `
# Email Configuration for Invoice Monitoring
# Add these settings to monitor an email inbox for invoice PDFs

# Email IMAP Configuration
EMAIL_HOST=imap.gmail.com
EMAIL_PORT=993
EMAIL_SECURE=true
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Email Monitoring Settings
EMAIL_CHECK_INTERVAL=30000  # Check every 30 seconds
EMAIL_MARK_AS_READ=true     # Mark processed emails as read
EMAIL_INBOX=INBOX           # Folder to monitor

# Invoice Detection (optional - will process all emails with PDFs if not set)
INVOICE_EMAIL_SUBJECT_KEYWORDS=factura,invoice,documento
INVOICE_EMAIL_FROM_ADDRESSES=

# PDF Processing
TEMP_PDF_FOLDER=./temp-pdfs
PROCESSED_EMAILS_LOG=./logs/processed-emails.json
`;

  // Check if email config already exists
  if (envContent.includes('EMAIL_HOST')) {
    console.log('✅ Email configuration already exists in .env.local');
  } else {
    // Append email configuration
    envContent += emailConfig;
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Added email configuration to .env.local');
  }

  console.log('\n📝 Next Steps:');
  console.log('1. Edit .env.local and update the email settings:');
  console.log('   - EMAIL_USERNAME: Your email address');
  console.log('   - EMAIL_PASSWORD: Your email password (use App Password for Gmail)');
  console.log('   - EMAIL_HOST: Your email server (imap.gmail.com for Gmail)');
  console.log('');
  console.log('2. For Gmail users:');
  console.log('   - Enable 2-factor authentication');
  console.log('   - Generate an "App Password" in your Google Account settings');
  console.log('   - Use the app password instead of your regular password');
  console.log('');
  console.log('3. Test the configuration:');
  console.log('   npm run test-email');
  console.log('');
  console.log('4. Start the integrated service:');
  console.log('   npm run start-email');
  console.log('');
  console.log('🎯 How it works:');
  console.log('   ✅ Monitors your email inbox for new emails with PDF attachments');
  console.log('   ✅ Extracts invoice information from email subject and filename');
  console.log('   ✅ Sends the PDF via WhatsApp using your existing service');
  console.log('   ✅ Tracks processed emails to avoid duplicates');
  console.log('   ✅ Works with any email service that supports IMAP');

  // Create necessary directories
  const directories = ['./temp-pdfs', './logs'];
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });

  console.log('\n✅ Email monitoring setup complete!');
}

setupEmailConfiguration();
