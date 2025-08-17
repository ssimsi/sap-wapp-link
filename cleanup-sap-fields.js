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

// Fields to delete (keeping only WhatsAppSent and WhatsAppDate)
const FIELDS_TO_DELETE = [
  'WhatsAppPhone',    // We'll use Cellular field instead
  'WhatsAppRetries',  // Not needed for now
  'WhatsAppError'     // Not needed for now
];

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

async function getExistingFields(sessionId) {
  console.log('🔍 Checking existing WhatsApp fields...');
  
  const options = {
    hostname: SAP_CONFIG.hostname,
    port: SAP_CONFIG.port,
    path: '/b1s/v1/UserFieldsMD?$filter=contains(Name,%27WhatsApp%27)',
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
    console.error('❌ Error getting existing fields:', error);
    throw error;
  }
}

async function deleteField(sessionId, fieldId, fieldName) {
  console.log(`🗑️ Deleting field: ${fieldName}...`);
  
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
    console.error(`❌ Error deleting field ${fieldName}:`, error);
    return false;
  }
}

async function main() {
  try {
    console.log('🧹 SAP WhatsApp Fields Cleanup Tool\n');
    console.log('This tool will delete unnecessary WhatsApp custom fields.');
    console.log(`Keeping: WhatsAppSent, WhatsAppDate`);
    console.log(`Deleting: ${FIELDS_TO_DELETE.join(', ')}\n`);
    
    // Login to SAP
    const sessionId = await loginToSAP();
    
    // Get existing fields
    const existingFields = await getExistingFields(sessionId);
    console.log(`\n📋 Found ${existingFields.length} existing WhatsApp fields:`);
    existingFields.forEach(field => {
      console.log(`   - ${field.Name} (ID: ${field.FieldID})`);
    });
    
    // Delete specified fields
    console.log('\n🗑️ Deleting unnecessary fields...');
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const fieldName of FIELDS_TO_DELETE) {
      const field = existingFields.find(f => f.Name === fieldName);
      if (field) {
        const success = await deleteField(sessionId, field.FieldID, fieldName);
        if (success) {
          deletedCount++;
        } else {
          failedCount++;
        }
      } else {
        console.log(`⚠️ Field ${fieldName} not found (may already be deleted)`);
      }
    }
    
    console.log(`\n📊 Cleanup summary:`);
    console.log(`✅ Deleted: ${deletedCount}/${FIELDS_TO_DELETE.length}`);
    console.log(`❌ Failed: ${failedCount}/${FIELDS_TO_DELETE.length}`);
    
    console.log('\n🎉 Field cleanup completed!');
    console.log('\nRemaining fields:');
    console.log('✅ U_WhatsAppSent - Tracks if invoice was sent');
    console.log('✅ U_WhatsAppDate - Records when it was sent');
    console.log('✅ Cellular field - Used for phone numbers (built-in SAP field)');
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

main();
