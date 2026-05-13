---
name: Pokemon Patacon Skills Index
description: Complete index of all AI agent skills for Pokemon Patacon development. Reference this file to understand available documentation.
---

# 🎮 Pokemon Patacon - Skills Index

## Overview

This directory contains **domain-specific AI agent skills** that document best practices, patterns, and technical specifications for Pokemon Patacon development. Each skill is self-contained and covers a specific aspect of the game.

---

## 📚 Available Skills

### 1. **pokemon-gen-v-design** 🎯
**Location:** `.copilot/skills/pokemon-gen-v-design/SKILL.md`

Comprehensive documentation of Generation V (Black/White) design constraints and mechanics specific to Pokemon Patacon.

**Covers:**
- Pokédex constraints (156 Gen V native, 493 total)
- Base stats (max stats, no level variation)
- Moveset design (4 moves per Pokemon)
- Type chart (Gen V effectiveness)
- Status conditions (burn, paralysis, sleep, etc.)
- Sprite management (Gen V .gif format)
- Team composition rules
- Gen V legendary balance
- Common patterns & anti-patterns

**Use when:**
- Designing game mechanics
- Working with Pokemon data
- Implementing type effectiveness
- Selecting movesets

**Related:** battle-system, pokeapi-integration

---

### 2. **pokemon-battle-system** ⚔️
**Location:** `.copilot/skills/pokemon-battle-system/SKILL.md`

Complete battle engine architecture and turn execution pipeline for real-time 1v1 battles.

**Covers:**
- Battle state structure (TypeScript interfaces)
- Turn execution pipeline (receive → order → execute)
- Damage calculation formula
- Type effectiveness application
- Status condition handling (application, tick, removal)
- Action validation (attack, switch, item)
- Item usage (potion, revive)
- Coinflip mechanics (50/50 turn order)
- Win condition & battle end
- Synchronization events
- Error handling & validation

**Use when:**
- Implementing battleEngine.ts
- Processing turns
- Calculating damage
- Managing status conditions
- Validating player actions

**Related:** gen-v-design, websocket-sync

---

### 3. **pokemon-websocket-sync** 🔄
**Location:** `.copilot/skills/pokemon-websocket-sync/SKILL.md`

Real-time synchronization patterns for dual-screen battles using WebSocket. Ensures both players see identical state instantly.

**Covers:**
- WebSocket connection architecture
- Room management (join, broadcast)
- Core sync events (pokemon:selected, turn:execute, etc.)
- Optimistic updates on client
- State reconciliation after reconnect
- Error handling & validation
- Network timeout handling
- Connection management (heartbeat, keep-alive)
- Reconnection with exponential backoff
- Performance optimization (compression, batching)
- Testing sync patterns

**Use when:**
- Implementing WebSocket handlers
- Broadcasting battle events
- Handling reconnections
- Debugging sync issues
- Optimizing network performance

**Related:** battle-system, frontend-ui

---

### 4. **pokemon-pokeapi-integration** 📡
**Location:** `.copilot/skills/pokemon-pokeapi-integration/SKILL.md`

PokeAPI v2 integration with MongoDB caching strategy for efficient Pokemon data management.

**Covers:**
- PokeAPI endpoints (generation, pokemon, move, type)
- MongoDB schema design & indexes
- PokeAPI client implementation
- Cache-first retrieval strategy
- Data transformation & Gen V validation
- Sprite extraction (Black/White animated .gif)
- Move enrichment (power, accuracy, type)
- Batch operations & initialization
- Search functionality (name, type filtering)
- Error handling & fallback
- Type chart caching
- Rate limiting & exponential backoff

**Use when:**
- Setting up Pokemon data source
- Implementing pokeapiClient.ts
- Managing MongoDB collections
- Caching strategy
- Initializing Gen V Pokemon

**Related:** gen-v-design, battle-system

---

### 5. **pokemon-frontend-ui** 🎨
**Location:** `.copilot/skills/pokemon-frontend-ui/SKILL.md`

Svelte + Vite frontend component patterns for battle UI, real-time sync, and Gen V sprite rendering.

**Covers:**
- Project structure & file organization
- Svelte store architecture (battle, room, ui states)
- Core components (Battle, Arena, ActionPanel, etc.)
- Component patterns (reactive, derived stores)
- WebSocket integration in components
- Pokemon sprite rendering (.gif handling)
- HP bar and status icons
- Real-time UI updates
- Animations & transitions
- Performance optimization
- Testing UI components

**Use when:**
- Building Svelte components
- Managing UI state with stores
- Rendering battle screen
- Integrating WebSocket events
- Optimizing frontend performance

**Related:** websocket-sync, battle-system

---

## 🚀 Quick Start Guide

### Starting Development?

1. **Understand Gen V Rules** → Read `pokemon-gen-v-design`
2. **Plan Battle Logic** → Read `pokemon-battle-system`
3. **Setup Data Integration** → Read `pokemon-pokeapi-integration`
4. **Build Frontend** → Read `pokemon-frontend-ui`
5. **Implement Real-Time Sync** → Read `pokemon-websocket-sync`

### Implementing a Feature?

**Adding a new Pokemon move:**
- Check `pokemon-gen-v-design` (move attributes)
- Update `pokeapiClient.ts` using `pokemon-pokeapi-integration`
- Handle move selection in `ActionPanel.svelte` using `pokemon-frontend-ui`

