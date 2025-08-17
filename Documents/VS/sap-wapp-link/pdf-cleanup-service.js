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

// Load environment variables
dotenv.config({ path: '.env.local' });

class PDFCleanupService {
  constructor() {
    this.tempPdfFolder = process.env.TEMP_PDF_FOLDER || './temp-pdfs';
    this.invoicePdfPath = process.env.INVOICE_PDF_PATH || './invoices';
    this.retentionDays = parseInt(process.env.PDF_RETENTION_DAYS) || 2; // Keep PDFs for 2 days by default
    this.isRunning = false;
  }

  /**
   * Start the cleanup service with scheduled runs
   */
  start() {
    console.log('🧹 Starting PDF Cleanup Service');
    console.log('================================');
    console.log(`📁 Monitoring folders:`);
    console.log(`   • Temp PDFs: ${this.tempPdfFolder}`);
    console.log(`   • Invoice PDFs: ${this.invoicePdfPath}`);
    console.log(`📅 Retention: ${this.retentionDays} days`);
    console.log(`⏰ Schedule: Daily at 5:00 AM`);
    console.log('');

    this.isRunning = true;

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

      // Clean temp PDF folder
      totalDeleted += await this.cleanupFolder(this.tempPdfFolder, cutoffDate, 'Temp PDFs');

      // Clean invoice PDF folder  
      totalDeleted += await this.cleanupFolder(this.invoicePdfPath, cutoffDate, 'Invoice PDFs');

      console.log('\n📊 Cleanup Summary:');
      console.log(`🗑️  Files deleted: ${totalDeleted}`);
      console.log(`💾 Space freed: ${this.formatFileSize(totalSize)}`);
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
      tempFolder: this.tempPdfFolder,
      invoiceFolder: this.invoicePdfPath,
      retentionDays: this.retentionDays,
      isRunning: this.isRunning,
      nextCleanup: '5:00 AM daily'
    };

    // Get current folder sizes
    try {
      stats.tempFolderSize = this.getFolderSize(this.tempPdfFolder);
      stats.invoiceFolderSize = this.getFolderSize(this.invoicePdfPath);
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
