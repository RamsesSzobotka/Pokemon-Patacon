import { create } from 'zustand';

interface RoomState {
  code: string | null;
  room: any | null;
  isHost: boolean;
  playerId: string | null;
  ready: boolean;
  setRoom: (code: string, room: any, isHost: boolean, playerId: string) => void;
  setReady: (ready: boolean) => void;
  clearRoom: () => void;
}

export const useRoom = create<RoomState>((set) => ({
  code: null,
  room: null,
  isHost: false,
  playerId: null,
  ready: false,
  setRoom: (code, room, isHost, playerId) =>
    set({ code, room, isHost, playerId }),
  setReady: (ready) => set({ ready }),
  clearRoom: () =>
    set({ code: null, room: null, isHost: false, playerId: null, ready: false }),
}));