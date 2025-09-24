import { EmailService } from './email-service.js';

async function listAllUnsentInvoices() {
  try {
    console.log('🔍 Listing ALL unsent invoices for September 22, 2025...\n');
    
    const emailService = new EmailService();
    
    // Initialize SAP connection
    console.log('🔗 Initializing SAP connection...');
    await emailService.initializeSapConnection();
    console.log('✅ SAP connection established\n');
    
    // Direct SAP query with no pagination limit using Prefer header
    const targetDate = '2025-09-22';
    const sapUrl = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate ge '${targetDate}' and DocDate le '${targetDate}'&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,U_EmailSent,Series,SalesPersonCode,DocEntry,NumAtCard,Comments&$orderby=FolioNumberFrom asc`;
    
    console.log(`🔍 SAP Query (no pagination): ${sapUrl}\n`);
    
    const response = await emailService.sapConnection.get(sapUrl, {
      headers: {
        'Prefer': 'maxpagesize=0'
      }
    });
    
    if (response.data && response.data.value) {
      console.log(`📊 Found ${response.data.value.length} unsent invoices on ${targetDate}:\n`);
      
      console.log('📋 Complete List of Unsent Invoices:');
      console.log('═'.repeat(80));
      
      response.data.value.forEach((invoice, index) => {
        const seriesType = invoice.Series === 4 ? 'Factura' : invoice.Series === 76 ? 'Comprobante' : `Series ${invoice.Series}`;
        const total = parseFloat(invoice.DocTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 });
        
        console.log(`${(index + 1).toString().padStart(2, '0')}. Folio: ${invoice.FolioNumberFrom}`);
        console.log(`    DocNum: ${invoice.DocNum} | ${seriesType} | $${total}`);
        console.log(`    Customer: ${invoice.CardCode} - ${invoice.CardName}`);
        console.log(`    Customer Ref: ${invoice.NumAtCard || 'N/A'}`);
        console.log(`    Sales Person: ${invoice.SalesPersonCode} | DocEntry: ${invoice.DocEntry}`);
        console.log(`    Email Sent: ${invoice.U_EmailSent || 'NULL'}`);
        console.log('    ' + '─'.repeat(70));
      });
      
      // Summary statistics
      console.log('\n📈 Summary Statistics:');
      console.log('═'.repeat(50));
      
      // By series
      const seriesStats = {};
      response.data.value.forEach(inv => {
        const series = inv.Series === 4 ? 'Factura (Series 4)' : inv.Series === 76 ? 'Comprobante (Series 76)' : `Series ${inv.Series}`;
        seriesStats[series] = (seriesStats[series] || 0) + 1;
      });
      
      console.log('\n📊 By Document Type:');
      Object.entries(seriesStats).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} invoices`);
      });
      
      // By sales person
      const salesStats = {};
      response.data.value.forEach(inv => {
        const sales = inv.SalesPersonCode || 'Unknown';
        salesStats[sales] = (salesStats[sales] || 0) + 1;
      });
      
      console.log('\n👤 By Sales Person:');
      Object.entries(salesStats).sort(([,a], [,b]) => b - a).forEach(([person, count]) => {
        console.log(`   Sales Person ${person}: ${count} invoices`);
      });
      
      // Total amounts
      const totalAmount = response.data.value.reduce((sum, inv) => sum + parseFloat(inv.DocTotal || 0), 0);
      console.log(`\n💰 Total Amount: $${totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      
      // Customer references
      const withRef = response.data.value.filter(inv => inv.NumAtCard && inv.NumAtCard.trim() !== '');
      const withoutRef = response.data.value.filter(inv => !inv.NumAtCard || inv.NumAtCard.trim() === '');
      
      console.log('\n🔗 Customer Reference Coverage:');
      console.log(`   With reference: ${withRef.length} (${(withRef.length / response.data.value.length * 100).toFixed(1)}%)`);
      console.log(`   Without reference: ${withoutRef.length} (${(withoutRef.length / response.data.value.length * 100).toFixed(1)}%)`);
      
      // List folio numbers for easy copy/paste
      console.log('\n📝 Folio Numbers (for easy reference):');
      const folioNumbers = response.data.value.map(inv => inv.FolioNumberFrom).sort((a, b) => a - b);
      console.log(folioNumbers.join(', '));
      
    } else {
      console.log('❌ No data returned from SAP');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('SAP Response:', error.response.status, error.response.statusText);
      console.error('SAP Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listAllUnsentInvoices();