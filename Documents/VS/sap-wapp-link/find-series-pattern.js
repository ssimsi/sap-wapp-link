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

async function findSeriesPattern() {
    console.log('🔍 Looking for series 13 and 83 in recent invoices...');

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

    // Let's check a wider range of invoices to find series patterns
    const dates = [
        '2025-01-01', '2025-02-01', '2025-03-01', '2025-04-01', 
        '2025-05-01', '2025-06-01', '2025-07-01', '2025-08-01'
    ];

    console.log('\n📊 CHECKING INVOICES FROM DIFFERENT MONTHS...');

    for (const date of dates) {
        const filter = encodeURIComponent(`DocDate ge '${date}'`);
        const select = encodeURIComponent('DocNum,DocDate,Series,SalesPersonCode');
        const query = `/b1s/v1/Invoices?$filter=${filter}&$select=${select}&$top=50`;

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
            const invoices = data.value || [];
            
            if (invoices.length > 0) {
                const seriesCount = {};
                invoices.forEach(inv => {
                    seriesCount[inv.Series] = (seriesCount[inv.Series] || 0) + 1;
                });

                console.log(`\n📅 From ${date}: ${invoices.length} invoices`);
                Object.keys(seriesCount).sort().forEach(series => {
                    console.log(`   Series ${series}: ${seriesCount[series]} invoices`);
                });

                // Check specifically for series 13 and 83
                const series13 = invoices.filter(inv => inv.Series === 13);
                const series83 = invoices.filter(inv => inv.Series === 83);

                if (series13.length > 0) {
                    console.log(`🎯 FOUND SERIES 13! ${series13.length} invoices`);
                    series13.slice(0, 3).forEach(inv => {
                        console.log(`   DocNum: ${inv.DocNum}, Date: ${inv.DocDate}`);
                    });
                }

                if (series83.length > 0) {
                    console.log(`🎯 FOUND SERIES 83! ${series83.length} invoices`);
                    series83.slice(0, 3).forEach(inv => {
                        console.log(`   DocNum: ${inv.DocNum}, Date: ${inv.DocDate}`);
                    });
                }

                // If we found what we're looking for, break
                if (series13.length > 0 || series83.length > 0) {
                    break;
                }
            }
        }
    }

    console.log('\n🔍 Summary: Looking for different series patterns...');
}

findSeriesPattern().catch(console.error);
