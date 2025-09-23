# SAP## Features
- 📧 **Email Integration**: Monitors SAP emails with invoice PDFs
- 📱 **WhatsApp Automation**: Sends PDFs with captions as single messages
- 🕐 **Scheduled Processing**: Hourly checks at X:50 for optimal workflow
- 📄 **PDF Management**: Downloads and organizes invoice PDFs with proper SAP document numbers
- 🎯 **Smart Matching**: Links SAP invoices with downloaded PDFs
- 🛡️ **Safety Controls**: No PDF = No message policy
- 📊 **Delivery Tracking**: SAP field updates prevent duplicates
- 🧹 **Auto Cleanup**: Removes old PDFs after 2 days
- 📝 **PDF Renaming**: Automatically extracts and uses correct SAP document numbers from PDF content Invoice Automation System

## Overview
This automated system connects SAP Business One to WhatsApp for seamless invoice delivery. It processes emails from SAP, downloads PDFs, and sends WhatsApp notifications to salespersons with invoice attachments.

## Features
- � **Email Integration**: Monitors SAP emails with invoice PDFs
- 📱 **WhatsApp Automation**: Sends PDFs with captions as single messages
- 🕐 **Scheduled Processing**: Hourly checks at X:50 for optimal workflow
- 📄 **PDF Management**: Downloads and organizes invoice PDFs
- 🎯 **Smart Matching**: Links SAP invoices with downloaded PDFs
- 🛡️ **Safety Controls**: No PDF = No message policy
- 📊 **Delivery Tracking**: SAP field updates prevent duplicates
- 🧹 **Auto Cleanup**: Removes old PDFs after 2 days

## Workflow Schedule

### Hourly Automation
- **X:30** - SAP automatically emails new invoices
- **X:40** - `pdf-download-service.js` downloads PDFs from email
- **X:50** - `hybrid-invoice-service.js` processes WhatsApp notifications
- **Daily 05:00** - PDF cleanup removes files older than 2 days
- **Daily 18:00** - Email report with processing summary

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

# Rename PDFs with correct document numbers
node rename-invoice-pdfs.cjs
```

### Automatic Operation
The system runs continuously with these scheduled tasks:

1. **X:50 every hour** - Main processing:
   - Checks SAP for invoices with `U_whatsappsent = 'N'`
   - Searches `downloaded-pdfs/` folder for matching PDFs
   - Sends WhatsApp message (PDF + caption) if PDF found
   - Updates `U_whatsappsent = 'Y'` in SAP after successful send
   - Skips invoices without PDFs (will retry next hour)

2. **Daily 18:00** - Email summary report
3. **Daily 05:00** - Cleanup PDFs older than 2 days

## Architecture

```
SAP B1 Email → PDF Download → SAP Processing → WhatsApp Delivery
    ↓              ↓               ↓              ↓
  X:30          X:40           X:50         Single Message
                                           (PDF + Caption)
```

## Safety Features
- **PDF Required**: No PDF found = No message sent
- **Single Messages**: PDF and text sent together (never separate)
- **Duplicate Prevention**: SAP field tracking prevents re-sending
- **Test Mode**: All messages redirected to test number in development
- **Customer Protection**: Customer notifications disabled in production

## Key Components

### 1. Email PDF Download Service (`pdf-download-service.js`)
- Monitors SAP email account
- Downloads invoice PDFs to `downloaded-pdfs/` folder
- Prevents duplicate downloads
- Runs at X:40 every hour

### 2. Hybrid Invoice Service (`hybrid-invoice-service.js`)
- Main WhatsApp processing service
- Checks SAP for unsent invoices (`U_whatsappsent = 'N'`)
- Matches invoices with downloaded PDFs
- Sends WhatsApp notifications to salespersons
- Updates SAP tracking fields
- Runs at X:50 every hour

### 3. PDF Cleanup Service (`pdf-cleanup-service.js`)
- Removes PDFs older than 2 days
- Prevents storage bloat
- Runs daily at 05:00

### 4. PDF Document Renamer (`rename-invoice-pdfs.cjs`)
- Extracts correct SAP document numbers from PDF content
- Renames files with proper format: `Factura_de_deudores_[NUMBER].pdf` and `Entrega_[NUMBER].pdf`
- Filters out emission points (00060, 99999) to get actual document numbers
- Automatically deletes original timestamp-named files after renaming
- Removes any other non-standard PDF files from the directory
- Supports both "Factura de deudores" (invoices) and "Entrega" (deliveries)
- Run manually: `node rename-invoice-pdfs.cjs`

## Recent Fixes
- ✅ **Fixed PDF Caption Issue**: PDFs now send with text captions as single messages
- ✅ **Simplified WhatsApp Function**: Removed complex async logic causing timing issues
- ✅ **Sequential Processing**: Uses `{caption: message}` options parameter approach
- ✅ **Hourly Schedule**: Changed from every 5 minutes to X:50 hourly for optimal workflow
- ✅ **PDF Naming System**: Added automatic PDF renaming with correct SAP document numbers
- ✅ **File Cleanup**: Automated removal of old timestamp files and non-standard PDFs
