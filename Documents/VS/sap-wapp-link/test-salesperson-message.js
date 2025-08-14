#!/usr/bin/env node

// Test script to show salesperson message with delivery status
import HybridInvoiceService from './hybrid-invoice-service.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testSalespersonMessage() {
  console.log('🧪 Testing Salesperson Message with Delivery Status\n');

  const service = new HybridInvoiceService();
  
  // Mock invoice data (Series 4)
  const mockInvoiceSeries4 = {
    DocEntry: 12345,
    DocNum: '15412',
    CardCode: 'C001',
    CardName: 'EJEMPLO CLIENTE SRL',
    DocTotal: 125000.50,
    DocDate: '2025-08-11',
    Series: 4,
    SalesPersonCode: 19
  };

  // Mock invoice data (Series 76)
  const mockInvoiceSeries76 = {
    DocEntry: 12346,
    DocNum: '9008535',
    CardCode: 'C002',
    CardName: 'CLIENTE PRUEBA SA',
    DocTotal: 75000.00,
    DocDate: '2025-08-11',
    Series: 76,
    SalesPersonCode: 22
  };

  console.log('📋 Series 4 Invoice - Salesperson Message:');
  console.log('═'.repeat(60));
  try {
    const message4 = await service.generateSalespersonMessage(mockInvoiceSeries4, 'Carlos');
    console.log(message4);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n\n📄 Series 76 Invoice - Salesperson Message:');
  console.log('═'.repeat(60));
  try {
    const message76 = await service.generateSalespersonMessage(mockInvoiceSeries76, 'Gabriel');
    console.log(message76);
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n✅ Message test completed');
}

testSalespersonMessage().catch(console.error);
