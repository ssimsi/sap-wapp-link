// Simple email verification test
import nodemailer from 'nodemailer';

async function verifyEmailDelivery() {
  console.log('📧 Sending simple verification email...');
  
  const transporter = nodemailer.createTransporter({
    host: 'mail.simsiroglu.com.ar',
    port: 465,
    secure: true,
    auth: {
      user: 'no_responder@simsiroglu.com.ar',
      pass: 'Larrea*551'
    }
  });
  
  try {
    const mailOptions = {
      from: {
        name: 'Simsiroglu Test',
        address: 'no_responder@simsiroglu.com.ar'
      },
      to: 'ssimsi@gmail.com',
      subject: `Email Test - ${new Date().toLocaleTimeString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Email Delivery Test</h2>
          <p>This is a simple test email sent at: <strong>${new Date().toLocaleString()}</strong></p>
          <p>If you receive this email, then email delivery is working correctly.</p>
          
          <div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3>Previous Email Status:</h3>
            <p>• Simple test: Should have been delivered</p>
            <p>• Logo test: Should have been delivered</p>
            <p>• Invoice email: Should have been delivered</p>
          </div>
          
          <h3>🔍 Check These Locations:</h3>
          <ul>
            <li><strong>Gmail Inbox</strong> - Primary tab</li>
            <li><strong>Promotions tab</strong> - Automated emails often go here</li>
            <li><strong>Spam folder</strong> - Check for Simsiroglu emails</li>
            <li><strong>All Mail</strong> - Search for "Simsiroglu" or "no_responder"</li>
          </ul>
          
          <p>Timestamp: ${Date.now()}</p>
        </div>
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent successfully!`);
    console.log(`📬 MessageId: ${result.messageId}`);
    console.log(`⏰ Sent at: ${new Date().toLocaleString()}`);
    
    console.log('\n📋 Email Delivery Checklist:');
    console.log('1. Check Gmail Primary inbox');
    console.log('2. Check Promotions tab');
    console.log('3. Check Spam folder');
    console.log('4. Search "Simsiroglu" in Gmail');
    console.log('5. Search "no_responder@simsiroglu.com.ar" in Gmail');
    
  } catch (error) {
    console.error('❌ Verification email failed:', error.message);
  }
}

verifyEmailDelivery();