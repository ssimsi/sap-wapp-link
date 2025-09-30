#!/usr/bin/env node

/**
 * PDF Cleanup Service
 * Automatically removes old PDF files to keep Railway deployment size optimized
 * Runs daily at 5 AM via cron schedule
 */

import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import dotenv from 'dotenv';
import https from 'https';

// Load environment variables
dotenv.config({ path: '.env.local' });

class PDFCleanupService {
  constructor() {
    this.downloadedPdfFolder = process.env.DOWNLOADED_PDF_FOLDER || './downloaded-pdfs';
    this.retentionDays = parseInt(process.env.PDF_RETENTION_DAYS) || 30; // Default 30 days
    this.isRunning = false;
    this.sapConnection = null;
  }

  /**
   * Start the cleanup service with scheduled runs
   */
  start() {
    console.log('🧹 Starting PDF Cleanup Service');
    console.log('================================');
    console.log(`📁 Monitoring folder: ${this.downloadedPdfFolder}`);
    console.log(`📋 Cleanup Rule: Invoices need BOTH Email+WhatsApp='Y', Deliveries need only Email='Y'`);
    console.log(`⏰ Schedule: Daily at 5:00 AM`);
    console.log('');

    this.isRunning = true;

    // Initialize SAP connection
    this.initializeSAPConnection();

    // Schedule daily cleanup at 5:00 AM
    cron.schedule('0 5 * * *', () => {
      console.log('\n⏰ Daily PDF cleanup triggered at 5:00 AM');
      this.performCleanup().catch(error => {
        console.error('❌ Scheduled cleanup failed:', error);
      });
    });

    // Run initial cleanup on startup (but only old files)
    console.log('🚀 Running initial cleanup...');
    this.performCleanup().catch(error => {
      console.error('❌ Initial cleanup failed:', error);
    });

    console.log('✅ PDF Cleanup Service started successfully');
    console.log('🔄 Next cleanup scheduled for 5:00 AM daily');
  }

  /**
   * Initialize SAP connection for checking invoice status
   */
  initializeSAPConnection() {
    this.sapConnection = {
      sessionId: null,
      cookies: null
    };
  }

