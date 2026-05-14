import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { connectDB, disconnectDB } from './db/mongodb';
import { pokemonService } from './services/pokemonService';
import { initializeRoomsIndexes } from './db/rooms';
import pokemonRoutes from './routes/pokemon';
import roomRoutes from './routes/rooms';
import { handleMessage, handleClose } from './websocket/handler';
import { cleanup as cleanupWebSocket } from './websocket/roomManager';

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

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Pokémon Patacon Backend',
    version: '1.0.0',
    endpoints: {
      pokemon: '/api/pokemon',
      rooms: '/api/rooms',
      battle: 'ws://localhost:3000/battle/:room_code'
    }
  });
});

// Mount Pokémon routes
app.route('/api/pokemon', pokemonRoutes);

// Mount Room routes
app.route('/api/rooms', roomRoutes);

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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  cleanupWebSocket();
  await disconnectDB();
  process.exit(0);
});

// ============ WEBSOCKET SERVER (Bun native) ============

interface WSData {
  roomCode: string;
  sessionId: string;
}

// Almacenar clientes WebSocket por sesión
const wsClients = new Map<string, WebSocket>();

// Usar Bun.serve con la API correcta de Bun
const server = Bun.serve<WSData>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Solo manejar conexiones WebSocket en /ws/
    if (url.pathname.startsWith('/ws/')) {
      const pathParts = url.pathname.replace('/ws/', '').split('?');
      const roomCode = pathParts[0].toUpperCase();
      const sessionId = url.searchParams.get('session_id');
      
      if (!sessionId) {
        return new Response('session_id requerido', { status: 400 });
      }
      
      const success = server.upgrade(req, {
        data: { roomCode, sessionId }
      });
      
      if (success) {
        return; // Upgrade completado
      }
      
      return new Response('WebSocket upgrade falló', { status: 500 });
    }
    
    // Para otras rutas, usar el fetch de Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      const data = ws.data as WSData;
      wsClients.set(data.sessionId, ws as any);
      
      console.log(`[WS] Conexión abierta: ${data.sessionId} -> sala ${data.roomCode}`);
      
      // Enviar confirmación de conexión
      ws.send(JSON.stringify({
        type: 'connected',
        data: { roomCode: data.roomCode }
      }));
    },
    
    async message(ws, message) {
      const data = ws.data as WSData;

      // Ignorar mensajes binarios o vacíos
      if (!message || typeof message !== 'string') return;

      // Pasar al handler de mensajes
      try {
        await handleMessage(ws as any, message.toString());
      } catch (err) {
        console.error('[WS] Error procesando mensaje:', err);
      }
    },
    
    close(ws, code, reason) {
      const data = ws.data as WSData;
      wsClients.delete(data.sessionId);
      
      console.log(`[WS] Conexión cerrada: ${data.sessionId} (code: ${code})`);
      
      // Notificar al handler de desconexión
      try {
        handleClose(ws as any);
      } catch (err) {
        console.error('[WS] Error en close handler:', err);
      }
    },
    
    error(ws, error) {
      const data = ws.data as WSData;
      console.error(`[WS] Error en ${data.sessionId}:`, error);
    }
  }
});

console.log(`🔌 WebSocket server en ws://localhost:${PORT}/ws/:room_code?session_id=xxx`);

// Iniciar servidor con conexión a MongoDB
async function startServer() {
  try {
    // Conectar a MongoDB
    await connectDB();
    
    // Inicializar índices de rooms
    await initializeRoomsIndexes();
    
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

startServer();

export default server;
