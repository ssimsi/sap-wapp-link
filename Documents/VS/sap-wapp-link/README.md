# SAP WhatsApp Invoice Sender

## Overview
This middleware service connects SAP Business One to WhatsApp for automated invoice delivery. It scans for new invoices and sends them via WhatsApp to customers.

## Features
- 🔍 Scans SAP B1 for new/unsent invoices every hour
- 📱 Sends invoices via WhatsApp Business API (free)
- 📄 Generates PDF invoices from SAP
- 🎯 Customer phone number validation
- 📊 Delivery tracking and status updates
- 🔄 Retry mechanism for failed deliveries

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your SAP credentials
```

3. Start the service:
```bash
npm start
```

## Configuration

### SAP Settings
- Set your SAP B1 Service Layer credentials
- Configure invoice document type to scan
- Set up custom fields for WhatsApp delivery tracking

### WhatsApp Settings
- The service uses WhatsApp Web (free)
- First run will show QR code to scan with your phone
- Uses your personal/business WhatsApp account

## Usage

### Manual Testing
```bash
# Test SAP connection
npm run test

# Start development mode
npm run dev
```

### Automatic Operation
The service runs continuously and:
1. Scans for new invoices every hour
2. Generates PDF for each invoice
3. Sends via WhatsApp to customer phone
4. Updates delivery status in SAP

## Architecture

```
SAP B1 ←→ Service Layer ←→ WhatsApp Service ←→ WhatsApp Web
                ↓
           Invoice PDFs
```

## Free vs Paid Options

### Current Implementation (Free)
- WhatsApp Web via `whatsapp-web.js`
- Uses your personal WhatsApp account
- No per-message costs
- Requires phone to stay connected

### Upgrade Path (Paid)
- WhatsApp Business API
- Official Meta integration
- Higher reliability
- Per-message costs (~$0.005-0.009)

## Customization

### Invoice Template
- Customize PDF generation
- Add company branding
- Multi-language support

### Delivery Rules
- Customer preferences
- Business hours restrictions
- Retry policies
