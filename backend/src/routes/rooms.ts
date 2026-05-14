import { Hono } from 'hono';
import { createRoom, getRoom, joinRoom, deleteRoom, confirmTeam, leaveRoom, validateTeam } from '../services/roomService';
import { setReady, changeRoomState, getDraftState, draftPick, getDraftPicks } from '../services/roomService';
import type { TeamMember } from '../db/rooms';

const rooms = new Hono();

// ============ MIDDLEWARE ============

// Extraer session_id del header, query params o body
function getSessionId(c: any): string | null {
  // Primero verificar header
  const headerSessionId = c.req.header('X-Session-Id');
  if (headerSessionId) return headerSessionId;
  
  // Luego verificar query params
  const querySessionId = c.req.query('session_id');
  if (querySessionId) return querySessionId;
  
  // Para POST requests, verificar body
  if (c.req.method !== 'GET') {
    const body = c.req.body;
    if (body && body.session_id) return body.session_id;
  }
  
  return null;
}

// ============ RUTAS ============

/**
 * POST /api/rooms
 * Crear una nueva sala
 * 
 * Body: { session_id?: string, player_name?: string }
 * Si no se envía session_id, se genera una
 */
rooms.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const playerName = body.player_name || 'Jugador 1';
    
    const result = await createRoom(sessionId, playerName);
    
    if (!result.success) {
      return c.json({
        success: false,
        error: result.message || 'Error al crear sala'
      }, 400);
    }
    
    return c.json({
      success: true,
      code: result.code,
      state: result.state,
      max_players: result.max_players,
      expires_at: result.expires_at,
      player_name: result.player_name
    }, 201);
  } catch (error) {
    console.error('Error en POST /api/rooms:', error);
    return c.json({
      success: false,
      error: 'Error interno del servidor'
    }, 500);
  }
});

/**
 * GET /api/rooms/:code
 * Obtener información de una sala
 */
rooms.get('/:code', async (c) => {
  try {
    const code = c.req.param('code');
    const sessionId = getSessionId(c);
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Código de sala requerido'
      }, 400);
    }
    
    const result = await getRoom(code, sessionId || undefined);
    
    if (!result.success) {
      return c.json({
        success: false,
        error: result.message || 'Sala no encontrada'
      }, 404);
    }
    
    return c.json({
      success: true,
      room: result.room
    }, 200);
  } catch (error) {
    console.error('Error en GET /api/rooms/:code:', error);
    return c.json({
      success: false,
      error: 'Error interno del servidor'
    }, 500);
  }
});

/**
 * POST /api/rooms/:code/join
 * Unirse a una sala existente
 * 
 * Body: { session_id: string, player_name?: string }
 */
rooms.post('/:code/join', async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.session_id;
    const playerName = body.player_name || 'Jugador 2';
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Código de sala requerido'
      }, 400);
    }
    
    if (!sessionId) {
      return c.json({
        success: false,
        error: 'Session ID requerida'
      }, 400);
    }
    
    const result = await joinRoom(sessionId, code, playerName);
    
    if (!result.success) {
      // Determinar código de error HTTP
      const statusCode = result.message?.includes('no encontrada') ? 404 :
                        result.message?.includes('llena') ? 400 :
                        result.message?.includes('otra sala') ? 409 : 400;
      
      return c.json({
        success: false,
        error: result.message || 'Error al unirse a la sala'
      }, statusCode);
    }
    
    return c.json({
      success: true,
      code: result.code,
      state: result.state,
      player_number: result.player_number,
      player1_ready: result.player1_ready,
      player2_name: result.player2_name
    }, 200);
  } catch (error) {
    console.error('Error en POST /api/rooms/:code/join:', error);
    return c.json({
      success: false,
      error: 'Error interno del servidor'
    }, 500);
  }
});

/**
 * POST /api/rooms/:code/ready
 * Body: { session_id: string, ready: boolean }
 */
rooms.post('/:code/ready', async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.session_id;
    const ready = !!body.ready;

    if (!code || !sessionId) {
      return c.json({ success: false, error: 'Código y session_id requeridos' }, 400);
    }

    const result = await setReady(code, sessionId, ready);
    if (!result.success) {
      return c.json({ success: false, error: result.message || 'No se pudo actualizar' }, 400);
    }

    return c.json({ success: true, room: result.room }, 200);
  } catch (error) {
    console.error('Error en POST /api/rooms/:code/ready:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * PUT /api/rooms/:code/state
 * Body: { session_id: string, state: 'in_draft' | 'in_battle' | 'finished' }
 */
rooms.put('/:code/state', async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.session_id;
    const state = body.state as any;

    if (!code || !sessionId || !state) {
      return c.json({ success: false, error: 'Parámetros inválidos' }, 400);
    }

    const result = await changeRoomState(code, sessionId, state);
    if (!result.success) {
      return c.json({ success: false, error: result.message || 'No se pudo cambiar estado' }, 403);
    }

    return c.json({ success: true, room: result.room }, 200);
  } catch (error) {
    console.error('Error en PUT /api/rooms/:code/state:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * DELETE /api/rooms/:code
 * Eliminar una sala (solo el creador)
 * 
 * Header: X-Session-Id
 */
rooms.delete('/:code', async (c) => {
  try {
    const code = c.req.param('code');
    const sessionId = c.req.header('X-Session-Id');
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Código de sala requerido'
      }, 400);
    }
    
    if (!sessionId) {
      return c.json({
        success: false,
        error: 'Session ID requerida (header X-Session-Id)'
      }, 400);
    }
    
    const result = await deleteRoom(code, sessionId);
    
    if (!result.success) {
      const statusCode = result.message?.includes('no encontrada') ? 404 :
                        result.message?.includes('creador') ? 403 : 400;
      
      return c.json({
        success: false,
        error: result.message || 'Error al eliminar la sala'
      }, statusCode);
    }
    
    return c.json({
      success: true,
      message: result.message
    }, 200);
  } catch (error) {
    console.error('Error en DELETE /api/rooms/:code:', error);
    return c.json({
      success: false,
      error: 'Error interno del servidor'
    }, 500);
  }
});

/**
 * POST /api/rooms/:code/team
 * Confirmar equipo de un jugador
 * 
 * Body: { session_id: string, team: TeamMember[] }
 */
rooms.post('/:code/team', async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.session_id;
    const team = body.team as TeamMember[];
    
    if (!code) {
      return c.json({
        success: false,
        error: 'Código de sala requerido'
      }, 400);
    }
    
    if (!sessionId) {
      return c.json({
        success: false,
        error: 'Session ID requerida'
      }, 400);
    }
    
    if (!team || !Array.isArray(team)) {
      return c.json({
        success: false,
        error: 'Equipo requerido'
      }, 400);
    }
    
    const result = await confirmTeam(code, sessionId, team);
    
    if (!result.success) {
      return c.json({
        success: false,
        error: result.message || 'Error al confirmar equipo'
      }, 400);
    }
    
    return c.json({
      success: true,
      message: result.message,
      both_ready: result.bothReady || false
    }, 200);
  } catch (error) {
    console.error('Error en POST /api/rooms/:code/team:', error);
    return c.json({
      success: false,
      error: 'Error interno del servidor'
    }, 500);
  }
});

