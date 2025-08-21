#!/bin/bash
# Railway startup script
echo "🚂 Starting SAP-WhatsApp Integration on Railway..."
echo "📍 Node.js version: $(node --version)"
echo "📍 NPM version: $(npm --version)"
echo "📍 Environment: $NODE_ENV"

# Create necessary directories
mkdir -p whatsapp-session temp-pdfs logs downloaded-pdfs

# Start the hybrid service (PDF + WhatsApp)
echo "🚀 Starting Hybrid Invoice Service..."
exec npm run start-hybrid
