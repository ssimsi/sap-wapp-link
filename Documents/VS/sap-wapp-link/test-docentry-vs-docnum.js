import axios from 'axios';
import https from 'https';

async function testInvoiceReference() {
  const sapConnection = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    }),
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'odata.maxpagesize=0'
    }
  });
  
  const baseURL = 'https://b1.ativy.com:50685/b1s/v1';
  
  try {
    // Fresh login
    console.log('🔗 Fresh login to SAP...');
    const loginResponse = await sapConnection.post(`${baseURL}/Login`, {
      UserName: 'ssimsi',
      Password: 'Sim1234$',
      CompanyDB: 'PRDSHK'
    });
    
    const sessionId = loginResponse.data.SessionId;
    sapConnection.defaults.headers['B1SESSION'] = sessionId;
    console.log('✅ Got session:', sessionId);
    
    // Search for invoice with DocNum 529
    console.log('🔍 Searching for invoice with DocNum 529...');
    
    try {
      const response = await sapConnection.get(`${baseURL}/Invoices?$filter=DocNum eq 529&$select=DocEntry,DocNum,CardName,U_WhatsAppSent`);
      
      if (response.data && response.data.value && response.data.value.length > 0) {
        const invoice = response.data.value[0];
        console.log('✅ Found invoice:');
        console.log('  DocEntry:', invoice.DocEntry);
        console.log('  DocNum:', invoice.DocNum);
        console.log('  CardName:', invoice.CardName);
        console.log('  U_WhatsAppSent:', invoice.U_WhatsAppSent);
        
        // Now try to update using DocEntry instead of DocNum
        console.log(`\n🔍 Trying to update using DocEntry ${invoice.DocEntry}...`);
        const updateResponse = await sapConnection.patch(`${baseURL}/Invoices(${invoice.DocEntry})`, {
          U_WhatsAppSent: 'Y'
        });
        console.log('✅ Successfully updated invoice using DocEntry!');
        console.log('Response status:', updateResponse.status);
        
      } else {
        console.log('❌ No invoice found with DocNum 529');
      }
      
    } catch (error) {
      console.log('❌ Failed:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
    
    // Logout
    await sapConnection.post(`${baseURL}/Logout`);
    console.log('✅ Logged out');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testInvoiceReference().catch(console.error);
