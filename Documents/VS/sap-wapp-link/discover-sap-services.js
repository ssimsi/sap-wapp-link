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

async function discoverSAPServices() {
  console.log('🔍 Discovering available SAP services...');
  
  const sap = new SAPConnection();
  
  try {
    const loginSuccess = await sap.login();
    if (!loginSuccess) {
      console.error('❌ Could not connect to SAP. Exiting.');
      return;
    }

    // Check the root metadata to see what services are available
    console.log('\n📋 1. Checking SAP Service Layer metadata...');
    try {
      const metadataResponse = await sap.makeRequest('/b1s/v1/$metadata');
      console.log('✅ Metadata endpoint works');
      console.log('📄 Metadata contains service definitions');
    } catch (error) {
      console.log('❌ Metadata not available:', error.message);
    }

    // Check what entity sets are available
    console.log('\n📋 2. Checking available entity sets...');
    try {
      const rootResponse = await sap.makeRequest('/b1s/v1/');
      console.log('✅ Root endpoint works');
      
      if (rootResponse.value && Array.isArray(rootResponse.value)) {
        console.log(`📄 Found ${rootResponse.value.length} entity sets:`);
        
        // Show all entity sets and look for report/print related ones
        const reportRelated = [];
        const printRelated = [];
        const allEntities = [];
        
        rootResponse.value.forEach(entity => {
          const name = entity.name || entity.Name || entity;
          allEntities.push(name);
          
          if (name.toLowerCase().includes('report')) {
            reportRelated.push(name);
          }
          if (name.toLowerCase().includes('print')) {
            printRelated.push(name);
          }
        });
        
        console.log('\n📊 All entity sets:');
        allEntities.sort().forEach((name, index) => {
          if (index < 50) { // Show first 50
            console.log(`   ${index + 1}. ${name}`);
          }
        });
        
        if (allEntities.length > 50) {
          console.log(`   ... and ${allEntities.length - 50} more`);
        }
        
        if (reportRelated.length > 0) {
          console.log('\n🎯 Report-related entity sets:');
          reportRelated.forEach(name => {
            console.log(`   📊 ${name}`);
          });
        }
        
        if (printRelated.length > 0) {
          console.log('\n🖨️ Print-related entity sets:');
          printRelated.forEach(name => {
            console.log(`   🖨️ ${name}`);
          });
        }
        
      }
    } catch (error) {
      console.log('❌ Root endpoint failed:', error.message);
    }

    // Try to access Crystal Reports through different B1 versions/paths
    console.log('\n📋 3. Testing alternative SAP B1 API paths...');
    
    const alternativePaths = [
      '/b1s/v2/',
      '/b1s/',
      '/sap/b1s/v1/',
      '/api/v1/',
      '/crystal/',
      '/reports/'
    ];

    for (const altPath of alternativePaths) {
      try {
        console.log(`   📄 Testing: ${altPath}`);
        const response = await sap.makeRequest(altPath);
        console.log(`   ✅ ${altPath} is available!`);
        
        if (response.value && Array.isArray(response.value)) {
          console.log(`      📋 Contains ${response.value.length} services`);
        }
        
      } catch (error) {
        console.log(`   ❌ ${altPath}: ${error.message}`);
      }
    }

    // Check for document attachment capabilities
    console.log('\n📋 4. Checking document attachment capabilities...');
    try {
      const invoice = await sap.makeRequest('/b1s/v1/Invoices?$top=1');
      if (invoice.value && invoice.value.length > 0) {
        const docEntry = invoice.value[0].DocEntry;
        
        // Check if we can access attachments
        const attachmentPaths = [
          `/b1s/v1/Invoices(${docEntry})/DocumentLines`,
          `/b1s/v1/Invoices(${docEntry})/Attachments2`,
          `/b1s/v1/Attachments2?$filter=AbsEntry eq ${docEntry}`,
          `/b1s/v1/DocumentsOwnerInformation?$filter=DocumentsOwner eq ${docEntry}`
        ];
        
        for (const path of attachmentPaths) {
          try {
            console.log(`   📄 Testing: ${path}`);
            const response = await sap.makeRequest(path);
            console.log(`   ✅ ${path} works!`);
            
            if (response.value) {
              console.log(`      📋 Found ${response.value.length} items`);
            }
            
          } catch (error) {
            console.log(`   ❌ ${path}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log('❌ Document attachment check failed:', error.message);
    }

    console.log('\n💡 Summary:');
    console.log('   Crystal Reports PDF generation is not available through Service Layer API');
    console.log('   This is common in many SAP B1 installations');
    console.log('   Alternatives:');
    console.log('   1. Generate simple PDF with invoice details');
    console.log('   2. Use SAP B1 DI API (requires different connection)');
    console.log('   3. Export invoice data to external PDF generator');

  } catch (error) {
    console.error('\n❌ Error discovering SAP services:', error);
  }
}

discoverSAPServices().catch(console.error);
