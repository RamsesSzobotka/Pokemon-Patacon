# Especificación de Implementación - Sistema de Batalla V3
## Movimientos de 2 Turnos y Fatiga

**Versión:** 3.0 Implementation Spec  
**Fecha:** 18 de Mayo de 2026  
**Estado:** Listo para Desarrollo  
**Prioridad:** Alta  
**Módulo:** battleService.ts, battle.ts (types)

---

## 📋 Tabla de Contenidos

1. [Cambios de Interfaz TypeScript](#cambios-de-interfaz-typescript)
2. [Firmas de Funciones](#firmas-de-funciones)
3. [Lógica de Movimientos de 2 Turnos](#lógica-de-movimientos-de-2-turnos)
4. [Sistema de Evasión](#sistema-de-evasión)
5. [Sistema de Fatiga](#sistema-de-fatiga)
6. [Lógica Turno-a-Turno](#lógica-turno-a-turno)
7. [Algoritmos Detallados](#algoritmos-detallados)
8. [Casos de Prueba](#casos-de-prueba)

---

## 1. Cambios de Interfaz TypeScript

### 1.1 Nuevos Campos en `PokemonInBattle`

En `backend/src/types/battle.ts`, añadir los siguientes campos a la interfaz `PokemonInBattle`:

```typescript
export interface PokemonInBattle {
  // ... campos existentes ...
  
  // ===== CAMPOS V3: MOVIMIENTOS DE 2 TURNOS =====
  
  /**
   * Indica si el Pokémon está en fase de carga de un movimiento de 2 turnos
   * true = próximo turno ejecuta; false = puede seleccionar nuevo movimiento
   */
  isCharging: boolean;
  
  /**
   * El movimiento que está cargando (si isCharging = true)
   * Se mantiene entre turnos para saber qué movimiento ejecutar
   */
  chargingMove?: BattleMove;
  
  /**
   * Indica que el Pokémon DEBE pasar turno siguiente (Hyper Beam fatiga)
   * No puede seleccionar movimiento ni cambiar; se pasa automáticamente
   */
  cannotActNextTurn: boolean;
  
  /**
   * Turno en que comenzó la fatiga (para tracking en UI)
   * Útil para mostrar "Fatigado por X más turnos"
   */
  fatigueStartTurn?: number;
  
  /**
   * Si el Pokémon está en carga evasiva (Fly, Dig, Dive, etc)
   * Heredado de isCharging pero útil para lógica de evasión
   * true = esquiva automáticamente ataques físicos
   */
  isEvadingCharge?: boolean;
  
  /**
   * Para Skull Bash: defensa temporal durante carga
   * Se suma a la defensa en los cálculos durante el turno 1
   */
  tempDefenseBoost?: number;
}
```

### 1.2 Actualización de `BattleMove` Meta

Los movimientos de 2 turnos usan el campo `flags.charge`. Asegurar que exista:

```typescript
export interface BattleMove {
  // ... campos existentes ...
  
  flags: {
    recharge: boolean;      // Hyper Beam (especial: ejecuta + fatiga)
    charge: boolean;        // Solar Beam, Fly, Dig, etc. (turno 1 = carga, turno 2 = ejecuta)
    protect: boolean;       // No afecta a V3
    mirror: boolean;        // No afecta a V3
  };
  
  meta: {
    // ... campos existentes ...
    
    /**
     * Indica si el movimiento tiene efecto evasivo durante la carga
     * true para: Fly, Dig, Dive, Bounce, Shadow Force
     * false para: Solar Beam, Razor Wind, Skull Bash, Hyper Beam
     */
    chargeIsEvasive?: boolean;
    
    /**
     * Mensaje personalizado para la fase de carga
     * Ej: "preparando energía", "volando", "cavando", etc.
     */
    chargeMessage?: string;
    
    /**
     * Cambios de estadísticas durante carga (V3 avanzado)
     * Ej: Skull Bash +1 Defense
     */
    chargeStatChanges?: Array<{ stat: string; change: number }>;
  };
}
```

### 1.3 Constantes de V3

Añadir a `backend/src/types/battle.ts` o en un archivo `constants.ts`:

```typescript
/**
 * Lista de movimientos que requieren carga (2 turnos totales)
 * Formato: slug del movimiento (minúscula con guiones)
 */
export const TWO_TURN_CHARGE_MOVES = [
  'solar-beam',    // Carga sin evasión
  'fly',           // Carga + evasión
  'dig',           // Carga + evasión
  'bounce',        // Carga + evasión
  'dive',          // Carga + evasión
  'skull-bash',    // Carga + +1 Defense
  'razor-wind',    // Carga sin evasión
  'shadow-force',  // Carga + evasión
];

/**
 * Movimientos que causan fatiga después de ejecutarse
 * El Pokémon no puede actuar el siguiente turno
 */
export const FATIGUE_MOVES = [
  'hyper-beam',    // Especial: ejecuta + fatiga inmediatamente
];

/**
 * Movimientos de carga que esquivan automáticamente
 * Durante el turno 1, el Pokémon evade cualquier ataque
 */
export const EVASIVE_CHARGE_MOVES = [
  'fly',
  'dig',
  'dive',
  'bounce',
  'shadow-force',
];

/**
 * Mensajes por defecto para fases de carga
 */
export const CHARGE_MESSAGES: Record<string, string> = {
  'solar-beam': 'preparando energía',
  'fly': 'volando',
  'dig': 'cavando',
  'bounce': 'rebotando',
  'dive': 'sumergiéndose',
  'skull-bash': 'preparando cabezazo',
  'razor-wind': 'preparando viento',
  'shadow-force': 'desapareciendo',
};

/**
 * Poder ejecutivo de movimientos de 2 turnos (turno 2)
 * Los valores son iguales a los de la API, pero aquí documentamos
 */
export const CHARGE_EXECUTION_POWERS: Record<string, number> = {
  'solar-beam': 120,      // Normal: 65, cargado: 120
  'fly': 70,
  'dig': 80,
  'bounce': 85,
  'dive': 80,
  'skull-bash': 100,
  'razor-wind': 80,
  'shadow-force': 90,
};

/**
 * Para Hyper Beam: poder especial en ejecución directa
 * No carga, pero causa fatiga
 */
export const HYPER_BEAM_RECHARGE_POWER = 150;

/**
 * Defensa temporal para Skull Bash durante carga
 * Se suma al stat de defensa durante el turno de carga
 */
export const SKULL_BASH_CHARGE_DEFENSE_BOOST = 1; // +1 stage
```

---

## 2. Firmas de Funciones

### 2.1 Detección de Movimientos de 2 Turnos

```typescript
/**
 * Verifica si un movimiento es de 2 turnos (requiere carga)
 * 
 * @param move - El movimiento a verificar
 * @returns true si el movimiento requiere 2 turnos (carga + ejecución)
 * 
 * Casos cubiertos:
 * - Solar Beam, Fly, Dig, Bounce, Dive, Skull Bash, Razor Wind, Shadow Force: true
 * - Hyper Beam: false (es un caso especial, ver isRechargeMove)
 * - Otros movimientos: false
 */
export function isMoveTwoTurn(move: BattleMove): boolean;
```

**Implementación:**
```typescript
export function isMoveTwoTurn(move: BattleMove): boolean {
  return move.flags?.charge === true && 
         move.flags?.recharge !== true;
}
```

---

### 2.2 Verificar si Pokémon está en Carga

```typescript
/**
 * Verifica si un Pokémon está en fase de carga de un movimiento de 2 turnos
 * 
 * @param pokemon - El Pokémon a verificar
 * @returns true si el Pokémon está esperando ejecutar su movimiento de carga
 * 
 * Notas:
 * - Solo debe devolver true si isCharging=true Y chargingMove está definido
 * - Se usa en la lógica de selección de acciones (no puede atacar, debe ejecutar)
 */
export function isTwoTurnCharging(pokemon: PokemonInBattle): boolean;
```

**Implementación:**
```typescript
export function isTwoTurnCharging(pokemon: PokemonInBattle): boolean {
  return pokemon.isCharging === true && pokemon.chargingMove !== undefined;
}
```

---

### 2.3 Obtener Lista de Movimientos de 2 Turnos

```typescript
/**
 * Retorna la lista de slugs de movimientos que requieren carga
 * 
 * @returns Array con nombres slugificados de movimientos de 2 turnos
 * 
 * Uso en frontend:
 * - Para filtrar movimientos disponibles
 * - Para marcar visualmente cuáles requieren carga
 * - Para pre-llenar información de batallas de IA
 */
export function getTwoTurnMoveList(): string[];
```

**Implementación:**
```typescript
export function getTwoTurnMoveList(): string[] {
  return TWO_TURN_CHARGE_MOVES;
}
```

---

### 2.4 Manejar Movimiento de 2 Turnos

```typescript
/**
 * Orquesta la lógica completa de un movimiento de 2 turnos
 * Maneja tanto la fase de carga como la de ejecución
 * 
 * @param attacker - El Pokémon atacante
 * @param defender - El Pokémon defensor
 * @param move - El movimiento a ejecutar
 * @param phase - 'charge' para turno 1, 'execute' para turno 2
 * 
 * @returns MoveResult con:
 *   - type: 'charge_start' | 'charge_execute' | 'charge_evaded'
 *   - message: Mensaje para mostrar en UI
 *   - damage: daño causado (0 en fase de carga)
 *   - evasive: true si fue evasión
 *   - defenseBoost: cambio de defensa (para Skull Bash)
 *   - fatigue: true si el atacante entra en fatiga
 * 
 * Lógica:
 * - phase='charge': 
 *     * Marcar attacker.isCharging = true
 *     * Guardar move en attacker.chargingMove
 *     * Para Skull Bash: aplicar +1 Defense temporal
 *     * Retornar mensaje de carga
 * 
 * - phase='execute':
 *     * Verificar si defender está evasivamente cargando
 *     * Si sí: retornar evadido, defender sigue su carga
 *     * Si no: calcular daño normal
 *     * Limpiar attacker.isCharging = false
 *     * Limpiar attacker.chargingMove = undefined
 *     * Retornar damage resultado
 */
export function handleTwoTurnMove(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove,
  phase: 'charge' | 'execute'
): MoveResult;
```

**Interfaz MoveResult actualizada:**
```typescript
export interface MoveResult {
  type: 'damage' | 'charge_start' | 'charge_execute' | 'charge_evaded' | 'fatigue' | 'sin_efecto';
  message: string;
  damage: number;
  evasive?: boolean;           // true si fue evasión
  defenseBoost?: number;       // Cambio de defensa temporal
  fatigueApplied?: boolean;    // true si entra en fatiga
  attackerFatigued?: boolean;  // true si el atacante queda fatigado
}
```

---

### 2.5 Verificar si está en Carga Evasiva

```typescript
/**
 * Verifica si un Pokémon está en carga evasiva
 * (Fly, Dig, Dive, Bounce, Shadow Force)
 * 
 * @param pokemon - El Pokémon a verificar
 * @returns true si el Pokémon está evadiéndose automáticamente
 * 
 * Uso:
 * - En calculateDamage(): si target.isEvadingCharge, daño = 0
 * - En executeTurn(): para determinar si atacante "evadió"
 */
export function isEvasivelyCharging(pokemon: PokemonInBattle): boolean;
```

**Implementación:**
```typescript
export function isEvasivelyCharging(pokemon: PokemonInBattle): boolean {
  if (!isTwoTurnCharging(pokemon) || !pokemon.chargingMove) {
    return false;
  }
  
  return EVASIVE_CHARGE_MOVES.includes(pokemon.chargingMove.name);
}
```

---

### 2.6 Aplicar Fatiga

```typescript
/**
 * Marca un Pokémon como fatigado después de Hyper Beam
 * No puede actuar el siguiente turno
 * 
 * @param pokemon - El Pokémon que entra en fatiga
 * 
 * Notas:
 * - cannotActNextTurn = true
 * - fatigueStartTurn = turno actual (para tracking)
 * - En executeTurn(), si cannotActNextTurn=true, saltar turno automáticamente
 * - Al inicio del siguiente turno, resetear estos campos
 */
export function applyFatigue(pokemon: PokemonInBattle, currentTurn?: number): void;
```

**Implementación:**
```typescript
export function applyFatigue(pokemon: PokemonInBattle, currentTurn?: number): void {
  pokemon.cannotActNextTurn = true;
  pokemon.fatigueStartTurn = currentTurn;
}
```

---

### 2.7 Resetear Estado de Fatiga

```typescript
/**
 * Limpia el estado de fatiga de un Pokémon
 * Se llama al inicio de cada turno
 * 
 * @param pokemon - El Pokémon a resetear
 * 
 * Notas:
 * - cannotActNextTurn = false
 * - fatigueStartTurn = undefined
 */
export function resetFatigueState(pokemon: PokemonInBattle): void;
```

**Implementación:**
```typescript
export function resetFatigueState(pokemon: PokemonInBattle): void {
  pokemon.cannotActNextTurn = false;
  pokemon.fatigueStartTurn = undefined;
}
```

---

## 3. Lógica de Movimientos de 2 Turnos

### 3.1 Movimientos de Carga sin Evasión

#### Solar Beam

| Turno | Acción | Power | Estado |
|-------|--------|-------|--------|
| 1 | Carga: "preparando energía" | 0 | `isCharging = true` |
| 2 | Ataca | 120 | `isCharging = false` |

**Notas:**
- Daño turno 2 = 120 (potencia reducida respecto a la API)
- Sin evasión durante carga
- Sin fatiga
- Sin modificadores de stats

#### Razor Wind

| Turno | Acción | Power | Estado |
|-------|--------|-------|--------|
| 1 | Carga: "preparando viento" | 0 | `isCharging = true` |
| 2 | Ataca | 80 | `isCharging = false` |

**Notas:**
- Similar a Solar Beam pero con menor poder
- Idéntico comportamiento

---

### 3.2 Movimientos de Carga Evasiva

#### Fly

| Turno | Acción | Power | Evasión | Estado |
|-------|--------|-------|---------|--------|
| 1 | Carga: "volando" | 0 | ✓ Evade ataques | `isCharging = true`, `isEvadingCharge = true` |
| 2 | Ataca | 70 | ✗ No evade | `isCharging = false`, `isEvadingCharge = false` |

**Lógica de Evasión:**
- Si enemigo ataca al Pokémon que está volando (turno 1):
  - Retornar MoveResult con `evasive = true`
  - Mensaje: "¡{nombre} se evasionó!"
  - Daño = 0
- Única excepción: movimientos con flag `para` (no implementados en V3)

#### Dig

| Turno | Acción | Power | Evasión | Estado |
|-------|--------|-------|---------|--------|
| 1 | Carga: "cavando" | 0 | ✓ Evade ataques | `isCharging = true`, `isEvadingCharge = true` |
| 2 | Ataca | 80 | ✗ No evade | `isCharging = false`, `isEvadingCharge = false` |

#### Dive

| Turno | Acción | Power | Evasión | Estado |
|-------|--------|-------|---------|--------|
| 1 | Carga: "sumergiéndose" | 0 | ✓ Evade ataques | `isCharging = true`, `isEvadingCharge = true` |
| 2 | Ataca | 80 | ✗ No evade | `isCharging = false`, `isEvadingCharge = false` |

#### Bounce

| Turno | Acción | Power | Evasión | Estado |
|-------|--------|-------|---------|--------|
| 1 | Carga: "rebotando" | 0 | ✓ Evade ataques | `isCharging = true`, `isEvadingCharge = true` |
| 2 | Ataca | 85 | ✗ No evade | `isCharging = false`, `isEvadingCharge = false` |

#### Shadow Force

| Turno | Acción | Power | Evasión | Estado |
|-------|--------|-------|---------|--------|
| 1 | Carga: "desapareciendo" | 0 | ✓ Evade ataques | `isCharging = true`, `isEvadingCharge = true` |
| 2 | Ataca | 90 | ✗ No evade | `isCharging = false`, `isEvadingCharge = false` |

---

### 3.3 Movimientos de Carga con Efecto Secundario

#### Skull Bash

| Turno | Acción | Power | Defense | Estado |
|-------|--------|-------|---------|--------|
| 1 | Carga: "preparando cabezazo" | 0 | +1 | `isCharging = true`, `tempDefenseBoost = 1` |
| 2 | Ataca | 100 | Normal | `isCharging = false`, `tempDefenseBoost = undefined` |

**Implementación del Boost:**
- En turno 1: `pokemon.defense += 1` (o multiplicador 1.5x en cálculos)
- En turno 2: Se resetea automáticamente al limpiar `isCharging`
- Si el Pokémon cambia o es reemplazado, el boost se pierde

**Interacción con V4 (Cambios de Stats):**
- El boost NO suma a modificadores permanentes de V4
- Es un efecto temporal solo durante la carga
- Se aplica DESPUÉS de modificadores, no se acumula

---

### 3.4 Movimiento Especial: Hyper Beam

| Turno | Acción | Power | Carga | Fatiga |
|-------|--------|-------|-------|--------|
| 1 | Ataca | 150 | No | Sí |
| 2+ | No puede actuar | 0 | N/A | Sigue |

**Especificidades de Hyper Beam:**
- NO es un movimiento de 2 turnos en el sentido tradicional
- Se ejecuta inmediatamente (turn 1) con power 150
- Luego causa fatiga (no puede actuar en turn 2)
- En turn 2, automaticamente "pasa" sin seleccionar movimiento
- En turn 3+, puede actuar normalmente

**Lógica:**
```
TURNO 1:
- Hyper Beam se ejecuta normal
- Power = 150 (no 120 como otros movimientos)
- Daño calculado normalmente
- Al final: applyFatigue(attacker)

TURNO 2:
- Al iniciar turno, verificar cannotActNextTurn
- Si true: automaticamente "Pokémon está fatigado" y pasa turno
- cannotActNextTurn se resetea al final del turno

TURNO 3+:
- Comportamiento normal
```

---

## 4. Sistema de Evasión

### 4.1 Verificación de Evasión

**Durante calculateDamage():**

```typescript
/**
 * Función auxiliar para verificar si un ataque es evasionado
 * Se llama ANTES de calcular daño
 * 
 * @param attacker - Pokémon atacante
 * @param defender - Pokémon defensor
 * @returns true si el ataque es automáticamente evadido
 */
function isAttackEvaded(attacker: PokemonInBattle, defender: PokemonInBattle): boolean {
  // Caso 1: Defender está en carga evasiva (Fly, Dig, etc.)
  if (isEvasivelyCharging(defender)) {
    return true;
  }
  
  // Caso 2: [V3+] Defender tiene efecto de evasión
  // (Ej: movimiento Double Team, implementado en V4)
  // Por ahora solo Caso 1
  
  return false;
}
```

**En executeMove():**

```typescript
// Antes de calcular daño
if (isAttackEvaded(attacker, move.targetPokemon)) {
  return {
    type: 'charge_evaded',
    message: `¡${move.targetPokemon.name} se evasionó!`,
    damage: 0,
    evasive: true
  };
}

// Continuar con cálculo normal de daño
const damageResult = calculateDamage(move, attacker, move.targetPokemon);
```

### 4.2 Casos de Evasión por Movimiento

| Movimiento | Evade | Razón |
|------------|-------|-------|
| Fly | Sí | Está en el aire |
| Dig | Sí | Está bajo tierra |
| Dive | Sí | Está bajo agua |
| Bounce | Sí | Está saltando |
| Shadow Force | Sí | Está en otra dimensión |
| Solar Beam | No | Visible mientras carga |
| Razor Wind | No | Visible mientras carga |
| Skull Bash | No | Visible mientras carga |

---

## 5. Sistema de Fatiga

### 5.1 Aplicación de Fatiga

**Solo por Hyper Beam:**

```typescript
// En executeMove(), tras aplicar daño de Hyper Beam
if (move.name === 'hyper-beam') {
  applyFatigue(attacker, battle.currentTurn);
  return {
    type: 'fatigue',
    message: `¡${attacker.name} está fatigado y no puede actuar!`,
    damage: calculatedDamage,
    attackerFatigued: true
  };
}
```

### 5.2 Resetting Automático de Fatiga

**En initializeTurn() o executeTurn():**

```typescript
// Al inicio de cada turno
function prepareTurn(battle: BattleState) {
  // Resetear fatiga del turno anterior
  resetFatigueState(battle.player1.activePokemon);
  resetFatigueState(battle.player2.activePokemon);
  
  // Verificar si algún Pokémon debe pasar turno por fatiga
  // (ver sección 6.2)
}
```

### 5.3 Interacción con Otras Mecánicas

**Con efectos de estado (V2):**
- Si un Pokémon está fatigado Y tiene un efecto de estado:
  - El efecto se mantiene (ej: burn, poison)
  - Pero el Pokémon no actúa
  - El efecto sigue causando daño al final del turno

**Con cambio de Pokémon:**
- Si un Pokémon está fatigado, NO puede cambiar
- Debe pasar turno, luego puede cambiar

**Con otros Pokémon:**
- Cuando cambia a otro Pokémon por KO:
  - La fatiga se pierde (nuevo Pokémon sin fatiga)
  - Es decir, fatiga es por Pokémon específico

---

## 6. Lógica Turno-a-Turno

### 6.1 Flujo de Turno Completo

```
╔════════════════════════════════════════════════════════════════╗
║                   INICIO DE TURNO N                           ║
╚════════════════════════════════════════════════════════════════╝

FASE 1: PREPARACIÓN
┌─────────────────────────────────────────────────────────────┐
│ 1a. Resetear fatiga del turno anterior                      │
│     resetFatigueState(player1.activePokemon)                │
│     resetFatigueState(player2.activePokemon)                │
│                                                             │
│ 1b. Verificar cambio de Pokémon no resuelt por KO          │
│     Si hay pendiente: entrar nuevo Pokémon                 │
│                                                             │
│ 1c. Enviar estado a ambos jugadores para selección         │
│     Incluir isCharging para indicar "debe ejecutar"        │
└─────────────────────────────────────────────────────────────┘

FASE 2: SELECCIÓN DE ACCIONES
┌─────────────────────────────────────────────────────────────┐
│ 2a. Si player1.activePokemon.isCharging = true:             │
│     - No permitir seleccionar movimiento                   │
│     - Forzar ejecución de chargingMove                     │
│     - Mostrar: "Debe ejecutar {movimiento}"                │
│                                                             │
│ 2b. Si player1.activePokemon.cannotActNextTurn = true:     │
│     - No permitir seleccionar acción                       │
│     - Forzar "pasar turno"                                 │
│     - Mostrar: "{Pokémon} está fatigado"                   │
│                                                             │
│ 2c. Ambos jugadores seleccionan:                           │
│     - Atacar con movimiento X (poder ejecutar si cargando) │
│     - O cambiar Pokémon                                     │
└─────────────────────────────────────────────────────────────┘

FASE 3: DETERMINAR ORDEN
┌─────────────────────────────────────────────────────────────┐
│ 3a. Calcular prioridad de cada acción:                      │
│     - Cambiar Pokémon: +6                                   │
│     - Movimiento: su priority (del BattleMove)             │
│                                                             │
│ 3b. Si prioridades diferentes:                             │
│     - Mayor prioridad ataca primero                        │
│                                                             │
│ 3c. Si prioridades iguales:                                │
│     - COINFLIP (50/50)                                     │
└─────────────────────────────────────────────────────────────┘

FASE 4: EJECUTAR ACCIONES
┌─────────────────────────────────────────────────────────────┐
│ Ejecutar para PRIMER JUGADOR:                               │
│                                                             │
│ 4a. ¿Cambiar Pokémon?                                      │
│     SI → swap activePokemon, reSeteo campos de carga      │
│     NO → continuar                                          │
│                                                             │
│ 4b. ¿Atacar?                                               │
│     4b1. Obtener movimiento                                │
│     4b2. ¿Es movimiento de 2 turnos (solar beam, fly)?    │
│           SI → ¿Está en carga (isCharging=true)?          │
│               SI → executar fase 'execute' (turno 2)      │
│               NO → ejecutar fase 'charge' (turno 1)       │
│           NO → ejecutar movimiento normalmente             │
│     4b3. Resultado del movimiento:                         │
│           - Si carga: isCharging=true, chargingMove=move  │
│           - Si ataca: calcular daño, aplicar estado       │
│           - Si evasión: daño=0, mensaje evadido           │
│     4b4. Verificar KO del defensor                         │
│     4b5. Si Hyper Beam: applyFatigue(attacker)            │
│                                                             │
│ Ejecutar para SEGUNDO JUGADOR:                             │
│ (misma lógica)                                              │
└─────────────────────────────────────────────────────────────┘

FASE 5: EFECTOS FINALES
┌─────────────────────────────────────────────────────────────┐
│ 5a. Verificar KO general (ambos Pokémon):                   │
│     - Si alguno KO: batalla termina                        │
│     - Registrar ganador                                    │
│                                                             │
│ 5b. V2+: Aplicar daño de efectos de estado:                │
│     - burn, poison, toxic                                  │
│     - Decrementar turnos de estados                        │
│     - Eliminar estados terminados                          │
│                                                             │
│ 5c. Actualizar UI:                                         │
│     - Mostrar nuevo HP                                     │
│     - Mostrar nuevos estados/carga                         │
│     - Mostrar mensajes de batalla                          │
│                                                             │
│ 5d. ¿Hay ganador?                                          │
│     SI → batalla.status = 'finished'                       │
│     NO → volver a FASE 1 (siguiente turno)                │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Decisión de Acción Forzada

```typescript
/**
 * Determina si un Pokémon está forzado a realizar una acción específica
 * 
 * @returns objeto con:
 *   - forced: boolean (hay acción forzada)
 *   - reason: string (por qué se fuerza)
 *   - action: ActionType (qué debe hacer)
 *   - moveId?: number (si es ataque, cuál movimiento)
 */
function getForcedAction(pokemon: PokemonInBattle): {
  forced: boolean;
  reason: string;
  action: ActionType;
  moveId?: number;
} {
  // Caso 1: Carga pendiente
  if (isTwoTurnCharging(pokemon)) {
    return {
      forced: true,
      reason: 'Debe ejecutar su movimiento de carga',
      action: 'attack',
      moveId: pokemon.chargingMove?.moveId
    };
  }
  
  // Caso 2: Fatiga
  if (pokemon.cannotActNextTurn) {
    return {
      forced: true,
      reason: 'Está fatigado y no puede actuar',
      action: 'pass' // nuevo tipo de acción
    };
  }
  
  return { forced: false, reason: '', action: 'attack' };
}
```

---

## 7. Algoritmos Detallados

### 7.1 Algoritmo: Ejecutar Movimiento de 2 Turnos

```typescript
/**
 * ALGORITMO COMPLETO para handleTwoTurnMove()
 */
function handleTwoTurnMove(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove,
  phase: 'charge' | 'execute'
): MoveResult {
  
  // FASE 1: CARGA
  if (phase === 'charge') {
    
    // Paso 1: Marcar como cargando
    attacker.isCharging = true;
    attacker.chargingMove = move;
    
    // Paso 2: Determinar si es evasivo
    const isEvasive = EVASIVE_CHARGE_MOVES.includes(move.name);
    attacker.isEvadingCharge = isEvasive;
    
    // Paso 3: Aplicar efectos secundarios
    if (move.name === 'skull-bash') {
      attacker.tempDefenseBoost = SKULL_BASH_CHARGE_DEFENSE_BOOST;
      // En calculateDamage, se usará este valor
    }
    
    // Paso 4: Obtener mensaje
    const chargeMsg = CHARGE_MESSAGES[move.name] || 'preparándose';
    
    return {
      type: 'charge_start',
      message: `¡${attacker.name} está ${chargeMsg}!`,
      damage: 0,
      evasive: isEvasive
    };
  }
  
  // FASE 2: EJECUCIÓN (turno 2)
  if (phase === 'execute') {
    
    // Paso 1: Verificar si defensor evade (carga evasiva)
    if (isEvasivelyCharging(defender)) {
      // No hacer daño, pero defensor continúa su carga
      return {
        type: 'charge_evaded',
        message: `¡${defender.name} se evasionó!`,
        damage: 0,
        evasive: true
      };
    }
    
    // Paso 2: Calcular daño normal
    const damage = calculateDamage(move, attacker, defender);
    
    // Paso 3: Aplicar daño al defensor
    defender.hp = Math.max(0, defender.hp - damage);
    
    // Paso 4: Limpiar estado de carga del atacante
    attacker.isCharging = false;
    attacker.chargingMove = undefined;
    attacker.isEvadingCharge = false;
    attacker.tempDefenseBoost = undefined;
    
    // Paso 5: Retornar resultado
    return {
      type: 'charge_execute',
      message: `¡${move.name} de ${attacker.name} causó ${damage} de daño!`,
      damage: damage
    };
  }
}
```

### 7.2 Algoritmo: Verificar Evasión

```typescript
/**
 * Se llama en calculateDamage() ANTES de hacer cualquier cálculo
 */
function checkAttackEvasion(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): { evaded: boolean; message: string } {
  
  // Verificación 1: Defender en carga evasiva
  if (isEvasivelyCharging(defender)) {
    return {
      evaded: true,
      message: `¡${defender.name} se evasionó de ${move.name}!`
    };
  }
  
  // Verificación 2: [Futuro] Efecto de evasión (Double Team, etc.)
  // if (hasEvasionEffect(defender)) {
  //   return { evaded: true, message: '...' };
  // }
  
  return { evaded: false, message: '' };
}
```

### 7.3 Algoritmo: Determinar Acción Forzada

```typescript
/**
 * Lógica para determinar si un Pokémon debe tomar una acción forzada
 */
function determineNextAction(
  pokemon: PokemonInBattle,
  currentTurn: number
): PlayerActionRequired {
  
  // Verificación 1: ¿Debe ejecutar carga?
  if (isTwoTurnCharging(pokemon)) {
    return {
      forced: true,
      type: 'must-execute-charge',
      move: pokemon.chargingMove,
      message: `${pokemon.name} debe ejecutar ${pokemon.chargingMove?.name}!`
    };
  }
  
  // Verificación 2: ¿Está fatigado?
  if (pokemon.cannotActNextTurn) {
    return {
      forced: true,
      type: 'must-rest',
      message: `${pokemon.name} está demasiado fatigado para actuar!`
    };
  }
  
  // Sin restricciones
  return {
    forced: false,
    type: 'free-choice',
    message: ''
  };
}
```

---

## 8. Casos de Prueba

### 8.1 Tests para Detección de Movimientos

```typescript
describe('V3: Detección de Movimientos', () => {
  
  it('isMoveTwoTurn detecta Solar Beam', () => {
    const solarBeam = createMockMove('solar-beam', { charge: true, recharge: false });
    expect(isMoveTwoTurn(solarBeam)).toBe(true);
  });
  
  it('isMoveTwoTurn detecta Fly', () => {
    const fly = createMockMove('fly', { charge: true, recharge: false });
    expect(isMoveTwoTurn(fly)).toBe(true);
  });
  
  it('isMoveTwoTurn retorna false para Hyper Beam', () => {
    const hyperBeam = createMockMove('hyper-beam', { charge: false, recharge: true });
    expect(isMoveTwoTurn(hyperBeam)).toBe(false);
  });
  
  it('isMoveTwoTurn retorna false para movimientos normales', () => {
    const tackle = createMockMove('tackle', { charge: false, recharge: false });
    expect(isMoveTwoTurn(tackle)).toBe(false);
  });
  
  it('getTwoTurnMoveList retorna array correcto', () => {
    const list = getTwoTurnMoveList();
    expect(list).toContain('solar-beam');
    expect(list).toContain('fly');
    expect(list).toContain('dig');
    expect(list).not.toContain('hyper-beam');
  });
});
```

### 8.2 Tests para Fase de Carga

```typescript
describe('V3: Fase de Carga', () => {
  
  it('handleTwoTurnMove(Solar Beam, phase=charge) marca como cargando', () => {
    const attacker = createMockPokemon('Sunflora');
    const defender = createMockPokemon('Blastoise');
    const solarBeam = createMockMove('solar-beam');
    
    const result = handleTwoTurnMove(attacker, defender, solarBeam, 'charge');
    
    expect(attacker.isCharging).toBe(true);
    expect(attacker.chargingMove).toBe(solarBeam);
    expect(result.type).toBe('charge_start');
    expect(result.damage).toBe(0);
    expect(result.message).toContain('preparando energía');
  });
  
  it('handleTwoTurnMove(Fly, phase=charge) marca como evasivo', () => {
    const attacker = createMockPokemon('Dragonite');
    const defender = createMockPokemon('Pikachu');
    const fly = createMockMove('fly');
    
    const result = handleTwoTurnMove(attacker, defender, fly, 'charge');
    
    expect(attacker.isCharging).toBe(true);
    expect(attacker.isEvadingCharge).toBe(true);
    expect(result.type).toBe('charge_start');
    expect(result.message).toContain('volando');
  });
  
  it('handleTwoTurnMove(Skull Bash, phase=charge) aplica defensa temporal', () => {
    const attacker = createMockPokemon('Cloyster', { defense: 100 });
    const defender = createMockPokemon('Pikachu');
    const skullBash = createMockMove('skull-bash');
    
    const result = handleTwoTurnMove(attacker, defender, skullBash, 'charge');
    
    expect(attacker.tempDefenseBoost).toBe(1);
    expect(result.type).toBe('charge_start');
  });
  
  it('isTwoTurnCharging retorna true solo con isCharging Y chargingMove', () => {
    const pokemon = createMockPokemon('Pikachu');
    
    // Ambos false
    expect(isTwoTurnCharging(pokemon)).toBe(false);
    
    // Solo isCharging true
    pokemon.isCharging = true;
    expect(isTwoTurnCharging(pokemon)).toBe(false);
    
    // Ambos true
    pokemon.chargingMove = createMockMove('solar-beam');
    expect(isTwoTurnCharging(pokemon)).toBe(true);
  });
});
```

### 8.3 Tests para Fase de Ejecución

```typescript
describe('V3: Fase de Ejecución', () => {
  
  it('handleTwoTurnMove(Solar Beam, phase=execute) causa daño', () => {
    const attacker = createMockPokemon('Sunflora', {
      spAttack: 70,
      isCharging: true,
      chargingMove: createMockMove('solar-beam')
    });
    const defender = createMockPokemon('Blastoise', {
      spDefense: 80,
      hp: 100,
      maxHp: 100
    });
    const solarBeam = createMockMove('solar-beam', { power: 120 });
    
    const result = handleTwoTurnMove(attacker, defender, solarBeam, 'execute');
    
    expect(result.type).toBe('charge_execute');
    expect(result.damage).toBeGreaterThan(0);
    expect(attacker.isCharging).toBe(false);
    expect(attacker.chargingMove).toBeUndefined();
    expect(defender.hp).toBeLessThan(100);
  });
  
  it('handleTwoTurnMove limpia Skull Bash boost al ejecutar', () => {
    const attacker = createMockPokemon('Cloyster', {
      isCharging: true,
      chargingMove: createMockMove('skull-bash'),
      tempDefenseBoost: 1
    });
    const defender = createMockPokemon('Pikachu');
    const skullBash = createMockMove('skull-bash', { power: 100 });
    
    handleTwoTurnMove(attacker, defender, skullBash, 'execute');
    
    expect(attacker.tempDefenseBoost).toBeUndefined();
  });
});
```

### 8.4 Tests para Sistema de Evasión

```typescript
describe('V3: Sistema de Evasión', () => {
  
  it('Ataque a Pokémon en Fly es evasionado', () => {
    const defender = createMockPokemon('Dragonite', {
      isCharging: true,
      chargingMove: createMockMove('fly'),
      isEvadingCharge: true
    });
    const attacker = createMockPokemon('Pikachu');
    const tackle = createMockMove('tackle');
    
    const result = handleTwoTurnMove(attacker, defender, tackle, 'execute');
    
    expect(result.type).toBe('charge_evaded');
    expect(result.damage).toBe(0);
    expect(result.evasive).toBe(true);
  });
  
  it('isEvasivelyCharging retorna true solo para movimientos evasivos', () => {
    // Evasivo
    const flyPokemon = createMockPokemon('Dragonite', {
      isCharging: true,
      chargingMove: createMockMove('fly')
    });
    expect(isEvasivelyCharging(flyPokemon)).toBe(true);
    
    // No evasivo
    const solarPokemon = createMockPokemon('Sunflora', {
      isCharging: true,
      chargingMove: createMockMove('solar-beam')
    });
    expect(isEvasivelyCharging(solarPokemon)).toBe(false);
  });
  
  it('Ataque durante Solar Beam NO es evasionado', () => {
    const defender = createMockPokemon('Sunflora', {
      isCharging: true,
      chargingMove: createMockMove('solar-beam'),
      isEvadingCharge: false
    });
    const attacker = createMockPokemon('Blastoise');
    const surf = createMockMove('surf', { power: 90 });
    
    const result = handleTwoTurnMove(attacker, defender, surf, 'execute');
    
    expect(result.evasive).toBe(false);
    expect(result.damage).toBeGreaterThan(0);
  });
});
```

### 8.5 Tests para Fatiga (Hyper Beam)

```typescript
describe('V3: Sistema de Fatiga', () => {
  
  it('applyFatigue marca Pokémon como fatigado', () => {
    const pokemon = createMockPokemon('Pikachu');
    applyFatigue(pokemon, 5);
    
    expect(pokemon.cannotActNextTurn).toBe(true);
    expect(pokemon.fatigueStartTurn).toBe(5);
  });
  
  it('resetFatigueState limpia el estado de fatiga', () => {
    const pokemon = createMockPokemon('Pikachu', {
      cannotActNextTurn: true,
      fatigueStartTurn: 5
    });
    
    resetFatigueState(pokemon);
    
    expect(pokemon.cannotActNextTurn).toBe(false);
    expect(pokemon.fatigueStartTurn).toBeUndefined();
  });
  
  it('Hyper Beam aplicaFatiga después de atacar', () => {
    const attacker = createMockPokemon('Dragonite', { spAttack: 100 });
    const defender = createMockPokemon('Pikachu', { spDefense: 60, hp: 100 });
    const hyperBeam = createMockMove('hyper-beam');
    
    // Hyper Beam NO es movimiento de 2 turnos, se ejecuta inmediatamente
    const result = handleTwoTurnMove(attacker, defender, hyperBeam, 'execute');
    
    // Aquí necesitamos lógica especial para Hyper Beam
    // Ver sección 3.4 - es un caso especial
    expect(result.attackerFatigued).toBe(true);
  });
});
```

### 8.6 Tests de Integración: Flujo Completo

```typescript
describe('V3: Flujo Completo de Batalla', () => {
  
  it('Secuencia completa: Fly (carga) → evade ataque → ejecuta', () => {
    const turn1 = {
      player1: createMockPokemon('Dragonite'),
      player2: createMockPokemon('Pikachu')
    };
    
    // TURNO 1: Dragonite comienza Fly
    let result1 = handleTwoTurnMove(
      turn1.player1,
      turn1.player2,
      createMockMove('fly'),
      'charge'
    );
    expect(result1.type).toBe('charge_start');
    expect(turn1.player1.isCharging).toBe(true);
    
    // Pikachu intenta atacar
    let pikaResult = handleTwoTurnMove(
      turn1.player2,
      turn1.player1,
      createMockMove('thunderbolt'),
      'execute'
    );
    expect(pikaResult.type).toBe('charge_evaded');
    expect(pikaResult.damage).toBe(0);
    
    // TURNO 2: Dragonite ejecuta Fly
    let result2 = handleTwoTurnMove(
      turn1.player1,
      turn1.player2,
      createMockMove('fly'),
      'execute'
    );
    expect(result2.type).toBe('charge_execute');
    expect(result2.damage).toBeGreaterThan(0);
    expect(turn1.player1.isCharging).toBe(false);
  });
  
  it('Secuencia: Skull Bash (+1 Def) → ataque reducido → ejecuta con daño', () => {
    const pokemon = createMockPokemon('Cloyster', {
      defense: 100,
      attack: 95,
      hp: 100
    });
    const attacker = createMockPokemon('Machamp', {
      attack: 130,
      hp: 100
    });
    
    // TURNO 1: Carga con +1 Defense
    const chargeResult = handleTwoTurnMove(
      pokemon,
      attacker,
      createMockMove('skull-bash'),
      'charge'
    );
    
    expect(pokemon.tempDefenseBoost).toBe(1);
    
    // Attacker intenta atacar físico contra Cloyster
    // Daño debe ser reducido por +1 Defense
    const damageWithBoost = calculateDamage(
      createMockMove('earthquake', { power: 100, damageClass: 'physical' }),
      attacker,
      pokemon
    );
    
    // TURNO 2: Ejecuta Skull Bash
    const executeResult = handleTwoTurnMove(
      pokemon,
      attacker,
      createMockMove('skull-bash'),
      'execute'
    );
    
    expect(executeResult.damage).toBeGreaterThan(0);
    expect(pokemon.tempDefenseBoost).toBeUndefined();
  });
});
```

### 8.7 Tests para Edge Cases

```typescript
describe('V3: Edge Cases', () => {
  
  it('Cambiar Pokémon limpia estado de carga', () => {
    const battle = createMockBattle();
    const originalPokemon = battle.player1.activePokemon;
    
    // Comienza carga
    originalPokemon.isCharging = true;
    originalPokemon.chargingMove = createMockMove('solar-beam');
    
    // Cambia Pokémon
    const newPokemon = createMockPokemon('Alakazam');
    battle.player1.activePokemon = newPokemon;
    
    // El nuevo Pokémon NO está en carga
    expect(newPokemon.isCharging).toBe(false);
    expect(newPokemon.chargingMove).toBeUndefined();
  });
  
  it('Pokémon fatigado pasa turno incluso si selecciona movimiento', () => {
    const pokemon = createMockPokemon('Pikachu', {
      cannotActNextTurn: true
    });
    
    const forcedAction = getForcedAction(pokemon);
    expect(forcedAction.forced).toBe(true);
    expect(forcedAction.reason).toContain('fatigado');
  });
  
  it('Solar Beam en terreno lluvia sigue usando 120 power (V3)', () => {
    // En V3 NO hay effecto de terreno, se implementa en V4+
    const attacker = createMockPokemon('Sunflora');
    const defender = createMockPokemon('Blastoise');
    const solarBeam = createMockMove('solar-beam', { power: 120 });
    
    const result = handleTwoTurnMove(attacker, defender, solarBeam, 'execute');
    
    // Power siempre es 120 (no modificado por lluvia)
    expect(result.damage).toBeConsistent();
  });
});
```

---

## 9. Notas de Implementación

### 9.1 Integración con V2 (Estados)

- Los movimientos de 2 turnos pueden causar estado en la fase de ejecución
- Ej: Toxic Spikes + Dive = aplicar estado al ejecutar
- La lógica de `canActWithAilments()` se mantiene igual

### 9.2 Consideraciones de Frontend

**Durante Carga:**
- Mostrar mensaje: "{Pokémon} está {chargeMessage}"
- Si es evasivo: mostrar efecto visual de evasión
- Si Skull Bash: mostrar +1 Defense temporal

**Durante Ejecución:**
- Mostrar daño calculado
- Si evadido: "¡{Pokémon} se evasionó!"

**Durante Fatiga:**
- Mostrar en lugar del panel de selección: "{Pokémon} está demasiado fatigado para actuar!"
- Ofrecer opción "Pasar" (deshabilitada, solo visual)

### 9.3 Consideraciones de Rendimiento

- `isEvasivelyCharging()` se llama en cada cálculo de daño → optimizar
- Considerar usar flag `isEvadingCharge` en lugar de búsqueda de lista

### 9.4 Extensibilidad para V4+

- Los campos `tempDefenseBoost` y `chargeStatChanges` permiten futuros efectos
- El sistema de evasión puede extenderse a otros efectos (Double Team, etc.)
- La fatiga puede implementarse para otros movimientos (si se añaden en futuro)

---

## 10. Checklist de Implementación

### Core Funciones

- [ ] `isMoveTwoTurn(move: BattleMove): boolean`
- [ ] `isTwoTurnCharging(pokemon: PokemonInBattle): boolean`
- [ ] `getTwoTurnMoveList(): string[]`
- [ ] `handleTwoTurnMove(..., phase): MoveResult`
- [ ] `isEvasivelyCharging(pokemon): boolean`
- [ ] `applyFatigue(pokemon, currentTurn?): void`
- [ ] `resetFatigueState(pokemon): void`

### Integraciones en battleService

- [ ] `executeMove()` - manejar 2 turnos
- [ ] `calculateDamage()` - verificar evasión
- [ ] `executeTurn()` - resetear fatiga, verificar carga
- [ ] Lógica de selección de acción forzada

### Tests

- [ ] Detección de movimientos (7 tests)
- [ ] Fase de carga (4 tests)
- [ ] Fase de ejecución (2 tests)
- [ ] Sistema de evasión (3 tests)
- [ ] Sistema de fatiga (3 tests)
- [ ] Flujo completo (2 tests de integración)
- [ ] Edge cases (3 tests)

### Frontend (Wireframe/UI)

- [ ] Mostrar mensaje de carga
- [ ] Mostrar defensa temporal (Skull Bash)
- [ ] Mostrar evasión visual (Fly, Dig)
- [ ] Mostrar fatiga visual (Hyper Beam)
- [ ] Bloquear selección si está en carga
- [ ] Bloquear selección si está fatigado

---

## 11. Referencias

- **SPEC_BATALLA_V3.md** - Especificación inicial (secciones 6)
- **battle.ts** - Interfaces TypeScript actuales
- **battleService.ts** - Implementación de funciones de batalla
- **V2 Stats** - Sistema de efectos de estado (para integración)
- **V4 Planning** - Cambios de estadísticas (extensibilidad)

