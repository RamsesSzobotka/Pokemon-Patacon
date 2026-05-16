import axios from 'axios';
import {
  getPokemonCollection,
  getPokemonById as getFromDB,
  insertPokemon,
  getPokemonList,
  countPokemon,
  getAllPokemonIds,
  insertMove,
  getMovesByIds,
  getAllMoves,
  insertMovesBatch
} from '../db/mongodb';

interface Move {
  _id?: string;
  move_id: number;
  name: string;
  type: string;
  damage_class: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  target: string;
  meta: {
    ailment: string | null;
    ailment_chance: number;
    stat_changes: Array<{ stat: string; change: number }>;
    flinch_chance: number;
    heal: number;
  };
  flags: {
    contact: boolean;
    recharge: boolean;
    protect: boolean;
    mirror: boolean;
    sound: boolean;
  };
  created_at: string;
  updated_at: string;
}

interface Pokemon {
  _id?: string;
  pokeapi_id: number;
  name: string;
  generation: number;
  types: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    sp_attack: number;
    sp_defense: number;
    speed: number;
  };
  base_experience: number;
  is_legendary: boolean;
  is_mythical: boolean;
  move_ids: number[];  // Array de IDs de movimientos permitidos
  sprites: {
    animated_gif: string;
    static_png: string;
  };
  height_dm: number;
  weight_hg: number;
  cached_at: string;
  updated_at: string;
}

// Cache en memoria para movimientos (optimización para battle engine)
let movesCache: Map<number, Move> = new Map();

const POKEAPI_BASE = process.env.POKEAPI_BASE_URL || 'https://pokeapi.co/api/v2';

// Pokémon válidos: Gen I-V (1-649) - Todas las generaciones
const VALID_POKEMON_IDS = Array.from({ length: 649 }, (_, i) => i + 1);

// 35 legendarios
const LEGENDARY_IDS = [
  144, 145, 146, // Birds (Gen I)
  150, // Mewtwo (Gen I)
  243, 244, 245, // Beasts (Gen II)
  249, 250, // Lugia/Ho-Oh (Gen II)
  377, 378, 379, // Titans (Gen III)
  380, 381, // Lati@s (Gen III)
  382, 383, 384, // Weather trio (Gen III)
  385, 386, // Jirachi/Deoxys (Gen III)
  480, 481, 482, // Lake guardians (Gen IV)
  483, 484, // Dialga/Palkia (Gen IV)
  485, 486, // Heatran/Regigigas (Gen IV)
  487, 488, // Giratina/Cresselia (Gen IV)
  491, 492 // Darkrai/Shaymin (Gen IV)
];

// 13 míticos
const MYTHICAL_IDS = [
  151, // Mew (Gen I)
  251, // Celebi (Gen II)
  385, // Jirachi (Gen III) - also legendary
  386, // Deoxys (Gen III) - also legendary
  489, 490, // Phione/Manaphy (Gen IV)
  491, 492, // Darkrai/Shaymin (Gen IV) - also in legendary
  493 // Arceus (Gen IV)
];

export class PokemonService {
  private inMemoryCache: Map<number, Pokemon> = new Map();
  private isInitialized = false;
  private dbConnected = false;

  async initialize() {
    if (this.isInitialized) return;

    console.log('🐾 Inicializando servicio de Pokémon...');

    // Verificar si MongoDB está disponible
    try {
      const collection = getPokemonCollection();
      if (collection) {
        this.dbConnected = true;
        console.log('✅ MongoDB disponible para persistencia');

        // Cargar Pokémon ya en BD al caché
        const dbIds = await getAllPokemonIds();
        console.log(`📦 Pokémon en MongoDB: ${dbIds.length}`);
      }
    } catch (error) {
      console.warn('⚠️ MongoDB no disponible, usando caché en memoria');
      this.dbConnected = false;
    }

    this.isInitialized = true;
  }

