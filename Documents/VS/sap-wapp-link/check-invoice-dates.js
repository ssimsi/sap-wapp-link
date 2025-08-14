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

async function checkInvoiceDateRanges() {
  console.log('📅 Checking invoice date ranges in production database...');
  
  const sap = new SAPConnection();
  
  try {
    // Login to SAP
    console.log('\n🔐 Logging into SAP...');
    const loginSuccess = await sap.login();
    if (!loginSuccess) {
      console.error('❌ Could not connect to SAP. Exiting.');
      return;
    }

    // Get min and max dates
    console.log('\n📊 Finding date range of all invoices...');
    
    const dateRangeQuery = `/b1s/v1/Invoices?$top=0&$select=DocDate&$orderby=DocDate`;
    
    const invoicesResponse = await sap.makeRequest(dateRangeQuery);
    const invoices = invoicesResponse.value || [];
    
    console.log(`\n📋 Found ${invoices.length} total invoices in production database`);
    
    if (invoices.length === 0) {
      console.log('ℹ️ No invoices found in the production database.');
      return;
    }

    // Get sorted dates
    const dates = invoices.map(inv => inv.DocDate).sort();
    const earliestDate = dates[0];
    const latestDate = dates[dates.length - 1];
    
    console.log(`\n📅 Invoice date range:`);
    console.log(`   📍 Earliest invoice: ${earliestDate}`);
    console.log(`   📍 Latest invoice: ${latestDate}`);
    
    // Get monthly breakdown for 2024
    console.log(`\n📈 2024 Monthly breakdown:`);
    
    const months = [
      '2024-01', '2024-02', '2024-03', '2024-04', 
      '2024-05', '2024-06', '2024-07', '2024-08', 
      '2024-09', '2024-10', '2024-11', '2024-12'
    ];
    
    for (const month of months) {
      const startDate = `${month}-01`;
      const endDate = month === '2024-02' ? '2024-02-29' : 
                     ['2024-04', '2024-06', '2024-09', '2024-11'].includes(month) ? `${month}-30` : `${month}-31`;
      
      const filter = encodeURIComponent(`DocDate ge '${startDate}' and DocDate le '${endDate}'`);
      const monthQuery = `/b1s/v1/Invoices/$count?$filter=${filter}`;
      
      try {
        const count = await sap.makeRequest(monthQuery);
        if (count > 0) {
          console.log(`   📅 ${month}: ${count} invoices`);
        }
      } catch (error) {
        // Skip month if query fails
      }
    }
    
    // Get recent invoices (last 30 days)
    console.log(`\n🕒 Recent invoices (last 30 days):`);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    const recentFilter = encodeURIComponent(`DocDate ge '${recentDate}'`);
    const recentSelect = encodeURIComponent("DocEntry,DocNum,DocDate,CardName,U_WhatsAppSent");
    const recentQuery = `/b1s/v1/Invoices?$filter=${recentFilter}&$select=${recentSelect}&$top=10&$orderby=DocDate desc`;
    
    try {
      const recentResponse = await sap.makeRequest(recentQuery);
      const recentInvoices = recentResponse.value || [];
      
      console.log(`   📋 Found ${recentInvoices.length} invoices in last 30 days:`);
      
      recentInvoices.forEach(inv => {
        const whatsappStatus = inv.U_WhatsAppSent === 'Y' ? '✅ Sent' : '⚪ Not sent';
        console.log(`      ${inv.DocDate} | ${inv.DocNum} | ${inv.CardName} | ${whatsappStatus}`);
      });
      
    } catch (error) {
      console.log(`   ⚠️ Could not fetch recent invoices: ${error.message}`);
    }

  } catch (error) {
    console.error('\n❌ Error during date range check:', error);
  } finally {
    await sap.logout();
  }
}

// Run the date range check
checkInvoiceDateRanges().catch(console.error);