  /**
   * Login to SAP B1 Service Layer
   */
  async loginToSAP() {
    console.log('🔐 Logging into SAP for cleanup service...');
    
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
              this.sapConnection.sessionId = data.SessionId;
              this.sapConnection.cookies = res.headers['set-cookie'];
              console.log('✅ SAP login successful for cleanup service');
              resolve(true);
            } else {
              console.error('❌ SAP login failed for cleanup service:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ SAP login error for cleanup service:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ SAP login request failed for cleanup service:', error.message);
        resolve(false);
      });

      req.write(loginData);
      req.end();
    });
  }

  /**
   * Make a request to SAP B1 Service Layer
   */
  async makeSAPRequest(path, method = 'GET', data = null) {
    return new Promise(async (resolve, reject) => {
      const options = {
        hostname: 'b1.ativy.com',
        port: 50685,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': this.sapConnection.cookies ? this.sapConnection.cookies.join('; ') : '',
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
            } else if (res.statusCode === 401) {
              // Session expired, try to re-login once
              console.log('🔄 SAP session expired for cleanup service, attempting to re-login...');
              const loginSuccess = await this.loginToSAP();
              if (loginSuccess) {
                console.log('✅ SAP re-login successful for cleanup service');
                // Don't retry automatically to avoid infinite loops
                reject(new Error('SAP session expired - please retry'));
              } else {
                console.error('❌ SAP re-login failed for cleanup service');
                reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
              }
            } else {
              console.error(`❌ SAP request failed for cleanup service (${res.statusCode}):`, responseBody);
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

  /**
   * Perform the actual cleanup of old PDF files
   */
  async performCleanup() {
    try {
      console.log('\n🧹 Starting PDF cleanup process...');
      console.log('==================================');
      
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (this.retentionDays * 24 * 60 * 60 * 1000));
      
      console.log(`📅 Current time: ${now.toISOString()}`);
      console.log(`🗓️  Cutoff date: ${cutoffDate.toISOString()}`);
      console.log(`📋 Will delete PDFs older than ${this.retentionDays} days`);
      console.log('');

      let totalDeleted = 0;
      let totalSize = 0;

      // Clean downloaded PDF folder (smart cleanup with SAP checking - no age restriction)
      totalDeleted += await this.cleanupDownloadedPDFsFolder();

      console.log('\n📊 Cleanup Summary:');
      console.log(`🗑️  Files deleted: ${totalDeleted}`);
      console.log(`✅ Cleanup completed at ${new Date().toISOString()}`);

      return {
        filesDeleted: totalDeleted,
        spaceFreed: totalSize,
        completedAt: new Date()
      };

    } catch (error) {
      console.error('❌ PDF cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Smart cleanup for downloaded PDFs - only delete if both email and WhatsApp are sent
   */
  async cleanupDownloadedPDFsFolder() {
    if (!fs.existsSync(this.downloadedPdfFolder)) {
      console.log(`📁 Downloaded PDFs folder does not exist: ${this.downloadedPdfFolder}, skipping`);
      return 0;
    }

    console.log(`📁 Smart cleaning Downloaded PDFs: ${this.downloadedPdfFolder}`);
    console.log(`   📋 Rule: Invoices require BOTH Email='Y' AND WhatsApp='Y', Deliveries require only Email='Y'`);
    
    let deletedCount = 0;
    let deletedSize = 0;

    try {
      // Login to SAP first
      const sapConnected = await this.loginToSAP();
      if (!sapConnected) {
        console.error('❌ Could not connect to SAP - skipping downloaded PDFs cleanup');
        return 0;
      }

      const files = fs.readdirSync(this.downloadedPdfFolder);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

      console.log(`   📄 Found ${pdfFiles.length} PDF files to analyze`);

      for (const file of pdfFiles) {
        const filePath = path.join(this.downloadedPdfFolder, file);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = new Date(stats.mtime);

          console.log(`   📅 Checking PDF: ${file} (age: ${this.formatAge(fileAge)})`);

          // Extract DocNum from filename
          const docNum = this.extractDocNumFromFilename(file);
          if (!docNum) {
            console.log(`   ⚠️  Could not extract DocNum from ${file} - skipping`);
            continue;
          }

          // Determine document type
          const documentType = this.getDocumentType(file);

          // Check SAP status - no age restriction, delete immediately if sent
          const canDelete = await this.checkInvoiceStatusInSAP(docNum, documentType);
          
          if (canDelete) {
            // File is safe to delete
            const fileSize = stats.size;
            fs.unlinkSync(filePath);
            
            deletedCount++;
            deletedSize += fileSize;
            
            console.log(`   🗑️  Deleted: ${file} (${this.formatFileSize(fileSize)}) - Both email and WhatsApp sent`);
          } else {
            console.log(`   ⏭️  Keeping: ${file} - Not fully processed yet`);
          }

        } catch (fileError) {
          console.error(`   ❌ Error processing ${file}:`, fileError.message);
        }
      }

      console.log(`   ✅ Downloaded PDFs: ${deletedCount} files deleted, ${this.formatFileSize(deletedSize)} freed`);
      return deletedCount;

    } catch (error) {
      console.error(`❌ Error in smart cleanup of ${this.downloadedPdfFolder}:`, error.message);
      return 0;
    }
  }

  /**
   * Extract DocNum from PDF filename
   */
  extractDocNumFromFilename(filename) {
    // Handle multiple document types and formats
    let match;
    
    // Try Invoice hyphen format: "Factura de deudores - 15566.pdf"
    match = filename.match(/Factura de deudores - (\d+)\.pdf$/);
    if (match) {
      return match[1];
    }
    
    // Try Invoice underscore format (old format): "Factura_de_deudores_15566.pdf"
    match = filename.match(/Factura_de_deudores_(\d+)\.pdf$/);
    if (match) {
      return match[1];
    }
    
    // Try Delivery format: "Entrega - 16398.pdf"
    match = filename.match(/Entrega - (\d+)\.pdf$/);
    if (match) {
      return match[1];
    }
    
    // Try Credit Note format: "Nota de crédito de clientes - 1356.pdf"
    match = filename.match(/Nota de crédito de clientes - (\d+)\.pdf$/);
    if (match) {
      return match[1];
    }
    
    // Try to handle zero-padded versions by finding any number before .pdf
    match = filename.match(/(\d+)\.pdf$/);
    if (match) {
      // Remove leading zeros
      return parseInt(match[1], 10).toString();
    }
    
    return null;
  }

  /**
   * Determine document type from filename
   */
  getDocumentType(filename) {
    if (filename.includes('Factura de deudores')) return 'Invoice';
    if (filename.includes('Entrega')) return 'Delivery';
    if (filename.includes('Nota de crédito')) return 'CreditNote';
    return 'Unknown';
  }

  /**
   * Check if document has appropriate sent status in SAP (depends on document type)
   */
  async checkInvoiceStatusInSAP(docNum, documentType) {
    try {
      // Query different SAP tables based on document type
      let sapEndpoint, docType;
      
      switch (documentType) {
        case 'Invoice':
          sapEndpoint = 'Invoices';
          docType = 'Invoice';
          break;
        case 'Delivery':
          sapEndpoint = 'DeliveryNotes';
          docType = 'Delivery';
          break;
        case 'CreditNote':
          sapEndpoint = 'CreditNotes';
          docType = 'Credit Note';
          break;
        default:
          console.log(`   ⚠️  Unknown document type ${documentType} for DocNum ${docNum} - keeping PDF`);
          return false;
      }
      
      // Query SAP for this specific DocNum (DocNum is a NUMBER field, don't use quotes)
      const filter = `DocNum eq ${docNum}`;
      const select = 'DocNum,U_EmailSent,U_WhatsAppSent';
      const query = `/b1s/v1/${sapEndpoint}?${encodeURI(`$filter=${filter}&$select=${select}&$top=1`)}`;
      
      const response = await this.makeSAPRequest(query);
      
      if (response.value && response.value.length > 0) {
        const document = response.value[0];
        const emailSent = document.U_EmailSent === 'Y';
        const whatsappSent = document.U_WhatsAppSent === 'Y';
        
        console.log(`   📋 ${docType} ${docNum}: Email=${document.U_EmailSent || 'N'}, WhatsApp=${document.U_WhatsAppSent || 'N'}`);
        
        // Apply document-type-specific deletion rules
        switch (documentType) {
          case 'Invoice':
          case 'CreditNote':
            // Invoices and credit notes: delete only when BOTH email AND WhatsApp are sent
            return emailSent && whatsappSent;
          case 'Delivery':
            // Deliveries: delete when email is sent (WhatsApp not used for deliveries)
            return emailSent;
          default:
            return false;
        }
      } else {
        console.log(`   ⚠️  ${docType} ${docNum} not found in SAP - keeping PDF as safety measure`);
        return false; // Keep PDF if we can't find the document
      }
      
    } catch (error) {
      console.error(`   ❌ Error checking SAP status for DocNum ${docNum}:`, error.message);
      return false; // Keep PDF if there's an error
    }
  }

  /**
   * Clean up PDFs in a specific folder
   */
  async cleanupFolder(folderPath, cutoffDate, folderName) {
    if (!fs.existsSync(folderPath)) {
      console.log(`📁 Folder ${folderName}: ${folderPath} does not exist, skipping`);
      return 0;
    }

    console.log(`📁 Cleaning ${folderName}: ${folderPath}`);
    
    let deletedCount = 0;
    let deletedSize = 0;

    try {
      const files = fs.readdirSync(folderPath);
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

      console.log(`   📄 Found ${pdfFiles.length} PDF files`);

      for (const file of pdfFiles) {
        const filePath = path.join(folderPath, file);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = new Date(stats.mtime);

          if (fileAge < cutoffDate) {
            // File is old enough to delete
            const fileSize = stats.size;
            fs.unlinkSync(filePath);
            
            deletedCount++;
            deletedSize += fileSize;
            
            console.log(`   🗑️  Deleted: ${file} (${this.formatFileSize(fileSize)}, age: ${this.formatAge(fileAge)})`);
          } else {
            console.log(`   ⏭️  Keeping: ${file} (age: ${this.formatAge(fileAge)})`);
          }

        } catch (fileError) {
          console.error(`   ❌ Error processing ${file}:`, fileError.message);
        }
      }

      console.log(`   ✅ ${folderName}: ${deletedCount} files deleted, ${this.formatFileSize(deletedSize)} freed`);
      return deletedCount;

    } catch (error) {
      console.error(`❌ Error reading folder ${folderPath}:`, error.message);
      return 0;
    }
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format file age in human readable format
   */
  formatAge(date) {
    const now = new Date();
    const ageMs = now.getTime() - date.getTime();
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const ageHours = Math.floor((ageMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (ageDays > 0) {
      return `${ageDays}d ${ageHours}h ago`;
    } else {
      return `${ageHours}h ago`;
    }
  }

  /**
   * Manual cleanup trigger (for testing)
   */
  async triggerManualCleanup() {
    console.log('🔧 Manual cleanup triggered...');
    return await this.performCleanup();
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 PDF Cleanup Service stopped');
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    const stats = {
      downloadedPdfFolder: this.downloadedPdfFolder,
      isRunning: this.isRunning,
      nextCleanup: '5:00 AM daily',
      cleanupRule: 'Smart cleanup: Invoices need BOTH Email+WhatsApp=Y, Deliveries need only Email=Y'
    };

    // Get current folder sizes
    try {
      stats.downloadedPdfFolderSize = this.getFolderSize(this.downloadedPdfFolder);
    } catch (error) {
      console.error('Error getting folder stats:', error);
    }

    return stats;
  }

  /**
   * Get total size of PDFs in a folder
   */
  getFolderSize(folderPath) {
    if (!fs.existsSync(folderPath)) {
      return { files: 0, size: 0 };
    }

    let totalSize = 0;
    let fileCount = 0;

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      if (file.toLowerCase().endsWith('.pdf')) {
        const filePath = path.join(folderPath, file);
        try {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
          fileCount++;
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    return {
      files: fileCount,
      size: totalSize,
      formattedSize: this.formatFileSize(totalSize)
    };
  }
}

// Export for use in other modules
export default PDFCleanupService;

// If run directly, start the service
if (import.meta.url === `file://${process.argv[1]}`) {
  const cleanupService = new PDFCleanupService();
  cleanupService.start();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down PDF cleanup service...');
    cleanupService.stop();
    process.exit(0);
  });
}
