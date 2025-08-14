import HybridInvoiceService from './hybrid-invoice-service.js';

async function checkInvoiceSeries() {
    console.log('🔍 Checking series for invoice 9008535...');
    
    try {
        // Create hybrid service instance to access SAP connection
        const service = new HybridInvoiceService();
        await service.sap.login();
        
        const invoice = await service.sap.getInvoice('9008535');
        
        if (invoice) {
            console.log('📋 Invoice details:');
            console.log(`   DocNum: ${invoice.DocNum}`);
            console.log(`   Series: ${invoice.Series}`);
            console.log(`   DocDate: ${invoice.DocDate}`);
            console.log(`   CardName: ${invoice.CardName}`);
            console.log(`   DocTotal: ${invoice.DocTotal}`);
        } else {
            console.log('❌ Invoice not found');
        }
        
        await service.sap.logout();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkInvoiceSeries();
