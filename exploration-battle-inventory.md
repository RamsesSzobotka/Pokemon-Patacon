# Exploration: Battle Inventory / Bag System

## Current State

The game has NO existing item/inventory system in battle. The codebase has:

1. A **"MOCHILA" button** in `CommandPanel` (line 651-655 of `Battle.tsx`) — it exists but has **no onClick handler** attached and is always `disabled={disabled}`. It's a placeholder.

2. An **`'item'` ActionType** already defined in `backend/src/types/battle.ts` (line 34), but **never used** anywhere.

3. **No inventory state** on backend or frontend — no items collection, no potion/revive tracking, no usage logic.

4. A **store route** (`backend/src/routes/store.ts`) that only handles Stripe checkout for `shiny_pack` — not battle items.

5. The **schema doc** (`docs/architecture/SCHEMAS_MONGODB.md`) mentions `items: { full_restore: 3, revive: 2 }` in the battle schema spec, but this was never implemented.

---

## Affected Areas

### Frontend
- **`frontend/src/components/battle/Battle.tsx`** (2263 lines)
  - `CommandPanel` component (lines 491-733) — the "MOCHILA" button at line 651
  - `Battle` main component (lines 1117-2193) — message handlers, state management
  - `BattleState` interface (lines 83-99) — no items field
  - WebSocket message handling (lines 1334-1828)
  - Action handlers: `handleAttack` (line 1837), `handleChange` (line 1851), `handleSurrender` (line 1869)

- **`frontend/src/components/battle/Battle.css`** (1769 lines)
  - PokemonSelector styles (lines 819-962) — pattern to follow for bag UI
  - CommandPanel styles (lines 414-479)
  - Surrender modal styles (lines 720-813) — modal overlay pattern
  - Move detail modal styles (lines 964-1285) — detail modal pattern

### Backend
- **`backend/src/websocket/battleHandler.ts`** (1212 lines)
  - `handleBattleAction` function (lines 395-617) — action routing
  - `executeTurn` (lines 622-1092) — turn execution loop
  - `PlayerAction` type currently supports: `type: 'attack' | 'change'` (line 398)
  - Fatigue auto-rest (lines 427-465) — closest pattern to item use

- **`backend/src/services/battleService.ts`** (1570 lines)
  - `executeMove` (lines 1031-1381) — move execution
  - `executeSwitch` (lines 1386-1425) — switch execution
  - `canActWithAilments` (lines 314-387) — action blocking
  - Damage calculation, stat changes, V3 two-turn moves

- **`backend/src/types/battle.ts`** (929 lines)
  - `ActionType` (line 34): `'attack' | 'change' | 'item' | 'run'` — `'item'` already defined!
  - `PlayerAction` interface (lines 187-194) — no item-specific fields
  - `BattleState` interface (lines 276-318) — no items/inventory
  - `BATTLE_CONFIG` (lines 469-509)

- **`backend/src/websocket/handler.ts`** (1044 lines)
  - `battle:action` routing (line 174-185) — dispatches to `handleBattleAction`

- **`backend/src/db/users.ts`** (107 lines)
  - `UserDocument` interface — has `shiny_pack` but no items/inventory

---

## Pattern to Follow (Model After Switch Menu)

The **Pokémon switch system** (`PokemonSelector` component + `executeSwitch`) is the exact precedent for the bag system:

### Frontend Component Pattern
```tsx
// PokemonSelector (lines 993-1077) — pattern:
// 1. Full-screen overlay (pokemon-selector-overlay)
// 2. Grid of selectable items (team-grid → bag-grid)
// 3. Each item has: sprite, name, HP bar → item icon, name, quantity, description
// 4. Buttons: "Seleccionar" / "Ver detalles"
// 5. Cancel button
// 6. Detail modal on "Ver detalles" click
```

### Action Flow Pattern
1. User clicks "MOCHILA" → `showBagSelector` state = true
2. Bag overlay renders with items
3. User selects item → optionally selects target Pokémon (for heal items)
4. `handleUseItem(itemId, targetPokemonId)` → calls `sendMessage({ type: 'battle:action', data: { type: 'item', itemId, targetPokemonId } })`
5. `hasSelectedAction = true` (block buttons)
6. Backend receives `battle:action` → `handleBattleAction` → checks `actionData.type === 'item'`
7. Backend executes item logic, sends `battle:action-result`
8. Frontend handles result in the `battle:action-result` case

### Backend Pattern
```typescript
// executeSwitch (lines 1386-1425) — pattern:
// 1. Validate (Pokémon not fainted)
// 2. Apply effect (clear charging states, set new active)
// 3. Return result { success, message, pokemon }
```

