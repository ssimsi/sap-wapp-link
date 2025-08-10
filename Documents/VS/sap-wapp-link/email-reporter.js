import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

class EmailReporter {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  async sendDailyReport(missedInvoices) {
    if (missedInvoices.length === 0) {
      console.log('📧 No missed invoices to report');
      return;
    }

    const reportDate = new Date().toLocaleDateString('es-AR');
    const reportTime = new Date().toLocaleTimeString('es-AR');

    // Create HTML email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">📊 Reporte Diario - Facturas No Enviadas</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p><strong>📅 Fecha:</strong> ${reportDate}</p>
          <p><strong>⏰ Hora:</strong> ${reportTime}</p>
          <p><strong>📋 Total facturas perdidas:</strong> ${missedInvoices.length}</p>
        </div>

        <h3>📋 Detalle de Facturas:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <thead>
            <tr style="background-color: #e0e0e0;">
              <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Factura</th>
              <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Cliente</th>
              <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Total</th>
              <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Error</th>
              <th style="border: 1px solid #ccc; padding: 10px; text-align: left;">Hora</th>
            </tr>
          </thead>
          <tbody>
            ${missedInvoices.map((missed, index) => `
              <tr style="${index % 2 === 0 ? 'background-color: #f9f9f9;' : ''}">
                <td style="border: 1px solid #ccc; padding: 10px;">${missed.invoice.DocNum}</td>
                <td style="border: 1px solid #ccc; padding: 10px;">${missed.invoice.CardName}</td>
                <td style="border: 1px solid #ccc; padding: 10px;">$${missed.invoice.DocTotal?.toLocaleString('es-AR') || '0.00'}</td>
                <td style="border: 1px solid #ccc; padding: 10px; color: #d32f2f;">${missed.error}</td>
                <td style="border: 1px solid #ccc; padding: 10px;">${missed.timestamp.toLocaleTimeString('es-AR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding: 15px; background-color: #e3f2fd; border-radius: 5px;">
          <h4 style="color: #1976d2;">🔧 Acciones Recomendadas:</h4>
          <ul>
            <li>Verificar que los emails con PDFs están llegando a <strong>sarandishk@gmail.com</strong></li>
            <li>Confirmar que el DocNum aparece en el asunto del email</li>
            <li>Revisar la conexión del servicio de WhatsApp</li>
            <li>Verificar números de teléfono de clientes en SAP</li>
          </ul>
        </div>

        <div style="margin-top: 20px; padding: 10px; background-color: #f0f0f0; border-radius: 5px; text-align: center; color: #666;">
          <small>Este reporte fue generado automáticamente por el Servicio de Integración SAP-WhatsApp</small>
        </div>
      </div>
    `;

    // Create plain text version
    const textContent = `
REPORTE DIARIO - FACTURAS NO ENVIADAS
=====================================

Fecha: ${reportDate}
Hora: ${reportTime}
Total facturas perdidas: ${missedInvoices.length}

DETALLE DE FACTURAS:
${missedInvoices.map((missed, index) => `
${index + 1}. Factura ${missed.invoice.DocNum}
   Cliente: ${missed.invoice.CardName}
   Total: $${missed.invoice.DocTotal?.toLocaleString('es-AR') || '0.00'}
   Error: ${missed.error}
   Hora: ${missed.timestamp.toLocaleTimeString('es-AR')}
`).join('')}

ACCIONES RECOMENDADAS:
- Verificar que los emails con PDFs están llegando a sarandishk@gmail.com
- Confirmar que el DocNum aparece en el asunto del email
- Revisar la conexión del servicio de WhatsApp
- Verificar números de teléfono de clientes en SAP

---
Este reporte fue generado automáticamente por el Servicio de Integración SAP-WhatsApp
    `;

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: 'ssimsi@gmail.com',
      subject: `📊 Reporte Diario WhatsApp - ${missedInvoices.length} facturas perdidas - ${reportDate}`,
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Daily report sent to ssimsi@gmail.com: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email report:', error.message);
      return false;
    }
  }

  async testEmailSetup() {
    try {
      await this.transporter.verify();
      console.log('✅ Email configuration is correct');
      return true;
    } catch (error) {
      console.error('❌ Email configuration error:', error.message);
      return false;
    }
  }
}

export default EmailReporter;
