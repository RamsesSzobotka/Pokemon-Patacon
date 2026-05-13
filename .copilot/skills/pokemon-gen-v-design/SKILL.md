---
name: Pokemon Gen V Design
description: Design patterns and constraints specific to Pokemon Generation V (Black/White) for Pokemon Patacon. Covers mechanics, Pokedex, sprites, and Gen V-specific rules.
trigger: When designing game features, mechanics, or Pokedex for Pokemon Patacon based on Generation V. Use when working with Gen V Pokémon rules, movesets, type chart, or sprite handling.
domain: Pokemon Patacon Game Design
version: 1.0
---

# Pokémon Patacon - Generation V Design Skill

## Overview

Pokemon Patacon is exclusively built on **Generation V (Black/White)** rules and Pokémon. This skill documents all design decisions, constraints, and patterns specific to Gen V.

**Core Principle:** Authentic Gen V experience with modern technical implementation.

---

## 1. Pokedex Constraints

### 1.1 Available Pokemon Pool

- **Total:** 493 Pokémon (Gen I through Gen V)
- **Gen V Natives:** 156 new Pokémon (Victini #494 to Genesect #649)
- **Legendaries:** 10 total (Reshiram, Zekrom, Kyurem, Victini, Keldeo, Meloetta, Genesect)
  - **Per team limit:** Max 1 legendary
  - **Recommended legendaries:** Reshiram, Zekrom, Kyurem (most balanced)

### 1.2 Base Stats

**Rule:** All Pokémon use **maximum stats** (no level variation)

```
Stats Structure:
- HP:       Pokémon's base HP stat
- Attack:   Base attack stat
- Defense:  Base defense stat
- SpA:      Special Attack base stat
- SpD:      Special Defense base stat
- Speed:    Base speed stat (VISUAL ONLY in battle)
```

**Example (Pikachu):**
```json
{
  "name": "Pikachu",
  "base_stats": {
    "hp": 35,
    "attack": 55,
    "defense": 40,
    "sp_attack": 50,
    "sp_defense": 50,
    "speed": 90
  }
}
```

### 1.3 Evolution Rules

- **Pokémon can evolve** if their evolution line includes Gen V forms
- **No mid-battle evolution** (simplified for 1v1 battles)
- **Use evolved forms** if available in Gen V (e.g., Darmanitan uses Fire/Normal, not Basic Darumaka)
- **All-powerful forms:** If a Pokémon has a mega evolution in Gen V → use that for balance (none in Gen V, but relevant for future)

---

## 2. Move Set Design

### 2.1 Available Moves per Pokémon

- **Total moves per Pokémon:** 4 selectable moves (in battle)
- **Source:** PokeAPI `pokemon/{id}/moves` filtered for Gen V
- **Move Selection Strategy:**
  - **1 STAB move:** Same type as Pokémon (e.g., Pikachu → Thunderbolt)
  - **1 Coverage move:** Different type to cover weaknesses
  - **1 Utility move:** Status move (Thunder Wave, Toxic, Swords Dance)
  - **1 Flexible:** Other STAB, coverage, or utility based on role

### 2.2 Move Attributes

Each move must have:

| Attribute | Type | Example |
|-----------|------|---------|
| **Name** | String | "Tackle" |
| **Type** | String | "Normal" |
| **Power** | Integer | 40 |
| **Accuracy** | Integer | 100 (percentage) |
| **Effect** | String or Null | "chance to paralyze", "lowers DEF" |
| **Effect Chance** | Integer 0-100 | 30 |
| **Category** | String | "physical", "special", "status" |

### 2.3 Damage Calculation

```
Base Damage = Move Power × (Attacker_Stat / Defender_Stat) × Type_Multiplier

Where:
- Move Power: Base power of the move (e.g., 90 for Close Combat)
- Attacker_Stat: ATK for physical moves, SpA for special moves (max stats)
- Defender_Stat: DEF for physical moves, SpD for special moves
- Type_Multiplier: 0.5x (weak), 1.0x (normal), 2.0x (super effective)
```

**Important:** No stat stage modifications (no -1, -2 multipliers). Stats are always maximum.

---

## 3. Type Chart (Gen V)

### 3.1 Type Effectiveness

**Super Effective Against (2x damage):**

| Type | Beats |
|------|-------|
| Normal | (none) |
| Fire | Grass, Ice, Bug, Steel |
| Water | Fire, Ground, Rock |
| Electric | Water, Flying |
| Grass | Water, Ground, Rock |
| Ice | Flying, Ground, Grass, Dragon |
| Fighting | Normal, Ice, Rock, Dark, Steel |
| Poison | Grass, Fairy |
| Ground | Fire, Electric, Poison, Rock, Steel |
| Flying | Fighting, Bug, Grass |
| Psychic | Fighting, Poison |
| Bug | Grass, Psychic, Dark |
| Rock | Flying, Bug, Fire, Ice |
| Ghost | Ghost, Dark |
| Dragon | Dragon |
| Dark | Ghost, Dark |
| Steel | Ice, Rock, Fairy |
| Fairy | Fighting, Dragon, Dark |

**Weaknesses (takes 2x damage from):**

| Type | Weak to |
|------|---------|
| Normal | Fighting |
| Fire | Water, Ground, Rock |
| Water | Electric, Grass |
| Electric | Ground |
| Grass | Fire, Ice, Poison, Flying, Bug |
| Ice | Fire, Fighting, Rock, Steel |
| Fighting | Flying, Psychic, Fairy |
| Poison | Ground, Psychic |
| Ground | Water, Grass, Ice |
| Flying | Electric, Ice, Rock |
| Psychic | Bug, Ghost, Dark |
| Bug | Fire, Flying, Rock |
| Rock | Water, Grass, Fighting, Ground, Steel |
| Ghost | Ghost, Dark |
| Dragon | Ice, Dragon, Fairy |
| Dark | Fighting, Bug, Fairy |
| Steel | Fire, Water, Ground |
| Fairy | Poison, Steel |

### 3.2 Resistance Rules

- **Resist damage** (0.5x): Type-specific resistances
- **Immune to damage** (0x): Only Ghost immunity to Normal/Fighting
- **Dual-type logic:** If both types resist → 0.25x, if one resists and one weak → 1.0x

---

## 4. Status Conditions (Gen V)

### 4.1 Status Effects in Battle

| Status | Duration | Effect | Removal |
|--------|----------|--------|---------|
| Burn | 3 turns | -25% effective ATK | Refresh, Full Heal, Full Restore |
| Paralysis | 3 turns | Visual effect only (SPE not affected) | Refresh, Full Heal |
| Sleep | 3 turns | Cannot attack | Refresh, Awaken, Full Heal |
| Freeze | 3 turns | Cannot attack | Refresh, Flame Charge, Fire-type move |
| Poison | 3 turns | Lose 12.5% HP per turn | Refresh, Full Heal, Antidote |
| Attraction | 3 turns | 50% chance to not attack | Refresh, Aromatherapy |
| Confusion | 3 turns | 33% chance to hit self | Refresh, Calm Mind, full heal |

### 4.2 Application Rules

- **One status per Pokémon (max)** (non-volatile)
- **Confusion/Attraction stack** (volatile, separate)
- **Decrement:** -1 turn per Pokémon action
- **Removal moves:** Refresh, Heal Bell, Aromatherapy clear all statuses

---

## 5. Sprite Management (Gen V)

### 5.1 Sprite Sources

All sprites come from **PokeAPI Black/White collection**:

- **Battle Sprite (Front):** 256x96 px, .gif animated (2-4 frames)
- **Battle Sprite (Back):** 256x96 px, .gif animated (player's side)
- **Effect Sprites:** Attack animations, status icons

### 5.2 Animation Handling

```javascript
// Pseudo-code for sprite rendering
sprite.src = pokeAPI.sprites.black_white.animated.front_default // .gif URL
sprite.loop = true  // Loop animation
sprite.fps = 2      // Typically 2-4 frames per second
sprite.duration = 24 / fps // Calculate frame timing

// Sync with turns: restart animation on turn start
onTurnStart(() => sprite.currentFrame = 0)
```

### 5.3 Sprite Resolution

- **In-game:** 256x96 scaled to fit battle arena (maintain aspect ratio)
- **Supported formats:** .gif (animated), .png (static fallback)
- **Color depth:** 256 colors (true to Gen V aesthetics)

---

## 6. Inventory System (Items in Battle)

### 6.1 Item Limits

| Item | Max | Effect |
|------|-----|--------|
| Potion | 3 | Restores 100% HP of active Pokémon |
| Revive | 2 | Revives fainted Pokémon with 50% HP |

### 6.2 Usage Rules

- **1 item = 1 action** (cannot attack in same turn)
- **Potion:** Can only be used if active Pokémon HP < 100%
- **Revive:** Can only be used on fainted team members (not active)
- **Consumption:** Items consumed immediately, both players see update

### 6.3 Inventory Tracking

```json
{
  "room_id": "ABC123",
  "player_1": {
    "items": {
      "potion": 3,
      "revive": 2
    }
  },
  "player_2": {
    "items": {
      "potion": 2,
      "revive": 1
    }
  }
}
```

---

## 7. Team Composition Rules

### 7.1 Team Structure

- **Team size:** 6 Pokémon
- **Legendaries:** Max 1 per team
- **Duplicates:** No same Pokémon twice in one team
- **Empty team:** Not allowed (minimum 1 Pokémon)

### 7.2 Draft Selection

**Flow:**
1. Player A selects Pokémon #1 (from 493 available)
2. Player B selects Pokémon #1 (from 492 remaining)
3. Player A selects Pokémon #2 (from 491 remaining)
4. ... alternating until both have 6

**Important:** Once selected, a Pokémon becomes unavailable to the other player.

---

## 8. Battle Mechanics (Gen V Specific)

### 8.1 Turn Order

- **Deterministic:** Coinflip each turn (50/50)
- **Speed stat:** VISUAL ONLY, does NOT affect turn order
- **No priority moves:** All moves treated equally in turn order

### 8.2 Weather & Field Effects

**Not implemented in Phase 1:**
- No weather effects (Sunny Day, Rain, etc.)
- No terrain effects
- No entry hazards

### 8.3 Held Items

**Not implemented in Phase 1:**
- Pokémon cannot hold items
- Abilities are visual only

---

## 9. Gen V Legendary Balance

### 9.1 Recommended Legendaries

| Pokémon | Type | HP | ATK | DEF | SpA | SpD | SPE | Notes |
|---------|------|----|----|-----|-----|-----|-----|-------|
| Reshiram | Fire/Dragon | 100 | 120 | 100 | 150 | 90 | 90 | Special attacker, versatile |
| Zekrom | Electric/Dragon | 100 | 150 | 120 | 120 | 80 | 90 | Physical attacker |
| Kyurem | Ice/Dragon | 125 | 130 | 90 | 130 | 95 | 95 | Balanced, high HP |

### 9.2 Restriction

- **Duplicate ban:** Both players cannot use the same legendary in same battle
- **Encouraged:** Diverse legendary usage for balance

---

## 10. Common Patterns & Anti-Patterns

### 10.1 Do's ✅

- ✅ Use PokeAPI Gen V movesets exclusively
- ✅ Apply type chart correctly (consult table when unsure)
- ✅ Sync status duration counter every turn
- ✅ Scale sprites to maintain aspect ratio
- ✅ Validate team composition before battle starts
- ✅ Use maximum stats for all calculations
- ✅ Show Gen V-accurate sprites, not later generations

### 10.2 Don'ts ❌

- ❌ Do not use Mega Evolution (not in Gen V, added in Gen VI)
- ❌ Do not allow level modifications (all max stats, period)
- ❌ Do not add weather/terrain effects
- ❌ Do not change held items or abilities mid-battle
- ❌ Do not modify type chart (use Gen V official)
- ❌ Do not allow duplicate Pokémon in same team
- ❌ Do not use Gen VIII+ sprites/mechanics

---

## 11. Implementation Checklist

When implementing a new feature, verify:

- [ ] Feature is Gen V accurate
- [ ] Sprite handling uses .gif format from PokeAPI
- [ ] Type chart applied correctly
- [ ] Status conditions decrement properly
- [ ] Item limits enforced (3 potions, 2 revives)
- [ ] Legendary limit enforced (max 1)
- [ ] Stats are maximum, not variable
- [ ] Move damage calculated with correct formula
- [ ] WebSocket sync broadcasts to both players
- [ ] No Gen VI+ features accidentally included

---

## 12. References

- **PokeAPI Gen V Generation:** https://pokeapi.co/api/v2/generation/5
- **Official Gen V Type Chart:** Pokémon Black/White official guide
- **Gen V Mechanics:** https://bulbapedia.bulbagarden.net/wiki/Generation_V

---

**Skill Version:** 1.0  
**Last Updated:** 12 de Mayo 2026  
**Maintainer:** Pokemon Patacon Dev Team
