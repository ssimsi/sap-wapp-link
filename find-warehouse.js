// Test script to get warehouse from invoice lines using different approaches
import { EmailService } from './email-service.js';

async function findWarehouseFromLines() {
  console.log('🧪 Finding Warehouse from Invoice Lines...');
  
  const emailService = new EmailService();
  
  try {
    await emailService.initializeSapConnection();
    
    // Get one recent invoice
    console.log('\n🔍 Getting recent invoice...');
    const invoiceResponse = await emailService.sapConnection.get('/Invoices?$top=1&$orderby=DocEntry desc&$select=DocNum,CardName,FolioNumberFrom,DocEntry');
    
    if (invoiceResponse.data && invoiceResponse.data.value && invoiceResponse.data.value.length > 0) {
      const invoice = invoiceResponse.data.value[0];
      
      console.log('\n📋 Invoice Info:');
      console.log(`DocNum: ${invoice.DocNum}`);
      console.log(`Customer: ${invoice.CardName}`);
      console.log(`FolioNumber: ${invoice.FolioNumberFrom}`);
      console.log(`DocEntry: ${invoice.DocEntry}`);
      
      // Try different approaches to get document lines
      const approaches = [
        // Approach 1: Try DocumentLines entity with BaseEntry filter
        {
          name: 'DocumentLines with BaseEntry filter',
          query: `/DocumentLines?$filter=BaseEntry eq ${invoice.DocEntry} and BaseType eq 13&$top=1`
        },
        // Approach 2: Try InvoiceLines (if it exists)
        {
          name: 'InvoiceLines entity',
          query: `/InvoiceLines?$filter=DocEntry eq ${invoice.DocEntry}&$top=1`
        },
        // Approach 3: Try Document_Lines directly
        {
          name: 'Document_Lines entity',
          query: `/Document_Lines?$filter=DocEntry eq ${invoice.DocEntry}&$top=1`
        },
        // Approach 4: Try Invoices with specific DocEntry
        {
          name: 'Single Invoice by DocEntry',
          query: `/Invoices(${invoice.DocEntry})`
        }
      ];
      
      for (const approach of approaches) {
        try {
          console.log(`\n🔍 Trying: ${approach.name}`);
          const response = await emailService.sapConnection.get(approach.query);
          
          if (response.data) {
            if (response.data.value) {
              console.log(`✅ Success! Found ${response.data.value.length} records`);
              if (response.data.value.length > 0) {
                const line = response.data.value[0];
                console.log('📦 Fields in response:');
                Object.keys(line).forEach(field => {
                  if (field.toLowerCase().includes('warehouse') || field.toLowerCase().includes('whse') || field.toLowerCase().includes('whs')) {
                    console.log(`  🏢 ${field}: ${line[field]}`);
                  }
                });
                
                // Check for common warehouse fields
                const warehouseFields = ['WarehouseCode', 'WhsCode', 'FromWarehouseCode', 'ToWarehouseCode'];
                warehouseFields.forEach(field => {
                  if (line[field] !== undefined) {
                    console.log(`  ✅ ${field}: ${line[field]}`);
                  }
                });
                break; // Stop after first success
              }
            } else {
              // Single entity response
              console.log('✅ Success! Got single entity response');
              const entity = response.data;
              console.log('📦 Looking for Document_Lines in response...');
              if (entity.Document_Lines && entity.Document_Lines.length > 0) {
                console.log(`Found ${entity.Document_Lines.length} document lines!`);
                const line = entity.Document_Lines[0];
                Object.keys(line).forEach(field => {
                  if (field.toLowerCase().includes('warehouse') || field.toLowerCase().includes('whse') || field.toLowerCase().includes('whs')) {
                    console.log(`  🏢 ${field}: ${line[field]}`);
                  }
                });
              } else {
                console.log('No Document_Lines found in single entity response');
              }
            }
          }
        } catch (error) {
          console.log(`❌ ${approach.name} failed: ${error.message}`);
        }
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

findWarehouseFromLines();