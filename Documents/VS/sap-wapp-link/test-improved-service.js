// Test script to verify the improved hybrid service
import HybridInvoiceService from './hybrid-invoice-service.js';

async function testImprovedService() {
    console.log('🧪 Testing improved hybrid service with date-based search and Series 76 support...');
    
    // Test with a mock invoice to see the date-based search
    const mockInvoice = {
        DocNum: '9008535',
        DocEntry: 12345,
        DocDate: '2025-08-08', // Use the date when our test PDF was created
        Series: 76, // Test Series 76 renaming
        DocTotal: 25750.50,
        CardName: 'Cruz Daniela Raquel'
    };
    
    console.log('📋 Test Invoice Data:');
    console.log(`   📄 DocNum: ${mockInvoice.DocNum}`);
    console.log(`   📅 DocDate: ${mockInvoice.DocDate}`);
    console.log(`   🏷️ Series: ${mockInvoice.Series}`);
    
    const service = new HybridInvoiceService();
    
    try {
        // Initialize email connection
        await service.connectToEmail();
        console.log('✅ Connected to email');
        
        // Test the improved findInvoicePDF method
        console.log('\n🔍 Testing improved PDF search...');
        const pdfPath = await service.findInvoicePDF(mockInvoice.DocNum, mockInvoice.DocDate, mockInvoice.Series);
        
        if (pdfPath) {
            console.log(`✅ SUCCESS! Found PDF: ${pdfPath}`);
            console.log(`📄 Expected for Series 76: Should be named Comprobante_${mockInvoice.DocNum}.pdf`);
        } else {
            console.log('❌ No PDF found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        // Clean up
        if (service.imap && service.imap.state !== 'disconnected') {
            service.imap.end();
        }
    }
}

testImprovedService().catch(console.error);
