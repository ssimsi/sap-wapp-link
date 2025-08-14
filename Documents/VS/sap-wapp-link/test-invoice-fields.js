// Test Invoice Fields to Find Sales Person Information
// This script examines invoice structure to find sales person fields

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

class InvoiceFieldsTester {
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

  async examineInvoiceFields() {
    console.log('\n🔍 Examining invoice fields to find sales person information...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/Invoices?$top=1',
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
              
              if (invoices.length > 0) {
                const invoice = invoices[0];
                console.log(`\n📋 Sample Invoice ${invoice.DocNum} - All Available Fields:`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // Look for sales person related fields
                const salesFields = [];
                const allFields = [];
                
                Object.keys(invoice).forEach(key => {
                  allFields.push(`${key}: ${JSON.stringify(invoice[key])}`);
                  
                  if (key.toLowerCase().includes('sales') || 
                      key.toLowerCase().includes('slp') ||
                      key.toLowerCase().includes('employee') ||
                      key.toLowerCase().includes('person')) {
                    salesFields.push({
                      field: key,
                      value: invoice[key]
                    });
                  }
                });
                
                console.log('\n🎯 SALES PERSON RELATED FIELDS:');
                if (salesFields.length > 0) {
                  salesFields.forEach(field => {
                    console.log(`   ✅ ${field.field}: ${field.value}`);
                  });
                } else {
                  console.log('   ⚠️ No obvious sales person fields found');
                }
                
                console.log('\n📋 ALL INVOICE FIELDS (first 20):');
                allFields.slice(0, 20).forEach((field, index) => {
                  console.log(`   ${index + 1}. ${field}`);
                });
                
                if (allFields.length > 20) {
                  console.log(`   ... and ${allFields.length - 20} more fields`);
                }
                
                // Also check for specific known sales person fields
                console.log('\n🔍 CHECKING COMMON SALES PERSON FIELDS:');
                const commonSalesFields = [
                  'SalesPersonCode',
                  'SlpCode', 
                  'SlpName',
                  'EmployeeCode',
                  'SalesEmployee',
                  'U_SalesPerson',
                  'DocumentsOwner',
                  'UserCode'
                ];
                
                commonSalesFields.forEach(fieldName => {
                  if (invoice[fieldName] !== undefined) {
                    console.log(`   ✅ ${fieldName}: ${invoice[fieldName]}`);
                  } else {
                    console.log(`   ❌ ${fieldName}: Not found`);
                  }
                });
                
              } else {
                console.log('❌ No invoices found to examine');
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

  async checkSalesPersonTable() {
    console.log('\n👤 Checking SalesPersons table structure...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/SalesPersons?$top=3',
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
              const salesPersons = data.value || [];
              
              console.log(`\n✅ Found ${salesPersons.length} sales persons:`);
              
              salesPersons.forEach((sp, index) => {
                console.log(`\n${index + 1}. Sales Person:`);
                Object.keys(sp).forEach(key => {
                  console.log(`   ${key}: ${sp[key]}`);
                });
              });
              
              resolve(true);
            } else {
              console.error('❌ SalesPersons query failed:', responseBody);
              resolve(false);
            }
          } catch (error) {
            console.error('❌ Error parsing sales persons:', error.message);
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
    console.log('🧪 Examining Invoice and Sales Person Fields\n');

    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('❌ Could not connect to SAP. Please check your credentials.');
      return;
    }

    await this.examineInvoiceFields();
    await this.checkSalesPersonTable();

    console.log('\n✅ Field examination completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Identify the correct sales person field from the output above');
    console.log('2. Update WhatsApp service to include sales person notifications');
    console.log('3. Configure sales person phone numbers in environment');
  }
}

const tester = new InvoiceFieldsTester();
tester.runTests().catch(error => {
  console.error('💥 Test failed:', error.message);
  process.exit(1);
});