  /**
   * Obtiene un Pokémon por ID
   * Orden: MongoDB → PokeAPI → Guardar en MongoDB
   */
  async getPokemonById(id: number): Promise<Pokemon | null> {
    // Validar ID
    if (!VALID_POKEMON_IDS.includes(id)) {
      console.warn(`❌ ID inválido: ${id} (válidos: 1-649)`);
      return null;
    }

    // 1. Revisar caché en memoria
    if (this.inMemoryCache.has(id)) {
      console.log(`✅ Pokémon #${id} obtenido del caché en memoria`);
      return this.inMemoryCache.get(id) || null;
    }

    // 2. Revisar MongoDB
    if (this.dbConnected) {
      try {
        const dbPoke = await getFromDB(id);
        if (dbPoke) {
          this.inMemoryCache.set(id, dbPoke);
          console.log(`💾 Pokémon #${id} obtenido de MongoDB`);
          return dbPoke;
        }
      } catch (error) {
        console.error(`⚠️ Error consultando MongoDB para #${id}:`, error);
      }
    }

    // 3. Obtener de PokeAPI
    try {
      console.log(`🌐 Obteniendo Pokémon #${id} de PokeAPI...`);
      const pokemon = await this.fetchFromPokeAPI(id);

      if (pokemon) {
        // Guardar en caché memoria
        this.inMemoryCache.set(id, pokemon);

        // Guardar en MongoDB
        if (this.dbConnected) {
          try {
            await insertPokemon(pokemon);
            console.log(`💾 Pokémon #${id} guardado en MongoDB`);
          } catch (error) {
            console.warn(`⚠️ Error guardando en MongoDB: ${error}`);
          }
        }

        return pokemon;
      }
    } catch (error) {
      console.error(`❌ Error obteniendo Pokémon #${id}:`, error);
    }

    return null;
  }

  /**
   * Lista Pokémon con filtros y paginación
   * Estrategia: MongoDB → Si vacío, fallback a PokeAPI
   */
  async listPokemon(filters: any): Promise<{ pokemon: Pokemon[]; total: number }> {
    const {
      search = '',
      types = [],
      generation,
      isLegendary,
      isMythical,
      limit = 50,
      offset = 0
    } = filters;

    // Construir query de MongoDB
    const mongoFilter: any = {};

    // Por defecto, solo 1-649 (Gen I-V)
    mongoFilter.pokeapi_id = { $gte: 1, $lte: 649 };

    // Búsqueda
    if (search) {
      mongoFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { pokeapi_id: parseInt(search) || -1 }
      ];
    }

    // Tipos
    if (types.length > 0) {
      mongoFilter.types = { $in: types.map((t: string) => t.toLowerCase()) };
    }

    // Generación
    if (generation) {
      mongoFilter.generation = generation;
    }

    // Legendarios
    if (isLegendary === true) {
      mongoFilter.is_legendary = true;
    } else if (isLegendary === false) {
      mongoFilter.is_legendary = false;
    }

    // Míticos
    if (isMythical === true) {
      mongoFilter.is_mythical = true;
    } else if (isMythical === false) {
      mongoFilter.is_mythical = false;
    }

