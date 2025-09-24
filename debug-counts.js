import { EmailService } from './email-service.js';

async function debugUnsentCounts() {
  try {
    console.log('🕵️ Deep dive into unsent invoice counts...\n');
    
    const emailService = new EmailService();
    await emailService.initializeSapConnection();
    
    // Check each day individually
    const dates = ['2025-09-22', '2025-09-23', '2025-09-24'];
    
    for (const date of dates) {
      console.log(`📅 Checking ${date}:`);
      
      const query = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate eq '${date}'&$select=DocEntry,DocNum,DocDate,Series&$orderby=DocEntry desc`;
      const response = await emailService.sapConnection.get(query, {
        headers: { 'Prefer': 'maxpagesize=0' }
      });
      
      const count = response.data.value.length;
      console.log(`   Unsent invoices: ${count}`);
      
      if (count > 0) {
        const seriesCounts = {};
        response.data.value.forEach(inv => {
          const series = inv.Series === 4 ? 'Factura' : inv.Series === 76 ? 'Comprobante' : `Series ${inv.Series}`;
          seriesCounts[series] = (seriesCounts[series] || 0) + 1;
        });
        
        Object.entries(seriesCounts).forEach(([series, count]) => {
          console.log(`     ${series}: ${count}`);
        });
        
        // Show first few DocNums
        const docNums = response.data.value.slice(0, 3).map(inv => inv.DocNum);
        console.log(`     Sample DocNums: ${docNums.join(', ')}`);
      }
      console.log('');
    }
    
    // Check date range queries
    console.log('🔍 Testing date ranges:');
    
    const rangeQuery = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate ge '2025-09-22' and DocDate le '2025-09-24'&$select=DocEntry,DocDate&$orderby=DocDate desc`;
    const rangeResponse = await emailService.sapConnection.get(rangeQuery, {
      headers: { 'Prefer': 'maxpagesize=0' }
    });
    
    console.log(`📊 Sep 22-24 range: ${rangeResponse.data.value.length} invoices`);
    
    // Group by date
    const dateGroups = {};
    rangeResponse.data.value.forEach(inv => {
      const date = inv.DocDate;
      dateGroups[date] = (dateGroups[date] || 0) + 1;
    });
    
    console.log('📅 Breakdown by date:');
    Object.entries(dateGroups).sort().forEach(([date, count]) => {
      console.log(`   ${date}: ${count} invoices`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugUnsentCounts();