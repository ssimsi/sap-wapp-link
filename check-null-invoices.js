import axios from 'axios';
import https from 'https';

async function checkNullInvoices() {
  // Create axios instance
  const sapConnection = axios.create({
    baseURL: 'https://b1.ativy.com:50685/b1s/v1',
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  });

  try {
    // First, login to get session
    console.log('🔐 Logging into SAP...');
    const loginResponse = await sapConnection.post('/Login', {
      CompanyDB: 'PRDSHK',
      UserName: 'ssimsi',
      Password: 'Sim1234$'
    });

    console.log('✅ SAP login successful');
    
    // Set session cookie for subsequent requests
    const sessionId = loginResponse.data.SessionId;
    sapConnection.defaults.headers.Cookie = `B1SESSION=${sessionId}`;
    
    // Now query for invoices
    console.log('🔍 Querying SAP for invoices with U_EmailSent as null from September 22nd onwards...');
    
    const filter = "(U_EmailSent eq null) and DocDate ge '2025-09-22'";
    const select = 'DocNum,DocDate,CardCode,CardName,FolioNumberFrom,U_EmailSent,Series,Cancelled,DocumentStatus';
    const orderby = 'DocDate desc';
    
    const response = await sapConnection.get(`/Invoices?$filter=${encodeURIComponent(filter)}&$select=${select}&$orderby=${encodeURIComponent(orderby)}`, {
      headers: {
        'Prefer': 'odata.maxpagesize=0'
      }
    });
    
    const invoices = response.data.value;
    
    console.log(`\n📊 Found ${invoices.length} invoices with U_EmailSent as null:\n`);
    
    if (invoices.length === 0) {
      console.log('✅ All invoices from September 22nd onwards have been marked as email sent!');
      return;
    }
    
    console.log('Invoice#    | Date       | Customer Code | Customer Name                    | Series | FolioNumber | Status');
    console.log('------------|------------|---------------|----------------------------------|--------|-------------|--------');
    
    let cancelledCount = 0;
    
    invoices.forEach(inv => {
      const docNum = String(inv.DocNum).padEnd(10);
      const docDate = inv.DocDate.substring(0, 10);
      const cardCode = String(inv.CardCode || '').padEnd(13);
      const cardName = String(inv.CardName || '').substring(0, 32).padEnd(32);
      const series = String(inv.Series || '').padEnd(6);
      const folioNum = String(inv.FolioNumberFrom || 'N/A').padEnd(11);
      const isCancelled = inv.Cancelled === 'tYES' || inv.DocumentStatus === 'bost_Cancelled';
      const status = isCancelled ? '❌ CANCELLED' : '✅ Active';
      
      if (isCancelled) cancelledCount++;
      
      console.log(`${docNum} | ${docDate} | ${cardCode} | ${cardName} | ${series} | ${folioNum} | ${status}`);
    });
    
    if (cancelledCount > 0) {
      console.log(`\n⚠️  Found ${cancelledCount} cancelled invoices that should be marked as email sent to avoid reprocessing!`);
    }
    
    console.log(`\n📋 Total: ${invoices.length} invoices pending email processing`);
    
  } catch (error) {
    console.error('❌ Error querying SAP:', error.response?.data || error.message);
  }
}

checkNullInvoices();