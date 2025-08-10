import dotenv from 'dotenv';
import https from 'https';

// Load environment variables
dotenv.config({ path: '.env.local' });

class SAPConnection {
  constructor() {
    this.baseURL = 'https://190.210.101.98:50000/b1s/v1';
    this.username = process.env.VITE_SAP_USERNAME;
    this.password = process.env.VITE_SAP_PASSWORD;
    this.database = process.env.VITE_SAP_DATABASE;
  }

  async request(path) {
    return new Promise((resolve, reject) => {
      const encodedPath = `/b1s/v1${path}`.replace(/\$/g, '%24').replace(/ /g, '%20');
      const options = {
        hostname: '190.210.101.98',
        port: 50000,
        path: encodedPath,
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        rejectUnauthorized: false,
        timeout: 10000
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
            reject(new Error(`Parse error: ${parseError.message}, Data: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }
}

async function findInvoice15415() {
  console.log('🔍 Searching for invoice 15415...\n');
  
  const sap = new SAPConnection();
  
  try {
    // Search for invoice 15415
    console.log('📋 Searching invoices...');
    const invoicesResponse = await sap.request(`/Invoices?$filter=DocNum eq 15415&$select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocDate,Series,U_WhatsAppSent,U_WhatsAppDate,U_WhatsAppPhone`);
    
    if (invoicesResponse.value && invoicesResponse.value.length > 0) {
      const invoice = invoicesResponse.value[0];
      console.log('✅ Found invoice 15415:');
      console.log(`   📄 DocEntry: ${invoice.DocEntry}`);
      console.log(`   📋 DocNum: ${invoice.DocNum}`);
      console.log(`   👤 Customer: ${invoice.CardCode} - ${invoice.CardName}`);
      console.log(`   💰 Total: $${invoice.DocTotal}`);
      console.log(`   📅 Date: ${invoice.DocDate}`);
      console.log(`   🏷️  Series: ${invoice.Series}`);
      console.log(`   📱 WhatsApp Sent: ${invoice.U_WhatsAppSent || 'Not set'}`);
      console.log(`   📅 WhatsApp Date: ${invoice.U_WhatsAppDate || 'Not set'}`);
      console.log(`   📞 WhatsApp Phone: ${invoice.U_WhatsAppPhone || 'Not set'}`);
      
      // Get customer details
      console.log(`\n👤 Getting customer details for ${invoice.CardCode}...`);
      const customerResponse = await sap.request(`/BusinessPartners('${invoice.CardCode}')?$select=CardCode,CardName,Phone1,Phone2,Cellular`);
      
      console.log('✅ Customer details:');
      console.log(`   📋 Code: ${customerResponse.CardCode}`);
      console.log(`   👤 Name: ${customerResponse.CardName}`);
      console.log(`   📞 Phone1: ${customerResponse.Phone1 || 'None'}`);
      console.log(`   📞 Phone2: ${customerResponse.Phone2 || 'None'}`);
      console.log(`   📱 Cellular: ${customerResponse.Cellular || 'None'}`);
      
      // Show what would happen in test mode
      console.log(`\n🧪 TEST MODE BEHAVIOR:`);
      console.log(`   🔒 Would send to: ${process.env.TEST_PHONE} (instead of ${customerResponse.Cellular || 'no cellular'})`);
      console.log(`   ✅ Safe to test with this invoice`);
      
      return { invoice, customer: customerResponse };
      
    } else {
      console.log('❌ Invoice 15415 not found');
      console.log('   Checking recent invoices instead...');
      
      const recentResponse = await sap.request(`/Invoices?$top=5&$orderby=DocNum desc&$select=DocEntry,DocNum,CardCode,CardName,DocTotal,DocDate`);
      
      if (recentResponse.value && recentResponse.value.length > 0) {
        console.log('\n📋 Recent invoices found:');
        recentResponse.value.forEach((inv, index) => {
          console.log(`   ${index + 1}. ${inv.DocNum} - ${inv.CardName} ($${inv.DocTotal})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findInvoice15415();
