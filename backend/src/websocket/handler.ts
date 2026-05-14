/**
 * WebSocket Message Handler
 * Procesa mensajes recibidos de los clientes
 */

import { broadcast, sendTo, getConnection, leaveRoom } from './roomManager';
import { getRoom, setReady, leaveRoom as leaveRoomService } from '../services/roomService';
import { getRoomByCode } from '../db/rooms';
import type { Room } from '../db/rooms';

interface WSMessage {
  type: string;
  data?: Record<string, any>;
}

interface WebSocket {
  send(data: string | ArrayBuffer | Blob): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}

/**
 * Manejar mensaje recibido de un cliente
 */
export function handleMessage(ws: WebSocket, rawMessage: string): void {
  let message: WSMessage;
  
  try {
    message = JSON.parse(rawMessage);
  } catch {
    sendTo(ws, { type: 'error', message: 'Invalid JSON' });
    return;
  }
  
  const connection = getConnection(ws);
  
  switch (message.type) {
    case 'connection:init':
      handleConnectionInit(ws, message.data, connection);
      break;
      
    case 'ping':
      // Heartbeat response
      sendTo(ws, { type: 'pong', timestamp: Date.now() });
      break;
      
    case 'room:state':
      // Cliente solicita estado actual
      if (connection) {
        handleRoomState(ws, connection.roomCode);
      }
      break;
      
    case 'ready':
      // Toggle ready status
      if (connection) {
        handleReady(ws, connection, message.data);
      }
      break;
      
    case 'leave':
      // Cliente abandona sala
      if (connection) {
        handleLeave(ws, connection);
      }
      break;
      
    default:
      sendTo(ws, { type: 'error', message: `Unknown message type: ${message.type}` });
  }
}

/**
 * Inicializar conexión - validar session_id y unirse a sala
 */
