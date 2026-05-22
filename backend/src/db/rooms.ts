import { Collection, Db, ObjectId } from 'mongodb';
import { getDB } from './mongodb';

let roomsCollection: Collection | null = null;

export interface TeamMember {
  pokeapi_id: number;
  selected_moves: number[];
  is_legendary?: boolean;
  name?: string;
  // Owner metadata attached by server for clients
  owner_shiny?: boolean;
  owner?: {
    session_id?: string | null;
    clerk_user_id?: string | null;
    shiny_pack?: boolean;
  };
}

export interface DraftState {
  current_turn: 'player1' | 'player2';
  picks_remaining: {
    player1: number;
    player2: number;
  };
  banned_pokemon: number[];
  available_pokemon: number[];
  pick_order: number;
  started: boolean;
  completed: boolean;
}

export interface RoomPlayer {
  session_id: string | null;
  player_name: string | null;
  joined_at: Date | null;
  ready: boolean;
  team?: TeamMember[];
}

export interface Room {
  _id: ObjectId;
  code: string;
  created_at: Date;
  expires_at: Date;
  state: 'waiting' | 'in_draft' | 'in_battle' | 'finished';
  game_mode: 'normal' | 'random';  // Modo de juego: normal (draft) o random
  players: {
    player1: RoomPlayer;
    player2: RoomPlayer;
  };
  team_1: TeamMember[] | null;
  team_2: TeamMember[] | null;
  max_players: number;
  battle_id: ObjectId | null;
  winner: 'player1' | 'player2' | null;
  started_at: Date | null;
  finished_at: Date | null;
  // Sistema de Draft
  draft_state: DraftState | null;
  draft_picks: {
    player1: TeamMember[];
    player2: TeamMember[];
  };
}

function getRoomsCollection(): Collection {
  if (!roomsCollection) {
    const db = getDB();
    roomsCollection = db.collection('rooms');
  }
  return roomsCollection;
}

/**
 * Genera un código de sala único de 6 caracteres
 * Excluye: I, O, 0, 1 para evitar confusión
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * Crea una nueva sala
 * @param creatorSessionId - Session ID del creador
 * @param playerName - Nombre del jugador creador
 * @returns La sala creada
 */
export async function createRoom(creatorSessionId: string, playerName: string = 'Jugador 1'): Promise<Room> {
  const collection = getRoomsCollection();
  
  // Generar código único
  let code = generateRoomCode();
  let exists = await collection.findOne({ code });
  
  // Intentar hasta encontrar código único (máx 10 intentos)
  let attempts = 0;
  while (exists && attempts < 10) {
    code = generateRoomCode();
    exists = await collection.findOne({ code });
    attempts++;
  }
  
  if (exists) {
    throw new Error('No se pudo generar un código único');
  }
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutos
  
  const room: Partial<Room> = {
    code,
    created_at: now,
    expires_at: expiresAt,
    state: 'waiting',
    game_mode: 'normal',  // Por defecto modo normal (draft)
    players: {
      player1: {
        session_id: creatorSessionId,
        player_name: playerName,
        joined_at: now,
        ready: false
      },
      player2: {
        session_id: null,
        player_name: null,
        joined_at: null,
        ready: false
      }
    },
    team_1: null,
    team_2: null,
    max_players: 2,
    battle_id: null,
    winner: null,
    started_at: null,
    finished_at: null,
    // Inicializar draft
    draft_state: null,
    draft_picks: {
      player1: [],
      player2: []
    }
  };
  
  const result = await collection.insertOne(room);
  
  return {
    _id: result.insertedId,
    ...room
  } as Room;
}

/**
 * Busca una sala por código
 * @param code - Código de la sala
 * @returns La sala o null si no existe
 */
export async function getRoomByCode(code: string): Promise<Room | null> {
  const collection = getRoomsCollection();
  // Normalizar a mayúsculas para buscar
  const normalizedCode = code?.toUpperCase().trim() || '';
  console.log(`[DEBUG] getRoomByCode: buscando "${normalizedCode}" (original: "${code}")`);
  
  const room = await collection.findOne({ code: normalizedCode }) as Room | null;
  if (!room) {
    // Debug: listar códigos disponibles
    const allRooms = await collection.find({}, { projection: { code: 1 } }).toArray();
    console.log(`[DEBUG] Salas existentes en DB:`, allRooms.map(r => r.code));
  } else {
    console.log(`[DEBUG] Sala encontrada: ${room.code}, state: ${room.state}, players: p1=${room.players.player1.session_id ? 'yes' : 'no'}, p2=${room.players.player2.session_id ? 'yes' : 'no'}`);
  }
  return room;
}

