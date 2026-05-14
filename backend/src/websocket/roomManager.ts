/**
 * WebSocket Room Manager
 * Gestiona conexiones WebSocket por sala
 */

export interface RoomConnection {
  ws: WebSocket;
  sessionId: string;
  roomCode: string;
  playerName: string;
  joinedAt: Date;
}

interface WebSocket {
  send(data: string | ArrayBuffer | Blob): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}

// Mapa: room_code -> Set<WebSocket connections>
const rooms = new Map<string, Set<RoomConnection>>();

// Mapa inverso: WebSocket -> RoomConnection
const connections = new Map<WebSocket, RoomConnection>();

// Heartbeat: verificar conexiones vivas
const HEARTBEAT_INTERVAL = 30000; // 30 segundos
const HEARTBEAT_TIMEOUT = 10000; // 10 segundos para responder

const heartbeatTimers = new Map<WebSocket, NodeJS.Timeout>();

/**
 * Registrar un cliente en una sala
 */
export function joinRoom(
  ws: WebSocket,
  roomCode: string,
  sessionId: string,
  playerName: string
): void {
  const upperCode = roomCode.toUpperCase();
  
  // Crear entrada de conexión
  const connection: RoomConnection = {
    ws,
    sessionId,
    roomCode: upperCode,
    playerName,
    joinedAt: new Date()
  };
  
  // Agregar a la sala
  if (!rooms.has(upperCode)) {
    rooms.set(upperCode, new Set());
  }
  rooms.get(upperCode)!.add(connection);
  
  // Mapa inverso para búsquedas rápidas
  connections.set(ws, connection);
  
  // Iniciar heartbeat para esta conexión
  startHeartbeat(ws);
  
  console.log(`[WS] Cliente joined: ${playerName} (${sessionId}) -> sala ${upperCode}`);
}

/**
 * Remover un cliente de su sala
 */
export function leaveRoom(ws: WebSocket): { roomCode: string; sessionId: string; playerName: string } | null {
  const connection = connections.get(ws);
  if (!connection) return null;
  
  const { roomCode, sessionId, playerName } = connection;
  
  // Remover del mapa
  connections.delete(ws);
  stopHeartbeat(ws);
  
  // Remover de la sala
  const room = rooms.get(roomCode);
  if (room) {
    room.delete(connection);
    if (room.size === 0) {
      rooms.delete(roomCode);
      console.log(`[WS] Sala ${roomCode} vacía, eliminada`);
    }
  }
  
  console.log(`[WS] Cliente left: ${playerName} (${sessionId}) <- sala ${roomCode}`);
  
  return { roomCode, sessionId, playerName };
}

/**
 * Broadcast a todos en una sala (incluyendo emisor opcional)
 */
export function broadcast(
  roomCode: string,
  message: object,
  excludeWs?: WebSocket
): void {
  const upperCode = roomCode.toUpperCase();
  const room = rooms.get(upperCode);
  
  if (!room) {
    console.warn(`[WS] Broadcast a sala inexistente: ${upperCode}`);
    return;
  }
  
  const payload = JSON.stringify(message);
  
  for (const conn of room) {
    if (excludeWs && conn.ws === excludeWs) continue;
    if (conn.ws.readyState !== 1) continue; // Solo conexiones abiertas
    
    try {
      conn.ws.send(payload);
    } catch (err) {
      console.error(`[WS] Error enviando a ${conn.playerName}:`, err);
    }
  }
}

/**
 * Enviar mensaje a un WebSocket específico
 */
export function sendTo(ws: WebSocket, message: object): boolean {
  if (ws.readyState !== 1) return false;
  
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (err) {
    console.error('[WS] Error enviando mensaje:', err);
    return false;
  }
}

/**
 * Obtener info de conexión por WebSocket
 */
export function getConnection(ws: WebSocket): RoomConnection | undefined {
  return connections.get(ws);
}

/**
 * Obtener todos los clientes en una sala
 */
export function getRoomClients(roomCode: string): RoomConnection[] {
  const room = rooms.get(roomCode.toUpperCase());
  return room ? Array.from(room) : [];
}

/**
 * Verificar si una sala existe y tiene clientes
 */
export function roomExists(roomCode: string): boolean {
  const room = rooms.get(roomCode.toUpperCase());
  return !!room && room.size > 0;
}

/**
 * Heartbeat: mantener conexión viva
 */
function startHeartbeat(ws: WebSocket): void {
  stopHeartbeat(ws);
  
  const timer = setInterval(() => {
    if (ws.readyState !== 1) {
      stopHeartbeat(ws);
      return;
    }
    
    // Enviar ping
    sendTo(ws, { type: 'ping', timestamp: Date.now() });
    
    // Timeout para respuesta
    const timeout = setTimeout(() => {
      console.log(`[WS] Cliente sin respuesta, cerrando conexión`);
      ws.close(4000, 'Heartbeat timeout');
    }, HEARTBEAT_TIMEOUT);
    
    // Guardar timeout para limpiarlo
    heartbeatTimers.set(ws, timeout);
  }, HEARTBEAT_INTERVAL);
  
  heartbeatTimers.set(ws, timer);
}

function stopHeartbeat(ws: WebSocket): void {
  const timer = heartbeatTimers.get(ws);
  if (timer) {
    clearInterval(timer as any);
    heartbeatTimers.delete(ws);
  }
}

/**
 * Limpiar todas las conexiones (shutdown)
 */
export function cleanup(): void {
  for (const ws of connections.keys()) {
    try {
      ws.close(1001, 'Server shutting down');
    } catch {}
  }
  connections.clear();
  rooms.clear();
}