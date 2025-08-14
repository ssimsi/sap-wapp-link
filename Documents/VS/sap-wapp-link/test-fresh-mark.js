import axios from 'axios';
import https from 'https';

async function testFreshLogin() {
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
    console.log('✅ Got session:', sessionId);
    
    // Immediately try to mark invoice 529
    console.log('🔍 Immediately trying to mark invoice 529...');
    
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
      console.log('Response:', response.status);
    } catch (error) {
      console.log('❌ Failed to mark invoice 529:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
    
    // Also try invoice 1453
    console.log('\n🔍 Trying invoice 1453...');
    try {
      const response = await sapConnection.patch(`${baseURL}/Invoices(1453)`, 
        { U_WhatsAppSent: 'Y' },
        { 
          headers: { 
            'B1SESSION': sessionId,
            'Content-Type': 'application/json'
          } 
        }
      );
      console.log('✅ Successfully marked invoice 1453');
      console.log('Response:', response.status);
    } catch (error) {
      console.log('❌ Failed to mark invoice 1453:');
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

testFreshLogin().catch(console.error);