/**
 * Busca una sala por session ID (para verificar si ya está en una)
 * @param sessionId - Session ID del jugador
 * @returns La sala o null
 */
export async function getRoomBySession(sessionId: string): Promise<Room | null> {
  const collection = getRoomsCollection();
  return await collection.findOne({
    $or: [
      { 'players.player1.session_id': sessionId },
      { 'players.player2.session_id': sessionId }
    ],
    state: { $in: ['waiting', 'in_draft', 'in_battle'] }
  }) as Room | null;
}

/**
 * Unir a un jugador a una sala
 * @param code - Código de la sala
 * @param sessionId - Session ID del nuevo jugador
 * @param playerName - Nombre del nuevo jugador
 * @returns La sala actualizada
 * @throws Error si la sala no existe o está llena
 */
export async function joinRoom(code: string, sessionId: string, playerName: string = 'Jugador 2'): Promise<Room> {
  const collection = getRoomsCollection();
  
  const room = await getRoomByCode(code);
  
  if (!room) {
    throw new Error('ROOM_NOT_FOUND');
  }
  
  if (room.state !== 'waiting') {
    throw new Error('ROOM_NOT_WAITING');
  }
  
  // Verificar si el jugador ya está en la sala
  if (room.players.player1.session_id === sessionId || 
      room.players.player2.session_id === sessionId) {
    throw new Error('ALREADY_IN_ROOM');
  }
  
  // Verificar si ya hay 2 jugadores
  if (room.players.player2.session_id !== null) {
    throw new Error('ROOM_FULL');
  }
  
  const now = new Date();
  
  // Usar updateOne seguido de findOne para evitar dependencias en returnDocument
  console.log(`[DEBUG] Intentando reservar slot player2 para sala ${code}`);
  const updateResult = await collection.updateOne(
    { code, state: 'waiting', 'players.player2.session_id': null },
    {
      $set: {
        'players.player2.session_id': sessionId,
        'players.player2.player_name': playerName,
        'players.player2.joined_at': now,
        'players.player2.ready': false
      }
    }
  );

  console.log(`[DEBUG] updateOne result for joinRoom:`, updateResult);

  if (!updateResult || (updateResult.matchedCount === 0 && updateResult.modifiedCount === 0)) {
    throw new Error('ROOM_FULL');
  }

  const updatedRoom = await collection.findOne({ code }) as Room | null;
  if (!updatedRoom) {
    throw new Error('ROOM_NOT_FOUND');
  }

  return updatedRoom;
}

/**
 * Actualiza el estado de una sala
 * @param code - Código de la sala
 * @param newState - Nuevo estado
 * @returns La sala actualizada
 */
export async function updateRoomState(code: string, newState: Room['state']): Promise<Room | null> {
  const collection = getRoomsCollection();
  
  const update: Partial<Room> = { state: newState };
  
  if (newState === 'in_battle') {
    update.started_at = new Date();
  } else if (newState === 'finished') {
    update.finished_at = new Date();
  }
  
  const updateResult = await collection.updateOne(
    { code },
    { $set: update }
  );

  if (!updateResult || updateResult.matchedCount === 0) return null;

  const updatedRoom = await collection.findOne({ code }) as Room | null;
  if (!updatedRoom) return null;

  return updatedRoom;
}

/**
 * Actualiza el modo de juego de la sala
 * @param code - Código de la sala
 * @param mode - Nuevo modo (normal/random)
 */
export async function updateRoomGameMode(code: string, mode: 'normal' | 'random'): Promise<{ success: boolean; message?: string }> {
  try {
    const collection = getRoomsCollection();
    
    await collection.updateOne(
      { code },
      { $set: { game_mode: mode } }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error actualizando modo de juego:', error);
    return { success: false, message: 'Error al actualizar' };
  }
}

/**
 * Guarda los equipos aleatorios para el modo random
 * @param code - Código de la sala
 * @param team1 - Equipo del jugador 1
 * @param team2 - Equipo del jugador 2
 */
export async function setRandomTeams(code: string, team1: any[], team2: any[]): Promise<{ success: boolean; message?: string }> {
  try {
    const collection = getRoomsCollection();
    
    await collection.updateOne(
      { code },
      { 
        $set: { 
          team_1: team1,
          team_2: team2,
          draft_picks: {
            player1: team1,
            player2: team2
          },
          state: 'in_battle'
        } 
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error guardando equipos aleatorios:', error);
    return { success: false, message: 'Error al guardar equipos' };
  }
}

/**
 * Confirma el equipo de un jugador
 * @param code - Código de la sala
 * @param player - player1 o player2
 * @param team - Array de TeamMember
 * @returns La sala actualizada
 */
export async function confirmTeam(
  code: string, 
  player: 'player1' | 'player2', 
  team: TeamMember[]
): Promise<Room | null> {
  const collection = getRoomsCollection();
  
  const result = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        [`players.${player}.ready`]: true,
        [`players.${player}.team`]: team,
        [player === 'player1' ? 'team_1' : 'team_2']: team
      }
    },
    { returnDocument: 'after' }
  );
  
  if (!result || !('value' in result)) return null;
  return result.value as Room | null;
}

/**
 * Elimina una sala
 * @param code - Código de la sala
 * @returns true si se eliminó, false si no existía
 */
export async function deleteRoom(code: string): Promise<boolean> {
  const collection = getRoomsCollection();
  const result = await collection.deleteOne({ code });
  return result.deletedCount > 0;
}

/**
 * Limpia salas expiradas (TTL automatico en MongoDB)
 * Esta función es para uso manual si es necesario
 */
export async function cleanupExpiredRooms(): Promise<number> {
  const collection = getRoomsCollection();
  const result = await collection.deleteMany({
    expires_at: { $lt: new Date() }
  });
  return result.deletedCount;
}

/**
 * Cierra una sala si no hay jugadores conectados
 * @param code - Código de la sala
 * @returns true si se eliminó la sala, false si aún hay jugadores
 */
export async function closeEmptyRoom(code: string): Promise<boolean> {
  const collection = getRoomsCollection();
  
  const room = await getRoomByCode(code);
  
  if (!room) {
    return false; // Sala no existe
  }
  
  // Verificar si hay jugadores activos
  const hasPlayer1 = room.players.player1.session_id !== null;
  const hasPlayer2 = room.players.player2.session_id !== null;
  
  if (!hasPlayer1 && !hasPlayer2) {
    // No hay jugadores, eliminar la sala
    const result = await collection.deleteOne({ code });
    console.log(`🏠 Sala ${code} eliminada (sin jugadores)`);
    return result.deletedCount > 0;
  }
  
  return false;
}

/**
 * Marca un jugador como desconectado (pone su session_id y player_name en null)
 * @param code - Código de la sala
 * @param sessionId - Session ID del jugador que se desconecta
 * @returns La sala actualizada o null si no se encontró
 */
export async function playerDisconnected(code: string, sessionId: string): Promise<Room | null> {
  const collection = getRoomsCollection();
  
  // Determinar si es player1 o player2
  const room = await getRoomByCode(code);
  if (!room) return null;
  
  let playerField: string | null = null;
  if (room.players.player1.session_id === sessionId) {
    playerField = 'players.player1';
  } else if (room.players.player2.session_id === sessionId) {
    playerField = 'players.player2';
  }
  
  if (!playerField) return null;

  // Si el que se desconecta es el creador (player1), eliminar la sala completamente
  if (playerField === 'players.player1') {
    const del = await collection.deleteOne({ code });
    if (del.deletedCount > 0) {
      console.log(`🏠 Sala ${code} eliminada porque el creador se desconectó`);
    }
    return null;
  }

  // Desconectar al jugador (player2)
  const result = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        [`${playerField}.session_id`]: null,
        [`${playerField}.player_name`]: null
      }
    },
    { returnDocument: 'after' }
  );

  if (!result || !('value' in result) || !result.value) return null;

  // Verificar si la sala quedó vacía y cerrarla
  const updatedRoom = result.value as Room;
  const hasPlayer1 = updatedRoom.players.player1.session_id !== null;
  const hasPlayer2 = updatedRoom.players.player2.session_id !== null;

  if (!hasPlayer1 && !hasPlayer2) {
    await collection.deleteOne({ code });
    console.log(`🏠 Sala ${code} eliminada tras desconexión de ambos jugadores`);
    return null;
  }

  return result.value as Room;
}

