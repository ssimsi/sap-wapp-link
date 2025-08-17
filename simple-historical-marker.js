// Simple script to find and mark historical invoices as sent
// Uses just the SAP connection without WhatsApp dependencies

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
      timeout: 30000,
      headers: {
        'Prefer': 'odata.maxpagesize=0'  // Get all results without pagination
      }
    });
  }

  async login() {
    try {
      console.log('🔗 Connecting to SAP (b1.ativy.com:50685)...');
      const response = await this.axios.post('/Login', {
        CompanyDB: "PRDSHK",
        UserName: "ssimsi", 
        Password: "Sim1234$"
      });

      this.sessionId = response.data.SessionId;
      this.axios.defaults.headers.common['Cookie'] = `B1SESSION=${this.sessionId}`;
      
      console.log('✅ SAP connection successful');
      return true;
    } catch (error) {
      console.error('❌ SAP login failed:', error.response?.data?.error?.message || error.message);
      return false;
    }
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      const config = {
        method,
        url: endpoint
      };
      
      if (data) {
        config.data = data;
      }

      const response = await this.axios(config);
      return response;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('🔄 Session expired, reconnecting...');
        await this.login();
        return this.makeRequest(method, endpoint, data);
      }
      throw error;
    }
  }

  async disconnect() {
    if (this.sessionId) {
      try {
        await this.axios.post('/Logout');
        console.log('✅ SAP disconnected');
      } catch (error) {
        console.log('⚠️ SAP disconnect warning:', error.message);
      }
    }
  }
}

class HistoricalInvoiceMarker {
  constructor() {
    this.sapConnection = new SimpleSAPConnection();
  }

  async findQ42425Invoices() {
    try {
      console.log('🔍 Searching for Q4 2024 and all 2025 invoices...');
      
      // Login to SAP
      const connected = await this.sapConnection.login();
      if (!connected) {
        throw new Error('Failed to connect to SAP');
      }
      
      // Search specifically for Q4 2024 and all 2025 invoices
      console.log('🔄 Searching for ALL Q4 2024 and 2025 invoices (no pagination limit)...');
      
      const params = new URLSearchParams({
        $filter: "DocDate ge '2024-10-01' and DocDate le '2025-12-31'",
        $select: 'DocEntry,DocNum,DocDate,CardName,DocTotal,Series,U_WhatsAppSent',
        $orderby: 'DocDate desc'
        // No $top limit - using odata.maxpagesize=0 header to get all results
      });
      
      const response = await this.sapConnection.makeRequest('GET', `/Invoices?${params}`);
      
      if (!response.data || !response.data.value || response.data.value.length === 0) {
        console.log('❌ No Q4 2024 and 2025 invoices found');
        return [];
      }
      
      const invoices = response.data.value;
      console.log(`✅ Found ${invoices.length} invoices from Q4 2024 and all 2025`);
      
      console.log('\n📋 Q4 2024 and 2025 invoices found:');
      invoices.forEach(invoice => {
        const whatsappStatus = invoice.U_WhatsAppSent || 'Not set';
        console.log(`  📄 DocNum: ${invoice.DocNum}, Date: ${invoice.DocDate}, Customer: ${invoice.CardName.substring(0, 25)}..., WhatsApp: ${whatsappStatus}`);
      });
      
      return invoices;
      
    } catch (error) {
      console.error('❌ Error finding invoices:', error.response?.data?.error?.message || error.message);
      throw error;
    }
  }

  async markInvoicesAsSent(invoices, dryRun = false) {
    console.log(`\n${dryRun ? '🔍 DRY RUN - ' : '🔄 '}Marking ${invoices.length} invoices as sent...`);
    
    let successCount = 0;
    let errorCount = 0;
    let alreadyMarked = 0;
    
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      
      // Re-login every 20 invoices to prevent session timeout
      if (i > 0 && i % 20 === 0) {
        console.log(`🔄 Re-authenticating after ${i} invoices...`);
        await this.sapConnection.login();
      }
      
      try {
        // Check if already marked
        if (invoice.U_WhatsAppSent === 'Y') {
          console.log(`ℹ️  Invoice ${invoice.DocNum} already marked as sent`);
          alreadyMarked++;
          continue;
        }
        
        if (dryRun) {
          console.log(`🔍 WOULD MARK invoice ${invoice.DocNum} as sent (Customer: ${invoice.CardName})`);
          successCount++;
        } else {
          // Update the U_WhatsAppSent field
          await this.sapConnection.makeRequest('PATCH', `/Invoices(${invoice.DocEntry})`, {
              U_WhatsAppSent: 'Y'
            });
          console.log(`✅ Marked invoice ${invoice.DocNum} as sent (Customer: ${invoice.CardName})`);
          successCount++;
        }
        
        // Small delay to avoid overwhelming SAP
        if (!dryRun) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        // If it's a session timeout, try to re-login and retry once
        if (error.response?.status === 401) {
          console.log(`🔄 Session timeout, re-authenticating for invoice ${invoice.DocNum}...`);
          try {
            await this.sapConnection.login();
            if (!dryRun) {
              await this.sapConnection.makeRequest('PATCH', `/Invoices(${invoice.DocEntry})`, {
                U_WhatsAppSent: 'Y'
              });
              console.log(`✅ Marked invoice ${invoice.DocNum} as sent (Customer: ${invoice.CardName}) after re-auth`);
              successCount++;
            } else {
              console.log(`🔍 WOULD MARK invoice ${invoice.DocNum} as sent (Customer: ${invoice.CardName}) after re-auth`);
              successCount++;
            }
          } catch (retryError) {
            console.log(`❌ Failed to mark invoice ${invoice.DocNum} even after re-auth: ${retryError.response?.data?.error?.message || retryError.message}`);
            errorCount++;
          }
        } else {
          console.log(`❌ Failed to mark invoice ${invoice.DocNum}: ${error.response?.data?.error?.message || error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`${dryRun ? '🔍 Would mark' : '✅ Successfully marked'}: ${successCount} invoices`);
    console.log(`ℹ️  Already marked: ${alreadyMarked} invoices`);
    console.log(`❌ Failed to mark: ${errorCount} invoices`);
    
    return { successCount, errorCount, alreadyMarked };
  }

  async run() {
    try {
      console.log('🚀 Starting historical invoice marking process...\n');
      
      // Find Q4 2024 and all 2025 invoices
      const invoices = await this.findQ42425Invoices();
      
      if (invoices.length === 0) {
        console.log('📝 No invoices found to mark.');
        return;
      }
      
      console.log(`\n⚠️  Found ${invoices.length} invoices that could be marked as sent.`);
      console.log('   This will prevent the system from sending WhatsApp messages for these invoices.');
      
      // Actually mark them as sent
      console.log('\n🔄 Marking invoices as sent...');
      await this.markInvoicesAsSent(invoices, false);
      
    } catch (error) {
      console.error('💥 Process failed:', error.message);
    } finally {
      // Disconnect from SAP
      try {
        await this.sapConnection.disconnect();
      } catch (error) {
        console.log('⚠️ SAP disconnect warning:', error.message);
      }
    }
  }
}

// Run the script
const marker = new HistoricalInvoiceMarker();
marker.run();
