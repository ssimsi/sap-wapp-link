import axios from 'axios';
import https from 'https';

async function testSessionAndRead() {
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
    console.log('✅ Got session:', sessionId);
    
    // Try to READ invoice 529 first
    console.log('🔍 Reading invoice 529...');
    
    try {
      const response = await sapConnection.get(`${baseURL}/Invoices(529)`, {
        headers: { 
          'B1SESSION': sessionId,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Successfully read invoice 529');
      console.log('Current U_WhatsAppSent:', response.data.U_WhatsAppSent);
      console.log('DocNum:', response.data.DocNum);
      console.log('CardName:', response.data.CardName);
    } catch (error) {
      console.log('❌ Failed to read invoice 529:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
    
    // Now try the PATCH
    console.log('\n🔍 Now trying PATCH on invoice 529...');
    try {
      const response = await sapConnection.patch(`${baseURL}/Invoices(529)`, 
        { U_WhatsAppSent: 'Y' },
        { 
          headers: { 
            'B1SESSION': sessionId,
            'Content-Type': 'application/json'
          } 
        }
      );
      console.log('✅ Successfully marked invoice 529');
      console.log('Response status:', response.status);
    } catch (error) {
      console.log('❌ Failed to PATCH invoice 529:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
    
    // Logout
    await sapConnection.post(`${baseURL}/Logout`, {}, {
      headers: { 'B1SESSION': sessionId }
    });
    console.log('✅ Logged out');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testSessionAndRead().catch(console.error);
