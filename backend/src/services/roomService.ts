import * as roomsDB from '../db/rooms';
import type { Room, TeamMember } from '../db/rooms';

/**
 * Servicio de lógica de negocio para salas
 */

// ============ TIPOS DE RESPUESTA ============

export interface CreateRoomResponse {
  success: boolean;
  code: string;
  state: string;
  max_players: number;
  expires_at: string;
  player_name?: string;
  message?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  code: string;
  state: string;
  player_number: number;
  player1_ready: boolean;
  player2_name?: string;
  message?: string;
}

export interface GetRoomResponse {
  success: boolean;
  room?: Room & { isHost?: boolean };
  message?: string;
}

export interface DeleteRoomResponse {
  success: boolean;
  message: string;
}

// ============ FUNCIONES PÚBLICAS ============

/**
 * Crea una nueva sala
 */
export async function createRoom(sessionId: string, playerName: string = 'Jugador 1'): Promise<CreateRoomResponse> {
  try {
    // Validar sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        success: false,
        code: '',
        state: '',
        max_players: 0,
        expires_at: '',
        message: 'Session ID inválida'
      };
    }
    
    // Validar playerName
    const sanitizedName = playerName?.trim() || 'Jugador 1';
    
    // Verificar si el jugador ya está en una sala activa
    const existingRoom = await roomsDB.getRoomBySession(sessionId);
    if (existingRoom) {
      return {
        success: false,
        code: existingRoom.code,
        state: existingRoom.state,
        max_players: 2,
        expires_at: existingRoom.expires_at.toISOString(),
        message: 'Ya estás en una sala activa'
      };
    }
    
    // Crear sala
    const room = await roomsDB.createRoom(sessionId, sanitizedName);
    
    return {
      success: true,
      code: room.code,
      state: room.state,
      max_players: room.max_players,
      expires_at: room.expires_at.toISOString(),
      player_name: room.players.player1.player_name || sanitizedName
    };
  } catch (error) {
    console.error('Error creando sala:', error);
    return {
      success: false,
      code: '',
      state: '',
      max_players: 0,
      expires_at: '',
      message: 'Error al crear la sala'
    };
  }
}

/**
 * Obtiene una sala por código
 */
export async function getRoom(code: string, sessionId?: string): Promise<GetRoomResponse> {
  try {
    if (!code || typeof code !== 'string') {
      return {
        success: false,
        message: 'Código de sala inválido'
      };
    }
    
    const room = await roomsDB.getRoomByCode(code.toUpperCase());
    
    if (!room) {
      return {
        success: false,
        message: 'Sala no encontrada'
      };
    }
    
    // Determinar si el solicitante es el host
    const isHost = sessionId ? room.players.player1.session_id === sessionId : undefined;
    
    // No exponer información sensible
    const safeRoom = sanitizeRoom(room);
    
    return {
      success: true,
      room: {
        ...safeRoom,
        isHost
      }
    };
  } catch (error) {
    console.error('Error obteniendo sala:', error);
    return {
      success: false,
      message: 'Error al obtener la sala'
    };
  }
}

/**
 * Une a un jugador a una sala
 */
