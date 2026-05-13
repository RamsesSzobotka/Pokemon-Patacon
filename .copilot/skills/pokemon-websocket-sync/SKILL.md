---
name: Pokemon WebSocket Real-Time Synchronization
description: Real-time synchronization patterns for Pokemon Patacon using WebSocket. Covers event broadcast, state reconciliation, dual-screen sync, and connection handling.
trigger: When implementing WebSocket event handlers, synchronizing battle state between clients, broadcasting actions, or handling reconnections. Use when working with sync.ts, rooms.ts, or handleWebSocketEvents.
domain: Pokemon Patacon Real-Time Sync
version: 1.0
---

# Pokémon Patacon - WebSocket Real-Time Synchronization Skill

## Overview

Pokemon Patacon runs on **server-authoritative** real-time architecture. Both players see the same state, synchronized instantly via WebSocket. This skill covers all synchronization patterns, event structures, and connection management.

**Core Principle:** Single source of truth (server) broadcasts to both clients, never client-to-client.

---

## 1. Connection Architecture

### 1.1 WebSocket Flow

```
Client (Player A)                Server (Hono)              Client (Player B)
    │                                 │                           │
    ├─── ws://localhost/battle/AB3F2K ─┤                           │
    │                                 ├─── ws://localhost/battle/AB3F2K ───┤
    │                                 │                           │
    │ Action: Select Pikachu          │                           │
    ├─────────────────────────────────>                           │
    │                                 │ Process & Validate        │
    │                                 │ Update State              │
    │                                 │ Broadcast to all          │
    │                                 ├────────────────────────────>
    │  pokemon:selected event         │                           Pokémon marked
    │<─────────────────────────────────┤                           unavailable
    │                                 │                           │
```

### 1.2 Room Management

```typescript
interface Room {
  id: string;                    // MongoDB ObjectId
  code: string;                  // "AB3F2K" - user-facing code
  battle_id?: string;            // Active battle ID
  players: {
    P1?: WebSocket & { session_id: string };
    P2?: WebSocket & { session_id: string };
  };
  status: 'waiting' | 'in_draft' | 'in_battle' | 'finished';
  created_at: Date;
  last_activity: Date;
}

// Global room store
const rooms = new Map<string, Room>();

function getRoomByCode(code: string): Room | null {
  return rooms.get(code);
}

function addPlayerToRoom(room: Room, player: WebSocket, sessionId: string, playerSlot: 'P1' | 'P2'): void {
  room.players[playerSlot] = player;
  room.players[playerSlot].session_id = sessionId;
  player.on('message', (data) => handleMessage(room, playerSlot, data));
}

function broadcastToRoom(room: Room, event: any, exclude?: 'P1' | 'P2'): void {
  if (room.players.P1 && (!exclude || exclude !== 'P1')) {
    room.players.P1.send(JSON.stringify(event));
  }
  if (room.players.P2 && (!exclude || exclude !== 'P2')) {
    room.players.P2.send(JSON.stringify(event));
  }
}
```

---

## 2. Core Sync Events

### 2.1 Pokemon Selection (Draft)

**Trigger:** Player selects Pokémon in draft

```typescript
// Client sends
{
  "event": "draft:select_pokemon",
  "pokemon_id": 25,
  "pokemon_name": "Pikachu"
}

// Server processes
function handleDraftSelect(room: Room, playerSlot: 'P1' | 'P2', pokemonId: number) {
  // Validate Pokémon not already selected
  const alreadySelected = room.draft_state.all_selected_ids.includes(pokemonId);
  if (alreadySelected) {
    sendError(room.players[playerSlot], "Pokémon already selected");
    return;
  }
  
  // Add to player's team
  room.draft_state[`${playerSlot}_team`].push(pokemonId);
  room.draft_state.all_selected_ids.push(pokemonId);
  
  // Broadcast to both players
  const event = {
    event: "pokemon:selected",
    player: playerSlot,
    pokemon_id: pokemonId,
    pokemon_name: "Pikachu",
    selected_count: {
      P1: room.draft_state.P1_team.length,
      P2: room.draft_state.P2_team.length
    }
  };
  
  broadcastToRoom(room, event);
}

// Both clients receive
{
  "event": "pokemon:selected",
  "player": "P1",
  "pokemon_id": 25,
  "pokemon_name": "Pikachu",
  "selected_count": { "P1": 1, "P2": 0 }
  // UI: Mark Pikachu as unavailable for P2
}
```

