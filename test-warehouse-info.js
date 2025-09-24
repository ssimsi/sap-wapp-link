// Test script to get warehouse information from multiple invoices
import { EmailService } from './email-service.js';

async function testWarehouseInfo() {
  console.log('🧪 Testing Warehouse Information from Multiple Invoices...');
  
  const emailService = new EmailService();
  
  try {
    await emailService.initializeSapConnection();
    
    // Get several invoices to see warehouse patterns
    console.log('\n🔍 Getting multiple invoices to analyze warehouse fields...');
    const response = await emailService.sapConnection.get('/Invoices?$top=5&$select=DocNum,CardName,FolioNumberFrom,WareHouseUpdateType,BPL_IDAssignedToInvoice,BPLName,U_almacen,DocEntry');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      console.log('\n📋 Invoice Warehouse Analysis:');
      
      for (let i = 0; i < response.data.value.length; i++) {
        const invoice = response.data.value[i];
        console.log(`\n--- Invoice ${i + 1}: ${invoice.DocNum} ---`);
        console.log(`Customer: ${invoice.CardName}`);
        console.log(`FolioNumber: ${invoice.FolioNumberFrom}`);
        console.log(`WareHouseUpdateType: ${invoice.WareHouseUpdateType}`);
        console.log(`BPL_IDAssignedToInvoice: ${invoice.BPL_IDAssignedToInvoice}`);
        console.log(`BPLName: ${invoice.BPLName}`);
        console.log(`U_almacen: ${invoice.U_almacen}`);
        
        // Try to get DocumentLines for this invoice
        try {
          console.log(`Getting DocumentLines for DocEntry ${invoice.DocEntry}...`);
          const linesResponse = await emailService.sapConnection.get(`/Invoices(${invoice.DocEntry})/DocumentLines`);
          
          if (linesResponse.data && linesResponse.data.value && linesResponse.data.value.length > 0) {
            const firstLine = linesResponse.data.value[0];
            console.log(`Found ${linesResponse.data.value.length} document lines`);
            
            // Look for warehouse fields in the line
            const warehouseFields = ['WarehouseCode', 'WhsCode', 'FromWarehouseCode', 'ToWarehouseCode'];
            warehouseFields.forEach(field => {
              if (firstLine[field] !== undefined) {
                console.log(`  ${field}: ${firstLine[field]}`);
              }
            });
            
          } else {
            console.log('  No DocumentLines data returned');
          }
        } catch (lineError) {
          console.log(`  DocumentLines error: ${lineError.message}`);
        }
      }
      
      // Test direct DocumentLines query
      console.log('\n🔍 Testing direct DocumentLines query...');
      try {
        const directLinesResponse = await emailService.sapConnection.get('/DocumentLines?$top=3');
        if (directLinesResponse.data && directLinesResponse.data.value) {
          console.log(`Found ${directLinesResponse.data.value.length} document lines via direct query`);
          const sampleLine = directLinesResponse.data.value[0];
          
          console.log('\n📦 Sample DocumentLine warehouse fields:');
          Object.keys(sampleLine).forEach(field => {
            if (field.toLowerCase().includes('warehouse') || field.toLowerCase().includes('whse') || field.toLowerCase().includes('whs')) {
              console.log(`  ${field}: ${sampleLine[field]}`);
            }
          });
        }
      } catch (directError) {
        console.log(`Direct DocumentLines query error: ${directError.message}`);
      }
      
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

testWarehouseInfo();