/**
 * Marca a un jugador como ready/unready
 */
export async function setPlayerReady(code: string, sessionId: string, ready: boolean): Promise<Room | null> {
  const collection = getRoomsCollection();
  const room = await collection.findOne({ code }) as Room | null;
  if (!room) return null;

  let playerField: string | null = null;
  if (room.players.player1.session_id === sessionId) playerField = 'players.player1';
  else if (room.players.player2.session_id === sessionId) playerField = 'players.player2';
  if (!playerField) return null;

  const result = await collection.findOneAndUpdate(
    { code },
    { $set: { [`${playerField}.ready`]: ready } },
    { returnDocument: 'after' }
  );

  if (!result || !('value' in result) || !result.value) return null;
  return result.value as Room;
}

/**
 * Inicializa los índices de la colección rooms
 */
export async function initializeRoomsIndexes(): Promise<void> {
  const collection = getRoomsCollection();

  try {
    // Índice único para código
    await collection.createIndex({ code: 1 }, { unique: true });

    // TTL para auto-limpieza (30 minutos)
    await collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

    // Índices para búsqueda por sesión
    await collection.createIndex({ 'players.player1.session_id': 1 });
    await collection.createIndex({ 'players.player2.session_id': 1 });

    // Índice para estado
    await collection.createIndex({ state: 1 });

    console.log('✅ Índices de rooms creados');
  } catch (error) {
    console.log('⚠️ Índices de rooms ya existen o error menor:', (error as Error).message);
  }
}

// ============ FUNCIONES DE DRAFT ============

/**
 * Inicializa el sistema de draft en una sala
 * Según PRD: Draft alternado P1 elige → P2 elige → P1 elige
 * @param code - Código de la sala
 * @returns La sala actualizada
 */
export async function startDraft(code: string): Promise<Room | null> {
  const collection = getRoomsCollection();

  const room = await getRoomByCode(code);
  if (!room) return null;

  // El draft comienza cuando el estado cambia a in_draft
  // Initializar estructura de draft
  const draftState: DraftState = {
    current_turn: 'player1', // P1 empieza según PRD
    picks_remaining: {
      player1: 6,
      player2: 6
    },
    banned_pokemon: [],
    available_pokemon: [], // Se llenará con IDs 1-649
    pick_order: 1,
    started: true,
    completed: false
  };

  const result = await collection.findOneAndUpdate(
    { code },
    {
      $set: {
        draft_state: draftState,
        draft_picks: { player1: [], player2: [] }
      }
    },
    { returnDocument: 'after' }
  );

  if (!result || !('value' in result)) return null;
  return result.value as Room | null;
}

/**
 * Realiza un pick en el draft
 * @param code - Código de la sala
 * @param player - 'player1' o 'player2'
 * @param pokemon - El Pokémon seleccionado
 * @returns La sala actualizada
 */
