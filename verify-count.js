import { EmailService } from './email-service.js';

async function verifyTotalCount() {
  try {
    console.log('🔍 Verifying total unsent invoice count...\n');
    
    const emailService = new EmailService();
    
    // Initialize SAP connection
    console.log('🔗 Initializing SAP connection...');
    await emailService.initializeSapConnection();
    console.log('✅ SAP connection established\n');
    
    // Test 1: Count unsent invoices for September 22 with different sorting
    console.log('📊 Test 1: September 22 with DocDate desc (email service order)');
    const query1 = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate ge '2025-09-22' and DocDate le '2025-09-22'&$select=DocEntry,DocNum,FolioNumberFrom,Series&$orderby=DocDate desc`;
    const response1 = await emailService.sapConnection.get(query1, {
      headers: { 'Prefer': 'maxpagesize=0' }
    });
    console.log(`   Found: ${response1.data.value.length} invoices`);
    
    // Test 2: Count unsent invoices for September 22 with FolioNumber sorting  
    console.log('📊 Test 2: September 22 with FolioNumberFrom asc (list script order)');
    const query2 = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate ge '2025-09-22' and DocDate le '2025-09-22'&$select=DocEntry,DocNum,FolioNumberFrom,Series&$orderby=FolioNumberFrom asc`;
    const response2 = await emailService.sapConnection.get(query2, {
      headers: { 'Prefer': 'maxpagesize=0' }
    });
    console.log(`   Found: ${response2.data.value.length} invoices`);
    
    // Test 3: Count ALL unsent invoices (no date filter)
    console.log('📊 Test 3: ALL unsent invoices (no date filter)');
    const query3 = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null)&$select=DocEntry,DocNum,DocDate&$orderby=DocDate desc`;
    const response3 = await emailService.sapConnection.get(query3, {
      headers: { 'Prefer': 'maxpagesize=0' }
    });
    console.log(`   Found: ${response3.data.value.length} invoices`);
    
    // Show recent dates
    if (response3.data.value.length > 0) {
      const recentDates = [...new Set(response3.data.value.slice(0, 10).map(inv => inv.DocDate))];
      console.log(`   Recent dates: ${recentDates.join(', ')}`);
    }
    
    // Test 4: Count just for September 23
    console.log('📊 Test 4: September 23 unsent invoices');
    const query4 = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate ge '2025-09-23' and DocDate le '2025-09-23'&$select=DocEntry,DocNum&$orderby=DocDate desc`;
    const response4 = await emailService.sapConnection.get(query4, {
      headers: { 'Prefer': 'maxpagesize=0' }
    });
    console.log(`   Found: ${response4.data.value.length} invoices`);
    
    console.log('\n🔍 Analysis:');
    if (response1.data.value.length === response2.data.value.length) {
      console.log('✅ Both sorting methods return same count - pagination is working correctly');
      console.log(`📊 Total unsent invoices for Sep 22: ${response1.data.value.length}`);
    } else {
      console.log('❌ Different counts - there may be a pagination issue');
    }
    
    if (response3.data.value.length > response1.data.value.length) {
      console.log(`📈 There are ${response3.data.value.length - response1.data.value.length} more unsent invoices from other dates`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyTotalCount();