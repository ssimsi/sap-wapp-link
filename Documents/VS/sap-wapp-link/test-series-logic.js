// Test Series Detection Logic

function detectSeries(invoiceNumber) {
    // Series 76: 7 digits AND starts with 9
    const isSeries76 = invoiceNumber.length === 7 && invoiceNumber.startsWith('9');
    return isSeries76 ? 76 : 4;
}

function shouldRename(invoiceNumber) {
    const series = detectSeries(invoiceNumber);
    if (series === 76) {
        return `Comprobante_${invoiceNumber}.pdf`;
    } else {
        return `Factura de deudores - ${invoiceNumber}.pdf`; // Keep original format
    }
}

// Test cases
const testInvoices = [
    '9008535', // Series 76 (7 digits, starts with 9)
    '15212',   // Series 4 (5 digits)
    '9008432', // Series 76 (7 digits, starts with 9)
    '15116',   // Series 4 (5 digits)
    '8008535', // Series 4 (7 digits but doesn't start with 9)
    '900853',  // Series 4 (6 digits, starts with 9)
];

console.log('📊 Testing Series Detection Logic:');
console.log('=====================================');

testInvoices.forEach(invoice => {
    const series = detectSeries(invoice);
    const filename = shouldRename(invoice);
    console.log(`📋 Invoice: ${invoice} → Series ${series} → ${filename}`);
});

console.log('\\n✅ Logic Test Complete!');
