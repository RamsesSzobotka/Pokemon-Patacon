# Desglose de Tareas - Implementación V3 (2 Turnos y Fatiga)

**Versión:** 1.0  
**Fecha de Creación:** 18 de Mayo de 2026  
**Estado:** Plan de Implementación  
**Esfuerzo Total Estimado:** 5 horas  

---

## 📊 Resumen Ejecutivo

Este documento detalla el desglose de tareas para implementar la Versión 3 del sistema de batalla de Pokémon Patacon. La V3 introduce:

- **Movimientos de 2 Turnos** (carga + ejecución): Solar Beam, Hyper Beam, Fly, Dig, etc.
- **Fatiga**: Se aplica después de ejecutar ciertos movimientos (debilita el siguiente ataque)
- **Evasión**: Los movimientos de carga pueden ser interrumpidos si el defensor usa movimiento evasivo

**Principios de Implementación:**
1. Cambios minimales a código existente (V1/V2)
2. Cada tarea es independiente y testeable
3. Backend primero, frontend después
4. Pruebas automatizadas en cada fase

---

## 🎯 Matriz de Fases

| Fase | Nombre | Duración | Bloqueador | Dependencia |
|------|--------|----------|-----------|------------|
| **1** | Type Definitions & Constants | 30 min | ⛔ Bloqueante | - |
| **2** | Helper Functions | 45 min | ⚠️ Requiere P1 | P1 |
| **3** | Core Two-Turn Logic | 1.5 h | ⚠️ Requiere P2 | P1, P2 |
| **4** | Battle Loop Integration | 45 min | ⚠️ Requiere P3 | P3 |
| **5** | Testing Suite | 1 h | ⚠️ Requiere P3-4 | P1-4 |
| **6** | Frontend Integration | 1 h | ✅ Independiente | P3-4 |

**Camino Crítico:** P1 → P2 → P3 → P4 → P5 (4.75 horas)  
**Parallelizable:** P6 puede iniciar después de P3 (no bloqueada)

---

# 📋 FASE 1: Type Definitions & Constants (30 min)

## Objetivo
Definir todas las estructuras de datos y constantes necesarias sin implementar lógica de negocio.

---

### Task 1.1: Update PokemonInBattle Interface con Campos V3

**Descripción:**  
Extender la interfaz `PokemonInBattle` en `types/battle.ts` para incluir campos relacionados con movimientos de 2 turnos y fatiga.

**Archivos Afectados:**
- `backend/src/types/battle.ts`

**Campos a Añadir:**
```typescript
export interface PokemonInBattle extends Pokemon {
  // ... campos existentes ...
  
  // V3: Movimientos de 2 Turnos
  isChargingTwoTurn: boolean;           // ¿Está en fase de carga?
  currentTwoTurnMove: BattleMove | null; // Move being charged/executing
  chargePhase: 'charge' | 'execute' | null; // Current phase in 2-turn sequence
  
  // V3: Fatiga
  isFatigued: boolean;                  // ¿Está fatigado?
  fatigueSource: 'recharge' | 'fatigue' | null; // Causa de la fatiga
  
  // V3: Evasión
  isEvasivelyCharging: boolean;         // ¿Está cargando movimiento evasivo?
  evasiveChargeMove: BattleMove | null; // Movimiento evasivo siendo cargado
}
```

**Acceptance Criteria:**
- ✅ Interfaz compila sin errores
- ✅ Todos los campos tienen tipo correcto
- ✅ Documentación JSDoc presente en cada campo
- ✅ Sin cambios a lógica existente

**Ejemplo de Código:**
```typescript
// Cómo se vería una instancia V3
const pikachu: PokemonInBattle = {
  // ... datos base ...
  isChargingTwoTurn: true,
  currentTwoTurnMove: solarBeamMove,
  chargePhase: 'charge',
  isFatigued: false,
  fatigueSource: null,
  isEvasivelyCharging: false,
  evasiveChargeMove: null,
};
```

**Test Cases:**
```
✓ Puede instanciarse PokemonInBattle con campos V3
✓ Los campos V3 inicializan como null/false
✓ El tipo compila con TypeScript strict mode
```

---

### Task 1.2: Create V3_MOVES Constant con Todos los Movimientos de 2 Turnos

**Descripción:**  
Crear una constante que mapee ID de movimiento → metadata V3 para identificar rápidamente movimientos de 2 turnos.

**Archivos Afectados:**
- `backend/src/services/constants/v3Moves.ts` (nuevo archivo)

**Estructura:**
```typescript
export interface V3MoveMetadata {
  moveId: number;
  name: string;
  isTwoTurn: boolean;
  chargeMessage: string;    // "Pikachu is charging Hyper Beam"
  executeMessage: string;   // "Pikachu uses Hyper Beam"
  hasRecharge?: boolean;    // Hyper Beam requiere recharge
  isFatigueable?: boolean;  // Se aplica fatiga (distinto de recharge)
}

export const V3_MOVES: Record<number, V3MoveMetadata> = {
  76: {  // Solar Beam
    moveId: 76,
    name: 'Solar Beam',
    isTwoTurn: true,
    chargeMessage: 'is absorbing solar energy',
    executeMessage: 'uses Solar Beam',
    isFatigueable: false,
  },
  63: {  // Hyper Beam
    moveId: 63,
    name: 'Hyper Beam',
    isTwoTurn: false,
    chargeMessage: '',
    executeMessage: 'uses Hyper Beam',
    hasRecharge: true,  // Requiere turno de recharge
  },
  // ... todos los movimientos de 2 turnos ...
};
```

**Movimientos a Incluir:**
- Solar Beam (76) - 2 turnos + fatiga
- Hyper Beam (63) - Recharge
- Sky Attack (143) - 2 turnos
- Dig (91) - 2 turnos  
- Fly (34) - 2 turnos
- Focus Punch (264) - 2 turnos
- Y otros identificados en el spec V3

**Acceptance Criteria:**
- ✅ Constante exportada y tipada
- ✅ Mínimo 12 movimientos incluidos
- ✅ Mensajes descriptivos en inglés o español (consistente)
- ✅ Sin movimientos duplicados

**Test Cases:**
```
✓ V3_MOVES contiene al menos 12 movimientos
✓ Solar Beam tiene isTwoTurn = true
✓ Hyper Beam tiene hasRecharge = true
✓ Todos los movimientos tienen ID único
```

---

### Task 1.3: Create EVASIVE_MOVES Constant

**Descripción:**  
Movimientos que pueden evadir ataques durante la fase de carga (Fly, Dig, Bounce, etc.).

**Archivos Afectados:**
- `backend/src/services/constants/v3Moves.ts` (actualizar)

**Estructura:**
```typescript
export interface EvasiveMoveMetadata {
  moveId: number;
  name: string;
  evasionType: 'full' | 'partial'; // 'full' = invulnerable, 'partial' = reduce damage
  chargeMessage: string;
  executeMessage: string;
  vulnerableTo: string[];  // Movimientos que pueden golpear durante carga
}

export const EVASIVE_MOVES: Record<number, EvasiveMoveMetadata> = {
  34: {  // Fly
    moveId: 34,
    name: 'Fly',
    evasionType: 'full',
    chargeMessage: 'is flying up',
    executeMessage: 'uses Fly',
    vulnerableTo: ['Thunder', 'Hurricane', 'Gust'],
  },
  91: {  // Dig
    moveId: 91,
    name: 'Dig',
    evasionType: 'full',
    chargeMessage: 'is digging underground',
    executeMessage: 'uses Dig',
    vulnerableTo: ['Earthquake'],
  },
  // ...
};
```

**Acceptance Criteria:**
- ✅ Mínimo 5 movimientos evasivos
- ✅ Incluye lista de movimientos que pueden interrumpir
- ✅ Estructura diferenciada de V3_MOVES

**Test Cases:**
```
✓ EVASIVE_MOVES contiene Fly, Dig, etc.
✓ Fly tiene evasionType = 'full'
✓ Fly.vulnerableTo incluye Thunder
```

---

### Task 1.4: Create FATIGUE_MOVES Constant

**Descripción:**  
Movimientos que aplican fatiga (debilitan el siguiente ataque) al Pokémon atacante.

**Archivos Afectados:**
- `backend/src/services/constants/v3Moves.ts` (actualizar)

**Estructura:**
```typescript
export interface FatigueMoveMetadata {
  moveId: number;
  name: string;
  fatigueStrength: 'mild' | 'strong';  // mild = 25% atk, strong = 50% atk
  fatigueType: 'recharge' | 'exhaustion';
  turnsToRecover: number;  // Cuántos turnos hasta que se recupera
}

export const FATIGUE_MOVES: Record<number, FatigueMoveMetadata> = {
  63: {  // Hyper Beam
    moveId: 63,
    name: 'Hyper Beam',
    fatigueStrength: 'strong',
    fatigueType: 'recharge',
    turnsToRecover: 1,  // Turno de recharge obligatorio
  },
  76: {  // Solar Beam
    moveId: 76,
    name: 'Solar Beam',
    fatigueStrength: 'mild',
    fatigueType: 'exhaustion',
    turnsToRecover: 1,
  },
  // ...
};
```

**Acceptance Criteria:**
- ✅ Distingue entre 'recharge' (obligatorio) y 'exhaustion' (fatiga)
- ✅ Define fuerza de fatiga
- ✅ Define turnos a recuperar

