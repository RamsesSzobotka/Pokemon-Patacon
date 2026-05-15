/**
 * Tipos compartidos para Pokémon Patacon
 */

export interface MoveType {
  _id?: string;
  move_id: number;
  name: string;
  names?: {
    es: string;
    en: string;
    ja: string;
  };
  description?: string;
  type: string;
  damage_class: 'physical' | 'special' | 'status';
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
}

export interface PokemonType {
  id?: string;
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
    // Sprites animados Gen V Black/White
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
    back_shiny: string | null;
    // Sprites female (no disponibles en Gen V)
    front_female: string | null;
    back_female: string | null;
    front_shiny_female: string | null;
    back_shiny_female: string | null;
    // Sprites estáticos (fallback)
    static_front_default: string | null;
    static_back_default: string | null;
  };
  height_dm: number;
  weight_hg: number;
  cached_at: string;
  updated_at: string;
}

export interface PokemonFilter {
  search?: string;
  types?: string[];
  generation?: number;
  isLegendary?: boolean;
  isMythical?: boolean;
  limit?: number;
  offset?: number;
}

export interface PokemonListResponse {
  success: boolean;
  data: {
    pokemon: PokemonType[];
    total: number;
    limit: number;
    offset: number;
    pages: number;
  };
  message?: string;
}

export interface RoomData {
  code: string;
  created_at: string;
  expires_at: string;
  state: 'waiting' | 'draft' | 'battle' | 'finished';
  players: {
    player1?: {
      name: string;
      socket_id: string;
      team?: PokemonType[];
      status: 'waiting' | 'ready' | 'active';
    };
    player2?: {
      name: string;
      socket_id: string;
      team?: PokemonType[];
      status: 'waiting' | 'ready' | 'active';
    };
  };
}

export interface BattleState {
  room_code: string;
  phase: 'draft' | 'battle' | 'end';
  current_turn: number;
  players: {
    player1: {
      name: string;
      team: PokemonType[];
      active_pokemon: PokemonType;
      hp: number;
      status: string[];
      items_used: number;
    };
    player2: {
      name: string;
      team: PokemonType[];
      active_pokemon: PokemonType;
      hp: number;
      status: string[];
      items_used: number;
    };
  };
}

export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass',
  'ice', 'fighting', 'poison', 'ground', 'flying',
  'psychic', 'bug', 'rock', 'ghost', 'dragon',
  'dark', 'steel', 'fairy'
] as const;

export const TYPE_COLORS: Record<string, string> = {
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

export const GENERATIONS = {
  1: { name: 'Generation I (Red/Blue)', range: [1, 151] },
  2: { name: 'Generation II (Gold/Silver)', range: [152, 251] },
  3: { name: 'Generation III (Ruby/Sapphire)', range: [252, 386] },
  4: { name: 'Generation IV (Diamond/Pearl)', range: [387, 493] },
  5: { name: 'Generation V (Black/White)', range: [494, 649] }
} as const;