For items, we'd create `executeItem(player, itemId, targetPokemonId)` that:
1. Validates item exists and has quantity > 0
2. Applies the item's effect (heal HP, remove ailments, revive)
3. Decrements item count
4. Returns result with message

### Fatigue Auto-Rest Pattern (lines 427-465)
This shows how to handle actions that don't require a move selection:
- The `autoRegisterFatigueRest` function auto-fills the `pendingActions` slot
- Broadcasts `battle:action-selected` with `actionType: 'rest'`
- If both players ready, executes turn

---

## Data Flow (UI Click → WebSocket → Backend → Result → UI)

### Current Switch Flow (complete reference):
```
1. User clicks "CAMBIAR" → handleOpenChange() → setShowPokemonSelector(true)
2. User clicks "Seleccionar" on a Pokémon → handleChange(pokemonId)
3. sendMessage({ type: 'battle:action', data: { type: 'change', pokemonId } })
4. WebSocket → handler.ts → handleBattleAction(sessionId, roomCode, { type: 'change', pokemonId })
5. handleBattleAction:
   a. Validate player belongs to battle
   b. Check V3 constraints (charging, fatigue)
   c. Create PlayerAction { playerId, type: 'change', pokemonId }
   d. Store in battle.pendingActions[playerId]
   e. Broadcast battle:action-selected
   f. Handle mandatory switch case (immediate execute)
   g. If both players ready → executeTurn()
6. executeTurn:
   a. determineExecutionOrder → order + coinflip
   b. broadcast battle:turn-start
   c. Loop through actions in order
   d. For 'change': executeSwitch() → update team, activePokemonIndex
   e. broadcast battle:action-result with newPokemon data
   f. End-of-turn effects, battle:turn-end
7. Frontend receives:
   - battle:turn-start → setIsMyTurn(false)
   - battle:action-result (type='change') → update battleState, show message
   - battle:turn-end → update battleState, setIsMyTurn(true)
```

### Proposed Item Flow:
```
1. User clicks "MOCHILA" → setShowBagSelector(true)
2. User selects item → optionally target (for heal items)
3. sendMessage({ type: 'battle:action', data: { type: 'item', itemId: 'potion', targetPokemonId } })
4. WebSocket → handler.ts → handleBattleAction(sessionId, roomCode, { type: 'item', itemId, targetPokemonId })
5. handleBattleAction:
   a. Same validation + V3 checks (fatigue blocks items too?)
   b. Create PlayerAction { playerId, type: 'item', itemId, targetPokemonId }
   c. Store in battle.pendingActions[playerId]
   d. Broadcast battle:action-selected
   e. If both players ready → executeTurn()
6. executeTurn:
   a. determineExecutionOrder (switch priority +6, items could be +4?)
   b. For 'item': executeItem() → heal target, decrement count
   c. broadcast battle:action-result with item effect details
7. Frontend: same message flow as switch/attack
```

---

## State Management

### Frontend (`Battle.tsx`)
- `BattleState` interface (lines 83-99): `roomCode`, `turn`, `phase`, `player1`, `player2`
- Each player: `name`, `activePokemon`, `team` (array of `BattlePokemon`)
- **No items field exists** — need to add `items?: Record<string, number>` to player state
- `isMyTurn` (line 1259): controls whether commands are enabled
- `hasSelectedAction` (line 1278): blocks double-submission
- `showPokemonSelector` (line 1258): toggle for switch overlay
- State updates happen in WebSocket message handlers (lines 1334-1828)

### Backend (`battleHandler.ts`)
- `activeBattles: Map<string, BattleState>` (line 80) — in-memory battle states
- `BattleState` (types/battle.ts lines 276-318):
  - `players: { player1: PlayerBattleState, player2: PlayerBattleState }`
  - Each `PlayerBattleState` has: `team`, `activePokemonIndex`, `hasSelectedAction`
  - **No items field exists** — need to add `inventory?: Record<string, number>`
- `pendingActions` (line 290-293): `{ player1: PlayerAction | null, player2: PlayerAction | null }`
- Battle state is ephemeral — not persisted to DB (no `battles` collection in active use)

---

## WebSocket Messages