**Test Cases:**
```
✓ FATIGUE_MOVES contiene Hyper Beam
✓ Hyper Beam tiene fatigueType = 'recharge'
✓ Solar Beam tiene fatigueStrength = 'mild'
```

---

### Task 1.5: Update BattleMove Interface - Flags V3

**Descripción:**  
Actualizar la interfaz `BattleMove` con flags específicos de V3 para identificar movimientos de 2 turnos.

**Archivos Afectados:**
- `backend/src/types/battle.ts`

**Cambios:**
```typescript
export interface BattleMove {
  // ... campos existentes ...
  
  flags: {
    recharge: boolean;       // Requiere turno de recharge (Hyper Beam)
    charge: boolean;         // Es movimiento de 2 turnos
    protect: boolean;
    mirror: boolean;
    // V3 nuevos:
    evasive: boolean;        // Puede evadir ataques (Fly, Dig)
    interruptible: boolean;  // Puede ser interrumpido durante carga
    fatigue: boolean;        // Aplica fatiga al atacante
  };
}
```

**Acceptance Criteria:**
- ✅ Compila sin errores
- ✅ Documentación presente
- ✅ Compatible con código existente

**Test Cases:**
```
✓ BattleMove.flags incluye evasive, interruptible, fatigue
✓ Solar Beam tiene flags.charge = true
✓ Hyper Beam tiene flags.recharge = true
```

---

### Task 1.6: Create TEST_MOVES Constant para Testing

**Descripción:**  
Crear movimientos simulados para pruebas unitarias (no requieren data de BD).

**Archivos Afectados:**
- `backend/src/services/constants/testMoves.ts` (nuevo archivo)

**Estructura:**
```typescript
export const TEST_MOVES = {
  SOLAR_BEAM: {
    moveId: 999001,
    name: 'Test Solar Beam',
    type: 'grass',
    damageClass: 'special' as const,
    power: 120,
    accuracy: 100,
    priority: 0,
    pp: 10,
    maxPp: 10,
    meta: {
      ailment: null,
      ailmentChance: 0,
      statChanges: [],
      flinchChance: 0,
      heal: 0,
      minHits: null,
      maxHits: null,
      minTurns: 2,
      maxTurns: 2,
    },
    flags: {
      recharge: false,
      charge: true,
      protect: false,
      mirror: false,
      evasive: false,
      interruptible: true,
      fatigue: true,
    },
  },
  HYPER_BEAM: {
    // ... similar ...
    flags: {
      recharge: true,  // Diferencia clave
      // ...
    },
  },
  FLY: {
    // ... evasivo ...
    flags: {
      evasive: true,
      interruptible: true,
      // ...
    },
  },
  NORMAL_ATTACK: {
    // Sin flags V3
    flags: {
      recharge: false,
      charge: false,
      protect: false,
      mirror: false,
      evasive: false,
      interruptible: false,
      fatigue: false,
    },
  },
};
```

**Acceptance Criteria:**
- ✅ Mínimo 4 movimientos de prueba
- ✅ Cubre casos: 2-turn, recharge, evasive, normal
- ✅ Pueden ser usados en tests sin dependencia de BD

**Test Cases:**
```
✓ TEST_MOVES.SOLAR_BEAM.flags.charge = true
✓ TEST_MOVES.HYPER_BEAM.flags.recharge = true
✓ TEST_MOVES.FLY.flags.evasive = true
✓ TEST_MOVES.NORMAL_ATTACK no tiene flags V3
```

---

### Task 1.1-1.6 Resumen

| Task | Subtarea | Archivo | Líneas | Duración |
|------|----------|---------|--------|----------|
| 1.1 | PokemonInBattle interface | `types/battle.ts` | ~15 | 5 min |
| 1.2 | V3_MOVES constant | `constants/v3Moves.ts` | ~50 | 10 min |
| 1.3 | EVASIVE_MOVES constant | `constants/v3Moves.ts` | ~30 | 5 min |
| 1.4 | FATIGUE_MOVES constant | `constants/v3Moves.ts` | ~20 | 5 min |
| 1.5 | BattleMove flags | `types/battle.ts` | ~8 | 3 min |
| 1.6 | TEST_MOVES constant | `constants/testMoves.ts` | ~80 | 5 min |

**Duración Total Fase 1:** ~33 min

---

# 🛠️ FASE 2: Helper Functions (45 min)

## Objetivo
Implementar funciones de responsabilidad única que serán usadas por el core de lógica.

---

### Task 2.1: Implement isMoveTwoTurn(move: BattleMove): boolean

**Descripción:**  
Determina si un movimiento es de 2 turnos basándose en flags.

**Archivo:**
- `backend/src/services/battleHelpers.ts` (nuevo archivo)

**Implementación:**
```typescript
/**
 * Determina si un movimiento es de 2 turnos (carga + ejecución)
 * @param move - El movimiento a verificar
 * @returns true si es movimiento de 2 turnos
 */
export function isMoveTwoTurn(move: BattleMove | null): boolean {
  if (!move) return false;
  return move.flags.charge === true && !move.flags.recharge;
}
```

**Acceptance Criteria:**
- ✅ Retorna true para Solar Beam, Fly, Dig, etc.
- ✅ Retorna false para Hyper Beam (recharge, no 2-turn)
- ✅ Retorna false para ataques normales
- ✅ Maneja null/undefined sin crash

**Test Cases:**
```typescript
describe('isMoveTwoTurn', () => {
  test('returns true for Solar Beam', () => {
    expect(isMoveTwoTurn(TEST_MOVES.SOLAR_BEAM)).toBe(true);
  });
  
  test('returns false for Hyper Beam (recharge)', () => {
    expect(isMoveTwoTurn(TEST_MOVES.HYPER_BEAM)).toBe(false);
  });
  
  test('returns false for normal attacks', () => {
    expect(isMoveTwoTurn(TEST_MOVES.NORMAL_ATTACK)).toBe(false);
  });
  
  test('returns false for null', () => {
    expect(isMoveTwoTurn(null)).toBe(false);
  });
});
```

---

### Task 2.2: Implement getTwoTurnMoveList(): string[]

**Descripción:**  
Retorna lista de nombres de movimientos de 2 turnos desde constantes.

**Archivo:**
- `backend/src/services/battleHelpers.ts`

**Implementación:**
```typescript
/**
 * Obtiene lista de nombres de movimientos de 2 turnos
 * @returns Array de nombres de movimientos
 */
export function getTwoTurnMoveList(): string[] {
  return Object.values(V3_MOVES)
    .filter(meta => meta.isTwoTurn)
    .map(meta => meta.name);
}
```

**Acceptance Criteria:**
- ✅ Retorna mínimo 8 nombres
- ✅ Incluye Solar Beam, Fly, Dig, Sky Attack, Focus Punch
- ✅ No incluye movimientos normales
- ✅ No incluye Hyper Beam (tiene recharge, no 2-turn)

**Test Cases:**
```typescript
describe('getTwoTurnMoveList', () => {
  test('returns array of strings', () => {
    const list = getTwoTurnMoveList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.every(name => typeof name === 'string')).toBe(true);
  });
  
  test('includes Solar Beam', () => {
    expect(getTwoTurnMoveList()).toContain('Solar Beam');
  });
  
  test('does not include Hyper Beam', () => {
    expect(getTwoTurnMoveList()).not.toContain('Hyper Beam');
  });
  
  test('has at least 8 moves', () => {
    expect(getTwoTurnMoveList().length).toBeGreaterThanOrEqual(8);
  });
});
```

---

### Task 2.3: Implement isTwoTurnCharging(pokemon: PokemonInBattle): boolean

**Descripción:**  
Verifica si un Pokémon está actualmente en la fase de carga de un movimiento de 2 turnos.

**Archivo:**
- `backend/src/services/battleHelpers.ts`

**Implementación:**
```typescript
/**
 * Verifica si un Pokémon está cargando un movimiento de 2 turnos
 * @param pokemon - Pokémon a verificar
 * @returns true si está en fase de carga
 */
export function isTwoTurnCharging(pokemon: PokemonInBattle): boolean {
  return (
    pokemon.isChargingTwoTurn === true &&
    pokemon.chargePhase === 'charge' &&
    pokemon.currentTwoTurnMove !== null &&
    isMoveTwoTurn(pokemon.currentTwoTurnMove)
  );
}
```

**Acceptance Criteria:**
- ✅ Retorna true solo cuando TODOS los campos están presentes
- ✅ Retorna false si currentTwoTurnMove es null
- ✅ Retorna false si chargePhase no es 'charge'
- ✅ Retorna false si isChargingTwoTurn es false

**Test Cases:**
```typescript
describe('isTwoTurnCharging', () => {
  test('returns true when pokemon is charging', () => {
    const charging: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'charge',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    expect(isTwoTurnCharging(charging)).toBe(true);
  });
  
  test('returns false when chargePhase is execute', () => {
    const executing: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'execute',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    expect(isTwoTurnCharging(executing)).toBe(false);
  });
  
  test('returns false when currentTwoTurnMove is null', () => {
    const notCharging: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'charge',
      currentTwoTurnMove: null,
    };
    expect(isTwoTurnCharging(notCharging)).toBe(false);
  });
});
```

---

### Task 2.4: Implement isEvasivelyCharging(pokemon: PokemonInBattle): boolean

