import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from 'bun';

// Types
import type { HonoRequest } from 'hono';

// Initialize Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    status: 'ok',
    database: 'checking',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Pokémon Patacon Backend',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      pokemon: '/api/pokemon',
      rooms: '/api/rooms',
      battle: 'ws://localhost:3000/battle/:room_code'
    }
  });
});

// Placeholder routes
app.get('/api/pokemon/search', (c) => {
  return c.json({
    success: true,
    data: { results: [] },
    message: 'Pokemon search endpoint - Coming soon'
  });
});

app.post('/api/rooms', (c) => {
  return c.json({
    success: true,
    data: {
      room_code: 'AB12CD',
      created_at: new Date().toISOString(),
      url: 'ws://localhost:3000/battle/AB12CD'
    }
  }, 201);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    success: false,
    error: err.message,
    code: 'INTERNAL_ERROR'
  }, 500);
});

// Start server
const PORT = parseInt(process.env.PORT || '3000');

console.log(`🚀 Pokémon Patacon Backend`);
console.log(`📍 Server running on http://localhost:${PORT}`);
console.log(`📚 API Docs: http://localhost:${PORT}`);
console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
