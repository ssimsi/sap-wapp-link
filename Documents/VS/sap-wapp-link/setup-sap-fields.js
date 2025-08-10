// SAP Custom Fields Setup for WhatsApp Integration
// This script helps you create the necessary custom fields in SAP B1

import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
  hostname: 'b1.ativy.com',
  port: 50685,
  database: process.env.VITE_SAP_DATABASE,
  username: process.env.VITE_SAP_USERNAME || 'ssimsi',
  password: process.env.VITE_SAP_PASSWORD || 'Sim1234$'
};

class SAPFieldSetup {
  constructor() {
    this.sessionId = null;
    this.cookies = null;
  }

  async login() {
    console.log('🔐 Logging into SAP for field setup...');
    
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
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const jsonResponse = JSON.parse(responseBody);
            this.sessionId = jsonResponse.SessionId;
            this.cookies = res.headers['set-cookie'];
            console.log('✅ SAP login successful!');
            resolve(true);
          } else {
            console.error('❌ SAP login failed:', responseBody);
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.write(loginData);
      req.end();
    });
  }

  async createUserField(tableId, fieldName, fieldType, description, size = 50) {
    console.log(`📝 Creating user field: ${fieldName}...`);

    const fieldData = {
      TableName: tableId,
      Name: fieldName,
      Type: fieldType,
      EditSize: size,
      Description: description,
      SubType: "st_None"
    };

    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/UserFieldsMD',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; '),
        'Content-Length': Buffer.byteLength(JSON.stringify(fieldData))
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode === 201) {
            console.log(`✅ Field ${fieldName} created successfully`);
            resolve(true);
          } else if (res.statusCode === 400 && responseBody.includes('already exists')) {
            console.log(`⚠️ Field ${fieldName} already exists`);
            resolve(true);
          } else {
            console.error(`❌ Failed to create field ${fieldName}:`, responseBody);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error(`❌ Request error for field ${fieldName}:`, error.message);
        resolve(false);
      });

      req.write(JSON.stringify(fieldData));
      req.end();
    });
  }

  async setupFields() {
    console.log('🛠️ Setting up SAP custom fields for WhatsApp integration...\n');

    const fieldsToCreate = [
      {
        table: 'OINV', // Invoice header table
        name: 'WhatsAppSent',
        type: 'db_Alpha',
        description: 'WhatsApp Delivery Status (Y/N)',
        size: 1
      },
      {
        table: 'OINV',
        name: 'WhatsAppDate',
        type: 'db_Date',
        description: 'WhatsApp Delivery Date',
        size: 10
      }
    ];

    let successCount = 0;
    let totalFields = fieldsToCreate.length;

    for (const field of fieldsToCreate) {
      const success = await this.createUserField(
        field.table,
        field.name,
        field.type,
        field.description,
        field.size
      );
      
      if (success) successCount++;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n📊 Field creation summary:`);
    console.log(`✅ Successful: ${successCount}/${totalFields}`);
    console.log(`❌ Failed: ${totalFields - successCount}/${totalFields}`);

    if (successCount === totalFields) {
      console.log('\n🎉 All custom fields are ready!');
      console.log('\nNext steps:');
      console.log('1. Configure your .env.local file');
      console.log('2. Run: npm test (to test SAP connection)');
      console.log('3. Run: npm start (to start the WhatsApp service)');
    } else {
      console.log('\n⚠️ Some fields could not be created.');
      console.log('You may need to create them manually in SAP B1 Studio or check permissions.');
    }
  }

  async checkExistingFields() {
    console.log('🔍 Checking existing WhatsApp fields...\n');

    const options = {
      hostname: SAP_CONFIG.hostname,
      port: SAP_CONFIG.port,
      path: '/b1s/v1/UserFieldsMD?$filter=TableName%20eq%20%27OINV%27%20and%20contains(Name,%27WhatsApp%27)',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': this.cookies.join('; ')
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const data = JSON.parse(responseBody);
              const fields = data.value || [];
              
              console.log(`📋 Found ${fields.length} existing WhatsApp fields:`);
              fields.forEach(field => {
                console.log(`   - U_${field.Name} (${field.Type}) - ${field.Description}`);
              });
              
              resolve(fields.length);
            } else {
              console.error('❌ Failed to check existing fields:', responseBody);
              resolve(0);
            }
          } catch (error) {
            console.error('❌ Error parsing fields response:', error.message);
            resolve(0);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Request error:', error.message);
        resolve(0);
      });

      req.end();
    });
  }

  async run() {
    console.log('🚀 SAP WhatsApp Fields Setup Tool\n');
    console.log('This tool will create the necessary custom fields in SAP B1');
    console.log('for tracking WhatsApp invoice delivery.\n');

    // Login to SAP
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.log('❌ Could not connect to SAP. Please check your credentials.');
      return;
    }

    // Check existing fields
    const existingCount = await this.checkExistingFields();
    
    if (existingCount >= 5) {
      console.log('\n✅ All required fields already exist!');
      console.log('Your SAP system is ready for WhatsApp integration.');
      return;
    }

    console.log('\n🛠️ Creating missing fields...');
    await this.setupFields();
  }
}

// Run the setup
const setup = new SAPFieldSetup();
setup.run().catch(error => {
  console.error('💥 Setup failed:', error.message);
  process.exit(1);
});