**Descripción:**  
Verifica si un Pokémon está cargando un movimiento evasivo (Fly, Dig, etc.).

**Archivo:**
- `backend/src/services/battleHelpers.ts`

**Implementación:**
```typescript
/**
 * Verifica si un Pokémon está cargando un movimiento evasivo
 * @param pokemon - Pokémon a verificar
 * @returns true si está cargando movimiento evasivo
 */
export function isEvasivelyCharging(pokemon: PokemonInBattle): boolean {
  if (!pokemon.isEvasivelyCharging || !pokemon.evasiveChargeMove) {
    return false;
  }
  
  return pokemon.evasiveChargeMove.flags.evasive === true;
}
```

**Acceptance Criteria:**
- ✅ Retorna true solo si isEvasivelyCharging y evasiveChargeMove presentes
- ✅ Verifica que evasiveChargeMove tenga flag evasive
- ✅ Retorna false si evasiveChargeMove es null

**Test Cases:**
```typescript
describe('isEvasivelyCharging', () => {
  test('returns true for evasive moves', () => {
    const evading: PokemonInBattle = {
      ...createBasePokemon(),
      isEvasivelyCharging: true,
      evasiveChargeMove: TEST_MOVES.FLY,
    };
    expect(isEvasivelyCharging(evading)).toBe(true);
  });
  
  test('returns false when not evasively charging', () => {
    const normal: PokemonInBattle = {
      ...createBasePokemon(),
      isEvasivelyCharging: false,
      evasiveChargeMove: null,
    };
    expect(isEvasivelyCharging(normal)).toBe(false);
  });
});
```

---

### Task 2.5: Implement canBeInterrupted(attacker: PokemonInBattle): boolean

**Descripción:**  
Verifica si un Pokémon que está cargando puede ser interrumpido por un movimiento evasivo.

**Archivo:**
- `backend/src/services/battleHelpers.ts`

**Lógica:**
- Si está cargando un movimiento de 2 turnos → puede ser interrumpido
- Si el movimiento tiene flag `interruptible: true` → puede ser interrumpido
- Sino → no puede ser interrumpido

**Implementación:**
```typescript
/**
 * Verifica si un Pokémon que está cargando puede ser interrumpido
 * @param attacker - Pokémon atacante
 * @returns true si puede ser interrumpido durante carga
 */
export function canBeInterrupted(attacker: PokemonInBattle): boolean {
  // Solo puede ser interrumpido si está en fase de carga
  if (!isTwoTurnCharging(attacker)) {
    return false;
  }
  
  // Verificar si el movimiento tiene la flag interruptible
  const move = attacker.currentTwoTurnMove;
  if (!move) return false;
  
  return move.flags.interruptible === true;
}
```

**Acceptance Criteria:**
- ✅ Retorna false si no está cargando
- ✅ Retorna false si fase no es 'charge'
- ✅ Retorna true si está cargando movimiento interruptible
- ✅ Retorna false si está en fase execute

**Test Cases:**
```typescript
describe('canBeInterrupted', () => {
  test('returns true for charging 2-turn move', () => {
    const charging: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'charge',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    expect(canBeInterrupted(charging)).toBe(true);
  });
  
  test('returns false when not charging', () => {
    const normal = createBasePokemon();
    expect(canBeInterrupted(normal)).toBe(false);
  });
  
  test('returns false when in execute phase', () => {
    const executing: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'execute',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    expect(canBeInterrupted(executing)).toBe(false);
  });
});
```

---

### Task 2.6: Implement applyFatigue(pokemon: PokemonInBattle): void

**Descripción:**  
Aplica estado de fatiga a un Pokémon después de ejecutar ciertos movimientos.

**Archivo:**
- `backend/src/services/battleHelpers.ts`

**Implementación:**
```typescript
/**
 * Aplica estado de fatiga a un Pokémon
 * @param pokemon - Pokémon afectado
 * @param fatigueType - Tipo de fatiga ('recharge' | 'exhaustion')
 */
export function applyFatigue(
  pokemon: PokemonInBattle,
  fatigueType: 'recharge' | 'exhaustion' = 'exhaustion'
): void {
  pokemon.isFatigued = true;
  pokemon.fatigueSource = fatigueType;
}
```

**Acceptance Criteria:**
- ✅ Marca pokemon.isFatigued = true
- ✅ Establece fatigueSource correctamente
- ✅ No modifica otros campos

**Test Cases:**
```typescript
describe('applyFatigue', () => {
  test('marks pokemon as fatigued', () => {
    const pokemon = createBasePokemon();
    applyFatigue(pokemon, 'exhaustion');
    expect(pokemon.isFatigued).toBe(true);
    expect(pokemon.fatigueSource).toBe('exhaustion');
  });
  
  test('distinguishes recharge from exhaustion', () => {
    const recharging = createBasePokemon();
    const exhausted = createBasePokemon();
    
    applyFatigue(recharging, 'recharge');
    applyFatigue(exhausted, 'exhaustion');
    
    expect(recharging.fatigueSource).toBe('recharge');
    expect(exhausted.fatigueSource).toBe('exhaustion');
  });
});
```

---

### Task 2.7: Implement resetFatigueState(pokemon: PokemonInBattle): void

**Descripción:**  
Limpia el estado de fatiga de un Pokémon al inicio del turno.

**Archivo:**
- `backend/src/services/battleHelpers.ts`

**Implementación:**
```typescript
/**
 * Limpia el estado de fatiga de un Pokémon
 * @param pokemon - Pokémon a resetear
 */
export function resetFatigueState(pokemon: PokemonInBattle): void {
  pokemon.isFatigued = false;
  pokemon.fatigueSource = null;
}
```

**Acceptance Criteria:**
- ✅ Establece isFatigued = false
- ✅ Establece fatigueSource = null
- ✅ No afecta otros campos

**Test Cases:**
```typescript
describe('resetFatigueState', () => {
  test('clears fatigue status', () => {
    const pokemon = createBasePokemon();
    pokemon.isFatigued = true;
    pokemon.fatigueSource = 'recharge';
    
    resetFatigueState(pokemon);
    
    expect(pokemon.isFatigued).toBe(false);
    expect(pokemon.fatigueSource).toBe(null);
  });
});
```

---

### Task 2.1-2.7 Resumen

| Task | Función | Archivo | Líneas | Duración |
|------|---------|---------|--------|----------|
| 2.1 | isMoveTwoTurn | `battleHelpers.ts` | ~8 | 5 min |
| 2.2 | getTwoTurnMoveList | `battleHelpers.ts` | ~6 | 5 min |
| 2.3 | isTwoTurnCharging | `battleHelpers.ts` | ~10 | 5 min |
| 2.4 | isEvasivelyCharging | `battleHelpers.ts` | ~10 | 5 min |
| 2.5 | canBeInterrupted | `battleHelpers.ts` | ~15 | 5 min |
| 2.6 | applyFatigue | `battleHelpers.ts` | ~8 | 5 min |
| 2.7 | resetFatigueState | `battleHelpers.ts` | ~6 | 5 min |

**Duración Total Fase 2:** ~40 min

---

# ⚙️ FASE 3: Core Two-Turn Logic (1.5 horas)

## Objetivo
Implementar la lógica principal de movimientos de 2 turnos y fatiga.

---

### Task 3.1: Implement getMovePhase(pokemon: PokemonInBattle): 'charge' | 'execute' | null

**Descripción:**  
Determina en qué fase está un Pokémon al usar un movimiento de 2 turnos.

**Archivo:**
- `backend/src/services/battleService.ts` (actualizar)

**Lógica:**
```
SI pokemon.isChargingTwoTurn ES true:
  SI pokemon.chargePhase === 'charge':
    RETORNA 'charge'
  SI pokemon.chargePhase === 'execute':
    RETORNA 'execute'
RETORNA null
```

**Implementación:**
```typescript
/**
 * Obtiene la fase actual de un movimiento de 2 turnos
 * @param pokemon - Pokémon a verificar
 * @returns 'charge', 'execute', o null
 */
export function getMovePhase(
  pokemon: PokemonInBattle
): 'charge' | 'execute' | null {
  if (!pokemon.isChargingTwoTurn || !pokemon.chargePhase) {
    return null;
  }
  
  return pokemon.chargePhase;
}
```

**Acceptance Criteria:**
- ✅ Retorna 'charge' en primera vuelta
- ✅ Retorna 'execute' en segunda vuelta
- ✅ Retorna null si no está en 2-turn
- ✅ Sin side effects

**Test Cases:**
```typescript
describe('getMovePhase', () => {
  test('returns charge for charging phase', () => {
    const pokemon: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'charge',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    expect(getMovePhase(pokemon)).toBe('charge');
  });
  
  test('returns execute for execute phase', () => {
    const pokemon: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'execute',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    expect(getMovePhase(pokemon)).toBe('execute');
  });
  
  test('returns null when not charging', () => {
    expect(getMovePhase(createBasePokemon())).toBe(null);
  });
});
```

---

### Task 3.2: Implement handleChargePhase(attacker, defender, move): MoveResult

**Descripción:**  
Gestiona la primera fase de un movimiento de 2 turnos (carga). El Pokémon atacante anuncia que está cargando pero no hace daño.

**Archivo:**
- `backend/src/services/battleService.ts` (nueva función)

