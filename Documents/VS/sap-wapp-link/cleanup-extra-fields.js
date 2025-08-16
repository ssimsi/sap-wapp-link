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

async function getWhatsAppFields(sessionId) {
  console.log('🔍 Getting WhatsApp user fields...');
  
  const options = {
    hostname: SAP_CONFIG.hostname,
    port: SAP_CONFIG.port,
    path: "/b1s/v1/UserFieldsMD?$filter=contains(Name,'WhatsApp')&$top=0",
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

async function deleteField(sessionId, fieldId, fieldName) {
  console.log(`🗑️ Deleting field: ${fieldName} (ID: ${fieldId})`);
  
  const options = {
    hostname: SAP_CONFIG.hostname,
    port: SAP_CONFIG.port,
    path: `/b1s/v1/UserFieldsMD(${fieldId})`,
    method: 'DELETE',
    headers: {
      'Cookie': `B1SESSION=${sessionId}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    await makeRequest(options);
    console.log(`✅ Field ${fieldName} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete field ${fieldName}:`, error);
    return false;
  }
}

async function main() {
  try {
    console.log('🧹 SAP WhatsApp Fields Cleanup Tool\n');
    console.log('This will delete unnecessary WhatsApp fields and keep only:');
    console.log('  ✅ U_WhatsAppSent');
    console.log('  ✅ U_WhatsAppDate');
    console.log('  ❌ U_WhatsAppPhone (will use Cellular field instead)');
    console.log('  ❌ U_WhatsAppRetries (not needed)');
    console.log('  ❌ U_WhatsAppError (not needed)\n');
    
    // Login to SAP
    const sessionId = await loginToSAP();
    
    // Get WhatsApp fields
    const whatsappFields = await getWhatsAppFields(sessionId);
    
    console.log(`\n📋 Found ${whatsappFields.length} WhatsApp fields:`);
    whatsappFields.forEach(field => {
      console.log(`   - ${field.Name} (ID: ${field.FieldID})`);
    });
    
    // Fields we want to delete
    const fieldsToDelete = ['U_WhatsAppPhone', 'U_WhatsAppRetries', 'U_WhatsAppError'];
    
    console.log('\n🗑️ Starting cleanup...');
    let deletedCount = 0;
    
    for (const fieldName of fieldsToDelete) {
      const field = whatsappFields.find(f => f.Name === fieldName);
      if (field) {
        const success = await deleteField(sessionId, field.FieldID, fieldName);
        if (success) deletedCount++;
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log(`⚠️ Field ${fieldName} not found (already deleted?)`);
      }
    }
    
    console.log(`\n📊 Cleanup summary:`);
    console.log(`🗑️ Deleted: ${deletedCount} fields`);
    console.log(`✅ Kept: U_WhatsAppSent, U_WhatsAppDate`);
    
    if (deletedCount > 0) {
      console.log('\n🎉 Cleanup completed! Your SAP database now has only the essential WhatsApp fields.');
    }
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();
