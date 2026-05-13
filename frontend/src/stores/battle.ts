import { create } from 'zustand';

interface BattleState {
  roomCode: string | null;
  turn: number;
  currentPlayer: string;
  playerId: string;
  state: any | null;
  connected: boolean;
  setRoomCode: (code: string, playerId: string) => void;
  setState: (state: any) => void;
  setTurn: (turn: number) => void;
  sendAction: (action: any) => void;
  useItem: (itemType: 'potion' | 'revive') => void;
  clear: () => void;
}

export const useBattle = create<BattleState>((set, get) => ({
  roomCode: null,
  turn: 0,
  currentPlayer: '',
  playerId: '',
  state: null,
  connected: false,
  setRoomCode: (code, playerId) => set({ roomCode: code, playerId }),
  setState: (state) => set({ state }),
  setTurn: (turn) => set({ turn }),
  sendAction: (action) => {
  },
  useItem: (itemType) => {
  },
  clear: () =>
    set({
      roomCode: null,
      turn: 0,
      currentPlayer: '',
      state: null,
      connected: false,
    }),
}));