**Interfaz de Resultado:**
```typescript
export interface MoveResult {
  success: boolean;
  message: string;
  damageDealt: number;
  statusApplied: string | null;
  chargeStarted?: boolean;
  phase?: 'charge' | 'execute';
  interruptedBy?: string;
}
```

**Lógica:**
```
1. Verificar si defensor usa movimiento evasivo
   SI es así: RETORNA interruption (attacker regresa a normal)
2. SINO: 
   - Marcar attacker.isChargingTwoTurn = true
   - Marcar attacker.chargePhase = 'charge'
   - Guardar attacker.currentTwoTurnMove = move
   - Retorna MoveResult con mensaje de carga
```

**Implementación:**
```typescript
/**
 * Gestiona la fase de carga de un movimiento de 2 turnos
 * @param attacker - Pokémon atacante
 * @param defender - Pokémon defensor
 * @param move - Movimiento de carga
 * @returns Resultado del turno
 */
export function handleChargePhase(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): MoveResult {
  // Verificar si puede ser interrumpido
  if (isEvasivelyCharging(defender)) {
    // Defensor está usando movimiento evasivo
    const evasiveMove = defender.evasiveChargeMove!;
    
    return {
      success: false,
      message: `${defender.name} is evading! ${attacker.name}'s ${move.name} was interrupted!`,
      damageDealt: 0,
      statusApplied: null,
      chargeStarted: false,
      interruptedBy: evasiveMove.name,
    };
  }
  
  // Iniciar carga
  attacker.isChargingTwoTurn = true;
  attacker.chargePhase = 'charge';
  attacker.currentTwoTurnMove = move;
  
  const chargeMessage = V3_MOVES[move.moveId]?.chargeMessage || 'is charging';
  
  return {
    success: true,
    message: `${attacker.name} ${chargeMessage}...`,
    damageDealt: 0,
    statusApplied: null,
    chargeStarted: true,
    phase: 'charge',
  };
}
```

**Acceptance Criteria:**
- ✅ Marca pokemon como en estado de carga
- ✅ Almacena el movimiento en currentTwoTurnMove
- ✅ No aplica daño
- ✅ Detecta interrupción por movimiento evasivo
- ✅ Genera mensaje descriptivo

**Test Cases:**
```typescript
describe('handleChargePhase', () => {
  test('starts charge phase', () => {
    const attacker = createBasePokemon();
    const defender = createBasePokemon();
    
    const result = handleChargePhase(attacker, defender, TEST_MOVES.SOLAR_BEAM);
    
    expect(result.chargeStarted).toBe(true);
    expect(attacker.isChargingTwoTurn).toBe(true);
    expect(attacker.chargePhase).toBe('charge');
    expect(attacker.currentTwoTurnMove).toBe(TEST_MOVES.SOLAR_BEAM);
    expect(result.damageDealt).toBe(0);
  });
  
  test('can be interrupted by evasive move', () => {
    const attacker = createBasePokemon();
    const defender: PokemonInBattle = {
      ...createBasePokemon(),
      isEvasivelyCharging: true,
      evasiveChargeMove: TEST_MOVES.FLY,
    };
    
    const result = handleChargePhase(attacker, defender, TEST_MOVES.SOLAR_BEAM);
    
    expect(result.chargeStarted).toBe(false);
    expect(result.interruptedBy).toBe('Fly');
    expect(attacker.isChargingTwoTurn).toBe(false);
  });
});
```

---

### Task 3.3: Implement handleExecutePhase(attacker, defender, move): MoveResult

**Descripción:**  
Gestiona la segunda fase (ejecución) de un movimiento de 2 turnos. El ataque se ejecuta ahora, se calcula daño, y se aplica fatiga si corresponde.

**Archivo:**
- `backend/src/services/battleService.ts`

**Lógica:**
```
1. Usar calculateDamage() existente para calcular daño base
2. SI el movimiento tiene flag fatigue:
   - Aplicar applyFatigue(attacker)
3. SI el movimiento tiene flag recharge:
   - Aplicar applyFatigue(attacker, 'recharge')
4. Limpiar estado de 2-turn del attacker:
   - isChargingTwoTurn = false
   - chargePhase = null
   - currentTwoTurnMove = null
5. Retorna MoveResult con daño y fatiga
```

**Implementación:**
```typescript
/**
 * Gestiona la fase de ejecución de un movimiento de 2 turnos
 * @param attacker - Pokémon atacante
 * @param defender - Pokémon defensor
 * @param move - Movimiento a ejecutar
 * @returns Resultado del turno
 */
export function handleExecutePhase(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): MoveResult {
  // Usar lógica de daño existente
  const damage = calculateDamage(attacker, defender, move);
  
  // Aplicar daño
  defender.currentHp = Math.max(0, defender.currentHp - damage);
  
  // Aplicar fatiga si corresponde
  if (move.flags.recharge) {
    applyFatigue(attacker, 'recharge');
  } else if (move.flags.fatigue) {
    applyFatigue(attacker, 'exhaustion');
  }
  
  // Limpiar estado de 2-turn
  attacker.isChargingTwoTurn = false;
  attacker.chargePhase = null;
  attacker.currentTwoTurnMove = null;
  
  const executeMessage = V3_MOVES[move.moveId]?.executeMessage || 'uses';
  
  return {
    success: true,
    message: `${attacker.name} ${executeMessage} ${move.name}! ${damage} damage!`,
    damageDealt: damage,
    statusApplied: null,
    phase: 'execute',
  };
}
```

**Acceptance Criteria:**
- ✅ Calcula y aplica daño
- ✅ Aplica fatiga si move.flags.recharge es true
- ✅ Limpia estado de 2-turn
- ✅ Retorna MoveResult con daño
- ✅ Reduce HP del defensor

**Test Cases:**
```typescript
describe('handleExecutePhase', () => {
  test('applies damage in execute phase', () => {
    const attacker = createBasePokemon({ attack: 100 });
    const defender = createBasePokemon({ currentHp: 100, defense: 50 });
    
    const result = handleExecutePhase(
      attacker,
      defender,
      TEST_MOVES.SOLAR_BEAM
    );
    
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(defender.currentHp).toBeLessThan(100);
    expect(result.phase).toBe('execute');
  });
  
  test('applies fatigue from move', () => {
    const attacker = createBasePokemon();
    const defender = createBasePokemon();
    
    handleExecutePhase(attacker, defender, TEST_MOVES.SOLAR_BEAM);
    
    expect(attacker.isFatigued).toBe(true);
    expect(attacker.fatigueSource).toBe('exhaustion');
  });
  
  test('applies recharge fatigue for Hyper Beam', () => {
    const attacker = createBasePokemon();
    const defender = createBasePokemon();
    
    handleExecutePhase(attacker, defender, TEST_MOVES.HYPER_BEAM);
    
    expect(attacker.isFatigued).toBe(true);
    expect(attacker.fatigueSource).toBe('recharge');
  });
  
  test('clears 2-turn state after execution', () => {
    const attacker: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'execute',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    const defender = createBasePokemon();
    
    handleExecutePhase(attacker, defender, TEST_MOVES.SOLAR_BEAM);
    
    expect(attacker.isChargingTwoTurn).toBe(false);
    expect(attacker.chargePhase).toBe(null);
    expect(attacker.currentTwoTurnMove).toBe(null);
  });
});
```

---

### Task 3.4: Implement Evasion Check en Damage Calculation

**Descripción:**  
Actualizar la función `calculateDamage` existente para verificar si el defensor está en estado evasivo (cargando Fly, Dig, etc.) y reducir daño o evitar completamente.

**Archivo:**
- `backend/src/services/battleService.ts` (modificar `calculateDamage`)

**Lógica:**
```
EN calculateDamage():
  SI isEvasivelyCharging(defender):
    SI defender.evasiveChargeMove.flags.evasive === 'full':
      RETORNA 0 (daño completamente evitado)
    SI defender.evasiveChargeMove.flags.evasive === 'partial':
      RETORNA damage * 0.5 (daño reducido a la mitad)
  SINO:
    CONTINUAR con lógica de daño normal
