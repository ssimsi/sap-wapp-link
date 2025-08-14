import pkg from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';

const { Client, LocalAuth, MessageMedia } = pkg;

const TEST_PHONE = '5491166161221';

async function testPDFAttachment() {
    console.log('🧪 Testing PDF attachment sending...');
    
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
        const pdfPath = 'temp-pdfs/1754831394491_Factura de deudores - 9008535.pdf';
        
        try {
            // Check if PDF exists
            if (!fs.existsSync(pdfPath)) {
                console.error('❌ PDF file not found:', pdfPath);
                return;
            }
            
            const stats = fs.statSync(pdfPath);
            console.log(`📄 PDF found: ${path.basename(pdfPath)} (${stats.size} bytes)`);
            
            // Read PDF and create media
            const pdfBuffer = fs.readFileSync(pdfPath);
            console.log(`📖 PDF read successfully: ${pdfBuffer.length} bytes`);
            
            // Create MessageMedia object
            const media = new MessageMedia(
                'application/pdf', 
                pdfBuffer.toString('base64'), 
                path.basename(pdfPath)
            );
            console.log(`📎 Media object created: ${media.mimetype}, filename: ${media.filename}`);
            
            // Test 1: Send just the PDF (no text)
            console.log('\n🧪 Test 1: Sending PDF only...');
            const result1 = await client.sendMessage(whatsappNumber, media);
            console.log('✅ PDF-only message sent!');
            console.log('Message ID:', result1.id._serialized);
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Test 2: Send text with PDF
            console.log('\n🧪 Test 2: Sending text with PDF...');
            const result2 = await client.sendMessage(
                whatsappNumber, 
                '📄 This message should have a PDF attachment', 
                { media: media }
            );
            console.log('✅ Text + PDF message sent!');
            console.log('Message ID:', result2.id._serialized);
            
            setTimeout(() => {
                console.log('\n🔚 Check your WhatsApp for both messages');
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

testPDFAttachment().catch(console.error);
