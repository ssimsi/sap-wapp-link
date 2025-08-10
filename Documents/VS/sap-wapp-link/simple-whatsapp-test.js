import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const TEST_PHONE = '5491166161221'; // Your phone number without +

async function simpleWhatsAppTest() {
    console.log('🧪 Starting simple WhatsApp test...');
    
    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp-session'
            // No clientId - use default like main service
        }),
        puppeteer: {
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', (qr) => {
        console.log('📱 QR Code generated - scan with your phone');
    });

    client.on('ready', async () => {
        console.log('✅ WhatsApp client is ready!');
        
        // Format phone number for WhatsApp
        const whatsappNumber = `${TEST_PHONE}@c.us`;
        console.log(`📞 Sending to: ${whatsappNumber}`);
        
        try {
            const chat = await client.getChatById(whatsappNumber);
            console.log('✅ Chat found:', chat.name || 'Unknown');
            
            const message = await client.sendMessage(whatsappNumber, '🚀 TEST MESSAGE - Simple WhatsApp test from SAP integration');
            console.log('✅ Message sent successfully!');
            console.log('Message ID:', message.id._serialized);
            
            // Wait a bit then close
            setTimeout(() => {
                console.log('🔚 Closing client...');
                client.destroy();
                process.exit(0);
            }, 3000);
            
        } catch (error) {
            console.error('❌ Error sending message:', error);
            client.destroy();
            process.exit(1);
        }
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Authentication failed:', msg);
        process.exit(1);
    });

    client.on('disconnected', (reason) => {
        console.log('🔌 Client was disconnected:', reason);
    });

    console.log('🔄 Initializing WhatsApp client...');
    await client.initialize();
}

simpleWhatsAppTest().catch(console.error);