```

**Cambio a calculateDamage:**
```typescript
export function calculateDamage(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): number {
  // Verificar evasión
  if (isEvasivelyCharging(defender)) {
    const evasiveMove = defender.evasiveChargeMove!;
    
    if (
      evasiveMove.flags.evasive &&
      EVASIVE_MOVES[evasiveMove.moveId]?.evasionType === 'full'
    ) {
      // Daño completamente evitado
      return 0;
    }
    
    if (
      evasiveMove.flags.evasive &&
      EVASIVE_MOVES[evasiveMove.moveId]?.evasionType === 'partial'
    ) {
      // Daño reducido
      const baseDamage = calculateBaseDamage(attacker, defender, move);
      return Math.floor(baseDamage * 0.5);
    }
  }
  
  // Lógica de daño normal existente
  return calculateBaseDamage(attacker, defender, move);
}
```

**Acceptance Criteria:**
- ✅ Retorna 0 si Pokémon evasivo con 'full' evasion
- ✅ Retorna 50% daño si Pokémon evasivo con 'partial' evasion
- ✅ Sin cambios si no está evadiendo
- ✅ Compatible con código existente

**Test Cases:**
```typescript
describe('calculateDamage with evasion', () => {
  test('returns 0 for full evasion', () => {
    const attacker = createBasePokemon({ attack: 100 });
    const defender: PokemonInBattle = {
      ...createBasePokemon({ defense: 50 }),
      isEvasivelyCharging: true,
      evasiveChargeMove: TEST_MOVES.FLY,
    };
    
    // FLY tiene evasionType: 'full'
    const damage = calculateDamage(attacker, defender, TEST_MOVES.NORMAL_ATTACK);
    
    expect(damage).toBe(0);
  });
  
  test('returns reduced damage for normal target', () => {
    const attacker = createBasePokemon({ attack: 100 });
    const defender = createBasePokemon({ defense: 50 });
    
    const damage = calculateDamage(attacker, defender, TEST_MOVES.NORMAL_ATTACK);
    
    expect(damage).toBeGreaterThan(0);
  });
});
```

---

### Task 3.5: Modify executeMove() para Llamar a handleTwoTurnMove()

**Descripción:**  
Actualizar la función principal `executeMove()` para integrar la lógica de 2 turnos.

**Archivo:**
- `backend/src/services/battleService.ts` (actualizar `executeMove`)

**Lógica:**
```
EN executeMove(attacker, defender, move):
  SI isMoveTwoTurn(move):
    SI isTwoTurnCharging(attacker):
      RETORNA handleExecutePhase(attacker, defender, move)
    SINO:
      RETORNA handleChargePhase(attacker, defender, move)
  SINO SI move.flags.recharge:
    SI attacker.isFatigued Y attacker.fatigueSource === 'recharge':
      RETORNA {success: false, message: "recharging..."}
    SINO:
      HACER ataque normal
      applyFatigue(attacker, 'recharge')
  SINO:
    HACER ataque normal
```

**Cambio a executeMove:**
```typescript
export function executeMove(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): MoveResult {
  // Verificar si es movimiento de 2 turnos
  if (isMoveTwoTurn(move)) {
    if (isTwoTurnCharging(attacker)) {
      // Ya está en fase de carga → ejecutar ahora
      return handleExecutePhase(attacker, defender, move);
    } else {
      // Iniciar fase de carga
      return handleChargePhase(attacker, defender, move);
    }
  }
  
  // Movimientos con recharge (Hyper Beam)
  if (move.flags.recharge) {
    // Si está fatigado por recharge → no puede atacar
    if (
      attacker.isFatigued &&
      attacker.fatigueSource === 'recharge'
    ) {
      return {
        success: false,
        message: `${attacker.name} is recharging...`,
        damageDealt: 0,
        statusApplied: null,
      };
    }
    
    // Ejecutar ataque y aplicar fatiga
    const damage = calculateDamage(attacker, defender, move);
    defender.currentHp = Math.max(0, defender.currentHp - damage);
    applyFatigue(attacker, 'recharge');
    
    return {
      success: true,
      message: `${attacker.name} uses ${move.name}! ${damage} damage!`,
      damageDealt: damage,
      statusApplied: null,
    };
  }
  
  // Ataques normales
  const damage = calculateDamage(attacker, defender, move);
  defender.currentHp = Math.max(0, defender.currentHp - damage);
  
  return {
    success: true,
    message: `${attacker.name} uses ${move.name}! ${damage} damage!`,
    damageDealt: damage,
    statusApplied: null,
  };
}
```

**Acceptance Criteria:**
- ✅ Detecta movimientos de 2 turnos automáticamente
- ✅ Alterna entre charge/execute
- ✅ Bloquea ataques si está en recharge
- ✅ Compatible con ataques normales
- ✅ Sin breaking changes

**Test Cases:**
```typescript
describe('executeMove with V3', () => {
  test('starts charge phase for 2-turn moves', () => {
    const attacker = createBasePokemon();
    const defender = createBasePokemon();
    
    const result = executeMove(attacker, defender, TEST_MOVES.SOLAR_BEAM);
    
    expect(result.chargeStarted).toBe(true);
    expect(attacker.isChargingTwoTurn).toBe(true);
  });
  
  test('executes after charge phase', () => {
    const attacker: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'charge',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    const defender = createBasePokemon();
    
    const result = executeMove(attacker, defender, TEST_MOVES.SOLAR_BEAM);
    
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.phase).toBe('execute');
  });
  
  test('blocks recharge-fatigued pokemon', () => {
    const attacker: PokemonInBattle = {
      ...createBasePokemon(),
      isFatigued: true,
      fatigueSource: 'recharge',
    };
    const defender = createBasePokemon();
    
    const result = executeMove(attacker, defender, TEST_MOVES.HYPER_BEAM);
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('recharging');
  });
});
```

---

### Task 3.6: Integrate Fatigue Check en executeMove()

**Descripción:**  
Verificar y gestionar el estado de fatiga al inicio de cada turno de combate.

**Archivo:**
- `backend/src/services/battleService.ts` (nueva lógica en `processTurn`)

**Lógica:**
```
EN processTurn():
  AL INICIO (ambos jugadores):
    SI pokemon.isFatigued:
      SI pokemon.fatigueSource === 'recharge':
        // No puede atacar este turno
        pokemon.forcedAction = 'recharge'
      SI pokemon.fatigueSource === 'exhaustion':
        // Reducir poder de ataque en 25-50%
        // (se aplica en calculateDamage)
    
    AL FIN DEL TURNO:
      resetFatigueState(pokemon) // Limpia fatiga
```

**Pseudo-implementación:**
```typescript
export function processTurnStart(
  player1: PokemonInBattle,
  player2: PokemonInBattle
): void {
  // Verificar fatiga de player 1
  if (player1.isFatigued && player1.fatigueSource === 'recharge') {
    // Force player 1 to use recharge-only move or forced wait
    player1.forcedAction = 'recharge';
  }
  
  // Verificar fatiga de player 2
  if (player2.isFatigued && player2.fatigueSource === 'recharge') {
    player2.forcedAction = 'recharge';
  }
}

export function processTurnEnd(
  player1: PokemonInBattle,
  player2: PokemonInBattle
): void {
  // Limpiar fatiga después de turno
  resetFatigueState(player1);
  resetFatigueState(player2);
}
```

**Acceptance Criteria:**
- ✅ Detecta fatiga al inicio del turno
- ✅ Bloquea acciones si fatigueSource === 'recharge'
- ✅ Limpia fatiga al final del turno
- ✅ Log de estado de fatiga en WebSocket

**Test Cases:**
```typescript
describe('Fatigue state management', () => {
  test('detects recharge fatigue at turn start', () => {
    const pokemon: PokemonInBattle = {
      ...createBasePokemon(),
      isFatigued: true,
      fatigueSource: 'recharge',
    };
    
    processTurnStart(pokemon, createBasePokemon());
    
    expect(pokemon.forcedAction).toBe('recharge');
  });
  
  test('clears fatigue at turn end', () => {
    const pokemon: PokemonInBattle = {
      ...createBasePokemon(),
      isFatigued: true,
      fatigueSource: 'exhaustion',
    };
    
    processTurnEnd(pokemon, createBasePokemon());
    
    expect(pokemon.isFatigued).toBe(false);
    expect(pokemon.fatigueSource).toBe(null);
  });
});
```

---

### Task 3.1-3.6 Resumen

| Task | Función | Archivo | Líneas | Duración |
|------|---------|---------|--------|----------|
| 3.1 | getMovePhase | `battleService.ts` | ~12 | 10 min |
| 3.2 | handleChargePhase | `battleService.ts` | ~30 | 15 min |
| 3.3 | handleExecutePhase | `battleService.ts` | ~35 | 15 min |
| 3.4 | evasion check | `battleService.ts` | ~20 | 15 min |
| 3.5 | executeMove update | `battleService.ts` | ~40 | 20 min |
| 3.6 | fatigue check | `battleService.ts` | ~30 | 10 min |

**Duración Total Fase 3:** ~85 min

---

# 🔗 FASE 4: Battle Loop Integration (45 min)

## Objetivo
Integrar la lógica V3 con el sistema de batalla existente.

---

### Task 4.1: Ensure canActWithAilments() Works con Fatigue State

**Descripción:**  
Actualizar la función que determina si un Pokémon puede actuar, para que incluya check de fatiga.

**Archivo:**
- `backend/src/services/battleService.ts` (actualizar `canActWithAilments`)

**Lógica:**
```
SI pokemon.isFatigued Y pokemon.fatigueSource === 'recharge':
  RETORNA false (no puede actuar)
SINO:
  CONTINUAR con checks de ailments existentes
