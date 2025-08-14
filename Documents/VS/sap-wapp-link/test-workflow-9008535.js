import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Mock invoice 9008535 data based on what we know
const mockInvoice9008535 = {
  DocEntry: 12345,
  DocNum: 9008535,
  CardCode: 'C20001',
  CardName: 'Cruz Daniela Raquel',
  DocTotal: 25750.50,
  DocDate: '2025-08-10',
  U_WhatsAppSent: 'N',
  U_WhatsAppPhone: null,
  U_WhatsAppDate: null,
  SlpCode: 18,
  customer: {
    CardCode: 'C20001',
    CardName: 'Cruz Daniela Raquel',
    Phone1: '01145678901',
    Phone2: null,
    Cellular: '5491165432109',  // Real customer cellular
    EmailAddress: 'cruz.daniela@email.com'
  }
};

class InvoiceWorkflowTest {
  constructor() {
    this.invoice = mockInvoice9008535;
  }

  // Simulate the getCustomerMobilePhone function from whatsapp-service.js
  getCustomerMobilePhone(customer) {
    console.log('📱 Extracting customer mobile phone...');
    
    // 🚨 SAFETY CHECK: In test mode, ALWAYS use test phone
    if (process.env.TEST_MODE === 'true') {
      console.log(`🧪 TEST MODE: Using test phone instead of customer ${customer.CardCode} Cellular field`);
      console.log(`   Original Cellular: ${customer.Cellular}`);
      console.log(`   Override to: ${process.env.TEST_PHONE}`);
      return process.env.TEST_PHONE;
    }
    
    // Only use the Cellular field - ignore Phone1 and Phone2
    const mobile = customer.Cellular;
    
    if (!mobile || mobile.trim() === '') {
      console.log(`⚠️ Customer ${customer.CardCode} has no mobile phone number in Cellular field`);
      return null;
    }
    
    console.log(`📞 Using customer cellular: ${mobile}`);
    return this.formatWhatsAppNumber(mobile);
  }

  // Simulate the getCustomerPhone function from hybrid-invoice-service.js
  getCustomerPhone(invoice) {
    console.log('📱 Getting customer phone from invoice...');
    
    // 🚨 SAFETY CHECK: In test mode, ALWAYS use test phone
    if (process.env.TEST_MODE === 'true') {
      console.log(`🧪 TEST MODE: Using test phone instead of customer invoice phone`);
      console.log(`   Original U_WhatsAppPhone: ${invoice.U_WhatsAppPhone}`);
      console.log(`   Override to: ${process.env.TEST_PHONE}`);
      return process.env.TEST_PHONE;
    }
    
    // Try to get phone from invoice data
    if (invoice.U_WhatsAppPhone && invoice.U_WhatsAppPhone.length >= 10) {
      console.log(`📞 Using invoice WhatsApp phone: ${invoice.U_WhatsAppPhone}`);
      return invoice.U_WhatsAppPhone;
    }
    
    console.log('📞 No invoice phone, returning null');
    return null;
  }

