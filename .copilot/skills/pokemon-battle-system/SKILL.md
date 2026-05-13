---
name: Pokemon Battle System Implementation
description: Core battle engine patterns, turn execution, damage calculation, and state management for Pokemon Patacon 1v1 battles. Covers real-time synchronization, action handling, and battle flow.
trigger: When implementing battle logic, turn processing, damage calculation, or battle state management. Use when writing battleEngine.ts, handling WebSocket turn events, or implementing action execution.
domain: Pokemon Patacon Battle Engine
version: 1.0
---

# Pokémon Patacon - Battle System Implementation Skill

## Overview

This skill documents the battle engine architecture, turn execution pipeline, and synchronization patterns for real-time 1v1 battles in Pokemon Patacon.

**Core Principle:** Deterministic, server-authoritative battle state with real-time client synchronization.

---

## 1. Battle State Structure

### 1.1 Battle Object (Server-side)

```typescript
interface Battle {
  id: string;                    // Unique battle ID
  room_id: string;              // Associated room code
  status: 'initialized' | 'active' | 'ended';
  
  // Players
  player_1: {
    session_id: string;
    team: Pokemon[];            // 6 Pokémon
    active_pokemon: Pokemon;    // Current active Pokémon
    items: {
      potion: number;           // 0-3
      revive: number;           // 0-2
    };
  };
  
  player_2: {
    session_id: string;
    team: Pokemon[];
    active_pokemon: Pokemon;
    items: {
      potion: number;
      revive: number;
    };
  };
  
  // Battle tracking
  current_turn: number;
  turn_order: 'P1' | 'P2';      // Current turn (previous turn coinflip)
  actions: {
    P1?: Action;
    P2?: Action;
  };
  
  // Metadata
  started_at: Date;
  updated_at: Date;
}

interface Pokemon {
  id: string;                    // PokeAPI ID
  name: string;
  type: string[];
  base_stats: Stats;
  current_hp: number;
  status: Status | null;
  status_turns_remaining: number;
  moves: Move[];
}

interface Stats {
  hp: number;
  attack: number;
  defense: number;
  sp_attack: number;
  sp_defense: number;
  speed: number;
}

interface Action {
  type: 'attack' | 'switch' | 'item';
  player: 'P1' | 'P2';
  
  // For attack
  move?: Move;
  
  // For switch
  target_pokemon?: Pokemon;
  
  // For item
  item?: 'potion' | 'revive';
  target_pokemon_id?: string;  // For revive, ID of Pokémon to revive
  
  timestamp: Date;
}
```

### 1.2 Pokémon Battle Instance

```typescript
interface BattlePokemon extends Pokemon {
  // Battle-specific state
  current_hp: number;           // Can decrease
  status: {
    type: 'burn' | 'paralysis' | 'sleep' | 'freeze' | 'poison' | 'attraction' | 'confusion' | null;
    turns_remaining: number;    // Decrements each action
  };
  
  // Action tracking
  last_action?: Action;
  damage_taken_this_turn: number;
}
```

---

## 2. Turn Execution Pipeline

### 2.1 High-Level Flow

```
TURN N:

1. RECEIVE ACTIONS
   ├─ Wait for P1 action → store
   ├─ Wait for P2 action → store
   └─ Both actions received → proceed

2. DETERMINE ORDER
   └─ Coinflip (50/50) → determine execution order

3. EXECUTE ACTIONS (in order)
   ├─ Execute Action 1 (winner of coinflip)
   │   ├─ Validate action
   │   ├─ Apply effects
   │   └─ Update game state
   │
   └─ Execute Action 2
       ├─ Validate action
       ├─ Apply effects
       └─ Update game state

4. POST-TURN UPDATES
   ├─ Decrement status durations
   ├─ Apply recurring effects (poison damage, etc)
   ├─ Check for fainted Pokémon
   ├─ Check win condition
   └─ Broadcast state to both clients

5. PREPARE NEXT TURN
   └─ If battle ongoing → repeat from step 1
   └─ If battle ended → emit battle:end event
```

### 2.2 Action Resolution Order

**For each action executed:**