```

**Cambio:**
```typescript
export function canActWithAilments(pokemon: PokemonInBattle): boolean {
  // V3: Verificar fatiga de recharge
  if (
    pokemon.isFatigued &&
    pokemon.fatigueSource === 'recharge'
  ) {
    return false;
  }
  
  // Checks existentes de ailments (sleep, paralysis, etc.)
  if (pokemon.ailments && pokemon.ailments.length > 0) {
    const sleepAilment = pokemon.ailments.find(a => a.type === 'sleep');
    if (sleepAilment) return false;
    
    const paralysisAilment = pokemon.ailments.find(a => a.type === 'paralysis');
    if (paralysisAilment && Math.random() < 0.25) return false;
  }
  
  return true;
}
```

**Acceptance Criteria:**
- ✅ Retorna false si recharge fatigue
- ✅ Mantiene compatibilidad con ailments V2
- ✅ Sin side effects
- ✅ Tests pasan

**Test Cases:**
```typescript
describe('canActWithAilments with V3', () => {
  test('returns false for recharge fatigue', () => {
    const pokemon: PokemonInBattle = {
      ...createBasePokemon(),
      isFatigued: true,
      fatigueSource: 'recharge',
    };
    
    expect(canActWithAilments(pokemon)).toBe(false);
  });
  
  test('returns true for exhaustion fatigue', () => {
    const pokemon: PokemonInBattle = {
      ...createBasePokemon(),
      isFatigued: true,
      fatigueSource: 'exhaustion',
    };
    
    expect(canActWithAilments(pokemon)).toBe(true);
  });
});
```

---

### Task 4.2: Add Fatigue Reset at Turn Start en battleHandler.ts

**Descripción:**  
Actualizar `battleHandler.ts` para resetear el estado de carga y fatiga al inicio de cada turno.

**Archivo:**
- `backend/src/websocket/battleHandler.ts`

**Ubicación:**
```typescript
// En función que procesa inicio de turno, típicamente en proceseTurn o handleTurn
export async function processTurn(...) {
  // ... código existente ...
  
  // V3: Reset fatigue at turn start
  processTurnStart(battle.player1Pokemon, battle.player2Pokemon);
  
  // ... procesamiento de acciones ...
  
  // V3: Clear fatigue at turn end
  processTurnEnd(battle.player1Pokemon, battle.player2Pokemon);
  
  // ... emitir eventos WebSocket ...
}
```

**Acceptance Criteria:**
- ✅ Fatiga se resetea entre turnos
- ✅ Carga de 2-turn persiste correctamente
- ✅ Se emite estado actualizado en WebSocket
- ✅ Tests integración pasan

**Test Cases:**
```typescript
describe('Battle Handler - Fatigue Reset', () => {
  test('resets fatigue between turns', async () => {
    // Setup batalla
    // Después de turn 1: aplicar fatiga
    // Antes de turn 2: verificar que se resetea
  });
});
```

---

### Task 4.3: Ensure Change Pokemon Clears Charging State

**Descripción:**  
Si un Pokémon está cargando un movimiento de 2 turnos y el jugador lo cambia, debe limpiar el estado de carga.

**Archivo:**
- `backend/src/websocket/battleHandler.ts` (actualizar función de cambio)

**Lógica:**
```
EN changePokemon():
  currentPokemon = null
  newPokemon = selectedPokemon
  
  SI currentPokemon.isChargingTwoTurn:
    currentPokemon.isChargingTwoTurn = false
    currentPokemon.chargePhase = null
    currentPokemon.currentTwoTurnMove = null
  
  newPokemon entra a batalla
```

**Pseudo-código:**
```typescript
export function changePokemon(
  battle: Battle,
  player: Player,
  newPokemonId: number
): MoveResult {
  const oldPokemon = player.currentPokemon;
  
  // Limpiar estado de carga si estaba cargando
  if (oldPokemon && oldPokemon.isChargingTwoTurn) {
    oldPokemon.isChargingTwoTurn = false;
    oldPokemon.chargePhase = null;
    oldPokemon.currentTwoTurnMove = null;
  }
  
  // Cambiar Pokémon
  const newPokemon = player.team.find(p => p.id === newPokemonId);
  if (!newPokemon) {
    return {
      success: false,
      message: 'Pokemon not found',
      damageDealt: 0,
      statusApplied: null,
    };
  }
  
  player.currentPokemon = newPokemon;
  
  return {
    success: true,
    message: `${player.name} sent out ${newPokemon.name}!`,
    damageDealt: 0,
    statusApplied: null,
  };
}
```

**Acceptance Criteria:**
- ✅ Estado de carga limpiado al cambiar Pokémon
- ✅ Nuevo Pokémon entra sin estado V3
- ✅ Compatible con prioridad de cambio
- ✅ Tests pasan

**Test Cases:**
```typescript
describe('Change Pokemon with V3', () => {
  test('clears charging state when switching', () => {
    const charging: PokemonInBattle = {
      ...createBasePokemon(),
      isChargingTwoTurn: true,
      chargePhase: 'charge',
      currentTwoTurnMove: TEST_MOVES.SOLAR_BEAM,
    };
    
    changePokemon(charging, 'pikachu');
    
    expect(charging.isChargingTwoTurn).toBe(false);
    expect(charging.chargePhase).toBe(null);
  });
});
```

---

### Task 4.4: Add V3 State to WebSocket Messages

**Descripción:**  
Actualizar los mensajes de WebSocket para incluir información de estado V3 (charging, fatigue).

**Archivo:**
- `backend/src/websocket/battleHandler.ts`

**Estructura de Mensaje:**
```typescript
interface BattleStateMessage {
  // ... campos existentes ...
  
  player1: {
    pokemon: {
      // ... datos existentes ...
      v3State: {
        isChargingTwoTurn: boolean;
        chargePhase: 'charge' | 'execute' | null;
        currentTwoTurnMoveName: string | null;
        isFatigued: boolean;
        fatigueSource: 'recharge' | 'exhaustion' | null;
        isEvasivelyCharging: boolean;
        evasiveChargeMoveName: string | null;
      };
    };
  };
  player2: { /* ... */ };
}
```

**Pseudo-código:**
```typescript
export function createBattleStateMessage(battle: Battle): BattleStateMessage {
  return {
    // ... campos existentes ...
    player1: {
      pokemon: {
        // ... datos existentes ...
        v3State: {
          isChargingTwoTurn: battle.player1Pokemon.isChargingTwoTurn,
          chargePhase: battle.player1Pokemon.chargePhase,
          currentTwoTurnMoveName: battle.player1Pokemon.currentTwoTurnMove?.name || null,
          isFatigued: battle.player1Pokemon.isFatigued,
          fatigueSource: battle.player1Pokemon.fatigueSource,
          isEvasivelyCharging: battle.player1Pokemon.isEvasivelyCharging,
          evasiveChargeMoveName: battle.player1Pokemon.evasiveChargeMove?.name || null,
        },
      },
    },
    // ... similar para player2 ...
  };
}
```

**Acceptance Criteria:**
- ✅ Mensajes incluyen v3State
- ✅ Frontend recibe estado actualizado
- ✅ Compatible con V1/V2
- ✅ No rompe clients existentes

**Test Cases:**
```typescript
describe('WebSocket V3 Messages', () => {
  test('includes v3State in battle message', () => {
    const message = createBattleStateMessage(testBattle);
    
    expect(message.player1.pokemon.v3State).toBeDefined();
    expect(message.player1.pokemon.v3State.isChargingTwoTurn).toBe(false);
    expect(message.player1.pokemon.v3State.isFatigued).toBe(false);
  });
});
```

---

### Task 4.1-4.4 Resumen

| Task | Descripción | Archivo | Duración |
|------|-------------|---------|----------|
| 4.1 | canActWithAilments update | `battleService.ts` | 10 min |
| 4.2 | processTurn integration | `battleHandler.ts` | 10 min |
| 4.3 | changePokemon cleanup | `battleHandler.ts` | 10 min |
| 4.4 | WebSocket messages | `battleHandler.ts` | 15 min |

**Duración Total Fase 4:** ~45 min

---

# 🧪 FASE 5: Testing Suite (1 hora)

## Objetivo
Implementar suite de tests automatizadas para verificar toda la funcionalidad V3.

---

### Task 5.1: Create testV3Basic.ts con 27 Test Cases

**Descripción:**  
Tests unitarios para todos los helpers y funciones de core.

**Archivo:**
- `backend/scripts/testV3Basic.ts` (nuevo archivo)

**Estructura:**
```typescript
// Test Suite: Helper Functions (7 tests)
describe('V3 Helper Functions', () => {
  test('isMoveTwoTurn recognizes 2-turn moves', () => {});
  test('isMoveTwoTurn rejects single-turn moves', () => {});
  test('isTwoTurnCharging detects charging state', () => {});
  test('isEvasivelyCharging detects evasive state', () => {});
  test('canBeInterrupted detects interruptible moves', () => {});
  test('applyFatigue marks pokemon fatigued', () => {});
  test('resetFatigueState clears fatigue', () => {});
});

// Test Suite: Charge Phase (7 tests)
describe('Charge Phase Logic', () => {
  test('handleChargePhase starts charging', () => {});
  test('handleChargePhase prevents action from fatigued', () => {});
  test('handleChargePhase can be interrupted by evasion', () => {});
  test('charge message is descriptive', () => {});
  test('defender evasive move starts own charge', () => {});
  test('charging pokemon cannot act next turn', () => {});
  test('charging state persists until execute', () => {});
});

// Test Suite: Execute Phase (7 tests)
describe('Execute Phase Logic', () => {
  test('handleExecutePhase applies damage', () => {});
  test('handleExecutePhase applies fatigue', () => {});
  test('handleExecutePhase clears charging state', () => {});
  test('execute message is descriptive', () => {});
  test('recharge moves apply correct fatigue type', () => {});
  test('exhaustion moves reduce next attack', () => {});
  test('execute phase KOs defender correctly', () => {});
});

// Test Suite: Evasion (6 tests)
describe('Evasion Mechanics', () => {
  test('evasive moves avoid full damage', () => {});
  test('vulnerable-to moves bypass evasion', () => {});
  test('evasion only works during charge phase', () => {});
  test('multiple evasive moves in same battle', () => {});
  test('evasion message is shown', () => {});
  test('KO during evasion still works', () => {});
});
```

**Test Cases Detallados:**

```typescript
// 27 casos de test

