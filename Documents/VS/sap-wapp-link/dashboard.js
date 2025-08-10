// Simple Web Dashboard for WhatsApp Invoice Service
// Provides a web interface to monitor and control the service

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory stats (in production, you'd use a database)
let serviceStats = {
  status: 'starting',
  whatsappReady: false,
  sapConnected: false,
  invoicesSent: 0,
  failedDeliveries: 0,
  lastCheck: null,
  uptime: 0,
  recentActivity: []
};

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: serviceStats,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/logs', async (req, res) => {
  try {
    const logPath = process.env.LOG_FILE || './logs/whatsapp-service.log';
    
    try {
      const logs = await fs.readFile(logPath, 'utf8');
      const logLines = logs.split('\n').slice(-100); // Last 100 lines
      
      res.json({
        success: true,
        data: logLines.filter(line => line.trim()),
        timestamp: new Date().toISOString()
      });
    } catch (fileError) {
      res.json({
        success: true,
        data: ['No log file found yet'],
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/failed-deliveries', (req, res) => {
  // This would come from your main service
  res.json({
    success: true,
    data: [], // Placeholder
    timestamp: new Date().toISOString()
  });
});

// Manual trigger for testing
app.post('/api/trigger-check', (req, res) => {
  // This would trigger a manual invoice check
  serviceStats.recentActivity.unshift({
    action: 'Manual check triggered',
    timestamp: new Date().toISOString(),
    source: 'dashboard'
  });
  
  res.json({
    success: true,
    message: 'Invoice check triggered manually',
    timestamp: new Date().toISOString()
  });
});

// Update stats endpoint (called by main service)
app.post('/api/update-stats', (req, res) => {
  serviceStats = { ...serviceStats, ...req.body };
  res.json({ success: true });
});

// Serve dashboard HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Invoice Service Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .cards { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px;
            margin-bottom: 20px;
        }
        .card { 
            background: white; 
            padding: 20px; 
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .status { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px;
            font-weight: bold;
        }
        .status.online { background: #d4edda; color: #155724; }
        .status.offline { background: #f8d7da; color: #721c24; }
        .status.starting { background: #fff3cd; color: #856404; }
        .metric { 
            display: flex; 
            justify-content: space-between; 
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child { border-bottom: none; }
        .metric-value { font-weight: bold; font-size: 18px; }
        .logs { 
            background: #2d3748; 
            color: #e2e8f0; 
            padding: 15px; 
            border-radius: 8px; 
            font-family: 'Courier New', monospace;
            font-size: 12px;
            max-height: 400px;
            overflow-y: auto;
        }
        .btn { 
            background: #4299e1; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 6px; 
            cursor: pointer;
            margin: 5px;
        }
        .btn:hover { background: #3182ce; }
        .refresh-info { 
            color: #666; 
            font-size: 12px; 
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 WhatsApp Invoice Service</h1>
            <p>Monitor and control your SAP to WhatsApp invoice delivery system</p>
        </div>

        <div class="cards">
            <div class="card">
                <h3>Service Status</h3>
                <div class="metric">
                    <span>Overall Status:</span>
                    <span class="status" id="overall-status">Loading...</span>
                </div>
                <div class="metric">
                    <span>WhatsApp:</span>
                    <span id="whatsapp-status">-</span>
                </div>
                <div class="metric">
                    <span>SAP Connection:</span>
                    <span id="sap-status">-</span>
                </div>
                <div class="metric">
                    <span>Uptime:</span>
                    <span id="uptime">-</span>
                </div>
            </div>

            <div class="card">
                <h3>Statistics</h3>
                <div class="metric">
                    <span>Invoices Sent:</span>
                    <span class="metric-value" id="invoices-sent">0</span>
                </div>
                <div class="metric">
                    <span>Failed Deliveries:</span>
                    <span class="metric-value" id="failed-deliveries">0</span>
                </div>
                <div class="metric">
                    <span>Last Check:</span>
                    <span id="last-check">Never</span>
                </div>
                <div class="metric">
                    <span>Success Rate:</span>
                    <span id="success-rate">-</span>
                </div>
            </div>

            <div class="card">
                <h3>Controls</h3>
                <button class="btn" onclick="triggerManualCheck()">🔄 Check Now</button>
                <button class="btn" onclick="refreshDashboard()">↻ Refresh Dashboard</button>
                <button class="btn" onclick="toggleLogs()">📋 Toggle Logs</button>
                <div class="refresh-info" id="last-refresh">Last updated: Never</div>
            </div>
        </div>

        <div class="card" id="logs-container" style="display: none;">
            <h3>Recent Logs</h3>
            <div class="logs" id="logs-content">Loading logs...</div>
        </div>
    </div>

    <script>
        let logsVisible = false;

        async function fetchStatus() {
            try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                if (data.success) {
                    updateDashboard(data.data);
                }
            } catch (error) {
                console.error('Failed to fetch status:', error);
            }
        }

        function updateDashboard(stats) {
            // Status indicators
            const overallStatus = document.getElementById('overall-status');
            if (stats.whatsappReady && stats.sapConnected) {
                overallStatus.textContent = 'Online';
                overallStatus.className = 'status online';
            } else if (stats.status === 'starting') {
                overallStatus.textContent = 'Starting';
                overallStatus.className = 'status starting';
            } else {
                overallStatus.textContent = 'Offline';
                overallStatus.className = 'status offline';
            }

            document.getElementById('whatsapp-status').textContent = stats.whatsappReady ? '✅ Ready' : '❌ Not Ready';
            document.getElementById('sap-status').textContent = stats.sapConnected ? '✅ Connected' : '❌ Disconnected';
            document.getElementById('uptime').textContent = formatUptime(stats.uptime);

            // Statistics
            document.getElementById('invoices-sent').textContent = stats.invoicesSent || 0;
            document.getElementById('failed-deliveries').textContent = stats.failedDeliveries || 0;
            document.getElementById('last-check').textContent = stats.lastCheck ? 
                new Date(stats.lastCheck).toLocaleString() : 'Never';

            // Success rate
            const total = (stats.invoicesSent || 0) + (stats.failedDeliveries || 0);
            const successRate = total > 0 ? Math.round((stats.invoicesSent / total) * 100) : 0;
            document.getElementById('success-rate').textContent = total > 0 ? successRate + '%' : 'N/A';

            document.getElementById('last-refresh').textContent = 'Last updated: ' + new Date().toLocaleString();
        }

        function formatUptime(seconds) {
            if (!seconds) return '0s';
            
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            if (hours > 0) return hours + 'h ' + minutes + 'm';
            if (minutes > 0) return minutes + 'm ' + secs + 's';
            return secs + 's';
        }

        async function triggerManualCheck() {
            try {
                const response = await fetch('/api/trigger-check', { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ Manual check triggered successfully!');
                    setTimeout(fetchStatus, 2000); // Refresh after 2 seconds
                }
            } catch (error) {
                alert('❌ Failed to trigger manual check');
            }
        }

        function refreshDashboard() {
            fetchStatus();
        }

        async function toggleLogs() {
            const container = document.getElementById('logs-container');
            const content = document.getElementById('logs-content');
            
            logsVisible = !logsVisible;
            container.style.display = logsVisible ? 'block' : 'none';
            
            if (logsVisible) {
                try {
                    const response = await fetch('/api/logs');
                    const data = await response.json();
                    
                    if (data.success) {
                        content.textContent = data.data.join('\\n') || 'No logs available';
                    } else {
                        content.textContent = 'Failed to load logs';
                    }
                } catch (error) {
                    content.textContent = 'Error loading logs: ' + error.message;
                }
            }
        }

        // Auto-refresh every 30 seconds
        setInterval(fetchStatus, 30000);
        
        // Initial load
        fetchStatus();
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`📊 Dashboard running at http://localhost:${PORT}`);
});

export { app, serviceStats };