```
1. PRE-EXECUTION
   ├─ Validate action is legal
   ├─ Check resources (items available, Pokémon alive)
   └─ If invalid → cancel action, broadcast error

2. EXECUTION
   ├─ If ATTACK:
   │   ├─ Calculate type multiplier
   │   ├─ Calculate base damage
   │   ├─ Apply damage to opponent
   │   ├─ Apply move effects (status, stat changes)
   │   └─ Mark action as executed
   │
   ├─ If SWITCH:
   │   ├─ Remove active Pokémon
   │   ├─ Set new active Pokémon
   │   ├─ Reset temporary stat changes
   │   └─ Mark action as executed
   │
   └─ If ITEM:
       ├─ Validate item available
       ├─ Consume item from inventory
       ├─ Apply item effect
       └─ Mark action as executed

3. POST-EXECUTION
   ├─ Broadcast action result to both clients
   ├─ Continue to next action in turn
   └─ If opponent action is switch → opponent's action might be cancelled
```

---

## 3. Damage Calculation

### 3.1 Damage Formula

```typescript
function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: Move
): number {
  // Base damage
  const movePower = move.power || 0;
  
  // Stat selection (physical vs special)
  const isPhysical = move.category === 'physical';
  const attackerStat = isPhysical ? attacker.base_stats.attack : attacker.base_stats.sp_attack;
  const defenderStat = isPhysical ? defender.base_stats.defense : defender.base_stats.sp_defense;
  
  // Type effectiveness
  const typeMultiplier = getTypeEffectiveness(move.type, defender.type);
  
  // Base calculation
  let damage = movePower * (attackerStat / defenderStat) * typeMultiplier;
  
  // Apply attacker's status modifiers
  if (attacker.status?.type === 'burn' && isPhysical) {
    damage *= 0.75;  // -25% for physical moves
  }
  
  // Cap at current HP
  damage = Math.min(damage, defender.current_hp);
  
  // Ensure minimum damage
  return Math.max(Math.round(damage), 1);
}
```

### 3.2 Type Effectiveness

```typescript
function getTypeEffectiveness(moveType: string, defenderTypes: string[]): number {
  const typeChart = {
    'fire': { effective: ['grass', 'ice', 'bug', 'steel'], weak: ['water', 'ground', 'rock'] },
    'water': { effective: ['fire', 'ground', 'rock'], weak: ['electric', 'grass'] },
    // ... full type chart
  };
  
  const moveData = typeChart[moveType];
  let multiplier = 1.0;
  
  defenderTypes.forEach(defType => {
    if (moveData.effective.includes(defType)) {
      multiplier *= 2.0;  // Super effective
    }
    if (moveData.weak.includes(defType)) {
      multiplier *= 0.5;  // Resisted
    }
  });
  
  return multiplier;
}
```

### 3.3 Damage Application

```typescript
function applyDamage(
  pokemon: BattlePokemon,
  damage: number
): DamageResult {
  const oldHP = pokemon.current_hp;
  pokemon.current_hp = Math.max(0, pokemon.current_hp - damage);
  
  return {
    damage_dealt: damage,
    old_hp: oldHP,
    new_hp: pokemon.current_hp,
    fainted: pokemon.current_hp === 0,
    hp_percentage: (pokemon.current_hp / pokemon.base_stats.hp) * 100
  };
}
```

---

## 4. Status Condition Handling

### 4.1 Status Application

```typescript
function applyStatus(
  pokemon: BattlePokemon,
  status: StatusType,
  duration: number = 3
): boolean {
  // Check if already has status
  if (pokemon.status?.type && pokemon.status.type !== 'confusion' && pokemon.status.type !== 'attraction') {
    return false;  // Cannot apply non-volatile status if already has one
  }
  
  pokemon.status = {
    type: status,
    turns_remaining: duration
  };
  
  return true;
}
```

### 4.2 Status Tick (per Pokemon action)

```typescript
function tickStatus(pokemon: BattlePokemon): StatusEffect[] {
  const effects = [];
  
  if (!pokemon.status) return effects;
  
  // Decrement duration
  pokemon.status.turns_remaining -= 1;
  
  // Apply passive damage
  if (pokemon.status.type === 'poison') {
    const damageAmount = Math.ceil(pokemon.base_stats.hp * 0.125);
    effects.push({
      type: 'damage',
      amount: damageAmount,
      source: 'poison'
    });
  }
  
  // Remove if expired
  if (pokemon.status.turns_remaining <= 0) {
    pokemon.status = null;
  }
  
  return effects;
}
```

