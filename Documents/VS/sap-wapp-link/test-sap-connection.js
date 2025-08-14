// Test SAP Connection and Invoice Query
// Use this to verify your SAP setup before running the WhatsApp service

import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  baseUrl: 'https://b1.ativy.com:50685/b1s/v1',
  database: process.env.VITE_SAP_DATABASE,
  username: process.env.VITE_SAP_USERNAME || 'ssimsi',
  password: process.env.VITE_SAP_PASSWORD || 'Sim1234$'
};

class SAPTester {
  constructor() {
    this.sessionId = null;
    this.cookies = null;
  }

  async login() {
    console.log('🔐 Testing SAP login...');
    
    const loginData = JSON.stringify({
      CompanyDB: SAP_CONFIG.database,
      UserName: SAP_CONFIG.username,
      Password: SAP_CONFIG.password
    });

    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/Login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      },
      timeout: 30000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const jsonResponse = JSON.parse(responseBody);
              this.sessionId = jsonResponse.SessionId;
              this.cookies = res.headers['set-cookie'];
              
              console.log(`✅ SAP login successful!`);
              console.log(`📋 Session ID: ${this.sessionId}`);
              console.log(`🗄️ Database: ${SAP_CONFIG.database}`);
              resolve(true);
            } else {
              console.error('❌ SAP login failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ SAP login error:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ SAP login request failed:', error.message);
        resolve(false);
      });

      req.write(loginData);
      req.end();
    });
  }

  async testInvoiceQuery() {
    console.log('\n📄 Testing invoice query...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/Invoices?$top=5',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; ')
      },
      timeout: 30000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const jsonResponse = JSON.parse(responseBody);
              console.log(`✅ Found ${jsonResponse.value?.length || 0} invoices`);
              
              if (jsonResponse.value && jsonResponse.value.length > 0) {
                const invoice = jsonResponse.value[0];
                console.log('\n📋 Sample invoice:');
                console.log(`   DocNum: ${invoice.DocNum}`);
                console.log(`   DocDate: ${invoice.DocDate}`);
                console.log(`   CardCode: ${invoice.CardCode}`);
                console.log(`   CardName: ${invoice.CardName}`);
                console.log(`   DocTotal: ${invoice.DocTotal}`);
                console.log(`   DocCurrency: ${invoice.DocCurrency}`);
                
                // Check for WhatsApp tracking fields
                if (invoice.U_WhatsAppSent !== undefined) {
                  console.log(`   U_WhatsAppSent: ${invoice.U_WhatsAppSent}`);
                } else {
                  console.log('   ⚠️ U_WhatsAppSent field not found - you may need to add this custom field');
                }
              }
              
              resolve(true);
            } else {
              console.error('❌ Invoice query failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ Invoice query error:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Invoice request failed:', error.message);
        resolve(false);
      });

      req.end();
    });
  }

  async testCustomerQuery() {
    console.log('\n👥 Testing customer query...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/BusinessPartners?$top=3&$filter=CardType%20eq%20%27C%27',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; ')
      },
      timeout: 30000
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const jsonResponse = JSON.parse(responseBody);
              console.log(`✅ Found ${jsonResponse.value?.length || 0} customers`);
              
              if (jsonResponse.value && jsonResponse.value.length > 0) {
                jsonResponse.value.forEach((customer, index) => {
                  console.log(`\n👤 Customer ${index + 1}:`);
                  console.log(`   CardCode: ${customer.CardCode}`);
                  console.log(`   CardName: ${customer.CardName}`);
                  console.log(`   Phone1: ${customer.Phone1 || 'No phone1'}`);
                  console.log(`   Phone2: ${customer.Phone2 || 'No phone2'}`);
                  console.log(`   Mobile: ${customer.Mobile || customer.MobilePhone || customer.Cellular || 'No mobile'}`);
                  console.log(`   EmailAddress: ${customer.EmailAddress || 'No email'}`);
                  
                  // Debug: Show all phone-related fields
                  const phoneFields = {};
                  Object.keys(customer).forEach(key => {
                    if (key.toLowerCase().includes('phone') || 
                        key.toLowerCase().includes('mobile') || 
                        key.toLowerCase().includes('cellular') ||
                        key.toLowerCase().includes('tel')) {
                      phoneFields[key] = customer[key];
                    }
                  });
                  if (Object.keys(phoneFields).length > 0) {
                    console.log(`   📱 All phone fields:`, phoneFields);
                  }
                });
              }
              
              resolve(true);
            } else {
              console.error('❌ Customer query failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ Customer query error:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Customer request failed:', error.message);
        resolve(false);
      });

      req.end();
    });
  }

  async runTests() {
    console.log('🧪 Starting SAP Connection Tests\n');
    console.log('Configuration:');
    console.log(`   Server: ${SAP_CONFIG.hostname}:${SAP_CONFIG.port}`);
    console.log(`   Database: ${SAP_CONFIG.database}`);
    console.log(`   Username: ${SAP_CONFIG.username}`);
    console.log('');

    // Test login
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('\n❌ SAP login failed. Please check your credentials in .env.local');
      return;
    }

    // Test invoice query
    await this.testInvoiceQuery();
    
    // Test customer query
    await this.testCustomerQuery();

    console.log('\n✅ All tests completed!');
    console.log('\nNext steps:');
    console.log('1. Create custom fields in SAP for WhatsApp tracking:');
    console.log('   - U_WhatsAppSent (Y/N)');
    console.log('   - U_WhatsAppDate (Date)');
    console.log('2. Run: npm start');
  }
}

// Run the tests
const tester = new SAPTester();
tester.runTests().catch(error => {
  console.error('💥 Test failed:', error.message);
  process.exit(1);
});
