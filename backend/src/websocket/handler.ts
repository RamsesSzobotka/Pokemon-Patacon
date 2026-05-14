/**
 * WebSocket Message Handler (NUEVA ARQUITECTURA)
 * Procesa mensajes recibidos de los clientes
 * Usa sessionId en lugar de WebSocket para identificar clientes
 */

import {
  broadcast,
  sendTo,
  getConnection,
  joinRoom as wsJoinRoom,
  leaveRoom as wsLeaveRoom,
  roomExists,
  getPlayerRoom,
  registerConnection
} from './roomManager';
import { getRoom, setReady, leaveRoom as leaveRoomService, draftPick } from '../services/roomService';
import { getRoomByCode } from '../db/rooms';
import type { Room, TeamMember } from '../db/rooms';

interface WSMessage {
  type: string;
  data?: Record<string, any>;
}

// Tipos para WebSocket de Bun
interface BunWebSocket {
  send(data: string | ArrayBuffer | Blob): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}

/**
 * Manejar mensaje recibido de un cliente (NUEVA ARQUITECTURA)
 * @param sessionId Identificador de sesión del cliente
 * @param rawMessage Mensaje JSON recibido
 */
export async function handleMessageFromSession(sessionId: string, rawMessage: string): Promise<void> {
  let message: WSMessage;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    sendTo(sessionId, { type: 'error', message: 'Invalid JSON' });
    return;
  }

  // Asegurar que la conexión esté registrada
  const connection = getConnection(sessionId);
  if (!connection) {
    sendTo(sessionId, { type: 'error', message: 'Conexión no registrada' });
    return;
  }

  // El servidor debe tener registro de conexiones aunque no estén en sala
  // Esto ya lo hace roomManager.registerConnection

  switch (message.type) {
    // ========== NUEVOS EVENTOS DE LA NUEVA ARQUITECTURA ==========

    case 'CREATE_ROOM':
      // Crear una nueva sala y unirse a ella
      await handleCreateRoom(sessionId, message.data);
      break;

    case 'JOIN_ROOM':
      // Unirse a una sala existente
      await handleJoinRoom(sessionId, message.data);
      break;

    case 'LEAVE_ROOM':
      // Salir de la sala actual
      await handleLeaveRoom(sessionId);
      break;

    case 'RECONNECT':
      // Reconectar a una sala existente
      await handleReconnect(sessionId, message.data);
      break;

    // ========== EVENTOS ORIGINALES (mantenidos por compatibilidad) ==========

    case 'connection:init':
      // Este evento ahora simplemente une a la sala
      await handleConnectionInit(sessionId, message.data);
      break;

    case 'ping':
      // Heartbeat response
      sendTo(sessionId, { type: 'pong', timestamp: Date.now() });
      break;

    case 'room:state':
      // Cliente solicita estado actual
      const currentRoom = getPlayerRoom(sessionId);
      if (currentRoom) {
        await handleRoomState(sessionId, currentRoom);
      }
      break;

    case 'ready':
      // Toggle ready status (ya no se usa, mantenido por compatibilidad)
      const roomCode = getPlayerRoom(sessionId);
      if (roomCode) {
        sendTo(sessionId, { type: 'room:state', data: { state: 'waiting' } });
      }
      break;

    case 'leave':
      // Cliente abandona sala
      await handleLeaveRoom(sessionId);
      break;

    case 'draft:pick':
      // Realizar un pick en el draft
      const currentRoomCode = getPlayerRoom(sessionId);
      if (currentRoomCode) {
        await handleDraftPick(sessionId, currentRoomCode, message.data);
      }
      break;

    case 'draft:state':
      // Solicitar estado del draft
      const roomCode2 = getPlayerRoom(sessionId);
      if (roomCode2) {
        await handleDraftState(sessionId, roomCode2);
      }
      break;

    case 'draft:picks':
      // Solicitar picks de ambos jugadores
      const roomCode3 = getPlayerRoom(sessionId);
      if (roomCode3) {
        await handleDraftPicks(sessionId, roomCode3);
      }
      break;

    case 'draft:start':
      // Iniciar draft (solo el host)
      const roomCode4 = getPlayerRoom(sessionId);
      if (roomCode4) {
        await handleDraftStart(sessionId, roomCode4);
      }
      break;

    case 'draft:confirm':
      // Confirmar equipo y terminar draft
      const roomCode5 = getPlayerRoom(sessionId);
      if (roomCode5) {
        await handleDraftConfirm(sessionId, roomCode5);
      }
      break;

    default:
      sendTo(sessionId, { type: 'error', message: `Unknown message type: ${message.type}` });
  }
}

