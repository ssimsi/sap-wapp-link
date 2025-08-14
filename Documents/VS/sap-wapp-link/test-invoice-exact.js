import pkg from 'whatsapp-web.js';
import fs from 'fs';
import path from 'path';

const { Client, LocalAuth, MessageMedia } = pkg;

const TEST_PHONE = '5491166161221';

async function testInvoiceMessageExact() {
    console.log('🧪 Testing EXACT invoice message as in isolated test...');
    
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
        
        // Use the SAME PDF file as in working test
        const pdfPath = 'temp-pdfs/1754831394491_Factura de deudores - 9008535.pdf';
        
        // Use the SAME message as isolated test
        const message = `🧪 *MODO PRUEBA - MENSAJE DE PRUEBA*

🧾 *NUEVA FACTURA ELECTRÓNICA*
📋 Factura: *9008535*
👤 Cliente: Cruz Daniela Raquel
💰 Total: $25.750,50
📅 Fecha: 10/8/2025

📎 Adjunto encontrarás tu factura en PDF.

🧪 *Este es un mensaje de prueba*
En producción iría a: Cruz Daniela Raquel
Teléfono real del cliente: 5491165432109

Gracias por tu compra! 🙏`;
        
        try {
            // Check if PDF exists
            if (!fs.existsSync(pdfPath)) {
                console.error('❌ PDF file not found:', pdfPath);
                return;
            }
            
            const stats = fs.statSync(pdfPath);
            console.log(`📄 PDF found: ${path.basename(pdfPath)} (${stats.size} bytes)`);
            
            // Read PDF and create media (EXACT same as working test)
            const pdfBuffer = fs.readFileSync(pdfPath);
            console.log(`📖 PDF read successfully: ${pdfBuffer.length} bytes`);
            
            // Test Series detection logic
            const invoiceNumber = '9008535';
            let mediaFilename = path.basename(pdfPath);
            
            // Series 76 detection: 7 digits AND starts with 9
            const isSeries76 = invoiceNumber.length === 7 && invoiceNumber.startsWith('9');
            
            if (isSeries76) {
                console.log('🎯 Series 76 detected (7 digits, starts with 9)');
                const newFilename = `Comprobante_${invoiceNumber}.pdf`;
                console.log(`📝 Renaming PDF: ${mediaFilename} → ${newFilename}`);
                mediaFilename = newFilename;
            } else {
                console.log('📋 Series 4 detected (keeping original filename)');
            }
            
            const media = new MessageMedia(
                'application/pdf', 
                pdfBuffer.toString('base64'), 
                mediaFilename // Use the renamed filename
            );
            console.log(`📎 Media object created: ${media.mimetype}, filename: ${media.filename}`);
            
            // Send invoice message with PDF (EXACT same syntax as working test)
            console.log('\n🧪 Sending invoice message with PDF...');
            const result = await client.sendMessage(
                whatsappNumber, 
                message, 
                { media: media }
            );
            console.log('✅ Invoice message with PDF sent!');
            console.log('Message ID:', result.id._serialized);
            
            setTimeout(() => {
                console.log('\n🔚 Check your WhatsApp for the invoice message with PDF');
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

testInvoiceMessageExact().catch(console.error);
