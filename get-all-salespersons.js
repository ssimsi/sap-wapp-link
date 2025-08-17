// Get All Sales Persons for Configuration
// This script fetches all sales persons from SAP to help configure phone numbers

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

class SalesPersonLoader {
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

  async getAllSalesPersons() {
    console.log('\n👥 Fetching all sales persons from SAP...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/SalesPersons',
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
              
              console.log(`\n✅ Found ${salesPersons.length} sales persons in SAP:`);
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              
              // Filter out inactive and special codes
              const activeSalesPersons = salesPersons.filter(sp => 
                sp.Active === 'tYES' && 
                sp.SalesEmployeeCode !== -1 && 
                sp.Locked !== 'tYES'
              );
              
              console.log(`\n📋 ACTIVE SALES PERSONS (${activeSalesPersons.length}):`);
              activeSalesPersons.forEach((sp, index) => {
                console.log(`\n${index + 1}. Code: ${sp.SalesEmployeeCode}`);
                console.log(`   Name: ${sp.SalesEmployeeName}`);
                console.log(`   Active: ${sp.Active}`);
                console.log(`   Locked: ${sp.Locked}`);
                console.log(`   Phone: ${sp.Telephone || 'None'}`);
                console.log(`   Mobile: ${sp.Mobile || 'None'}`);
                console.log(`   Email: ${sp.Email || 'None'}`);
                console.log(`   Department ID: ${sp.U_id_dep || 'None'}`);
              });
              
              console.log(`\n📋 ALL SALES PERSONS (including inactive):`);
              salesPersons.forEach((sp, index) => {
                const status = sp.Active === 'tYES' ? '✅' : '❌';
                const locked = sp.Locked === 'tYES' ? '🔒' : '🔓';
                console.log(`${index + 1}. [${sp.SalesEmployeeCode}] ${sp.SalesEmployeeName} ${status} ${locked}`);
              });
              
              console.log('\n🔧 ENVIRONMENT CONFIGURATION:');
              console.log('Add these lines to your .env.local file:');
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
              
              activeSalesPersons.forEach(sp => {
                const cleanName = sp.SalesEmployeeName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
                console.log(`SALES_PERSON_${sp.SalesEmployeeCode}=549xxxxxxxxx  # ${cleanName}`);
              });
              
              console.log('\n💡 INSTRUCTIONS:');
              console.log('1. Copy the SALES_PERSON lines above to your .env.local file');
              console.log('2. Replace 549xxxxxxxxx with actual WhatsApp numbers');
              console.log('3. Keep the SALES_PERSON_DEFAULT line for fallback');
              console.log('4. Remove or comment out codes you don\'t want to notify');
              
              console.log('\n📊 SUMMARY:');
              console.log(`   Total sales persons: ${salesPersons.length}`);
              console.log(`   Active sales persons: ${activeSalesPersons.length}`);
              console.log(`   With phone numbers: ${activeSalesPersons.filter(sp => sp.Telephone || sp.Mobile).length}`);
              console.log(`   With mobile numbers: ${activeSalesPersons.filter(sp => sp.Mobile).length}`);
              
              resolve(activeSalesPersons);
            } else {
              console.error('❌ SalesPersons query failed:', responseBody);
              resolve([]);
            }
          } catch (error) {
            console.error('❌ Error parsing sales persons:', error.message);
            resolve([]);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request failed:', error.message);
        resolve([]);
      });

      req.end();
    });
  }

  async checkInvoiceUsage() {
    console.log('\n📄 Checking which sales persons are used in recent invoices...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/Invoices?$top=50&$select=SalesPersonCode,DocNum,DocDate,CardName',
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
              
              // Count usage of each sales person code
              const usage = {};
              invoices.forEach(invoice => {
                const code = invoice.SalesPersonCode;
                if (code && code !== -1) {
                  usage[code] = (usage[code] || 0) + 1;
                }
              });
              
              console.log('\n📊 Sales person usage in recent invoices:');
              Object.entries(usage)
                .sort(([,a], [,b]) => b - a)
                .forEach(([code, count]) => {
                  console.log(`   Code ${code}: ${count} invoices`);
                });
              
              if (Object.keys(usage).length === 0) {
                console.log('   No sales person codes found in recent invoices');
              }
              
              resolve(usage);
            } else {
              console.error('❌ Invoice query failed:', responseBody);
              resolve({});
            }
          } catch (error) {
            console.error('❌ Error parsing invoices:', error.message);
            resolve({});
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request failed:', error.message);
        resolve({});
      });

      req.end();
    });
  }

  async run() {
    console.log('🧪 Loading All Sales Persons from SAP\n');

    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('❌ Could not connect to SAP. Please check your credentials.');
      return;
    }

    const salesPersons = await this.getAllSalesPersons();
    const usage = await this.checkInvoiceUsage();

    console.log('\n✅ Sales person analysis completed!');
    console.log('\n🚀 Ready to configure WhatsApp phone numbers for all active sales persons!');
  }
}

const loader = new SalesPersonLoader();
loader.run().catch(error => {
  console.error('💥 Loading failed:', error.message);
  process.exit(1);
});
