/**
 * WebSocket Room Manager (NUEVA ARQUITECTURA)
 * Gestiona conexiones WebSocket persistentes por cliente
 * Las salas son estructuras lógicas, no sockets independientes
 */

export interface RoomConnection {
  ws: WebSocket;
  sessionId: string;
  playerName: string;
  joinedAt: Date;
}

export interface Room {
  id: string;
  players: string[]; // sessionIds de jugadores en la sala
  state: string; // 'waiting', 'in_draft', 'in_battle', 'finished'
}

// Tipos para WebSocket de Bun
interface BunWebSocket {
  send(data: string | ArrayBuffer | Blob): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}

// Mapa de conexiones: sessionId -> WebSocket
// UNA sola conexión por cliente
export const connections = new Map<string, BunWebSocket>();

// Mapa de salas: roomId -> Room
// Las salas son estructuras lógicas en memoria
export const rooms = new Map<string, Room>();

// Mapa inverso: sessionId -> roomCode (para saber en qué sala está cada jugador)
export const sessionToRoom = new Map<string, string>();

// Heartbeat: verificar conexiones vivas
const HEARTBEAT_INTERVAL = 30000; // 30 segundos
const HEARTBEAT_TIMEOUT = 10000; // 10 segundos para responder
const heartbeatTimers = new Map<string, NodeJS.Timeout>();

/**
 * Registrar un cliente con su sessionId
 * NO associated a ninguna sala todavía
 */
export function registerConnection(sessionId: string, ws: BunWebSocket): void {
  // Cerrar conexión existente si hay una
  const existing = connections.get(sessionId);
  if (existing && existing !== ws) {
    try {
      existing.close(1000, 'New connection from same session');
    } catch {}
  }

  connections.set(sessionId, ws);
  startHeartbeat(sessionId, ws);

  console.log(`[WS] Cliente registrado: ${sessionId}`);
}

/**
 * Remover conexión completamente
 */
export function removeConnection(sessionId: string): void {
  const roomCode = sessionToRoom.get(sessionId);

  // Si estaba en una sala, notificamos a los demás
  if (roomCode) {
    const room = rooms.get(roomCode);
    if (room) {
      room.players = room.players.filter(p => p !== sessionId);

      // Notificar a los demás jugadores
      broadcast(roomCode, {
        type: 'player:left',
        data: { session_id: sessionId }
      }, sessionId);

      // Si la sala quedó vacía, eliminarla
      if (room.players.length === 0) {
        rooms.delete(roomCode);
        console.log(`[WS] Sala ${roomCode} vacía, eliminada`);
      }
    }

    sessionToRoom.delete(sessionId);
  }

  // Limpiar heartbeat
  stopHeartbeat(sessionId);

  // Remover conexión
  connections.delete(sessionId);

  console.log(`[WS] Conexión removida: ${sessionId}`);
}

/**
 * Unir a un jugador a una sala (sin cerrar socket)
 */
export function joinRoom(sessionId: string, roomCode: string, playerName: string): boolean {
  const ws = connections.get(sessionId);
  if (!ws) {
    console.warn(`[WS] No se puede unir: conexión ${sessionId} no existe`);
    return false;
  }

  const upperCode = roomCode.toUpperCase();

  // Si ya está en otra sala, salir primero
  const currentRoom = sessionToRoom.get(sessionId);
  if (currentRoom && currentRoom !== upperCode) {
    leaveRoom(sessionId, false); // false = no notificar, lo haremos abajo
  }

  // Crear sala si no existe
  if (!rooms.has(upperCode)) {
    rooms.set(upperCode, {
      id: upperCode,
      players: [],
      state: 'waiting'
    });
    console.log(`[WS] Sala creada: ${upperCode}`);
  }

  const room = rooms.get(upperCode)!;

  // Verificar si ya está en la sala
  if (!room.players.includes(sessionId)) {
    room.players.push(sessionId);
  }

  // Mapear sesión a sala
  sessionToRoom.set(sessionId, upperCode);

  console.log(`[WS] Jugador ${playerName} (${sessionId}) unido a sala ${upperCode}`);

  return true;
}