/**
 * CREAR NUEVA SALA
 * El cliente crea una sala y se une automáticamente
 */
async function handleCreateRoom(sessionId: string, data: Record<string, any> | undefined): Promise<void> {
  const playerName = data?.player_name || 'Jugador';

  // Crear sala usando el servicio REST
  try {
    const response = await fetch('http://localhost:3000/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        player_name: playerName
      })
    });

    const result = await response.json();

    if (!result.success) {
      sendTo(sessionId, { type: 'error', message: result.error || 'Error al crear sala' });
      return;
    }

    const roomCode = result.code;

    // Unirse a la sala en el WebSocket (estructura lógica)
    wsJoinRoom(sessionId, roomCode, playerName);

    // Responder al cliente
    sendTo(sessionId, {
      type: 'room:created',
      data: {
        roomCode,
        player_name: playerName,
        player_number: 1,
        isHost: true
      }
    });

    console.log(`[WS] Sala ${roomCode} creada por ${playerName} (${sessionId})`);

  } catch (error) {
    console.error('[WS] Error creando sala:', error);
    sendTo(sessionId, { type: 'error', message: 'Error al crear sala' });
  }
}

/**
 * UNIRSE A SALA EXISTENTE
 */
async function handleJoinRoom(sessionId: string, data: Record<string, any> | undefined): Promise<void> {
  const roomCode = data?.roomId;
  const playerName = data?.player_name || 'Jugador';

  if (!roomCode) {
    sendTo(sessionId, { type: 'error', message: 'roomId requerido' });
    return;
  }

  // Unirse a la sala usando el servicio REST
  try {
    const response = await fetch(`http://localhost:3000/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        player_name: playerName
      })
    });

    const result = await response.json();

    if (!result.success) {
      sendTo(sessionId, { type: 'error', message: result.error || 'Error al unirse a la sala' });
      return;
    }

    // Unirse a la sala en el WebSocket (estructura lógica)
    wsJoinRoom(sessionId, roomCode, playerName);

    // Obtener información de la sala para enviar al cliente
    const room = await getRoomByCode(roomCode);
    const playerNumber = result.player_number || 2;
    const isHost = playerNumber === 1;

    // Si es el primer jugador (player1), enviar 'room:created', sino 'room:joined'
    const eventType = isHost ? 'room:created' : 'room:joined';

    sendTo(sessionId, {
      type: eventType,
      data: {
        roomCode,
        player_name: playerName,
        player_number: playerNumber,
        isHost,
        state: room?.state || 'waiting',
        opponent_connected: playerNumber === 1 ? false : !!room?.players?.player1?.session_id,
        player1_name: room?.players?.player1?.player_name,
        player2_name: room?.players?.player2?.player_name
      }
    });

    // Notificar al otro jugador
    broadcast(roomCode, {
      type: 'player:joined',
      data: {
        player_name: playerName,
        player_number: result.player_number || 2
      }
    }, sessionId);

    console.log(`[WS] Jugador ${playerName} (${sessionId}) se unió a sala ${roomCode}`);

  } catch (error) {
    console.error('[WS] Error uniéndose a sala:', error);
    sendTo(sessionId, { type: 'error', message: 'Error al unirse a la sala' });
  }
}

/**
 * SALIR DE LA SALA ACTUAL
 */
async function handleLeaveRoom(sessionId: string): Promise<void> {
  const roomCode = wsLeaveRoom(sessionId);

  if (roomCode) {
    // Notificar al servicio REST
    try {
      await fetch(`http://localhost:3000/api/rooms/${roomCode}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
    } catch (e) {
      console.error('[WS] Error notifying leave to REST:', e);
    }
  }

  sendTo(sessionId, {
    type: 'room:left',
    data: { roomCode }
  });

  console.log(`[WS] Jugador ${sessionId} salió de la sala`);
}

/**
 * RECONECTAR A UNA SALA EXISTENTE
 * El cliente se reconecta y recupera su estado
 */
