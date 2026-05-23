/**
 * WebSocket Message Handler (NUEVA ARQUITECTURA)
 * Procesa mensajes recibidos de los clientes
 * Usa sessionId en lugar de WebSocket para identificar clientes
 */

import {
  broadcast,
  sendTo,
  getConnection,
  getRoomPlayers,
  joinRoom as wsJoinRoom,
  leaveRoom as wsLeaveRoom,
  roomExists,
  getPlayerRoom,
  registerConnection
} from './roomManager';
import { getUserBySessionId } from '../db/users';
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

    case 'room:set_mode':
      // El host cambia el modo de juego (normal/random)
      const roomCode6 = getPlayerRoom(sessionId);
      if (roomCode6) {
        await handleSetGameMode(sessionId, roomCode6, message.data?.mode);
      }
      break;

    case 'room:start_random':
      // Iniciar modo aleatorio (cuando ambos jugadores están listos)
      const roomCode7 = getPlayerRoom(sessionId);
      if (roomCode7) {
        await handleStartRandomMode(sessionId, roomCode7);
      }
      break;

    // ========== EVENTOS DE BATALLA ==========

    case 'battle:action':
      // El jugador selecciona una acción (atacar o cambiar)
      console.log('[WS] battle:action received from', sessionId, 'data:', message.data);
      const roomCodeBattle = getPlayerRoom(sessionId);
      console.log('[WS] Room code from session:', roomCodeBattle);
      if (roomCodeBattle) {
        const { handleBattleAction } = await import('./battleHandler.js');
        await handleBattleAction(sessionId, roomCodeBattle, message.data);
      } else {
        console.log('[WS] No room found for session');
      }
      break;

    case 'battle:state':
      // Solicitar estado actual de la batalla
      const roomCodeState = getPlayerRoom(sessionId);
      if (roomCodeState) {
        const { getBattle } = await import('./battleHandler.js');
        const battle = getBattle(roomCodeState);
        if (battle) {
          sendTo(sessionId, {
            type: 'battle:state',
            data: {
              turn: battle.turn,
              phase: battle.phase,
              player1: {
                activePokemon: battle.players.player1.team[battle.players.player1.activePokemonIndex],
                team: battle.players.player1.team
              },
              player2: {
                activePokemon: battle.players.player2.team[battle.players.player2.activePokemonIndex],
                team: battle.players.player2.team
              }
            }
          });
        }
      }
      break;

    case 'battle:change':
      // Cambio de Pokémon (alternativa a battle:action)
      const roomCodeChange = getPlayerRoom(sessionId);
      if (roomCodeChange) {
        const { handleBattleAction } = await import('./battleHandler.js');
        await handleBattleAction(sessionId, roomCodeChange, {
          type: 'change',
          pokemonId: message.data?.pokemonId
        });
      }
      break;

    case 'battle:surrender':
      // El jugador se rinde
      console.log('[WS] battle:surrender received from', sessionId);
      const roomCodeSurrender = getPlayerRoom(sessionId);
      if (roomCodeSurrender) {
        const { handleBattleSurrender } = await import('./battleHandler.js');
        await handleBattleSurrender(sessionId, roomCodeSurrender);
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
    let hostLeft = false;
    try {
      const response = await fetch(`http://localhost:3000/api/rooms/${roomCode}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });
      const result = await response.json();
      hostLeft = result.host_left === true;
    } catch (e) {
      console.error('[WS] Error notifying leave to REST:', e);
    }

    // Si el host abandonó, notificar a todos los jugadores
    if (hostLeft) {
      broadcast(roomCode, {
        type: 'room:closed',
        data: { reason: 'host_left', message: 'El host abandonó la sala' }
      }, sessionId); // excludeSessionId es el que ya salió
      console.log(`[WS] Sala ${roomCode} cerrada por abandono del host`);
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
  console.log(`[DRAFT:PICK] handleDraftPick called: sessionId=${sessionId}, roomCode=${roomCode}`);

  const pokemon = data?.pokemon as TeamMember | undefined;
  console.log(`[DRAFT:PICK] Pokemon:`, pokemon);

  if (!pokemon || !pokemon.pokeapi_id) {
    console.log(`[DRAFT:PICK] ERROR: No pokemon data`);
    sendTo(sessionId, { type: 'error', message: 'Pokémon requerido para el pick' });
    return;
  }

  const result = await draftPick(roomCode, sessionId, pokemon);
  console.log(`[DRAFT:PICK] draftPick result:`, JSON.stringify(result));

  if (!result.success) {
    console.log(`[DRAFT:PICK] ERROR: ${result.message}`);
    sendTo(sessionId, { type: 'draft:error', message: result.message });
    return;
  }

  // Obtener sala actualizada para broadcast
  const room = await getRoomByCode(roomCode);
  if (!room) {
    console.log(`[DRAFT:PICK] ERROR: Room not found after pick`);
    return;
  }

  // Broadcast del pick a todos los jugadores
  const playerNumber = room.players.player1.session_id === sessionId ? 1 : 2;
  console.log(`[DRAFT:PICK] Player number: ${playerNumber}, Current turn: ${room.draft_state?.current_turn}`);

  // Log the in-memory room state for debugging
  const inMemoryPlayers = getRoomPlayers(roomCode);
  console.log(`[DRAFT:PICK] In-memory room players for broadcast:`, inMemoryPlayers);
  for (const sid of inMemoryPlayers) {
    const conn = getConnection(sid);
    console.log(`[DRAFT:PICK] Player ${sid}: connected=${!!conn}, readyState=${conn?.readyState}`);
  }

  console.log(`[DRAFT:PICK] Broadcasting draft:picked...`);
  // Adjuntar owner metadata al pokemon antes de broadcast
  let pokemonWithOwner = { ...pokemon };
  try {
    const user = await getUserBySessionId(sessionId);
    if (user) {
      // Respetar la elección del cliente (owner_shiny), pero validar que tenga el paquete
      const clientShiny = pokemon.owner_shiny;
      pokemonWithOwner.owner_shiny = clientShiny === true ? !!user.shiny_pack : false;
      pokemonWithOwner.owner = { session_id: sessionId, clerk_user_id: user.clerk_user_id, shiny_pack: !!user.shiny_pack };
    }
  } catch (e) {
    console.warn('[DRAFT] No se pudo obtener user meta para draft pick', e);
  }

  broadcast(roomCode, {
    type: 'draft:picked',
    data: {
      player_number: playerNumber,
      pokemon: pokemonWithOwner,
      current_turn: room.draft_state?.current_turn,
      picks_remaining: room.draft_state?.picks_remaining,
      draft_completed: result.draft_completed
    }
  });
  console.log(`[DRAFT:PICK] Broadcast sent`);

  // Verificar si ambos equipos tienen 6 pokemones para iniciar el contador
  const p1Picks = room.draft_picks?.player1 || [];
  const p2Picks = room.draft_picks?.player2 || [];

  if (p1Picks.length === 6 && p2Picks.length === 6) {
    console.log(`[DRAFT] Ambos equipos tienen 6 Pokémon - iniciando contador de 5 segundos`);
    
    // Verificar que no haya un contador ya activo (para no duplicar)
    const activeCountdown = room.draft_state?.countdown_started;
    
    if (!activeCountdown) {
      // Marcar que el countdown started
      const { updateDraftState } = await import('../services/roomService');
      await updateDraftState(roomCode, { countdown_started: true });
      
      // Enviar evento de countdown a ambos jugadores
      broadcast(roomCode, {
        type: 'draft:countdown',
        data: { seconds: 5 }
      });
      
      // Iniciar batalla después de 5 segundos
      setTimeout(async () => {
        await startBattleFromDraft(roomCode);
      }, 5000);
    }
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
  // Inyectar metadata owner en cada pick para el cliente
  const p1Session = room.players.player1.session_id;
  const p2Session = room.players.player2.session_id;

  const mapWithOwner = async (arr: any[], ownerSession?: string | null) => {
    if (!arr || arr.length === 0) return [];
    const user = ownerSession ? await getUserBySessionId(ownerSession) : null;
    const hasShinyPack = user ? !!user.shiny_pack : false;
    return arr.map(p => {
      // Respetar stored owner_shiny, pero validar que tenga el paquete
      const storedShiny = p.owner_shiny;
      return {
        ...p,
        owner_shiny: storedShiny === true ? hasShinyPack : false,
        owner: user ? { session_id: ownerSession, clerk_user_id: user.clerk_user_id, shiny_pack: hasShinyPack } : undefined
      };
    });
  };

  const [player1WithOwner, player2WithOwner] = await Promise.all([
    mapWithOwner(room.draft_picks.player1 || [], p1Session),
    mapWithOwner(room.draft_picks.player2 || [], p2Session)
  ]);

  sendTo(sessionId, {
    type: 'draft:picks',
    data: {
      player1: player1WithOwner,
      player2: player2WithOwner,
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
 * Verificar si ambos equipos tienen 6 Pokémon y iniciar contador automático
 */
async function checkAndStartBattleCountdown(roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode);
  
  if (!room || !room.draft_picks) return;
  
  const p1Picks = room.draft_picks.player1 || [];
  const p2Picks = room.draft_picks.player2 || [];
  
  // Solo iniciar si ambos tienen 6 Pokémon
  if (p1Picks.length === 6 && p2Picks.length === 6) {
    console.log(`[DRAFT] Ambos equipos tienen 6 Pokémon - iniciando contador de 5 segundos`);
    
    // Enviar evento de countdown a ambos jugadores
    broadcast(roomCode, {
      type: 'draft:countdown',
      data: { seconds: 5 }
    });
    
    // Iniciar batalla después de 5 segundos
    setTimeout(async () => {
      await startBattleFromDraft(roomCode);
    }, 5000);
  }
}

/**
 * Iniciar la batalla desde el draft
 */
async function startBattleFromDraft(roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode);
  
  if (!room) return;
  
  // Importar servicios
  const { changeRoomState } = await import('../services/roomService');
  
  // Cambiar estado a in_battle
  await changeRoomState(roomCode, '', 'in_battle');
  
  // Importar y llamar al inicio de batalla
  const { startBattle } = await import('./battleHandler.js');
  const battle = await startBattle(roomCode, room);
  
  if (battle) {
    console.log(`[BATTLE] Starting in room ${roomCode}`);
    
    // Notificar a ambos jugadores que la batalla está por comenzar
    broadcast(roomCode, {
      type: 'battle:starting',
      data: { loading_seconds: 5 }
    });
    
    // Después de 5 segundos, enviar battle:start (igual que modo aleatorio)
    setTimeout(async () => {
      const { sendBattleStart } = await import('./battleHandler.js');
      sendBattleStart(roomCode);
    }, 5000);
  }
}

/**
 * Confirmar equipo (YA NO SE USA - se elimina el botón)
 * Mantenido por compatibilidad pero ahora hace lo mismo que checkAndStartBattleCountdown
 */
async function handleDraftConfirm(sessionId: string, roomCode: string): Promise<void> {
  // Verificar que el equipo tiene 6 Pokémon
  const room = await getRoomByCode(roomCode);
  
  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  const playerIsP1 = room.players.player1.session_id === sessionId;
  const team = playerIsP1 ? room.draft_picks?.player1 : room.draft_picks?.player2;

  if (!team || team.length !== 6) {
    sendTo(sessionId, { type: 'error', message: 'Necesitas seleccionar 6 Pokémon' });
    return;
  }

  // Ahora verificar si el otro también tiene 6 para iniciar el contador
  const otherTeam = playerIsP1 ? room.draft_picks?.player2 : room.draft_picks?.player1;
  
  if (otherTeam && otherTeam.length === 6) {
    // Ambos tienen 6 → iniciar contador
    await checkAndStartBattleCountdown(roomCode);
  } else {
    // El otro no tiene 6 aún → esperar
    sendTo(sessionId, { 
      type: 'draft:waiting', 
      data: { message: 'Esperando a que el oponente seleccione sus 6 Pokémon' } 
    });
  }
}

/**
 * Cambiar modo de juego (solo el host puede)
 */
async function handleSetGameMode(sessionId: string, roomCode: string, mode: string): Promise<void> {
  const room = await getRoomByCode(roomCode);
  
  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  // Solo el host (player1) puede cambiar el modo
  if (room.players.player1.session_id !== sessionId) {
    sendTo(sessionId, { type: 'error', message: 'Solo el host puede cambiar el modo de juego' });
    return;
  }

  const newMode = mode === 'random' ? 'random' : 'normal';
  
  // Actualizar el modo
  const { changeRoomGameMode } = await import('../services/roomService');
  await changeRoomGameMode(roomCode, newMode);

  // Notificar a ambos jugadores
  broadcast(roomCode, {
    type: 'room:mode_changed',
    data: { mode: newMode }
  });
  
  console.log(`[ROOM] Modo de juego cambiado a: ${newMode}`);
}

/**
 * Iniciar modo aleatorio (cuando ambos jugadores están listos)
 */
async function handleStartRandomMode(sessionId: string, roomCode: string): Promise<void> {
  const room = await getRoomByCode(roomCode);
  
  if (!room) {
    sendTo(sessionId, { type: 'error', message: 'Sala no encontrada' });
    return;
  }

  // Verificar que el modo sea random
  if (room.game_mode !== 'random') {
    sendTo(sessionId, { type: 'error', message: 'El modo de juego no es aleatorio' });
    return;
  }

  // Verificar que ambos jugadores estén conectados
  if (!room.players.player1.session_id || !room.players.player2.session_id) {
    sendTo(sessionId, { type: 'error', message: 'Ambos jugadores deben estar en la sala' });
    return;
  }

  console.log(`[RANDOM] Generando equipos aleatorios para sala ${roomCode}`);

  // Generar equipos aleatorios para ambos jugadores
  const { generateRandomTeam } = await import('../services/randomModeService');
  
  const player1Team = await generateRandomTeam();
  const player2Team = await generateRandomTeam();

  // Guardar los equipos
  const { setRandomTeams } = await import('../services/roomService');
  await setRandomTeams(roomCode, player1Team, player2Team);

  // Adjuntar owner metadata a los equipos antes de enviar
  const p1Session = room.players.player1.session_id;
  const p2Session = room.players.player2.session_id;

  const attachOwnerToTeam = async (team: any[], ownerSession?: string | null) => {
    const user = ownerSession ? await getUserBySessionId(ownerSession) : null;
    return team.map(p => ({
      ...p,
      owner_shiny: user ? !!user.shiny_pack : undefined,
      owner: user ? { session_id: ownerSession, clerk_user_id: user.clerk_user_id, shiny_pack: !!user.shiny_pack } : undefined
    }));
  };

  const [player1WithOwner, player2WithOwner] = await Promise.all([
    attachOwnerToTeam(player1Team, p1Session),
    attachOwnerToTeam(player2Team, p2Session)
  ]);

  // Enviar los equipos a ambos jugadores
  broadcast(roomCode, {
    type: 'random:teams_generated',
    data: {
      player1_team: player1WithOwner,
      player2_team: player2WithOwner
    }
  });

  // Iniciar contador de 5 segundos y luego batalla
  broadcast(roomCode, {
    type: 'draft:countdown',
    data: { seconds: 5 }
  });

  setTimeout(async () => {
    // Obtener la sala actualizada con los equipos aleatorios
    const updatedRoom = await getRoomByCode(roomCode);
    if (!updatedRoom) {
      console.error('[RANDOM] Sala no encontrada al iniciar batalla');
      return;
    }
    
    // Cambiar estado a in_battle
    const { changeRoomState } = await import('../services/roomService');
    await changeRoomState(roomCode, '', 'in_battle');

    // Crear estado de batalla (sin enviar battle:start todavía)
    const { startBattle, sendBattleStart } = await import('./battleHandler.js');
    const battle = await startBattle(roomCode, updatedRoom);
    
    if (battle) {
      // Notificar que la batalla está por comenzar
      broadcast(roomCode, {
        type: 'battle:starting',
        data: { loading_seconds: 5 }
      });
      
      // Después de 5 segundos, enviar battle:start
      setTimeout(() => {
        sendBattleStart(roomCode);
      }, 5000);
    }
  }, 5000);
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