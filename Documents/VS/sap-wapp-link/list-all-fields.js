import https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  database: process.env.VITE_SAP_DATABASE,
  username: process.env.VITE_SAP_USERNAME,
  password: process.env.VITE_SAP_PASSWORD
};

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(jsonData);
          }
        } catch (error) {
          reject({ error: 'Invalid JSON response', raw: responseData });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function loginToSAP() {
  console.log('🔐 Logging into SAP...');
  
  const loginOptions = {
    hostname: SAP_CONFIG.hostname,
    port: SAP_CONFIG.port,
    path: '/b1s/v1/Login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const loginData = {
    CompanyDB: SAP_CONFIG.database,
    UserName: SAP_CONFIG.username,
    Password: SAP_CONFIG.password
  };
  
  try {
    const response = await makeRequest(loginOptions, loginData);
    console.log('✅ SAP login successful!');
    return response.SessionId;
  } catch (error) {
    console.error('❌ SAP login failed:', error);
    throw error;
  }
}

async function getAllUserFields(sessionId) {
  console.log('🔍 Getting all user fields...');
  
  const options = {
    hostname: SAP_CONFIG.hostname,
    port: SAP_CONFIG.port,
    path: '/b1s/v1/UserFieldsMD?$top=0',
    method: 'GET',
    headers: {
      'Cookie': `B1SESSION=${sessionId}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(options);
    return response.value || [];
  } catch (error) {
    console.error('❌ Error getting user fields:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔍 SAP All User Fields Inspector\n');
    
    // Login to SAP
    const sessionId = await loginToSAP();
    
    // Get all user fields
    const allFields = await getAllUserFields(sessionId);
    
    console.log(`\n📋 Found ${allFields.length} total user fields:`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    allFields.forEach((field, index) => {
      console.log(`${index + 1}. Name: "${field.Name}" | ID: ${field.FieldID} | Table: ${field.TableName} | Type: ${field.Type}`);
    });
    
    console.log('\n🔍 Looking for recent fields (created today)...');
    const recentFields = allFields.filter(field => {
      // Look for fields that might be our WhatsApp fields
      return field.FieldID >= 40; // Assuming recent fields have higher IDs
    });
    
    console.log(`\n📝 Recent fields (ID >= 40):`);
    recentFields.forEach(field => {
      console.log(`   - "${field.Name}" (ID: ${field.FieldID}, Table: ${field.TableName})`);
    });
    
    console.log('\n🎯 Current SAP database:', SAP_CONFIG.database);
    
  } catch (error) {
    console.error('\n❌ Inspection failed:', error);
    process.exit(1);
  }
}

main();
