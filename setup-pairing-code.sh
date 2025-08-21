#!/bin/bash

echo "🔢 WhatsApp Pairing Code Setup for Railway"
echo "=========================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm install -g @railway/cli"
    echo "   railway login"
    exit 1
fi

echo "📱 Enter your WhatsApp phone number (with country code):"
echo "   Example: +1234567890"
echo "   Format: +[country code][phone number]"
echo ""
read -p "Phone number: " phone_number

if [[ -z "$phone_number" ]]; then
    echo "❌ Phone number cannot be empty"
    exit 1
fi

# Validate basic format
if [[ ! "$phone_number" =~ ^\+[0-9]{10,15}$ ]]; then
    echo "⚠️  Warning: Phone number format may be incorrect"
    echo "   Make sure it starts with + and includes country code"
    echo "   Example: +1234567890"
    echo ""
fi

echo ""
echo "🚀 Setting up Railway environment variable..."

# Set the environment variable in Railway
railway variables set WHATSAPP_PHONE_NUMBER="$phone_number"

if [ $? -eq 0 ]; then
    echo "✅ Successfully set WHATSAPP_PHONE_NUMBER in Railway"
    echo ""
    echo "📋 Next steps:"
    echo "1. Restart your Railway deployment"
    echo "2. Check the logs for the pairing code"
    echo "3. Enter the 8-digit code in WhatsApp:"
    echo "   Settings → Linked Devices → Link with phone number"
    echo ""
    echo "🔄 To restart deployment:"
    echo "   railway redeploy"
else
    echo "❌ Failed to set environment variable"
    echo "   Make sure you're logged in: railway login"
    echo "   Make sure you're in the right project: railway link"
fi