export async function draftPick(
  code: string,
  player: 'player1' | 'player2',
  pokemon: TeamMember
): Promise<Room | null> {
  console.log(`[DB:draftPick] code=${code}, player=${player}, pokemon=${pokemon.name}`);
  const collection = getRoomsCollection();

  const room = await getRoomByCode(code);
  console.log(`[DB:draftPick] Room found:`, !!room, ', draft_state:', !!room?.draft_state);
  
  if (!room || !room.draft_state) {
    console.log(`[DB:draftPick] ERROR: Room or draft_state not found`);
    return null;
  }

  // Verificar que sea el turno del jugador
  console.log(`[DB:draftPick] current_turn=${room.draft_state.current_turn}, player=${player}`);
  if (room.draft_state.current_turn !== player) {
    console.log(`[DB:draftPick] ERROR: Not player turn`);
    throw new Error('NO_TURN');
  }

  // Verificar que el Pokémon no esté banned
  if (room.draft_state.banned_pokemon.includes(pokemon.pokeapi_id)) {
    throw new Error('POKEMON_BANNED');
  }

  // Verificar que el Pokémon no esté ya seleccionado por el oponente
  const opponent = player === 'player1' ? 'player2' : 'player1';
  const opponentPicks = room.draft_picks[opponent].map(p => p.pokeapi_id);
  console.log(`[DB:draftPick] opponentPicks:`, opponentPicks);
  if (opponentPicks.includes(pokemon.pokeapi_id)) {
    throw new Error('POKEMON_ALREADY_PICKED');
  }

  // Agregar el pick al equipo del jugador
  const playerPicks = room.draft_picks[player];
  console.log(`[DB:draftPick] playerPicks count: ${playerPicks.length}`);
  if (playerPicks.length >= 6) {
    throw new Error('TEAM_FULL');
  }

  // Actualizar draft state y picks
  const newPicks = playerPicks.length + 1;
  const remainingPicks = 6 - newPicks;

  const updateObj: any = {
    draft_picks: {
      ...room.draft_picks,
      [player]: [...playerPicks, pokemon]
    }
  };

  // Determinar el siguiente turno
  if (newPicks === 6 && remainingPicks === 0) {
    // Draft completado para este jugador
    const bothComplete = player === 'player1'
      ? room.draft_picks.player2.length >= 6
      : room.draft_picks.player1.length >= 6;

    if (bothComplete) {
      // Ambos completaron, draft terminado
      updateObj['draft_state.completed'] = true;
      updateObj['draft_state.current_turn'] = null;
      // Guardar equipos finales
      updateObj['team_1'] = room.draft_picks.player1;
      updateObj['team_2'] = room.draft_picks.player2;
    } else {
      // Cambiar turno al oponente
      updateObj['draft_state.current_turn'] = opponent;
      updateObj['draft_state.picks_remaining.' + player] = 0;
    }
  } else {
    // Continuar alternando: P1 → P2 → P1 → P2
    updateObj['draft_state.current_turn'] = opponent;
    updateObj['draft_state.picks_remaining.' + player] = remainingPicks;
    updateObj['draft_state.pick_order'] = room.draft_state.pick_order + 1;
  }

  console.log(`[DB:draftPick] Performing update...`);
  const result = await collection.findOneAndUpdate(
    { code },
    { $set: updateObj },
    { returnDocument: 'after' }
  );

  console.log(`[DB:draftPick] Update result:`, typeof result, result);
  
  // Manejar diferentes estructuras de respuesta del driver
  let updatedRoom: Room | null = null;
  
  if (!result) {
    console.log(`[DB:draftPick] ERROR: result is null/undefined`);
    return null;
  }
  
  // Verificar si tiene propiedad 'value' o si es directamente el documento
  if ('value' in result) {
    console.log(`[DB:draftPick] Result has 'value' property`);
    updatedRoom = result.value as Room | null;
  } else if (result && typeof result === 'object') {
    console.log(`[DB:draftPick] Result is direct document`);
    updatedRoom = result as unknown as Room;
  }
  
  if (!updatedRoom) {
    console.log(`[DB:draftPick] ERROR: updatedRoom is null`);
    return null;
  }
  
  console.log(`[DB:draftPick] SUCCESS, returning updated room`);
  return updatedRoom;
}

/**
 * Obtiene el estado actual del draft
 * @param code - Código de la sala
 * @returns El estado del draft
 */
export async function getDraftState(code: string): Promise<DraftState | null> {
  const room = await getRoomByCode(code);
  return room?.draft_state || null;
}

/**
 * Actualiza el estado del draft
 * @param code - Código de la sala
 * @param updates - Objeto con los campos a actualizar
 */
export async function updateDraftState(code: string, updates: Record<string, any>): Promise<{ success: boolean; message?: string }> {
  try {
    const room = await getRoomByCode(code);
    if (!room) {
      return { success: false, message: 'Sala no encontrada' };
    }

    // Actualizar los campos del draft_state
    const newDraftState = {
      ...room.draft_state,
      ...updates
    };

    await roomsCollection.updateOne(
      { code: code },
      { $set: { draft_state: newDraftState } }
    );

    return { success: true };
  } catch (error) {
    console.error('Error actualizando draft_state:', error);
    return { success: false, message: 'Error al actualizar' };
  }
}