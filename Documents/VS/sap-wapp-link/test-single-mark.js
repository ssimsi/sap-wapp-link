import axios from 'axios';
import https from 'https';

// Simple SAP Connection class
class SimpleSAPConnection {
  constructor() {
    this.sessionId = null;
    this.baseURL = 'https://b1.ativy.com:50685/b1s/v1';
    this.username = 'ssimsi';
    this.password = 'Sim1234$';
    this.companyDB = 'PRDSHK';
    
    // Configure axios with certificate rejection disabled and OData headers
    this.sapConnection = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'odata.maxpagesize=0'
      }
    });
  }

  async login() {
    try {
      console.log('🔗 Connecting to SAP (b1.ativy.com:50685)...');
      const response = await this.sapConnection.post(`${this.baseURL}/Login`, {
        UserName: this.username,
        Password: this.password,
        CompanyDB: this.companyDB
      });
      
      this.sessionId = response.data.SessionId;
      this.sapConnection.defaults.headers['B1SESSION'] = this.sessionId;
      console.log('✅ SAP connection successful');
      return true;
    } catch (error) {
      console.error('❌ SAP login failed:', error.response?.data || error.message);
      return false;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: this.sapConnection.defaults.headers
      };
      
      if (data) {
        config.data = data;
      }
      
      return await this.sapConnection(config);
    } catch (error) {
      throw error;
    }
  }

  async disconnect() {
    if (this.sessionId) {
      try {
        await this.sapConnection.post(`${this.baseURL}/Logout`);
        console.log('✅ SAP disconnected');
      } catch (error) {
        console.log('⚠️ SAP disconnect warning:', error.message);
      }
    }
  }
}

async function testSingleInvoice() {
  const sap = new SimpleSAPConnection();
  
  try {
    await sap.login();
    
    // Try to mark invoice 529 which failed
    console.log('🔍 Testing marking invoice 529...');
    
    try {
      const response = await sap.makeRequest('PATCH', '/Invoices(529)', {
        U_WhatsAppSent: 'Y'
      });
      console.log('✅ Successfully marked invoice 529');
    } catch (error) {
      console.log('❌ Failed to mark invoice 529:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Message:', error.message);
    }
    
    // Also try one that worked - invoice 1453
    console.log('\n🔍 Testing marking invoice 1453 (which worked before)...');
    
    try {
      const response = await sap.makeRequest('PATCH', '/Invoices(1453)', {
        U_WhatsAppSent: 'Y'
      });
      console.log('✅ Successfully marked invoice 1453');
    } catch (error) {
      console.log('❌ Failed to mark invoice 1453:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Message:', error.message);
    }
    
  } finally {
    await sap.disconnect();
  }
}

testSingleInvoice().catch(console.error);