export async function joinRoom(sessionId: string, code: string, playerName: string = 'Jugador 2'): Promise<JoinRoomResponse> {
  try {
    console.log(`[joinRoom] Intentando unirse - sessionId: ${sessionId}, code: ${code}, playerName: ${playerName}`);
    
    // Validaciones
    if (!sessionId || typeof sessionId !== 'string') {
      return {
        success: false,
        code: code || '',
        state: '',
        player_number: 0,
        player1_ready: false,
        message: 'Session ID inválida'
      };
    }
    
    if (!code || typeof code !== 'string') {
      return {
        success: false,
        code: code || '',
        state: '',
        player_number: 0,
        player1_ready: false,
        message: 'Código de sala inválido'
      };
    }
    
    const upperCode = code.toUpperCase().trim();
    console.log(`[joinRoom] Código normalizado: ${upperCode}`);
    const sanitizedName = playerName?.trim() || 'Jugador 2';
    
    // Verificar si el jugador ya está en otra sala
    const existingRoom = await roomsDB.getRoomBySession(sessionId);
    if (existingRoom && existingRoom.code !== upperCode) {
      return {
        success: false,
        code: upperCode,
        state: existingRoom.state,
        player_number: 0,
        player1_ready: false,
        message: 'Ya estás en otra sala activa'
      };
    }
    
    // Verificar si ya está en esta sala
    if (existingRoom && existingRoom.code === upperCode) {
      // Determinar número de jugador
      const playerNumber = existingRoom.players.player1.session_id === sessionId ? 1 : 2;
      
      return {
        success: true,
        code: upperCode,
        state: existingRoom.state,
        player_number: playerNumber,
        player1_ready: existingRoom.players.player1.ready,
        message: 'Ya estás en esta sala'
      };
    }
    
    // Unirse a la sala (db.joinRoom espera: code, sessionId, playerName)
    const room = await roomsDB.joinRoom(upperCode, sessionId, sanitizedName);
    
    // Determinar número de jugador (siempre 2 cuando se une)
    return {
      success: true,
      code: room.code,
      state: room.state,
      player_number: 2,
      player1_ready: room.players.player1.ready,
      player2_name: room.players.player2.player_name || sanitizedName
    };
  } catch (error: any) {
    console.error('Error uniéndose a sala:', error);
    
    // Manejar errores específicos
    const errorMessage = error.message || 'Error al unirse a la sala';
    
    let userMessage = errorMessage;
    switch (errorMessage) {
      case 'ROOM_NOT_FOUND':
        userMessage = 'La sala no existe';
        break;
      case 'ROOM_NOT_WAITING':
        userMessage = 'La sala ya no acepta jugadores';
        break;
      case 'ROOM_FULL':
        userMessage = 'La sala ya tiene 2 jugadores';
        break;
      case 'ALREADY_IN_ROOM':
        userMessage = 'Ya estás en esta sala';
        break;
    }
    
    return {
      success: false,
      code: code?.toUpperCase() || '',
      state: '',
      player_number: 0,
      player1_ready: false,
      message: userMessage
    };
  }
}

/**
 * Elimina una sala (solo el creador puede)
 */
export async function deleteRoom(code: string, sessionId: string): Promise<DeleteRoomResponse> {
  try {
    if (!code || !sessionId) {
      return {
        success: false,
        message: 'Código o sesión inválidos'
      };
    }
    
    const upperCode = code.toUpperCase();
    const room = await roomsDB.getRoomByCode(upperCode);
    
    if (!room) {
      return {
        success: false,
        message: 'Sala no encontrada'
      };
    }
    
    // Solo el creador (player1) puede eliminar
    if (room.players.player1.session_id !== sessionId) {
      return {
        success: false,
        message: 'Solo el creador puede eliminar la sala'
      };
    }
    
    const deleted = await roomsDB.deleteRoom(upperCode);
    
    if (deleted) {
      return {
        success: true,
        message: 'Sala eliminada correctamente'
      };
    }
    
    return {
      success: false,
      message: 'No se pudo eliminar la sala'
    };
  } catch (error) {
    console.error('Error eliminando sala:', error);
    return {
      success: false,
      message: 'Error al eliminar la sala'
    };
  }
}

/**
 * Confirma el equipo de un jugador
 */
export async function confirmTeam(
  code: string, 
  sessionId: string, 
  team: TeamMember[]
): Promise<{ success: boolean; message: string; bothReady?: boolean }> {
  try {
    if (!code || !sessionId || !team) {
      return { success: false, message: 'Parámetros inválidos' };
    }
    
    const upperCode = code.toUpperCase();
    const room = await roomsDB.getRoomByCode(upperCode);
    
    if (!room) {
      return { success: false, message: 'Sala no encontrada' };
    }
    
    // Validar que el jugador esté en la sala
    let player: 'player1' | 'player2' | null = null;
    
    if (room.players.player1.session_id === sessionId) {
      player = 'player1';
    } else if (room.players.player2.session_id === sessionId) {
      player = 'player2';
    }
    
    if (!player) {
      return { success: false, message: 'No perteneces a esta sala' };
    }
    
    // Validar equipo: exactamente 6 Pokémon
    if (team.length !== 6) {
      return { success: false, message: 'El equipo debe tener exactamente 6 Pokémon' };
    }
    
    // Validar: exactamente 4 movimientos por Pokémon
    for (const member of team) {
      if (!member.selected_moves || member.selected_moves.length !== 4) {
        return { success: false, message: 'Cada Pokémon debe tener exactamente 4 movimientos' };
      }
    }
    
    // Confirmar equipo
    const updatedRoom = await roomsDB.confirmTeam(upperCode, player, team);
    
    if (!updatedRoom) {
      return { success: false, message: 'Error al confirmar equipo' };
    }
    
    // Verificar si ambos están ready
    const bothReady = updatedRoom.players.player1.ready && 
                      updatedRoom.players.player2.ready !== null;
    
    return {
      success: true,
      message: 'Equipo confirmado',
      bothReady
    };
  } catch (error) {
    console.error('Error confirmando equipo:', error);
    return { success: false, message: 'Error al confirmar equipo' };
  }
}

/**
 * Un jugador abandona la sala
 * Si la sala queda vacía, se elimina automáticamente
 */
export async function leaveRoom(
  code: string, 
  sessionId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!code || !sessionId) {
      return { success: false, message: 'Código o sesión inválidos' };
    }
    
    const upperCode = code.toUpperCase();
    
    // Si es el creador, cerrar la sala completamente
    const room = await roomsDB.getRoomByCode(upperCode);
    if (!room) return { success: false, message: 'Sala no encontrada' };

    if (room.players.player1.session_id === sessionId) {
      const deleted = await roomsDB.deleteRoom(upperCode);
      return deleted ? { success: true, message: 'Sala cerrada (creador salió)' } : { success: false, message: 'No se pudo cerrar la sala' };
    }

    // Llamar a playerDisconnected para player2
    const updatedRoom = await roomsDB.playerDisconnected(upperCode, sessionId);

    if (!updatedRoom) {
      return { success: false, message: 'No puedes abandonar esta sala' };
    }

    return { success: true, message: 'Has abandonado la sala' };
  } catch (error) {
    console.error('Error abandonando sala:', error);
    return { success: false, message: 'Error al abandonar la sala' };
  }
}

/**
 * Marca al jugador como ready/unready
 */
export async function setReady(code: string, sessionId: string, ready: boolean): Promise<{ success: boolean; message?: string; room?: Room }> {
  try {
    const upperCode = code.toUpperCase();
    const updated = await roomsDB.setPlayerReady(upperCode, sessionId, ready);
    if (!updated) return { success: false, message: 'No se pudo actualizar el estado' };
    return { success: true, room: updated };
  } catch (error) {
    console.error('Error updating ready:', error);
    return { success: false, message: 'Error interno' };
  }
}

/**
 * Cambia el estado de la sala (ej: iniciar draft)
 */
export async function changeRoomState(code: string, sessionId: string, newState: Room['state']): Promise<{ success: boolean; message?: string; room?: Room }> {
  try {
    const upperCode = code.toUpperCase();
    const room = await roomsDB.getRoomByCode(upperCode);
    if (!room) return { success: false, message: 'Sala no encontrada' };

    // Solo el creador puede cambiar el estado a in_draft
    if (newState === 'in_draft' && room.players.player1.session_id !== sessionId) {
      return { success: false, message: 'Solo el creador puede iniciar el draft' };
    }

    const updated = await roomsDB.updateRoomState(upperCode, newState);
    if (!updated) return { success: false, message: 'No se pudo actualizar el estado' };
    return { success: true, room: updated };
  } catch (error) {
    console.error('Error cambiando estado de sala:', error);
    return { success: false, message: 'Error interno' };
  }
}

// ============ FUNCIONES AUXILIARES ============

/**
 * Elimina información sensible antes de enviar al cliente
 */
function sanitizeRoom(room: Room): Room {
  // Crear copia sin información sensible
  return {
    ...room,
    players: {
      player1: {
        session_id: room.players.player1.session_id ? 'masked' : null,
        player_name: room.players.player1.player_name || null,
        joined_at: room.players.player1.joined_at,
        ready: room.players.player1.ready
      },
      player2: {
        session_id: room.players.player2.session_id ? 'masked' : null,
        player_name: room.players.player2.player_name || null,
        joined_at: room.players.player2.joined_at,
        ready: room.players.player2.ready
      }
    }
  };
}