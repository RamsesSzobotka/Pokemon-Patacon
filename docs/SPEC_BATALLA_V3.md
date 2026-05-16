# Especificación del Sistema de Batalla - Pokémon Patacon

**Versión:** 3.0
**Fecha:** 16 de Mayo de 2026
**Estado:** Listo para Implementación (Por Versiones)
**Prioridad:** Alta - Core del juego

---

## 📋 Resumen de Versiones

| Versión | Nombre | Contenido | Estado |
|---------|--------|-----------|--------|
| **V1** | Solo Daño | Core de batalla con TODOS los movimientos. Si no hacen daño, mostrar "No hizo efecto" | 🔄 Implementar |
| **V2** | Estados | Añadir efectos de estado (burn, poison, paralysis, sleep, freeze, confusion, flinch) | ⏳ Pendiente |
| **V3** | 2 Turnos | Movimientos de carga (Solar Beam, Hyper Beam, Fly, etc.) y fatiga | ⏳ Pendiente |
| **V4** | Estadísticas | Cambios de stats (buffs/debuffs), movimientos de solo stats | ⏳ Pendiente |

**Principio:** Todos los movimientos son seleccionables desde el inicio, pero su funcionalidad mejora con cada versión.

---

## 1. Visión General de la Batalla

La batalla de Pokémon Patacon es un sistema de turnos 1v1 donde dos jugadores compiten hasta que uno pierde todos sus Pokémon (HP = 0).

**Regla principal:** NO se usa la estadística de velocidad. El orden de ataque se determina por:
1. **Prioridad** de movimientos (movimientos de alta prioridad van primero)
2. **Cambio de Pokémon** (siempre tiene prioridad +6)
3. **Coinflip** (50/50) solo cuando ninguno o ambos tienen prioridad

---

## 2. Flujo Completo de la Batalla

```
┌─────────────────────────────────────────────────────────────┐
│              TURNO N                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 1: SELECCIÓN DE ACCIONES                            │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  Ambos jugadores seleccionan acción simultáneamente:       │
│  - Atacar (seleccionar movimiento del movepool)            │
│  - Cambiar Pokémon                                         │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 2: DETERMINAR ORDEN                                 │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ¿Algún movimiento tiene prioridad?                  │    │
│  │  ¿Alguien cambió de Pokémon?                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CASO A: Un jugador usa prioridad, el otro NO       │    │
│  │  → El que tiene prioridad ATACA PRIMERO             │    │
│  └─────────────────────────────────────────────────────┘    │
│                         ↓                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CASO B: Ambos usan prioridad O ambos NO             │    │
│  │  → COINFLIP (50/50)                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 3: EJECUTAR ACCIONES                                 │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  JUGADOR PRIMERO (por prioridad o coinflip):               │
│    1. Verificar si puede actuar (versiones futuras)       │
│    2. Ejecutar acción (ataque o cambio)                    │
│    3. Calcular y aplicar daño (V1: solo daño)              │
│    4. Verificar KO                                         │
│    5. Registrar efectos para próximo turno (V2+)          │
│                                                             │
│  JUGADOR SEGUNDO:                                           │
│    (Misma secuencia que Jugador 1)                        │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 4: EFECTOS FINALES DEL TURNO                         │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  1. Verificar KO por daño de ataques                       │
│  2. V2+: Aplicar daño de estados (burn, poison)            │
│  3. V2+: Decrementar turnos de estados                     │
│  4. V2+: Eliminar estados resueltos                       │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 5: PREPARAR SIGUIENTE TURNO                         │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  - Verificar si algún Pokémon cambió de Pokémon            │
│  - Si cambió: nuevo Pokémon entra                          │
│  - Si no hay ganador → Siguiente Turno (N+1)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
        ↓
BATALLA TERMINADA (equipo rival sin Pokémon con HP > 0)
        ↓
SALA CON STATUS "FINISHED"
```