### 2.2 Turn Action

**Trigger:** Player selects action (attack, switch, item)

```typescript
// Client sends (Player A attacks with Thunderbolt)
{
  "event": "turn:action",
  "action_type": "attack",
  "move_name": "Thunderbolt",
  "move_id": 24
}

// Server stores action
function handleTurnAction(room: Room, playerSlot: 'P1' | 'P2', action: Action) {
  const battle = getActiveBattle(room);
  battle.actions[playerSlot] = action;
  
  // Notify OTHER player that action is received (progress indicator)
  const otherPlayer = playerSlot === 'P1' ? 'P2' : 'P1';
  const event = {
    event: "turn:waiting",
    waiting_for: otherPlayer,  // "Waiting for Player B..."
    timestamp: Date.now()
  };
  
  broadcastToRoom(room, event, exclude: playerSlot);
  
  // Check if both actions received
  if (battle.actions.P1 && battle.actions.P2) {
    executeTurn(room, battle);
  }
}

// Player B receives
{
  "event": "turn:waiting",
  "waiting_for": "P2",
  "timestamp": 1622000000
  // UI: Show spinner/countdown "Waiting for Player B..."
}
```

### 2.3 Turn Execution (Critical Event)

**Trigger:** Both players have submitted actions, server processes turn

```typescript
// Server broadcasts to BOTH players
{
  "event": "turn:execute",
  "turn": 5,
  
  "coinflip_result": "P1",  // Who attacked first
  
  "actions": {
    "P1": {
      "type": "attack",
      "move": "Thunderbolt",
      "target": "P2_active",
      "damage_dealt": 42,
      "type_effectiveness": "super_effective",
      "hit": true
    },
    "P2": {
      "type": "attack",
      "move": "Ember",
      "target": "P1_active",
      "damage_dealt": 28,
      "type_effectiveness": "normal",
      "hit": true
    }
  },
  
  "state_after": {
    "P1": {
      "active_pokemon": {
        "name": "Zapdos",
        "hp": 62,
        "max_hp": 90,
        "hp_percentage": 68.9,
        "status": null,
        "status_turns_remaining": 0
      },
      "team_alive": 5,
      "items": {
        "potion": 3,
        "revive": 2
      }
    },
    "P2": {
      "active_pokemon": {
        "name": "Charizard",
        "hp": 78,
        "max_hp": 106,
        "hp_percentage": 73.6,
        "status": null,
        "status_turns_remaining": 0
      },
      "team_alive": 6,
      "items": {
        "potion": 2,
        "revive": 2
      }
    }
  },
  
  "timestamp": 1622000005
}

// Both clients receive and render:
// 1. Coinflip animation (shows winner)
// 2. P1's Thunderbolt animation
// 3. P2's HP decreases to 78
// 4. P2's Ember animation
// 5. P1's HP decreases to 62
// 6. HP bars update
// 7. Battle log: "Zapdos used Thunderbolt! Super effective! Charizard takes 42 damage!"
// 8. Battle log: "Charizard used Ember! Zapdos takes 28 damage!"
```

### 2.4 Pokemon Fainted

**Trigger:** Active Pokémon HP reaches 0

```typescript
// Server broadcasts
{
  "event": "pokemon:fainted",
  "player": "P2",
  "pokemon_name": "Charizard",
  "remaining_pokemon": 5,
  
  "options": ["switch_pokemon", "forfeit"],
  
  "timestamp": 1622000010
}

// Both clients receive:
// UI for P2: Show faint animation, prompt to switch Pokémon
// UI for P1: See opponent's Pokémon fainted, wait for switch
```

