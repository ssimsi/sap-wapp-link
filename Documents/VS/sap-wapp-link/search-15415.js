import dotenv from 'dotenv';
import https from 'https';

dotenv.config({ path: '.env.local' });

class SAPSearcher {
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
              console.log('✅ SAP login successful!');
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

async function searchInvoice15415() {
  console.log('🔍 Searching for invoice 15415...\n');
  
  const sap = new SAPSearcher();
  
  try {
    await sap.login();
    
    // First, search in a range around 15415
    console.log('📋 Searching invoices around 15415...');
    const rangeResponse = await sap.request('/Invoices?%24top=20&%24orderby=DocNum%20desc&%24select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocDate,Series');
    
    let found15415 = null;
    
    if (rangeResponse.value) {
      console.log(`Found ${rangeResponse.value.length} recent invoices:`);
      
      rangeResponse.value.forEach((invoice, index) => {
        const marker = invoice.DocNum == 15415 ? ' 🎯 TARGET!' : '';
        console.log(`   ${index + 1}. ${invoice.DocNum} - ${invoice.CardName} ($${invoice.DocTotal})${marker}`);
        
        if (invoice.DocNum == 15415) {
          found15415 = invoice;
        }
      });
      
      if (found15415) {
        console.log('\n✅ Found invoice 15415!');
        console.log(`   📄 DocEntry: ${found15415.DocEntry}`);
        console.log(`   📋 DocNum: ${found15415.DocNum}`);
        console.log(`   👤 Customer: ${found15415.CardCode} - ${found15415.CardName}`);
        console.log(`   💰 Total: $${found15415.DocTotal}`);
        console.log(`   📅 Date: ${found15415.DocDate}`);
        console.log(`   🏷️  Series: ${found15415.Series}`);
        
        // Get customer details
        console.log(`\n👤 Getting customer details for ${found15415.CardCode}...`);
        const customerResponse = await sap.request(`/BusinessPartners('${found15415.CardCode}')`);
        
        console.log('✅ Customer details:');
        console.log(`   📋 Code: ${customerResponse.CardCode}`);
        console.log(`   👤 Name: ${customerResponse.CardName}`);
        console.log(`   📞 Phone1: ${customerResponse.Phone1 || 'None'}`);
        console.log(`   📞 Phone2: ${customerResponse.Phone2 || 'None'}`);
        console.log(`   📱 Cellular: ${customerResponse.Cellular || 'None'}`);
        console.log(`   📧 Email: ${customerResponse.EmailAddress || 'None'}`);
        
        // Check test mode safety
        console.log(`\n🧪 TEST MODE SAFETY CHECK:`);
        console.log(`   🔒 TEST_MODE: ${process.env.TEST_MODE}`);
        console.log(`   📱 TEST_PHONE: ${process.env.TEST_PHONE}`);
        
        if (process.env.TEST_MODE === 'true') {
          console.log(`   ✅ SAFE: Messages will go to ${process.env.TEST_PHONE} instead of ${customerResponse.Cellular || 'customer phone'}`);
        } else {
          console.log(`   ⚠️  PRODUCTION MODE: Messages would go to customer!`);
        }
        
        return { invoice: found15415, customer: customerResponse };
        
      } else {
        console.log('\n❌ Invoice 15415 not found in recent invoices');
        console.log('   This might be an older invoice or from a different series');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

searchInvoice15415();