async function handleConnectionInit(
  ws: WebSocket,
  data: Record<string, any> | undefined,
  existingConnection: ReturnType<typeof getConnection>
): Promise<void> {
  const sessionId = data?.session_id;
  const roomCode = data?.room_code;

  if (!sessionId) {
    sendTo(ws, { type: 'error', message: 'session_id requerido' });
    return;
  }

  if (!roomCode) {
    sendTo(ws, { type: 'error', message: 'room_code requerido' });
    return;
  }

  // Validar que la sala existe (usar getRoomByCode para obtener session_ids reales)
  const room = await getRoomByCode(roomCode);
  if (!room) {
    sendTo(ws, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  const upperCode = room.code;

  // Determinar player name y número (comparando con session_ids reales)
  let playerName = 'Jugador';
  let isPlayer1 = false;
  let isHost = false;

  if (room.players.player1.session_id === sessionId) {
    playerName = room.players.player1.player_name || 'Jugador 1';
    isPlayer1 = true;
    isHost = true;
  } else if (room.players.player2.session_id === sessionId) {
    playerName = room.players.player2.player_name || 'Jugador 2';
    isPlayer1 = false;
    isHost = false;
  } else {
    sendTo(ws, { type: 'error', message: 'No perteneces a esta sala' });
    return;
  }

  // Registrar al cliente en la sala WebSocket ANTES de enviar cualquier mensaje
  const { joinRoom, getRoomClients } = await import('./roomManager');
  joinRoom(ws, upperCode, sessionId, playerName);

  // Enviar mensaje de confirmación SOLO al cliente que se acaba de conectar
  // NO enviar a todos - cada cliente se identifica por su session_id
  const playerNumber = isPlayer1 ? 1 : 2;
  
  // Obtener información del rival
  const rivalPlayerName = isPlayer1 
    ? room.players.player2.player_name 
    : room.players.player1.player_name;
  const rivalReady = isPlayer1 
    ? room.players.player2.ready 
    : room.players.player1.ready;
  const rivalConnected = isPlayer1 
    ? !!room.players.player2.session_id 
    : true; // Si no eres player1, player1 siempre existe (eres player2)
  
  // Enviar solo al cliente que se conectó
  sendTo(ws, {
    type: 'room:joined',
    data: {
      isHost,
      player_number: playerNumber,
      player_name: isPlayer1 ? room.players.player1.player_name : room.players.player2.player_name,
      roomCode: upperCode,
      state: room.state,
      your_ready: isPlayer1 ? room.players.player1.ready : room.players.player2.ready,
      opponent_ready: rivalReady,
      opponent_connected: rivalConnected,
      opponent_name: rivalPlayerName,
      // Nombres para mostrar en lista
      player1_name: room.players.player1.player_name,
      player2_name: room.players.player2.player_name
    }
  });
  
  console.log(`[WS] Cliente joined: ${playerName} (player${playerNumber}) -> sala ${upperCode}, isHost: ${isHost}`);

  // Broadcast a otros jugadores que alguien se unió (EXCLUYENDO al que se acaba de unir)
  // Solo si hay al menos otro jugador conectado (player1 siempre existe)
  broadcast(upperCode, {
    type: 'player:joined',
    data: {
      player_name: playerName,
      player_number: playerNumber,
      opponent_connected: true,
      player1_name: room.players.player1.player_name,
      player2_name: room.players.player2.player_name
    }
  }, ws);
}

/**
 * Obtener estado actual de la sala
 */
async function handleRoomState(ws: WebSocket, roomCode: string): Promise<void> {
  const connection = getConnection(ws);
  if (!connection) return;
  
  const result = await getRoom(roomCode, connection.sessionId);
  if (!result.success || !result.room) {
    sendTo(ws, { type: 'error', message: 'No se pudo obtener estado' });
    return;
  }
  
  const room = result.room;
  const isHost = room.isHost;
  const isPlayer1 = room.players.player1.session_id === connection.sessionId || 
                    room.players.player1.session_id === 'masked';
  
  sendTo(ws, {
    type: 'room:state',
    data: {
      state: room.state,
      your_ready: isPlayer1 ? room.players.player1.ready : room.players.player2.ready,
      opponent_ready: isPlayer1 ? room.players.player2.ready : room.players.player1.ready,
      opponent_connected: !!room.players.player2.player_name,
      isHost
    }
  });
}

/**
 * Toggle ready status
 */
async function handleReady(
  ws: WebSocket,
  connection: NonNullable<ReturnType<typeof getConnection>>,
  data: Record<string, any> | undefined
): Promise<void> {
  const ready = !!data?.ready;

  const result = await setReady(connection.roomCode, connection.sessionId, ready);
  if (!result.success) {
    sendTo(ws, { type: 'error', message: result.message });
    return;
  }

  // Obtener datos actualizados de la sala para broadcast
  const updatedRoom = await getRoomByCode(connection.roomCode);
  if (!updatedRoom) return;

  // Importar getRoomClients para enviar mensajes personalizados
  const { getRoomClients } = await import('./roomManager');
  const clients = getRoomClients(connection.roomCode);

  const isPlayer1 = updatedRoom.players.player1.session_id === connection.sessionId;
  const p1Ready = updatedRoom.players.player1.ready;
  const p2Ready = updatedRoom.players.player2.ready;
  const p2Connected = !!updatedRoom.players.player2.session_id;

  // Enviar mensaje personalizado a cada cliente
  for (const client of clients) {
    const clientIsPlayer1 = updatedRoom.players.player1.session_id === client.sessionId;
    
    // Cada cliente recibe su propio estado y el del oponente
    sendTo(client.ws, {
      type: 'room:state',
      data: {
        // El estado del cliente actual
        your_ready: clientIsPlayer1 ? p1Ready : p2Ready,
        // El estado del oponente
        opponent_ready: clientIsPlayer1 ? p2Ready : p1Ready,
        opponent_connected: p2Connected,
        player_number: clientIsPlayer1 ? 1 : 2,
        isHost: clientIsPlayer1, // player1 es siempre el host
        // Incluir los nombres para que el frontend pueda mostrar correctamente
        player1_name: updatedRoom.players.player1.player_name,
        player2_name: updatedRoom.players.player2.player_name
      }
    });
  }
}

/**
 * Manejar abandono de sala
 */
async function handleLeave(
  ws: WebSocket,
  connection: NonNullable<ReturnType<typeof getConnection>>
): Promise<void> {
  const { roomCode, sessionId } = connection;
  
  // Notificar a otros jugadores
  broadcast(roomCode, {
    type: 'player:left',
    data: {
      session_id: sessionId,
      player_name: connection.playerName
    }
  });
  
  // Remover de sala WebSocket
  leaveRoom(ws);
  
  // Llamar al servicio REST para actualizar la DB
  await leaveRoomService(roomCode, sessionId);
}

/**
 * Manejar desconexión
 */
export function handleClose(ws: WebSocket): void {
  const connection = leaveRoom(ws);
  
  if (connection) {
    // Notificar a otros jugadores
    broadcast(connection.roomCode, {
      type: 'player:left',
      data: {
        session_id: connection.sessionId,
        player_name: connection.playerName
      }
    });
  }
}