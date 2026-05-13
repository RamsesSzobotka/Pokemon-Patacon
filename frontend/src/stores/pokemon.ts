import { create } from 'zustand';
import { fetchAllPokemon, searchPokemon } from '../services/pokemonApi';

interface PokemonState {
  allPokemon: any[];
  search: string;
  selected: any[];
  loading: boolean;
  setAllPokemon: () => Promise<void>;
  setSearch: (search: string) => void;
  addToTeam: (pokemon: any) => void;
  removeFromTeam: (index: number) => void;
  clearTeam: () => void;
}

export const usePokemon = create<PokemonState>((set, get) => ({
  allPokemon: [],
  search: '',
  selected: [],
  loading: false,
  setAllPokemon: async () => {
    set({ loading: true });
    try {
      const pokemon = await fetchAllPokemon();
      set({ allPokemon: pokemon, loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },
  setSearch: (search) => set({ search }),
  addToTeam: (pokemon) => {
    const { selected } = get();
    if (selected.length < 6) {
      set({ selected: [...selected, pokemon] });
    }
  },
  removeFromTeam: (index) => {
    const { selected } = get();
    set({ selected: selected.filter((_, i) => i !== index) });
  },
  clearTeam: () => set({ selected: [] }),
}));