### 2.5 Pokemon Switch

**Trigger:** Player switches active Pokémon

```typescript
// Client sends
{
  "event": "turn:action",
  "action_type": "switch",
  "target_pokemon_id": 6  // Blastoise
}

// Server processes and broadcasts
{
  "event": "pokemon:switched",
  "player": "P1",
  "old_pokemon": "Pikachu",
  "new_pokemon": "Blastoise",
  "new_pokemon": {
    "name": "Blastoise",
    "hp": 100,
    "max_hp": 100,
    "status": null
  },
  "timestamp": 1622000015
}

// Both clients see the switch animation
```

### 2.6 Item Used

**Trigger:** Player uses potion or revive

```typescript
// Client sends
{
  "event": "turn:action",
  "action_type": "item",
  "item_type": "potion"  // or "revive"
}

// Server processes and broadcasts
{
  "event": "item:used",
  "player": "P1",
  "item_type": "potion",
  "effect": "restored_hp",
  "pokemon_affected": "Zapdos",
  "hp_restored": 90,
  "new_hp": 100,
  "remaining_items": {
    "potion": 2,
    "revive": 2
  },
  "timestamp": 1622000020
}

// Both clients see potion animation, HP fill up, counter decreases
```

### 2.7 Status Condition Applied

**Trigger:** Move applies status (burn, paralysis, etc)

```typescript
// Broadcast from turn:execute OR direct event
{
  "event": "status:applied",
  "pokemon_id": 25,
  "pokemon_name": "Pikachu",
  "status_type": "burn",
  "duration_turns": 3,
  "timestamp": 1622000025
}

// Both clients see burn icon on Pikachu, duration counter
```

### 2.8 Battle End

**Trigger:** One team has all Pokémon fainted

```typescript
// Server broadcasts
{
  "event": "battle:end",
  "winner": "P1",
  "reason": "opponent_team_fainted",
  "stats": {
    "total_turns": 12,
    "duration_seconds": 187,
    "P1_damage_dealt": 485,
    "P2_damage_dealt": 412,
    "P1_items_used": 1,
    "P2_items_used": 2
  },
  "timestamp": 1622000040
}

// Both clients:
// Show victory/defeat screen
// Show battle stats
// Offer "Play Again" or "Return to Lobby"
```

---

## 3. Synchronization Patterns

### 3.1 Optimistic Updates (Client-side)

```typescript
// On client: Show action immediately while waiting for server
function submitAction(action: Action) {
  // Optimistic: Show in UI immediately
  showActionInBattleLog(action);
  
  // Send to server
  socket.emit('turn:action', action);
  
  // Server will validate and broadcast - if invalid, show error
}

// On server response, either:
// 1. Confirm action is valid (nothing changes, already showed)
// 2. Reject action (show error, remove from log)
```

### 3.2 State Reconciliation

```typescript
// On client connect/reconnect, request full state
function onConnect(socket: WebSocket) {
  socket.on('connection', () => {
    socket.emit('request:full_state');
  });
  
  socket.on('state:full', (fullState: BattleState) => {
    // Replace local state entirely
    battleState.value = fullState;
    // Re-render everything
  });
}
```

### 3.3 Debouncing State Updates

```typescript
// Only broadcast state changes every 50ms to reduce network load
const stateQueue = [];

function queueStateUpdate(event: any) {
  stateQueue.push(event);
}

setInterval(() => {
  if (stateQueue.length > 0) {
    const batch = stateQueue.splice(0);
    broadcastToRoom(room, {
      event: 'state:batch',
      updates: batch
    });
  }
}, 50);
```

---

## 4. Error Handling & Validation

### 4.1 Action Validation on Server

```typescript
function handleTurnAction(room: Room, playerSlot: 'P1' | 'P2', action: Action) {
  const battle = getActiveBattle(room);
  const player = battle[playerSlot];
  
  // Validate action
  const validation = validateAction(action, battle, playerSlot);
  
  if (!validation.valid) {
    // Send error only to offending player
    const errorEvent = {
      event: 'error',
      message: validation.reason,
      action_rejected: true
    };
    room.players[playerSlot].send(JSON.stringify(errorEvent));
    return;
  }
  
  // Action valid, proceed
  battle.actions[playerSlot] = action;
  
  // Check both ready
  if (battle.actions.P1 && battle.actions.P2) {
    executeTurn(room, battle);
  }
}
```

### 4.2 Network Timeout Handling

```typescript
// Set timeout for opponent's action (30 seconds)
function startTurnTimeout(room: Room, battle: Battle) {
  const timeoutId = setTimeout(() => {
    // One player didn't respond
    // For now, auto-switch or forfeit
    const missingPlayer = !battle.actions.P1 ? 'P1' : 'P2';
    
    broadcastToRoom(room, {
      event: 'error:timeout',
      player_timed_out: missingPlayer,
      auto_action: 'forfeit'
    });
    
    endBattle(room, battle, missingPlayer === 'P1' ? 'P2' : 'P1');
  }, 30000);
  
  // Clear timeout if both submit
  if (battle.actions.P1 && battle.actions.P2) {
    clearTimeout(timeoutId);
  }
}
```

### 4.3 Client-side Error Display

```svelte
<!-- Svelte component -->
<script>
  import { onMessage } from './websocket.js';
  let error = null;
  
  onMessage('error', (msg) => {
    error = msg.message;
    setTimeout(() => error = null, 3000);  // Auto-clear after 3s
  });
</script>

{#if error}
  <div class="error-banner">{error}</div>
{/if}
```

---

## 5. Connection Management

### 5.1 Heartbeat & Keep-Alive

```typescript
// Server sends heartbeat every 5 seconds
setInterval(() => {
  const room = getRoomByCode(roomCode);
  if (room?.players.P1) {
    room.players.P1.send(JSON.stringify({ event: 'ping' }));
  }
  if (room?.players.P2) {
    room.players.P2.send(JSON.stringify({ event: 'ping' }));
  }
}, 5000);

// Client responds
socket.on('ping', () => {
  socket.send(JSON.stringify({ event: 'pong' }));
});

// Server tracks last pong
socket.on('pong', () => {
  room.players[playerSlot].last_pong = Date.now();
});

// If no pong for 15 seconds, mark disconnected
setInterval(() => {
  const now = Date.now();
  const room = getRoomByCode(roomCode);
  
  ['P1', 'P2'].forEach(slot => {
    if (room?.players[slot]?.last_pong) {
      if (now - room.players[slot].last_pong > 15000) {
        handleDisconnection(room, slot);
      }
    }
  });
}, 5000);
```

### 5.2 Reconnection Handling

```typescript
// Client detects disconnect, attempts reconnect
function onDisconnect() {
  showMessage("Connection lost. Reconnecting...");
  reconnectAttempts = 0;
  attemptReconnect();
}

function attemptReconnect() {
  reconnectAttempts++;
  
  if (reconnectAttempts > 5) {
    showMessage("Failed to reconnect. Battle ended.");
    return;
  }
  
  // Exponential backoff
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
  
  setTimeout(() => {
    socket = new WebSocket(`ws://localhost/battle/${roomCode}`);
    socket.on('connection', () => {
      showMessage("Reconnected!");
      // Request full state
      socket.send(JSON.stringify({ event: 'request:full_state' }));
    });
  }, delay);
}
```

### 5.3 Server-side Disconnect Handling

```typescript
function handleDisconnection(room: Room, playerSlot: 'P1' | 'P2') {
  const otherSlot = playerSlot === 'P1' ? 'P2' : 'P1';
  
  // Wait 30 seconds for reconnection
  const reconnectTimeout = setTimeout(() => {
    // Still disconnected after 30s
    const battle = getActiveBattle(room);
    
    if (battle) {
      // End battle, other player wins
      endBattle(room, battle, otherSlot);
    }
    
    // Notify other player
    broadcastToRoom(room, {
      event: 'opponent:disconnected',
      opponent: playerSlot,
      message: 'Opponent disconnected. You win!'
    }, exclude: otherSlot);
    
    // Clean up room after battle ends
    setTimeout(() => deleteRoom(room.code), 60000);
  }, 30000);
  
  room.reconnect_timeouts = room.reconnect_timeouts || {};
  room.reconnect_timeouts[playerSlot] = reconnectTimeout;
}

