import http from 'node:http';
import { createServerApp } from './app';

const port = parseInt(process.env.PORT || '3001', 10);
const host = process.env.HOST || '0.0.0.0';

const handler = createServerApp();
const server = http.createServer(handler);

server.listen(port, host, () => {
  console.log(`VowPilot Collaboration & Email Server running on http://${host}:${port}`);
});

// Graceful container shutdown for Railway / Docker orchestrators
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Gracefully stopping VowPilot HTTP server...`);
  server.close(() => {
    console.log('HTTP server closed cleanly.');
    process.exit(0);
  });
  // Force exit after 10s timeout if active requests do not drain
  setTimeout(() => {
    console.error('Forced shutdown due to active connection timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server };

