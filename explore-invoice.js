// Test script to explore invoice structure and find warehouse
import { EmailService } from './email-service.js';

async function exploreInvoiceStructure() {
  console.log('🧪 Exploring Invoice Structure for Warehouse...');
  
  const emailService = new EmailService();
  
  try {
    await emailService.initializeSapConnection();
    
    // Get one recent invoice with ALL fields
    console.log('\n🔍 Getting complete invoice structure...');
    const response = await emailService.sapConnection.get('/Invoices?$top=1&$orderby=DocEntry desc');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      
      console.log('\n📋 Invoice Info:');
      console.log(`DocNum: ${invoice.DocNum}`);
      console.log(`DocEntry: ${invoice.DocEntry}`);
      console.log(`FolioNumber: ${invoice.FolioNumberFrom}`);
      
      // Look for any array fields that might contain line items
      console.log('\n📦 Looking for array fields (potential line items):');
      Object.keys(invoice).forEach(field => {
        if (Array.isArray(invoice[field])) {
          console.log(`  ${field}: Array with ${invoice[field].length} items`);
          if (invoice[field].length > 0) {
            console.log(`    Sample item keys: ${Object.keys(invoice[field][0]).slice(0, 5).join(', ')}...`);
            
            // Check if this array contains warehouse info
            const sampleItem = invoice[field][0];
            Object.keys(sampleItem).forEach(itemField => {
              if (itemField.toLowerCase().includes('warehouse') || itemField.toLowerCase().includes('whse') || itemField.toLowerCase().includes('whs')) {
                console.log(`    🏢 FOUND WAREHOUSE FIELD: ${itemField} = ${sampleItem[itemField]}`);
              }
            });
          }
        }
      });
      
      // Also check for warehouse-related fields in the main invoice
      console.log('\n🏢 Warehouse fields in main invoice:');
      Object.keys(invoice).forEach(field => {
        if (field.toLowerCase().includes('warehouse') || field.toLowerCase().includes('whse') || field.toLowerCase().includes('whs') || field.toLowerCase().includes('almacen')) {
          console.log(`  ${field}: ${invoice[field]}`);
        }
      });
      
      // Look for BPL (Branch/Plant/Location) fields which might indicate warehouse
      console.log('\n🏭 Branch/Location fields:');
      Object.keys(invoice).forEach(field => {
        if (field.toLowerCase().includes('bpl') || field.toLowerCase().includes('branch') || field.toLowerCase().includes('location')) {
          console.log(`  ${field}: ${invoice[field]}`);
        }
      });
      
    } else {
      console.log('❌ No invoices found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

exploreInvoiceStructure();