#!/bin/bash

# Railway QR Code URL Helper
echo "🚀 Railway WhatsApp QR Code Setup"
echo "================================="

# Check if we're in Railway environment
if [ "$RAILWAY_ENVIRONMENT" = "production" ] || [ "$NODE_ENV" = "production" ]; then
    echo "✅ Running in Railway production environment"
    
    # Try to get Railway URL
    if [ -n "$RAILWAY_STATIC_URL" ]; then
        echo "🌐 QR Code URL: $RAILWAY_STATIC_URL/qr"
        echo "📱 Click the URL above to scan QR code"
    elif [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
        echo "🌐 QR Code URL: https://$RAILWAY_PUBLIC_DOMAIN/qr"
        echo "📱 Click the URL above to scan QR code"
    else
        echo "⚠️  Railway URL not detected in environment variables"
        echo "📝 Check Railway deployment logs for the web URL"
    fi
    
    # Check for phone number setup
    if [ -n "$WHATSAPP_PHONE_NUMBER" ]; then
        echo "✅ Phone number configured: $WHATSAPP_PHONE_NUMBER"
        echo "🔢 Pairing code authentication available"
    else
        echo "💡 TIP: Set WHATSAPP_PHONE_NUMBER for pairing code option"
        echo "📞 Format: +1234567890 (include country code)"
    fi
    
else
    echo "🏠 Running in local development environment"
    echo "🌐 QR Code URL: http://localhost:3001/qr"
fi

echo ""
echo "📋 Authentication Options:"
echo "1. 🌐 Web QR Code (recommended for Railway)"
echo "2. 🔢 Pairing Code (if phone number is set)"
echo "3. 📱 Terminal QR (not recommended for Railway)"
