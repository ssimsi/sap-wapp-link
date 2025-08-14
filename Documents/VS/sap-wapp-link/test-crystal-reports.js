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

async function findCrystalReports() {
  console.log('🔍 Finding Crystal Reports via Print Service...');
  
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
    const invoices = invoicesResponse.value || [];
    
    if (invoices.length === 0) {
      console.log('❌ No invoices found for testing');
      return;
    }

    const invoice = invoices[0];
    console.log(`🧾 Testing with invoice ${invoice.DocNum} (DocEntry: ${invoice.DocEntry})`);

    // Method 1: Try to find print service endpoints
    console.log('\n🔍 1. Testing Print Service endpoints...');
    
    const printServiceEndpoints = [
      '/b1s/v1/PrintService',
      '/b1s/v1/Print',
      '/b1s/v1/PrintLayouts',
      '/b1s/v1/ReportLayouts',
      '/b1s/v1/Reports'
    ];

    for (const endpoint of printServiceEndpoints) {
      try {
        console.log(`   � Testing: ${endpoint}`);
        const response = await sap.makeRequest(endpoint);
        console.log(`   ✅ ${endpoint} is available!`);
        
        if (response.value && Array.isArray(response.value)) {
          console.log(`      � Found ${response.value.length} items`);
          
          // Look for invoice-related items
          const invoiceItems = response.value.filter(item => 
            JSON.stringify(item).toLowerCase().includes('invoice') ||
            JSON.stringify(item).toLowerCase().includes('factura') ||
            JSON.stringify(item).toLowerCase().includes('standar')
          );
          
          if (invoiceItems.length > 0) {
            console.log(`      🎯 Invoice-related items found:`);
            invoiceItems.forEach(item => {
              console.log(`         - ${JSON.stringify(item)}`);
            });
          }
        }
        
      } catch (error) {
        console.log(`   ❌ ${endpoint}: ${error.message}`);
      }
    }

    // Method 2: Try document-specific print endpoints
    console.log('\n🔍 2. Testing document-specific print endpoints...');
    
    const docPrintEndpoints = [
      `/b1s/v1/Invoices(${invoice.DocEntry})/Print`,
      `/b1s/v1/Invoices(${invoice.DocEntry})/PrintPreview`,
      `/b1s/v1/Invoices(${invoice.DocEntry})/GetPrintLayouts`,
      `/b1s/v1/Documents/13/Print?DocEntry=${invoice.DocEntry}`, // 13 = Invoice object type
      `/b1s/v1/PrintTemplates/Invoice`,
      `/b1s/v1/PrintService/Invoice?DocEntry=${invoice.DocEntry}`
    ];

    for (const endpoint of docPrintEndpoints) {
      try {
        console.log(`   📄 Testing: ${endpoint}`);
        const response = await sap.makeRequest(endpoint);
        console.log(`   ✅ ${endpoint} works!`);
        console.log(`      📋 Response: ${JSON.stringify(response).substring(0, 200)}...`);
        
      } catch (error) {
        console.log(`   ❌ ${endpoint}: ${error.message}`);
      }
    }

    // Method 3: Try to get available report templates for invoices
    console.log('\n� 3. Looking for Crystal Report templates...');
    
    const reportQueries = [
      '/b1s/v1/ReportTemplates',
      '/b1s/v1/CrystalReports', 
      '/b1s/v1/UserReports',
      '/b1s/v1/SystemReports',
      '/b1s/v1/PrintLayouts?$filter=ObjectCode eq \'13\'', // 13 = Invoice
      '/b1s/v1/ReportLayouts?$filter=ObjectCode eq \'13\''
    ];

    for (const query of reportQueries) {
      try {
        console.log(`   📄 Testing: ${query}`);
        const response = await sap.makeRequest(query);
        console.log(`   ✅ ${query} works!`);
        
        if (response.value && Array.isArray(response.value)) {
          console.log(`      📋 Found ${response.value.length} templates`);
          
          response.value.forEach((template, index) => {
            if (index < 5) { // Show first 5 templates
              console.log(`         ${index + 1}. ${JSON.stringify(template)}`);
            }
          });
          
          if (response.value.length > 5) {
            console.log(`         ... and ${response.value.length - 5} more`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ ${query}: ${error.message}`);
      }
    }

    // Method 4: Try alternative report generation methods
    console.log('\n🔍 4. Testing alternative report methods...');
    
    const altMethods = [
      {
        name: 'ReportService_GetReportList',
        endpoint: '/b1s/v1/ReportService_GetReportList',
        method: 'POST',
        payload: {}
      },
      {
        name: 'PrintService_GetPrintLayouts', 
        endpoint: '/b1s/v1/PrintService_GetPrintLayouts',
        method: 'POST',
        payload: { ObjectType: 13 } // Invoice object type
      },
      {
        name: 'ReportService_GetTemplateList',
        endpoint: '/b1s/v1/ReportService_GetTemplateList',
        method: 'POST', 
        payload: { ObjectType: 13 }
      }
    ];

    for (const method of altMethods) {
      try {
        console.log(`   📄 Testing: ${method.name}`);
        const response = await sap.makeRequest(method.endpoint, method.method, method.payload);
        console.log(`   ✅ ${method.name} works!`);
        console.log(`      📋 Response: ${JSON.stringify(response).substring(0, 300)}...`);
        
      } catch (error) {
        console.log(`   ❌ ${method.name}: ${error.message}`);
      }
    }

    // Method 5: Look for specific STANDAR variations in different places
    console.log('\n🔍 5. Searching for STANDAR in different contexts...');
    
    const standarSearches = [
      '/b1s/v1/PrintLayouts?$filter=contains(LayoutName,\'STANDAR\')',
      '/b1s/v1/PrintLayouts?$filter=contains(LayoutCode,\'STANDAR\')',
      '/b1s/v1/Reports?$filter=contains(ReportName,\'STANDAR\')',
      '/b1s/v1/Reports?$filter=contains(ReportCode,\'STANDAR\')',
      '/b1s/v1/UserFields?$filter=contains(FieldName,\'STANDAR\')'
    ];

    for (const search of standarSearches) {
      try {
        console.log(`   📄 Searching: ${search}`);
        const response = await sap.makeRequest(search);
        
        if (response.value && response.value.length > 0) {
          console.log(`   🎯 FOUND STANDAR REFERENCES!`);
          response.value.forEach(item => {
            console.log(`      ⭐ ${JSON.stringify(item)}`);
          });
        } else {
          console.log(`   📄 No STANDAR references found in this endpoint`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${search}: ${error.message}`);
      }
    }

    console.log('\n📋 Summary: Check the successful endpoints above to find the Crystal Reports service');

  } catch (error) {
    console.error('\n❌ Error finding Crystal Reports:', error);
  }
}

findCrystalReports().catch(console.error);
