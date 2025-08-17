import EmailInvoiceMonitor from './email-invoice-monitor.js';
import WhatsAppService from './whatsapp-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class IntegratedInvoiceService {
  constructor() {
    this.emailMonitor = new EmailInvoiceMonitor();
    this.whatsappService = new WhatsAppService();
    this.isRunning = false;
  }

  async start() {
    console.log('🚀 Starting Integrated Invoice Service');
    console.log('=====================================');
    
    try {
      // Initialize WhatsApp service
      console.log('\n📱 Initializing WhatsApp service...');
      await this.whatsappService.initialize();
      
      // Start email monitoring with WhatsApp integration
      console.log('\n📧 Starting email monitoring...');
      await this.emailMonitor.startMonitoring(this.whatsappService);
      
      this.isRunning = true;
      console.log('\n✅ Integrated service started successfully!');
      console.log('🔄 Now monitoring emails and sending via WhatsApp...');
      
      // Handle graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('\n❌ Failed to start integrated service:', error.message);
      await this.stop();
      process.exit(1);
    }
  }

  async stop() {
    if (!this.isRunning) return;
    
    console.log('\n🛑 Stopping Integrated Invoice Service...');
    
    try {
      // Stop email monitoring
      if (this.emailMonitor) {
        this.emailMonitor.disconnect();
        console.log('📧 Email monitoring stopped');
      }
      
      // Stop WhatsApp service
      if (this.whatsappService) {
        await this.whatsappService.stop();
        console.log('📱 WhatsApp service stopped');
      }
      
      this.isRunning = false;
      console.log('✅ Integrated service stopped gracefully');
      
    } catch (error) {
      console.error('❌ Error stopping service:', error.message);
    }
    
    process.exit(0);
  }
}

// Start the service if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new IntegratedInvoiceService();
  service.start().catch(console.error);
}

export default IntegratedInvoiceService;
