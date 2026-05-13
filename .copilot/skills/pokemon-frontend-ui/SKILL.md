---
name: Pokemon Frontend UI Development
description: Frontend component patterns for Pokemon Patacon using Svelte + Vite. Covers battle UI, real-time sync, sprite rendering, and state management.
trigger: When building Svelte components for battle screen, Pokemon selector, action panels, or managing UI state. Use when working with Battle.svelte, ActionPanel.svelte, or Svelte stores.
domain: Pokemon Patacon Frontend
version: 1.0
---

# Pokémon Patacon - Frontend UI Development Skill

## Overview

Pokemon Patacon frontend is built with **Svelte + Vite** for rapid development and reactive updates. This skill covers component architecture, state management, WebSocket integration, and animation patterns specific to Gen V battle aesthetics.

**Core Principle:** Reactive Svelte stores for battle state, WebSocket for real-time sync, .gif sprites for Gen V authenticity.

---

## 1. Project Structure

### 1.1 File Organization

```
frontend/
├── src/
│   ├── components/
│   │   ├── Battle.svelte          # Main battle screen
│   │   ├── BattleArena.svelte     # Pokemon sprites + arena
│   │   ├── ActionPanel.svelte     # Attack/Switch/Items buttons
│   │   ├── MoveSelector.svelte    # 4 move selection
│   │   ├── ObjectsMenu.svelte     # Potion/Revive menu
│   │   ├── PokemonSprite.svelte   # .gif sprite rendering
│   │   ├── HPBar.svelte           # Health bar component
│   │   ├── StatusIcon.svelte      # Status condition icons
│   │   ├── DraftSelector.svelte   # Team selection (draft)
│   │   ├── RoomLobby.svelte       # Waiting for opponent
│   │   ├── MainMenu.svelte        # Create/Join room
│   │   ├── BattleLog.svelte       # Action history
│   │   └── ControlsOverlay.svelte # Turn order, waiting...
│   │
│   ├── store/
│   │   ├── battle.ts              # Writable: battle state
│   │   ├── room.ts                # Writable: room/connection
│   │   ├── pokemon.ts             # Readable: pokemon cache
│   │   └── ui.ts                  # UI state (modal open, etc)
│   │
│   ├── services/
│   │   ├── websocket.ts           # WebSocket connection
│   │   ├── pokemonApi.ts          # HTTP client for pokemon API
│   │   ├── battleSync.ts          # Event handlers for sync
│   │   └── utils/
│   │       ├── damage.ts          # Damage calculation
│   │       ├── typeChart.ts       # Type effectiveness lookup
│   │       └── animationQueue.ts  # Animation sequencing
│   │
│   ├── App.svelte
│   ├── main.ts
│   └── global.css
│
├── public/
│   └── assets/
│       ├── sprites/               # Pokemon .gif files
│       ├── sounds/
│       │   ├── attacks/
│       │   ├── ui/
│       │   └── ambient.mp3
│       └── fonts/
│
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 2. Svelte Store Architecture

### 2.1 Battle State Store

```typescript
// store/battle.ts
import { writable, derived } from 'svelte/store';

export interface BattleState {
  id: string;
  status: 'waiting' | 'active' | 'ended';
  turn: number;
  
  player1: {
    activePokemon: Pokemon | null;
    team: Pokemon[];
    items: { potion: number; revive: number };
    hp: number;
    maxHp: number;
  };
  
  player2: {
    activePokemon: Pokemon | null;
    team: Pokemon[];
    items: { potion: number; revive: number };
    hp: number;
    maxHp: number;
  };
  
  battleLog: BattleAction[];
  isYourTurn: boolean;
}

// Create writable store
export const battleState = writable<BattleState>({
  id: '',
  status: 'waiting',
  turn: 0,
  player1: { activePokemon: null, team: [], items: { potion: 3, revive: 2 }, hp: 100, maxHp: 100 },
  player2: { activePokemon: null, team: [], items: { potion: 3, revive: 2 }, hp: 100, maxHp: 100 },
  battleLog: [],
  isYourTurn: false
});

// Derived stores (computed)
export const player1HpPercent = derived(battleState, ($state) => {
  if (!$state.player1.activePokemon) return 0;
  return ($state.player1.hp / $state.player1.maxHp) * 100;
});

export const player2HpPercent = derived(battleState, ($state) => {
  if (!$state.player2.activePokemon) return 0;
  return ($state.player2.hp / $state.player2.maxHp) * 100;
});

