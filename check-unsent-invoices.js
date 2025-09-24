import { EmailService } from './email-service.js';

async function checkUnsentInvoices() {
  try {
    console.log('🔍 Checking unsent invoices for September 22, 2025...\n');
    
    const emailService = new EmailService();
    
    // Initialize SAP connection first
    console.log('🔗 Initializing SAP connection...');
    await emailService.initializeSapConnection();
    console.log('✅ SAP connection established\n');
    
    // Check invoices from September 22, 2025
    const targetDate = '2025-09-22';
    console.log(`📅 Target date: ${targetDate}\n`);
    
    // Get unsent invoices for that specific date
    const invoices = await emailService.getUnsentInvoicesFromSAP(targetDate, targetDate);
    
    if (invoices && invoices.length > 0) {
      console.log(`📊 Found ${invoices.length} unsent invoices on ${targetDate}:\n`);
      
      invoices.forEach((invoice, index) => {
        console.log(`${index + 1}. Invoice ${invoice.invoiceNumber} (DocEntry: ${invoice.docEntry})`);
        console.log(`   Customer: ${invoice.customerCode} - ${invoice.customerName}`);
        console.log(`   Customer Ref: ${invoice.customerReference || 'N/A'}`);
        console.log(`   Series: ${invoice.series} | Total: $${parseFloat(invoice.total).toLocaleString('es-AR')}`);
        console.log(`   Warehouse: ${invoice.warehouse} | Sales: ${invoice.salesPersonCode}`);
        console.log(`   U_EmailSent: "${invoice.emailSent || 'NULL/EMPTY'}"`);
        console.log(`   Date: ${invoice.date}`);
        console.log('   ---');
      });
      
      // Summary by series
      console.log('\n📈 Summary by Series:');
      const seriesCounts = {};
      invoices.forEach(inv => {
        const series = inv.series;
        if (!seriesCounts[series]) {
          seriesCounts[series] = { count: 0, type: series === 4 ? 'Factura' : series === 76 ? 'Comprobante' : 'Other' };
        }
        seriesCounts[series].count++;
      });
      
      Object.entries(seriesCounts).forEach(([series, data]) => {
        console.log(`   Series ${series} (${data.type}): ${data.count} invoices`);
      });
      
      // Summary by warehouse
      console.log('\n🏢 Summary by Warehouse:');
      const warehouseCounts = {};
      invoices.forEach(inv => {
        const warehouse = inv.warehouse || 'Unknown';
        warehouseCounts[warehouse] = (warehouseCounts[warehouse] || 0) + 1;
      });
      
      Object.entries(warehouseCounts).forEach(([warehouse, count]) => {
        console.log(`   Warehouse ${warehouse}: ${count} invoices`);
      });
      
      // Check for missing customer references
      console.log('\n🔗 Customer Reference Analysis:');
      const withRef = invoices.filter(inv => inv.customerReference && inv.customerReference.trim() !== '');
      const withoutRef = invoices.filter(inv => !inv.customerReference || inv.customerReference.trim() === '');
      
      console.log(`   With customer reference: ${withRef.length}`);
      console.log(`   Without customer reference: ${withoutRef.length}`);
      
      if (withoutRef.length > 0) {
        console.log('\n   📝 Invoices without customer reference:');
        withoutRef.forEach(inv => {
          console.log(`      ${inv.invoiceNumber} - ${inv.customerName}`);
        });
      }
      
    } else {
      console.log(`✅ No unsent invoices found for ${targetDate}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking unsent invoices:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkUnsentInvoices();