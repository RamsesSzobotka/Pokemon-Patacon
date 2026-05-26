import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { connectDB, disconnectDB, ensureTypeEffectivenessCache, validateTypeEffectivenessData } from './db/mongodb';
import { pokemonService } from './services/pokemonService';
import { importAllData } from './services/dataImportService';
import { updateMoveFlags } from './services/updateMoveFlagsService';
import { initializeRoomsIndexes } from './db/rooms';
import { initializeUsersIndexes } from './db/users';
import pokemonRoutes from './routes/pokemon';
import roomRoutes from './routes/rooms';
import authRoutes from './routes/auth';
import storeRoutes from './routes/store';
import { clerkAuth } from './middleware/auth';
import { handleMessage, handleClose, handleMessageFromSession } from './websocket/handler';
import { cleanup as cleanupWebSocket, registerConnection, removeConnection } from './websocket/roomManager';

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

// Clerk auth middleware (anota requests con userId si hay token, nunca bloquea)
app.use('/api/*', clerkAuth);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Pokémon Patacon Backend',
    version: '2.0.0',
    endpoints: {
      pokemon: '/api/pokemon',
      rooms: '/api/rooms',
      auth: '/api/auth',
      websocket: 'ws://localhost:3000/ws?session_id=xxx'
    }
  });
});

// Mount Pokémon routes
app.route('/api/pokemon', pokemonRoutes);

// Mount Room routes
app.route('/api/rooms', roomRoutes);

// Mount Auth routes
app.route('/api/auth', authRoutes);

// Mount Store / Payments routes
app.route('/api/store', storeRoutes);

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

// ============ WEBSOCKET SERVER (NUEVA ARQUITECTURA) ============
// Una sola conexión WebSocket por cliente, reusable para múltiples salas

interface WSData {
  sessionId: string;
}

// Iniciar servidor con conexión a MongoDB
async function startServer() {
  try {
    // 1. Primero conectar a MongoDB
    console.log(`🔌 Conectando a MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017'}`);
    await connectDB();
    console.log('✅ MongoDB conectada correctamente');

    // 2. Inicializar índices de rooms
    await initializeRoomsIndexes();
    console.log('✅ Índices de rooms creados');

    // 2.5 Inicializar índices de users
    await initializeUsersIndexes();
    console.log('✅ Índices de users creados');

    // 3. Importar datos desde PokeAPI si no existen
    await importAllData();

    // 3.25 Actualizar flags de movimientos (charge, evasive, interruptible, fatigue)
    // Debe ejecutarse DESPUÉS de importAllData() para asegurar que los movimientos existen
    await updateMoveFlags();

    // 3.5 Cargar cache de efectividad de tipos desde MongoDB
    await ensureTypeEffectivenessCache();

    // 3.6 Validar y loguear estado de tipos
    await validateTypeEffectivenessData();

    // 4. Inicializar servicio de Pokémon
    await pokemonService.initialize();
    console.log('🐾 Servicio de Pokémon inicializado');

    // 4. Iniciar el servidor WebSocket (después de que MongoDB esté lista)
    const server = Bun.serve<WSData>({
      port: PORT,
      fetch(req, server) {
        const url = new URL(req.url);

        // NUEVA ARQUITECTURA: Una sola ruta WebSocket global /ws
        if (url.pathname === '/ws' || url.pathname.startsWith('/ws/')) {
          const sessionId = url.searchParams.get('session_id');

          if (!sessionId) {
            return new Response('session_id requerido', { status: 400 });
          }

          const success = server.upgrade(req, {
            data: { sessionId }
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
          const sessionId = data.sessionId;

          // Registrar la conexión (una por sessionId)
          registerConnection(sessionId, ws as any);

          console.log(`[WS] Conexión abierta: ${sessionId}`);

          // Enviar confirmación de conexión
          ws.send(JSON.stringify({
            type: 'connected',
            data: { sessionId }
          }));
        },

        async message(ws, message) {
          const data = ws.data as WSData;
          const sessionId = data.sessionId;

          // Ignorar mensajes binarios o vacíos
          if (!message || typeof message !== 'string') return;

          // Pasar al handler de mensajes
          try {
            // NUEVA ARQUITECTURA: Pasar sessionId directamente
            await handleMessageFromSession(sessionId, message.toString());
          } catch (err) {
            console.error('[WS] Error procesando mensaje:', err);
          }
        },

        close(ws, code, reason) {
          const data = ws.data as WSData;
          const sessionId = data.sessionId;

          // Remover la conexión
          removeConnection(sessionId);

          // Notificar al handler de desconexión
          try {
            handleClose(sessionId);
          } catch (err) {
            console.error('[WS] Error en close handler:', err);
          }

          console.log(`[WS] Conexión cerrada: ${sessionId} (code: ${code})`);
        },

        error(ws, error) {
          const data = ws.data as WSData;
          console.error(`[WS] Error en ${data.sessionId}:`, error);
        }
      }
    });

    console.log(`🔌 WebSocket server en ws://localhost:${PORT}/ws?session_id=xxx`);
    console.log(`🚀 Pokémon Patacon Backend v2.0`);
    console.log(`📍 Server running on http://localhost:${PORT}`);
    console.log(`📚 API Docs: http://localhost:${PORT}`);
    console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    console.log(`🐾 Nueva arquitectura: Una conexión WebSocket persistente por cliente`);

  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

// Iniciar el servidor
startServer();