// Update function
export function updateBattleState(updates: Partial<BattleState>) {
  battleState.update(state => ({ ...state, ...updates }));
}
```

### 2.2 Room Store

```typescript
// store/room.ts
import { writable } from 'svelte/store';

export interface RoomState {
  code: string;
  status: 'creating' | 'waiting' | 'draft' | 'battle' | 'ended';
  opponent: {
    sessionId: string;
    connected: boolean;
    ready: boolean;
  };
}

export const roomState = writable<RoomState>({
  code: '',
  status: 'creating',
  opponent: { sessionId: '', connected: false, ready: false }
});

export function setRoomCode(code: string) {
  roomState.update(r => ({ ...r, code }));
}
```

### 2.3 UI State Store

```typescript
// store/ui.ts
import { writable } from 'svelte/store';

export interface UIState {
  showActionMenu: boolean;
  showObjectsMenu: boolean;
  showMoveSelector: boolean;
  selectedMove: string | null;
  isWaiting: boolean;  // Waiting for opponent
  animationInProgress: boolean;
}

export const uiState = writable<UIState>({
  showActionMenu: false,
  showObjectsMenu: false,
  showMoveSelector: false,
  selectedMove: null,
  isWaiting: false,
  animationInProgress: false
});
```

---

## 3. Core Components

### 3.1 Battle.svelte (Main Component)

```svelte
<!-- components/Battle.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { battleState, updateBattleState } from '../store/battle';
  import { roomState } from '../store/room';
  import { uiState } from '../store/ui';
  import { initWebSocket } from '../services/websocket';
  import BattleArena from './BattleArena.svelte';
  import ActionPanel from './ActionPanel.svelte';
  import BattleLog from './BattleLog.svelte';
  import ControlsOverlay from './ControlsOverlay.svelte';
  
  onMount(async () => {
    // Initialize WebSocket connection
    await initWebSocket($roomState.code);
    
    // Start listening to battle events
    // (handled by battleSync service)
  });
</script>

<main class="battle-container">
  <div class="battle-layout">
    <!-- Top: Opponent Pokemon -->
    <div class="opponent-area">
      <BattleArena player="opponent" pokemon={$battleState.player2.activePokemon} />
      <ControlsOverlay position="top" turn={$battleState.turn} />
    </div>
    
    <!-- Middle: Arena -->
    <div class="arena-divider"></div>
    
    <!-- Bottom: Your Pokemon + Actions -->
    <div class="player-area">
      <BattleArena player="player" pokemon={$battleState.player1.activePokemon} />
      <ActionPanel />
    </div>
  </div>
  
  <!-- Right: Battle Log -->
  <div class="battle-log-panel">
    <BattleLog actions={$battleState.battleLog} />
  </div>
</main>

<style>
  .battle-container {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 16px;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 16px;
  }
  
  .battle-layout {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }
  
  .opponent-area {
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    padding: 16px;
    position: relative;
  }
  
  .player-area {
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    padding: 16px;
    position: relative;
  }
  
  .arena-divider {
    height: 2px;
    background: rgba(255,255,255,0.2);
  }
  
  .battle-log-panel {
    background: rgba(0,0,0,0.5);
    border-radius: 8px;
    overflow-y: auto;
    padding: 12px;
  }
</style>
```

### 3.2 BattleArena.svelte

```svelte
<!-- components/BattleArena.svelte -->
<script lang="ts">
  import PokemonSprite from './PokemonSprite.svelte';
  import HPBar from './HPBar.svelte';
  import StatusIcon from './StatusIcon.svelte';
  
  export let player: 'player' | 'opponent';
  export let pokemon: any;
  
  const isPlayer = player === 'player';
</script>

