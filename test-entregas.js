#!/usr/bin/env node

import { EmailService } from './email-service.js';

async function testEntregas() {
  console.log('🧪 Testing Entregas functionality...\n');
  
  try {
    const emailService = new EmailService();
    
    // Initialize SAP connection first
    console.log('🔗 Initializing SAP connection...');
    await emailService.initializeSapConnection();
    
    // Test getting unsent entregas from SAP
    console.log('1️⃣ Testing getUnsentEntregasFromSAP...');
    const entregas = await emailService.getUnsentEntregasFromSAP();
    
    if (entregas && entregas.length > 0) {
      console.log(`📦 Found ${entregas.length} unsent entregas`);
      
      // Show first few entregas for inspection
      console.log('\n📋 First few entregas (raw data):');
      entregas.slice(0, 2).forEach((entrega, index) => {
        console.log(`${index + 1}. Raw entrega object:`, JSON.stringify(entrega, null, 2));
        console.log('');
      });
      
      console.log('\n📋 Parsed entregas:');
      entregas.slice(0, 3).forEach((entrega, index) => {
        console.log(`${index + 1}. DocNum: ${entrega.docNum}, Customer: ${entrega.customerName}`);
        console.log(`   Date: ${entrega.date}, DocEntry: ${entrega.docEntry}`);
        console.log(`   DocumentLines: ${entrega.documentLines ? entrega.documentLines.length : 'N/A'} lines`);
        
        if (entrega.documentLines && entrega.documentLines.length > 0) {
          console.log(`   Warehouses: ${entrega.documentLines.map(line => line.WarehouseCode || 'N/A').join(', ')}`);
        }
        console.log('');
      });
      
      // Test processing one entrega
      if (entregas.length > 0) {
        console.log('2️⃣ Testing sendEntregaEmail with first entrega...');
        const testEntrega = entregas[0];
        const emailResult = await emailService.sendEntregaEmail(testEntrega);
        
        console.log('Email result:', emailResult);
        
        if (emailResult.success) {
          console.log('✅ Email processing successful');
          if (emailResult.emailSent) {
            console.log('📧 Email was sent to warehouse');
          } else {
            console.log('📝 Email was not sent (no warehouse 07)');
          }
        }
      }
      
    } else {
      console.log('ℹ️ No unsent entregas found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testEntregas().then(() => {
  console.log('\n🏁 Entregas test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});