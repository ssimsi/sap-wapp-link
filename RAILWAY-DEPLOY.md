# SAP WhatsApp Invoice Integration - Railway Deployment

## 🚀 Railway Deployment Guide

### Prerequisites
1. Railway account ([railway.app](https://railway.app))
2. GitHub repository with your code
3. Environment variables ready

### Deployment Steps

1. **Connect to Railway**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Deploy from GitHub**
   - Go to [railway.app](https://railway.app)
   - Click "Deploy from GitHub repo"
   - Select your `sap-wapp-link` repository
   - Railway will automatically detect Node.js and use the `railway.json` config

3. **Set Environment Variables**
   In Railway dashboard, go to Variables tab and add:
   ```
   SAP_SERVER_URL=https://your-sap-server:50000/b1s/v1
   SAP_USERNAME=your-sap-username
   SAP_PASSWORD=your-sap-password
   SAP_COMPANY_DB=your-company-database
   ADMIN_PHONE=5491165748855
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   NODE_ENV=production
   ```

4. **Deploy**
   Railway will automatically build and deploy your app using:
   - Build command: `npm install`
   - Start command: `npm run start-both` (from railway.json)

### Features Included
- ✅ Dual service architecture (PDF download + WhatsApp processing)
- ✅ Automatic restarts on failure
- ✅ Persistent file storage for PDFs
- ✅ WhatsApp Web headless mode
- ✅ Scheduled PDF downloads (X:40 every hour)
- ✅ Continuous invoice processing
- ✅ Email monitoring and PDF extraction

### Monitoring
Railway provides:
- Real-time logs
- Resource usage metrics
- Deployment history
- Custom domain support

### Important Notes
- The app runs 24/7 with persistent connections
- WhatsApp session is maintained in the filesystem
- PDFs are stored in `/downloaded-pdfs` directory
- First deployment will require WhatsApp QR code scan (check logs)

## 🔧 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SAP_SERVER_URL` | SAP B1 Service Layer URL | `https://server:50000/b1s/v1` |
| `SAP_USERNAME` | SAP B1 Username | `manager` |
| `SAP_PASSWORD` | SAP B1 Password | `your-password` |
| `SAP_COMPANY_DB` | SAP Company Database | `SBODemoUS` |
| `ADMIN_PHONE` | WhatsApp admin number | `5491165748855` |
| `EMAIL_USER` | Gmail address for PDF downloads | `your-email@gmail.com` |
| `EMAIL_PASSWORD` | Gmail app password | `your-app-password` |
| `NODE_ENV` | Environment | `production` |
| `TEST_MODE` | Enable test mode | `false` |

## 📋 Post-Deployment Checklist

1. ✅ Check Railway logs for successful startup
2. ✅ Verify WhatsApp authentication (scan QR if needed)
3. ✅ Confirm SAP connection
4. ✅ Test email PDF download at next X:40
5. ✅ Verify invoice processing works
6. ✅ Check WhatsApp notifications to admin phone

## 🚨 Troubleshooting

- **WhatsApp QR Code**: Check Railway logs for QR code on first deployment
- **SAP Connection**: Verify server URL and credentials
- **Email Issues**: Ensure Gmail app password is correct
- **PDF Downloads**: Check logs at X:40 for email processing

Railway is perfect for this type of always-on service! 🎉