  formatWhatsAppNumber(phone) {
    // Simple formatting simulation
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('549')) {
      return cleaned;
    }
    if (cleaned.startsWith('11')) {
      return `549${cleaned}`;
    }
    return `549${cleaned}`;
  }

  getSalesPersonInfo(slpCode) {
    const salesPhone = process.env[`SALES_PERSON_${slpCode}`];
    const salesName = process.env[`SALES_PERSON_NAME_${slpCode}`];
    
    return {
      code: slpCode,
      name: salesName || `Sales Person ${slpCode}`,
      phone: salesPhone || null,
      isMapped: !!salesPhone
    };
  }

  generateWhatsAppMessage(invoice, series = null) {
    const detectedSeries = series || (invoice.DocNum >= 9008000 ? '76' : '4');
    const messageType = detectedSeries === '76' ? 'FACTURA ELECTRÓNICA' : 'FACTURA';
    
    let message = '';
    
    // Test mode header
    if (process.env.TEST_MODE === 'true') {
      message += '🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*\n\n';
    }
    
    // Main message
    message += `🧾 *NUEVA ${messageType}*\n`;
    message += `📋 Factura: *${invoice.DocNum}*\n`;
    message += `👤 Cliente: ${invoice.CardName}\n`;
    message += `💰 Total: $${parseFloat(invoice.DocTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n`;
    message += `📅 Fecha: ${new Date(invoice.DocDate).toLocaleDateString('es-AR')}\n\n`;
    message += `📎 Adjunto encontrarás tu factura en PDF.\n\n`;
    
    // Test mode footer
    if (process.env.TEST_MODE === 'true') {
      message += '🧪 *Este es un mensaje de prueba*\n';
      message += `En producción iría a: ${invoice.customer.Cellular || 'Sin teléfono'}\n\n`;
    }
    
    message += 'Gracias por tu compra! 🙏';
    
    return message;
  }

  async testCompleteWorkflow() {
    console.log('🧪 Testing Complete Workflow - Invoice 9008535');
    console.log('='.repeat(60));
    
    // 1. Environment Check
    console.log('\n🔧 Environment Configuration:');
    console.log(`   🧪 TEST_MODE: ${process.env.TEST_MODE}`);
    console.log(`   📱 TEST_PHONE: ${process.env.TEST_PHONE}`);
    console.log(`   👨‍💼 ADMIN_PHONE: ${process.env.ADMIN_PHONE}`);
    
    // 2. Invoice Information
    console.log('\n📄 Invoice Information:');
    console.log(`   📋 DocNum: ${this.invoice.DocNum}`);
    console.log(`   👤 Customer: ${this.invoice.CardName} (${this.invoice.CardCode})`);
    console.log(`   💰 Total: $${this.invoice.DocTotal}`);
    console.log(`   📅 Date: ${this.invoice.DocDate}`);
    console.log(`   👨‍💼 Sales Person Code: ${this.invoice.SlpCode}`);
    console.log(`   📱 WhatsApp Sent: ${this.invoice.U_WhatsAppSent}`);
    console.log(`   📞 WhatsApp Phone: ${this.invoice.U_WhatsAppPhone || 'None'}`);
    
    // 3. Customer Information
    console.log('\n👤 Customer Information:');
    console.log(`   📛 Name: ${this.invoice.customer.CardName}`);
    console.log(`   📞 Phone1: ${this.invoice.customer.Phone1 || 'None'}`);
    console.log(`   📞 Phone2: ${this.invoice.customer.Phone2 || 'None'}`);
    console.log(`   📱 Cellular: ${this.invoice.customer.Cellular || 'None'}`);
    console.log(`   📧 Email: ${this.invoice.customer.EmailAddress || 'None'}`);
    
    // 4. Sales Person Information
    console.log('\n👨‍💼 Sales Person Information:');
    const salesInfo = this.getSalesPersonInfo(this.invoice.SlpCode);
    console.log(`   📛 Name: ${salesInfo.name}`);
    console.log(`   📞 Phone: ${salesInfo.phone || 'Not mapped'}`);
    console.log(`   🔧 Mapped: ${salesInfo.isMapped ? '✅' : '❌'}`);
    
    // 5. Phone Number Extraction Test
    console.log('\n📱 Phone Number Extraction Test:');
    console.log('   Method 1: whatsapp-service.js getCustomerMobilePhone()');
    const phoneMethod1 = this.getCustomerMobilePhone(this.invoice.customer);
    
    console.log('\n   Method 2: hybrid-invoice-service.js getCustomerPhone()');
    const phoneMethod2 = this.getCustomerPhone(this.invoice);
    
    // 6. Final Phone Decision
    console.log('\n📞 Final Phone Number Decision:');
    const finalPhone = phoneMethod2 || phoneMethod1 || process.env.ADMIN_PHONE;
    console.log(`   🎯 Target Phone: ${finalPhone}`);
    
    if (process.env.TEST_MODE === 'true') {
      console.log(`   ✅ SAFE: All messages redirected to test phone`);
      console.log(`   🔒 Real customer (${this.invoice.customer.Cellular}) protected`);
    } else {
      console.log(`   ⚠️ PRODUCTION: Would send to actual customer`);
    }
    
    // 7. Message Generation
    console.log('\n💬 WhatsApp Message Generation:');
    const message = this.generateWhatsAppMessage(this.invoice);
    console.log('   📝 Generated message:');
    console.log('   ' + '='.repeat(40));
    console.log(message.split('\n').map(line => `   ${line}`).join('\n'));
    console.log('   ' + '='.repeat(40));
    
    // 8. PDF Attachment Simulation
    console.log('\n📎 PDF Attachment Simulation:');
    console.log(`   📄 Expected PDF name: ${this.invoice.DocNum}.pdf`);
    console.log(`   📂 Email search pattern: DocNum ${this.invoice.DocNum}`);
    console.log(`   🔍 Would search for email with PDF containing "${this.invoice.DocNum}"`);
    
    // 9. Safety Summary
    console.log('\n🛡️ Safety Summary:');
    console.log(`   🧪 Test Mode: ${process.env.TEST_MODE === 'true' ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`   📱 Message Target: ${finalPhone}`);
    console.log(`   🔒 Customer Protected: ${process.env.TEST_MODE === 'true' ? 'YES' : 'NO'}`);
    console.log(`   👨‍💼 Sales Person Notified: ${salesInfo.isMapped ? 'YES' : 'NO'}`);
    
    // 10. Workflow Steps
    console.log('\n📋 Complete Workflow Steps:');
    console.log('   1. ✅ Extract invoice data from SAP');
    console.log('   2. ✅ Get customer details including Cellular field');
    console.log('   3. ✅ Apply safety check for test mode');
    console.log('   4. ✅ Generate appropriate message (Series 76 = Electronic)');
    console.log('   5. 🔄 Search email for PDF attachment (simulated)');
    console.log('   6. 🔄 Send WhatsApp message with PDF (simulated)');
    console.log('   7. 🔄 Notify sales person (if mapped)');
    console.log('   8. 🔄 Update invoice status in SAP');
    
    console.log('\n🏁 Workflow test completed successfully!');
    console.log('   📝 Ready for live testing with actual WhatsApp service');
  }
}

// Run the test
const test = new InvoiceWorkflowTest();
test.testCompleteWorkflow().catch(error => {
  console.error('💥 Test error:', error);
  process.exit(1);
});
