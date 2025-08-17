import https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  database: process.env.VITE_SAP_DATABASE,
  username: process.env.VITE_SAP_USERNAME,
  password: process.env.VITE_SAP_PASSWORD
};

class SAPConnection {
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
      },
      rejectUnauthorized: false,
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
              const data = JSON.parse(responseBody);
              this.sessionId = data.SessionId;
              this.cookies = res.headers['set-cookie'];
              console.log('✅ SAP login successful!');
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

  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: SAP_CONFIG.hostname,
        port: SAP_CONFIG.port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': this.cookies ? this.cookies.join('; ') : ''
        },
        rejectUnauthorized: false,
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const data = JSON.parse(responseBody);
              resolve(data);
            } else {
              console.error(`❌ Request failed (${res.statusCode}):`, responseBody);
              reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
            }
          } catch (error) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseBody);
            } else {
              reject(error);
            }
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data && method !== 'GET') {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }
}

async function investigateBOYReports() {
  console.log('🔍 Investigating BOY Report Services for STANDAR Crystal Report...');
  
  const sap = new SAPConnection();
  
  try {
    const loginSuccess = await sap.login();
    if (!loginSuccess) {
      console.error('❌ Could not connect to SAP. Exiting.');
      return;
    }

    // Get a sample invoice first
    console.log('\n📋 Getting sample invoice...');
    const invoicesResponse = await sap.makeRequest('/b1s/v1/Invoices?$top=1');
    const invoice = invoicesResponse.value[0];
    console.log(`🧾 Using invoice ${invoice.DocNum} (DocEntry: ${invoice.DocEntry})`);

    // Investigate BOY report entities
    const boyReportEntities = [
      'BOY_85_CUSTOMPRINT',
      'BOY_85_REPORTACTION', 
      'BOY_85_REPORTCONFIG',
      'BOY_85_REPORTDEF',
      'BOY_85_SCHEDULE',
      'ReportTypes',
      'ReportFilter'
    ];

    for (const entity of boyReportEntities) {
      console.log(`\n🔍 Investigating ${entity}...`);
      
      try {
        // Get entity structure
        const response = await sap.makeRequest(`/b1s/v1/${entity}?$top=5`);
        
        if (response.value && response.value.length > 0) {
          console.log(`✅ ${entity} contains ${response.value.length} records`);
          
          // Show first record structure
          console.log(`📋 Sample record structure:`);
          const sample = response.value[0];
          Object.keys(sample).forEach(key => {
            const value = sample[key];
            const truncated = typeof value === 'string' && value.length > 50 ? 
              value.substring(0, 50) + '...' : value;
            console.log(`   ${key}: ${truncated}`);
          });
          
          // Look for STANDAR references
          const standarRecords = response.value.filter(record => 
            JSON.stringify(record).toLowerCase().includes('standar') ||
            JSON.stringify(record).toLowerCase().includes('invoice') ||
            JSON.stringify(record).toLowerCase().includes('factura')
          );
          
          if (standarRecords.length > 0) {
            console.log(`🎯 Found ${standarRecords.length} STANDAR/Invoice related records:`);
            standarRecords.forEach((record, index) => {
              console.log(`   ${index + 1}. ${JSON.stringify(record)}`);
            });
          } else {
            console.log(`📄 No STANDAR/Invoice references found in ${entity}`);
          }
          
        } else {
          console.log(`📄 ${entity} is empty or structure only`);
          
          // Try to see the entity metadata
          try {
            const metaResponse = await sap.makeRequest(`/b1s/v1/${entity}/$metadata`);
            console.log(`📋 ${entity} metadata available`);
          } catch (metaError) {
            console.log(`📄 No metadata available for ${entity}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ ${entity}: ${error.message}`);
      }
    }

    // Try to call BOY_85_CUSTOMPRINT with invoice data
    console.log(`\n🎯 Testing BOY_85_CUSTOMPRINT with invoice data...`);
    
    const printTestPayloads = [
      {
        DocEntry: invoice.DocEntry,
        ObjectType: 13, // Invoice
        ReportName: 'STANDAR'
      },
      {
        DocEntry: invoice.DocEntry,
        ObjectType: 13,
        ReportCode: 'STANDAR'
      },
      {
        DocEntry: invoice.DocEntry.toString(),
        ReportName: 'STANDAR',
        Format: 'PDF'
      },
      {
        DocumentEntry: invoice.DocEntry,
        DocumentType: 'Invoice',
        TemplateName: 'STANDAR'
      }
    ];

    for (const payload of printTestPayloads) {
      try {
        console.log(`📄 Testing payload: ${JSON.stringify(payload)}`);
        
        const response = await sap.makeRequest('/b1s/v1/BOY_85_CUSTOMPRINT', 'POST', payload);
        console.log(`✅ BOY_85_CUSTOMPRINT SUCCESS!`);
        console.log(`📋 Response: ${JSON.stringify(response)}`);
        
        // This might be the solution!
        return;
        
      } catch (error) {
        console.log(`❌ Payload failed: ${error.message}`);
      }
    }

    // Check if there are any action endpoints for BOY reports
    console.log(`\n🔍 Testing BOY action endpoints...`);
    
    const actionEndpoints = [
      '/b1s/v1/BOY_85_REPORTACTION',
      '/b1s/v1/BOY_85_REPORTCONFIG', 
      '/b1s/v1/BOY_85_REPORTDEF'
    ];

    for (const endpoint of actionEndpoints) {
      try {
        console.log(`📄 Testing ${endpoint} with invoice data...`);
        
        const actionPayload = {
          DocEntry: invoice.DocEntry,
          ReportName: 'STANDAR',
          Action: 'PRINT'
        };
        
        const response = await sap.makeRequest(endpoint, 'POST', actionPayload);
        console.log(`✅ ${endpoint} SUCCESS!`);
        console.log(`📋 Response: ${JSON.stringify(response)}`);
        
      } catch (error) {
        console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }

    console.log(`\n💡 Next steps:`);
    console.log(`   1. Check BOY_85_CUSTOMPRINT records for STANDAR template`);
    console.log(`   2. Look for BOY report configuration that matches your Crystal Report`);
    console.log(`   3. Test different payload structures with BOY services`);

  } catch (error) {
    console.error('\n❌ Error investigating BOY reports:', error);
  }
}

investigateBOYReports().catch(console.error);
