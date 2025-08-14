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

async function checkAllSeries() {
    console.log('🔍 Checking all available series in SAP...');

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

    // Query for all series
    const query = `/b1s/v1/Series`;

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
        console.log(`📋 Found ${count} series in SAP`);

        if (count > 0) {
            console.log('\n📊 ALL SERIES:');
            
            data.value.forEach(series => {
                const num = series.Series;
                const name = series.SeriesName || 'No Name';
                const docType = series.Document || 'Unknown';
                console.log(`   Series ${num}: ${name} (${docType})`);
            });

            // Look specifically for series 13 and 83
            const series13 = data.value.find(s => s.Series === 13);
            const series83 = data.value.find(s => s.Series === 83);

            console.log('\n🎯 TARGET SERIES:');
            if (series13) {
                console.log(`✅ Series 13 (PRIMARIO): ${series13.SeriesName || 'No Name'} (${series13.Document || 'Unknown'})`);
            } else {
                console.log('❌ Series 13 not found');
            }

            if (series83) {
                console.log(`✅ Series 83 (GESTION): ${series83.SeriesName || 'No Name'} (${series83.Document || 'Unknown'})`);
            } else {
                console.log('❌ Series 83 not found');
            }

            // Show invoice-related series
            console.log('\n📄 INVOICE-RELATED SERIES:');
            const invoiceSeries = data.value.filter(s => 
                s.Document === 'oInvoices' || 
                s.Document === 'Invoice' ||
                (s.SeriesName && s.SeriesName.toLowerCase().includes('factura'))
            );
            
            invoiceSeries.forEach(series => {
                console.log(`   Series ${series.Series}: ${series.SeriesName || 'No Name'}`);
            });

        } else {
            console.log('ℹ️ No series found');
        }
    } else {
        console.log(`❌ Query failed: ${response.status}`);
        console.log('Response:', response.body);
    }
}

checkAllSeries().catch(console.error);