---

## 3. Sistema de Prioridad

### 3.1 ¿Qué tiene Prioridad?

| Acción | Prioridad | Notas |
|--------|-----------|-------|
| **Cambiar Pokémon** | +6 | Siempre ataca primero |
| **Movimiento con prioridad** | +1 a +5 | Según `priority` del movimiento |
| **Movimiento normal** | 0 | Sin prioridad |
| **Movimiento con prioridad negativa** | -1 a -7 | Siempre ataca último |

### 3.2 Lógica de Determinación de Orden

```typescript
/**
 * Determina el orden de ejecución de las acciones
 * REGLA: Prioridad > Coinflip (solo cuando hay empate)
 */
function determinarOrdenAcciones(
  accion1: AccionJugador,
  accion2: AccionJugador
): { primero: 'player1' | 'player2'; reason: string } {

  const prioridad1 = getPrioridadAccion(accion1);
  const prioridad2 = getPrioridadAccion(accion2);

  // CASO A: Prioridades diferentes → el de mayor prioridad va primero
  if (prioridad1 !== prioridad2) {
    if (prioridad1 > prioridad2) {
      return { primero: 'player1', reason: 'mayor prioridad' };
    } else {
      return { primero: 'player2', reason: 'mayor prioridad' };
    }
  }

  // CASO B: Misma prioridad → COINFLIP (50/50)
  return {
    primero: Math.random() < 0.5 ? 'player1' : 'player2',
    reason: 'coinflip (misma prioridad)'
  };
}

function getPrioridadAccion(accion: AccionJugador): number {
  // Cambiar Pokémon siempre tiene prioridad +6
  if (accion.tipo === 'cambiar') {
    return 6;
  }

  // Movimiento: usar su priority
  if (accion.tipo === 'atacar' && accion.movimiento) {
    return accion.movimiento.priority || 0;
  }

  return 0;
}
```

---

## 4. VERSIÓN 1: Solo Daño (IMPLEMENTAR)

### 4.1 Objetivo

Tener un motor de batalla funcional donde:
- Todos los movimientos son seleccionables
- Solo se calcula daño (power > 0)
- Si power es 0 o null → mostrar "No hizo efecto" y continuar

### 4.2 Cálculo de Daño

```
Daño = (((2 * Nivel / 5 + 2) * Poder * (Ataque / Defensa) / 50) + 2) * STAB * Tipo * Aleatorio

Donde:
- Nivel: 50 (fijo para batallas)
- Poder: power del movimiento
- Ataque: attack o sp_attack según damage_class
- Defensa: defense o sp_defense según damage_class
- STAB: 1.5 si mismo tipo, 1.0 si diferente
- Tipo: effectiveness (0.5, 1.0, 2.0, 0.0)
- Aleatorio: 0.85 a 1.00
```

### 4.3 Movimiento Sin Daño

```typescript
function ejecutarMovimiento(
  movimiento: Move,
  atacante: PokemonBatalla,
  defensor: PokemonBatalla
): ResultadoMovimiento {
  
  // Verificar si el movimiento hace daño
  const tieneDaño = movimiento.power && movimiento.power > 0;
  const esTipoDaño = ['physical', 'special'].includes(movimiento.damage_class);

  if (!tieneDaño || !esTipoDaño) {
    // V1: Solo mostrar mensaje, no hacer nada más
    return {
      tipo: 'sin_efecto',
      mensaje: `¡${movimiento.names?.es || movimiento.name} no hizo efecto!`,
      dano: 0
    };
  }

  // Calcular daño normalmente
  const dano = calcularDaño(movimiento, atacante, defensor);
  
  // Aplicar daño
  return {
    tipo: 'damage',
    mensaje: `¡${movimiento.names?.es || movimiento.name} causó ${dano} de daño!`,
    dano: dano
  };
}
```

### 4.4 Flujo de Ejecución V1

