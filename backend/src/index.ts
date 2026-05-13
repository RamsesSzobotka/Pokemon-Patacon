import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { connectMongo } from './db/mongo';
import pokemonRoutes from './routes/pokemon';
import roomsRoutes from './routes/rooms';
import typesRoutes from './routes/types';
import movesRoutes from './routes/moves';
import { setupWebSocket } from './websocket/handler';

const app = new Hono();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/api/pokemon', pokemonRoutes);
app.route('/api/rooms', roomsRoutes);
app.route('/api/types', typesRoutes);
app.route('/api/moves', movesRoutes);

const port = parseInt(process.env.PORT || '3000');
const server = createServer(app.fetch);

const wss = new WebSocketServer({ server });
setupWebSocket(wss);

console.log(`🚀 Server running on http://localhost:${port}`);

await connectMongo();

serve({
  fetch: app.fetch,
  port,
});