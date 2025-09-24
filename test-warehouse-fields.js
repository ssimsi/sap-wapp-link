// Test script to find warehouse fields in SAP invoices
import { EmailService } from './email-service.js';

async function testWarehouseFields() {
  console.log('🧪 Testing Warehouse Field Discovery...');
  
  const emailService = new EmailService();
  
  try {
    // Test SAP connection first
    console.log('\n🔗 Testing SAP connection...');
    await emailService.initializeSapConnection();
    console.log('✅ SAP connection established');
    
    // Get one invoice first, then get its DocumentLines separately
    console.log('\n🔍 Querying SAP invoice for warehouse fields...');
    const response = await emailService.sapConnection.get('/Invoices?$top=1');
    
    if (response.data && response.data.value && response.data.value.length > 0) {
      const invoice = response.data.value[0];
      
      console.log('\n📋 Invoice Header Info:');
      console.log(`DocNum: ${invoice.DocNum}`);
      console.log(`Customer: ${invoice.CardName}`);
      console.log(`Date: ${invoice.DocDate}`);
      console.log(`FolioNumber: ${invoice.FolioNumberFrom}`);
      
      // Look for warehouse fields in header
      console.log('\n🏢 Looking for Warehouse fields in Invoice Header:');
      const headerWarehouseFields = Object.keys(invoice).filter(field => 
        field.toLowerCase().includes('warehouse') || 
        field.toLowerCase().includes('whse') ||
        field.toLowerCase().includes('almacen') ||
        field.toLowerCase().includes('deposito') ||
        field.toLowerCase().includes('branch') ||
        field.toLowerCase().includes('location') ||
        field.toLowerCase().includes('bpl')
      );
      
      if (headerWarehouseFields.length > 0) {
        console.log('📦 Warehouse fields found in header:');
        headerWarehouseFields.forEach(field => {
          console.log(`  ${field}: ${invoice[field]}`);
        });
      } else {
        console.log('❌ No warehouse fields found in invoice header');
      }
      
      // Get DocumentLines separately
      console.log('\n📦 Getting DocumentLines for warehouse info...');
      try {
        const linesResponse = await emailService.sapConnection.get(`/Invoices(${invoice.DocEntry})/DocumentLines`);
        
        if (linesResponse.data && linesResponse.data.value && linesResponse.data.value.length > 0) {
          const firstLine = linesResponse.data.value[0];
          console.log(`Found ${linesResponse.data.value.length} document lines`);
          
          console.log('\n📋 All DocumentLine fields:');
          Object.keys(firstLine).forEach(field => {
            console.log(`  ${field}: ${firstLine[field]}`);
          });
          
          console.log('\n🔍 Warehouse-related fields in DocumentLines:');
          const lineWarehouseFields = Object.keys(firstLine).filter(field => 
            field.toLowerCase().includes('warehouse') || 
            field.toLowerCase().includes('whse') ||
            field.toLowerCase().includes('almacen') ||
            field.toLowerCase().includes('deposito') ||
            field.toLowerCase().includes('branch') ||
            field.toLowerCase().includes('location') ||
            field.toLowerCase().includes('bpl')
          );
          
          if (lineWarehouseFields.length > 0) {
            console.log('📦 Warehouse fields found in DocumentLines:');
            lineWarehouseFields.forEach(field => {
              console.log(`  ${field}: ${firstLine[field]}`);
            });
          } else {
            console.log('❌ No obvious warehouse fields found in DocumentLines');
            console.log('🔍 Let me check for any fields that might contain warehouse codes...');
            
            // Check for fields with short codes that might be warehouses
            Object.keys(firstLine).forEach(field => {
              const value = firstLine[field];
              if (typeof value === 'string' && value.length <= 10 && value.length >= 1) {
                console.log(`  ${field}: ${value} (possible warehouse code?)`);
              } else if (typeof value === 'number' && value > 0 && value < 100) {
                console.log(`  ${field}: ${value} (possible warehouse ID?)`);
              }
            });
          }
          
        } else {
          console.log('❌ No DocumentLines found');
        }
      } catch (lineError) {
        console.error('❌ Error getting DocumentLines:', lineError.message);
      }
      
      // Summary
      console.log('\n📋 WAREHOUSE FIELD SUMMARY:');
      console.log(`✅ Name: ${invoice.CardName}`);
      console.log(`✅ Date: ${invoice.DocDate}`);
      console.log(`✅ FolioNumber: ${invoice.FolioNumberFrom}`);
      console.log(`⚠️ Warehouse: Need to identify from above field analysis`);
      
    } else {
      console.log('❌ No invoices found in SAP');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testWarehouseFields();