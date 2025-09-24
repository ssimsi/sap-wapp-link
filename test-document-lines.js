// Test script to get warehouse from Document_Lines
import { EmailService } from './email-service.js';

async function testDocumentLinesWarehouse() {
  console.log('🧪 Testing Document_Lines for Warehouse Information...');
  
  const emailService = new EmailService();
  
  try {
    await emailService.initializeSapConnection();
    
    // First get one invoice, then get its details with Document_Lines expansion
    console.log('\n🔍 Getting one invoice first...');
    const invoicesResponse = await emailService.sapConnection.get('/Invoices?$top=1&$select=DocNum,CardName,FolioNumberFrom,DocEntry');
    
    if (invoicesResponse.data && invoicesResponse.data.value && invoicesResponse.data.value.length > 0) {
      const invoiceBasic = invoicesResponse.data.value[0];
      const docEntry = invoiceBasic.DocEntry;
      
      console.log(`\n🔍 Getting invoice ${docEntry} with Document_Lines expansion...`);
      const response = await emailService.sapConnection.get(`/Invoices?$filter=DocEntry eq ${docEntry}&$expand=Document_Lines`);
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      
      console.log('\n📋 Invoice Info:');
      console.log(`DocNum: ${invoice.DocNum}`);
      console.log(`Customer: ${invoice.CardName}`);
      console.log(`FolioNumber: ${invoice.FolioNumberFrom}`);
      console.log(`DocEntry: ${invoice.DocEntry}`);
      
      // Check Document_Lines for warehouse information
      if (invoice.Document_Lines && invoice.Document_Lines.length > 0) {
        console.log(`\n📦 Found ${invoice.Document_Lines.length} document lines`);
        
        const firstLine = invoice.Document_Lines[0];
        console.log('\n📋 All Document_Lines fields:');
        Object.keys(firstLine).forEach(field => {
          console.log(`  ${field}: ${firstLine[field]}`);
        });
        
        console.log('\n🔍 Warehouse-related fields in Document_Lines:');
        const warehouseFields = Object.keys(firstLine).filter(field => 
          field.toLowerCase().includes('warehouse') || 
          field.toLowerCase().includes('whse') ||
          field.toLowerCase().includes('whs') ||
          field.toLowerCase().includes('almacen') ||
          field.toLowerCase().includes('deposito')
        );
        
        if (warehouseFields.length > 0) {
          console.log('📦 Warehouse fields found:');
          warehouseFields.forEach(field => {
            console.log(`  ${field}: ${firstLine[field]}`);
          });
        } else {
          console.log('❌ No obvious warehouse fields found');
        }
        
        // Check for common warehouse field names
        const commonWarehouseFields = ['WarehouseCode', 'WhsCode', 'FromWarehouseCode', 'ToWarehouseCode', 'U_Warehouse', 'U_Almacen'];
        console.log('\n🔍 Checking common warehouse field names:');
        commonWarehouseFields.forEach(field => {
          if (firstLine[field] !== undefined) {
            console.log(`  ✅ ${field}: ${firstLine[field]}`);
          }
        });
        
        } else {
          console.log('❌ No Document_Lines found in invoice');
        }
        
      } else {
        console.log('❌ No invoices found in expansion response');
      }
      
    } else {
      console.log('❌ No invoices found in initial query');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testDocumentLinesWarehouse();