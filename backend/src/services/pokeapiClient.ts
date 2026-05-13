import { getDb } from '../db/mongo';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

export interface PokemonData {
  pokeapi_id: number;
  name: string;
  type: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    sp_attack: number;
    sp_defense: number;
    speed: number;
  };
  moves: MoveData[];
  is_legendary: boolean;
  sprites: {
    official_artwork: string;
    front_default: string;
    front_shiny: string;
    bw_sprite: string;
  };
  height: number;
  weight: number;
}

export interface MoveData {
  name: string;
  power: number | null;
  accuracy: number | null;
  type: string;
  damage_class: string;
  priority: number;
  effect_chance: number | null;
}

export async function fetchPokemonFromPokeAPI(idOrName: string): Promise<PokemonData | null> {
  try {
    const res = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      pokeapi_id: data.id,
      name: data.name,
      type: data.types.map((t: any) => t.type.name),
      stats: {
        hp: data.stats.find((s: any) => s.stat.name === 'hp').base_stat,
        attack: data.stats.find((s: any) => s.stat.name === 'attack').base_stat,
        defense: data.stats.find((s: any) => s.stat.name === 'defense').base_stat,
        sp_attack: data.stats.find((s: any) => s.stat.name === 'special-attack').base_stat,
        sp_defense: data.stats.find((s: any) => s.stat.name === 'special-defense').base_stat,
        speed: data.stats.find((s: any) => s.stat.name === 'speed').base_stat,
      },
      moves: [],
      is_legendary: false,
      sprites: {
        official_artwork: data.sprites.other['official-artwork'].front_default,
        front_default: data.sprites.front_default,
        front_shiny: data.sprites.front_shiny,
        bw_sprite: data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default,
      },
      height: data.height,
      weight: data.weight,
    };
  } catch (e) {
    console.error('Error fetching pokemon:', e);
    return null;
  }
}

export async function cachePokemon(pokemon: PokemonData): Promise<void> {
  const db = getDb();
  await db.collection('pokemon').updateOne(
    { pokeapi_id: pokemon.pokeapi_id },
    { $set: { ...pokemon, cached_at: new Date() } },
    { upsert: true }
  );
}

export async function fetchMoveFromPokeAPI(idOrName: string): Promise<any | null> {
  try {
    const res = await fetch(`${POKEAPI_BASE}/move/${idOrName}`);
    if (!res.ok) return null;
    const data = await res.json();

    return {
      pokeapi_id: data.id,
      name: data.name,
      power: data.power,
      accuracy: data.accuracy,
      type: data.type.name,
      damage_class: data.damage_class?.name || 'status',
      priority: data.priority,
      effect_chance: data.effect_chance,
      effect: data.effect_entries?.[0]?.short_effect,
    };
  } catch (e) {
    console.error('Error fetching move:', e);
    return null;
  }
}