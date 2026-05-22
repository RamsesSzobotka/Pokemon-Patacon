import { Hono } from 'hono';
import { getUserByClerkId, createUser, updateUser, deleteUser } from '../db/users';
import { getClerkUserId } from '../middleware/auth';

const authRoutes = new Hono();

/**
 * POST /api/auth/session
 * Asociar o recuperar session_id del usuario autenticado
 * Auth: Requiere token Clerk (extraído por middleware)
 * Body: { "session_id": "...", "player_name": "..." }
 * 
 * Si el usuario ya existe y se envía player_name, se actualiza.
 * Si el usuario no existe, se crea con player_name (o 'Jugador' por defecto).
 */
authRoutes.post('/session', async (c) => {
  try {
    const clerkUserId = getClerkUserId(c);
    if (!clerkUserId) {
      return c.json({ success: false, error: 'No autenticado' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { session_id, player_name } = body;

    if (!session_id) {
      return c.json({ success: false, error: 'session_id requerido' }, 400);
    }

    // Buscar o crear usuario
    const user = await getUserByClerkId(clerkUserId);

    if (!user) {
      // Nuevo usuario: crear con player_name (o 'Jugador' por defecto)
      await createUser(clerkUserId, '', player_name || 'Jugador');
    }

    // Actualizar session_id + player_name en todos los casos
    const updateFields: Record<string, any> = { session_id };
    if (player_name && (!user || player_name !== user.player_name)) {
      updateFields.player_name = player_name;
    }
    await updateUser(clerkUserId, updateFields);

    // Obtener datos actualizados
    const updatedUser = await getUserByClerkId(clerkUserId);

    return c.json({
      success: true,
      session_id,
      user: {
        player_name: updatedUser?.player_name || user?.player_name || 'Jugador',
        games_played: updatedUser?.games_played || 0,
        wins: updatedUser?.wins || 0,
        shiny_pack: updatedUser?.shiny_pack || false,
      },
    });
  } catch (error) {
    console.error('Error en POST /api/auth/session:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * GET /api/auth/session
 * Obtener session_id persistente y datos del usuario autenticado
 * Auth: Requiere token Clerk
 */
authRoutes.get('/session', async (c) => {
  try {
    const clerkUserId = getClerkUserId(c);
    if (!clerkUserId) {
      return c.json({ success: false, error: 'No autenticado' }, 401);
    }

    const user = await getUserByClerkId(clerkUserId);

    return c.json({
      success: true,
      session_id: user?.session_id || null,
      user: user ? {
        player_name: user.player_name,
        games_played: user.games_played,
        wins: user.wins,
        shiny_pack: user.shiny_pack || false,
      } : null,
    });
  } catch (error) {
    console.error('Error en GET /api/auth/session:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * GET /api/auth/profile
 * Obtener perfil completo del usuario autenticado
 * Auth: Requiere token Clerk
 */
authRoutes.get('/profile', async (c) => {
  try {
    const clerkUserId = getClerkUserId(c);
    if (!clerkUserId) {
      return c.json({ success: false, error: 'No autenticado' }, 401);
    }

    const user = await getUserByClerkId(clerkUserId);
    if (!user) {
      return c.json({ success: false, error: 'Usuario no encontrado' }, 404);
    }

    return c.json({
      success: true,
      user: {
        player_name: user.player_name,
        email: user.email,
        games_played: user.games_played,
        wins: user.wins,
        shiny_pack: user.shiny_pack || false,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      },
    });
  } catch (error) {
    console.error('Error en GET /api/auth/profile:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * PUT /api/auth/profile
 * Actualizar player_name del usuario autenticado
 * Auth: Requiere token Clerk
 * Body: { "player_name": "..." }
 */
authRoutes.put('/profile', async (c) => {
  try {
    const clerkUserId = getClerkUserId(c);
    if (!clerkUserId) {
      return c.json({ success: false, error: 'No autenticado' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { player_name } = body;

    if (!player_name || typeof player_name !== 'string' || player_name.trim().length === 0) {
      return c.json({ success: false, error: 'player_name requerido' }, 400);
    }

    const trimmedName = player_name.trim().slice(0, 20);
    await updateUser(clerkUserId, { player_name: trimmedName });

    return c.json({
      success: true,
      player_name: trimmedName,
    });
  } catch (error) {
    console.error('Error en PUT /api/auth/profile:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

/**
 * DELETE /api/auth/profile
 * Eliminar cuenta del usuario autenticado
 * Auth: Requiere token Clerk
 */
authRoutes.delete('/profile', async (c) => {
  try {
    const clerkUserId = getClerkUserId(c);
    if (!clerkUserId) {
      return c.json({ success: false, error: 'No autenticado' }, 401);
    }

    const deleted = await deleteUser(clerkUserId);

    return c.json({
      success: deleted,
      message: deleted ? 'Usuario eliminado' : 'Usuario no encontrado',
    });
  } catch (error) {
    console.error('Error en DELETE /api/auth/profile:', error);
    return c.json({ success: false, error: 'Error interno' }, 500);
  }
});

export default authRoutes;
