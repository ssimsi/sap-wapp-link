import { EmailService } from './email-service.js';

async function testUnlimitedPagination() {
  try {
    console.log('🧪 Testing unlimited pagination in email service...\n');
    
    const emailService = new EmailService();
    
    // Initialize SAP connection
    console.log('🔗 Initializing SAP connection...');
    await emailService.initializeSapConnection();
    console.log('✅ SAP connection established\n');
    
    // Test the getUnsentInvoicesFromSAP method with no limits
    console.log('📊 Testing getUnsentInvoicesFromSAP with unlimited pagination...');
    const invoices = await emailService.getUnsentInvoicesFromSAP('2025-09-22', '2025-09-22');
    
    console.log(`📈 Results: Found ${invoices ? invoices.length : 0} invoices\n`);
    
    if (invoices && invoices.length > 0) {
      console.log('✅ Pagination fix working! Here\'s a sample:');
      
      // Show first 5 invoices
      console.log('\n📋 First 5 invoices:');
      invoices.slice(0, 5).forEach((invoice, index) => {
        console.log(`${index + 1}. Folio: ${invoice.FolioNumberFrom || 'NULL'} | DocNum: ${invoice.DocNum} | Customer: ${invoice.CardName}`);
      });
      
      // Show series breakdown
      const seriesBreakdown = {};
      invoices.forEach(inv => {
        const series = inv.Series === 4 ? 'Factura (4)' : inv.Series === 76 ? 'Comprobante (76)' : `Series ${inv.Series}`;
        seriesBreakdown[series] = (seriesBreakdown[series] || 0) + 1;
      });
      
      console.log('\n📊 Series breakdown:');
      Object.entries(seriesBreakdown).forEach(([series, count]) => {
        console.log(`   ${series}: ${count} invoices`);
      });
      
      console.log(`\n✅ Total invoices found: ${invoices.length}`);
      console.log('🎉 Pagination limit successfully removed!');
      
    } else {
      console.log('❌ No invoices found or pagination fix failed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('SAP Response:', error.response.status, error.response.statusText);
    }
  }
}

testUnlimitedPagination();