    try {
      // OPCIÓN 1: Consultar MongoDB primero
      if (this.dbConnected) {
        console.log('📋 Consultando MongoDB con filtros...');
        const pokemon = await getPokemonList(mongoFilter, limit, offset);
        const total = await countPokemon(mongoFilter);

        if (pokemon.length > 0) {
          console.log(`✅ Obtenidos ${pokemon.length} de ${total} Pokémon desde MongoDB`);
          return { pokemon, total };
        }

        // FALLBACK: Si MongoDB retorna vacío, obtener de PokeAPI
        console.log('⚠️ Sin resultados en MongoDB, obteniendo de PokeAPI...');
      }

      // OPCIÓN 2: Obtener todos y filtrar en memoria (PokeAPI)
      console.log('🌐 Cargando Pokémon de PokeAPI con filtros...');
      const allPokemon: Pokemon[] = [];

      for (const id of VALID_POKEMON_IDS) {
        const poke = await this.getPokemonById(id);
        if (poke) {
          // Aplicar filtros localmente
          if (search && !poke.name.toLowerCase().includes(search.toLowerCase())) continue;
          if (types.length > 0 && !types.some(t => poke.types.includes(t.toLowerCase()))) continue;
          if (generation && poke.generation !== generation) continue;
          if (isLegendary === true && !poke.is_legendary) continue;
          if (isLegendary === false && poke.is_legendary) continue;
          if (isMythical === true && !poke.is_mythical) continue;
          if (isMythical === false && poke.is_mythical) continue;

          allPokemon.push(poke);
        }
      }

      const total = allPokemon.length;
      const paginated = allPokemon.slice(offset, offset + limit);

      console.log(`✅ Obtenidos ${paginated.length} de ${total} Pokémon desde PokeAPI`);

      return { pokemon: paginated, total };
    } catch (error) {
      console.error('❌ Error en listPokemon:', error);
      return { pokemon: [], total: 0 };
    }
  }

  /**
   * Busca Pokémon por nombre
   */
  async searchPokemon(query: string): Promise<Pokemon[]> {
    const { pokemon } = await this.listPokemon({
      search: query,
      limit: 100
    });
    return pokemon;
  }

  /**
   * Obtiene Pokémon por tipo
   */
  async getPokemonByType(type: string): Promise<Pokemon[]> {
    const { pokemon } = await this.listPokemon({
      types: [type.toLowerCase()],
      limit: 100
    });
    return pokemon;
  }

  /**
   * Obtiene legendarios
   */
  async getLegendaryPokemon(): Promise<Pokemon[]> {
    const { pokemon } = await this.listPokemon({
      isLegendary: true,
      limit: 50
    });
    return pokemon;
  }

  /**
   * Obtiene míticos
   */
  async getMythicalPokemon(): Promise<Pokemon[]> {
    const { pokemon } = await this.listPokemon({
      isMythical: true,
      limit: 50
    });
    return pokemon;
  }

  /**
   * Obtiene Pokémon por generación
   */
  async getPokemonByGeneration(gen: number): Promise<Pokemon[]> {
    const { pokemon } = await this.listPokemon({
      generation: gen,
      limit: 200
    });
    return pokemon;
  }

  /**
   * Tipos disponibles
   */
  getAvailableTypes(): string[] {
    return [
      'normal', 'fire', 'water', 'electric', 'grass',
      'ice', 'fighting', 'poison', 'ground', 'flying',
      'psychic', 'bug', 'rock', 'ghost', 'dragon',
      'dark', 'steel', 'fairy'
    ];
  }

  /**
   * Generaciones
   */
  getGenerationInfo(): Record<number, { name: string; range: [number, number] }> {
    return {
      1: { name: 'Generation I (Red/Blue)', range: [1, 151] },
      2: { name: 'Generation II (Gold/Silver)', range: [152, 251] },
      3: { name: 'Generation III (Ruby/Sapphire)', range: [252, 386] },
      4: { name: 'Generation IV (Diamond/Pearl)', range: [387, 493] },
      5: { name: 'Generation V (Black/White)', range: [494, 649] }
    };
  }

  /**
   * Colores de tipos
   */
  getTypeColors(): Record<string, string> {
    return {
      normal: '#A8A878',
      fire: '#F08030',
      water: '#6890F0',
      electric: '#F8D030',
      grass: '#78C850',
      ice: '#98D8D8',
      fighting: '#C03028',
      poison: '#A040A0',
      ground: '#E0C068',
      flying: '#A890F0',
      psychic: '#F85888',
      bug: '#A8B820',
      rock: '#B8A038',
      ghost: '#705898',
      dragon: '#7038F8',
      dark: '#705848',
      steel: '#B8B8D0',
      fairy: '#EE99AC'
    };
  }

  /**
   * Consulta PokeAPI y formatea datos
   */
  private async fetchFromPokeAPI(id: number): Promise<Pokemon | null> {
    try {
      const response = await axios.get(`${POKEAPI_BASE}/pokemon/${id}`, {
        timeout: 10000
      });

      const data = response.data;
      const isLegendary = LEGENDARY_IDS.includes(id);
      const isMythical = MYTHICAL_IDS.includes(id);

      // Obtener generación desde especies
      const speciesResponse = await axios.get(data.species.url, {
        timeout: 10000
      });
      const generation = this.extractGenerationNumber(speciesResponse.data.generation.url);

      // Obtener movimientos (devuelve move_ids)
      const moveIds = await this.getValidMoves(data.moves);

      const pokemon: Pokemon = {
        pokeapi_id: id,
        name: data.name,
        generation,
        types: data.types.map((t: any) => t.type.name.toLowerCase()),
        stats: {
          hp: data.stats[0]?.base_stat || 0,
          attack: data.stats[1]?.base_stat || 0,
          defense: data.stats[2]?.base_stat || 0,
          sp_attack: data.stats[3]?.base_stat || 0,
          sp_defense: data.stats[4]?.base_stat || 0,
          speed: data.stats[5]?.base_stat || 0
        },
        base_experience: data.base_experience || 0,
        is_legendary: isLegendary,
        is_mythical: isMythical,
        move_ids: moveIds,
        sprites: {
          animated_gif: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`,
          static_png: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
        },
        height_dm: data.height,
        weight_hg: data.weight,
        cached_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return pokemon;
    } catch (error) {
      console.error(`❌ Error fetching from PokeAPI for ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Extrae número de generación
   */
  private extractGenerationNumber(url: string): number {
    const match = url.match(/\/(\d+)\//);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Obtiene TODOS los movimientos de un Pokémon (sin filtro)
   * 1. Obtiene datos completos del movimiento desde PokeAPI
   * 2. Obtiene nombres en español e inglés
   * 3. Guarda el movimiento en la colección moves (normalizado)
   * 4. Retorna los move_ids para el Pokémon
   */
  private async getValidMoves(moves: any[]): Promise<number[]> {
    const validMoveIds: number[] = [];
    const seenMoveIds = new Set<number>();
    const movesToInsert: any[] = [];

    // Procesar TODOS los movimientos disponibles (SIN FILTRO)
    for (const moveData of moves) {
      try {
        const moveResponse = await axios.get(moveData.move.url, {
          timeout: 5000
        });

        const move = moveResponse.data;
        const moveId = move.id;

        // Evitar duplicados
        if (seenMoveIds.has(moveId)) continue;
        seenMoveIds.add(moveId);

        // Obtener nombres en español e inglés
        const names = this.extractMoveNames(move.names || []);
        
        // Obtener descripción en español (o inglés como fallback)
        const description = this.extractMoveDescription(move.flavor_text_entries || []);

        // Crear objeto de movimiento normalizado (TODOS los moves)
        const normalizedMove = {
          move_id: moveId,
          name: move.name.replace(/-/g, ' ').toLowerCase(),
          names: names,  // { es, en, ja }
          type: move.type.name.toLowerCase(),
          damage_class: move.damage_class?.name || 'status',
          power: move.power || null,
          accuracy: move.accuracy || null,
          pp: move.pp || 5,
          priority: move.priority || 0,
          target: move.target?.name || 'selected-pokemon',
          description: description,  // Descripción en español/inglés
          meta: {
            ailment: move.meta?.ailment?.name || null,
            ailment_chance: move.meta?.ailment_chance || 0,
            stat_changes: (move.stat_changes || []).map((sc: any) => ({
              stat: sc.stat.name,
              change: sc.change
            })),
            flinch_chance: move.meta?.flinch_chance || 0,
            heal: move.meta?.heal || 0
          },
          flags: {
            contact: move.flags?.contact || false,
            recharge: move.flags?.recharge || false,
            protect: move.flags?.protect || false,
            mirror: move.flags?.mirror_move || false,
            sound: move.flags?.sound || false
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        validMoveIds.push(moveId);
        movesToInsert.push(normalizedMove);
        console.log(`  ✅ Move guardado: ${names.es} (ID: ${moveId})`);
      } catch (error) {
        console.warn(`⚠️ Error fetching move: ${moveData.move.name}`);
      }
    }

    // Insertar TODOS los movimientos en la colección moves (batch para eficiencia)
    if (movesToInsert.length > 0) {
      try {
        await insertMovesBatch(movesToInsert);
        console.log(`💾 ${movesToInsert.length} movimientos guardados en colección moves`);
        
        // Agregar al cache en memoria
        for (const move of movesToInsert) {
          movesCache.set(move.move_id, move);
        }
      } catch (error) {
        console.warn(`⚠️ Error guardando movimientos en batch:`, error);
      }
    }

    // Ordenar IDs para mejor visualización
    validMoveIds.sort((a, b) => a - b);

    console.log(`✅ ${validMoveIds.length} movimientos guardados para este Pokémon`);
    return validMoveIds;
  }

  /**
   * Extrae nombres del movimiento en español, inglés y japonés
   */
  private extractMoveNames(names: any[]): { es: string; en: string; ja: string } {
    let esName = '';
    let enName = '';
    let jaName = '';

    for (const nameEntry of names) {
      switch (nameEntry.language.name) {
        case 'es':
          esName = nameEntry.name;
          break;
        case 'en':
          enName = nameEntry.name;
          break;
        case 'ja':
          jaName = nameEntry.name;
          break;
      }
    }

    return {
      es: esName || '',
      en: enName || '',
      ja: jaName || ''
    };
  }

  /**
   * Extrae descripción del movimiento (prioridad: español > inglés)
   */
  private extractMoveDescription(flavorTextEntries: any[]): string | null {
    // Prioridad: español > inglés
    let descES = null;
    let descEN = null;

    for (const entry of flavorTextEntries) {
      if (entry.language.name === 'es') {
        descES = entry.flavor_text
          .replace(/\f/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (entry.language.name === 'en' && !descEN) {
        descEN = entry.flavor_text
          .replace(/\f/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    return descES || descEN || null;
  }

  /**
   * Estadísticas de caché
   */
  getCacheStats(): { memoryCache: number; dbConnected: boolean; message: string } {
    return {
      memoryCache: this.inMemoryCache.size,
      dbConnected: this.dbConnected,
      message: this.dbConnected
        ? `${this.inMemoryCache.size} en caché (MongoDB como persistencia)`
        : `${this.inMemoryCache.size} en caché en memoria (MongoDB no disponible)`
    };
  }

  /**
   * Limpia caché en memoria
   */
  clearMemoryCache(): void {
    this.inMemoryCache.clear();
    console.log('🧹 Caché en memoria limpiado');
  }

  /**
   * Obtiene los movimientos completos de un Pokémon (para frontend)
   * @param pokemonId ID del Pokémon en PokeAPI
   */
  async getPokemonMoves(pokemonId: number): Promise<any[]> {
    // 1. Obtener el Pokémon de la DB (contiene move_ids)
    const pokemon = await this.getPokemonById(pokemonId);
    
    if (!pokemon || !pokemon.move_ids || pokemon.move_ids.length === 0) {
      return [];
    }

    // 2. Obtener los detalles de los movimientos desde la colección moves
    const moves = await getMovesByIds(pokemon.move_ids);
    
    // Ordenar por nombre
    return moves.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Obtiene un movimiento por su ID (desde cache o DB)
   */
  async getMoveById(moveId: number): Promise<any | null> {
    // Primero verificar en cache
    if (movesCache.has(moveId)) {
      return movesCache.get(moveId);
    }

    // Si no está en cache, buscar en DB
    const { getMoveById: getMove } = await import('../db/mongodb');
    const move = await getMove(moveId);
    
    if (move) {
      movesCache.set(moveId, move);
    }
    
    return move;
  }

  /**
   * Carga todos los movimientos al cache en memoria (para battle engine)
   */
  async preloadMovesToCache(): Promise<void> {
    const allMoves = await getAllMoves();
    
    for (const move of allMoves) {
      movesCache.set(move.move_id, move);
    }
    
    console.log(`✅ ${allMoves.length} movimientos cargados al cache`);
  }

  /**
   * Obtiene el estado del cache de movimientos
   */
  getMovesCacheStats(): { size: number; message: string } {
    return {
      size: movesCache.size,
      message: `${movesCache.size} movimientos en cache`
    };
  }

  /**
   * Obtiene la descripción en español de un movimiento desde PokeAPI
   */
  private async getMoveDescriptionES(moveId: number): Promise<string | null> {
    try {
      const response = await axios.get(`${POKEAPI_BASE}/move/${moveId}`, {
        timeout: 5000
      });

      const data = response.data;
      
      // Buscar flavor_text en español
      const flavorTextEntries = data.flavor_text_entries || [];
      
      // Prioridad: español > español (gen 5) > inglés
      let descES = null;
      
      // Buscar específicamente "es" o "Spanish"
      for (const entry of flavorTextEntries) {
        if (entry.language.name === 'es') {
          descES = entry.flavor_text
            .replace(/\f/g, ' ')  // Reemplazar form feed
            .replace(/\n/g, ' ')   // Reemplazar saltos de línea
            .replace(/\s+/g, ' ')  // Normalizar espacios
            .trim();
          break;
        }
      }

      // Si no hay español, usar inglés (fallback)
      if (!descES) {
        const enEntry = flavorTextEntries.find((e: any) => e.language.name === 'en');
        if (enEntry) {
          descES = enEntry.flavor_text
            .replace(/\f/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }

      return descES;
    } catch (error) {
      console.warn(`⚠️ Error obteniendo descripción para move ${moveId}`);
      return null;
    }
  }

  /**
   * Obtiene los nombres traducidos de un movimiento
   */
  private async getMoveNames(moveId: number): Promise<{ es: string; en: string; ja: string } | null> {
    try {
      const response = await axios.get(`${POKEAPI_BASE}/move/${moveId}`, {
        timeout: 5000
      });

      const data = response.data;
      const names = data.names || [];

      let esName = data.name;
      let enName = data.name;
      let jaName = data.name;

      for (const nameEntry of names) {
        switch (nameEntry.language.name) {
          case 'es':
            esName = nameEntry.name;
            break;
          case 'en':
            enName = nameEntry.name;
            break;
          case 'ja':
            jaName = nameEntry.name;
            break;
        }
      }

      return {
        es: esName,
        en: enName,
        ja: jaName
      };
    } catch (error) {
      console.warn(`⚠️ Error obteniendo nombres para move ${moveId}`);
      return null;
    }
  }

  /**
   * Actualiza todos los movimientos con descripciones en español
   * Migrations: agrega description y names a los movimientos existentes
   */
  async updateMovesWithSpanishData(): Promise<{ updated: number; errors: number }> {
    const { getAllMoves, insertMove } = await import('../db/mongodb');
    
    console.log('🔄 Iniciando actualización de movimientos con descripciones en español...');
    
    const allMoves = await getAllMoves();
    console.log(`📊 Total de movimientos a actualizar: ${allMoves.length}`);
    
    let updated = 0;
    let errors = 0;

    for (const move of allMoves) {
      try {
        // Obtener descripción en español
        const description = await this.getMoveDescriptionES(move.move_id);
        
        // Obtener nombres traducidos
        const names = await this.getMoveNames(move.move_id);

        // Actualizar el movimiento
        const updatedMove = {
          ...move,
          description: description || move.description || null,
          names: names || move.names || { es: move.name, en: move.name, ja: move.name },
          updated_at: new Date().toISOString()
        };

        await insertMove(updatedMove);
        
        // Actualizar cache
        movesCache.set(move.move_id, updatedMove);
        
        updated++;
        
        if (updated % 50 === 0) {
          console.log(`✅ Actualizados ${updated}/${allMoves.length} movimientos...`);
        }

        // Rate limiting para no sobrecargar PokeAPI
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ Error actualizando move ${move.move_id}:`, error);
        errors++;
      }
    }

    console.log(`✅ Migración completada: ${updated} actualizados, ${errors} errores`);
    return { updated, errors };
  }
}

export const pokemonService = new PokemonService();