| Type | Direction | Purpose | Payload |
|------|-----------|---------|---------|
| `battle:action` | Client→Server | Player selects action | `{ type: 'attack'\|'change', moveId?, pokemonId? }` |
| `battle:action-selected` | Server→Both | Notify action chosen | `{ playerId, actionType, ready }` |
| `battle:turn-start` | Server→Both | Turn execution begins | `{ turn, executionOrder, reason, usedCoinflip, firstPlayerId }` |
| `battle:action-result` | Server→Both | Result of one action | `{ playerId, action, result, attackerHp, defenderHp }` |
| `battle:turn-end` | Server→Both | Turn completed | `{ turn, player1, player2, nextTurn }` |
| `battle:state` | Server→Client | Full state resync | `{ turn, phase, player1, player2 }` |
| `battle:fatigue-rest` | Server→Client | Fatigue auto-rest | `{ message, pokemonName, autoResting }` |
| `battle:switch-success` | Server→Both | Switch confirmed | `{ playerId, pokemonId, pokemon, message }` |
| `battle:end` | Server→Both | Battle ended | `{ winner, message, finalState }` |

For items, we'd likely reuse `battle:action` with `type: 'item'` and `battle:action-result` with appropriate result data.

---

## Existing "Item" or "Inventory" Code Found

**NONE.** The codebase has zero implementation of battle items or inventory. Findings:

1. `ActionType` includes `'item'` (types/battle.ts:34) — defined but never used
2. Schema doc mentions items speculatively but not implemented
3. Store route handles `shiny_pack` purchase only (not battle items)
4. No `items` collection exists in MongoDB
5. No item-related CSS, components, or handlers exist

---

## Approaches

### 1. **Simple Frontend-Only Inventory** (client-managed)
   - Track items on frontend battle state only
   - Backend: adds `inventory` field to `PlayerBattleState`, processes item actions
   - Pros: Fastest to implement, minimal model changes
   - Cons: Inventory not persistent, lost on disconnect

### 2. **DB-Backed Inventory** (on `users` collection)
   - Store items in `UserDocument`: `{ items: { potion: 3, revive: 2 } }`
   - Load into battle state at battle start
   - Sync changes back to DB after battle (or real-time)
   - Pros: Persistent, survives disconnect and reconnection
   - Cons: More complex, DB writes per item use

### 3. **Per-Battle Inventory** (on `rooms` or in-memory battle state)
   - Assign items when battle begins (e.g., 3 Potions, 2 Revives per player)
   - Track usage in `PlayerBattleState.inventory`
   - No DB persistence needed (ephemeral like battle state)
   - Pros: Simple, matches existing pattern (battle state is already in-memory)
   - Cons: Items reset every battle, no progression between battles

---

## Recommendation

**Approach 3: Per-Battle Inventory** (in-memory on `BattleState`, no DB changes)

Reasoning:
1. Matches the existing architecture — all battle state is in-memory (`activeBattles: Map`)
2. The PRD items (Potion×3, Revive×2) are per-battle consumables, not persistent inventory
3. Fastest path: add `inventory` to `PlayerBattleState` and `BattlePokemon` interfaces
4. Same pattern as V3 fatigue/charge states — ephemeral per-battle flags
5. No DB schema changes needed
6. Reconnection can re-send inventory via `battle:state` or `battle:turn-end`

---

## Risks

1. **Priority system**: How should `item` actions compare to `attack` and `change`? In real Pokémon, items have priority +4 (after switch +6 but before most moves). Need to update `getActionPriority()` in `battleService.ts` line 45-57.

2. **Fatigue + item interaction**: If a Pokémon is fatigued (`recharge`), should items be blocked too? The fatigue auto-rest currently registers a rest action regardless. Need a clear rule.

3. **Two-turn move + item interaction**: Can you use an item while charging a two-turn move? In real Pokémon, yes — you can cancel the charge by using an item. The current code (line 469-479) only blocks `'change'` actions during charge phase. Items would need similar or different handling.

4. **Item as a turn action**: Using an item consumes the player's turn action. This means the opponent's attack still goes through. The item effect (e.g., heal) applies before or after the opponent's attack depending on priority. This is handled naturally by the priority system if we assign appropriate priority.

5. **No existing item DB data**: Since no items collection exists, item definitions (name, effect, healing amount) need to be hardcoded or added as a new data source. Hardcoding in `battleService.ts` or a new `items.ts` config file is cleanest for Phase 1.

6. **Target selection**: Potions target one Pokémon on your team. The UI needs to show a team selector after choosing a Potion. This is similar to the switch menu's Pokémon selection but with item context. The `PokemonSelector` component can be extended/reused.

---

## Ready for Proposal

**Yes.** All code paths are understood. The proposal phase should define:

1. Item definitions (Potion: heal 50% HP, Revive: revive with 50% HP)
2. Priority for item actions (suggest +4)
3. Interaction rules with fatigue, charging, status conditions
4. UI component design for bag overlay and target selection
5. Backend `executeItem()` function
6. WebSocket message extensions
7. CSS for bag UI (follow switch menu pattern)
