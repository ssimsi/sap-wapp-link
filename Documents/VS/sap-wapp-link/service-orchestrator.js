#!/usr/bin/env node

/**
 * Service Orchestrator
 * Manages all SAP-WhatsApp integration services
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class ServiceOrchestrator {
  constructor() {
    this.services = [];
    this.isShuttingDown = false;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  startService(name, scriptPath, args = []) {
    this.log(`🚀 Starting ${name}...`);
    
    const service = spawn('node', [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    service.stdout.on('data', (data) => {
      process.stdout.write(`[${name}] ${data}`);
    });

    service.stderr.on('data', (data) => {
      process.stderr.write(`[${name}] ERROR: ${data}`);
    });

    service.on('close', (code) => {
      if (!this.isShuttingDown) {
        this.log(`❌ ${name} exited with code ${code}. Restarting in 5 seconds...`);
        setTimeout(() => {
          if (!this.isShuttingDown) {
            this.startService(name, scriptPath, args);
          }
        }, 5000);
      }
    });

    service.on('error', (err) => {
      this.log(`💥 Failed to start ${name}: ${err.message}`);
    });

    this.services.push({ name, process: service, scriptPath, args });
    this.log(`✅ ${name} started with PID: ${service.pid}`);
  }

  async startAllServices() {
    this.log('🎬 Starting SAP-WhatsApp Integration Service Orchestrator');
    this.log('===========================================================');
    
    // Ensure required directories exist
    const dirs = ['./downloaded-pdfs', './temp-pdfs', './logs'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`📁 Created directory: ${dir}`);
      }
    });

    // Start PDF Download Service (runs at X:40 every hour)
    this.startService('PDF Download Service', './pdf-download-service.js');
    
    // Start PDF Cleanup Service (runs daily at 3 AM)
    this.startService('PDF Cleanup Service', './pdf-cleanup-service.js');
    
    // Wait a moment for other services to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start Main Hybrid Service (runs hourly)
    this.startService('Hybrid Invoice Service', './hybrid-invoice-service.js');

    this.log('🎯 All services started successfully!');
    this.log('');
    this.log('📋 Service Schedule:');
    this.log('   • PDF Download: Every hour at minute 40');
    this.log('   • Invoice Processing: Every hour at minute 0');  
    this.log('   • PDF Cleanup: Daily at 3:00 AM');
    this.log('');
    this.log('📁 Folder Structure:');
    this.log('   • ./downloaded-pdfs/ - Raw PDFs from emails');
    this.log('   • ./temp-pdfs/ - Processed PDFs for WhatsApp');
    this.log('   • ./logs/ - Service logs');
    this.log('');
    this.log('🔧 Commands:');
    this.log('   • Ctrl+C to stop all services');
    this.log('   • View logs in ./logs/ folder');
  }

  async shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.log('🛑 Shutting down all services...');

    const shutdownPromises = this.services.map(service => {
      return new Promise((resolve) => {
        this.log(`⏹️ Stopping ${service.name}...`);
        
        service.process.kill('SIGTERM');
        
        setTimeout(() => {
          if (!service.process.killed) {
            this.log(`🔪 Force killing ${service.name}...`);
            service.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    });

    await Promise.all(shutdownPromises);
    this.log('✅ All services stopped');
    process.exit(0);
  }

  async getServiceStatus() {
    const status = {
      orchestrator: {
        uptime: process.uptime(),
        services: this.services.length
      },
      services: this.services.map(service => ({
        name: service.name,
        pid: service.process.pid,
        running: !service.process.killed
      }))
    };

    return status;
  }
}

// Create and start orchestrator
const orchestrator = new ServiceOrchestrator();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Received shutdown signal...');
  orchestrator.shutdown();
});

process.on('SIGTERM', () => {
  console.log('\n👋 Received termination signal...');
  orchestrator.shutdown();
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception in Service Orchestrator:', error);
  orchestrator.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection in Service Orchestrator:', reason);
  orchestrator.shutdown();
});

// Start all services
orchestrator.startAllServices().catch(error => {
  console.error('💥 Failed to start services:', error);
  process.exit(1);
});
