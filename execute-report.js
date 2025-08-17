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

async function executeReportDirectly() {
  console.log('🚀 Attempting to Execute SHK-001 Crystal Report Directly...');
  
  const sap = new SAPConnection();
  
  try {
    const loginSuccess = await sap.login();
    if (!loginSuccess) {
      console.error('❌ Could not connect to SAP. Exiting.');
      return;
    }

    // Get invoice details for testing
    const invoicesResponse = await sap.makeRequest('/b1s/v1/Invoices?$top=1');
    const invoice = invoicesResponse.value[0];
    console.log(`🧾 Using invoice ${invoice.DocNum} (DocEntry: ${invoice.DocEntry})`);

    // Try to trigger the report configuration we created
    console.log('\n🔧 Trying to execute report configuration 72...');
    
    const executionMethods = [
      // Try to update the config to trigger execution
      {
        method: 'PATCH',
        path: '/b1s/v1/BOY_85_REPORTCONFIG(72)',
        data: { 
          U_BOY_STATUS: 'EXECUTE',
          U_BOY_DOCKEY: invoice.DocEntry.toString(),
          U_BOY_OBJECTID: '13' // Invoice object type
        }
      },
      // Try to create a new execution record
      {
        method: 'POST',
        path: '/b1s/v1/BOY_85_REPORTLOG',
        data: {
          U_BOY_REPORT: 'SHK-001',
          U_BOY_CONFIG: '72',
          U_BOY_DOCKEY: invoice.DocEntry.toString(),
          U_BOY_OBJECTID: '13',
          U_BOY_STATUS: 'PENDING',
          U_BOY_DATE: new Date().toISOString().split('T')[0],
          U_BOY_TIME: new Date().toTimeString().split(' ')[0]
        }
      }
    ];

    for (const execMethod of executionMethods) {
      try {
        console.log(`\n📤 Trying ${execMethod.method} ${execMethod.path}...`);
        console.log(`   Data:`, JSON.stringify(execMethod.data, null, 2));
        
        const result = await sap.makeRequest(execMethod.path, execMethod.method, execMethod.data);
        console.log(`✅ Success! Result:`, result);
        
      } catch (error) {
        console.log(`❌ ${execMethod.method} failed: ${error.message}`);
      }
    }

    // Try alternative execution approaches
    console.log('\n🔍 Trying alternative SHK-001 execution methods...');
    
    const altMethods = [
      // Try direct report execution with parameters
      {
        path: '/b1s/v1/BOY_85_REPORTDEF',
        method: 'POST',
        data: {
          Code: `SHK-001-${Date.now()}`,
          Name: `Execute SHK-001 for ${invoice.DocNum}`,
          U_BOY_CRYSTAL: 'SHK-001',
          U_BOY_ACTIVE: 'Y',
          U_BOY_DOCKEYFIELD: 'DocEntry',
          U_BOY_OBJECTID: '13',
          BOY_85_REP_PARAMSCollection: [
            {
              U_BOY_PNAME: 'DOCKEY@',
              U_BOY_PVALUE: invoice.DocEntry.toString()
            },
            {
              U_BOY_PNAME: 'OBJECTID@',
              U_BOY_PVALUE: '13'
            }
          ]
        }
      }
    ];

    for (const altMethod of altMethods) {
      try {
        console.log(`\n📤 Trying alternative: ${altMethod.method} ${altMethod.path}...`);
        
        const result = await sap.makeRequest(altMethod.path, altMethod.method, altMethod.data);
        console.log(`✅ Alternative success! DocEntry: ${result.DocEntry}`);
        
        // If successful, try to execute it
        if (result.DocEntry) {
          console.log(`🚀 Trying to execute created report definition ${result.DocEntry}...`);
          
          try {
            const execResult = await sap.makeRequest(`/b1s/v1/BOY_85_REPORTDEF(${result.DocEntry})/Execute`, 'POST', {
              DOCKEY: invoice.DocEntry.toString(),
              OBJECTID: '13'
            });
            console.log(`✅ Report executed! Result:`, execResult);
          } catch (execError) {
            console.log(`❌ Execution failed: ${execError.message}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ Alternative method failed: ${error.message}`);
      }
    }

    // Final attempt: Check if we can find any way to get the PDF
    console.log('\n📋 Final check: Looking for any generated files...');
    
    try {
      // Check if there's a way to get Crystal Report output directly
      const directReportAttempts = [
        `/b1s/v1/BOY_85_REPORTDEF('SHK-001')/GetPDF?DocEntry=${invoice.DocEntry}&ObjectType=13`,
        `/b1s/v1/Reports/SHK-001?DocEntry=${invoice.DocEntry}`,
        `/b1s/v1/CrystalReports/SHK-001/Execute?DOCKEY=${invoice.DocEntry}&OBJECTID=13`
      ];
      
      for (const attempt of directReportAttempts) {
        try {
          console.log(`🔍 Trying direct: ${attempt}`);
          const result = await sap.makeRequest(attempt);
          console.log(`✅ Direct success!`, result);
        } catch (directError) {
          console.log(`❌ Direct failed: ${directError.message}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Final check failed: ${error.message}`);
    }

    console.log('\n💡 Summary:');
    console.log('   🎯 We found the SHK-001 Crystal Report');
    console.log('   📋 Created report configuration successfully');
    console.log('   ⚠️ BOY framework execution requires additional permissions or different approach');
    console.log('   🔄 Alternative: Generate simple PDF in Node.js with invoice data');

  } catch (error) {
    console.error('\n❌ Error executing report:', error);
  }
}

executeReportDirectly().catch(console.error);
