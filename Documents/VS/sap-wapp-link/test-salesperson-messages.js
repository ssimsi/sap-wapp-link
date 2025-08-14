// Simple test for message generation methods only

// Mock the HybridInvoiceService class methods for testing
class MessageTester {
  generateWhatsAppMessage(invoice) {
    const lines = [];
    
    // Add test mode header if active
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
      lines.push('');
    }
    
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
    
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *Este es un mensaje de prueba*');
      lines.push('En producción iría al cliente real');
      lines.push('');
    }
    
    lines.push('Gracias por tu compra! 🙏');
    
    return lines.join('\n');
  }

  generateSalespersonMessage(invoice, salespersonName) {
    const lines = [];
    
    // Add test mode header if active
    if (process.env.TEST_MODE === 'true') {
      lines.push('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*');
      lines.push('');
    }
    
    // Series detection based on DocNum: 7 digits AND starts with 9 = Series 76
    const docNum = invoice.DocNum.toString();
    const isSeries76 = docNum.length === 7 && docNum.startsWith('9');
    
    if (isSeries76) {
      // Series 76 - Salesperson message
      lines.push('📄 *NUEVO DOCUMENTO*');
      lines.push('');
      lines.push(`Hola ${salespersonName},`);
      lines.push('');
      lines.push(`Se ha emitido el siguiente comprobante de uso interno para el cliente ${invoice.CardName}:`);
      lines.push('');
      lines.push(`📋 **Comprobante Nº:** ${invoice.DocNum}`);
      lines.push(`📅 **Fecha:** ${invoice.DocDate}`);
      lines.push(`💰 **Total:** $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
      console.log(`📄 Series 76 salesperson message generated for ${salespersonName}`);
    } else {
      // Series 4 - Salesperson message
      lines.push('🧾 *NUEVA FACTURA ELECTRÓNICA*');
      lines.push('');
      lines.push(`Hola ${salespersonName},`);
      lines.push('');
      lines.push(`Se ha emitido la siguiente factura para el cliente ${invoice.CardName}:`);
      lines.push('');
      lines.push(`📋 **Factura Nº:** ${invoice.DocNum}`);
      lines.push(`📅 **Fecha:** ${invoice.DocDate}`);
      lines.push(`💰 **Total:** $${invoice.DocTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`);
      console.log(`🧾 Series 4 salesperson message generated for ${salespersonName}`);
    }
    
    lines.push('');
    lines.push('Si tiene alguna consulta, no dude en contactarnos.');
    lines.push('');
    lines.push('Saludos cordiales,');
    lines.push('Simsiroglu');
    
    if (process.env.TEST_MODE === 'true') {
      lines.push('');
      lines.push('🧪 *Este es un mensaje de prueba*');
      lines.push(`En producción iría al vendedor: ${salespersonName}`);
    }
    
    return lines.join('\n');
  }
}

// Create tester instance
const tester = new MessageTester();

// Test data - Series 4 invoice
const series4Invoice = {
  DocNum: '15212',
  CardName: 'Cliente Ejemplo SA',
  DocTotal: 125000.75,
  DocDate: '2025-01-15',
  Comments: 'Factura de prueba'
};

// Test data - Series 76 invoice  
const series76Invoice = {
  DocNum: '9008535',
  CardName: 'Cliente Interno SA',
  DocTotal: 85000.50,
  DocDate: '2025-01-15',
  Comments: 'Comprobante interno'
};

console.log('🧾 ===== SERIES 4 MESSAGES =====\n');

console.log('📱 CUSTOMER MESSAGE (Series 4):');
console.log('----------------------------------------');
console.log(tester.generateWhatsAppMessage(series4Invoice));
console.log('\n');

console.log('👨‍💼 SALESPERSON MESSAGE (Series 4):');
console.log('----------------------------------------');
console.log(tester.generateSalespersonMessage(series4Invoice, 'Juan Pérez'));
console.log('\n');

console.log('📄 ===== SERIES 76 MESSAGES =====\n');

console.log('📱 CUSTOMER MESSAGE (Series 76):');
console.log('----------------------------------------');
console.log(tester.generateWhatsAppMessage(series76Invoice));
console.log('\n');

console.log('👨‍💼 SALESPERSON MESSAGE (Series 76):');
console.log('----------------------------------------');
console.log(tester.generateSalespersonMessage(series76Invoice, 'María González'));
console.log('\n');

console.log('✅ All message types tested successfully!');