### 4.3 Status Removal

```typescript
function clearStatus(pokemon: BattlePokemon): void {
  pokemon.status = null;
}

function clearAllStatus(pokemon: BattlePokemon): void {
  // Refresh, Heal Bell, Aromatherapy
  pokemon.status = null;
}
```

---

## 5. Action Validation

### 5.1 Attack Validation

```typescript
function validateAttackAction(action: Action, state: Battle): ValidationResult {
  const player = action.player === 'P1' ? state.player_1 : state.player_2;
  const opponent = action.player === 'P1' ? state.player_2 : state.player_1;
  
  // Check move exists
  if (!action.move) {
    return { valid: false, reason: 'No move selected' };
  }
  
  // Check move is in active Pokémon's moveset
  if (!player.active_pokemon.moves.find(m => m.name === action.move.name)) {
    return { valid: false, reason: 'Move not in moveset' };
  }
  
  // Check opponent has active Pokémon
  if (!opponent.active_pokemon || opponent.active_pokemon.current_hp === 0) {
    return { valid: false, reason: 'Opponent has no active Pokémon' };
  }
  
  return { valid: true };
}
```

### 5.2 Switch Validation

```typescript
function validateSwitchAction(action: Action, state: Battle): ValidationResult {
  const player = action.player === 'P1' ? state.player_1 : state.player_2;
  
  // Check target Pokémon exists in team
  const target = player.team.find(p => p.id === action.target_pokemon?.id);
  if (!target) {
    return { valid: false, reason: 'Target Pokémon not in team' };
  }
  
  // Check target is not current active
  if (target.id === player.active_pokemon.id) {
    return { valid: false, reason: 'Pokémon already active' };
  }
  
  // Check target is not fainted
  if (target.current_hp === 0) {
    return { valid: false, reason: 'Target Pokémon is fainted' };
  }
  
  return { valid: true };
}
```

### 5.3 Item Validation

```typescript
function validateItemAction(action: Action, state: Battle): ValidationResult {
  const player = action.player === 'P1' ? state.player_1 : state.player_2;
  
  if (action.item === 'potion') {
    // Check items available
    if (player.items.potion === 0) {
      return { valid: false, reason: 'No potions available' };
    }
    
    // Check active Pokémon HP < 100%
    if (player.active_pokemon.current_hp === player.active_pokemon.base_stats.hp) {
      return { valid: false, reason: 'Pokémon already at full HP' };
    }
    
    return { valid: true };
  }
  
  if (action.item === 'revive') {
    // Check items available
    if (player.items.revive === 0) {
      return { valid: false, reason: 'No revives available' };
    }
    
    // Check target is fainted
    const target = player.team.find(p => p.id === action.target_pokemon_id);
    if (!target || target.current_hp > 0) {
      return { valid: false, reason: 'Target is not fainted' };
    }
    
    return { valid: true };
  }
  
  return { valid: false, reason: 'Unknown item type' };
}
```

---

## 6. Item Handling

### 6.1 Potion Usage

```typescript
function usePotion(pokemon: BattlePokemon, player: PlayerState): void {
  // Restore to full HP
  pokemon.current_hp = pokemon.base_stats.hp;
  
  // Consume item
  player.items.potion -= 1;
}
```

### 6.2 Revive Usage

```typescript
function useRevive(pokemon: BattlePokemon, player: PlayerState): void {
  // Revive with 50% HP
  pokemon.current_hp = Math.ceil(pokemon.base_stats.hp * 0.5);
  
  // Clear status
  pokemon.status = null;
  
  // Consume item
  player.items.revive -= 1;
}
```

---

## 7. Coinflip Mechanics

### 7.1 Turn Order Determination

```typescript
function determineFirstAttacker(): 'P1' | 'P2' {
  // Pure 50/50 - no speed stat involvement
  return Math.random() < 0.5 ? 'P1' : 'P2';
}

// Call at start of every turn
function executeTurn(battle: Battle): void {
  const firstAttacker = determineFirstAttacker();
  
  const action1 = firstAttacker === 'P1' ? battle.actions.P1 : battle.actions.P2;
  const action2 = firstAttacker === 'P2' ? battle.actions.P1 : battle.actions.P2;
  
  // Execute in order
  executeAction(battle, action1);
  executeAction(battle, action2);
}
```

