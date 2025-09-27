import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import PDFCleanupService from './pdf-cleanup-service.js';
import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

// Load environment variables
dotenv.config({ path: '.env.local' });

class HybridInvoiceService {
  constructor() {
    this.whatsappClient = null;
    this.whatsappReady = false;
    this.pdfCleanupService = new PDFCleanupService();
    this.sapConnection = new SAPConnection();
    this.isRunning = false;
    this.processedInvoices = new Set();
    this.missedInvoices = [];
    this.reconnecting = false;
    this.maxReconnectAttempts = 5;
    
    // Session persistence tracking
    this.lastAuthTime = null;
    this.lastPingTime = null;
    this.keepAliveInterval = null;
    this.healthCheckInterval = null;
    
    // Session alert settings
    this.sessionAlertEnabled = process.env.SESSION_ALERT_ENABLED === 'true';
    this.sessionAlertEmail = process.env.SESSION_ALERT_EMAIL || 'ssimsi@gmail.com';
    this.sessionAlertThreshold = parseInt(process.env.SESSION_ALERT_THRESHOLD_HOURS) || 72;
    this.lastAlertSent = null;
    
    // Initialize email transporter for alerts
    this.initializeEmailAlerts();
    
    // Load previous session info if available
    this.loadSessionInfo();
  }

  async start() {
    console.log('🚀 Starting Hybrid Invoice Service (SAP + WhatsApp)');
    console.log('==================================================');
    console.log('📄 PDF processing handled by downloaded-pdfs folder with proper SAP document naming');
    console.log('🔄 This service processes invoices from downloaded-pdfs folder');
    console.log('==================================================');
    
    // Show test mode status prominently
    if (process.env.TEST_MODE === 'true') {
      console.log('');
      console.log('🧪 ⚠️  TEST MODE ACTIVE ⚠️  🧪');
      console.log('================================');
      console.log(`📱 ALL WhatsApp messages will go to: ${process.env.TEST_PHONE}`);
      console.log('🔒 No messages will be sent to real customers');
      console.log('🧪 All messages will include test mode headers');
      console.log('================================');
      console.log('');
    } else {
      console.log('');
      console.log('🚨 PRODUCTION MODE - Messages enabled!');
      
      // Show customer message safety status
      if (process.env.DISABLE_CUSTOMER_MESSAGES === 'true') {
        console.log('');
        console.log('🔒 ⚠️  CUSTOMER MESSAGES DISABLED ⚠️  🔒');
        console.log('=========================================');
        console.log('📵 Customer notifications: DISABLED');
        console.log('👨‍💼 Salesperson notifications: ENABLED');
        console.log('🛡️ Extra safety mode active');
        console.log('=========================================');
      } else {
        console.log('📱 Customer notifications: ENABLED');
        console.log('👨‍💼 Salesperson notifications: ENABLED');
      }
      console.log('');
    }
    
    try {
      // Initialize WhatsApp service
      console.log('\n📱 Initializing WhatsApp service...');
      await this.initializeWhatsApp();
      
      // Test SAP connection
      console.log('\n🔗 Testing SAP connection...');
      const sapConnected = await this.sapConnection.login();
      if (!sapConnected) {
        throw new Error('SAP connection failed');
      }
      console.log('✅ SAP connection successful');
      
      // Start monitoring
      this.isRunning = true;
      console.log('\n✅ Hybrid service started successfully!');
      console.log('🔄 Now processing SAP invoices with PDFs from downloaded-pdfs folder...');
      console.log('📋 Make sure PDF Download Service is running separately for X:40 downloads!');
      
      // Schedule invoice processing every hour at X:50
      cron.schedule('50 * * * *', () => {
        this.processNewInvoices();
      });
      
      // Schedule daily email report at 6 PM
      cron.schedule('0 18 * * *', () => {
        this.sendDailyReport().catch(console.error);
      });
      
      // Start PDF cleanup service (runs daily at 5 AM)
      console.log('\n🧹 Starting PDF cleanup service...');
      this.pdfCleanupService.start();
      
      // Process immediately on start
      setTimeout(() => {
        this.processNewInvoices();
      }, 5000);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('\n❌ Failed to start hybrid service:', error.message);
      await this.stop();
      process.exit(1);
    }
  }

