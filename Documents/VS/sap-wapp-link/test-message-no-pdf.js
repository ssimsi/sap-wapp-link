import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const TEST_PHONE = '5491166161221'; // Your phone number without +

async function testMessageWithoutPDF() {
    console.log('🧪 Testing invoice message WITHOUT PDF attachment...');
    
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
        
        // Same message as isolated test but WITHOUT PDF
        const message = `🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*

🧾 *NUEVA FACTURA ELECTRÓNICA*
📋 Factura: *9008535*
👤 Cliente: Cruz Daniela Raquel
💰 Total: $25.750,50
📅 Fecha: 10/8/2025

📎 PDF attachment would be here (but NOT attached in this test)

🧪 *Este es un mensaje de prueba*
En producción iría a: Cruz Daniela Raquel
Teléfono real del cliente: 5491165432109

Gracias por tu compra! 🙏`;
        
        try {
            const chat = await client.getChatById(whatsappNumber);
            console.log('✅ Chat found:', chat.name || 'Unknown');
            
            const sentMessage = await client.sendMessage(whatsappNumber, message);
            console.log('✅ Invoice message sent successfully WITHOUT PDF!');
            console.log('Message ID:', sentMessage.id._serialized);
            
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

testMessageWithoutPDF().catch(console.error);
