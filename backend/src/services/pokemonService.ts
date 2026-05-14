import axios from 'axios';
import {
  getPokemonCollection,
  getPokemonById as getFromDB,
  insertPokemon,
  getPokemonList,
  countPokemon,
  getAllPokemonIds
} from '../db/mongodb';

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
  moves: Array<{
    name: string;
    type: string;
    power: number | null;
    accuracy: number | null;
    priority: number;
    damage_class: string;
  }>;
  sprites: {
    animated_gif: string;
    static_png: string;
  };
  height_dm: number;
  weight_hg: number;
  cached_at: string;
  updated_at: string;
}

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

      // Obtener movimientos
      const moves = await this.getValidMoves(data.moves);

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
        moves,
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
   * Obtiene movimientos válidos
   */
  private async getValidMoves(moves: any[]): Promise<Pokemon['moves']> {
    const validMoves: Pokemon['moves'] = [];

    for (const moveData of moves.slice(0, 20)) {
      try {
        const moveResponse = await axios.get(moveData.move.url, {
          timeout: 5000
        });

        const move = moveResponse.data;
        if (move.power && move.accuracy) {
          validMoves.push({
            name: move.name.replace('-', ' '),
            type: move.type.name.toLowerCase(),
            power: move.power,
            accuracy: move.accuracy,
            priority: move.priority,
            damage_class: move.damage_class.name
          });

          if (validMoves.length >= 4) break;
        }
      } catch (error) {
        // Continuar
      }
    }

    return validMoves;
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
}

export const pokemonService = new PokemonService();
