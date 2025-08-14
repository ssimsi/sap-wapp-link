// Test Invoice Series Detection
// Check how Series field appears in SAP invoices to differentiate primario vs gestion

import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  baseUrl: 'https://b1.ativy.com:50685/b1s/v1',
  database: process.env.VITE_SAP_DATABASE,
  username: process.env.VITE_SAP_USERNAME,
  password: process.env.VITE_SAP_PASSWORD
};

class InvoiceSeriesTester {
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

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

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

      req.on('error', (error) => {
        console.error('❌ SAP login error:', error.message);
        resolve(false);
      });

      req.write(loginData);
      req.end();
    });
  }

  async checkInvoiceSeries() {
    console.log('\n📄 Checking invoice series fields...');
    
    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/Invoices?$top=10&$orderby=DocDate%20desc',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; ')
      }
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
              console.log(`✅ Found ${jsonResponse.value?.length || 0} recent invoices`);
              
              if (jsonResponse.value && jsonResponse.value.length > 0) {
                console.log('\n📋 INVOICE SERIES ANALYSIS:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                // Look for series-related fields
                const seriesFields = new Set();
                const seriesData = [];
                
                jsonResponse.value.forEach((invoice, index) => {
                  console.log(`\n${index + 1}. Invoice ${invoice.DocNum} (Date: ${invoice.DocDate})`);
                  
                  // Check all possible series fields
                  const invoiceSeriesData = {};
                  Object.keys(invoice).forEach(key => {
                    if (key.toLowerCase().includes('series') || 
                        key.toLowerCase().includes('serie') ||
                        key === 'Series' ||
                        key === 'DocSeries' ||
                        key === 'SeriesString') {
                      seriesFields.add(key);
                      invoiceSeriesData[key] = invoice[key];
                      console.log(`   ${key}: ${invoice[key]}`);
                    }
                  });
                  
                  // Also check some common fields that might contain series info
                  const commonFields = ['DocNum', 'DocDate', 'DocEntry', 'Series', 'SeriesString', 'U_Series'];
                  commonFields.forEach(field => {
                    if (invoice[field] !== undefined && !invoiceSeriesData[field]) {
                      console.log(`   ${field}: ${invoice[field]}`);
                    }
                  });
                  
                  seriesData.push({
                    DocNum: invoice.DocNum,
                    DocDate: invoice.DocDate,
                    series: invoiceSeriesData
                  });
                });
                
                console.log('\n📊 SERIES FIELDS SUMMARY:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                if (seriesFields.size > 0) {
                  console.log('Found series-related fields:');
                  seriesFields.forEach(field => console.log(`   - ${field}`));
                } else {
                  console.log('❌ No obvious series fields found');
                  console.log('Let me show all available fields from the first invoice:');
                  if (jsonResponse.value[0]) {
                    console.log('\n🔍 ALL FIELDS IN FIRST INVOICE:');
                    Object.keys(jsonResponse.value[0]).sort().forEach(key => {
                      console.log(`   ${key}: ${jsonResponse.value[0][key]}`);
                    });
                  }
                }
                
                console.log('\n🎯 LOOKING FOR SERIES 13 (PRIMARIO) and 83 (GESTION):');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                let foundPrimario = false;
                let foundGestion = false;
                
                seriesData.forEach(invoice => {
                  const seriesValues = Object.values(invoice.series);
                  if (seriesValues.includes(13) || seriesValues.includes('13')) {
                    console.log(`✅ PRIMARIO found: Invoice ${invoice.DocNum}`);
                    foundPrimario = true;
                  }
                  if (seriesValues.includes(83) || seriesValues.includes('83')) {
                    console.log(`✅ GESTION found: Invoice ${invoice.DocNum}`);
                    foundGestion = true;
                  }
                });
                
                if (!foundPrimario && !foundGestion) {
                  console.log('❓ No series 13 or 83 found in recent invoices');
                  console.log('   This might mean:');
                  console.log('   1. No recent invoices with these series');
                  console.log('   2. Series field has a different name');
                  console.log('   3. Values are stored differently');
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

  async checkSpecificSeries() {
    console.log('\n🔍 Checking for specific series 13 and 83...');
    
    // Try to find invoices with specific series
    const series13Query = `/b1s/v1/Invoices?$filter=Series eq 13&$top=3`;
    const series83Query = `/b1s/v1/Invoices?$filter=Series eq 83&$top=3`;
    
    for (const [seriesName, query] of [['PRIMARIO (13)', series13Query], ['GESTION (83)', series83Query]]) {
      console.log(`\n📋 Looking for ${seriesName}...`);
      
      const options = {
        hostname: SAP_CONFIG.hostname,
        port: SAP_CONFIG.port,
        path: query,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': this.cookies.join('; ')
        }
      };

      await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          let responseBody = '';
          
          res.on('data', (chunk) => {
            responseBody += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const jsonResponse = JSON.parse(responseBody);
                const count = jsonResponse.value?.length || 0;
                console.log(`   ✅ Found ${count} invoices with ${seriesName}`);
                
                if (count > 0) {
                  jsonResponse.value.forEach((invoice, index) => {
                    console.log(`      ${index + 1}. Invoice ${invoice.DocNum} - Series: ${invoice.Series}`);
                  });
                }
              } else {
                console.log(`   ❌ Query failed for ${seriesName}: ${res.statusCode}`);
              }
            } catch (error) {
              console.log(`   ❌ Error parsing response for ${seriesName}: ${error.message}`);
            }
            resolve();
          });
        });

        req.on('error', (error) => {
          console.log(`   ❌ Request failed for ${seriesName}: ${error.message}`);
          resolve();
        });

        req.end();
      });
    }
  }

  async run() {
    console.log('🧪 Testing Invoice Series Detection\n');

    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('\n❌ Login failed. Cannot continue.');
      return;
    }

    await this.checkInvoiceSeries();
    await this.checkSpecificSeries();

    console.log('\n✅ Series analysis completed!');
    console.log('\n💡 NEXT STEPS:');
    console.log('   1. Identify the correct field name for invoice series');
    console.log('   2. Update WhatsApp service to check series value');
    console.log('   3. Create different message templates for:');
    console.log('      - Series 13 (PRIMARIO)');
    console.log('      - Series 83 (GESTION)');
    console.log('      - Other series (default message)');
  }
}

// Run the test
const tester = new InvoiceSeriesTester();
tester.run().catch(error => {
  console.error('💥 Test failed:', error.message);
  process.exit(1);
});