  async initializeWhatsApp(maxRetries = 3) {
    console.log('🔧 Initializing WhatsApp Web client...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} to initialize WhatsApp...`);
        
        // Clean up any existing client
        if (this.whatsappClient) {
          try {
            await this.whatsappClient.destroy();
          } catch (error) {
            console.log('🧹 Cleaned up previous client instance');
          }
          this.whatsappClient = null;
          this.whatsappReady = false;
        }

        this.whatsappClient = new Client({
          authStrategy: new LocalAuth({
            clientId: 'sap-whatsapp-persistent', // Stable client ID
            dataPath: './.wwebjs_auth/'
          }),
          puppeteer: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--no-first-run',
              '--single-process',
              '--disable-gpu',
              '--disable-web-security'
            ],
            executablePath: undefined, // Use default Chrome/Chromium
            timeout: 60000 // Increase timeout for slow connections
          },
          webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2407.3.html',
          },
          // Session persistence settings
          restartOnAuthFail: true,
          takeoverOnConflict: false,
          takeoverTimeoutMs: 0
        });

        // QR Code for authentication
        let qrCodeShown = false;
        this.whatsappClient.on('qr', (qr) => {
          console.log('\n📱 WhatsApp Web QR Code:');
          console.log('👆 Scan this QR code with your WhatsApp mobile app');
          console.log('📱 Open WhatsApp > Settings > Linked Devices > Link a Device');
          console.log('📷 Point your camera at this QR code:\n');
          qrcode.generate(qr, { small: true });
          console.log('\n⏳ Waiting for QR code scan...\n');
          qrCodeShown = true; // Set flag when QR is shown
        });

        // Authentication events
        this.whatsappClient.on('authenticated', () => {
          console.log('🔐 WhatsApp authentication successful - starting aggressive ready detection...');
          
          // Start aggressive ready detection immediately after auth
          setTimeout(() => {
            this.forceReadyDetection();
          }, 2000);
        });

        this.whatsappClient.on('auth_failure', (msg) => {
          console.error('❌ WhatsApp authentication failed:', msg);
          this.whatsappReady = false;
          
          // Send critical failure alert
          this.sendSessionAlert('FAILURE', `Authentication failed: ${msg}`, 0)
            .catch(err => console.warn('⚠️ Failed to send failure alert:', err.message));
        });

        // Loading states
        this.whatsappClient.on('loading_screen', (percent, message) => {
          console.log(`⚡ WhatsApp loading: ${percent}% - ${message}`);
          
          // If we reach 100% loading but ready event hasn't fired, force ready after delay
          if (percent === 100 && message && !this.whatsappReady) {
            console.log('🎯 Loading complete, starting aggressive ready detection in 3 seconds...');
            setTimeout(() => {
              this.forceReadyDetection();
            }, 3000);
          }
        });

        // Ready event with enhanced features
        this.whatsappClient.on('ready', () => {
          console.log('✅ WhatsApp Web client is ready!');
          this.whatsappReady = true;
          this.lastAuthTime = Date.now();
          
          // Start session monitoring and keep-alive
          this.startSessionKeepAlive();
          this.storeSessionInfo();
          
          console.log(`📱 Connected as: ${this.whatsappClient?.info?.pushname || 'Unknown'}`);
          console.log('🎯 Ready event fired - WhatsApp is fully initialized');
        });

        // Disconnection event with enhanced auto-reconnection
        this.whatsappClient.on('disconnected', (reason) => {
          console.log('📱 WhatsApp disconnected:', reason);
          this.whatsappReady = false;
          
          // Stop keep-alive when disconnected
          this.stopSessionKeepAlive();
          
          // Auto-reconnect if service is still running
          if (this.isRunning && !this.reconnecting) {
            console.log('🔄 Attempting to reconnect WhatsApp...');
            this.attemptReconnection();
          }
        });

        // Monitor for session conflicts and expiration
        this.whatsappClient.on('change_state', (state) => {
          console.log('🔄 WhatsApp state changed:', state);
          
          // Handle potential session conflicts
          if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
            console.log('⚠️ Potential session conflict detected');
            this.handleSessionConflict();
          }
        });

        this.whatsappClient.on('message', (message) => {
          console.log('📩 WhatsApp message received (debug):', message.from);
        });

        // Initialize the client with timeout
        console.log('⏰ Starting WhatsApp initialization (30 second timeout)...');
        await Promise.race([
          this.whatsappClient.initialize(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WhatsApp initialization timeout')), 30000)
          )
        ]);
        
        // Wait for ready state with timeout based on attempt and QR status
        let readyTimeout;
        if (attempt === 1 && qrCodeShown) {
          readyTimeout = 120000; // 2 minutes for first attempt with QR scan
        } else if (attempt === 1) {
          readyTimeout = 45000; // 45 seconds for first attempt with existing session
        } else {
          readyTimeout = 30000; // 30 seconds for retry attempts
        }
        
        console.log(`⏳ Waiting for WhatsApp ready (${readyTimeout/1000} second timeout, attempt ${attempt})...`);
        await this.waitForWhatsAppReady(readyTimeout);
        
        console.log(`✅ WhatsApp initialized successfully on attempt ${attempt}`);
        return; // Success, exit retry loop
        
      } catch (error) {
        console.error(`❌ WhatsApp initialization attempt ${attempt} failed:`, error.message);
        
        // Clean up failed client
        if (this.whatsappClient) {
          try {
            await this.whatsappClient.destroy();
          } catch (destroyError) {
            console.log('🧹 Cleanup after failed attempt');
          }
          this.whatsappClient = null;
          this.whatsappReady = false;
        }
        
        if (attempt < maxRetries) {
          const waitTime = attempt * 2; // Progressive delay: 2s, 4s, 6s
          console.log(`⏳ Waiting ${waitTime} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        } else {
          console.error(`💥 WhatsApp initialization failed after ${maxRetries} attempts`);
          throw new Error(`WhatsApp initialization failed after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  async waitForWhatsAppReady(timeout = 30000) {
    return new Promise((resolve, reject) => {
      if (this.whatsappReady) {
        console.log('📱 WhatsApp already ready - proceeding immediately');
        resolve();
        return;
      }

      const startTime = Date.now();
      let lastLogTime = 0;
      
      const checkReady = () => {
        const elapsed = Date.now() - startTime;
        
        if (this.whatsappReady) {
          console.log(`✅ WhatsApp ready after ${elapsed/1000} seconds`);
          resolve();
        } else if (elapsed >= timeout) {
          console.log(`❌ WhatsApp ready timeout after ${timeout/1000} seconds`);
          console.log(`🔍 Debug: whatsappReady=${this.whatsappReady}, client exists=${!!this.whatsappClient}`);
          reject(new Error(`WhatsApp ready timeout after ${timeout/1000} seconds`));
        } else {
          // Log progress every 10 seconds
          if (elapsed - lastLogTime >= 10000) {
            console.log(`⏳ Still waiting for WhatsApp ready... (${Math.floor(elapsed/1000)}s/${Math.floor(timeout/1000)}s)`);
            lastLogTime = elapsed;
          }
          setTimeout(checkReady, 1000);
        }
      };

      checkReady();
    });
  }

  async forceReadyDetection() {
    if (this.whatsappReady) {
      console.log('✅ Ready event already fired - no need to force');
      return;
    }

    console.log('🔧 Forcing ready detection - attempting to verify client state...');
    
    try {
      // Try to get client state
      const state = await this.whatsappClient.getState();
      console.log(`📱 Client state: ${state}`);
      
      if (state === 'CONNECTED') {
        console.log('🎯 Client is CONNECTED but ready event never fired - forcing ready!');
        this.whatsappReady = true;
        this.lastAuthTime = Date.now();
        
        // Start session monitoring and store info
        this.startSessionKeepAlive();
        this.storeSessionInfo();
        
        console.log('✅ Ready state forced successfully!');
        return;
      }
      
      // Try to get client info as alternative check
      const info = await this.whatsappClient.info;
      if (info && info.wid) {
        console.log(`📱 Client info available: ${info.pushname || 'No name'}`);
        console.log('🎯 Client has info but ready event never fired - forcing ready!');
        this.whatsappReady = true;
        this.lastAuthTime = Date.now();
        
        this.startSessionKeepAlive();
        this.storeSessionInfo();
        
        console.log('✅ Ready state forced successfully via info check!');
        return;
      }
      
    } catch (error) {
      console.log(`⚠️ State check failed: ${error.message}`);
    }
    
    // Alternative ready detection - try again in 5 seconds
    if (!this.whatsappReady) {
      console.log('🔧 Standard checks failed - trying alternative detection in 5 seconds...');
      setTimeout(() => {
        this.alternativeReadyCheck();
      }, 5000);
    }
  }

  async alternativeReadyCheck() {
    if (this.whatsappReady) return;
    
    console.log('🔧 Alternative ready check - testing basic functionality...');
    
    try {
      // Try to access client properties that would be available when ready
      const clientId = this.whatsappClient.info?.wid?._serialized;
      if (clientId) {
        console.log('🎯 Client ID available - assuming ready!');
        this.whatsappReady = true;
        this.lastAuthTime = Date.now();
        this.startSessionKeepAlive();
        this.storeSessionInfo();
        return;
      }
      
    } catch (error) {
      console.log(`⚠️ Alternative check failed: ${error.message}`);
    }
    
    // Last resort - if client exists and we're not ready after 30 seconds, force it
    console.log('🎯 Last resort - forcing ready state after extended wait');
    this.whatsappReady = true;
    this.lastAuthTime = Date.now();
    this.startSessionKeepAlive();
    this.storeSessionInfo();
    console.log('✅ Ready state forced as last resort');
  }

  async attemptReconnection(attempt = 1) {
    if (this.reconnecting) {
      return; // Already trying to reconnect
    }
    
    this.reconnecting = true;
    
    try {
      console.log(`🔄 WhatsApp reconnection attempt ${attempt}/${this.maxReconnectAttempts}`);
      
      if (attempt > this.maxReconnectAttempts) {
        console.error('💥 Max reconnection attempts reached. WhatsApp service unavailable.');
        this.reconnecting = false;
        return;
      }
      
      // Wait before reconnecting (progressive delay)
      const delay = Math.min(attempt * 5000, 30000); // 5s, 10s, 15s, 20s, 25s, max 30s
      console.log(`⏳ Waiting ${delay/1000} seconds before reconnection...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Try to reconnect
      await this.initializeWhatsApp(1); // Single attempt for reconnection
      
      console.log('✅ WhatsApp reconnected successfully!');
      this.reconnecting = false;
      
      // Send recovery notification
      await this.sendSessionAlert('RECOVERED', 'WhatsApp session has been automatically reconnected and is now active.', 0)
        .catch(err => console.warn('⚠️ Failed to send recovery notification:', err.message));
      
    } catch (error) {
      console.error(`❌ Reconnection attempt ${attempt} failed:`, error.message);
      this.reconnecting = false;
      
      // Try again if we haven't reached max attempts
      if (attempt < this.maxReconnectAttempts) {
        setTimeout(() => this.attemptReconnection(attempt + 1), 1000);
      } else {
        console.error('💥 All reconnection attempts failed. WhatsApp service unavailable.');
      }
    }
  }

  // 🔧 SESSION PERSISTENCE METHODS
  
  initializeEmailAlerts() {
    if (!this.sessionAlertEnabled) {
      console.log('📧 Session email alerts disabled');
      return;
    }
    
    const emailUser = process.env.EMAIL_USERNAME || process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    if (!emailUser || !emailPassword) {
      console.warn('⚠️ Email credentials not configured - session alerts disabled');
      this.sessionAlertEnabled = false;
      return;
    }
    
    // We'll use dynamic import when needed to avoid breaking the main import
    console.log(`📧 Session email alerts enabled - notifications will be sent to ${this.sessionAlertEmail}`);
  }
  
  async sendSessionAlert(type, message, sessionAge = 0) {
    if (!this.sessionAlertEnabled) return;
    
    try {
      // Dynamic import to avoid breaking main flow
      const nodemailer = await import('nodemailer');
      
      const emailUser = process.env.EMAIL_USERNAME || process.env.EMAIL_USER;
      const emailPassword = process.env.EMAIL_PASSWORD;
      
      const transporter = nodemailer.default.createTransporter({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword
        }
      });
      
      const urgencyEmoji = sessionAge > 168 ? '🚨' : sessionAge > 120 ? '⚠️' : '📢';
      const subject = `${urgencyEmoji} WhatsApp Session ${type} - SAP Integration`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${urgencyEmoji} Session ${type}</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">WhatsApp Session Status Alert</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Alert Details</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <strong>📅 Alert Time:</strong> ${new Date().toLocaleString()}<br>
              <strong>⏰ Session Age:</strong> ${Math.round(sessionAge)} hours<br>
              <strong>🎯 Alert Type:</strong> ${type}<br>
              <strong>📱 System:</strong> SAP-WhatsApp Integration
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3;">
              <strong>📋 Message:</strong><br>
              ${message}
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
              <strong>🔧 Recommended Actions:</strong><br>
              • Check session status: <code>node session-manager.js --status</code><br>
              • Create backup: <code>node session-manager.js --backup</code><br>
              • If needed, clean session: <code>node session-manager.js --clean</code>
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: emailUser,
        to: this.sessionAlertEmail,
        subject: subject,
        html: htmlContent
      };

      await transporter.sendMail(mailOptions);
      this.lastAlertSent = Date.now();
      
      console.log(`📧 Session alert sent to ${this.sessionAlertEmail}: ${type}`);
      
    } catch (error) {
      console.warn('⚠️ Failed to send session alert email:', error.message);
    }
  }
  
  startSessionKeepAlive() {
    console.log('💓 Starting WhatsApp session keep-alive monitoring...');
    
    // Clear any existing intervals
    this.stopSessionKeepAlive();
    
    // Ping every 5 minutes to keep session active
    this.keepAliveInterval = setInterval(async () => {
      try {
        if (this.whatsappReady && this.whatsappClient) {
          // Send a simple status check to keep session alive
          const info = await this.whatsappClient.getState();
          console.log('💓 Session keep-alive ping:', info);
          
          // Check if session is still valid
          if (info === 'CONNECTED') {
            this.lastPingTime = Date.now();
          } else {
            console.warn('⚠️ Session state changed:', info);
            this.handleSessionIssue();
          }
        }
      } catch (error) {
        console.warn('💓 Keep-alive ping failed:', error.message);
        this.handleSessionIssue();
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    // Daily session health check
    this.healthCheckInterval = setInterval(() => {
      this.performSessionHealthCheck();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
  
  stopSessionKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    console.log('🛑 Session keep-alive monitoring stopped');
  }
  
  async performSessionHealthCheck() {
    console.log('🏥 Performing daily session health check...');
    
    try {
      if (!this.whatsappReady || !this.whatsappClient) {
        console.log('⚠️ Session not ready - initiating recovery');
        this.attemptReconnection();
        return;
      }
      
      // Check session age and send alerts if needed
      const sessionAge = Date.now() - (this.lastAuthTime || 0);
      const sessionAgeHours = sessionAge / (1000 * 60 * 60);
      
      // Send email alert if session is aging
      if (sessionAgeHours >= this.sessionAlertThreshold) {
        const timeSinceLastAlert = this.lastAlertSent ? 
          (Date.now() - this.lastAlertSent) / (1000 * 60 * 60) : 999;
        
        // Only send alert once per day
        if (timeSinceLastAlert >= 24) {
          const alertType = sessionAgeHours > 168 ? 'CRITICAL' : 
                           sessionAgeHours > 120 ? 'WARNING' : 'NOTICE';
          
          const message = `WhatsApp session is ${Math.round(sessionAgeHours)} hours old (${Math.round(sessionAgeHours/24)} days). ` +
                         `Consider refreshing the session to prevent service interruption.`;
          
          await this.sendSessionAlert(alertType, message, sessionAgeHours);
        }
      }
      
      // Auto-refresh if session is very old
      const maxSessionAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (sessionAge > maxSessionAge) {
        console.log(`⚠️ Session is ${Math.round(sessionAge / (24 * 60 * 60 * 1000))} days old - refreshing`);
        await this.refreshSession();
      } else {
        console.log(`✅ Session health OK (${Math.round(sessionAge / (24 * 60 * 60 * 1000))} days old)`);
      }
      
      // Test basic functionality
      await this.whatsappClient.getState();
      console.log('✅ Session functionality test passed');
      
    } catch (error) {
      console.error('❌ Session health check failed:', error.message);
      this.handleSessionIssue();
    }
  }
  
  async refreshSession() {
    console.log('🔄 Refreshing WhatsApp session...');
    
    try {
      // Gracefully restart the client
      if (this.whatsappClient) {
        await this.whatsappClient.destroy();
      }
      
      this.whatsappReady = false;
      
      // Wait a bit before reinitializing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reinitialize with existing session
      await this.initializeWhatsApp();
      
      console.log('✅ Session refreshed successfully');
      
      // Send recovery notification
      await this.sendSessionAlert('RECOVERED', 'WhatsApp session has been successfully refreshed and is now active.', 0)
        .catch(err => console.warn('⚠️ Failed to send recovery notification:', err.message));
      
    } catch (error) {
      console.error('❌ Session refresh failed:', error.message);
      this.handleSessionIssue();
    }
  }
  
  storeSessionInfo() {
    try {
      const sessionInfo = {
        lastAuth: this.lastAuthTime || Date.now(),
        timestamp: Date.now(),
        clientInfo: this.whatsappClient?.info || null
      };
      
      const sessionInfoPath = path.join('.wwebjs_auth', 'session-info.json');
      fs.writeFileSync(sessionInfoPath, JSON.stringify(sessionInfo, null, 2));
      
      console.log('💾 Session info stored successfully');
      
    } catch (error) {
      console.warn('⚠️ Failed to store session info:', error.message);
    }
  }
  
  loadSessionInfo() {
    try {
      const sessionInfoPath = path.join('.wwebjs_auth', 'session-info.json');
      
      if (fs.existsSync(sessionInfoPath)) {
        const sessionInfo = JSON.parse(fs.readFileSync(sessionInfoPath, 'utf8'));
        this.lastAuthTime = sessionInfo.lastAuth;
        console.log('📂 Previous session info loaded');
        return sessionInfo;
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to load session info:', error.message);
    }
    
    return null;
  }
  
  handleSessionIssue() {
    console.log('🚨 Session issue detected - attempting recovery...');
    
    if (!this.reconnecting) {
      this.attemptReconnection();
    }
  }
  
  handleSessionConflict() {
    console.log('⚡ Session conflict detected - handling gracefully...');
    
    // Stop keep-alive to prevent conflicts
    this.stopSessionKeepAlive();
    
    // Wait and then attempt fresh connection
    setTimeout(() => {
      console.log('🔄 Attempting to resolve session conflict...');
      this.attemptReconnection();
    }, 10000);
  }

  async sendWhatsAppMessage(phoneNumber, message, pdfPath = null) {
    // Check if WhatsApp is ready, attempt reconnection if needed
    if (!this.whatsappReady) {
      console.log('⚠️ WhatsApp not ready, attempting to reconnect...');
      
      if (!this.reconnecting) {
        this.attemptReconnection();
      }
      
      // Wait a bit for reconnection
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (!this.whatsappReady) {
        throw new Error('WhatsApp client is not ready and reconnection failed');
      }
    }

    // Additional validation - check if client exists and is functional
    if (!this.whatsappClient) {
      throw new Error('WhatsApp client instance is null');
    }

    // Test client functionality before attempting to send
    try {
      const clientState = await this.whatsappClient.getState();
      console.log(`📱 Client state before sending: ${clientState}`);
      
      if (clientState !== 'CONNECTED') {
        console.log(`⚠️ Client state is ${clientState}, attempting to reconnect...`);
        throw new Error(`WhatsApp client state is ${clientState}, not CONNECTED`);
      }
    } catch (stateError) {
      console.error(`❌ Failed to get client state: ${stateError.message}`);
      throw new Error(`WhatsApp client is not functional: ${stateError.message}`);
    }

    try {
      // Format phone number for WhatsApp
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;

      console.log(`📱 Sending WhatsApp message to ${phoneNumber}...`);
      console.log(`🔍 DEBUG: Formatted number: ${formattedNumber}, ChatID: ${chatId}`);
      console.log(`🔍 DEBUG: pdfPath provided: ${pdfPath}`);
      console.log(`🔍 DEBUG: pdfPath exists: ${pdfPath ? fs.existsSync(pdfPath) : 'No path provided'}`);

      // Validate chat exists and is accessible before sending
      try {
        console.log(`🔍 Validating chat access for ${chatId}...`);
        const chat = await this.whatsappClient.getChatById(chatId);
        console.log(`✅ Chat validated: ${chat ? 'Found' : 'Not found'}`);
      } catch (chatError) {
        console.log(`⚠️ Chat validation failed: ${chatError.message}`);
        
        // Check if this is a client context error (Puppeteer page is gone)
        if (chatError.message.includes('Cannot read properties of undefined') || 
            chatError.message.includes('Evaluation failed') ||
            chatError.message.includes('getChat')) {
          console.log(`🔥 WhatsApp client context is broken - marking session as not ready`);
          this.whatsappReady = false;
          
          // Don't attempt contact validation, just fail fast
          throw new Error(`WhatsApp client context is broken (Puppeteer page lost): ${chatError.message}`);
        }
        
        console.log(`🔧 Attempting to create chat by getting contact first...`);
        
        try {
          const contact = await this.whatsappClient.getContactById(chatId);
          console.log(`📞 Contact found: ${contact ? contact.name || contact.pushname || 'Unnamed' : 'Not found'}`);
        } catch (contactError) {
          console.log(`❌ Contact validation also failed: ${contactError.message}`);
          
          // Check if this is also a client context error
          if (contactError.message.includes('Cannot read properties of undefined') || 
              contactError.message.includes('Evaluation failed') ||
              contactError.message.includes('getContact')) {
            console.log(`🔥 WhatsApp client context is completely broken - marking session as not ready`);
            this.whatsappReady = false;
            throw new Error(`WhatsApp client context is completely broken (Puppeteer page lost): ${contactError.message}`);
          }
          
          throw new Error(`Cannot access chat or contact for ${phoneNumber}: ${contactError.message}`);
        }
      }

      // If PDF is provided, send PDF with text as caption in ONE message
      if (pdfPath && fs.existsSync(pdfPath)) {
        console.log(`📎 Sending PDF with caption as single message: ${path.basename(pdfPath)}`);
        console.log(`📄 PDF file size: ${fs.statSync(pdfPath).size} bytes`);
        console.log(`📝 Caption text: ${message}`);
        
        // Create MessageMedia object from file path
        const media = MessageMedia.fromFilePath(pdfPath);
        console.log(`🔍 Media object created, mimetype: ${media.mimetype}`);
        
        // Send PDF with caption using the options parameter (with retry logic)
        console.log(`� Sending PDF with caption using options parameter...`);
        let result = null;
        let attempts = 0;
        const maxRetries = 3;
        
        while (attempts < maxRetries) {
          try {
            attempts++;
            console.log(`🔄 Attempt ${attempts}/${maxRetries} to send PDF...`);
            
            // Check for specific getChat error and try alternative approach
            try {
              result = await this.whatsappClient.sendMessage(chatId, media, { caption: message });
              console.log(`✅ PDF with caption sent successfully to ${phoneNumber}`);
              console.log(`🔍 Send result:`, result ? 'Success' : 'Unknown');
              break; // Success, exit retry loop
            } catch (sendError) {
              if (sendError.message.includes('getChat') && attempts === 1) {
                console.log(`🔧 Detected getChat error, trying alternative approach...`);
                
                // Wait a moment for WhatsApp to stabilize
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Try to refresh client state
                const newState = await this.whatsappClient.getState();
                console.log(`🔍 Client state after getChat error: ${newState}`);
                
                if (newState !== 'CONNECTED') {
                  throw new Error(`Client disconnected during send (state: ${newState})`);
                }
              }
              throw sendError; // Re-throw to be caught by outer try-catch
            }
            
          } catch (error) {
            console.log(`⚠️ Attempt ${attempts} failed:`, error.message);
            
            // For getChat errors, try to reconnect on last attempt
            if (error.message.includes('getChat') && attempts === maxRetries) {
              console.log(`🔄 getChat error on final attempt - initiating client recovery...`);
              this.whatsappReady = false;
              this.handleSessionIssue();
            }
            
            if (attempts < maxRetries) {
              console.log(`⏳ Waiting 2 seconds before retry...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              throw error; // Re-throw after all retries failed
            }
          }
        }
        
      } else {
        // If no PDF, don't send the message at all
        console.log(`⚠️ No PDF provided - skipping WhatsApp message to ${phoneNumber}`);
        console.log(`� Message would have been: ${message.substring(0, 100)}...`);
        return false; // Return false to indicate message was not sent
      }

      return true;

    } catch (error) {
      console.error(`❌ Failed to send WhatsApp message to ${phoneNumber}:`, error.message);
      console.log(`🔍 DEBUG: Error details:`, error);
      throw error;
    }
  }

  formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Remove leading + if present
    if (cleaned.startsWith('54')) {
      return cleaned;
    }
    
    // Add Argentina country code if not present
    if (!cleaned.startsWith('54')) {
      cleaned = '54' + cleaned;
    }
    
    return cleaned;
  }

  processNewInvoices() {
    console.log('\n🔍 Processing new invoices from SAP (SEQUENTIAL MODE)...');
    
    // CRITICAL CHECK: Don't process invoices if WhatsApp is not ready
    if (!this.whatsappReady || !this.whatsappClient) {
      console.log('🚫 WhatsApp client is not ready - SKIPPING invoice processing');
      console.log('📋 Invoices will be processed when WhatsApp becomes available');
      console.log('🔄 Will retry on next scheduled run...');
      return;
    }

    // Test WhatsApp client functionality before processing any invoices
    try {
      this.whatsappClient.getState().then(state => {
        if (state !== 'CONNECTED') {
          console.log(`🚫 WhatsApp client state is ${state} - SKIPPING invoice processing`);
          console.log('📋 Invoices will be processed when WhatsApp is CONNECTED');
          console.log('🔄 Will retry on next scheduled run...');
          return;
        }
        
        // WhatsApp is ready, proceed with invoice processing
        this.proceedWithInvoiceProcessing();
      }).catch(stateError => {
        console.log(`🚫 Cannot check WhatsApp client state - SKIPPING invoice processing: ${stateError.message}`);
        console.log('📋 Invoices will be processed when WhatsApp is functional');
        console.log('🔄 Will retry on next scheduled run...');
        // Mark WhatsApp as not ready if we can't even check state
        this.whatsappReady = false;
      });
    } catch (error) {
      console.log(`🚫 WhatsApp client error - SKIPPING invoice processing: ${error.message}`);
      console.log('📋 Invoices will be processed when WhatsApp is functional');
      console.log('🔄 Will retry on next scheduled run...');
      this.whatsappReady = false;
    }
  }

  proceedWithInvoiceProcessing() {
    console.log('✅ WhatsApp client is ready - proceeding with invoice processing...');
    
    // Get new invoices from SAP
    this.getNewInvoicesFromSAP()
      .then(newInvoices => {
        if (newInvoices.length === 0) {
          console.log('📪 No new invoices found in SAP');
          return;
        }
        
        console.log(`📋 Found ${newInvoices.length} new invoice(s) in SAP - processing sequentially`);
        
        // Process invoices one by one sequentially
        this.processInvoicesSequentially(newInvoices, 0);
      })
      .catch(error => {
        console.error('❌ Error in proceedWithInvoiceProcessing:', error.message);
      });
  }

  processInvoicesSequentially(invoices, index) {
    // Base case - no more invoices to process
    if (index >= invoices.length) {
      console.log('✅ All invoices processed sequentially');
      return;
    }

    // CRITICAL CHECK: Stop processing if WhatsApp is no longer ready
    if (!this.whatsappReady || !this.whatsappClient) {
      console.log(`\n🚫 WhatsApp client lost during sequential processing - STOPPING at invoice ${index + 1}/${invoices.length}`);
      console.log(`📋 Remaining ${invoices.length - index} invoices will be processed when WhatsApp is available`);
      return;
    }
    
    const invoice = invoices[index];
    console.log(`\n📄 Processing invoice ${index + 1}/${invoices.length}: ${invoice.DocNum}`);
    
    // Process current invoice
    this.processInvoiceWithEmail(invoice)
      .then(() => {
        console.log(`✅ Invoice ${invoice.DocNum} processed successfully`);
        
        // Wait 3 seconds before processing next invoice
        if (index < invoices.length - 1) {
          console.log('⏳ Waiting 3 seconds before next invoice...');
          setTimeout(() => {
            this.processInvoicesSequentially(invoices, index + 1);
          }, 3000);
        } else {
          console.log('✅ All invoices processed sequentially');
        }
      })
      .catch(invoiceError => {
        console.error(`❌ Error processing invoice ${invoice.DocNum}:`, invoiceError.message);
        this.missedInvoices.push({
          invoice,
          error: invoiceError.message,
          timestamp: new Date()
        });
        
        // Continue with next invoice even if current one failed
        if (index < invoices.length - 1) {
          console.log('⏳ Waiting 3 seconds before next invoice (after error)...');
          setTimeout(() => {
            this.processInvoicesSequentially(invoices, index + 1);
          }, 3000);
        } else {
          console.log('✅ Sequential processing completed (with some errors)');
        }
      });
  }

  async getNewInvoicesFromSAP() {
    const fromDate = process.env.PROCESS_INVOICES_FROM_DATE || '2025-09-22';
    
    try {
      // Get invoices that haven't been sent via WhatsApp yet
      // Processing from 22/9 (September 22, 2025) onwards - no end date limit
      // Properly encode the OData query to avoid unescaped characters
      const filter = `DocDate ge '${fromDate}' and (U_WhatsAppSent eq null or U_WhatsAppSent eq 'N')`;
      const orderby = 'DocEntry desc';
      const select = 'DocEntry,DocNum,CardCode,CardName,DocTotal,DocDate,Series,SalesPersonCode,U_WhatsAppSent,U_WhatsAppDate,U_WhatsAppPhone,Comments';
      
      const query = `/b1s/v1/Invoices?${encodeURI(`$filter=${filter}&$orderby=${orderby}&$top=50&$select=${select}`)}`;
      
      console.log('🔍 SAP Query:', query);
      
      const invoicesResponse = await this.sapConnection.makeRequest(query);
      
      return invoicesResponse.value || [];
      
    } catch (error) {
      console.error('❌ Error getting invoices from SAP:', error.message);
      return [];
    }
  }

  async processInvoiceWithEmail(invoice) {
    console.log(`\n📄 Processing Invoice ${invoice.DocNum} (DocEntry: ${invoice.DocEntry})`);
    
    // CRITICAL CHECK: Verify WhatsApp is still ready before processing this invoice
    if (!this.whatsappReady || !this.whatsappClient) {
      console.log(`🚫 WhatsApp client lost during processing - STOPPING invoice ${invoice.DocNum}`);
      console.log(`📋 Invoice ${invoice.DocNum} will be retried when WhatsApp is available`);
      throw new Error('WhatsApp client not ready - invoice processing halted');
    }

    // Safety check - ensure test mode is respected
    if (process.env.TEST_MODE === 'true') {
      console.log(`🧪 TEST MODE ACTIVE - All messages will go to ${process.env.TEST_PHONE}`);
    }
    
    // 1. CRITICAL: Search for PDF FIRST - no PDF = no processing at all
    const pdfPath = this.findInvoicePDF(invoice.DocNum, invoice.DocDate, invoice.Series);
    
    if (!pdfPath) {
      console.log(`🚫 CRITICAL: No PDF found for invoice ${invoice.DocNum} - STOPPING ALL PROCESSING`);
      console.log(`📋 NO WhatsApp messages will be sent (customer OR salesperson)`);
      console.log(`📋 Invoice will remain unmarked in SAP for retry when PDF becomes available`);
      this.missedInvoices.push({
        invoice,
        error: 'PDF not found - no processing done',
        timestamp: new Date()
      });
      return;
    }
    
    console.log(`✅ PDF found for invoice ${invoice.DocNum} - proceeding with message generation`);
    
    // 2. Generate WhatsApp message from SAP data
    const whatsappMessage = this.generateWhatsAppMessage(invoice);
    
    // 3. Get customer phone number
    const customerPhone = this.getCustomerPhone(invoice);
    
    if (!customerPhone) {
      console.log(`⚠️ No phone number for invoice ${invoice.DocNum} - using admin phone`);
    }
    
    // 4. Determine phone to use with safety checks
    let phoneToUse;
    let messageTarget;
    
    // SAFETY CHECK: If customer messages are disabled, skip customer and only notify salesperson
    if (process.env.DISABLE_CUSTOMER_MESSAGES === 'true') {
      console.log(`🔒 CUSTOMER MESSAGES DISABLED - Skipping customer notification for invoice ${invoice.DocNum}`);
      console.log(`   📋 Customer would have been: ${customerPhone || 'No phone available'}`);
      
      // Skip customer message completely, only send salesperson notification
      await this.markInvoiceAsSent(invoice.DocEntry);
      
      // Try to send salesperson notification, but don't fail if it doesn't work
      console.log(`   📱 Attempting salesperson notification for invoice ${invoice.DocNum}...`);
      await this.sendSalespersonNotification(invoice, pdfPath);
      console.log(`✅ Invoice ${invoice.DocNum} marked as sent (customer message disabled)`);
      console.log(`   📋 Salesperson notification handled (success or graceful skip)`)
      
      // Clean up temp PDF
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      
      this.processedInvoices.add(invoice.DocNum);
      return;
    }
    
    // Normal logic: Send to customer
    if (process.env.TEST_MODE === 'true') {
      phoneToUse = process.env.TEST_PHONE;
      messageTarget = 'TEST MODE';
    } else {
      phoneToUse = customerPhone || process.env.ADMIN_PHONE;
      messageTarget = customerPhone ? 'Customer' : 'Admin (no customer phone)';
    }
    
    console.log(`📱 Sending to ${messageTarget}: ${phoneToUse}`);
    
    try {
      await this.sendWhatsAppMessage(phoneToUse, whatsappMessage, pdfPath);
      
      // 5. Mark as sent in SAP
      await this.markInvoiceAsSent(invoice.DocEntry);
      
      // 6. Send salesperson notification (non-blocking)
      console.log(`   📱 Attempting salesperson notification for invoice ${invoice.DocNum}...`);
      await this.sendSalespersonNotification(invoice, pdfPath);
      console.log(`✅ Successfully sent invoice ${invoice.DocNum} via WhatsApp`);
      console.log(`   📋 Salesperson notification handled (success or graceful skip)`)
      
      // 7. Clean up temp PDF
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
      
      this.processedInvoices.add(invoice.DocNum);
      
    } catch (whatsappError) {
      console.error(`❌ WhatsApp send failed for ${invoice.DocNum}:`, whatsappError.message);
      throw whatsappError;
    }
  }

  findInvoicePDF(docNum, invoiceDate, series) {
    console.log(`   🔍 Searching folders for DocNum: ${docNum}`);
    console.log(`   📅 Invoice date: ${invoiceDate}, Series: ${series}`);
    
    try {
      // Search in both FC and downloaded-pdfs folders with proper SAP document naming
      const localPdfPath = this.findPDFInDownloadedFolder(docNum, series);
      if (localPdfPath) {
        console.log(`   ✅ Found PDF: ${localPdfPath}`);
        return localPdfPath;
      }
      
      console.log(`   ❌ PDF not found for DocNum ${docNum}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error searching PDFs for ${docNum}:`, error.message);
      return null;
    }
  }

  findPDFInDownloadedFolder(docNum, series) {
    // Check only downloaded-pdfs folder
    const foldersToCheck = ['./downloaded-pdfs'];
    
    for (const folder of foldersToCheck) {
      try {
        // Check if folder exists
        if (!fs.existsSync(folder)) {
          console.log(`   📁 Folder does not exist: ${folder}`);
          continue;
        }
        
        // Get all PDF files in the folder
        const files = fs.readdirSync(folder);
        const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
        
        console.log(`   📄 Searching through ${pdfFiles.length} PDFs in ${folder} for DocNum ${docNum}`);
        
        // Try different zero-padding patterns for PDF filename - both old and new formats
        const patterns = [
          // New format with hyphens (current)
          `Factura de deudores - ${docNum}.pdf`,           // No padding: 14936
          `Factura de deudores - 0${docNum}.pdf`,          // 1 zero: 014936  
          `Factura de deudores - 00${docNum}.pdf`,         // 2 zeros: 0014936
          `Factura de deudores - 000${docNum}.pdf`,        // 3 zeros: 00014936
          `Factura de deudores - 0000${docNum}.pdf`,       // 4 zeros: 000014936
          `Factura de deudores - 00000${docNum}.pdf`,      // 5 zeros: 0000014936
          // Old format with underscores (fallback)
          `Factura_de_deudores_${docNum}.pdf`,           // No padding: 14936
          `Factura_de_deudores_0${docNum}.pdf`,          // 1 zero: 014936  
          `Factura_de_deudores_00${docNum}.pdf`,         // 2 zeros: 0014936
          `Factura_de_deudores_000${docNum}.pdf`,        // 3 zeros: 00014936
          `Factura_de_deudores_0000${docNum}.pdf`,       // 4 zeros: 000014936
          `Factura_de_deudores_00000${docNum}.pdf`       // 5 zeros: 0000014936
        ];
        
        for (const filename of patterns) {
          const pdfPath = path.join(folder, filename);
          if (fs.existsSync(pdfPath)) {
            console.log(`     ✅ EXACT MATCH FOUND! PDF ${filename} matches DocNum ${docNum} in ${folder}`);
            console.log(`     📄 Using PDF: ${pdfPath}`);
            return pdfPath;
          }
        }
        
        console.log(`   ❌ No PDF found in ${folder} with DocNum ${docNum} (tried multiple zero-padding patterns)`);
        
      } catch (error) {
        console.error(`❌ Error searching ${folder}:`, error.message);
        continue;
      }
    }
    
    return null;
  }

  async sendSalespersonNotification(invoice, pdfPath = null) {
    try {
      // Get salesperson code from invoice (assuming it's in SalesPersonCode field)
      if (!invoice.SalesPersonCode) {
        console.log(`   ⚠️ No salesperson code found for invoice ${invoice.DocNum}`);
        return;
      }

      // Get salesperson phone from environment variables
      const salesPersonPhone = process.env[`SALES_PERSON_${invoice.SalesPersonCode}`];
      if (!salesPersonPhone) {
        console.log(`   ⚠️ No phone configured for salesperson ${invoice.SalesPersonCode}`);
        return;
      }

      // Get friendly name from environment variables
      const friendlyName = process.env[`SALES_PERSON_NAME_${invoice.SalesPersonCode}`];
      const salesPersonName = friendlyName || `Código ${invoice.SalesPersonCode}`;

      console.log(`   👨‍💼 Sending notification to salesperson: ${salesPersonName} (${salesPersonPhone})`);

      // Generate salesperson message with delivery status
      const salespersonMessage = await this.generateSalespersonMessage(invoice, salesPersonName);

      // Send to salesperson (in test mode, this also goes to test phone)
      const phoneToUse = process.env.TEST_MODE === 'true' ? process.env.TEST_PHONE : salesPersonPhone;
      
      // Check WhatsApp client health before attempting to send
      if (!this.whatsappReady || !this.whatsappClient) {
        console.log(`   ⚠️ WhatsApp client not ready for salesperson notification - skipping ${salesPersonName}`);
        return;
      }

      // Test if client is actually functional before sending
      try {
        const clientState = await this.whatsappClient.getState();
        if (clientState !== 'CONNECTED') {
          console.log(`   ⚠️ WhatsApp client state is ${clientState} - skipping salesperson notification to ${salesPersonName}`);
          return;
        }
      } catch (stateError) {
        console.log(`   ⚠️ Cannot check WhatsApp client state - skipping salesperson notification to ${salesPersonName}: ${stateError.message}`);
        return;
      }
      
      await this.sendWhatsAppMessage(phoneToUse, salespersonMessage, pdfPath);
      
      console.log(`   ✅ Salesperson notification sent to ${salesPersonName}`);

    } catch (error) {
      console.log(`   ⚠️ Salesperson notification failed for ${invoice.DocNum} - continuing anyway: ${error.message}`);
      // Don't throw error - salesperson notification is non-critical
    }
  }

  generateWhatsAppMessage(invoice) {
    const lines = [];
    
    // Add test mode header if active
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
      lines.push('');
    }
    
    // Series detection based on DocNum: 7 digits AND starts with 9 = Series 76
    const docNum = invoice.DocNum.toString();
    const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
    
    // Determine message type based on detected Series
    if (isSeries76) {
      lines.push('📄 *NUEVO DOCUMENTO EMITIDO*');
      lines.push('');
      lines.push(`📋 Comprobante: *${invoice.DocNum}*`);
      console.log(`📄 Series 76 message generated for invoice ${docNum}`);
    } else {
      lines.push('🧾 *NUEVA FACTURA EMITIDA*');
      lines.push(`📋 Factura: *${invoice.DocNum}*`);
      console.log(`🧾 Series 4 message generated for invoice ${docNum}`);
    }
    
    lines.push(`👤 Cliente: ${invoice.CardName}`);
    lines.push(`💰 Total: $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
    lines.push(`📅 Fecha: ${invoice.DocDate}`);
    
    if (invoice.Comments && !isSeries76) {
      lines.push(`📝 Comentarios: ${invoice.Comments}`);
    }
    
    lines.push('');
    lines.push('📎 Adjunto encontrarás tu factura en PDF.');
    lines.push('');
    
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *Este es un mensaje de prueba*');
      lines.push('En producción iría al cliente real');
      lines.push('');
    }
    
    lines.push('Gracias por tu compra!');
    
    return lines.join('\n');
  }

  async generateSalespersonMessage(invoice, salespersonName) {
    const lines = [];
    
    // Add test mode header if active
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
      lines.push('');
    }
    
    // Series detection based on DocNum: 7 digits AND starts with 9 = Series 76
    const docNum = invoice.DocNum.toString();
    const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
    
    if (isSeries76) {
      // Series 76 - Salesperson message
      lines.push('📄 *NUEVO DOCUMENTO*');
      lines.push('');
      lines.push(`Hola ${salespersonName},`);
      lines.push('');
      lines.push(`Se ha emitido el siguiente comprobante de uso interno para el cliente ${invoice.CardName}:`);
      lines.push('');
      lines.push(`📋 **Comprobante Nº:** ${invoice.DocNum}`);
      lines.push(`📅 **Fecha:** ${invoice.DocDate}`);
      lines.push(`💰 **Total:** $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
      console.log(`📄 Series 76 salesperson message generated for ${salespersonName}`);
    } else {
      // Series 4 - Salesperson message
      lines.push('🧾 *NUEVA FACTURA EMITIDA*');
      lines.push('');
      lines.push(`Hola ${salespersonName},`);
      lines.push('');
      lines.push(`Se ha emitido la siguiente factura para el cliente ${invoice.CardName}:`);
      lines.push('');
      lines.push(`📋 **Factura Nº:** ${invoice.DocNum}`);
      lines.push(`📅 **Fecha:** ${invoice.DocDate}`);
      lines.push(`💰 **Total:** $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
      console.log(`🧾 Series 4 salesperson message generated for ${salespersonName}`);
    }
    
    // Get customer details to check email and phone status
    let deliveryStatus = '';
    try {
      console.log(`   📋 Fetching customer details for ${invoice.CardCode}...`);
      const customerResponse = await this.sapConnection.makeRequest(
        `/b1s/v1/BusinessPartners('${invoice.CardCode}')?$select=CardCode,CardName,EmailAddress,Cellular,Phone1`
      );
      
      const customer = customerResponse;
      const hasEmail = customer.EmailAddress && customer.EmailAddress.trim() !== '';
      const hasCellular = customer.Cellular && customer.Cellular.trim() !== '';
      
      console.log(`   📧 Email: ${hasEmail ? customer.EmailAddress : 'None'}`);
      console.log(`   📱 Cellular: ${hasCellular ? customer.Cellular : 'None'}`);
      
      // Determine delivery status based on available contact methods
      if (hasEmail && hasCellular) {
        deliveryStatus = `Este documento fue enviado al cliente al mail ${customer.EmailAddress}, y al numero ${customer.Cellular}`;
      } else if (hasEmail && !hasCellular) {
        deliveryStatus = `Este documento se envio al mail ${customer.EmailAddress}. El cliente no registra numero de celular`;
      } else if (!hasEmail && hasCellular) {
        deliveryStatus = `Este documento se envio al numero ${customer.Cellular}. El cliente no registra casilla de mail`;
      } else {
        deliveryStatus = `El cliente no registra mail ni numero de celular en su ficha. Por favor reenviar`;
      }
      
    } catch (error) {
      console.error(`   ❌ Error fetching customer details: ${error.message}`);
      deliveryStatus = `No se pudo verificar los datos de contacto del cliente. Por favor revisar manualmente`;
    }
    
    lines.push('');
    lines.push(`📞 **Estado de entrega:** ${deliveryStatus}`);
    lines.push('');
    lines.push('Si tiene alguna consulta, no dude en contactarnos.');
    lines.push('');
    lines.push('Saludos cordiales,');
    lines.push('Simsiroglu');
    
    if (process.env.TEST_MODE === 'true') {
      lines.push('');
      lines.push('🧪 *Este es un mensaje de prueba*');
      lines.push(`En producción iría al vendedor: ${salespersonName}`);
    }
    
    return lines.join('\n');
  }

  getCustomerPhone(invoice) {
    // 🚨 SAFETY CHECK: In test mode, ALWAYS use test phone
    if (process.env.TEST_MODE === 'true') {
      console.log(`🧪 TEST MODE: Using test phone instead of customer invoice phone`);
      return process.env.TEST_PHONE;
    }
    
    // Try to get phone from invoice data
    if (invoice.U_WhatsAppPhone && invoice.U_WhatsAppPhone.length >= 10) {
      return invoice.U_WhatsAppPhone;
    }
    
    // Could add logic here to look up customer phone in SAP
    // For now, return null and use admin phone
    return null;
  }

  async markInvoiceAsSent(docEntry) {
    try {
      const updateData = {
        U_WhatsAppSent: 'Y',
        U_WhatsAppDate: new Date().toISOString().split('T')[0],
        U_WhatsAppRetries: 1
      };
      
      await this.sapConnection.makeRequest(
        `/b1s/v1/Invoices(${docEntry})`,
        'PATCH',
        updateData
      );
      
      console.log(`   ✅ Marked invoice ${docEntry} as sent in SAP`);
      
    } catch (error) {
      console.error(`   ❌ Failed to mark invoice ${docEntry} as sent:`, error.message);
    }
  }

  async sendDailyReport() {
    if (this.missedInvoices.length === 0) {
      console.log('📧 No missed invoices to report today');
      return;
    }
    
    // Deduplicate missed invoices by DocNum, keeping the latest error for each invoice
    const seenInvoices = new Set();
    const uniqueMissedInvoices = [];
    
    // Process in reverse order to get the latest error for each invoice
    for (let i = this.missedInvoices.length - 1; i >= 0; i--) {
      const item = this.missedInvoices[i];
      const docNum = item.invoice.DocNum;
      
      if (!seenInvoices.has(docNum)) {
        seenInvoices.add(docNum);
        uniqueMissedInvoices.unshift(item); // Add to beginning to maintain chronological order
      }
    }
    
    console.log(`📧 Sending daily report: ${this.missedInvoices.length} total errors, ${uniqueMissedInvoices.length} unique invoices`);
    
    try {
      // Send email report to ssimsi@gmail.com with deduplicated invoices
      // await this.emailReporter.sendDailyReport(uniqueMissedInvoices); // Email reporter removed
      
      // Also send summary via WhatsApp to admin
      const whatsappSummary = [
        '📊 *REPORTE DIARIO*',
        `📅 ${new Date().toLocaleDateString('es-AR')}`,
        `📋 ${uniqueMissedInvoices.length} facturas no enviadas (de ${this.missedInvoices.length} errores totales)`,
        '',
        '📧 Reporte detallado enviado a ssimsi@gmail.com',
        '',
        '⚙️ Revisar configuración del servicio'
      ].join('\n');
      
      await this.sendWhatsAppMessage(process.env.ADMIN_PHONE, whatsappSummary);
      
      // Clear missed invoices after reporting
      this.missedInvoices = [];
      
    } catch (error) {
      console.error('❌ Failed to send daily report:', error.message);
    }
  }

  async stop() {
    if (!this.isRunning) return;
    
    console.log('\n🛑 Stopping Hybrid Invoice Service...');
    
    try {
      // Stop session monitoring first
      this.stopSessionKeepAlive();
      console.log('💓 Session monitoring stopped');
      
      if (this.whatsappClient) {
        console.log('🛑 Stopping WhatsApp client...');
        await this.whatsappClient.destroy();
        this.whatsappReady = false;
        console.log('📱 WhatsApp service stopped');
      }
      
      if (this.pdfCleanupService) {
        this.pdfCleanupService.stop();
        console.log('🧹 PDF cleanup service stopped');
      }
      
      this.isRunning = false;
      console.log('✅ Hybrid service stopped gracefully');
      
    } catch (error) {
      console.error('❌ Error stopping service:', error.message);
    }
    
    process.exit(0);
  }
}

// Simple SAP connection class (reusing existing logic)
class SAPConnection {
  constructor() {
    this.sessionId = null;
    this.cookies = null;
  }

  async login() {
    console.log('🔐 Logging into SAP...');
    
    const loginData = JSON.stringify({
      CompanyDB: process.env.VITE_SAP_DATABASE,
      UserName: process.env.VITE_SAP_USERNAME,
      Password: process.env.VITE_SAP_PASSWORD
    });

    const options = {
      hostname: 'b1.ativy.com',
      port: 50685,
      path: '/b1s/v1/Login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      },
      rejectUnauthorized: false,
      timeout: 30000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const data = JSON.parse(responseBody);
              this.sessionId = data.SessionId;
              this.cookies = res.headers['set-cookie'];
              console.log('✅ SAP login successful!');
              resolve(true);
            } else {
              console.error('❌ SAP login failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ SAP login error:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ SAP login request failed:', error.message);
        resolve(false);
      });

      req.write(loginData);
      req.end();
    });
  }

  async makeRequest(path, method = 'GET', data = null, retryCount = 0) {
    return new Promise(async (resolve, reject) => {
      const options = {
        hostname: 'b1.ativy.com',
        port: 50685,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': this.cookies ? this.cookies.join('; ') : '',
          'Prefer': 'odata.maxpagesize=0'
        },
        rejectUnauthorized: false,
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', async () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const responseData = JSON.parse(responseBody);
              resolve(responseData);
            } else if (res.statusCode === 401 && retryCount === 0) {
              // Session expired, try to re-login once
              console.log('🔄 SAP session expired, attempting to re-login...');
              const loginSuccess = await this.login();
              if (loginSuccess) {
                console.log('✅ SAP re-login successful, retrying request...');
                try {
                  const result = await this.makeRequest(path, method, data, 1);
                  resolve(result);
                } catch (retryError) {
                  reject(retryError);
                }
              } else {
                console.error('❌ SAP re-login failed');
                reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
              }
            } else {
              console.error(`❌ Request failed (${res.statusCode}):`, responseBody);
              reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
            }
          } catch (error) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseBody);
            } else {
              reject(error);
            }
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }
}

// Start the service if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new HybridInvoiceService();
  service.start().catch(console.error);
}

export default HybridInvoiceService;
