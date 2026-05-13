const API_BASE = 'http://localhost:3000/api';

export async function createRoom(): Promise<string> {
  const res = await fetch(`${API_BASE}/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create room');
  const data = await res.json();
  return data.code;
}

export async function getRoom(code: string): Promise<any> {
  const res = await fetch(`${API_BASE}/rooms/${code}`);
  if (!res.ok) throw new Error('Room not found');
  return res.json();
}

export async function joinRoom(code: string, playerId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/rooms/${code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  });
  if (!res.ok) throw new Error('Failed to join room');
  return res.json();
}

export async function searchPokemon(query: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/pokemon/search?query=${query}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchAllPokemon(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/pokemon/list/gen5`);
  if (!res.ok) return [];
  return res.json();
}

export async function getPokemon(idOrName: string): Promise<any> {
  const res = await fetch(`${API_BASE}/pokemon/${idOrName}`);
  if (!res.ok) throw new Error('Pokemon not found');
  return res.json();
}

export async function getMove(moveId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/moves/${moveId}`);
  if (!res.ok) throw new Error('Move not found');
  return res.json();
}