import { EmailService } from './email-service.js';

async function debugSAPInvoices() {
  try {
    console.log('🔍 Direct SAP query for September 22, 2025...\n');
    
    const emailService = new EmailService();
    
    // Initialize SAP connection
    console.log('🔗 Initializing SAP connection...');
    await emailService.initializeSapConnection();
    console.log('✅ SAP connection established\n');
    
    // Direct SAP query to see raw data
    const targetDate = '2025-09-22';
    const sapUrl = `/Invoices?$filter=(U_EmailSent ne 'Y' or U_EmailSent eq null) and DocDate ge '${targetDate}' and DocDate le '${targetDate}'&$select=DocNum,DocDate,DocTotal,CardCode,CardName,FolioNumberFrom,U_EmailSent,Series,SalesPersonCode,DocEntry,NumAtCard,Comments&$orderby=DocDate desc&$top=25`;
    
    console.log(`🔍 SAP Query: ${sapUrl}\n`);
    
    const response = await emailService.sapConnection.get(sapUrl);
    
    if (response.data && response.data.value) {
      console.log(`📊 Found ${response.data.value.length} invoices (showing first 10):\n`);
      
      response.data.value.slice(0, 10).forEach((invoice, index) => {
        console.log(`${index + 1}. Raw Invoice Data:`);
        console.log(`   DocEntry: ${invoice.DocEntry}`);
        console.log(`   DocNum: ${invoice.DocNum}`);
        console.log(`   FolioNumberFrom: ${invoice.FolioNumberFrom}`);
        console.log(`   CardCode: ${invoice.CardCode}`);
        console.log(`   CardName: ${invoice.CardName}`);
        console.log(`   NumAtCard: "${invoice.NumAtCard || 'NULL'}"`);
        console.log(`   DocDate: ${invoice.DocDate}`);
        console.log(`   DocTotal: ${invoice.DocTotal}`);
        console.log(`   Series: ${invoice.Series}`);
        console.log(`   SalesPersonCode: ${invoice.SalesPersonCode}`);
        console.log(`   U_EmailSent: "${invoice.U_EmailSent || 'NULL'}"`);
        console.log(`   Comments: "${(invoice.Comments || '').substring(0, 50)}..."`);
        console.log('   ---');
      });
      
      // Test warehouse detection logic
      console.log('\n🔍 Testing warehouse detection...');
      const firstInvoice = response.data.value[0];
      if (firstInvoice) {
        console.log(`Testing with DocEntry ${firstInvoice.DocEntry}:`);
        
        // Test the findInvoiceInSAP method (which includes warehouse detection)
        const invoiceDetails = await emailService.findInvoiceInSAP(firstInvoice.FolioNumberFrom);
        if (invoiceDetails) {
          console.log('✅ Invoice details retrieved:');
          console.log(`   Invoice Number: ${invoiceDetails.invoiceNumber}`);
          console.log(`   Customer: ${invoiceDetails.customerCode} - ${invoiceDetails.customerName}`);
          console.log(`   Customer Ref: ${invoiceDetails.customerReference || 'N/A'}`);
          console.log(`   Series: ${invoiceDetails.series}`);
          console.log(`   Warehouse: ${invoiceDetails.warehouse}`);
          console.log(`   Sales Person: ${invoiceDetails.salesPersonCode}`);
          console.log(`   Total: $${parseFloat(invoiceDetails.total).toLocaleString('es-AR')}`);
          console.log(`   Email Sent: ${invoiceDetails.emailSent || 'NULL'}`);
        } else {
          console.log('❌ Failed to get invoice details');
        }
        
        // Show summary analysis
        console.log('\n📋 Analysis Summary:');
        console.log(`✅ Found ${response.data.value.length} unsent invoices on 2025-09-22`);
        
        // Series breakdown
        const seriesBreakdown = {};
        response.data.value.forEach(inv => {
          const series = inv.Series;
          const seriesName = series === 4 ? 'Factura' : series === 76 ? 'Comprobante' : `Series ${series}`;
          seriesBreakdown[seriesName] = (seriesBreakdown[seriesName] || 0) + 1;
        });
        
        console.log('\n📊 By Series:');
        Object.entries(seriesBreakdown).forEach(([series, count]) => {
          console.log(`   ${series}: ${count} invoices`);
        });
        
        // Customer reference analysis
        const withRef = response.data.value.filter(inv => inv.NumAtCard && inv.NumAtCard.trim() !== '');
        const withoutRef = response.data.value.filter(inv => !inv.NumAtCard || inv.NumAtCard.trim() === '');
        
        console.log('\n🔗 Customer References:');
        console.log(`   With reference: ${withRef.length}`);
        console.log(`   Without reference: ${withoutRef.length}`);
        
        if (withoutRef.length > 0) {
          console.log('\n❌ Invoices missing customer reference:');
          withoutRef.forEach(inv => {
            console.log(`   ${inv.FolioNumberFrom} - ${inv.CardName} (${inv.CardCode})`);
          });
        }
      }
      
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

debugSAPInvoices();