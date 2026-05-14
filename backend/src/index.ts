import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { connectDB, disconnectDB } from './db/mongodb';
import { pokemonService } from './services/pokemonService';
import pokemonRoutes from './routes/pokemon';

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
      pokemonList: '/api/pokemon?limit=50&offset=0&types=fire,water&generation=1&legendary=false',
      pokemonSearch: '/api/pokemon/search?q=pikachu',
      pokemonById: '/api/pokemon/1',
      pokemonByType: '/api/pokemon/type/fire',
      pokemonByGeneration: '/api/pokemon/generation/1',
      legendary: '/api/pokemon/legendary',
      mythical: '/api/pokemon/mythical',
      types: '/api/pokemon/meta/types',
      generations: '/api/pokemon/meta/generations',
      rooms: '/api/rooms',
      battle: 'ws://localhost:3000/battle/:room_code'
    }
  });
});

// Mount Pokémon routes
app.route('/api/pokemon', pokemonRoutes);

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

async function startServer() {
  try {
    // Conectar a MongoDB
    await connectDB();
    
    // Inicializar servicio de Pokémon
    await pokemonService.initialize();

    console.log(`🚀 Pokémon Patacon Backend`);
    console.log(`📍 Server running on http://localhost:${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}`);
    console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    console.log(`🐾 Pokédex Endpoints:`);
    console.log(`   GET /api/pokemon (list with filters)`);
    console.log(`   GET /api/pokemon/:id (detail)`);
    console.log(`   GET /api/pokemon/search?q=name (search)`);
    console.log(`   GET /api/pokemon/type/:type (by type)`);
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await disconnectDB();
  process.exit(0);
});

startServer();

export default {
  port: PORT,
  fetch: app.fetch,
};
