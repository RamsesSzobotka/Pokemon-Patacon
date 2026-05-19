# Instrucciones para Agentes - Pokemon Patacon

Este documento contiene las instrucciones y contexto necesario para continuar el desarrollo del proyecto.

---

## Estado Actual del Proyecto

**Backend:** TypeScript + Node.js + MongoDB + WebSocket (battle en tiempo real)  
**Frontend:** Pendiente de revisión  
**Total de movimientos en BD:** 679

---

## Problemas Identificados en la Base de Datos

### 1. Campo `heal` no se guardó correctamente
- La PokeAPI tiene `meta.healing` (NO `meta.heal`)
- El script de importación (`dataImportService.ts` línea 339) usa incorrectamente `move.meta?.heal` en vez de `move.meta?.healing`
- Por eso todos los movimientos de curación tienen `heal: 0` en la BD

**Estructura correcta de PokeAPI:**
```json
"meta": {
  "healing": 50,        // Porcentaje de HP que se cura (50 = 50%)
  "drain": 0,           // Porcentaje del daño que roba como vida
  "ailment": {...},
  "ailment_chance": 0,
  "category": { "name": "heal", ... },
  "flinch_chance": 0,
  "stat_chance": 0
}
```

**Problema encontrado en el script (línea 339):**
```typescript
// ACTUAL (INCORRECTO):
heal: move.meta?.heal || 0

// DEBERÍA SER:
healing: move.meta?.healing || 0
drain: move.meta?.drain || 0
```

**Solución:** Actualizar el script de importación O crear script para actualizar la base de datos con los valores correctos.

### 2. Leech Seed (Drenadoras) - Caso Especial
- Actualmente es un "ailment" pero el efecto de robo de vida no funciona
- En realidad es un efecto de estado (no ailment tradicional) que:
  - Dura indefinidamente (-1 turns)
  - Cada turno: roba ~12.5% del HP máximo del usuario y se lo da al oponente

**Tratamiento especial:**
- NO es un `ailment` tradicional como burn/poison
- En PokeAPI tiene: `ailment: 'leech-seed'` (tipo de ailment especial)
- El efecto es: al final de cada turno, roba 12.5% del HP máximo del usuario y se lo da al oponente

**Solución:**
1. NO usar el campo `drain` para Leech Seed (no es un movimiento de daño directo)
2. En la lógica de efectos de estado (`applyEndOfTurnAilmentDamage`), manejar `leech_seed` especialmente:
```typescript
// En applyEndOfTurnAilmentDamage (battleService.ts):
case 'leech_seed': {
  // Dañar al usuario (12.5% del HP máximo)
  const leechDamage = Math.floor(pokemon.maxHp * 0.125);
  pokemon.hp = Math.max(0, pokemon.hp - leechDamage);
  totalDamage += leechDamage;

  // Curar al oponente (el que aplicó el estado)
  if (opponent && !opponent.isFainted) {
    const healAmount = Math.min(leechDamage, opponent.maxHp - opponent.hp);
    opponent.hp += healAmount;
    messages.push(`${pokemon.name} perdió ${leechDamage} PS. ${opponent.name} recuperó ${healAmount} PS.`);
  } else {
    messages.push(`${pokemon.name} perdió ${leechDamage} PS por Drenadoras.`);
  }
  break;
}
```

**Nota:** El oponente se guarda en el campo `appliedBy` del ailment.

### 3. Stat Changes no se aplican
- 142 movimientos tienen `meta.stat_changes` pero no se aplican en batalla

**Solución:** Implementar en `executeMove()` de battleService.ts.

### 4. Flags de charge/recharge incorrectos
- Algunos movimientos tienen flags que no les corresponden

**Solución:** Script de limpieza para dejar solo los correctos.

---

## Plan de Actualización de Movimientos

### FASE 1: Scripts de Base de Datos

#### 1.1 `scripts/updateMoveHealingAndDrain.ts`
Actualizar los campos `meta.healing` y `meta.drain` en la base de datos.

**Nota:** El script original de importación usa `heal` pero debería usar `healing` y también缺少 `drain`.

