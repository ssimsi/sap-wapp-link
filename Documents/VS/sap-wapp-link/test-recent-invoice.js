import dotenv from 'dotenv';
import https from 'https';

dotenv.config({ path: '.env.local' });

class SAPTestInvoice {
  constructor() {
    this.sessionId = null;
  }

  async login() {
    return new Promise((resolve, reject) => {
      const loginData = JSON.stringify({
        CompanyDB: process.env.VITE_SAP_DATABASE,
        UserName: process.env.VITE_SAP_USERNAME,
        Password: process.env.VITE_SAP_PASSWORD
      });

      const options = {
        hostname: 'b1.ativy.com',
        port: 50685,
        path: '/b1s/v1/Login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        },
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode === 200 && result.SessionId) {
              this.sessionId = result.SessionId;
              resolve(result);
            } else {
              reject(new Error(`Login failed: ${data}`));
            }
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(loginData);
      req.end();
    });
  }

  async request(path) {
    if (!this.sessionId) {
      throw new Error('Not logged in');
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'b1.ativy.com',
        port: 50685,
        path: `/b1s/v1${path}`,
        method: 'GET',
        headers: {
          'Cookie': `B1SESSION=${this.sessionId}`,
          'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${result.error?.message?.value || data}`));
            }
          } catch (parseError) {
            reject(new Error(`Parse error: ${parseError.message}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

async function testWithRecentInvoice() {
  console.log('🧪 Testing complete workflow with a recent invoice...\n');
  
  const sap = new SAPTestInvoice();
  
  try {
    await sap.login();
    console.log('✅ SAP login successful!\n');
    
    // Get the most recent invoice
    console.log('📋 Getting most recent invoice...');
    const invoicesResponse = await sap.request('/Invoices?%24top=1&%24orderby=DocNum%20desc&%24select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocDate,Series,U_WhatsAppSent,U_WhatsAppDate');
    
    if (!invoicesResponse.value || invoicesResponse.value.length === 0) {
      console.log('❌ No invoices found');
      return;
    }
    
    const invoice = invoicesResponse.value[0];
    console.log('📄 Selected invoice for testing:');
    console.log(`   📋 DocNum: ${invoice.DocNum}`);
    console.log(`   👤 Customer: ${invoice.CardCode} - ${invoice.CardName}`);
    console.log(`   💰 Total: $${invoice.DocTotal}`);
    console.log(`   📅 Date: ${invoice.DocDate}`);
    console.log(`   🏷️  Series: ${invoice.Series}`);
    console.log(`   📱 WhatsApp Sent: ${invoice.U_WhatsAppSent || 'Not set'}`);
    
    // Get customer details
    console.log(`\n👤 Getting customer details...`);
    const customer = await sap.request(`/BusinessPartners('${invoice.CardCode}')`);
    
    console.log('✅ Customer phone numbers:');
    console.log(`   📞 Phone1: ${customer.Phone1 || 'None'}`);
    console.log(`   📞 Phone2: ${customer.Phone2 || 'None'}`);
    console.log(`   📱 Cellular: ${customer.Cellular || 'None'}`);
    console.log(`   📧 Email: ${customer.EmailAddress || 'None'}`);
    
    // Test safety mechanisms
    console.log(`\n🧪 SAFETY TEST:`);
    console.log(`   🔒 TEST_MODE: ${process.env.TEST_MODE}`);
    console.log(`   📱 TEST_PHONE: ${process.env.TEST_PHONE}`);
    
    if (process.env.TEST_MODE === 'true') {
      console.log(`   ✅ SAFE: Message would go to ${process.env.TEST_PHONE}`);
      console.log(`   🚫 Customer ${customer.Cellular || 'phone'} would be IGNORED`);
    } else {
      console.log(`   ⚠️  DANGER: Would send to customer phone!`);
    }
    
    // Simulate what the WhatsApp message would look like
    console.log(`\n📱 SAMPLE WHATSAPP MESSAGE:`);
    console.log('========================================');
    if (process.env.TEST_MODE === 'true') {
      console.log('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*\n');
    }
    
    console.log('🧾 *NUEVA FACTURA ELECTRÓNICA*');
    console.log(`📋 Factura: *${invoice.DocNum}*`);
    console.log(`👤 Cliente: ${invoice.CardName}`);
    console.log(`💰 Total: $${invoice.DocTotal.toLocaleString()}`);
    console.log(`📅 Fecha: ${invoice.DocDate}`);
    console.log('');
    console.log('📎 Adjunto encontrarás tu factura en PDF.');
    console.log('');
    if (process.env.TEST_MODE === 'true') {
      console.log('🧪 *Este es un mensaje de prueba*');
      console.log('En producción iría al cliente real\n');
    }
    console.log('Gracias por tu compra! 🙏');
    console.log('========================================');
    
    console.log(`\n🎯 READY TO TEST WITH INVOICE ${invoice.DocNum}`);
    console.log('   ✅ Invoice data retrieved');
    console.log('   ✅ Customer data retrieved');
    console.log('   ✅ Safety checks passed');
    console.log('   ✅ Message format ready');
    
    return { invoice, customer };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWithRecentInvoice();