/**
 * POST /api/rooms/:code/leave
 * Un jugador abandona la sala
 *
 * Body: { session_id: string }
 */
rooms.post('/:code/leave', async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.session_id;

    if (!code) {
      return c.json({
        success: false,
        error: 'Código de sala requerido'
      }, 400);
    }

    if (!sessionId) {
      return c.json({
        success: false,
        error: 'Session ID requerida'
      }, 400);
    }

    const result = await leaveRoom(code, sessionId);

    return c.json({
      success: result.success,
      message: result.message
    }, result.success ? 200 : 400);
  } catch (error) {
    console.error('Error en POST /api/rooms/:code/leave:', error);
    return c.json({
      success: false,
      error: 'Error interno del servidor'
    }, 500);
  }
});

// ============ RUTAS DE DRAFT ============

/**
 * GET /api/rooms/:code/draft
 * Obtiene el estado actual del draft
 */
rooms.get('/:code/draft', async (c) => {
  try {
    const code = c.req.param('code');
    const sessionId = getSessionId(c);

    if (!code) {
      return c.json({ success: false, error: 'Código requerido' }, 400);
    }

    const result = await getDraftState(code, sessionId || '');

    if (!result.success) {
      return c.json({ success: false, error: result.message }, 400);
    }

    return c.json({
      success: true,
      draft: result.draft
    }, 200);
  } catch (error) {
    console.error('Error en GET /api/rooms/:code/draft:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * GET /api/rooms/:code/draft/picks
 * Obtiene los picks actuales de ambos jugadores
 */
rooms.get('/:code/draft/picks', async (c) => {
  try {
    const code = c.req.param('code');

    if (!code) {
      return c.json({ success: false, error: 'Código requerido' }, 400);
    }

    const result = await getDraftPicks(code);

    if (!result.success) {
      return c.json({ success: false, error: result.message }, 400);
    }

    return c.json({
      success: true,
      picks: result.picks
    }, 200);
  } catch (error) {
    console.error('Error en GET /api/rooms/:code/draft/picks:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * POST /api/rooms/:code/draft/pick
 * Realiza un pick en el draft
 *
 * Body: { session_id: string, pokemon: { pokeapi_id, selected_moves, is_legendary, name } }
 */
rooms.post('/:code/draft/pick', async (c) => {
  try {
    const code = c.req.param('code');
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.session_id;
    const pokemon = body.pokemon as TeamMember;

    if (!code) {
      return c.json({ success: false, error: 'Código requerido' }, 400);
    }

    if (!sessionId) {
      return c.json({ success: false, error: 'Session ID requerida' }, 400);
    }

    if (!pokemon || !pokemon.pokeapi_id) {
      return c.json({ success: false, error: 'Pokémon requerido' }, 400);
    }

    const result = await draftPick(code, sessionId, pokemon);

    if (!result.success) {
      return c.json({ success: false, error: result.message }, 400);
    }

    return c.json({
      success: true,
      message: result.message,
      draft_completed: result.draft_completed,
      room: result.room
    }, 200);
  } catch (error) {
    console.error('Error en POST /api/rooms/:code/draft/pick:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * GET /api/rooms/:code/validate-team
 * Valida un equipo según las reglas del PRD
 *
 * Query: session_id, y body con team
 */
rooms.post('/:code/validate-team', async (c) => {
  try {
    const code = c.req.param('code');
    const sessionId = getSessionId(c);
    const body = await c.req.json().catch(() => ({}));
    const team = body.team as TeamMember[];

    if (!code || !sessionId) {
      return c.json({ success: false, error: 'Parámetros requeridos' }, 400);
    }

    if (!team || !Array.isArray(team)) {
      return c.json({ success: false, error: 'Equipo requerido' }, 400);
    }

    const validation = validateTeam(team);

    return c.json({
      success: true,
      valid: validation.valid,
      error: validation.error
    }, 200);
  } catch (error) {
    console.error('Error en POST /api/rooms/:code/validate-team:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

export default rooms;