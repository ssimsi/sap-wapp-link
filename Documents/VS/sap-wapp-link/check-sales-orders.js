import https from 'https';

// SAP configuration
const sapConfig = {
    host: 'b1.ativy.com',
    port: 50685,
    database: 'TEST_QAS_SHK',
    username: 'ssimsi',
    password: 'Sim1234$'
};

let sessionId = null;

function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: responseData, headers: res.headers });
                }
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function loginToSAP() {
    console.log('🔐 Logging into SAP...');
    
    const loginData = {
        CompanyDB: sapConfig.database,
        UserName: sapConfig.username,
        Password: sapConfig.password
    };
    
    const options = {
        hostname: sapConfig.host,
        port: sapConfig.port,
        path: '/b1s/v1/Login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    };
    
    try {
        const response = await makeRequest(options, loginData);
        
        if (response.statusCode === 200) {
            sessionId = response.headers['set-cookie']?.[0]?.split(';')[0];
            console.log('✅ SAP login successful!');
            return true;
        } else {
            console.error('❌ SAP login failed:', response.data);
            return false;
        }
    } catch (error) {
        console.error('❌ SAP login error:', error.message);
        return false;
    }
}

async function checkSalesOrders() {
    console.log('\n📋 Checking Sales Orders from January 29th...');
    
    // URL encode the filter properly
    const dateFilter = "DocDate eq '2025-01-29'";
    const encodedFilter = encodeURIComponent(dateFilter);
    
    const options = {
        hostname: sapConfig.host,
        port: sapConfig.port,
        path: `/b1s/v1/Orders?$filter=${encodedFilter}&$select=DocEntry,DocNum,Series,DocDate,SalesPersonCode,CardCode,CardName`,
        method: 'GET',
        headers: {
            'Cookie': sessionId,
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    };
    
    try {
        const response = await makeRequest(options);
        
        if (response.statusCode === 200) {
            const orders = response.data.value || [];
            console.log(`✅ Found ${orders.length} sales orders from January 29th`);
            
            if (orders.length > 0) {
                console.log('\n📊 Sales Orders with Series information:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                const seriesCount = {};
                
                orders.forEach((order, index) => {
                    const series = order.Series;
                    seriesCount[series] = (seriesCount[series] || 0) + 1;
                    
                    console.log(`${index + 1}. DocEntry: ${order.DocEntry}, DocNum: ${order.DocNum}`);
                    console.log(`   Series: ${series}`);
                    console.log(`   Date: ${order.DocDate}`);
                    console.log(`   SalesPersonCode: ${order.SalesPersonCode}`);
                    console.log(`   Customer: ${order.CardCode} - ${order.CardName}`);
                    console.log('');
                });
                
                console.log('\n📈 Series Summary:');
                Object.entries(seriesCount).forEach(([series, count]) => {
                    console.log(`   Series ${series}: ${count} orders`);
                    if (series === '13') console.log('   ✅ Found Series 13 (PRIMARIO)!');
                    if (series === '83') console.log('   ✅ Found Series 83 (GESTION)!');
                });
                
                // Check if we found the target series
                const foundSeries13 = orders.some(order => order.Series === 13);
                const foundSeries83 = orders.some(order => order.Series === 83);
                
                console.log('\n🎯 Target Series Check:');
                console.log(`   Series 13 (primario): ${foundSeries13 ? '✅ FOUND' : '❌ Not found'}`);
                console.log(`   Series 83 (gestion): ${foundSeries83 ? '✅ FOUND' : '❌ Not found'}`);
                
            } else {
                console.log('ℹ️  No sales orders found for January 29th');
            }
        } else {
            console.error('❌ Failed to fetch sales orders:', response.data);
        }
    } catch (error) {
        console.error('❌ Error fetching sales orders:', error.message);
    }
}

async function main() {
    console.log('🔍 Checking Sales Orders for Series 13 and 83');
    console.log('Date: January 29th, 2025\n');
    
    const loginSuccess = await loginToSAP();
    if (!loginSuccess) {
        console.log('❌ Cannot proceed without SAP login');
        return;
    }
    
    await checkSalesOrders();
    
    console.log('\n✅ Sales orders analysis completed!');
}

main().catch(console.error);
