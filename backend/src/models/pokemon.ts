export interface Pokemon {
  _id?: any;
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
  moves: Move[];
  is_legendary: boolean;
  sprites: {
    official_artwork: string;
    front_default: string;
    bw_sprite?: string;
  };
  cached_at: Date;
  updated_at?: Date;
}

export interface Move {
  name: string;
  power: number | null;
  accuracy: number | null;
  type: string;
  damage_class: string;
}