<div class="arena" class:opponent={!isPlayer}>
  {#if pokemon}
    <div class="pokemon-container">
      <!-- Sprite -->
      <PokemonSprite 
        name={pokemon.name}
        isPlayer={isPlayer}
        src={isPlayer ? pokemon.sprites.back_default : pokemon.sprites.front_default}
      />
      
      <!-- Status -->
      {#if pokemon.status}
        <StatusIcon status={pokemon.status.type} />
      {/if}
    </div>
    
    <!-- Info Bar -->
    <div class="info-bar">
      <h3>{pokemon.name}</h3>
      <HPBar hp={pokemon.current_hp} maxHp={pokemon.base_stats.hp} />
      <div class="level">Lv. 50</div>
    </div>
  {/if}
</div>

<style>
  .arena {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 120px;
  }
  
  .arena.opponent {
    flex-direction: row-reverse;
  }
  
  .pokemon-container {
    position: relative;
    width: 100px;
    height: 100px;
  }
  
  .info-bar {
    flex: 1;
  }
  
  h3 {
    margin: 0;
    color: white;
    font-size: 18px;
    text-transform: capitalize;
  }
</style>
```

### 3.3 ActionPanel.svelte

```svelte
<!-- components/ActionPanel.svelte -->
<script lang="ts">
  import { battleState, updateBattleState } from '../store/battle';
  import { uiState } from '../store/ui';
  import { submitAction } from '../services/battleSync';
  import MoveSelector from './MoveSelector.svelte';
  import ObjectsMenu from './ObjectsMenu.svelte';
  
  let selectedMode: 'attack' | 'switch' | 'items' | null = null;
  
  function handleAttack() {
    selectedMode = 'attack';
    $uiState.showMoveSelector = true;
  }
  
  function handleSwitch() {
    selectedMode = 'switch';
    $uiState.showActionMenu = false;
  }
  
  function handleItems() {
    selectedMode = 'items';
    $uiState.showObjectsMenu = true;
  }
  
  function handleMoveSelected(move: any) {
    submitAction({
      type: 'attack',
      move: move
    });
    resetUI();
  }
  
  function handleSwitchSelected(pokemon: any) {
    submitAction({
      type: 'switch',
      target_pokemon: pokemon
    });
    resetUI();
  }
  
  function resetUI() {
    selectedMode = null;
    $uiState.showActionMenu = false;
    $uiState.showMoveSelector = false;
    $uiState.showObjectsMenu = false;
    $uiState.isWaiting = true;  // Show waiting state
  }
</script>

<div class="action-panel">
  {#if selectedMode === null}
    <!-- Main menu -->
    <div class="button-grid">
      <button on:click={handleAttack} class="btn-action attack">
        ⚔️ Attack
      </button>
      <button on:click={handleSwitch} class="btn-action switch">
        🔄 Switch
      </button>
      <button on:click={handleItems} class="btn-action items" disabled={$battleState.player1.items.potion === 0 && $battleState.player1.items.revive === 0}>
        🧪 Items
      </button>
    </div>
  {/if}
  
  <!-- Move Selector -->
  {#if selectedMode === 'attack' && $uiState.showMoveSelector}
    <MoveSelector 
      moves={$battleState.player1.activePokemon?.moves}
      on:selected={(e) => handleMoveSelected(e.detail)}
      on:cancel={() => selectedMode = null}
    />
  {/if}
  
  <!-- Objects Menu -->
  {#if selectedMode === 'items' && $uiState.showObjectsMenu}
    <ObjectsMenu
      items={$battleState.player1.items}
      on:use={(e) => handleMoveSelected(e.detail)}
      on:cancel={() => selectedMode = null}
    />
  {/if}
  
  <!-- Waiting State -->
  {#if $uiState.isWaiting}
    <div class="waiting">
      <div class="spinner"></div>
      <p>Waiting for opponent...</p>
    </div>
  {/if}
</div>

<style>
  .action-panel {
    background: rgba(0,0,0,0.4);
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
  }
  
  .button-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  
  .btn-action {
    padding: 12px;
    border: 2px solid white;
    background: rgba(255,255,255,0.1);
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.3s;
  }
  
  .btn-action:hover:not(:disabled) {
    background: rgba(255,255,255,0.2);
    transform: scale(1.05);
  }
  
  .btn-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .waiting {
    text-align: center;
    padding: 20px;
    color: white;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 10px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

### 3.4 PokemonSprite.svelte (GIF Rendering)

```svelte
<!-- components/PokemonSprite.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  export let name: string;
  export let src: string;
  export let isPlayer: boolean = true;
  
  let spriteElement: HTMLImageElement;
  let isAnimating = false;
  
  onMount(() => {
    if (spriteElement) {
      spriteElement.onload = () => {
        isAnimating = true;
      };
      
      spriteElement.onerror = () => {
        console.error(`Failed to load sprite for ${name}`);
        // Fallback to static image
        spriteElement.src = `/assets/sprites/fallback/${name}.png`;
      };
    }
  });
</script>

<div class="sprite-container" class:attacking={isAnimating}>
  <img
    bind:this={spriteElement}
    src={src}
    alt={name}
    class="pokemon-sprite"
    class:player={isPlayer}
  />
</div>

<style>
  .sprite-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .pokemon-sprite {
    width: 100%;
    height: 100%;
    object-fit: contain;
    image-rendering: pixelated;  /* Maintain crisp appearance */
  }
  
  .pokemon-sprite.player {
    transform: scaleX(-1);  /* Mirror player sprite */
  }
  
  @keyframes hit {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .sprite-container.attacking {
    animation: hit 0.4s;
  }
</style>
```

### 3.5 HPBar.svelte

```svelte
<!-- components/HPBar.svelte -->
<script lang="ts">
  export let hp: number;
  export let maxHp: number;
  
  $: percent = (hp / maxHp) * 100;
  $: color = percent > 50 ? 'green' : percent > 25 ? 'yellow' : 'red';
</script>

<div class="hp-container">
  <div class="hp-bar">
    <div class="hp-fill" style="width: {percent}%; background-color: {color}"></div>
  </div>
  <div class="hp-text">{hp}/{maxHp}</div>
</div>

<style>
  .hp-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .hp-bar {
    flex: 1;
    height: 16px;
    background: rgba(0,0,0,0.3);
    border-radius: 4px;
    border: 1px solid white;
    overflow: hidden;
  }
  
  .hp-fill {
    height: 100%;
    transition: width 0.5s ease-out;
  }
  
  .hp-text {
    color: white;
    font-size: 12px;
    font-weight: bold;
    min-width: 50px;
  }
</style>
```

---

## 4. WebSocket Integration

### 4.1 WebSocket Service

```typescript
// services/websocket.ts
import { battleState, updateBattleState } from '../store/battle';
import { roomState } from '../store/room';
import { uiState } from '../store/ui';

let socket: WebSocket;

export async function initWebSocket(roomCode: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/battle/${roomCode}`;
  
  socket = new WebSocket(url);
  
  socket.onopen = () => {
    console.log('Connected to battle server');
    roomState.update(r => ({ ...r, opponent: { ...r.opponent, connected: true } }));
  };
  
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleBattleEvent(message);
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    roomState.update(r => ({ ...r, opponent: { ...r.opponent, connected: false } }));
  };
  
  socket.onclose = () => {
    console.log('Disconnected from battle server');
    // Attempt reconnect
    setTimeout(() => initWebSocket(roomCode), 3000);
  };
}

function handleBattleEvent(message: any) {
  switch (message.event) {
    case 'turn:execute':
      handleTurnExecute(message);
      break;
    case 'pokemon:switched':
      handlePokemonSwitch(message);
      break;
    case 'pokemon:fainted':
      handlePokemonFainted(message);
      break;
    case 'item:used':
      handleItemUsed(message);
      break;
    case 'battle:end':
      handleBattleEnd(message);
      break;
  }
}

export function sendAction(action: any) {
  socket.send(JSON.stringify({
    event: 'turn:action',
    ...action
  }));
  
  // Show waiting state
  uiState.update(u => ({ ...u, isWaiting: true }));
}
```

---

## 5. Implementation Checklist

- [ ] Svelte stores created (battle, room, ui)
- [ ] Battle.svelte main component rendering
- [ ] BattleArena displaying both Pokemon
- [ ] ActionPanel with 3 buttons (Attack/Switch/Items)
- [ ] MoveSelector showing 4 moves
- [ ] ObjectsMenu showing potion/revive counts
- [ ] HPBar updating in real-time
- [ ] StatusIcon showing condition icons
- [ ] Pokemon sprites loading from PokeAPI (.gif)
- [ ] WebSocket events updating battle state
- [ ] Animations playing on damage/switch/item
- [ ] Turn order indicator showing
- [ ] Waiting state showing spinner
- [ ] Battle log showing actions
- [ ] Responsive design (mobile-friendly)
- [ ] Sound effects playing (optional)

---

## 6. Performance Tips

```typescript
// 1. Use derived stores for computed values (don't recalculate)
export const hpPercent = derived(battleState, $ => ($.hp / $.maxHp) * 100);

// 2. Animate with CSS, not JS (smoother)
// Use transition: width 0.5s instead of setInterval

// 3. Batch DOM updates
// Svelte does this automatically, but avoid DOM queries

// 4. Lazy load sprites
// Use <img loading="lazy" /> for off-screen pokemon

// 5. Debounce WebSocket messages
// Don't update state on every message, batch if needed
```

---

## 7. References

- Svelte Docs: https://svelte.dev
- Vite Docs: https://vitejs.dev
- Pokemon Patacon PRD: `/docs/PRD.md` (Section 5)
- WebSocket Sync: `pokemon-websocket-sync` skill
- Battle System: `pokemon-battle-system` skill

---

**Skill Version:** 1.0  
**Last Updated:** 12 de Mayo 2026  
**Maintainer:** Pokemon Patacon Dev Team
