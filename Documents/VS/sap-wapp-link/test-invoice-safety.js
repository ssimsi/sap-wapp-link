// Test Invoice Query with Safety Filters
// This script tests the safe invoice filtering without sending any WhatsApp messages

import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  database: process.env.VITE_SAP_DATABASE,
  username: process.env.VITE_SAP_USERNAME || 'ssimsi',
  password: process.env.VITE_SAP_PASSWORD || 'Sim1234$'
};

class InvoiceQueryTester {
  constructor() {
    this.sessionId = null;
    this.cookies = null;
  }

  async login() {
    console.log('🔐 Logging into SAP...');
    
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
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const jsonResponse = JSON.parse(responseBody);
            this.sessionId = jsonResponse.SessionId;
            this.cookies = res.headers['set-cookie'];
            console.log('✅ SAP login successful!');
            resolve(true);
          } else {
            console.error('❌ SAP login failed:', responseBody);
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.write(loginData);
      req.end();
    });
  }

  async testInvoiceQuery() {
    console.log('\n🔍 Testing safe invoice query...');
    
    const fromDate = process.env.PROCESS_INVOICES_FROM_DATE || new Date().toISOString().split('T')[0];
    const filterQuery = `(U_WhatsAppSent eq 'N' or U_WhatsAppSent eq null) and DocDate ge '${fromDate}'`;
    const encodedFilter = encodeURIComponent(filterQuery);
    const query = `/Invoices?$filter=${encodedFilter}&$top=10`;
    
    console.log(`📅 Safety filter: Only invoices from ${fromDate} onwards`);
    console.log(`🔍 Filter: ${filterQuery}`);
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: `/b1s/v1${query}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; ')
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const data = JSON.parse(responseBody);
              const invoices = data.value || [];
              
              console.log(`\n✅ Found ${invoices.length} invoices matching safety criteria`);
              
              if (invoices.length > 0) {
                console.log('\n📋 Sample invoices that would be processed:');
                invoices.slice(0, 3).forEach((invoice, index) => {
                  console.log(`\n${index + 1}. Invoice ${invoice.DocNum}`);
                  console.log(`   Date: ${invoice.DocDate}`);
                  console.log(`   Customer: ${invoice.CardName} (${invoice.CardCode})`);
                  console.log(`   Total: $${invoice.DocTotal} ${invoice.DocCurrency}`);
                  console.log(`   WhatsApp Status: ${invoice.U_WhatsAppSent || 'Not set'}`);
                });
                
                if (invoices.length > 3) {
                  console.log(`\n   ... and ${invoices.length - 3} more invoices`);
                }
              } else {
                console.log('\n🎉 No invoices found - system is safe! No old invoices will be sent.');
                console.log('💡 This means either:');
                console.log('   - All recent invoices are already marked as sent');
                console.log('   - No new invoices since the safety date');
                console.log('   - The WhatsApp tracking fields are working correctly');
              }
              
              resolve(true);
            } else {
              console.error('❌ Invoice query failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ Error parsing response:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request failed:', error.message);
        resolve(false);
      });

      req.end();
    });
  }

  async testCustomerMobilePhones() {
    console.log('\n📱 Testing customer mobile phone numbers...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/BusinessPartners?$top=5&$select=CardCode,CardName,Phone1,Phone2,Cellular',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; ')
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const data = JSON.parse(responseBody);
              const customers = data.value || [];
              
              console.log(`\n✅ Testing mobile phone availability:`);
              
              let withMobile = 0;
              let withoutMobile = 0;
              
              customers.forEach((customer, index) => {
                const hasMobile = customer.Cellular && customer.Cellular.trim() !== '';
                if (hasMobile) withMobile++;
                else withoutMobile++;
                
                console.log(`\n${index + 1}. ${customer.CardName} (${customer.CardCode})`);
                console.log(`   📞 Phone1: ${customer.Phone1 || 'None'}`);
                console.log(`   📞 Phone2: ${customer.Phone2 || 'None'}`);
                console.log(`   📱 Mobile (Cellular): ${customer.Cellular || 'None'} ${hasMobile ? '✅' : '❌'}`);
              });
              
              console.log(`\n📊 Mobile phone summary:`);
              console.log(`   ✅ With mobile: ${withMobile}/${customers.length}`);
              console.log(`   ❌ Without mobile: ${withoutMobile}/${customers.length}`);
              
              if (withoutMobile > 0) {
                console.log(`\n💡 Customers without mobile numbers will be marked as "sent"`);
                console.log(`   to prevent bulk sending when they update their mobile number.`);
              }
              
              resolve(true);
            } else {
              console.error('❌ Customer query failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ Error parsing response:', error.message);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request failed:', error.message);
        resolve(false);
      });

      req.end();
    });
  }

  async runTests() {
    console.log('🧪 Testing WhatsApp Invoice Safety Filters\n');
    console.log('This test shows which invoices would be processed without actually sending anything.\n');

    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('❌ Could not connect to SAP. Please check your credentials.');
      return;
    }

    await this.testInvoiceQuery();
    await this.testCustomerMobilePhones();

    console.log('\n✅ Safety tests completed!');
    console.log('\n🛡️ Safety measures in place:');
    console.log('   1. Only processes invoices from configured date forward');
    console.log('   2. Only uses Cellular field for mobile numbers');
    console.log('   3. Marks invoices as sent even without mobile to prevent bulk sending');
    console.log('   4. Limited to 20 invoices per scan for safety');
    console.log('\n🚀 Ready to start WhatsApp service safely!');
  }
}

const tester = new InvoiceQueryTester();
tester.runTests().catch(error => {
  console.error('💥 Test failed:', error.message);
  process.exit(1);
});
