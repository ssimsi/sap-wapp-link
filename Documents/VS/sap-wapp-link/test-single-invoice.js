import axios from 'axios';
import https from 'https';

class SimpleSAPConnection {
  constructor() {
    this.baseURL = 'https://b1.ativy.com:50685/b1s/v1';
    this.sessionId = null;
    this.axios = axios.create({
      baseURL: this.baseURL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      timeout: 30000
    });
  }

  async login() {
    try {
      console.log('🔗 Connecting to SAP...');
      const response = await this.axios.post('/Login', {
        CompanyDB: "PRDSHK",
        UserName: "ssimsi", 
        Password: "Sim1234$"
      });
      this.sessionId = response.data.SessionId;
      this.axios.defaults.headers.common['Cookie'] = `B1SESSION=${this.sessionId}`;
      console.log('✅ Connected');
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    const config = { method, url: endpoint };
    if (data) config.data = data;
    const response = await this.axios(config);
    return response.data;
  }

  async logout() {
    try {
      if (this.sessionId) {
        await this.axios.post('/Logout');
        console.log('✅ Disconnected');
      }
    } catch (error) {
      console.error('⚠️ Logout error:', error.message);
    }
  }
}

async function testInvoice9008425() {
  const sap = new SimpleSAPConnection();
  
  try {
    const connected = await sap.login();
    if (!connected) return;

    console.log('📄 Looking for invoice 9008425...');
    
    // Get invoice data
    const invoiceQuery = `Invoices?$filter=DocNum eq 9008425&$select=DocEntry,DocNum,DocDate,DocTotal,CardCode,CardName,SalesPersonCode`;
    const invoiceResponse = await sap.makeRequest('GET', invoiceQuery);
    
    if (!invoiceResponse.value || invoiceResponse.value.length === 0) {
      console.log('❌ Invoice 9008425 not found');
      return;
    }

    const invoice = invoiceResponse.value[0];
    console.log('✅ Invoice 9008425 found:');
    console.log(`   Customer: ${invoice.CardName}`);
    console.log(`   Date: ${invoice.DocDate}`);
    console.log(`   Total: $${invoice.DocTotal}`);
    console.log(`   SalesPersonCode: ${invoice.SalesPersonCode || 'NOT SET'}`);
    
    // Get customer details
    console.log('👤 Getting customer contact details...');
    const customerResponse = await sap.makeRequest('GET', `BusinessPartners('${invoice.CardCode}')`);
    
    console.log('📧 Customer contact info:');
    console.log(`   Email: ${customerResponse.EmailAddress || 'NOT SET'}`);
    console.log(`   Cellular: ${customerResponse.Cellular || 'NOT SET'}`);
    console.log(`   Phone1: ${customerResponse.Phone1 || 'NOT SET'}`);
    
    await sap.logout();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sap.logout();
  }
}

testInvoice9008425();