/**
 * Sacar a un jugador de su sala actual
 * @param notifyOthers si true, notifica a los demás jugadores
 */
export function leaveRoom(sessionId: string, notifyOthers: boolean = true): string | null {
  const roomCode = sessionToRoom.get(sessionId);
  if (!roomCode) return null;

  const room = rooms.get(roomCode);
  if (room) {
    room.players = room.players.filter(p => p !== sessionId);

    if (notifyOthers) {
      broadcast(roomCode, {
        type: 'player:left',
        data: { session_id: sessionId }
      }, sessionId);
    }

    // Si la sala quedó vacía, eliminarla
    if (room.players.length === 0) {
      rooms.delete(roomCode);
      console.log(`[WS] Sala ${roomCode} vacía, eliminada`);
    }
  }

  sessionToRoom.delete(sessionId);

  console.log(`[WS] Jugador ${sessionId} salió de sala ${roomCode}`);

  return roomCode || null;
}

/**
 * Obtener la sala actual de un jugador
 */
export function getPlayerRoom(sessionId: string): string | undefined {
  return sessionToRoom.get(sessionId);
}

/**
 * Verificar si una sala existe
 */
export function roomExists(roomCode: string): boolean {
  return rooms.has(roomCode.toUpperCase());
}

/**
 * Obtener todos los sessionIds en una sala
 */
export function getRoomPlayers(roomCode: string): string[] {
  const room = rooms.get(roomCode.toUpperCase());
  return room ? room.players : [];
}

/**
 * Broadcast a todos en una sala (excepto opcionalmente uno)
 */
export function broadcast(roomCode: string, message: object, excludeSessionId?: string): void {
  const upperCode = roomCode.toUpperCase();
  const room = rooms.get(upperCode);

  if (!room) {
    console.warn(`[WS] Broadcast a sala inexistente: ${upperCode}`);
    return;
  }

  const payload = JSON.stringify(message);

  for (const sessionId of room.players) {
    if (excludeSessionId && sessionId === excludeSessionId) continue;

    const ws = connections.get(sessionId);
    if (!ws || ws.readyState !== 1) continue;

    try {
      ws.send(payload);
    } catch (err) {
      console.error(`[WS] Error enviando a ${sessionId}:`, err);
    }
  }
}

/**
 * Enviar mensaje a un cliente específico
 */
export function sendTo(sessionId: string, message: object): boolean {
  const ws = connections.get(sessionId);
  if (!ws || ws.readyState !== 1) return false;

  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (err) {
    console.error('[WS] Error enviando mensaje:', err);
    return false;
  }
}

/**
 * Obtener WebSocket por sessionId
 */
export function getConnection(sessionId: string): BunWebSocket | undefined {
  return connections.get(sessionId);
}

/**
 * Heartbeat: mantener conexión viva
 */
function startHeartbeat(sessionId: string, ws: BunWebSocket): void {
  stopHeartbeat(sessionId);

  const timer = setInterval(() => {
    const currentWs = connections.get(sessionId);
    if (!currentWs || currentWs.readyState !== 1) {
      stopHeartbeat(sessionId);
      return;
    }

    // Enviar ping
    sendTo(sessionId, { type: 'ping', timestamp: Date.now() });

    // Timeout para respuesta - el cliente debe responder con pong
    // Por ahora no cerramos automáticamente, confiamos en el navegador
  }, HEARTBEAT_INTERVAL);

  heartbeatTimers.set(sessionId, timer);
}

function stopHeartbeat(sessionId: string): void {
  const timer = heartbeatTimers.get(sessionId);
  if (timer) {
    clearInterval(timer as any);
    heartbeatTimers.delete(sessionId);
  }
}

/**
 * Limpiar todas las conexiones (shutdown)
 */
export function cleanup(): void {
  for (const sessionId of connections.keys()) {
    try {
      const ws = connections.get(sessionId);
      if (ws) ws.close(1001, 'Server shutting down');
    } catch {}
  }
  connections.clear();
  rooms.clear();
  sessionToRoom.clear();

  for (const timer of heartbeatTimers.values()) {
    clearInterval(timer as any);
  }
  heartbeatTimers.clear();
}