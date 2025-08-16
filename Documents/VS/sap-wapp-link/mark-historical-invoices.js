import HybridInvoiceService from './hybrid-invoice-service.js';

class HistoricalInvoiceMarker {
  constructor() {
    this.hybridService = new HybridInvoiceService();
  }

  async findMarch24Invoices() {
    try {
      console.log('🔍 Searching for March 2024 invoices...');
      
      // Use the SAP connection from the hybrid service
      const sapConnection = this.hybridService.sapConnection;
      
      // Login to SAP
      console.log('� Connecting to SAP...');
      const connected = await sapConnection.login();
      if (!connected) {
        throw new Error('Failed to connect to SAP');
      }
      
      // Try different date formats for March 2024
      const queries = [
        "DocDate ge '2024-03-01' and DocDate le '2024-03-31'",
        "startswith(DocDate, '2024-03')",
        "year(DocDate) eq 2024 and month(DocDate) eq 3"
      ];
      
      let invoices = [];
      
      for (const query of queries) {
        try {
          console.log(`🔄 Trying query: ${query}`);
          
          const params = new URLSearchParams({
            $filter: query,
            $select: 'DocNum,DocDate,CardName,DocTotal,Series,U_WhatsAppSent',
            $orderby: 'DocDate desc',
            $top: '50'
          });
          
          const response = await sapConnection.makeRequest('GET', `/Invoices?${params}`);
          
          if (response.data && response.data.value && response.data.value.length > 0) {
            invoices = response.data.value;
            console.log(`✅ Found ${invoices.length} invoices with query: ${query}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Query failed: ${query} - ${error.response?.data?.error?.message || error.message}`);
          continue;
        }
      }
      
      if (invoices.length === 0) {
        console.log('🔍 No March 2024 invoices found. Let me check recent invoices to understand date format...');
        
        // Get recent invoices to understand the date format
        const params = new URLSearchParams({
          $select: 'DocNum,DocDate,CardName,DocTotal,Series,U_WhatsAppSent',
          $orderby: 'DocDate desc',
          $top: '10'
        });
        
        const recentResponse = await sapConnection.makeRequest('GET', `/Invoices?${params}`);
        
        console.log('\n📋 Recent invoices (to check date format):');
        if (recentResponse.data && recentResponse.data.value) {
          recentResponse.data.value.forEach(inv => {
            console.log(`  📄 DocNum: ${inv.DocNum}, DocDate: ${inv.DocDate}, Customer: ${inv.CardName.substring(0, 30)}...`);
          });
          
          // Try to find any 2024 invoices
          console.log('\n🔍 Looking for any 2024 invoices...');
          const params2024 = new URLSearchParams({
            $filter: "startswith(DocDate, '2024')",
            $select: 'DocNum,DocDate,CardName,DocTotal,Series,U_WhatsAppSent',
            $orderby: 'DocDate desc',
            $top: '20'
          });
          
          try {
            const response2024 = await sapConnection.makeRequest('GET', `/Invoices?${params2024}`);
            if (response2024.data && response2024.data.value && response2024.data.value.length > 0) {
              console.log(`✅ Found ${response2024.data.value.length} invoices from 2024`);
              return response2024.data.value;
            }
          } catch (error) {
            console.log('❌ Could not find 2024 invoices either');
          }
        }
        
        return recentResponse.data?.value || [];
      }
      
      console.log('\n📋 March 2024 invoices found:');
      invoices.forEach(invoice => {
        const whatsappStatus = invoice.U_WhatsAppSent || 'Not set';
        console.log(`  📄 DocNum: ${invoice.DocNum}, Date: ${invoice.DocDate}, Customer: ${invoice.CardName.substring(0, 25)}..., WhatsApp: ${whatsappStatus}`);
      });
      
      return invoices;
      
    } catch (error) {
      console.error('❌ Error finding invoices:', error.message);
      throw error;
    }
  }

  async markInvoicesAsSent(invoices, dryRun = true) {
    console.log(`\n${dryRun ? '🔍 DRY RUN - ' : '🔄 '}Marking ${invoices.length} invoices as sent...`);
    
    let successCount = 0;
    let errorCount = 0;
    let alreadyMarked = 0;
    
    const sapConnection = this.hybridService.sapConnection;
    
    for (const invoice of invoices) {
      try {
        // Check if already marked
        if (invoice.U_WhatsAppSent === 'Y') {
          console.log(`ℹ️  Invoice ${invoice.DocNum} already marked as sent`);
          alreadyMarked++;
          continue;
        }
        
        if (!dryRun) {
          // Update the U_WhatsAppSent field
          await sapConnection.makeRequest('PATCH', `/Invoices(${invoice.DocNum})`, {
            U_WhatsAppSent: 'Y'
          });
        }
        
        console.log(`${dryRun ? '🔍 WOULD MARK' : '✅ Marked'} invoice ${invoice.DocNum} as sent (Customer: ${invoice.CardName.substring(0, 25)}...)`);
        successCount++;
        
        // Small delay to avoid overwhelming SAP
        if (!dryRun) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        console.error(`❌ Failed to mark invoice ${invoice.DocNum}: ${error.response?.data?.error?.message || error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`${dryRun ? '🔍 Would mark' : '✅ Successfully marked'}: ${successCount} invoices`);
    console.log(`ℹ️  Already marked: ${alreadyMarked} invoices`);
    console.log(`❌ Failed to mark: ${errorCount} invoices`);
    
    return { successCount, errorCount, alreadyMarked };
  }

  async run() {
    try {
      console.log('🚀 Starting historical invoice marking process...\n');
      
      // Find March 24 invoices
      const invoices = await this.findMarch24Invoices();
      
      if (invoices.length === 0) {
        console.log('📝 No invoices found to mark.');
        return;
      }
      
      console.log(`\n⚠️  Found ${invoices.length} invoices that could be marked as sent.`);
      console.log('   This will prevent the system from sending WhatsApp messages for these invoices.');
      
      // First do a dry run
      console.log('\n🔍 Running dry run first...');
      await this.markInvoicesAsSent(invoices, true);
      
      console.log('\n🎯 Dry run completed! If you want to actually mark them, change dryRun to false in the script.');
      
    } catch (error) {
      console.error('💥 Process failed:', error.message);
    } finally {
      // Disconnect from SAP
      try {
        await this.hybridService.sapConnection.disconnect();
      } catch (error) {
        console.log('⚠️ SAP disconnect warning:', error.message);
      }
    }
  }
}

// Run the script
const historicalMarker = new HistoricalInvoiceMarker();
historicalMarker.run();
