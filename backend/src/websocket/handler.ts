import { WebSocketServer, WebSocket } from 'ws';
import { generateSessionId, generateRoomCode } from '../services/roomManager';

interface Client {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

const rooms = new Map<string, Set<Client>>();

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    const playerId = generateSessionId();
    const client: Client = { ws, playerId, roomCode: null };

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(client, msg);
      } catch (e) {
        ws.send(JSON.stringify({ event: 'error', message: 'Invalid message' }));
      }
    });

    ws.on('close', () => {
      handleDisconnect(client);
    });

    ws.send(JSON.stringify({ event: 'connected', playerId }));
  });
}

function handleMessage(client: Client, msg: any): void {
  switch (msg.event) {
    case 'room:create':
      handleCreateRoom(client);
      break;
    case 'room:join':
      handleJoinRoom(client, msg.code);
      break;
    case 'room:leave':
      handleLeaveRoom(client);
      break;
    case 'pokemon:select':
      handlePokemonSelect(client, msg.team);
      break;
    case 'turn:action':
      handleTurnAction(client, msg.action);
      break;
    case 'item:use':
      handleItemUse(client, msg.item);
      break;
    default:
      client.ws.send(JSON.stringify({ event: 'error', message: 'Unknown event' }));
  }
}

function handleCreateRoom(client: Client): void {
  const code = generateRoomCode();
  const room = new Set([client]);
  rooms.set(code, room);
  client.roomCode = code;
  client.ws.send(JSON.stringify({ event: 'room:created', code }));
}

function handleJoinRoom(client: Client, code: string): void {
  const room = rooms.get(code);
  if (!room) {
    client.ws.send(JSON.stringify({ event: 'error', message: 'Room not found' }));
    return;
  }
  if (room.size >= 2) {
    client.ws.send(JSON.stringify({ event: 'error', message: 'Room full' }));
    return;
  }
  room.add(client);
  client.roomCode = code;
  client.ws.send(JSON.stringify({ event: 'room:joined', code }));

  room.forEach(c => {
    c.ws.send(JSON.stringify({ event: 'room:ready', code }));
  });
}

function handleLeaveRoom(client: Client): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (room) {
    room.delete(client);
    if (room.size === 0) {
      rooms.delete(client.roomCode);
    }
  }
  client.roomCode = null;
}

function handlePokemonSelect(client: Client, team: number[]): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;
  room.forEach(c => {
    c.ws.send(JSON.stringify({ event: 'pokemon:selected', playerId: client.playerId, team }));
  });
}

function handleTurnAction(client: Client, action: any): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;
  room.forEach(c => {
    c.ws.send(JSON.stringify({ event: 'turn:action', playerId: client.playerId, action }));
  });
}

function handleItemUse(client: Client, item: any): void {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;
  room.forEach(c => {
    c.ws.send(JSON.stringify({ event: 'item:used', playerId: client.playerId, item }));
  });
}

function handleDisconnect(client: Client): void {
  handleLeaveRoom(client);
}