async function handleReconnect(sessionId: string, data: Record<string, any> | undefined): Promise<void> {
  const roomCode = data?.roomCode;

  if (!roomCode) {
    sendTo(sessionId, { type: 'error', message: 'roomCode requerido para reconectar' });
    return;
  }

  // Verificar que la sala existe
  const room = await getRoomByCode(roomCode);

  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'La sala ya no existe' });
    return;
  }

  // Determinar el número de jugador
  let playerNumber = 0;
  let playerName = 'Jugador';
  let isHost = false;

  if (room.players.player1.session_id === sessionId) {
    playerNumber = 1;
    playerName = room.players.player1.player_name || 'Jugador 1';
    isHost = true;
  } else if (room.players.player2.session_id === sessionId) {
    playerNumber = 2;
    playerName = room.players.player2.player_name || 'Jugador 2';
    isHost = false;
  } else {
    sendTo(sessionId, { type: 'error', message: 'No perteneces a esta sala' });
    return;
  }

  // Volver a unir a la sala
  wsJoinRoom(sessionId, roomCode, playerName);

  // Enviar estado completo
  sendTo(sessionId, {
    type: 'room:reconnected',
    data: {
      roomCode,
      player_number: playerNumber,
      player_name: playerName,
      isHost,
      state: room.state,
      opponent_connected: playerNumber === 1
        ? !!room.players.player2.session_id
        : true,
      player1_name: room.players.player1.player_name,
      player2_name: room.players.player2.player_name
    }
  });

  // Notificar a los demás
  broadcast(roomCode, {
    type: 'player:reconnected',
    data: {
      session_id: sessionId,
      player_name: playerName,
      player_number: playerNumber
    }
  }, sessionId);

  console.log(`[WS] Jugador ${sessionId} reconectado a sala ${roomCode}`);
}

/**
 * Connection init (compatibilidad con cliente anterior)
 */
async function handleConnectionInit(
  sessionId: string,
  data: Record<string, any> | undefined
): Promise<void> {
  const roomCode = data?.room_code;
  const playerName = data?.player_name || 'Jugador';

  if (!roomCode) {
    sendTo(sessionId, { type: 'error', message: 'room_code requerido' });
    return;
  }

  // Unirse a la sala
  wsJoinRoom(sessionId, roomCode, playerName);

  // Obtener información de la sala
  const room = await getRoomByCode(roomCode);

  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  // Determinar número de jugador
  let playerNumber = 0;
  let isHost = false;

  if (room.players.player1.session_id === sessionId) {
    playerNumber = 1;
    isHost = true;
  } else if (room.players.player2.session_id === sessionId) {
    playerNumber = 2;
  }

  // Si es el host (player1), enviar 'room:created', sino 'room:joined'
  const eventType = isHost ? 'room:created' : 'room:joined';

  sendTo(sessionId, {
    type: eventType,
    data: {
      roomCode,
      player_number: playerNumber,
      player_name: playerName,
      isHost,
      state: room.state,
      opponent_connected: playerNumber === 1
        ? !!room.players.player2.session_id
        : true,
      player1_name: room.players.player1.player_name,
      player2_name: room.players.player2.player_name
    }
  });

  // Broadcast a otros
  broadcast(roomCode, {
    type: 'player:joined',
    data: {
      player_name: playerName,
      player_number: playerNumber
    }
  }, sessionId);
}

/**
 * Obtener estado actual de la sala
 */
async function handleRoomState(sessionId: string, roomCode: string): Promise<void> {
  const result = await getRoom(roomCode, sessionId);

  if (!result.success || !result.room) {
    sendTo(sessionId, { type: 'error', message: 'No se pudo obtener estado' });
    return;
  }

  const room = result.room;

  sendTo(sessionId, {
    type: 'room:state',
    data: {
      state: room.state,
      opponent_connected: !!room.players.player2.player_name,
      isHost: room.isHost
    }
  });
}

/**
 * Realizar un pick en el draft
 */
async function handleDraftPick(
  sessionId: string,
  roomCode: string,
  data: Record<string, any> | undefined
): Promise<void> {
  const pokemon = data?.pokemon as TeamMember | undefined;

  if (!pokemon || !pokemon.pokeapi_id) {
    sendTo(sessionId, { type: 'error', message: 'Pokémon requerido para el pick' });
    return;
  }

  const result = await draftPick(roomCode, sessionId, pokemon);

  if (!result.success) {
    sendTo(sessionId, { type: 'draft:error', message: result.message });
    return;
  }

  // Obtener sala actualizada para broadcast
  const room = await getRoomByCode(roomCode);
  if (!room) return;

  // Broadcast del pick a todos los jugadores
  const playerNumber = room.players.player1.session_id === sessionId ? 1 : 2;

  broadcast(roomCode, {
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
    await changeRoomState(roomCode, sessionId, 'in_battle');

    broadcast(roomCode, {
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
async function handleDraftState(sessionId: string, roomCode: string): Promise<void> {
  const { getDraftState } = await import('../services/roomService');
  const result = await getDraftState(roomCode, sessionId);

  if (!result.success || !result.draft) {
    sendTo(sessionId, { type: 'draft:state', data: { started: false } });
    return;
  }

  // Determinar si es el turno del cliente
  const room = await getRoomByCode(roomCode);
  if (!room) return;

  const isPlayer1 = room.players.player1.session_id === sessionId;
  const isMyTurn = result.draft.current_turn === (isPlayer1 ? 'player1' : 'player2');

  sendTo(sessionId, {
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
async function handleDraftPicks(sessionId: string, roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode);

  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  sendTo(sessionId, {
    type: 'draft:picks',
    data: {
      player1: room.draft_picks.player1,
      player2: room.draft_picks.player2,
      current_turn: room.draft_state?.current_turn
    }
  });
}

/**
 * Iniciar el draft (solo el host/player1 puede iniciar)
 */
async function handleDraftStart(sessionId: string, roomCode: string): Promise<void> {
  console.log(`[DRAFT] handleDraftStart called: sessionId=${sessionId}, roomCode=${roomCode}`);

  const room = await getRoomByCode(roomCode);
  console.log(`[DRAFT] Room found:`, room ? 'yes' : 'no');
  console.log(`[DRAFT] Room players:`, room?.players);

  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  // Verificar que es el host (player1)
  console.log(`[DRAFT] Checking host: room.player1.session_id=${room.players.player1.session_id}, sessionId=${sessionId}`);
  if (room.players.player1.session_id !== sessionId) {
    sendTo(sessionId, { type: 'error', message: 'Solo el creador puede iniciar el draft' });
    return;
  }

  // Verificar que hay 2 jugadores
  console.log(`[DRAFT] Checking player2:`, room.players.player2.session_id);
  if (!room.players.player2.session_id) {
    sendTo(sessionId, { type: 'error', message: 'Necesitas un oponente para iniciar el draft' });
    return;
  }

  // Importar servicios necesarios
  const { changeRoomState, getDraftState } = await import('../services/roomService');

  // Cambiar estado a in_draft e inicializar draft
  const result = await changeRoomState(roomCode, sessionId, 'in_draft');

  if (!result.success) {
    sendTo(sessionId, { type: 'error', message: result.message || 'No se pudo iniciar el draft' });
    return;
  }

  // Obtener estado del draft
  const draftResult = await getDraftState(roomCode, sessionId);

  // Broadcast a ambos jugadores que el draft empezó
  broadcast(roomCode, {
    type: 'draft:started',
    data: {
      current_turn: draftResult.draft?.current_turn || 'player1',
      picks_remaining: draftResult.draft?.picks_remaining || { player1: 6, player2: 6 },
      started: true
    }
  });

  console.log(`[DRAFT] Started in room ${roomCode}, turn: ${draftResult.draft?.current_turn}`);
}

/**
 * Confirmar equipo (terminar draft)
 */
async function handleDraftConfirm(sessionId: string, roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode);

  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  // Verificar que el draft esté completo (ambos tienen 6 Pokémon)
  if (!room.draft_picks || !room.draft_state?.completed) {
    sendTo(sessionId, { type: 'error', message: 'El draft no está completo' });
    return;
  }

  // Verificar que el equipo tiene 6 Pokémon
  const playerIsP1 = room.players.player1.session_id === sessionId;
  const team = playerIsP1 ? room.draft_picks.player1 : room.draft_picks.player2;

  if (team.length !== 6) {
    sendTo(sessionId, { type: 'error', message: 'Necesitas seleccionar 6 Pokémon' });
    return;
  }

  // Importar servicios
  const { changeRoomState } = await import('../services/roomService');

  // Cambiar estado a in_battle
  const result = await changeRoomState(roomCode, sessionId, 'in_battle');

  if (!result.success) {
    sendTo(sessionId, { type: 'error', message: 'No se pudo iniciar la batalla' });
    return;
  }

  // Broadcast de inicio de batalla
  broadcast(roomCode, {
    type: 'battle:starting',
    data: {
      team_1: room.draft_picks.player1,
      team_2: room.draft_picks.player2,
      message: '¡La batalla está por comenzar!'
    }
  });

  console.log(`[BATTLE] Starting in room ${roomCode}`);
}

/**
 * Manejar desconexión (por sessionId)
 */
export function handleClose(sessionId: string): void {
  // El roomManager ya maneja la limpieza de la conexión
  // Aquí solo necesitamos notificar a otros jugadores en la sala
  const roomCode = getPlayerRoom(sessionId);

  if (roomCode) {
    broadcast(roomCode, {
      type: 'player:left',
      data: { session_id: sessionId }
    });
  }
}

// Mantener la función original para compatibilidad (deprecated)
export async function handleMessage(ws: any, rawMessage: string): Promise<void> {
  console.warn('[WS] handleMessage deprecated, usar handleMessageFromSession');
}