**Fixing a battle bug:**
- Review `pokemon-battle-system` (turn pipeline)
- Check `pokemon-websocket-sync` (sync issues?)
- Verify `pokemon-gen-v-design` (rule validation)

**Debugging sync issues:**
- Review `pokemon-websocket-sync` (event structure)
- Check `pokemon-frontend-ui` (store updates)
- Verify `pokemon-battle-system` (state changes)

---

## 📋 Implementation Checklist

Use this to track progress:

- [ ] Gen V design rules understood
- [ ] PokeAPI integration working (500+ Pokemon cached)
- [ ] Battle engine processing turns correctly
- [ ] Damage calculation accurate
- [ ] Status conditions working (apply, tick, remove)
- [ ] Items functional (potion, revive)
- [ ] WebSocket sync broadcasts to both clients
- [ ] Frontend rendering battle screen
- [ ] Action panel accepting commands
- [ ] Animations playing on events
- [ ] Real-time updates on both screens
- [ ] Reconnection working
- [ ] Error handling graceful
- [ ] Performance acceptable (<100ms latency)
- [ ] Tests passing

---

## 🔗 Cross-Skill References

### Dependency Graph

```
gen-v-design
├─ Used by: battle-system, pokeapi-integration, frontend-ui
├─ References: Type chart, Status conditions, Move attributes

battle-system
├─ Uses: gen-v-design
├─ Used by: websocket-sync, frontend-ui
├─ References: Damage calc, Turn pipeline, Validation

websocket-sync
├─ Uses: battle-system
├─ Used by: frontend-ui
├─ References: Event structure, Broadcast patterns

pokeapi-integration
├─ Uses: gen-v-design
├─ Used by: frontend-ui
├─ References: Pokemon data, Sprites, Movesets

frontend-ui
├─ Uses: All skills
├─ References: State management, Component patterns
```

---

## 📖 Common Scenarios

### "I need to implement a new status condition"
**Skills to read (in order):**
1. `pokemon-gen-v-design` → Status conditions table
2. `pokemon-battle-system` → Status application & tick logic
3. `pokemon-frontend-ui` → StatusIcon component

### "The sync is out of sync between players"
**Skills to read (in order):**
1. `pokemon-websocket-sync` → Event structure
2. `pokemon-battle-system` → State reconciliation
3. `pokemon-frontend-ui` → Store updates

### "I'm fetching Pokemon from API, how do I cache?"
**Skills to read (in order):**
1. `pokemon-pokeapi-integration` → Cache strategy
2. `pokemon-gen-v-design` → Gen V validation
3. `pokemon-battle-system` → Stats usage

### "The damage calculation is wrong"
**Skills to read (in order):**
1. `pokemon-battle-system` → Damage formula
2. `pokemon-gen-v-design` → Type chart
3. `pokemon-websocket-sync` → Broadcast correctness

---

## 🎯 Key Patterns

### Real-Time Sync Pattern
```
Client A action → Server validation → Broadcast to A & B → Both render
```
See: `pokemon-websocket-sync`, `pokemon-battle-system`

### Cache Strategy Pattern
```
Request → MongoDB cache? → Yes: return cached
                      → No: fetch PokeAPI → validate Gen V → cache → return
```
See: `pokemon-pokeapi-integration`

### Turn Execution Pattern
```
Receive A & B actions → Coinflip → Execute in order → Broadcast state
```
See: `pokemon-battle-system`, `pokemon-websocket-sync`

### Component State Pattern
```
Svelte Store (writable/derived) → Component subscribe → Re-render on change
```
See: `pokemon-frontend-ui`

---

## 📞 Support

### Questions about...?

- **Gen V rules & mechanics** → `pokemon-gen-v-design`
- **Battle logic & calculations** → `pokemon-battle-system`
- **Real-time sync & WebSocket** → `pokemon-websocket-sync`
- **Pokemon data & caching** → `pokemon-pokeapi-integration`
- **UI components & Svelte** → `pokemon-frontend-ui`

---

## 📊 Skill Statistics

| Skill | Version | Lines | Focus |
|-------|---------|-------|-------|
| pokemon-gen-v-design | 1.0 | ~500 | Design constraints |
| pokemon-battle-system | 1.0 | ~700 | Battle engine |
| pokemon-websocket-sync | 1.0 | ~800 | Real-time sync |
| pokemon-pokeapi-integration | 1.0 | ~600 | Data integration |
| pokemon-frontend-ui | 1.0 | ~600 | Frontend UI |

**Total:** ~3,600 lines of documentation

---

## 🔄 Updates & Maintenance

All skills are maintained by the Pokemon Patacon Dev Team.

**Last Updated:** 12 de Mayo 2026  
**Status:** ✅ Complete for Fase 1 (MVP)  
**Next Review:** After Fase 1 implementation

---

## 📝 Notes

- Skills are **self-contained** - can be read independently
- Cross-references point to related sections
- Code examples are **TypeScript** (frontend + backend)
- All patterns follow **Svelte 4**, **Hono**, **Bun** conventions
- Gen V accuracy is **priority** over feature completeness

---

**Happy coding! 🎮✨**
