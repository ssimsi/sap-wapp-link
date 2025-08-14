import https from 'https';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
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
          'Accept': method === 'GET' && path.includes('/$value') ? 'application/octet-stream' : 'application/json',
          'Cookie': this.cookies ? this.cookies.join('; ') : ''
        },
        rejectUnauthorized: false,
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              // If requesting binary data
              if (path.includes('/$value') || res.headers['content-type']?.includes('application/octet-stream') || res.headers['content-type']?.includes('application/pdf')) {
                resolve(buffer);
              } else {
                // JSON response
                const data = JSON.parse(buffer.toString());
                resolve(data);
              }
            } else {
              console.error(`❌ Request failed (${res.statusCode}):`, buffer.toString());
              reject(new Error(`HTTP ${res.statusCode}: ${buffer.toString()}`));
            }
          } catch (error) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(buffer.toString());
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
}

async function checkReportResults() {
  console.log('🔍 Checking BOY Report Results and Looking for Generated PDFs...');
  
  const sap = new SAPConnection();
  
  try {
    const loginSuccess = await sap.login();
    if (!loginSuccess) {
      console.error('❌ Could not connect to SAP. Exiting.');
      return;
    }

    // Check the report configuration we created (DocEntry 72)
    console.log('\n📋 Checking our created report configuration (DocEntry 72)...');
    try {
      const reportConfig = await sap.makeRequest('/b1s/v1/BOY_85_REPORTCONFIG(72)');
      console.log('📄 Report Config 72 details:');
      console.log(`   Description: ${reportConfig.U_BOY_DESC}`);
      console.log(`   Active: ${reportConfig.U_BOY_ACTIVE}`);
      console.log(`   Status: ${reportConfig.U_BOY_STATUS || 'Not set'}`);
      console.log(`   Last Run: ${reportConfig.U_BOY_LASTRUN || 'Never'}`);
      
      if (reportConfig.BOY_85_REP_CONFIGLCollection) {
        console.log('📋 Report Details:');
        reportConfig.BOY_85_REP_CONFIGLCollection.forEach(detail => {
          console.log(`   Crystal: ${detail.U_BOY_CRYSTAL}`);
          console.log(`   PDF: ${detail.U_BOY_PDF}`);
          console.log(`   Email: ${detail.U_BOY_EMAIL}`);
        });
      }
      
    } catch (error) {
      console.log(`❌ Could not fetch report config 72: ${error.message}`);
    }

    // Check if any files were generated in BOY_85_ATTACHMENTS
    console.log('\n📁 Checking BOY Attachments for generated files...');
    try {
      const attachments = await sap.makeRequest('/b1s/v1/BOY_85_ATTACHMENTS?$orderby=DocEntry%20desc&$top=10');
      
      if (attachments.value && attachments.value.length > 0) {
        console.log(`📎 Found ${attachments.value.length} recent attachments:`);
        
        for (const attachment of attachments.value) {
          console.log(`\n📄 Attachment ${attachment.DocEntry}:`);
          console.log(`   Name: ${attachment.U_BOY_FNAME}`);
          console.log(`   Type: ${attachment.U_BOY_FTYPE}`);
          console.log(`   Size: ${attachment.U_BOY_FSIZE} bytes`);
          console.log(`   Created: ${attachment.CreateDate}`);
          console.log(`   Category: ${attachment.U_BOY_CATEGORY}`);
          
          // If it's a PDF and recent, try to download it
          if (attachment.U_BOY_FTYPE === 'PDF' && attachment.U_BOY_FSIZE > 0) {
            try {
              console.log(`   🔍 Attempting to download PDF...`);
              
              // Try different download methods
              const downloadMethods = [
                `/BOY_85_ATTACHMENTS(${attachment.DocEntry})/U_BOY_FDATA/$value`,
                `/BOY_85_ATTACHMENTS(${attachment.DocEntry})/AttachmentEntry`,
                `/Attachments2(${attachment.U_BOY_FREF})`
              ];
              
              for (const method of downloadMethods) {
                try {
                  console.log(`      Testing: ${method}`);
                  const pdfData = await sap.makeRequest(method);
                  
                  if (pdfData && pdfData.length > 0) {
                    const filename = `./downloaded_${attachment.DocEntry}_${attachment.U_BOY_FNAME}`;
                    fs.writeFileSync(filename, pdfData);
                    console.log(`   ✅ PDF downloaded successfully! File: ${filename} (${pdfData.length} bytes)`);
                    
                    // Check if it's actually a PDF
                    const header = pdfData.slice(0, 4).toString();
                    if (header === '%PDF') {
                      console.log(`   📄 Confirmed: Valid PDF file!`);
                    } else {
                      console.log(`   ⚠️ Warning: File doesn't appear to be a PDF (header: ${header})`);
                    }
                    break;
                  }
                } catch (downloadError) {
                  console.log(`      ❌ Method failed: ${downloadError.message}`);
                }
              }
              
            } catch (downloadError) {
              console.log(`   ❌ Could not download attachment: ${downloadError.message}`);
            }
          }
        }
      } else {
        console.log('📁 No attachments found in BOY_85_ATTACHMENTS');
      }
      
    } catch (error) {
      console.log(`❌ Could not fetch BOY attachments: ${error.message}`);
    }

    // Check BOY_85_REPORTLOG for execution logs
    console.log('\n📊 Checking BOY Report Execution Logs...');
    try {
      const logs = await sap.makeRequest('/b1s/v1/BOY_85_REPORTLOG?$orderby=DocEntry%20desc&$top=5');
      
      if (logs.value && logs.value.length > 0) {
        console.log(`📋 Found ${logs.value.length} recent report executions:`);
        
        logs.value.forEach(log => {
          console.log(`\n📄 Execution ${log.DocEntry}:`);
          console.log(`   Report: ${log.U_BOY_REPORT}`);
          console.log(`   Status: ${log.U_BOY_STATUS}`);
          console.log(`   Date: ${log.U_BOY_DATE}`);
          console.log(`   Time: ${log.U_BOY_TIME}`);
          console.log(`   Error: ${log.U_BOY_ERROR || 'None'}`);
          console.log(`   File: ${log.U_BOY_FILE || 'None'}`);
        });
      } else {
        console.log('📋 No report execution logs found');
      }
      
    } catch (error) {
      console.log(`❌ Could not fetch report logs: ${error.message}`);
    }

  } catch (error) {
    console.error('\n❌ Error checking report results:', error);
  }
}

checkReportResults().catch(console.error);
