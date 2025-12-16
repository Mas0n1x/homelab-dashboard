import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

import systemRoutes from './routes/system.js';
import dockerRoutes from './routes/docker.js';
import servicesRoutes from './routes/services.js';
import * as glances from './services/glances.js';
import * as dockerService from './services/docker.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/system', systemRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/services', servicesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');

  let statsInterval;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'subscribe') {
        // Start sending updates
        const sendUpdates = async () => {
          try {
            const [systemStats, containers, dockerInfo] = await Promise.all([
              glances.getSystemStats().catch(() => null),
              dockerService.getContainers().catch(() => []),
              dockerService.getDockerInfo().catch(() => null)
            ]);

            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'stats',
                data: {
                  system: systemStats,
                  containers,
                  docker: dockerInfo,
                  timestamp: new Date().toISOString()
                }
              }));
            }
          } catch (error) {
            console.error('Error sending stats:', error.message);
          }
        };

        // Send immediately
        sendUpdates();

        // Then every 2 seconds
        statsInterval = setInterval(sendUpdates, 2000);
      }

      if (data.type === 'unsubscribe') {
        if (statsInterval) {
          clearInterval(statsInterval);
          statsInterval = null;
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error.message);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    if (statsInterval) {
      clearInterval(statsInterval);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message);
    if (statsInterval) {
      clearInterval(statsInterval);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Homelab Dashboard API running on port ${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