```
TURNO N - VERSIÓN 1:

1. Ambos jugadores seleccionan movimiento
2. Determinar orden por prioridad (o coinflip)
3. Ejecutar movimiento del jugador 1:
   a. Obtener movimiento de la DB
   b. Verificar power > 0 y damage_class (physical/special)
   c. Si no tiene daño → "No hizo efecto", continuar
   d. Si tiene daño → calcular y aplicar
   e. Verificar KO
4. Ejecutar movimiento del jugador 2:
   (misma lógica)
5. Fin del turno → verificar KO general
6. Si no hay ganador → siguiente turno
```

### 4.5 Checklist V1

- [ ] Estructura de datos del estado de batalla
- [ ] Sistema de selección de acciones (ambos jugadores)
- [ ] Sistema de prioridad (+6 cambio, priority movimientos)
- [ ] Función coinflip() para desempates
- [ ] Sistema de ejecución de acciones en orden
- [ ] Cálculo de daño (fórmula completa)
- [ ] Manejo de movimientos sin daño ("No hizo efecto")
- [ ] Verificación de KO
- [ ] Cambio de Pokémon con prioridad +6
- [ ] Fin de batalla
- [ ] UI de batalla (sprites, HP, panel)

---

## 5. VERSIÓN 2: Estados (PENDIENTE)

### 5.1 Objetivo

Añadir efectos de estado que se aplican al usar ciertos movimientos:
- Si el movimiento tiene damage + estado → hacer daño Y aplicar estado
- Estados con damage por turno se aplican al final del turno

### 5.2 Clasificación de Estados

| Estado | Tipo | Cuándo Aplica | Comportamiento |
|--------|------|----------------|-----------------|
| **BURN** | Daño + Reducción | Inmediato (al atacar) | -10% HP/turno + 50% poder físico |
| **POISON** | Daño por turno | Final del turno | -10% HP/turno |
| **TOXIC** | Daño acumulativo | Final del turno | -10%, -20%, -30%... (aumenta) |
| **PARALYSIS** | Estado | Inmediato | 25% de no actuar |
| **SLEEP** | Estado | Inmediato | No puede actuar (3 turnos) |
| **FREEZE** | Estado | Inmediato | No puede actuar (hasta descongelar) |
| **CONFUSION** | Estado | Inmediato | 33% de autolesión |
| **FLINCH** | Estado | Después del ataque | No puede actuar siguiente turno |

### 5.3 Implementación de Estados

```typescript
interface EstadoActivo {
  tipo: 'burn' | 'poison' | 'toxic' | 'paralysis' | 'sleep' | 'freeze' | 'confusion' | 'flinch';
  turnosRestantes: number;
  aplicadoPor: string; // sessionId del oponente
}

interface PokemonBatalla {
  // ... campos existentes
  estados: EstadoActivo[];
  siguienteTurnoFlinch: boolean;
}

// Al ejecutar un movimiento con estado
function ejecutarMovimientoConEstado(
  movimiento: Move,
  atacante: PokemonBatalla,
  defensor: PokemonBatalla
): ResultadoMovimiento {
  // 1. Calcular y aplicar daño
  const dano = calcularDaño(movimiento, atacante, defensor);
  
  // 2. Aplicar estado si tiene
  if (movimiento.meta?.ailment && movimiento.meta.ailment_chance > 0) {
    const aplicar = Math.random() * 100 < movimiento.meta.ailment_chance;
    if (aplicar) {
      const estado: EstadoActivo = {
        tipo: movimiento.meta.ailment,
        turnosRestantes: getTurnosEstado(movimiento.meta.ailment),
        aplicadoPor: atacante.sessionId
      };
      // Agregar estado (si no tiene otro incompatible)
      agregarEstado(defensor, estado);
    }
  }
  
  return { dano, estadoAplicado: true };
}

function getTurnosEstado(tipo: string): number {
  switch (tipo) {
    case 'sleep': return 3;
    case 'freeze': return -1; // Hasta descongelar
    case 'confusion': return 4;
    default: return 3;
  }
}
```