// === HELPERS (7) ===
✓ isMoveTwoTurn returns true for Solar Beam
✓ isMoveTwoTurn returns false for Hyper Beam
✓ isTwoTurnCharging detects charge phase
✓ isEvasivelyCharging detects evasive moves
✓ canBeInterrupted allows interruption in charge
✓ applyFatigue marks pokemon fatigued
✓ resetFatigueState clears state

// === CHARGE (7) ===
✓ handleChargePhase marks as charging
✓ handleChargePhase stores current move
✓ handleChargePhase prevented by evasion
✓ handleChargePhase message is accurate
✓ Multiple pokemon can charge simultaneously
✓ Charge state persists to next turn
✓ Can't change Pokemon while charging (state clears)

// === EXECUTE (7) ===
✓ handleExecutePhase applies calculated damage
✓ handleExecutePhase applies fatigue from move
✓ handleExecutePhase clears 2-turn fields
✓ Recharge moves apply recharge fatigue
✓ Normal 2-turn moves apply exhaustion fatigue
✓ Execute doesn't repeat if called twice
✓ KO happens if damage >= remaining HP

// === EVASION (6) ===
✓ Full evasion reduces damage to 0
✓ Partial evasion reduces to 50%
✓ Evasion only works during charging
✓ No evasion during execute phase
✓ Vulnerable moves bypass evasion
✓ Evasion messages are shown
```

**Acceptance Criteria:**
- ✅ 27 tests todos pasan
- ✅ Coverage >= 90% para V3 code
- ✅ No warnings o errors en console
- ✅ Puede ejecutarse con `bun run scripts/testV3Basic.ts`

---

### Task 5.2: Create testV3Integration.ts - Full Battle Scenarios

**Descripción:**  
Tests de integración con escenarios de batalla completos.

**Archivo:**
- `backend/scripts/testV3Integration.ts` (nuevo archivo)

**Escenarios:**
```typescript
describe('V3 Integration: Full Battle Scenarios', () => {
  // Scenario 1: Basic 2-turn move
  test('Scenario 1: Solar Beam full cycle', async () => {
    // Turn 1: Pikachu uses Solar Beam (charge)
    // Turn 2: Pikachu uses Solar Beam (execute + damage)
    // Verify: Damage > 0, Pikachu fatigued
  });
  
  // Scenario 2: Interruption
  test('Scenario 2: Evasion interrupts charging', async () => {
    // Turn 1: Pikachu uses Solar Beam
    // Turn 1b: Dragonite uses Fly (evasive)
    // Verify: Pikachu's Solar Beam interrupted, Dragonite charging Fly
  });
  
  // Scenario 3: Both charging
  test('Scenario 3: Both pokemon charging simultaneously', async () => {
    // Turn 1: P1 uses Solar Beam, P2 uses Dig
    // Turn 2: Both execute
    // Verify: Both take damage, both fatigued
  });
  
  // Scenario 4: Recharge blocking
  test('Scenario 4: Recharge prevents next action', async () => {
    // Turn 1: Use Hyper Beam
    // Turn 2: Try to attack (blocked by recharge)
    // Turn 3: Can attack again
  });
  
  // Scenario 5: Fatigue recovery
  test('Scenario 5: Fatigue clears after turn', async () => {
    // Turn 1: Use Solar Beam
    // Turn 2: Execute (now fatigued)
    // Turn 3: Fatigue should be cleared
  });
  
  // Scenario 6: Pokemon switch clears state
  test('Scenario 6: Switch clears charging', async () => {
    // Turn 1: Pikachu uses Solar Beam
    // Turn 1b: Switch to Dragonite
    // Verify: Pikachu's charging state cleared
  });
  
  // Scenario 7: Multiple 2-turn cycles
  test('Scenario 7: Multiple 2-turn cycles in battle', async () => {
    // Turn 1-2: Solar Beam cycle
    // Turn 3-4: Hyper Beam cycle
    // Turn 5-6: Fly cycle (evasive)
    // Verify: All mechanics work correctly
  });
  
  // Scenario 8: KO during execution
  test('Scenario 8: KO during 2-turn execute', async () => {
    // Setup: Defender at low HP
    // Turn 1: Attacker charges
    // Turn 2: Attacker executes with enough damage to KO
    // Verify: Battle ends, attacker still gets KO credit
  });
});
```

**Test Structure:**
```typescript
async function runBattleScenario(
  p1Move: string,
  p2Move: string,
  turns: number
): Promise<BattleResult> {
  // Create test battle
  // Execute turns
  // Return result state
}

describe('V3 Integration Scenarios', () => {
  test('Scenario 1: Solar Beam cycle', async () => {
    const result = await runBattleScenario(
      'Solar Beam',
      'Tackle',
      2
    );
    
    expect(result.turn).toBe(2);
    expect(result.player1.currentPokemon.isFatigued).toBe(true);
    expect(result.damageHistory[1]).toBeGreaterThan(0);
  });
});
```

**Acceptance Criteria:**
- ✅ 8 escenarios completos probados
- ✅ Todos los escenarios pasan
- ✅ Battle state es consistente
- ✅ Mensajes son legibles

---

### Task 5.3: Manual Testing Checklist en UI

**Descripción:**  
Documento con pasos para testing manual en la interfaz frontend.

**Archivo:**
- `docs/MANUAL_TESTING_V3.md` (nuevo archivo)

**Contenido:**
```markdown
# Manual Testing Checklist - V3 Battle System

## Prerequisite Setup
- [ ] Backend running: `bun run dev`
- [ ] Frontend running: `npm run dev`
- [ ] Logged in to test account
- [ ] Two teams ready with V3 moves (Solar Beam, Hyper Beam, Fly, Dig, etc.)

## Test Case 1: Basic 2-Turn Move
- [ ] Start battle
- [ ] Select Solar Beam
- [ ] Turn 1: See "Pikachu is absorbing solar energy..."
- [ ] Turn 2: See "Pikachu uses Solar Beam! X damage!"
- [ ] Verify: Attacker marked as fatigued

## Test Case 2: Evasion Interruption
- [ ] Start battle
- [ ] P1: Select Solar Beam
- [ ] P2: Select Fly
- [ ] Turn 1: See interrupt message
- [ ] Verify: P1's Solar Beam interrupted, P2 charging Fly

## Test Case 3: Recharge Blocking
- [ ] Use Hyper Beam
- [ ] Turn 1: See "Using Hyper Beam! X damage!"
- [ ] Turn 2: Can't attack (recharge message)
- [ ] Turn 3: Can attack normally

## Test Case 4: Pokemon Switch
- [ ] In middle of 2-turn move
- [ ] Switch Pokemon
- [ ] Verify: Charging state cleared

## Test Case 5: Visual Indicators
- [ ] [ ] Charging phase shows "cargando..." or spinner
- [ ] [ ] Executing phase shows attack animation
- [ ] [ ] Fatigue shows red outline or icon
- [ ] [ ] Messages appear in battle log

## Expected Behaviors
✓ Charging turns take 2 game turns total
✓ Evasion interrupts mid-charge
✓ Fatigue resets at turn boundary
✓ Pokemon switch clears state
✓ UI shows all state changes
```

**Acceptance Criteria:**
- ✅ 5+ test cases documentados
- ✅ Pasos claros y verificables
- ✅ Screenshots/videos de referencia (opcional)
- ✅ Puede ejecutarse manualmente en 15 minutos

---

### Task 5.1-5.3 Resumen

| Task | Descripción | Archivo | Duración |
|------|-------------|---------|----------|
| 5.1 | 27 unit tests | `testV3Basic.ts` | 25 min |
| 5.2 | 8 integration tests | `testV3Integration.ts` | 25 min |
| 5.3 | Manual testing | `MANUAL_TESTING_V3.md` | 10 min |

**Duración Total Fase 5:** ~60 min

---

# 🎨 FASE 6: Frontend Integration (1 hora)

## Objetivo
Actualizar UI para mostrar estados V3.

---

### Task 6.1: Update UI para Mostrar "cargando..." vs "atacando" Phases

**Descripción:**  
Mostrar estado actual del movimiento de 2 turnos en el UI durante batalla.

**Archivo:**
- `frontend/src/components/battle/Battle.tsx`

**Cambios:**
```typescript
// En el componente Battle.tsx
const getMoveStatus = (pokemon: PokemonInBattle): string => {
  if (pokemon.v3State?.isChargingTwoTurn) {
    if (pokemon.v3State.chargePhase === 'charge') {
      return `🔄 Cargando ${pokemon.v3State.currentTwoTurnMoveName}...`;
    } else if (pokemon.v3State.chargePhase === 'execute') {
      return `⚡ Ejecutando ${pokemon.v3State.currentTwoTurnMoveName}!`;
    }
  }
  
  if (pokemon.v3State?.isFatigued) {
    return `😵 Fatigado (${pokemon.v3State.fatigueSource})`;
  }
  
  return 'Listo';
};

// En render
<div className="move-status">
  {getMoveStatus(currentPokemon)}
