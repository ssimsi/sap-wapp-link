// Test Different Message Types for Series 4 vs Series 76

class MessageTester {
  generateWhatsAppMessage(invoice) {
    const lines = [];
    
    // Add test mode header if active
    lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
    lines.push('');
    
    // Series detection based on DocNum: 7 digits AND starts with 9 = Series 76
    const docNum = invoice.DocNum.toString();
    const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
    
    // Determine message type based on detected Series
    if (isSeries76) {
      lines.push('📄 *NUEVO DOCUMENTO*');
      console.log(`📄 Series 76 message generated for invoice ${docNum}`);
    } else {
      lines.push('🧾 *NUEVA FACTURA ELECTRÓNICA*');
      console.log(`🧾 Series 4 message generated for invoice ${docNum}`);
    }
    
    lines.push(`📋 Factura: *${invoice.DocNum}*`);
    lines.push(`👤 Cliente: ${invoice.CardName}`);
    lines.push(`💰 Total: $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
    lines.push(`📅 Fecha: ${invoice.DocDate}`);
    
    if (invoice.Comments) {
      lines.push(`📝 Comentarios: ${invoice.Comments}`);
    }
    
    lines.push('');
    lines.push('📎 Adjunto encontrarás tu factura en PDF.');
    lines.push('');
    lines.push('🧪 *Este es un mensaje de prueba*');
    lines.push('En producción iría al cliente real');
    lines.push('');
    lines.push('Gracias por tu compra! 🙏');
    
    return lines.join('\n');
  }
}

const tester = new MessageTester();

// Test invoices
const testInvoices = [
  {
    DocNum: '9008535',  // Series 76
    CardName: 'Cruz Daniela Raquel',
    DocTotal: 25750.50,
    DocDate: '2025-08-10',
    Comments: null
  },
  {
    DocNum: '15212',    // Series 4
    CardName: 'Juan Pérez',
    DocTotal: 15300.75,
    DocDate: '2025-08-10',
    Comments: 'Entrega urgente'
  }
];

console.log('📱 TESTING DIFFERENT MESSAGE TYPES:');
console.log('=====================================');

testInvoices.forEach((invoice, index) => {
  console.log(`\\n${index + 1}. Testing Invoice ${invoice.DocNum}:`);
  console.log('-----------------------------------');
  
  const message = tester.generateWhatsAppMessage(invoice);
  console.log(message);
  console.log('\\n' + '='.repeat(50));
});

console.log('\\n✅ Message Type Test Complete!');