### 7.2 Broadcast Coinflip to Clients

```typescript
function broadcastCoinflip(battle: Battle, firstPlayer: 'P1' | 'P2'): void {
  const event = {
    event: 'turn:coinflip',
    turn: battle.current_turn,
    first_attacker: firstPlayer,
    timestamp: Date.now()
  };
  
  broadcastToRoom(battle.room_id, event);
}
```

---

## 8. Win Condition & Battle End

### 8.1 Check Win State

```typescript
function checkWinCondition(battle: Battle): 'P1' | 'P2' | null {
  // Check if any team has all Pokémon fainted
  const P1AllFainted = battle.player_1.team.every(p => p.current_hp === 0);
  const P2AllFainted = battle.player_2.team.every(p => p.current_hp === 0);
  
  if (P1AllFainted) return 'P2';  // P2 wins
  if (P2AllFainted) return 'P1';  // P1 wins
  return null;  // Battle ongoing
}
```

### 8.2 End Battle

```typescript
function endBattle(battle: Battle, winner: 'P1' | 'P2'): void {
  battle.status = 'ended';
  
  const event = {
    event: 'battle:end',
    winner: winner,
    timestamp: Date.now(),
    battle_duration_ms: Date.now() - battle.started_at.getTime()
  };
  
  broadcastToRoom(battle.room_id, event);
  
  // Archive battle in DB
  saveBattleLog(battle);
}
```

---

## 9. Synchronization Events

### 9.1 Critical Sync Events

| Event | When | Data |
|-------|------|------|
| `turn:waiting` | One player ready, waiting for other | `{ turn, player }` |
| `turn:execute` | Both actions ready, execute | Full battle state delta |
| `pokemon:fainted` | A Pokémon reaches 0 HP | `{ player, pokemon_id }` |
| `status:applied` | Status condition applied | `{ pokemon_id, status_type, duration }` |
| `item:used` | Item consumed | `{ player, item_type, remaining }` |

### 9.2 Broadcast Structure

```typescript
interface TurnExecuteEvent {
  event: 'turn:execute';
  turn: number;
  
  // Both actions
  actions: {
    P1: {
      type: 'attack' | 'switch' | 'item';
      move?: Move;
      damage_dealt?: number;
      effects?: string[];
    };
    P2: {
      type: 'attack' | 'switch' | 'item';
      move?: Move;
      damage_dealt?: number;
      effects?: string[];
    };
  };
  
  // Current state
  state: {
    // P1 state
    P1_active: {
      name: string;
      hp: number;
      max_hp: number;
      status?: StatusType;
    };
    P1_items: { potion: number; revive: number };
    
    // P2 state
    P2_active: { ... };
    P2_items: { ... };
  };
  
  timestamp: Date;
}
```

---

## 10. Implementation Checklist

- [ ] Battle state structure properly typed
- [ ] Turn execution pipeline implemented in order
- [ ] Damage calculation matches formula exactly
- [ ] Type effectiveness applied correctly
- [ ] Status conditions decrement every turn
- [ ] Status removal works (Refresh, Heal Bell, etc)
- [ ] Attack validation prevents illegal moves
- [ ] Switch validation prevents impossible switches
- [ ] Item validation enforces limits
- [ ] Potion restores 100% HP
- [ ] Revive restores 50% HP and clears status
- [ ] Coinflip is truly 50/50 (use Math.random)
- [ ] Win condition checked after each action
- [ ] WebSocket broadcasts synchronized to both clients
- [ ] Battle end archives properly
- [ ] No race conditions in turn processing

---

## 11. Anti-Patterns to Avoid

❌ Do NOT:
- Use speed stat to determine turn order
- Allow multiple statuses on one Pokémon
- Apply status to already-status'd Pokémon without removal
- Let items restore more/less than specified
- Process both actions simultaneously (must be sequential)
- Forget to decrement status duration
- Allow switch to fainted Pokémon
- Calculate damage without type effectiveness

---

## 12. References

- Pokemon Patacon PRD: `/docs/PRD.md`
- Gen V Type Chart: `pokemon-gen-v-design` skill
- WebSocket Sync: `pokemon-websocket-sync` skill

---

**Skill Version:** 1.0  
**Last Updated:** 12 de Mayo 2026  
**Maintainer:** Pokemon Patacon Dev Team
