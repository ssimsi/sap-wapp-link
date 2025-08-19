#!/usr/bin/env node
/**
 * WhatsApp Session Manager
 * Manages session backups, recovery, and maintenance
 */

const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor() {
    this.sessionPath = './.wwebjs_auth/';
    this.backupPath = './whatsapp-session-backup/';
    this.sessionInfoPath = path.join(this.sessionPath, 'session-info.json');
  }

  // 📋 Check session status
  getSessionStatus() {
    console.log('📊 WhatsApp Session Status:');
    console.log('========================');
    
    try {
      // Check if session exists
      const sessionExists = fs.existsSync(this.sessionPath);
      console.log(`📁 Session folder exists: ${sessionExists ? '✅' : '❌'}`);
      
      if (sessionExists) {
        const files = fs.readdirSync(this.sessionPath);
        console.log(`📄 Session files: ${files.length} files`);
        
        // Check session info
        if (fs.existsSync(this.sessionInfoPath)) {
          const sessionInfo = JSON.parse(fs.readFileSync(this.sessionInfoPath, 'utf8'));
          const lastAuth = new Date(sessionInfo.lastAuth);
          const sessionAge = Math.round((Date.now() - sessionInfo.lastAuth) / (24 * 60 * 60 * 1000));
          
          console.log(`📅 Last authentication: ${lastAuth.toLocaleString()}`);
          console.log(`⏰ Session age: ${sessionAge} days`);
          console.log(`📱 Client info: ${sessionInfo.clientInfo?.pushname || 'Unknown'}`);
          
          // Session health assessment
          if (sessionAge > 7) {
            console.log('⚠️  Session is old - consider refreshing');
          } else if (sessionAge > 3) {
            console.log('🟡 Session is aging - monitor closely');
          } else {
            console.log('✅ Session is fresh');
          }
        } else {
          console.log('❌ No session info file found');
        }
      }
      
      // Check backup status
      const backupExists = fs.existsSync(this.backupPath);
      console.log(`💾 Backup exists: ${backupExists ? '✅' : '❌'}`);
      
    } catch (error) {
      console.error('❌ Error checking session status:', error.message);
    }
  }

  // 💾 Backup current session
  backupSession() {
    console.log('💾 Backing up WhatsApp session...');
    
    try {
      if (!fs.existsSync(this.sessionPath)) {
        console.log('❌ No session to backup');
        return false;
      }
      
      // Create backup directory
      if (!fs.existsSync(this.backupPath)) {
        fs.mkdirSync(this.backupPath, { recursive: true });
      }
      
      // Copy session files
      const files = fs.readdirSync(this.sessionPath);
      let copiedFiles = 0;
      
      files.forEach(file => {
        const sourcePath = path.join(this.sessionPath, file);
        const destPath = path.join(this.backupPath, file);
        
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
          copiedFiles++;
        } else if (fs.statSync(sourcePath).isDirectory()) {
          this.copyDirectory(sourcePath, destPath);
          copiedFiles++;
        }
      });
      
      // Add backup timestamp
      const backupInfo = {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        fileCount: copiedFiles
      };
      
      fs.writeFileSync(
        path.join(this.backupPath, 'backup-info.json'),
        JSON.stringify(backupInfo, null, 2)
      );
      
      console.log(`✅ Session backed up successfully (${copiedFiles} items)`);
      return true;
      
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      return false;
    }
  }

  // 🔄 Restore session from backup
  restoreSession() {
    console.log('🔄 Restoring WhatsApp session from backup...');
    
    try {
      if (!fs.existsSync(this.backupPath)) {
        console.log('❌ No backup found to restore');
        return false;
      }
      
      // Remove current session
      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
      }
      
      // Create session directory
      fs.mkdirSync(this.sessionPath, { recursive: true });
      
      // Copy backup files
      const files = fs.readdirSync(this.backupPath);
      let restoredFiles = 0;
      
      files.forEach(file => {
        if (file === 'backup-info.json') return; // Skip backup metadata
        
        const sourcePath = path.join(this.backupPath, file);
        const destPath = path.join(this.sessionPath, file);
        
        if (fs.statSync(sourcePath).isFile()) {
          fs.copyFileSync(sourcePath, destPath);
          restoredFiles++;
        } else if (fs.statSync(sourcePath).isDirectory()) {
          this.copyDirectory(sourcePath, destPath);
          restoredFiles++;
        }
      });
      
      console.log(`✅ Session restored successfully (${restoredFiles} items)`);
      return true;
      
    } catch (error) {
      console.error('❌ Restore failed:', error.message);
      return false;
    }
  }

  // 🧹 Clean current session (force fresh start)
  cleanSession() {
    console.log('🧹 Cleaning current WhatsApp session...');
    
    try {
      if (fs.existsSync(this.sessionPath)) {
        // Backup before cleaning
        console.log('📦 Creating backup before cleaning...');
        this.backupSession();
        
        // Remove session
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
        console.log('✅ Session cleaned successfully');
        console.log('📱 Next startup will require QR code scan');
        return true;
      } else {
        console.log('❌ No session to clean');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Clean failed:', error.message);
      return false;
    }
  }

  // 🔧 Repair corrupted session
  repairSession() {
    console.log('🔧 Attempting to repair corrupted session...');
    
    try {
      // First backup current state
      console.log('📦 Backing up current state...');
      this.backupSession();
      
      // Try to restore from backup
      if (fs.existsSync(this.backupPath)) {
        console.log('🔄 Attempting restore from backup...');
        return this.restoreSession();
      } else {
        console.log('🧹 No backup available - cleaning for fresh start...');
        return this.cleanSession();
      }
      
    } catch (error) {
      console.error('❌ Repair failed:', error.message);
      return false;
    }
  }

  // 📊 Generate session report
  generateReport() {
    console.log('📊 WhatsApp Session Report');
    console.log('==========================');
    
    this.getSessionStatus();
    
    console.log('\n💡 Recommendations:');
    
    try {
      if (fs.existsSync(this.sessionInfoPath)) {
        const sessionInfo = JSON.parse(fs.readFileSync(this.sessionInfoPath, 'utf8'));
        const sessionAge = Math.round((Date.now() - sessionInfo.lastAuth) / (24 * 60 * 60 * 1000));
        
        if (sessionAge > 7) {
          console.log('🔄 Run: node session-manager.js --clean (for fresh start)');
        } else if (sessionAge > 3) {
          console.log('💾 Run: node session-manager.js --backup (create backup)');
        } else {
          console.log('✅ Session is healthy - no action needed');
        }
      } else {
        console.log('🧹 Run: node session-manager.js --clean (for fresh start)');
      }
      
    } catch (error) {
      console.error('❌ Error generating recommendations:', error.message);
    }
  }

  // Helper: Copy directory recursively
  copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    
    const files = fs.readdirSync(source);
    files.forEach(file => {
      const sourcePath = path.join(source, file);
      const destPath = path.join(destination, file);
      
      if (fs.statSync(sourcePath).isDirectory()) {
        this.copyDirectory(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    });
  }
}

// CLI Interface
if (require.main === module) {
  const manager = new SessionManager();
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    manager.getSessionStatus();
  } else if (args.includes('--backup')) {
    manager.backupSession();
  } else if (args.includes('--restore')) {
    manager.restoreSession();
  } else if (args.includes('--clean')) {
    manager.cleanSession();
  } else if (args.includes('--repair')) {
    manager.repairSession();
  } else if (args.includes('--report')) {
    manager.generateReport();
  } else {
    console.log('🔧 WhatsApp Session Manager');
    console.log('========================');
    console.log('Usage:');
    console.log('  node session-manager.js --status   Show session status');
    console.log('  node session-manager.js --backup   Backup current session');
    console.log('  node session-manager.js --restore  Restore from backup');
    console.log('  node session-manager.js --clean    Clean session (fresh start)');
    console.log('  node session-manager.js --repair   Repair corrupted session');
    console.log('  node session-manager.js --report   Generate full report');
    console.log('');
    console.log('📊 Current Status:');
    manager.getSessionStatus();
  }
}

module.exports = SessionManager;
