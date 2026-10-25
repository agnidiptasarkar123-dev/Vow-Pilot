import http from 'node:http';
import { createServerApp } from './app';

const port = parseInt(process.env.PORT || '3001', 10);
const handler = createServerApp();
const server = http.createServer(handler);

server.listen(port, () => {
  console.log(`VowPilot Collaboration & Email Server running on http://localhost:${port}`);
});

export { server };