function handleReconnection(room: Room, playerSlot: 'P1' | 'P2') {
  // Cancel disconnection timeout
  if (room.reconnect_timeouts?.[playerSlot]) {
    clearTimeout(room.reconnect_timeouts[playerSlot]);
    delete room.reconnect_timeouts[playerSlot];
  }
  
  // Send full state to reconnected player
  const battle = getActiveBattle(room);
  room.players[playerSlot].send(JSON.stringify({
    event: 'state:full',
    battle: battle
  }));
}
```

---

## 6. Performance Optimization

### 6.1 Message Compression

```typescript
// Only send necessary state changes, not entire battle object
function createStateDelta(oldState: Battle, newState: Battle): object {
  const delta = {};
  
  if (oldState.player_1.active_pokemon.current_hp !== newState.player_1.active_pokemon.current_hp) {
    delta.P1_hp = newState.player_1.active_pokemon.current_hp;
  }
  
  if (oldState.player_2.active_pokemon.current_hp !== newState.player_2.active_pokemon.current_hp) {
    delta.P2_hp = newState.player_2.active_pokemon.current_hp;
  }
  
  // ... only include changed fields
  
  return delta;
}
```

### 6.2 Message Batching

```typescript
// Batch multiple events before sending
const messageBatch = [];
const BATCH_INTERVAL = 16;  // ~60 FPS

function queueMessage(event: any) {
  messageBatch.push(event);
}

setInterval(() => {
  if (messageBatch.length > 0) {
    broadcastToRoom(room, {
      event: 'batch',
      events: messageBatch.splice(0)
    });
  }
}, BATCH_INTERVAL);
```

---

## 7. Implementation Checklist

- [ ] Room management system working
- [ ] WebSocket connections established for both players
- [ ] Draft selection broadcasts pokemon:selected to both
- [ ] Turn actions broadcast turn:waiting to other player
- [ ] Turn execution broadcasts complete state delta
- [ ] Pokemon fainted triggers pokemon:fainted event
- [ ] Pokemon switch broadcasts pokemon:switched
- [ ] Item usage broadcasts item:used with counters
- [ ] Status conditions broadcast with duration
- [ ] Battle end broadcasts winner and stats
- [ ] Validation prevents illegal actions
- [ ] Errors sent only to offending player
- [ ] Reconnection recovers full state
- [ ] Heartbeat working (ping/pong)
- [ ] Timeout handling ends battle after 30s
- [ ] No race conditions in simultaneous events
- [ ] Client receives identical state as server

---

## 8. Testing Sync

```typescript
// Test: Both players see same state after action
test('pokemon:selected syncs to both players', async () => {
  const P1 = createClient();
  const P2 = createClient();
  
  P1.joinRoom('AB3F2K');
  P2.joinRoom('AB3F2K');
  
  const P1_received = [];
  const P2_received = [];
  
  P1.on('pokemon:selected', (e) => P1_received.push(e));
  P2.on('pokemon:selected', (e) => P2_received.push(e));
  
  P1.selectPokemon(25);  // Pikachu
  
  await sleep(100);
  
  expect(P1_received[0]).toEqual(P2_received[0]);  // Same event
  expect(P1_received[0].pokemon_id).toBe(25);
});
```

---

## 9. References

- Pokemon Patacon PRD: `/docs/PRD.md` (Section 4.5)
- Battle System: `pokemon-battle-system` skill
- Gen V Design: `pokemon-gen-v-design` skill

---

**Skill Version:** 1.0  
**Last Updated:** 12 de Mayo 2026  
**Maintainer:** Pokemon Patacon Dev Team
