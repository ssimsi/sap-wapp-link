import https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

class InvoiceTest {
  constructor() {
    this.sapCookies = '';
    this.baseURL = 'https://hanadb:50000';
  }

  async sapLogin() {
    console.log('🔐 Logging into SAP...');
    
    const loginData = JSON.stringify({
      CompanyDB: process.env.VITE_SAP_DATABASE,
      UserName: process.env.VITE_SAP_USERNAME,
      Password: process.env.VITE_SAP_PASSWORD
    });

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'hanadb',
        port: 50000,
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
        
        // Extract session cookies
        if (res.headers['set-cookie']) {
          this.sapCookies = res.headers['set-cookie']
            .map(cookie => cookie.split(';')[0])
            .join('; ');
        }

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ SAP login successful');
            resolve();
          } else {
            reject(new Error(`Login failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(loginData);
      req.end();
    });
  }

  async sapRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'hanadb',
        port: 50000,
        path: `/b1s/v1${path}`,
        method: 'GET',
        headers: {
          'Cookie': this.sapCookies,
          'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const jsonData = JSON.parse(data);
              resolve(jsonData);
            } catch (parseError) {
              reject(new Error(`JSON parse error: ${parseError.message}`));
            }
          } else {
            reject(new Error(`SAP request failed with status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  async testInvoice9008535() {
    console.log('🔍 Testing Invoice 9008535 - Cruz Daniela Raquel');
    console.log('='.repeat(60));
    
    try {
      // Login to SAP
      await this.sapLogin();
      
      // 1. Search for specific invoice
      console.log('\n📋 Searching for invoice 9008535...');
      const invoiceQuery = `/Invoices?$filter=DocNum eq 9008535&$select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocDate,U_WhatsAppSent,U_WhatsAppPhone,U_WhatsAppDate,SlpCode`;
      const invoiceResult = await this.sapRequest(invoiceQuery);
      
      if (!invoiceResult.value || invoiceResult.value.length === 0) {
        console.log('❌ Invoice 9008535 not found');
        return;
      }
      
      const invoice = invoiceResult.value[0];
      console.log('✅ Invoice found:');
      console.log(`   📄 DocEntry: ${invoice.DocEntry}`);
      console.log(`   📋 DocNum: ${invoice.DocNum}`);
      console.log(`   👤 Customer: ${invoice.CardName} (${invoice.CardCode})`);
      console.log(`   💰 Total: $${invoice.DocTotal}`);
      console.log(`   📅 Date: ${invoice.DocDate}`);
      console.log(`   📱 WhatsApp Sent: ${invoice.U_WhatsAppSent || 'N'}`);
      console.log(`   📞 WhatsApp Phone: ${invoice.U_WhatsAppPhone || 'None'}`);
      console.log(`   👨‍💼 Sales Person Code: ${invoice.SlpCode}`);
      
      // 2. Get customer details including Cellular field
      console.log('\n👤 Getting customer details...');
      const customerQuery = `/BusinessPartners('${invoice.CardCode}')`;
      const customer = await this.sapRequest(customerQuery);
      
      console.log('✅ Customer details:');
      console.log(`   📛 Name: ${customer.CardName}`);
      console.log(`   📞 Phone1: ${customer.Phone1 || 'None'}`);
      console.log(`   📞 Phone2: ${customer.Phone2 || 'None'}`);
      console.log(`   📱 Cellular: ${customer.Cellular || 'None'}`);
      console.log(`   📧 Email: ${customer.EmailAddress || 'None'}`);
      
      // 3. Get sales person details
      if (invoice.SlpCode) {
        console.log('\n👨‍💼 Getting sales person details...');
        const salesPersonQuery = `/SalesPersons(${invoice.SlpCode})`;
        const salesPerson = await this.sapRequest(salesPersonQuery);
        
        console.log('✅ Sales person details:');
        console.log(`   📛 Name: ${salesPerson.SalesEmployeeName}`);
        console.log(`   📧 Email: ${salesPerson.Email || 'None'}`);
        console.log(`   📞 Mobile: ${salesPerson.Mobile || 'None'}`);
        
        // Check if we have this sales person mapped in env
        const envSalesPhone = process.env[`SALES_PERSON_${invoice.SlpCode}`];
        const envSalesName = process.env[`SALES_PERSON_NAME_${invoice.SlpCode}`];
        console.log(`   🔧 Env mapping: ${envSalesName || 'Not mapped'} - ${envSalesPhone || 'No phone'}`);
      }
      
      // 4. Test safety features
      console.log('\n🛡️ Testing safety features...');
      console.log(`   🧪 TEST_MODE: ${process.env.TEST_MODE}`);
      console.log(`   📱 TEST_PHONE: ${process.env.TEST_PHONE}`);
      
      // Simulate phone number extraction
      let finalPhone;
      if (process.env.TEST_MODE === 'true') {
        finalPhone = process.env.TEST_PHONE;
        console.log(`   ✅ SAFE: Would send to test phone: ${finalPhone}`);
      } else {
        finalPhone = customer.Cellular || invoice.U_WhatsAppPhone;
        console.log(`   ⚠️ PRODUCTION: Would send to customer phone: ${finalPhone}`);
      }
      
      // 5. Generate sample message
      console.log('\n💬 Sample WhatsApp message:');
      console.log('=' * 40);
      
      if (process.env.TEST_MODE === 'true') {
        console.log('🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*\n');
      }
      
      const series = invoice.DocNum >= 9008000 ? '76' : '4';
      const messageType = series === '76' ? 'FACTURA ELECTRÓNICA' : 'FACTURA';
      
      console.log(`🧾 *NUEVA ${messageType}*`);
      console.log(`📋 Factura: *${invoice.DocNum}*`);
      console.log(`👤 Cliente: ${invoice.CardName}`);
      console.log(`💰 Total: $${parseFloat(invoice.DocTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      console.log(`📅 Fecha: ${new Date(invoice.DocDate).toLocaleDateString('es-AR')}`);
      console.log('');
      console.log('📎 Adjunto encontrarás tu factura en PDF.');
      console.log('');
      
      if (process.env.TEST_MODE === 'true') {
        console.log('🧪 *Este es un mensaje de prueba*');
        console.log(`En producción iría a: ${customer.Cellular || 'Sin teléfono'}`);
        console.log('');
      }
      
      console.log('Gracias por tu compra! 🙏');
      console.log('=' * 40);
      
      // 6. Summary
      console.log('\n📊 Test Summary:');
      console.log(`   📄 Invoice: ${invoice.DocNum} (Series ${series})`);
      console.log(`   👤 Customer: ${customer.CardName}`);
      console.log(`   📱 Customer Phone: ${customer.Cellular || 'None'}`);
      console.log(`   📞 Target Phone: ${finalPhone}`);
      console.log(`   🛡️ Safety: ${process.env.TEST_MODE === 'true' ? 'PROTECTED' : 'PRODUCTION'}`);
      console.log(`   💬 Message Type: ${messageType}`);
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
}

// Run the test
const test = new InvoiceTest();
test.testInvoice9008535().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
