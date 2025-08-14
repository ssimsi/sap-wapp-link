import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SAP_CONFIG = {
    hostname: 'b1.ativy.com',
    port: 50685,
    database: process.env.VITE_SAP_DATABASE,
    username: process.env.VITE_SAP_USERNAME,
    password: process.env.VITE_SAP_PASSWORD
};

async function checkJan29Invoices() {
    console.log('🔍 Checking invoices from January 29th for series 13 and 83...');

    // Login first
    const loginData = JSON.stringify({
        CompanyDB: SAP_CONFIG.database,
        UserName: SAP_CONFIG.username,
        Password: SAP_CONFIG.password
    });

    const loginOptions = {
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

    const loginResponse = await new Promise((resolve) => {
        const req = https.request(loginOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ 
                status: res.statusCode, 
                body, 
                cookies: res.headers['set-cookie'] 
            }));
        });
        req.write(loginData);
        req.end();
    });

    if (loginResponse.status !== 200) {
        console.log('❌ Login failed');
        return;
    }

    const cookies = loginResponse.cookies.join('; ');
    console.log('✅ Logged in');

    // Query for January 29th invoices
    const jan29 = '2025-01-29';
    const filter = encodeURIComponent(`DocDate eq '${jan29}'`);
    const select = encodeURIComponent('DocNum,DocDate,Series,SalesPersonCode,CardCode,CardName,DocTotal');
    const query = `/b1s/v1/Invoices?$filter=${filter}&$select=${select}`;

    const options = {
        hostname: SAP_CONFIG.hostname,
        port: SAP_CONFIG.port,
        path: query,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cookie': cookies
        }
    };

    const response = await new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', (error) => resolve({ status: 0, body: error.message }));
        req.end();
    });

    if (response.status === 200) {
        const data = JSON.parse(response.body);
        const count = data.value?.length || 0;
        console.log(`📋 Found ${count} invoices from January 29th, 2025`);

        if (count > 0) {
            console.log('\n📊 SERIES BREAKDOWN:');
            const seriesCount = {};
            
            data.value.forEach(invoice => {
                const series = invoice.Series;
                seriesCount[series] = (seriesCount[series] || 0) + 1;
            });

            // Show series summary
            Object.keys(seriesCount).sort().forEach(series => {
                console.log(`   Series ${series}: ${seriesCount[series]} invoices`);
            });

            // Show specific series 13 and 83 if found
            const series13 = data.value.filter(inv => inv.Series === 13);
            const series83 = data.value.filter(inv => inv.Series === 83);

            if (series13.length > 0) {
                console.log('\n🎯 SERIES 13 (PRIMARIO) INVOICES:');
                series13.forEach(inv => {
                    console.log(`   DocNum: ${inv.DocNum}, Customer: ${inv.CardName}, Total: ${inv.DocTotal}`);
                });
            }

            if (series83.length > 0) {
                console.log('\n🎯 SERIES 83 (GESTION) INVOICES:');
                series83.forEach(inv => {
                    console.log(`   DocNum: ${inv.DocNum}, Customer: ${inv.CardName}, Total: ${inv.DocTotal}`);
                });
            }

            if (series13.length === 0 && series83.length === 0) {
                console.log('\n⚠️ No invoices found with Series 13 or 83 on January 29th');
                console.log('\n📄 SAMPLE INVOICES:');
                data.value.slice(0, 5).forEach(inv => {
                    console.log(`   DocNum: ${inv.DocNum}, Series: ${inv.Series}, Customer: ${inv.CardName}`);
                });
            }

        } else {
            console.log('ℹ️ No invoices found for January 29th, 2025');
        }
    } else {
        console.log(`❌ Query failed: ${response.status}`);
        console.log('Response:', response.body);
    }
}

checkJan29Invoices().catch(console.error);