**Movimientos con healing (> 0):**
```typescript
const HEALING_MOVES = [
  { moveId: 105, name: 'recover', healing: 50 },
  { moveId: 106, name: 'softboiled', healing: 50 },
  { moveId: 111, name: 'rest', healing: 100 },
  { moveId: 226, name: 'roost', healing: 50 },
  { moveId: 235, name: 'synthesis', healing: 50 },
  { moveId: 241, name: 'morning sun', healing: 50 },
  { moveId: 242, name: 'moonlight', healing: 50 },
  { moveId: 248, name: 'slack off', healing: 50 },
  { moveId: 282, name: 'heal order', healing: 50 },
  { moveId: 360, name: 'refresh', healing: 100 },
  // Agregar todos los demás
];
```

**Movimientos con drain (> 0):**
```typescript
const DRAIN_MOVES = [
  { moveId: 41, name: 'absorb', drain: 50 },
  { moveId: 45, name: 'mega drain', drain: 50 },
  // NOTA: Leech Seed NO usa drain normal - es un efecto de estado (ailment)
  // Se maneja en applyEndOfTurnAilmentDamage con 12.5% por turno
  { moveId: 138, name: 'dream eater', drain: 50 },  // Solo funciona si objetivo está dormido
  { moveId: 202, name: 'giga drain', drain: 50 },
  { moveId: 220, name: 'struggle', drain: 25 },  // Daño propio (self-damage)
  { moveId: 412, name: 'drain punch', drain: 50 },
  { moveId: 414, name: 'horn leech', drain: 50 },
  { moveId: 430, name: 'leech life', drain: 50 },
  { moveId: 506, name: 'draining kiss', drain: 75 },
  // Agregar todos los demás
];
```

**Script debe:**
1. Agregar campo `meta.healing` (no `heal`) con valores correctos
2. Agregar campo `meta.drain` (no existe actualmente) para movimientos de robo de vida
3. Mantener backward compatibility con campo `heal` existente (renombrarlo o mantener ambos)

#### 1.2 `scripts/updateLeechSeed.ts`
Agregar `meta.leechPercent: 10` a Drenadoras (move_id 73).

#### 1.3 `scripts/deleteComplexMoves.ts`
Eliminar 12 movimientos problemáticos:
- Mimetic (102), Sleep Talk (107), Me First (119), Copycat (118)
- Metronome (219), Counter (68), Mirror Coat (242), Thief (168)
- Covet (225), Destiny Bond (194), Bide (117), Focus Punch (196)

#### 1.4 `scripts/deleteSpeedStatMoves.ts`
Eliminar 23 movimientos status que cambian velocidad:
- String Shot, Scary Face, Electrotela, Icy Wind, Bubble, Bubble Beam
- Mud Shot, Bulldoze, Rock Tomb, Constrict, Low Sweep
- Rapid Spin (+1), Agility (+2), Autotomize (+2), Rock Polish (+2)
- Flame Charge (+1), Shift Gear (+2), Trailblaze (+1), Gear Up
- Cotton Spore, Toxic Thread, Pounce, Glaciate

#### 1.5 `scripts/deleteWeatherMoves.ts`
Eliminar 11 movimientos de clima:
- Sunny Day, Rain Dance, Sandstorm, Hail, Snowscape
- Weather Ball, Grassy Terrain, Electric Terrain, Psychic Terrain
- Misty Terrain, Aurora Veil

#### 1.6 `scripts/cleanMoveFlags.ts`
Corregir flags:
- **Charge** (10): Razor Wind, Solar Beam, Dig, Dive, Sky Attack, Fly, Bounce, Skull Bash, Shadow Force, Phantom Force
- **Recharge** (7): Hyper Beam, Giga Impact, Blast Burn, Hydro Cannon, Roar of Time, Frenzy Plant, Spin Out

---

### FASE 2: Modificaciones en battleService.ts

#### 2.1 Stat Changes
En función `executeMove`, después de aplicar daño:
```typescript
if (move.meta?.stat_changes && move.meta.stat_changes.length > 0) {
  const target = move.target === 'user' ? attacker : defender;
  for (const sc of move.meta.stat_changes) {
    target[sc.stat] += sc.change;
    result.statChanges.push({ stat: sc.stat, change: sc.change, target: move.target });
  }
}
```

