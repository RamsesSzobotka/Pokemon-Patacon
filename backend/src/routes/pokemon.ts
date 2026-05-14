import { Hono } from 'hono';
import { pokemonService } from '../services/pokemonService';

const pokedex = new Hono();

/**
 * GET /api/pokemon - Lista Pokémon con filtros
 * Query params:
 *   - search: string (nombre)
 *   - types: string[] (tipos separados por coma)
 *   - generation: number (1-5)
 *   - legendary: boolean
 *   - mythical: boolean
 *   - limit: number (default 50)
 *   - offset: number (default 0)
 */
pokedex.get('/', async (c) => {
  try {
    const search = c.req.query('search') || '';
    const typesStr = c.req.query('types') || '';
    const generation = c.req.query('generation') ? parseInt(c.req.query('generation')!) : undefined;
    const legendary = c.req.query('legendary') ? c.req.query('legendary') === 'true' : undefined;
    const mythical = c.req.query('mythical') ? c.req.query('mythical') === 'true' : undefined;
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100); // Max 100
    const offset = parseInt(c.req.query('offset') || '0');

    const types = typesStr ? typesStr.split(',').map(t => t.toLowerCase()) : [];

    const { pokemon, total } = await pokemonService.listPokemon({
      search,
      types,
      generation,
      isLegendary: legendary,
      isMythical: mythical,
      limit,
      offset
    });

    const pages = Math.ceil(total / limit);

    return c.json({
      success: true,
      data: {
        pokemon,
        total,
        limit,
        offset,
        pages
      }
    });
  } catch (error) {
    console.error('Error in GET /api/pokemon:', error);
    return c.json({
      success: false,
      error: 'Error fetching Pokémon list',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/pokemon/search - Búsqueda rápida por nombre
 * Query params:
 *   - q: string (query)
 */
pokedex.get('/search', async (c) => {
  try {
    const q = c.req.query('q') || '';

    if (q.length < 1) {
      return c.json({
        success: false,
        error: 'Query must be at least 1 character',
        code: 'INVALID_QUERY'
      }, 400);
    }

    const pokemon = await pokemonService.searchPokemon(q);

    return c.json({
      success: true,
      data: {
        results: pokemon,
        count: pokemon.length
      }
    });
  } catch (error) {
    console.error('Error in GET /api/pokemon/search:', error);
    return c.json({
      success: false,
      error: 'Search error',
      code: 'SEARCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/pokemon/:id - Obtiene Pokémon por ID
 */
pokedex.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id) || id < 1 || id > 649) {
      return c.json({
        success: false,
        error: 'Invalid Pokémon ID (must be 1-649)',
        code: 'INVALID_ID'
      }, 400);
    }

    const pokemon = await pokemonService.getPokemonById(id);

    if (!pokemon) {
      return c.json({
        success: false,
        error: 'Pokémon not found',
        code: 'NOT_FOUND'
      }, 404);
    }

    return c.json({
      success: true,
      data: pokemon
    });
  } catch (error) {
    console.error(`Error in GET /api/pokemon/:id:`, error);
    return c.json({
      success: false,
      error: 'Error fetching Pokémon',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/pokemon/type/:type - Obtiene Pokémon por tipo
 */
pokedex.get('/type/:type', async (c) => {
  try {
    const type = c.req.param('type').toLowerCase();

    const validTypes = pokemonService.getAvailableTypes();
    if (!validTypes.includes(type)) {
      return c.json({
        success: false,
        error: `Invalid type. Valid types: ${validTypes.join(', ')}`,
        code: 'INVALID_TYPE'
      }, 400);
    }

    const pokemon = await pokemonService.getPokemonByType(type);

    return c.json({
      success: true,
      data: {
        type,
        pokemon,
        count: pokemon.length
      }
    });
  } catch (error) {
    console.error('Error in GET /api/pokemon/type/:type:', error);
    return c.json({
      success: false,
      error: 'Error fetching Pokémon by type',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/pokemon/generation/:gen - Obtiene Pokémon por generación
 */
pokedex.get('/generation/:gen', async (c) => {
  try {
    const gen = parseInt(c.req.param('gen'));

    if (isNaN(gen) || gen < 1 || gen > 5) {
      return c.json({
        success: false,
        error: 'Invalid generation (must be 1-5)',
        code: 'INVALID_GEN'
      }, 400);
    }

    const pokemon = await pokemonService.getPokemonByGeneration(gen);

    return c.json({
      success: true,
      data: {
        generation: gen,
        pokemon,
        count: pokemon.length
      }
    });
  } catch (error) {
    console.error('Error in GET /api/pokemon/generation/:gen:', error);
    return c.json({
      success: false,
      error: 'Error fetching Pokémon by generation',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/pokemon/legendary - Obtiene legendarios (35)
 */
pokedex.get('/legendary', async (c) => {
  try {
    const pokemon = await pokemonService.getLegendaryPokemon();

    return c.json({
      success: true,
      data: {
        pokemon,
        count: pokemon.length,
        type: 'legendary'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/pokemon/legendary:', error);
    return c.json({
      success: false,
      error: 'Error fetching legendary Pokémon',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/pokemon/mythical - Obtiene míticos (13)
 */
pokedex.get('/mythical', async (c) => {
  try {
    const pokemon = await pokemonService.getMythicalPokemon();

    return c.json({
      success: true,
      data: {
        pokemon,
        count: pokemon.length,
        type: 'mythical'
      }
    });
  } catch (error) {
    console.error('Error in GET /api/pokemon/mythical:', error);
    return c.json({
      success: false,
      error: 'Error fetching mythical Pokémon',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/pokemon/types - Obtiene tipos disponibles con colores
 */
pokedex.get('/meta/types', async (c) => {
  const types = pokemonService.getAvailableTypes();
  const colors = pokemonService.getTypeColors();

  return c.json({
    success: true,
    data: {
      types: types.map(type => ({
        name: type,
        color: colors[type] || '#999'
      }))
    }
  });
});

/**
 * GET /api/pokemon/meta/generations - Obtiene generaciones disponibles
 */
pokedex.get('/meta/generations', async (c) => {
  const generations = pokemonService.getGenerationInfo();

  return c.json({
    success: true,
    data: {
      generations: Object.entries(generations).map(([num, info]) => ({
        id: parseInt(num),
        name: info.name,
        range: info.range
      }))
    }
  });
});

/**
 * GET /api/pokemon/meta/cache - Estadísticas de caché (dev only)
 */
pokedex.get('/meta/cache', async (c) => {
  const stats = pokemonService.getCacheStats();

  return c.json({
    success: true,
    data: {
      cached: stats.size,
      total: stats.valid,
      percentage: stats.percentage,
      status: stats.percentage > 90 ? 'ready' : 'loading'
    }
  });
});

/**
 * GET /api/pokemon/:id/moves - Obtiene los movimientos de un Pokémon
 */
pokedex.get('/:id/moves', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    if (isNaN(id) || id < 1 || id > 649) {
      return c.json({
        success: false,
        error: 'Invalid Pokémon ID (must be 1-649)',
        code: 'INVALID_ID'
      }, 400);
    }

    const moves = await pokemonService.getPokemonMoves(id);

    return c.json({
      success: true,
      data: {
        pokemon_id: id,
        moves,
        count: moves.length
      }
    });
  } catch (error) {
    console.error(`Error in GET /api/pokemon/:id/moves:`, error);
    return c.json({
      success: false,
      error: 'Error fetching Pokémon moves',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * GET /api/moves - Obtiene todos los movimientos disponibles
 */
pokedex.get('/meta/moves/all', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);
    const type = c.req.query('type')?.toLowerCase();
    const damageClass = c.req.query('damage_class')?.toLowerCase();

    const { getAllMoves, getMovesByType, getMovesByDamageClass } = await import('../db/mongodb');

    let moves;
    if (type) {
      moves = await getMovesByType(type);
    } else if (damageClass) {
      moves = await getMovesByDamageClass(damageClass);
    } else {
      moves = await getAllMoves();
    }

    // Aplicar limit
    moves = moves.slice(0, limit);

    return c.json({
      success: true,
      data: {
        moves,
        count: moves.length
      }
    });
  } catch (error) {
    console.error(`Error in GET /api/moves:`, error);
    return c.json({
      success: false,
      error: 'Error fetching moves',
      code: 'FETCH_ERROR'
    }, 500);
  }
});

/**
 * POST /api/pokemon/meta/moves/update-spanish - Inicia migración en background
 * Este endpoint inicia la migración para agregar descripciones en español (ejecuta en background)
 */
let migrationStatus = { running: false, updated: 0, errors: 0, startTime: '', endTime: '' };

pokedex.post('/meta/moves/update-spanish', async (c) => {
  if (migrationStatus.running) {
    return c.json({
      success: false,
      error: 'Migración ya en progreso',
      data: migrationStatus
    }, 409);
  }

  // Iniciar migración en background
  migrationStatus = { 
    running: true, 
    updated: 0, 
    errors: 0, 
    startTime: new Date().toISOString(), 
    endTime: '' 
  };

  // Ejecutar sin esperar (background)
  pokemonService.updateMovesWithSpanishData().then(result => {
    migrationStatus = {
      running: false,
      updated: result.updated,
      errors: result.errors,
      startTime: migrationStatus.startTime,
      endTime: new Date().toISOString()
    };
    console.log(`✅ Migración completada: ${result.updated} actualizados`);
  }).catch(error => {
    migrationStatus.running = false;
    migrationStatus.errors++;
    console.error('❌ Error en migración:', error);
  });

  return c.json({
    success: true,
    data: {
      message: 'Migración iniciada en background',
      status: migrationStatus
    }
  });
});

/**
 * GET /api/pokemon/meta/moves/migration-status - Consulta estado de la migración
 */
pokedex.get('/meta/moves/migration-status', async (c) => {
  return c.json({
    success: true,
    data: migrationStatus
  });
});

export default pokedex;