### 5.4 Verificar si Puede Actuar (V2)

```typescript
function puedeActuar(pokemon: PokemonBatalla): { puede: boolean; razon: string } {
  for (const estado of pokemon.estados) {
    switch (estado.tipo) {
      case 'paralysis':
        if (Math.random() * 100 < 25) {
          return { puede: false, razon: '¡Paralizado! No puede moverse' };
        }
        break;
      case 'sleep':
        if (estado.turnosRestantes > 0) {
          return { puede: false, razon: '¡Dormido! No puede moverse' };
        }
        break;
      case 'freeze':
        return { puede: false, razon: '¡Congelado! No puede moverse' };
      case 'confusion':
        if (Math.random() * 100 < 33) {
          return { puede: true, razon: '¡Confuso! Se atacó a sí mismo', autolesion: true };
        }
        break;
    }
  }

  // Verificar flinch del turno anterior
  if (pokemon.siguienteTurnoFlinch) {
    pokemon.siguienteTurnoFlinch = false;
    return { puede: false, razon: '¡Retrocedió! No puede moverse' };
  }

  return { puede: true, razon: '' };
}
```

### 5.5 Efectos al Final del Turno (V2)

```typescript
function efectosFinalTurno(jugador: JugadorBatalla) {
  const pokemon = jugador.pokemonActivo;

  for (const estado of pokemon.estados) {
    switch (estado.tipo) {
      case 'burn':
      case 'poison':
        // -10% HP
        const dano = Math.floor(pokemon.maxHp * 0.10);
        pokemon.hp = Math.max(0, pokemon.hp - dano);
        break;
      case 'toxic':
        // Daño acumulativo: 10% + (10% * turnos toxic)
        const danoToxic = Math.floor(pokemon.maxHp * (0.10 + (estado.turnosRestantes - 1) * 0.10));
        pokemon.hp = Math.max(0, pokemon.hp - danoToxic);
        break;
    }
  }

  // Decrementar turnos
  pokemon.estados = pokemon.estados.map(e => ({
    ...e,
    turnosRestantes: e.turnosRestantes > 0 ? e.turnosRestantes - 1 : e.turnosRestantes
  }));

  // Eliminar estados terminados
  pokemon.estados = pokemon.estados.filter(e => 
    e.turnosRestantes !== 0 && e.tipos !== 'freeze' // freeze se maneja diferente
  );
}
```

### 5.6 Checklist V2

- [ ] Estructura para estados activos en PokemonBatalla
- [ ] Aplicar estado al atacar (con probabilidad)
- [ ] Verificar si puede actuar al inicio del turno
- [ ] Confusion → autolesión 33%
- [ ] Paralysis → 25% no actuar
- [ ] Sleep → no puede actuar 3 turnos
- [ ] Freeze → no puede actuar
- [ ] Flinch → no siguiente turno
- [ ] Daño por turno (burn, poison, toxic)
- [ ] Decrementar turnos de estados
- [ ] Eliminar estados resueltos

---

## 6. VERSIÓN 3: 2 Turnos y Fatiga (PENDIENTE)

### 6.1 Movimientos de 2 Turnos

| Movimiento | Turno 1 | Turno 2 |
|------------|---------|---------|
| **Hyper Beam** | Ataca (150 power) | No puede actuar (reposo) |
| **Solar Beam** | Carga | Ataca (120 power) |
| **Fly** | Vuela (evita ataques) | Ataca (70 power) |
| **Dig** | Cava (evita ataques) | Ataca (80 power) |
| **Bounce** | Rebota | Ataca (85 power) |
| **Dive** | Se sumerge | Ataca (80 power) |
| **Skull Bash** | +1 Defense | Ataca (100 power) |
| **Razor Wind** | Carga | Ataca (80 power) |
| **Shadow Force** | Desaparece | Ataca (90 power) |

### 6.2 Implementación

```typescript
interface PokemonBatalla {
  // ... campos existentes
  enCarga: boolean;
  movimientoCarga?: string; // nombre del movimiento en carga
  noPuedeActuarSiguienteTurno: boolean;
}

// Identificar movimientos de 2 turnos
const MOVIMIENTOS_2_TURNOS = [
  'solar-beam', 'fly', 'dig', 'hyper-beam', 'bounce', 
  'dive', 'skull-bash', 'razor-wind', 'shadow-force'
];

function esMovimiento2Turnos(movimiento: Move): boolean {
  return MOVIMIENTOS_2_TURNOS.includes(movimiento.name);
}

function ejecutarMovimiento2Turnos(
  movimiento: Move,
  atacante: PokemonBatalla,
  defensor: PokemonBatalla
): ResultadoMovimiento {
  // Primer uso del movimiento
  if (!atacante.enCarga) {
    // Turno 1: preparar
    atacante.enCarga = true;
    atacante.movimientoCarga = movimiento.name;
    
    return {
      tipo: 'carga',
      mensaje: `¡${movimiento.names?.es} está preparándose!`,
      dano: 0
    };
  } else {
    // Turno 2: ejecutar
    const dano = calcularDaño(movimiento, atacante, defensor);
    
    // Resetear carga
    atacante.enCarga = false;
    atacante.movimientoCarga = undefined;
    
    // Hyper Beam causa fatiga
    if (movimiento.name === 'hyper-beam') {
      atacante.noPuedeActuarSiguienteTurno = true;
    }
    
    return {
      tipo: 'damage',
      mensaje: `¡${movimiento.names?.es} causó ${dano} de daño!`,
      dano: dano
    };
  }
}

// Hyper Beam sin cargar (usado directamente)
function ejecutarHyperBeam(atacante: PokemonBatalla, defensor: PokemonBatalla): ResultadoMovimiento {
  // Usar power 150 (1.5x normal)
  const movimiento = getMoveByName('hyper-beam');
  const dano = calcularDaño({ ...movimiento, power: 150 }, atacante, defensor);
  
  // Fatiga siguiente turno
  atacante.noPuedeActuarSiguienteTurno = true;
  
  return { tipo: 'damage', mensaje: '¡Hyper Beam!', dano };
}
```

### 6.3 Ataques que Evaden (Fly, Dig, etc.)

```typescript
function esAtacanteEvadido(atacante: PokemonBatalla, defensor: PokemonBatalla): boolean {
  // Si el defensor está en carga de Fly/Dig/etc, esquiva automáticamente
  return defensor.enCarga && ['fly', 'dig', 'dive', 'bounce'].includes(defensor.movimientoCarga);
}

// En el cálculo de daño
if (esAtacanteEvadido(atacante, defensor)) {
  return {
    tipo: 'evadido',
    mensaje: '¡El objetivo se evasión!',
    dano: 0
  };
}
```

### 6.4 Checklist V3

- [ ] Campo `enCarga` en PokemonBatalla
- [ ] Campo `noPuedeActuarSiguienteTurno`
- [ ] Detectar movimientos de 2 turnos
- [ ] Lógica de carga (turno 1)
- [ ] Lógica de ejecución (turno 2)
- [ ] Fatiga de Hyper Beam
- [ ] Evadir ataques durante carga
- [ ] Skull Bash (+1 defense durante carga)

---

## 7. VERSIÓN 4: Cambios de Estadísticas (PENDIENTE)

### 7.1 Estadísticas Modificables

En V4 se usarán las estadísticas de la base de datos:
- **HP** (usado para daño, no se modifica)
- **Attack** - Modificable
- **Defense** - Modificable
- **Sp. Attack** - Modificable
- **Sp. Defense** - Modificable
- **Speed** - NO se usa (por mecánica coinflip)

### 7.2 Rango de Modificadores

```typescript
const MIN_STAT_MOD = -6;
const MAX_STAT_MOD = +6;

interface ModificadorEstadistica {
  stat: 'attack' | 'defense' | 'sp_attack' | 'sp_defense';
  change: number; // -6 a +6
}

// Ejemplo: Swords Dance → +2 Attack
// Ejemplo: Screech → -2 Defense
```

### 7.3 Implementación

```typescript
interface PokemonBatalla {
  // ... campos existentes
  statModifiers: {
    attack: number;
    defense: number;
    sp_attack: number;
    sp_defense: number;
  };
}

function aplicarCambioEstadistica(
  pokemon: PokemonBatalla,
  statChanges: Array<{ stat: string; change: number }>
): string[] {
  const mensajes: string[] = [];
  
  for (const cambio of statChanges) {
    const stat = cambio.stat as keyof typeof pokemon.statModifiers;
    if (pokemon.statModifiers[stat] !== undefined) {
      // Aplicar cambio, manteniendo dentro de [-6, +6]
      pokemon.statModifiers[stat] = Math.max(
        MIN_STAT_MOD,
        Math.min(MAX_STAT_MOD, pokemon.statModifiers[stat] + cambio.change)
      );
      
      const direccion = cambio.change > 0 ? 'aumentó' : 'disminuyó';
      mensajes.push(`${stat} ${direccion} a ${pokemon.statModifiers[stat]}`);
    }
  }
  
  return mensajes;
}

// Cálculo de daño con modificadores
function getStatConModificador(stat: number, modificador: number): number {
  // Tabla de modificadores:
  // -6: 2/10 = 0.2x
  // -5: 2/8 = 0.25x
  // -4: 2/6 = 0.33x
  // -3: 2/5 = 0.4x
  // -2: 2/4 = 0.5x
  // -1: 3/4 = 0.75x
  // 0:  1x
  // +1: 4/3 = 1.33x
  // +2: 2x
  // +3: 5/2 = 2.5x
  // +4: 3x
  // +5: 7/2 = 3.5x
  // +6: 4x
  
  const multipliers: Record<number, number> = {
    '-6': 0.2, '-5': 0.25, '-4': 0.33, '-3': 0.4,
    '-2': 0.5, '-1': 0.75,
    '0': 1, '1': 1.33, '2': 2, '3': 2.5, '4': 3, '5': 3.5, '6': 4
  };
  
  const multiplier = multipliers[modificador] || 1;
  return Math.floor(stat * multiplier);
}
```

### 7.4 Movimientos de Solo Stats (V4)

```typescript
// En V1-V3: "No hizo efecto"
// En V4: Aplicar cambios de stats

function ejecutarMovimientoSoloStats(
  movimiento: Move,
  atacante: PokemonBatalla,
  defensor: PokemonBatalla
): ResultadoMovimiento {
  // V1-V3: "No hizo efecto"
  if (movimiento.damage_class === 'status' && !movimiento.power) {
    return { tipo: 'sin_efecto', mensaje: '¡No hizo efecto!', dano: 0 };
  }
  
  // V4: Aplicar cambios de estadísticas
  if (movimiento.meta?.stat_changes && movimiento.meta.stat_changes.length > 0) {
    const mensajes = aplicarCambioEstadistica(defensor, movimiento.meta.stat_changes);
    return {
      tipo: 'stat_change',
      mensaje: mensajes.join(', '),
      dano: 0
    };
  }
  
  return { tipo: 'sin_efecto', mensaje: '¡No hizo efecto!', dano: 0 };
}
```

### 7.5 Checklist V4

- [ ] Campo `statModifiers` en PokemonBatalla
- [ ] Aplicar buffs (stat_changes positivo)
- [ ] Aplicar debuffs (stat_changes negativo)
- [ ] Limitar a rango [-6, +6]
- [ ] Calcular daño con modificadores
- [ ] Movimientos de solo stats (sin daño, solo stats)
- [ ] Límite de cambios por batalla (recomendado)

---

## 8. Estructura de Datos

```typescript
// ==================== VERSIÓN 1 ====================

interface EstadoBatalla {
  codigoSala: string;
  turno: number;
  estado: 'iniciando' | 'en_progreso' | 'terminada';

  jugadores: {
    player1: JugadorBatalla;
    player2: JugadorBatalla;
  };

  accionesPendientes: {
    player1: AccionPendiente | null;
    player2: AccionPendiente | null;
  };

  historial: HistorialTurno[];
}

interface JugadorBatalla {
  sessionId: string;
  nombre: string;
  equipo: PokemonBatalla[];
  pokemonActivo: number; // índice del pokemon activo
}

interface PokemonBatalla {
  id: number;
  nombre: string;
  nombreEs: string;
  tipos: string[];
  hp: number;
  maxHp: number;
  
  // Stats reales (de la DB)
  stats: {
    hp: number;
    attack: number;
    defense: number;
    sp_attack: number;
    sp_defense: number;
  };
  
  movimientos: number[]; // IDs de movimientos seleccionados
  
  // V2: Estados activos
  estados?: EstadoActivo[];
  
  // V2: Banderas de efecto
  siguienteTurnoFlinch?: boolean;
  
  // V3: Carga y fatiga
  enCarga?: boolean;
  movimientoCarga?: string;
  noPuedeActuarSiguienteTurno?: boolean;
  
  // V4: Modificadores de stats
  statModifiers?: {
    attack: number;
    defense: number;
    sp_attack: number;
    sp_defense: number;
  };
}

interface AccionPendiente {
  tipo: 'atacar' | 'cambiar';
  movimientoId?: number;
  pokemonId?: number;
  prioridad: number;
}

interface ResultadoMovimiento {
  tipo: 'damage' | 'sin_efecto' | 'evadido' | 'carga' | 'stat_change' | 'estado';
  mensaje: string;
  dano: number;
  estadoAplicado?: string;
}

interface EstadoActivo {
  tipo: 'burn' | 'poison' | 'toxic' | 'paralysis' | 'sleep' | 'freeze' | 'confusion' | 'flinch';
  turnosRestantes: number;
  aplicadoPor: string;
}

interface HistorialTurno {
  turno: number;
  acciones: AccionTurno[];
  danoTotal: { player1: number; player2: number };
}

interface AccionTurno {
  jugador: 'player1' | 'player2';
  movimiento?: string;
  dano: number;
  resultado: string;
}
```

---

## 9. Cálculo de Daño (V1)

```typescript
const NIVEL = 50; // Fijo para batallas

function calcularDaño(
  movimiento: Move,
  atacante: PokemonBatalla,
  defensor: PokemonBatalla
): number {
  const poder = movimiento.power || 0;
  
  // Determinar stats a usar
  let ataque: number;
  let defensa: number;
  
  if (movimiento.damage_class === 'physical') {
    ataque = getStatConModificador(atacante.stats.attack, atacante.statModifiers?.attack || 0);
    defensa = getStatConModificador(defensor.stats.defense, defensor.statModifiers?.defense || 0);
  } else if (movimiento.damage_class === 'special') {
    ataque = getStatConModificador(atacante.stats.sp_attack, atacante.statModifiers?.sp_attack || 0);
    defensa = getStatConModificador(defensor.stats.sp_defense, defensor.statModifiers?.sp_defense || 0);
  } else {
    // Status no hace daño
    return 0;
  }
  
  // Fórmula base
  let dano = (((2 * NIVEL / 5 + 2) * poder * (ataque / defensa) / 50) + 2);
  
  // STAB
  const mismoTipo = atacante.tipos.includes(movimiento.type);
  dano *= mismoTipo ? 1.5 : 1.0;
  
  // Efectividad de tipos
  const efectividad = getTypeEffectiveness(movimiento.type, defensor.tipos);
  dano *= efectividad;
  
  // Aleatorio (0.85 - 1.00)
  dano *= (0.85 + Math.random() * 0.15);
  
  // V2: Quemadura (reducir poder físico 50%)
  if (atacante.estados?.some(e => e.tipo === 'burn') && movimiento.damage_class === 'physical') {
    dano *= 0.5;
  }
  
  return Math.floor(dano);
}
```

---

## 10. Ejemplo de Turno (V1)

```
TURNO 1 - VERSIÓN 1 (Solo Daño):

═══════════════════════════════════════════════════════════════
FASE 1: SELECCIÓN
═══════════════════════════════════════════════════════════════
Jugador 1: Selecciona "Impactrueno" (power: 40)
Jugador 2: Selecciona "Lanzallamas" (power: 90)

═══════════════════════════════════════════════════════════════
FASE 2: DETERMINAR ORDEN
═══════════════════════════════════════════════════════════════
- Jugador 1: prioridad 0 (Impactrueno)
- Jugador 2: prioridad 0 (Lanzallamas)

→ COINFLIP: Jugador 1 ataca primero

═══════════════════════════════════════════════════════════════
FASE 3: EJECUTAR ACCIONES
═══════════════════════════════════════════════════════════════

[JUGADOR 1] → Impactrueno:
- Power: 40, Tipo: Electric vs Agua
- Efectividad: 2x (super efectivo)
- Daño calculado: 34
- → "¡Impactrueno causó 34 de daño!"

[JUGADOR 2] → Lanzallamas:
- Power: 90, Tipo: Fire vs Electric
- Efectividad: 1x (neutral)
- Daño calculado: 38
- → "¡Lanzallamas causó 38 de daño!"

═══════════════════════════════════════════════════════════════
FASE 4: VERIFICAR KO
═══════════════════════════════════════════════════════════════
- Jugador 1: HP осталось (no KO)
- Jugador 2: HP remaining (no KO)

═══════════════════════════════════════════════════════════════
→ TURNO 2...
```

---

## 11. Notas Importantes

1. **Todos los movimientos son seleccionables desde V1** - Pero su funcionalidad mejora con cada versión
2. **Sin velocidad** - La estadística de velocidad NO se usa en ningún momento (mecánica coinflip)
3. **HP es individual** - Cada Pokémon mantiene su propio HP
4. **Cambio de Pokémon** - Tiene prioridad +6, siempre va primero
5. **V1 Priority** - Solo ejecutar lo de V1, no implementar estados, 2 turnos ni stats

---

## 12. Roadmap de Implementación

```
[FASE 1] → VERSIÓN 1: Solo Daño (Core)
├── Estructura de datos
├── Sistema de prioridad
├── Coinflip
├── Cálculo de daño
├── Movimientos sin daño ("No hizo efecto")
├── Verificación KO
└── UI de batalla

[FASE 2] → VERSIÓN 2: Estados
├── Estructura de estados
├── Aplicar estados al atacar
├── Verificar si puede actuar
├── Daño por turno (burn, poison)
├── Efectos de estados
└── UI para mostrar estados

[FASE 3] → VERSIÓN 3: 2 Turnos
├── Campo enCarga
├── Campo noPuedeActuarSiguienteTurno
├── Movimientos de carga
├── Evadir durante carga
└── Fatiga

[FASE 4] → VERSIÓN 4: Estadísticas
├── Campo statModifiers
├── Aplicar buffs/debuffs
├── Calcular con modificadores
└── Movimientos de solo stats
```

---

**Documento creado:** 16 de Mayo de 2026
**Versión:** 3.0
**Estado:** Listo para implementación (empezar por V1)