#### 2.2 Heal (Curación del usuario)
Nueva función (usar campo `meta.healing` de la BD):
```typescript
export function applyMoveHeal(attacker: PokemonInBattle, healingPercent: number): number {
  // healingPercent viene de move.meta.healing (no heal)
  const healAmount = Math.floor(attacker.maxHp * (healingPercent / 100));
  attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
  return healAmount;
}

// En executeMove:
if (move.meta?.healing && move.meta.healing > 0) {
  const healed = applyMoveHeal(attacker, move.meta.healing);
  result.healed = healed;
  message += `\n¡${attacker.name} recuperó ${healed} PS!`;
}
```

#### 2.3 Drain (Robo de vida)
Usar campo `meta.drain` (porcentaje del daño que se roba):
```typescript
// En executeMove, después de aplicar daño:
if (move.meta?.drain && move.meta.drain > 0 && damage > 0) {
  const drainAmount = Math.floor(damage * (move.meta.drain / 100));
  attacker.hp = Math.min(attacker.maxHp, attacker.hp + drainAmount);
  result.drainAmount = drainAmount;
  message += `\n¡${attacker.name} absorbió ${drainAmount} PS!`;
}

// Casos especiales:
// - Leech Seed (move 74): drain = 100 significa que roba al objetivo el daño completo
//   (se maneja diferente - es un efecto de estado, no daño directo)
// - Struggle: tiene drain negativo (causa daño al usuario)
```

#### 2.4 Metronome (Movimiento aleatorio)
```typescript
export async function executeMetronome(attacker: PokemonInBattle): Promise<BattleMove> {
  const moves = await getAllMoves();
  const validMoves = moves.filter(m => m.power > 0);
  const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
  return convertToBattleMove(randomMove);
}
```

---

### FASE 3: Sistema de Acciones Diferidas

#### 3.1 Nuevos tipos en `src/types/battle.ts`

```typescript
export interface DelayedAction {
  id: string;
  type: 'future_sight' | 'doom' | 'destiny_bond' | 'grudge';
  sourcePlayerId: 'player1' | 'player2';
  sourcePokemonName: string;
  targetPlayerId: 'player1' | 'player2';
  targetPokemonName: string;
  executeTurn: number;
  baseDamage?: number;
  message: string;
}

export interface TurnRecord {
  turnNumber: number;
  timestamp: Date;
  phase: BattlePhase;
  player1: {
    action: PlayerAction | null;
    activePokemon: string;
    hp: number;
    ailments: string[];
  };
  player2: {
    action: PlayerAction | null;
    activePokemon: string;
    hp: number;
    ailments: string[];
  };
  results: ActionResult[];
  delayedActions: DelayedAction[];
  weather: string | null;
  currentMessage: string;
}
```

Agregar a `BattleState`:
```typescript
delayedActions: DelayedAction[];
turnHistory: TurnRecord[];
```

#### 3.2 Funciones en battleService.ts

```typescript
// Procesar acciones diferidas al inicio de cada turno
export function processDelayedActions(battleState: BattleState): ActionResult[]

// Guardar historial de turno para repeticiones
export function recordTurn(battleState: BattleState): TurnRecord
```

---

## Comandos Útiles

```bash
# Conectar a MongoDB y verificar datos
cd backend
node -e "const {MongoClient} = require('mongodb'); ..."

# Ver movimientos en la base de datos
# Usar scripts de prueba existentes:
bun run scripts/testTypes.ts

# Los scripts se ejecutan con:
bun run scripts/[nombre].ts
```

---

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src/types/battle.ts` | Tipos de datos de batalla |
| `src/services/battleService.ts` | Lógica de ejecución de movimientos |
| `src/websocket/battleHandler.ts` | Manejador de batalla por WebSocket |
| `src/db/mongodb.ts` | Conexión a MongoDB |
| `src/services/dataImportService.ts` | Importación de datos desde PokeAPI |

---

## Pendiente de Revisar

1. Frontend - estado actual y funcionalidad
2. Sistema de selección de Pokémon para batalla
3. Repeticiones de batalla - implementación del reproductor

---

*Documento creado: Mayo 2026*
*Última actualización: fase de planificación completada, sin implementación*