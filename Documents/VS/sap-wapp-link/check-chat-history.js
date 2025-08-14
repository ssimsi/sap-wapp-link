import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const TEST_PHONE = '5491166161221'; // Your phone number

async function checkChatHistory() {
    console.log('🔍 Checking WhatsApp chat history...');
    
    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp-session'
        }),
        puppeteer: {
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        }
    });

    client.on('ready', async () => {
        console.log('✅ WhatsApp client is ready!');
        
        const whatsappNumber = `${TEST_PHONE}@c.us`;
        
        try {
            // Get the chat
            const chat = await client.getChatById(whatsappNumber);
            console.log('✅ Chat found:', chat.name || 'Unknown');
            
            // Get last 10 messages
            const messages = await chat.fetchMessages({ limit: 10 });
            console.log(`\n📜 Last 10 messages in chat:`);
            console.log('=====================================');
            
            messages.reverse().forEach((msg, index) => {
                const timestamp = new Date(msg.timestamp * 1000).toLocaleString();
                const fromMe = msg.fromMe ? '➡️ (sent by us)' : '⬅️ (received)';
                const hasMedia = msg.hasMedia ? '📎 (has attachment)' : '';
                
                console.log(`${index + 1}. [${timestamp}] ${fromMe} ${hasMedia}`);
                console.log(`   Body: ${msg.body.substring(0, 100)}${msg.body.length > 100 ? '...' : ''}`);
                console.log('   ---');
            });
            
            // Send a verification message
            console.log('\n📱 Sending verification message...');
            const verifyMsg = await client.sendMessage(whatsappNumber, '✅ SYNC TEST - This message is to verify WhatsApp sync between Web and Desktop app');
            console.log('✅ Verification message sent!');
            console.log('Message ID:', verifyMsg.id._serialized);
            
            setTimeout(() => {
                console.log('\n🔚 Check your Mac WhatsApp app now for the verification message');
                client.destroy();
                process.exit(0);
            }, 3000);
            
        } catch (error) {
            console.error('❌ Error:', error);
            client.destroy();
            process.exit(1);
        }
    });

    await client.initialize();
}

checkChatHistory().catch(console.error);
