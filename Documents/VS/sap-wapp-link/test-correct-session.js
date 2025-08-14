import axios from 'axios';
import https from 'https';

async function testCorrectSession() {
  const sapConnection = axios.create({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    }),
    headers: {
      'Content-Type': 'application/json'
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
    
    // Set cookie correctly
    sapConnection.defaults.headers.common['Cookie'] = `B1SESSION=${sessionId}`;
    console.log('✅ Got session and set cookie:', sessionId);
    
    // Try to search for invoice 529 to get its DocEntry
    console.log('🔍 Searching for invoice with DocNum 529...');
    
    const searchResponse = await sapConnection.get(`${baseURL}/Invoices?$filter=DocNum eq 529&$select=DocEntry,DocNum,CardName,U_WhatsAppSent`);
    
    if (searchResponse.data && searchResponse.data.value && searchResponse.data.value.length > 0) {
      const invoice = searchResponse.data.value[0];
      console.log('✅ Found invoice:');
      console.log('  DocEntry:', invoice.DocEntry);
      console.log('  DocNum:', invoice.DocNum);
      console.log('  CardName:', invoice.CardName);
      console.log('  U_WhatsAppSent:', invoice.U_WhatsAppSent);
      
      // Now try to update using DocEntry
      console.log(`\n🔍 Trying to update using DocEntry ${invoice.DocEntry}...`);
      const updateResponse = await sapConnection.patch(`${baseURL}/Invoices(${invoice.DocEntry})`, {
        U_WhatsAppSent: 'Y'
      });
      console.log('✅ Successfully updated invoice using DocEntry!');
      console.log('Response status:', updateResponse.status);
      
    } else {
      console.log('❌ No invoice found with DocNum 529');
    }
    
    // Logout
    await sapConnection.post(`${baseURL}/Logout`);
    console.log('✅ Logged out');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
  }
}

testCorrectSession().catch(console.error);