</div>
```

**Acceptance Criteria:**
- ✅ Muestra "Cargando X..." durante fase 1
- ✅ Muestra "Ejecutando X!" durante fase 2
- ✅ Muestra fatiga con tipo (recharge/exhaustion)
- ✅ Actualiza en tiempo real via WebSocket

**Test Cases:**
```
✓ Shows "Cargando Solar Beam..." in charge phase
✓ Shows "Ejecutando Solar Beam!" in execute phase
✓ Shows "Fatigado (recharge)" for Hyper Beam
✓ Updates immediately on state change
```

---

### Task 6.2: Add Visual Indicator para Charging State

**Descripción:**  
Añadir animación visual o ícono que indique que Pokémon está cargando.

**Archivo:**
- `frontend/src/components/battle/Battle.css` (nuevo/actualizar)

**CSS:**
```css
.pokemon-charging {
  animation: pulse-yellow 0.6s infinite;
  border: 3px solid #FFD700;
  box-shadow: 0 0 20px #FFD700;
}

.pokemon-fatigued {
  animation: fade-red 0.8s infinite;
  opacity: 0.7;
  filter: grayscale(30%);
}

.pokemon-executing {
  animation: shake 0.3s infinite;
}

@keyframes pulse-yellow {
  0%, 100% {
    box-shadow: 0 0 10px #FFD700;
  }
  50% {
    box-shadow: 0 0 30px #FFD700;
  }
}

@keyframes fade-red {
  0%, 100% {
    opacity: 1;
    filter: brightness(1) grayscale(30%);
  }
  50% {
    opacity: 0.6;
    filter: brightness(0.8) grayscale(60%);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

**Uso en Componente:**
```typescript
<div className={`pokemon ${
  pokemon.v3State?.isChargingTwoTurn ? 'pokemon-charging' : ''
} ${
  pokemon.v3State?.isFatigued ? 'pokemon-fatigued' : ''
} ${
  pokemon.v3State?.chargePhase === 'execute' ? 'pokemon-executing' : ''
}`}>
  {/* Pokemon sprite/info */}
</div>
```

**Acceptance Criteria:**
- ✅ Charging = borde amarillo + animación pulse
- ✅ Fatigued = efecto rojo + opacidad
- ✅ Executing = animación shake
- ✅ Animaciones smooth 60fps

---

### Task 6.3: Show Fatigue State en Pokemon Sprite

**Descripción:**  
Mostrar ícono o badge de fatiga sobre el sprite del Pokémon.

**Archivo:**
- `frontend/src/components/battle/Battle.tsx` (actualizar)

**Componente:**
```typescript
const FatigueIndicator: React.FC<{ pokemon: PokemonInBattle }> = ({ pokemon }) => {
  if (!pokemon.v3State?.isFatigued) return null;
  
  const icon = pokemon.v3State.fatigueSource === 'recharge' ? '🔴' : '🟡';
  const label = pokemon.v3State.fatigueSource === 'recharge' ? 'Recharge' : 'Exhausted';
  
  return (
    <div className="fatigue-badge" title={label}>
      {icon}
    </div>
  );
};

// En render:
<FatigueIndicator pokemon={currentPokemon} />
```

**CSS:**
```css
.fatigue-badge {
  position: absolute;
  top: -10px;
  right: -10px;
  font-size: 24px;
  animation: float 2s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
```

**Acceptance Criteria:**
- ✅ Badge aparece solo si fatigado
- ✅ Distingue recharge (rojo) vs exhaustion (amarillo)
- ✅ Desaparece cuando fatiga se limpia
- ✅ Tooltip muestra tipo de fatiga

---

### Task 6.4: Add Messages para Evasion

**Descripción:**  
Mostrar mensaje en battle log cuando ocurre evasión o interrupción.

**Archivo:**
- `frontend/src/components/battle/Battle.tsx` (actualizar log)

**Ejemplo de Mensajes:**
```typescript
const V3_MESSAGES = {
  CHARGING: (pokemonName: string, moveName: string) =>
    `${pokemonName} is charging ${moveName}...`,
  
  EXECUTING: (pokemonName: string, moveName: string, damage: number) =>
    `${pokemonName} uses ${moveName}! Deals ${damage} damage!`,
  
  FATIGUED: (pokemonName: string) =>
    `${pokemonName} is exhausted and can't move!`,
  
  EVASION_INTERRUPT: (defenderName: string, evasiveMove: string, attackerName: string, move: string) =>
    `${defenderName} is ${evasiveMove}! ${attackerName}'s ${move} was interrupted!`,
  
  RECHARGE: (pokemonName: string) =>
    `${pokemonName} is recharging energy...`,
};
```

**Uso:**
```typescript
const addBattleMessage = (message: string, type: 'action' | 'damage' | 'status' | 'v3') => {
  setBattleLog(prev => [...prev, { message, type, timestamp: Date.now() }]);
};

// En WebSocket handler:
if (event.type === 'v3_charge') {
  addBattleMessage(
    V3_MESSAGES.CHARGING(pokemon.name, move.name),
    'v3'
  );
}
```

**CSS:**
```css
.battle-log {
  /* ... existing ... */
}

.log-message.v3 {
  color: #FFD700;
  font-weight: bold;
  text-shadow: 0 0 5px #FFD700;
}
```

**Acceptance Criteria:**
- ✅ Mensajes aparecen para todos eventos V3
- ✅ Mensajes clear y descriptivos
- ✅ Timestamps correctos
- ✅ Se pueden eliminar después de tiempo

---

### Task 6.1-6.4 Resumen

| Task | Descripción | Archivo | Duración |
|------|-------------|---------|----------|
| 6.1 | Move status display | `Battle.tsx` | 15 min |
| 6.2 | Charging visual indicator | `Battle.css` | 15 min |
| 6.3 | Fatigue badge | `Battle.tsx` | 15 min |
| 6.4 | Evasion messages | `Battle.tsx` | 15 min |

**Duración Total Fase 6:** ~60 min

---

# 📊 Dependency Matrix

```
Phase 1 (Types)
    ↓
Phase 2 (Helpers) → Phase 3 (Core Logic)
                         ↓
                    Phase 4 (Integration)
                         ↓
                    Phase 5 (Tests)
                    
Phase 6 (Frontend) — can start after Phase 3
```

**Critical Path:** P1 → P2 → P3 → P4 → P5 (4.75 hours)

---

# ⏱️ Timeline Overview

```
Total Duration: ~5 hours

Phase 1 ════════════════════════════════════════════════ 30 min (10%)
Phase 2 ══════════════════════════════════════════════════════ 45 min (15%)
Phase 3 ════════════════════════════════════════════════════════════════════════════════════ 90 min (30%)
Phase 4 ══════════════════════════════════════════════ 45 min (15%)
Phase 5 ═════════════════════════════════════════════════ 60 min (20%)
Phase 6 ═════════════════════════════════════════════════ 60 min (20%) [parallel with 3-4]
```

**Fastest Path (sequential):**
- Start Phase 1
- When P1 done: Start P2
- When P2 done: Start P3
- When P3 done: Start P4
- When P4 done: Start P5 + P6 in parallel
- Total: ~5 hours

---

# ✅ Acceptance Criteria Summary

## Global Criteria
- ✅ Todos los tests pasan (unit + integration + manual)
- ✅ Backward compatible con V1/V2
- ✅ TypeScript strict mode sin errores
- ✅ WebSocket messages incluyen V3 state
- ✅ UI muestra todos los estados V3

## Por Fase
- **P1:** 6 archivos/interfaces actualizados sin errores
- **P2:** 7 helpers con 100% coverage
- **P3:** 6 funciones core con 90%+ coverage
- **P4:** Integración con 4 puntos de contacto
- **P5:** 27 unit tests + 8 integration tests + manual checklist
- **P6:** UI actualizada y responsive

---

# 🚀 Kickoff Checklist

Before starting implementation:

- [ ] Este documento leído y entendido
- [ ] Spec V3 (`SPEC_BATALLA_V3.md`) disponible para referencia
- [ ] Ambiente dev configurado (backend + frontend corriendo)
- [ ] Branch creada: `feature/v3-2turns-fatigue`
- [ ] Issues creadas en tracker (1 por task si es posible)
- [ ] Team alerta de cambios incoming

---

# 📝 Notes & Gotchas

## Importante
1. **Backward Compatibility:** Todos los Pokémon y movimientos deben funcionar sin cambios. V3 solo afecta a movimientos específicos.
2. **State Cleanup:** Es CRÍTICO limpiar el estado de carga cuando:
   - Pokémon cambia
   - Turno termina
   - Batalla termina
3. **Fatigue vs Recharge:** Son diferentes:
   - `recharge` = Turn de espera obligatorio después de Hyper Beam
   - `exhaustion` = Reducción de poder del próximo ataque (no bloquea acción)

## Debugging Tips
- Usa logs en `handleChargePhase` y `handleExecutePhase`
- Verifica `pokemon.v3State` en WebSocket messages
- Simula interrupciones con `test-evasion-interrupt` move

## Performance
- Helpers son O(1) → sin preocupación
- No hay N+1 queries en V3 lógica
- WebSocket messages no crecen significativamente

---

# 📚 Reference Files

Must-read before implementation:
1. `docs/Battle/SPEC_BATALLA_V3.md` - Especificación completa
2. `backend/src/types/battle.ts` - Tipos existentes
3. `backend/src/services/battleService.ts` - Service principal
4. `backend/src/websocket/battleHandler.ts` - WebSocket handler
5. `frontend/src/components/battle/Battle.tsx` - UI principal

---

**Document Version:** 1.0  
**Last Updated:** 18 de Mayo de 2026  
**Next Review:** Después de completar Fase 1

