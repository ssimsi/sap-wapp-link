/**
 * Session Alert Email Service
 * Sends email notifications for WhatsApp session expiration warnings
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

class SessionAlertService {
  constructor() {
    this.emailUser = process.env.EMAIL_USER;
    this.emailPassword = process.env.EMAIL_PASSWORD;
    this.alertEmail = process.env.SESSION_ALERT_EMAIL || 'ssimsi@gmail.com';
    this.alertEnabled = process.env.SESSION_ALERT_ENABLED === 'true';
    this.alertThresholdHours = parseInt(process.env.SESSION_ALERT_THRESHOLD_HOURS) || 72; // 3 days
    this.retryHours = parseInt(process.env.SESSION_ALERT_RETRY_HOURS) || 24; // 1 day
    
    this.lastAlertSent = null;
    this.alertLogPath = './logs/session-alerts.json';
    
    // Load previous alert history
    this.loadAlertHistory();
    
    // Initialize transporter
    this.transporter = null;
    this.initializeEmailTransporter();
  }

  initializeEmailTransporter() {
    if (!this.emailUser || !this.emailPassword) {
      console.warn('⚠️ Email credentials not configured - session alerts disabled');
      return;
    }

    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: this.emailUser,
        pass: this.emailPassword
      }
    });

    console.log('📧 Session alert email service initialized');
  }

  // 📊 Check if session needs alert
  async checkSessionAndAlert(sessionInfo) {
    if (!this.alertEnabled || !this.transporter) {
      return;
    }

    try {
      const now = Date.now();
      const sessionAge = now - (sessionInfo?.lastAuth || 0);
      const sessionAgeHours = sessionAge / (1000 * 60 * 60);
      
      console.log(`📊 Session age: ${Math.round(sessionAgeHours)} hours`);
      
      // Check if session is approaching expiration
      if (sessionAgeHours >= this.alertThresholdHours) {
        
        // Check if we recently sent an alert
        const timeSinceLastAlert = this.lastAlertSent ? 
          (now - this.lastAlertSent) / (1000 * 60 * 60) : 999;
        
        if (timeSinceLastAlert >= this.retryHours) {
          await this.sendSessionExpirationAlert(sessionInfo, sessionAgeHours);
        } else {
          console.log(`⏰ Alert cooldown active (${Math.round(timeSinceLastAlert)}h of ${this.retryHours}h)`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error checking session for alerts:', error.message);
    }
  }

  // 📧 Send session expiration warning email
  async sendSessionExpirationAlert(sessionInfo, sessionAgeHours) {
    try {
      const urgencyLevel = this.getUrgencyLevel(sessionAgeHours);
      const subject = `${urgencyLevel.emoji} WhatsApp Session ${urgencyLevel.status} - SAP Integration`;
      
      const htmlContent = this.generateAlertEmailHTML(sessionInfo, sessionAgeHours, urgencyLevel);
      
      const mailOptions = {
        from: this.emailUser,
        to: this.alertEmail,
        subject: subject,
        html: htmlContent,
        priority: urgencyLevel.priority
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      // Log successful alert
      this.lastAlertSent = Date.now();
      this.logAlert('sent', sessionAgeHours, urgencyLevel.status);
      
      console.log(`📧 Session expiration alert sent to ${this.alertEmail}`);
      console.log(`📊 Session age: ${Math.round(sessionAgeHours)} hours (${urgencyLevel.status})`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to send session alert email:', error.message);
      this.logAlert('failed', sessionAgeHours, 'error', error.message);
      return false;
    }
  }

  // 📧 Send session recovery notification
  async sendSessionRecoveryNotification(recoveryType) {
    if (!this.alertEnabled || !this.transporter) {
      return;
    }

    try {
      const subject = '✅ WhatsApp Session Recovered - SAP Integration';
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">✅ Session Recovered</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">WhatsApp session has been restored</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Recovery Details</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <strong>🔄 Recovery Type:</strong> ${recoveryType}<br>
              <strong>📅 Recovery Time:</strong> ${new Date().toLocaleString()}<br>
              <strong>🏥 Status:</strong> Session Active
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50;">
              <strong>✅ Action Result:</strong><br>
              Your WhatsApp session has been successfully recovered and is now active.
              Invoice processing will resume normally.
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
              <strong>💡 Recommendation:</strong><br>
              Monitor the session for the next 24 hours to ensure stability.
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: this.emailUser,
        to: this.alertEmail,
        subject: subject,
        html: htmlContent
      };

      await this.transporter.sendMail(mailOptions);
      
      this.logAlert('recovery', 0, 'recovered', recoveryType);
      console.log('📧 Session recovery notification sent');
      
    } catch (error) {
      console.error('❌ Failed to send recovery notification:', error.message);
    }
  }

  // 📧 Send session failure critical alert
  async sendSessionFailureAlert(failureReason) {
    if (!this.alertEnabled || !this.transporter) {
      return;
    }

    try {
      const subject = '🚨 CRITICAL: WhatsApp Session Failed - SAP Integration';
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f44336, #d32f2f); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🚨 CRITICAL ALERT</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">WhatsApp session has failed completely</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Failure Details</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <strong>❌ Failure Reason:</strong> ${failureReason}<br>
              <strong>📅 Failure Time:</strong> ${new Date().toLocaleString()}<br>
              <strong>🚨 Status:</strong> Session Completely Failed
            </div>
            
            <div style="background: #ffebee; padding: 15px; border-radius: 8px; border-left: 4px solid #f44336;">
              <strong>⚠️ IMMEDIATE ACTION REQUIRED:</strong><br>
              WhatsApp session has failed completely. Invoice notifications are stopped.
              Manual intervention required to restore service.
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196F3;">
              <strong>🔧 Recovery Steps:</strong><br>
              1. Log into your server<br>
              2. Run: <code>node session-manager.js --repair</code><br>
              3. If that fails: <code>node session-manager.js --clean</code><br>
              4. Restart service and scan QR code<br>
              5. Test with a message
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: this.emailUser,
        to: this.alertEmail,
        subject: subject,
        html: htmlContent,
        priority: 'high'
      };

      await this.transporter.sendMail(mailOptions);
      
      this.logAlert('critical', 0, 'failed', failureReason);
      console.log('📧 Critical session failure alert sent');
      
    } catch (error) {
      console.error('❌ Failed to send critical alert:', error.message);
    }
  }

  // 🎨 Generate alert email HTML
  generateAlertEmailHTML(sessionInfo, sessionAgeHours, urgencyLevel) {
    const sessionAgeDays = Math.round(sessionAgeHours / 24 * 10) / 10;
    const lastAuth = sessionInfo?.lastAuth ? 
      new Date(sessionInfo.lastAuth).toLocaleString() : 'Unknown';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${urgencyLevel.color}, ${urgencyLevel.darkColor}); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${urgencyLevel.emoji} Session ${urgencyLevel.status}</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">WhatsApp session requires attention</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Session Status</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <strong>📅 Last Authentication:</strong> ${lastAuth}<br>
            <strong>⏰ Session Age:</strong> ${sessionAgeDays} days (${Math.round(sessionAgeHours)} hours)<br>
            <strong>📱 Client Info:</strong> ${sessionInfo?.clientInfo?.pushname || 'Unknown'}<br>
            <strong>🎯 Alert Threshold:</strong> ${this.alertThresholdHours} hours
          </div>
          
          <div style="background: ${urgencyLevel.bgColor}; padding: 15px; border-radius: 8px; border-left: 4px solid ${urgencyLevel.color};">
            <strong>${urgencyLevel.actionTitle}:</strong><br>
            ${urgencyLevel.actionText}
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196F3;">
            <strong>🔧 Recommended Actions:</strong><br>
            ${urgencyLevel.recommendations.map(rec => `• ${rec}`).join('<br>')}
          </div>
          
          <div style="margin-top: 20px; text-align: center;">
            <p style="color: #666; font-size: 12px;">
              This alert was sent at ${new Date().toLocaleString()}<br>
              Next alert will be sent in ${this.retryHours} hours if issue persists
            </p>
          </div>
        </div>
      </div>
    `;
  }

  // 📊 Get urgency level based on session age
  getUrgencyLevel(sessionAgeHours) {
    if (sessionAgeHours >= 168) { // 7 days
      return {
        emoji: '🚨',
        status: 'CRITICAL',
        priority: 'high',
        color: '#f44336',
        darkColor: '#d32f2f',
        bgColor: '#ffebee',
        actionTitle: '🚨 CRITICAL ACTION REQUIRED',
        actionText: 'Session is very old and may fail at any time. Immediate attention required.',
        recommendations: [
          'Log into your server immediately',
          'Run: node session-manager.js --repair',
          'If repair fails, run: node session-manager.js --clean',
          'Restart service and scan QR code',
          'Test with a message to confirm working'
        ]
      };
    } else if (sessionAgeHours >= 120) { // 5 days
      return {
        emoji: '⚠️',
        status: 'WARNING',
        priority: 'normal',
        color: '#ff9800',
        darkColor: '#f57c00',
        bgColor: '#fff3e0',
        actionTitle: '⚠️ ACTION RECOMMENDED',
        actionText: 'Session is aging and should be refreshed soon to prevent failure.',
        recommendations: [
          'Check session status: node session-manager.js --status',
          'Create backup: node session-manager.js --backup',
          'Consider refreshing session in next 24 hours',
          'Monitor service for any connection issues'
        ]
      };
    } else { // 3+ days
      return {
        emoji: '📢',
        status: 'NOTICE',
        priority: 'low',
        color: '#2196F3',
        darkColor: '#1976D2',
        bgColor: '#e3f2fd',
        actionTitle: '📢 EARLY WARNING',
        actionText: 'Session is getting older. Consider planning a refresh.',
        recommendations: [
          'Monitor session health over next 48 hours',
          'Create backup: node session-manager.js --backup',
          'Plan maintenance window for session refresh',
          'No immediate action required'
        ]
      };
    }
  }

  // 📝 Log alert activity
  logAlert(type, sessionAge, status, details = '') {
    try {
      const logEntry = {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        type: type,
        sessionAgeHours: Math.round(sessionAge),
        status: status,
        details: details,
        email: this.alertEmail
      };

      // Ensure logs directory exists
      const logsDir = path.dirname(this.alertLogPath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Load existing logs
      let logs = [];
      if (fs.existsSync(this.alertLogPath)) {
        logs = JSON.parse(fs.readFileSync(this.alertLogPath, 'utf8'));
      }

      // Add new log and keep last 100 entries
      logs.push(logEntry);
      logs = logs.slice(-100);

      // Save logs
      fs.writeFileSync(this.alertLogPath, JSON.stringify(logs, null, 2));
      
    } catch (error) {
      console.warn('⚠️ Failed to log alert:', error.message);
    }
  }

  // 📂 Load alert history
  loadAlertHistory() {
    try {
      if (fs.existsSync(this.alertLogPath)) {
        const logs = JSON.parse(fs.readFileSync(this.alertLogPath, 'utf8'));
        const lastLog = logs[logs.length - 1];
        
        if (lastLog && lastLog.type === 'sent') {
          this.lastAlertSent = lastLog.timestamp;
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load alert history:', error.message);
    }
  }

  // 📊 Get alert statistics
  getAlertStats() {
    try {
      if (!fs.existsSync(this.alertLogPath)) {
        return { totalAlerts: 0, lastAlert: null, alertTypes: {} };
      }

      const logs = JSON.parse(fs.readFileSync(this.alertLogPath, 'utf8'));
      const alertTypes = {};
      
      logs.forEach(log => {
        alertTypes[log.type] = (alertTypes[log.type] || 0) + 1;
      });

      return {
        totalAlerts: logs.length,
        lastAlert: logs[logs.length - 1] || null,
        alertTypes: alertTypes
      };
      
    } catch (error) {
      console.warn('⚠️ Failed to get alert stats:', error.message);
      return { totalAlerts: 0, lastAlert: null, alertTypes: {} };
    }
  }
}

export default SessionAlertService;
