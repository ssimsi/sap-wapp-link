import { EmailService } from './email-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function exploreInvoice14936() {
  try {
    console.log('🔍 Exploring all fields in invoice 14936...');
    
    const emailService = new EmailService();
    
    // Initialize SAP connection
    await emailService.initializeSapConnection();
    
    // Get the invoice with ALL fields (no $select filter)
    console.log('📋 Fetching invoice 14936 with ALL fields...');
    const response = await emailService.sapConnection.get(`/Invoices?$filter=FolioNumberFrom eq 14936`);
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      
      console.log('\n📄 INVOICE 14936 - ALL FIELDS:');
      console.log('=====================================');
      
      // Sort fields alphabetically for easier reading
      const sortedFields = Object.keys(invoice).sort();
      
      for (const field of sortedFields) {
        const value = invoice[field];
        console.log(`${field}: ${JSON.stringify(value)}`);
      }
      
      console.log('\n🔍 Looking for customer reference related fields:');
      console.log('================================================');
      
      // Look for fields that might contain customer references
      const customerRefFields = sortedFields.filter(field => 
        field.toLowerCase().includes('ref') ||
        field.toLowerCase().includes('customer') ||
        field.toLowerCase().includes('client') ||
        field.toLowerCase().includes('number') ||
        field.toLowerCase().includes('folio') ||
        field.toLowerCase().includes('doc')
      );
      
      customerRefFields.forEach(field => {
        console.log(`📌 ${field}: ${JSON.stringify(invoice[field])}`);
      });
      
    } else {
      console.log('❌ Invoice 14936 not found in SAP');
    }
    
  } catch (error) {
    console.error('💥 Error exploring invoice:', error.message);
  }
}

// Run the exploration
exploreInvoice14936().then(() => {
  console.log('\n🏁 Exploration completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Exploration failed:', error);
  process.exit(1);
});