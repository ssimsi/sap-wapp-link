#!/usr/bin/env node
/**
 * Test Session Email Alerts
 * Quickly test if email notifications are working
 */

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testSessionAlert() {
  console.log('📧 Testing Session Alert Email System...');
  console.log('=======================================');
  
  const emailUser = process.env.EMAIL_USERNAME || process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const alertEmail = process.env.SESSION_ALERT_EMAIL || 'ssimsi@gmail.com';
  const alertEnabled = process.env.SESSION_ALERT_ENABLED === 'true';
  
  console.log(`📧 Alert Email: ${alertEmail}`);
  console.log(`⚡ Alert Enabled: ${alertEnabled}`);
  console.log(`👤 Email User: ${emailUser || 'NOT SET'}`);
  console.log(`🔑 Email Password: ${emailPassword ? 'SET' : 'NOT SET'}`);
  
  if (!alertEnabled) {
    console.log('❌ Session alerts are disabled in configuration');
    return;
  }
  
  if (!emailUser || !emailPassword) {
    console.log('❌ Email credentials not configured');
    console.log('💡 Make sure EMAIL_USERNAME and EMAIL_PASSWORD are set in .env.local');
    return;
  }
  
  try {
    console.log('🔧 Creating email transporter...');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword
      }
    });
    
    console.log('✅ Transporter created successfully');
    
    console.log('\n📤 Sending test email...');
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🧪 TEST ALERT</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Session alert system test</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Test Results</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <strong>📅 Test Time:</strong> ${new Date().toLocaleString()}<br>
            <strong>📧 Target Email:</strong> ${alertEmail}<br>
            <strong>⚡ Alert System:</strong> Working<br>
            <strong>🎯 Test Type:</strong> Email Delivery Test
          </div>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50;">
            <strong>✅ SUCCESS:</strong><br>
            Your session alert email system is working correctly! You will receive notifications when your WhatsApp session needs attention.
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196F3;">
            <strong>📋 Alert Schedule:</strong><br>
            • Early warning at 72+ hours<br>
            • Urgent warning at 120+ hours<br>
            • Critical alert at 168+ hours<br>
            • Recovery notifications when session is restored
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: emailUser,
      to: alertEmail,
      subject: '🧪 TEST: WhatsApp Session Alert System - SAP Integration',
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Test email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
    console.log(`📧 Sent to: ${alertEmail}`);
    
    console.log('\n🎉 Session Alert System Test Completed Successfully!');
    console.log('================================================');
    console.log('✅ Email configuration is working');
    console.log('✅ Session alerts will be sent automatically');
    console.log('✅ Check your email inbox for the test message');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('• Make sure EMAIL_USERNAME and EMAIL_PASSWORD are correct');
    console.log('• For Gmail, use an App Password instead of your regular password');
    console.log('• Check that the email account has "Less secure app access" enabled or use OAuth2');
    console.log('• Verify the SESSION_ALERT_EMAIL address is correct');
  }
}

// Run the test
testSessionAlert().catch(console.error);
