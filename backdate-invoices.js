import https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  baseUrl: 'https://b1.ativy.com:50685/b1s/v1',
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

  async logout() {
    try {
      await this.makeRequest('/b1s/v1/Logout', 'POST');
      console.log('✅ SAP logout successful');
    } catch (error) {
      console.log('⚠️ SAP logout warning:', error.message);
    }
  }
}

async function backdateInvoices() {
  console.log('📅 Starting invoice backdating process...');
  console.log('🎯 Target period: January 1, 2024 to July 31, 2024');
  
  const sap = new SAPConnection();
  
  try {
    // Login to SAP
    console.log('\n🔐 Logging into SAP...');
    const loginSuccess = await sap.login();
    if (!loginSuccess) {
      console.error('❌ Could not connect to SAP. Exiting.');
      return;
    }

    // Get invoices from the specified period
    console.log('\n📋 Fetching invoices from January 1, 2024 to July 31, 2024...');
    
    const filter = encodeURIComponent("DocDate ge '2024-01-01' and DocDate le '2024-07-31'");
    const select = encodeURIComponent("DocEntry,DocNum,DocDate,CardName,U_WhatsAppSent");
    const invoiceQuery = `/b1s/v1/Invoices?$filter=${filter}&$top=0&$select=${select}`;
    
    const invoicesResponse = await sap.makeRequest(invoiceQuery);
    const invoices = invoicesResponse.value || [];
    
    console.log(`\n📊 Found ${invoices.length} invoices in the target period`);
    
    if (invoices.length === 0) {
      console.log('ℹ️ No invoices found in the specified period. Nothing to backdate.');
      return;
    }

    // Show some statistics
    const alreadyMarked = invoices.filter(inv => inv.U_WhatsAppSent === 'Y').length;
    const needsMarking = invoices.length - alreadyMarked;
    
    console.log(`📈 Statistics:`);
    console.log(`   Total invoices: ${invoices.length}`);
    console.log(`   Already marked as sent: ${alreadyMarked}`);
    console.log(`   Need to be marked: ${needsMarking}`);
    
    if (needsMarking === 0) {
      console.log('✅ All invoices are already marked as WhatsApp sent!');
      return;
    }

    console.log(`\n🚀 Starting to mark ${needsMarking} invoices as WhatsApp sent...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process invoices in batches
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      
      // Skip if already marked
      if (invoice.U_WhatsAppSent === 'Y') {
        continue;
      }
      
      try {
        const updateData = {
          U_WhatsAppSent: 'Y',
          U_WhatsAppDate: '2024-07-31', // Mark as sent on the last day of the period
          U_WhatsAppPhone: 'BACKDATED'
        };
        
        await sap.makeRequest(`/b1s/v1/Invoices(${invoice.DocEntry})`, 'PATCH', updateData);
        
        successCount++;
        
        // Progress indicator
        if (successCount % 10 === 0 || successCount === needsMarking) {
          console.log(`   ✅ Processed ${successCount}/${needsMarking} invoices...`);
        }
        
      } catch (error) {
        errorCount++;
        console.log(`   ❌ Error updating invoice ${invoice.DocNum}: ${error.message || JSON.stringify(error)}`);
      }
      
      // Small delay to avoid overwhelming SAP
      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n📊 Backdating completed!`);
    console.log(`   ✅ Successfully marked: ${successCount} invoices`);
    console.log(`   ❌ Failed: ${errorCount} invoices`);
    console.log(`   📅 All marked invoices show as sent on: 2024-07-31`);
    console.log(`   🏷️ Phone field marked as: BACKDATED`);
    
    if (successCount > 0) {
      console.log(`\n🎉 Backdating successful! Your WhatsApp system will now only process new invoices.`);
    }

  } catch (error) {
    console.error('\n❌ Error during backdating process:', error);
  } finally {
    await sap.logout();
  }
}

// Run the backdating process
backdateInvoices().catch(console.error);
