/**
 * WebSocket Message Handler
 * Procesa mensajes recibidos de los clientes
 */

import { broadcast, sendTo, getConnection, leaveRoom } from './roomManager';
import { getRoom, setReady, leaveRoom as leaveRoomService, draftPick } from '../services/roomService';
import { getRoomByCode } from '../db/rooms';
import type { Room, TeamMember } from '../db/rooms';

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
export async function handleMessage(ws: WebSocket, rawMessage: string): Promise<void> {
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

    case 'draft:pick':
      // Realizar un pick en el draft
      if (connection) {
        await handleDraftPick(ws, connection, message.data);
      }
      break;

    case 'draft:state':
      // Solicitar estado del draft
      if (connection) {
        await handleDraftState(ws, connection);
      }
      break;

    case 'draft:picks':
      // Solicitar picks de ambos jugadores
      if (connection) {
        await handleDraftPicks(ws, connection);
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
      opponent_connected: !!room.players.player2.player_name,
      isHost
    }
  });
}

/**
 * Toggle ready status (ya no se usa, mantenido por compatibilidad)
 */
async function handleReady(
  ws: WebSocket,
  connection: NonNullable<ReturnType<typeof getConnection>>,
  data: Record<string, any> | undefined
): Promise<void> {
  // El sistema de ready fue eliminado
  // Mantenido por compatibilidad, pero ya no hace nada
  sendTo(ws, { type: 'room:state', data: { state: 'waiting' } });
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

// ============ HANDLERS DE DRAFT ============

/**
 * Realizar un pick en el draft
 */
async function handleDraftPick(
  ws: WebSocket,
  connection: NonNullable<ReturnType<typeof getConnection>>,
  data: Record<string, any> | undefined
): Promise<void> {
  const pokemon = data?.pokemon as TeamMember | undefined;

  if (!pokemon || !pokemon.pokeapi_id) {
    sendTo(ws, { type: 'error', message: 'Pokémon requerido para el pick' });
    return;
  }

  const result = await draftPick(connection.roomCode, connection.sessionId, pokemon);

  if (!result.success) {
    sendTo(ws, { type: 'draft:error', message: result.message });
    return;
  }

  // Obtener sala actualizada para broadcast
  const room = await getRoomByCode(connection.roomCode);
  if (!room) return;

  // Broadcast del pick a todos los jugadores
  const playerNumber = room.players.player1.session_id === connection.sessionId ? 1 : 2;

  broadcast(connection.roomCode, {
    type: 'draft:picked',
    data: {
      player_number: playerNumber,
      pokemon: pokemon,
      current_turn: room.draft_state?.current_turn,
      picks_remaining: room.draft_state?.picks_remaining,
      draft_completed: result.draft_completed
    }
  });

  // Si el draft se completó, cambiar estado a in_battle
  if (result.draft_completed && room.state !== 'in_battle') {
    const { changeRoomState } = await import('../services/roomService');
    await changeRoomState(connection.roomCode, connection.sessionId, 'in_battle');

    broadcast(connection.roomCode, {
      type: 'draft:completed',
      data: {
        team_1: room.draft_picks.player1,
        team_2: room.draft_picks.player2
      }
    });
  }
}

/**
 * Obtener estado del draft
 */
async function handleDraftState(
  ws: WebSocket,
  connection: NonNullable<ReturnType<typeof getConnection>>
): Promise<void> {
  const { getDraftState } = await import('../services/roomService');
  const result = await getDraftState(connection.roomCode, connection.sessionId);

  if (!result.success || !result.draft) {
    sendTo(ws, { type: 'draft:state', data: { started: false } });
    return;
  }

  // Determinar si es el turno del cliente
  const room = await getRoomByCode(connection.roomCode);
  if (!room) return;

  const isPlayer1 = room.players.player1.session_id === connection.sessionId;
  const isMyTurn = result.draft.current_turn === (isPlayer1 ? 'player1' : 'player2');

  sendTo(ws, {
    type: 'draft:state',
    data: {
      ...result.draft,
      is_my_turn: isMyTurn,
      player_number: isPlayer1 ? 1 : 2
    }
  });
}

/**
 * Obtener picks de ambos jugadores
 */
async function handleDraftPicks(
  ws: WebSocket,
  connection: NonNullable<ReturnType<typeof getConnection>>
): Promise<void> {
  const room = await getRoomByCode(connection.roomCode);

  if (!room) {
    sendTo(ws, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  sendTo(ws, {
    type: 'draft:picks',
    data: {
      player1: room.draft_picks.player1,
      player2: room.draft_picks.player2,
      current_turn: room.draft_state?.current_turn
    }
  });
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