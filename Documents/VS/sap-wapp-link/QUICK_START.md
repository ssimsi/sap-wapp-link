# 🚀 Quick Start Guide

Follow these steps to get your SAP to WhatsApp invoice system running:

## 1. Install Dependencies
```bash
npm install
```

## 2. Test SAP Connection
```bash
npm test
```
This will verify your SAP credentials and show sample data.

## 3. Setup SAP Custom Fields (Optional)
```bash
npm run setup
```
This creates custom fields in SAP to track WhatsApp deliveries.

## 4. Configure Phone Numbers
Edit `.env.local` and set your phone numbers:
```
# Admin notifications
ADMIN_PHONE=549xxxxxxxxx

# Sales person notifications (static mapping)
SALES_PERSON_11=549xxxxxxxxx  # 8-SALON DE VENTAS
SALES_PERSON_12=549xxxxxxxxx  # 999-Ventas Web
SALES_PERSON_DEFAULT=549xxxxxxxxx  # Fallback
```

## 5. Test Safety Filters
```bash
npm run test-safety
```
This shows which invoices would be processed without sending anything.

## 6. Start the Service
```bash
npm start
```

On first run, you'll see a QR code. Scan it with your WhatsApp mobile app.

## 7. Open Dashboard (Optional)
In another terminal:
```bash
npm run dashboard
```
Then open http://localhost:3002 in your browser.

## 8. Or Start Everything Together
```bash
npm run full-start
```

## What Happens Next?

1. **WhatsApp Setup**: Scan QR code with your phone
2. **SAP Connection**: Service connects to your SAP B1 Service Layer
3. **Invoice Scanning**: Every hour, scans for new invoices (from configured date forward)
4. **Customer Delivery**: Sends invoices via WhatsApp to customers (Cellular field only)
5. **Sales Person Copy**: Sends notification to sales person assigned to the invoice
6. **Status Tracking**: Updates delivery status in SAP
7. **Safety Measures**: Marks invoices as processed even without mobile numbers

## Sales Person Integration

The system automatically:
- ✅ Detects the sales person from `SalesPersonCode` field in invoices
- ✅ Looks up sales person details from SAP (`SalesPersons` table)
- ✅ Sends notification copy to the sales person's WhatsApp
- ✅ Includes customer delivery status in sales person notification
- ✅ Uses static phone number mapping from environment variables

**Sales Person Notification Example:**
```
🧾 NOTIFICACIÓN DE FACTURA

Hola 8-SALON DE VENTAS,

Se generó una nueva factura:
📋 Factura Nº: 9000016
📅 Fecha: 2024-02-29
👤 Cliente: PARETA JOSE LUIS
💰 Total: $128856 ARS

📱 Estado WhatsApp: ✅ ENVIADA
El cliente ya recibió la factura por WhatsApp.
```

## Monitoring

- **Dashboard**: http://localhost:3002
- **Logs**: Check console output or `./logs/whatsapp-service.log`
- **Admin Notifications**: You'll get WhatsApp messages about the service status

## Troubleshooting

### WhatsApp Issues
- Make sure your phone has internet connection
- Don't log out of WhatsApp Web on your phone
- If QR code expires, restart the service

### SAP Issues
- Check your .env.local credentials
- Ensure SAP Service Layer is running
- Run `npm test` to diagnose connection issues

### No Invoices Being Sent
- Check if customers have phone numbers in SAP
- Verify invoices have `U_WhatsAppSent` field set to 'N' or null
- Check the dashboard for error messages

## Next Steps

1. **Customize Messages**: Edit the WhatsApp message template in `whatsapp-service.js`
2. **Add Branding**: Update company name and contact info in `.env.local`
3. **Schedule**: The service runs 24/7 and checks hourly by default
4. **Scale**: For high volume, consider upgrading to WhatsApp Business API

## Support

- Check logs for detailed error messages
- Verify SAP user permissions for Service Layer access
- Ensure WhatsApp Business account if needed for official API
