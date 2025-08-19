# 📱 WhatsApp Session Persistence Guide

## 🚀 **Overview**

This guide explains how to maintain persistent WhatsApp sessions and prevent daily re-authentication in your SAP-WhatsApp integration.

## 🔧 **Session Persistence Features**

### ✅ **Implemented Solutions**

1. **🗂️ Stable Session Storage**
   - Persistent client ID: `sap-whatsapp-persistent`
   - Dedicated session path: `./.wwebjs_auth/`
   - Session metadata tracking

2. **💓 Keep-Alive Monitoring**
   - 5-minute status pings
   - Daily health checks
   - Auto-reconnection on failure

3. **🔄 Automatic Recovery**
   - Session conflict resolution
   - Auto-reconnection with retries
   - Graceful error handling

4. **💾 Session Backup & Recovery**
   - Automatic session backups
   - Manual session management tools
   - Corruption recovery

## 📊 **Session Management Commands**

### **Check Session Status**
```bash
node session-manager.js --status
```

### **Backup Current Session**
```bash
node session-manager.js --backup
```

### **Restore from Backup**
```bash
node session-manager.js --restore
```

### **Clean Session (Fresh Start)**
```bash
node session-manager.js --clean
```

### **Repair Corrupted Session**
```bash
node session-manager.js --repair
```

### **Generate Full Report**
```bash
node session-manager.js --report
```

## ⚙️ **Environment Configuration**

Add these to your `.env` file:

```bash
# Session Persistence Settings
WHATSAPP_SESSION_NAME=sap-whatsapp-persistent
WHATSAPP_KEEP_ALIVE_INTERVAL=300000          # 5 minutes
WHATSAPP_HEALTH_CHECK_INTERVAL=86400000      # 24 hours  
WHATSAPP_MAX_SESSION_AGE=604800000          # 7 days
WHATSAPP_AUTO_BACKUP=true
```

## 🏥 **Session Health Monitoring**

### **Automatic Checks**
- ✅ Every 5 minutes: Keep-alive ping
- ✅ Every 24 hours: Full health check
- ✅ On connection: Session validation
- ✅ On error: Recovery attempt

### **Health Indicators**
- 🟢 **Fresh**: 0-3 days old
- 🟡 **Aging**: 3-7 days old  
- 🔴 **Old**: 7+ days old (auto-refresh)

## 🛠️ **Troubleshooting Session Issues**

### **Common Problems & Solutions**

#### **1. Session Expires Daily**
```bash
# Check session age
node session-manager.js --status

# If old, clean and restart
node session-manager.js --clean
node hybrid-invoice-service.js
```

#### **2. QR Code Appears After Working**
```bash
# Session corruption - repair it
node session-manager.js --repair
```

#### **3. Connection Drops Frequently**
```bash
# Check session health
node session-manager.js --report

# Backup and clean if needed
node session-manager.js --backup
node session-manager.js --clean
```

#### **4. Multiple Device Conflicts**
```bash
# Remove conflicting sessions
node session-manager.js --clean

# Ensure only one instance runs
pkill -f "hybrid-invoice-service"
node hybrid-invoice-service.js
```

## 🔄 **Session Lifecycle**

### **Normal Flow**
1. 🟢 **Fresh Session** → Keep-alive monitoring active
2. 🟡 **Aging Session** → Increased monitoring
3. 🔴 **Old Session** → Auto-refresh triggered
4. 🟢 **Refreshed** → Back to normal monitoring

### **Error Recovery Flow**
1. 🚨 **Error Detected** → Stop keep-alive
2. 🔄 **Reconnection Attempt** → Up to 5 retries
3. ⚠️ **Failed Reconnection** → Session repair
4. 🧹 **Repair Failed** → Clean start (QR required)

## 📋 **Best Practices**

### **✅ Do This**
- 🔄 Run status checks weekly
- 💾 Create backups before major changes
- 📊 Monitor session age regularly
- 🛑 Stop service cleanly (Ctrl+C)
- 📱 Keep WhatsApp mobile app updated

### **❌ Avoid This**
- 🚫 Don't run multiple instances
- 🚫 Don't manually delete session files
- 🚫 Don't force-kill the process
- 🚫 Don't scan QR with multiple devices
- 🚫 Don't disable keep-alive monitoring

## 🔐 **Security Considerations**

- 🛡️ Session files contain authentication data
- 🔒 Backup files should be secured
- 🚫 Never share session files
- 📱 Only scan QR with trusted devices
- 🧹 Clean sessions when changing devices

## 🚀 **Deployment Best Practices**

### **Railway/Production**
```bash
# Set persistent session environment
WHATSAPP_SESSION_NAME=production-persistent
WHATSAPP_AUTO_BACKUP=true

# Enable health monitoring
WHATSAPP_KEEP_ALIVE_INTERVAL=300000
WHATSAPP_HEALTH_CHECK_INTERVAL=86400000
```

### **Local Development**
```bash
# Use development session
WHATSAPP_SESSION_NAME=dev-persistent
WHATSAPP_AUTO_BACKUP=false

# Faster monitoring for testing
WHATSAPP_KEEP_ALIVE_INTERVAL=60000
WHATSAPP_HEALTH_CHECK_INTERVAL=3600000
```

## 📈 **Session Longevity Tips**

1. **🔌 Stable Internet**: Ensure reliable connection
2. **📱 Active Mobile**: Keep WhatsApp mobile active
3. **🔄 Regular Updates**: Update whatsapp-web.js library
4. **💾 Regular Backups**: Weekly session backups
5. **🏥 Health Monitoring**: Review daily health checks
6. **🧹 Periodic Cleaning**: Monthly fresh starts

## 🆘 **Emergency Recovery**

If everything fails:

```bash
# 1. Stop all services
pkill -f "hybrid-invoice-service"

# 2. Clean everything
node session-manager.js --clean

# 3. Restart fresh
node hybrid-invoice-service.js

# 4. Scan QR code immediately
# 5. Test with a message

# 6. Create new backup
node session-manager.js --backup
```

With these session persistence features, your WhatsApp integration should maintain stable connections for weeks without requiring daily QR code scans! 🎉
