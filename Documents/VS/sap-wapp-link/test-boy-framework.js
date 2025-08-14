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

async function testBOYReportExecution() {
  console.log('🎯 Testing BOY Framework Report Execution for SHK-001 Crystal Report...');
  
  const sap = new SAPConnection();
  
  try {
    const loginSuccess = await sap.login();
    if (!loginSuccess) {
      console.error('❌ Could not connect to SAP. Exiting.');
      return;
    }

    // Get a sample invoice
    console.log('\n📋 Getting sample invoice...');
    const invoicesResponse = await sap.makeRequest('/b1s/v1/Invoices?$top=1');
    const invoice = invoicesResponse.value[0];
    console.log(`🧾 Using invoice ${invoice.DocNum} (DocEntry: ${invoice.DocEntry})`);

    // Try different BOY framework approaches
    console.log('\n🎯 Testing BOY Framework Execution Methods...');

    // Method 1: Try creating a BOY_85_REPORTCONFIG for our specific invoice
    console.log('\n📋 Method 1: Creating BOY Report Configuration...');
    try {
      const reportConfig = {
        U_BOY_DESC: `WhatsApp Invoice ${invoice.DocNum}`,
        U_BOY_ACTIVE: 'Y',
        U_BOY_SHOW: 'Y',
        U_BOY_CATEGORY: 'SALES',
        U_BOY_TYPE: '00000006', // Same type as the existing config
        BOY_85_REP_CONFIGLCollection: [{
          U_BOY_CRYSTAL: 'SHK-001', // This is our Crystal Report
          U_BOY_PDF: 'RA-D004', // Use the email report action we found
          U_BOY_EMAIL: 'SHK-011'
        }]
      };

      console.log(`📤 Creating report config: ${JSON.stringify(reportConfig)}`);
      const configResponse = await sap.makeRequest('/b1s/v1/BOY_85_REPORTCONFIG', 'POST', reportConfig);
      console.log(`✅ Report config created! DocEntry: ${configResponse.DocEntry}`);

      // Now try to execute this config
      console.log(`📄 Executing report config ${configResponse.DocEntry}...`);
      
    } catch (error) {
      console.log(`❌ Method 1 failed: ${error.message}`);
    }

    // Method 2: Try calling existing BOY services
    console.log('\n📋 Method 2: Testing BOY Service Calls...');
    
    // Test different service call methods
    const serviceCalls = [
      {
        path: '/b1s/v1/BOY_85_REPORTCONFIG(16)/Execute', // Execute existing config
        method: 'POST',
        data: {
          DocEntry: invoice.DocEntry,
          ObjectType: 13
        }
      },
      {
        path: '/b1s/v1/BOY_85_REPORTDEF("SHK-001")/Execute',
        method: 'POST', 
        data: {
          DOCKEY: invoice.DocEntry,
          OBJECTID: 13
        }
      },
      {
        path: '/b1s/v1/BOY_85_REPORTDEF("SHK-001")/Print',
        method: 'POST',
        data: {
          Parameters: {
            'DOCKEY@': invoice.DocEntry,
            'OBJECTID@': 13,
            'Pm-OINV.DocEntry': invoice.DocEntry
          }
        }
      }
    ];

    for (const call of serviceCalls) {
      try {
        console.log(`📄 Testing ${call.path}...`);
        const response = await sap.makeRequest(call.path, call.method, call.data);
        console.log(`✅ ${call.path} SUCCESS!`);
        console.log(`📋 Response: ${JSON.stringify(response)}`);
        
        // This might return a PDF or file path!
        return;
        
      } catch (error) {
        console.log(`❌ ${call.path}: ${error.message}`);
      }
    }

    // Method 3: Try using BOY_85_CUSTOMPRINT with correct fields
    console.log('\n📋 Method 3: Testing BOY_85_CUSTOMPRINT with correct structure...');
    
    // Look at the structure of existing BOY_85_CUSTOMPRINT records
    const customPrintResponse = await sap.makeRequest('/b1s/v1/BOY_85_CUSTOMPRINT');
    const existingRecord = customPrintResponse.value[0];
    
    console.log(`📋 Existing BOY_85_CUSTOMPRINT structure:`);
    Object.keys(existingRecord).forEach(key => {
      if (!key.startsWith('BOY_') && key !== 'Object' && key !== 'LogInst') {
        console.log(`   ${key}: ${existingRecord[key]}`);
      }
    });

    // Try to create a custom print based on the structure
    const customPrintData = {
      Code: `WA-${invoice.DocNum}`,
      Name: `WhatsApp Print ${invoice.DocNum}`,
      U_BOY_DTYPE: '00000013', // Invoice type
      U_BOY_RMKS: `WhatsApp PDF for invoice ${invoice.DocNum}`,
      U_BOY_ACTIVE: 'Y',
      U_BOY_SHOWF: 'Y'
    };

    try {
      console.log(`📤 Creating custom print: ${JSON.stringify(customPrintData)}`);
      const printResponse = await sap.makeRequest('/b1s/v1/BOY_85_CUSTOMPRINT', 'POST', customPrintData);
      console.log(`✅ Custom print created! DocEntry: ${printResponse.DocEntry}`);
    } catch (error) {
      console.log(`❌ Method 3 failed: ${error.message}`);
    }

    // Method 4: Look for BOY action/service endpoints
    console.log('\n📋 Method 4: Looking for BOY service endpoints...');
    
    // Check if there are any BOY-related actions in the v2 API
    try {
      const v2Response = await sap.makeRequest('/b1s/v2/$metadata');
      console.log(`📋 v2 API metadata check - looking for BOY actions...`);
      // This would show us if there are any callable actions
    } catch (error) {
      console.log(`❌ v2 metadata check failed: ${error.message}`);
    }

    console.log(`\n💡 Summary:`);
    console.log(`   🎯 Found SHK-001 Crystal Report: "FACTURA VENDEDORES"`);
    console.log(`   📁 File: \\\\hanab1\\B1_SHF\\SHK\\PRINTANDDELIVERY\\Factura.rpt`);
    console.log(`   📋 Parameters: DOCKEY@, OBJECTID@, OINV.DocEntry`);
    console.log(`   🔧 Need to find the correct BOY execution method`);
    
    console.log(`\n🚀 Next steps:`);
    console.log(`   1. Contact SAP admin to confirm BOY framework version`);
    console.log(`   2. Check if there are BOY API endpoints not exposed in Service Layer`);
    console.log(`   3. Consider alternative: Generate simple PDF invoice instead`);

  } catch (error) {
    console.error('\n❌ Error testing BOY framework:', error);
  }
}

testBOYReportExecution().catch(console.error);
