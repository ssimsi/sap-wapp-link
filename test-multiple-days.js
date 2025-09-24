import { EmailService } from './email-service.js';

async function testMultipleDays() {
  try {
    console.log('🧪 Testing email service with multiple days (Sep 22-24)...\n');
    
    const emailService = new EmailService();
    await emailService.initializeSapConnection();
    
    // Test with 3-day range
    const invoices = await emailService.getUnsentInvoicesFromSAP('2025-09-22', '2025-09-24');
    
    console.log(`📊 Total found: ${invoices ? invoices.length : 0} invoices\n`);
    
    if (invoices && invoices.length > 0) {
      // Breakdown by date
      const dateBreakdown = {};
      invoices.forEach(inv => {
        const date = inv.DocDate;
        dateBreakdown[date] = (dateBreakdown[date] || 0) + 1;
      });
      
      console.log('📅 By Date:');
      Object.entries(dateBreakdown).sort().forEach(([date, count]) => {
        console.log(`   ${date}: ${count} invoices`);
      });
      
      // Breakdown by series
      const seriesBreakdown = {};
      invoices.forEach(inv => {
        const series = inv.Series === 4 ? 'Factura (4)' : inv.Series === 76 ? 'Comprobante (76)' : `Series ${inv.Series}`;
        seriesBreakdown[series] = (seriesBreakdown[series] || 0) + 1;
      });
      
      console.log('\n📊 By Series:');
      Object.entries(seriesBreakdown).forEach(([series, count]) => {
        console.log(`   ${series}: ${count} invoices`);
      });
      
      console.log(`\n🎯 Email service can now process ${invoices.length} invoices instead of just 20!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMultipleDays();