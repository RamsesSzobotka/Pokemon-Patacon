# Especificación del Sistema de Batalla - Pokémon Patacon

**Versión:** 2.1 (Corregida)
**Fecha:** 15 de Mayo de 2026
**Estado:** Listo para Implementación
**Prioridad:** Alta - Core del juego

---

## 1. Visión General de la Batalla

La batalla de Pokémon Patacon es un sistema de turnos 1v1 donde dos jugadores compiten hasta que uno pierde todos sus Pokémon (HP = 0).

**Regla principal:** NO se usa la estadística de velocidad. El orden de ataque se determina por:
1. **Prioridad** de movimientos (movimientos de alta prioridad van primero)
2. **Cambio de Pokémon** (siempre tiene prioridad)
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
│  - Atacar (seleccionar movimiento)                         │
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
│    1. Verificar si puede actuar (parálisis, confusión,     │
│       freeze, sleep, flinch, fatiga)                       │
│    2. Ejecutar acción (ataque o cambio)                    │
│    3. Calcular y aplicar daño                               │
│    4. Verificar KO                                         │
│    5. Aplicar efectos inmediatos (burn, poison)            │
│    6. Registrar efectos para próximo turno rival           │
│       (paralysis, confusion, freeze, sleep, flinch)        │
│                                                             │
│  JUGADOR SEGUNDO:                                           │
│    (Misma secuencia que Jugador 1)                        │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 4: EFECTOS FINALES DEL TURNO                         │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  1. Aplicar daño de estados (burn: -5%, poison: -5%)       │
│  2. Decrementar turnos restantes de estados                 │
│  3. Eliminar estados con turnos = 0                         │
│  4. Verificar KO por daño de estados                       │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 5: PREPARAR SIGUIENTE TURNO                         │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  - Verificar si algún Pokémon cambió de Pokémon            │
│  - Si cambió: nuevo Pokémon entra sin estados              │
│  - Si no hay ganador → Siguiente Turno (N+1)              │
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
    primero: coinflip(),
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

## 4. Sistema de Efectos de Estado

### 4.1 Clasificación de Estados

| Estado | Tipo de Efecto | Cuándo se Aplica | Comportamiento |
|--------|----------------|------------------|----------------|
| **BURN** | Daño por turno | Al final del turno | -50% poder físico + -5% HP por turno |
| **POISON** | Daño por turno | Al final del turno | -5% HP por turno |
| **TOXIC** | Daño acumulativo | Al final del turno | -5%, -10%, -15%, -20% (aumenta cada turno) |
| **PARALYSIS** | No acción siguiente | Al final del turno del aplicador | 25% de no actuar en siguiente turno |
| **FREEZE** | No acción siguiente | Al final del turno del aplicador | No puede actuar hasta que descongele |
| **SLEEP** | No acción siguiente | Al final del turno del aplicador | No puede actuar hasta que despierte |
| **CONFUSION** | No acción siguiente | Al final del turno del aplicador | 33% de autolesión en siguiente turno |
| **FLINCH** | No acción siguiente | Después del ataque | No puede actuar en siguiente turno |
| **LEECH SEED** | Daño por turno | Al final del turno | -10% HP por turno, curación al usuario |
| **CURSE** | Daño por turno | Al final del turno | -25% HP por turno |

### 4.2 Flujo de Aplicación de Efectos

```
╔═══════════════════════════════════════════════════════════════╗
║               APLICACIÓN DE EFECTOS EN CADA TURNO              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  AL INICIO DEL TURNO (antes de ejecutar):                     ║
║  ──────────────────────────────────────────                   ║
║  1. Verificar si puede actuar (efectos del turno anterior)    ║
║     - Paralysis: 25% no actuar                                ║
║     - Freeze: no puede actuar                                ║
║     - Sleep: no puede actuar                                 ║
║     - Flinch: no puede actuar                                ║
║     - Fatiga (hyper beam): no puede actuar                    ║
║  2. Si no puede actuar: omitir acción, pasar al siguiente     ║
                                                               ║
║  DURANTE LA ACCIÓN (al ejecutar ataque):                      ║
║  ─────────────────────────────────────────                    ║
║  1. Ejecutar movimiento                                       ║
║  2. Calcular daño                                             ║
║  3. Aplicar daño inmediato                                    ║
║  4. Si aplica estado inmediato (burn, poison):                ║
║     - Aplicar inmediatamente                                  ║
║  5. Si aplica efecto para siguiente turno:                    ║
║     - Registrar para que se active al inicio del turno rival  ║
║                                                               ║
║  AL FINAL DEL TURNO (después de ambos jugadores):             ║
║  ─────────────────────────────────────────────                ║
║  1. Aplicar daño por estados (burn, poison, toxic, leech,     ║
│     curse)                                                   ║
║  2. Decrementar turnos restantes de TODOS los estados         ║
║  3. Eliminar estados con turnos = 0                           ║
║  4. Verificar KO por daño de estados                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### 4.3 Verificación de si Puede Actuar

```typescript
/**
 * Se verifica al inicio del turno del jugador
 * Solo afecta si el oponente aplicó el efecto en el turno anterior
 */
function puedeActuar(pokemon: PokemonEnBatalla): { puede: boolean; razon: string; actionTaken: boolean } {

  // Verificar estados que impiden actuar
  for (const estado of pokemon.estados) {
    switch (estado.tipo) {
      case 'paralysis':
        // 25% probabilidad de no actuar
        if (Math.random() * 100 < 25) {
          return { puede: false, razon: 'paralizado - no puede moverse', actionTaken: true };
        }
        break;

      case 'sleep':
        // Reducir turnos de sueño
        if (estado.turnosRestantes > 0) {
          return { puede: false, razon: 'dormido - no puede moverse', actionTaken: true };
        }
        break;

      case 'freeze':
        // 20% probabilidad de descongelar (o usar moves como Flame Wheel)
        if (Math.random() * 100 < 80) {
          return { puede: false, razon: 'congelado - no puede moverse', actionTaken: true };
        }
        break;

      case 'confusion':
        // 33% probabilidad de atacarse a sí mismo
        if (Math.random() * 100 < 33) {
          return { puede: true, razon: 'confuso - se atacó a sí mismo', actionTaken: true };
        }
        break;
    }
  }

  // Verificar flinch (aplicado por el oponente en turno anterior)
  if (pokemon.siguienteTurnoFlinch) {
    pokemon.siguienteTurnoFlinch = false; // Consumir el efecto
    return { puede: false, razon: 'retrocedió - no puede moverse', actionTaken: true };
  }

  // Verificar fatiga (movimientos de descanso como hyper beam)
  if (pokemon.noPuedeActuarSiguienteTurno) {
    pokemon.noPuedeActuarSiguienteTurno = false;
    return { puede: false, razon: 'fatigado - necesita descansar', actionTaken: true };
  }

  return { puede: true, razon: '', actionTaken: false };
}
```

---

## 5. Sistema de Cambio de Pokémon

### 5.1 Reglas

- **Cambiar Pokémon tiene prioridad +6** (siempre ataca primero)
- Al cambiar: el Pokémon anterior vuelve con su HP actual
- El nuevo Pokémon entra con el HP que tenía guardado y si tenia un estaod acativo, el estado se mantiene pero no afecta (ej: burn no reduce HP mientras está fuera, pero si vuelve a entrar sigue quemado y reduciendo el turno restante)
- Pokémon con HP = 0 **aparecen pero no son elegibles**

### 5.2 Interfaz de Cambio

```
┌────────────────────────────────────────────────────┐
│              SELECCIONAR POKÉMON                  │
├────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ CHARIZARD│  │ BLASTOISE│  │ VENUSAUR │        │
│  │ HP: 45%  │  │ HP: 100% │  │ HP: 0%   │        │
│  │ [ELEGIR] │  │ [ELEGIR] │  │ [X]      │        │
│  └──────────┘  └──────────┘  └──────────┘        │
│      ↑              ↑              ↑             │
│   Elegible     Elegible      NO elegible        │
│   (HP>0)       (HP>0)       (HP=0 pero        │
│                              visible)          │
└────────────────────────────────────────────────────┘
```

---

## 6. Movimientos Especiales

### 6.1 Movimientos de 2 Turnos (Carga)

| Movimiento | Comportamiento |
|-------------|-----------------|
| `solar beam` | Turno 1: carga, Turno 2: ataca |
| `fly` | Turno 1: vuela, Turno 2: ataca |
| `dig` | Turno 1: cava, Turno 2: ataca |
| `skull bash` | Turno 1: +1 Defense, Turno 2: ataca |
| `hyper beam` | Turno 1: ataca con 1.5x poder, Turno 2: no puede actuar (repos) |
| `shadow force` | Turno 1: desaparece (invulnerable), Turno 2: ataca |

### 6.2 Multi-Hit (Múltiples Golpes)

Movimientos que golpean 2-5 veces: `fury swipes`, `pin missile`, `bullet seed`, `double slap`, etc.

**Lógica:** Tirar daño 2-5 veces, cada golpe puede fallar independientemente (pero si uno acierta, todos aciertan).

---

## 7. Cálculo de Daño

### Fórmula de Daño

```
Daño = (((2 * Nivel / 5 + 2) * Poder * (Ataque / Defensa) / 50) + 2) * STAB * Tipo * Aleatorio

Donde:
- Nivel: Nivel del Pokémon (establecido en 50 para batallas)
- Poder: Power del movimiento
- Ataque/Defensa: Stat del Pokémon
- STAB: 1.5 si el movimiento es del mismo tipo que el Pokémon, 1.0 si no
- Tipo: Effectiveness del tipo (0.5, 1.0, 2.0, 0.0)
- Aleatorio: Random entre 0.85 y 1.00
```

### Modificadores de Daño

| Modificador | Valor | Condición |
|-------------|-------|-----------|
| STAB | 1.5 | Movimiento del mismo tipo que el Pokémon |
| STAB | 1.0 | Movimiento de tipo diferente |
| Super efectivo | 2.0 | Movimiento muy efectivo contra el tipo |
| Neutral | 1.0 | Efectividad normal |
| No muy efectivo | 0.5 | Movimiento poco efectivo |
| No tiene efecto | 0.0 | Inmunidad (ej: Ground contra Flying) |
|quemado (físico) | 0.5 | Movimiento físico con quemadura |

---

## 8. Estructura de Datos

```typescript
interface EstadoBatalla {
  codigoSala: string;
  turno: number;
  estado: 'iniciando' | 'en_progreso' | 'terminada';

  // Ambos jugadores
  jugadores: {
    player1: { sessionId, nombre, equipo: PokemonEnBatalla[], pokemonActivo: number };
    player2: { sessionId, nombre, equipo: PokemonEnBatalla[], pokemonActivo: number };
  };

  // Acciones seleccionadas (para determinar orden)
  accionesPendientes: {
    player1: AccionPendiente | null;
    player2: AccionPendiente | null;
  };

  // Estado para efectos entre turnos
  efectosProximoTurno: {
    player1: Efecto[];  // Efectos aplicados por player2 a player1
    player2: Efecto[];  // Efectos aplicados por player1 a player2
  };

  historial: HistorialTurno[];
}

interface AccionPendiente {
  tipo: 'atacar' | 'cambiar';
  movimientoId?: number;
  pokemonId?: number;
  prioridad: number;  // +6 para cambio, 0-5 para movimientos
}

interface PokemonEnBatalla {
  id: number;
  nombre: string;
  tipo1: string;
  tipo2?: string;
  hp: number;
  maxHp: number;
  ataque: number;
  defensa: number;
  habilidad?: string;
  movimientos: number[];

  // Estados activos
  estados: EstadoActivo[];

  // Banderas para siguiente turno
  siguienteTurnoFlinch: boolean;
  noPuedeActuarSiguienteTurno: boolean;
  enCarga: boolean;      // Para movimientos de 2 turnos
  movimientoCarga?: string;
}

interface EstadoActivo {
  tipo: 'burn' | 'poison' | 'toxic' | 'paralysis' | 'freeze' | 'sleep' | 'confusion' | 'flinch' | 'leech_seed' | 'curse';
  turnosRestantes: number;
  aplicadoPor: 'player1' | 'player2';
}
```

---

## 9. Base de Datos de Movimientos

**Resumen:** 409 movimientos en la base de datos

| Categoría | Cantidad | Descripción |
|-----------|----------|-------------|
| Daño Puro | ~300 | Solo inflige daño |
| Daño + Estado | 76 | Daño + aplica burn/paralysis/poison/freeze/confusion |
| Daño + Stats | ~70 | Daño + cambia attack/defense/speed/etc |
| Flinch | 26 | Daño + probabilidad de flinch |
| Multi-Hit | ~10 | Múltiples golpes (fury swipes, pin missile) |
| 2 Turnos | ~18 | Carga/preparación (solar beam, hyper beam) |

---

## 10. Ejemplo de Ejecución de un Turno

```
TURNO 5 - Ejemplo Completo:

══════════════════════════════════════════════════════════════
FASE 1: SELECCIÓN
══════════════════════════════════════════════════════════════
Jugador 1: Selecciona "Quick Attack" (prioridad +1)
Jugador 2: Selecciona "Flamethrower" (prioridad 0)

══════════════════════════════════════════════════════════════
FASE 2: DETERMINAR ORDEN (Prioridad)
══════════════════════════════════════════════════════════════
- Jugador 1: prioridad +1 (Quick Attack)
- Jugador 2: prioridad 0 (Flamethrower)

→ Jugador 1 tiene MAYOR prioridad → ATACA PRIMERO

══════════════════════════════════════════════════════════════
FASE 3: EJECUTAR ACCIONES
══════════════════════════════════════════════════════════════

JUGADOR 1 (PRIMERO):
- Verifica puede actuar: sí
- Quick Attack → 20 dmg al oponente
- Sin efectos de estado aplicados

JUGADOR 2 (SEGUNDO):
- Verifica puede actuar: sí
- Flamethrower → 40 dmg al oponente
- Aplica BURN (10% probabilidad) → ¡Se aplica quemadura!

══════════════════════════════════════════════════════════════
FASE 4: EFECTOS FINALES DEL TURNO
══════════════════════════════════════════════════════════════
- Burn causa -5% HP máximo al Jugador 1
- Decrementar turnos de estados
- Verificar KO

══════════════════════════════════════════════════════════════
FASE 5: PREPARAR SIGUIENTE TURNO
══════════════════════════════════════════════════════════════
- Jugador 1 tiene estado BURN (pero puede actuar)
- Turno 6 comienza...
```

---

## 11. Checklist de Implementación

### Fase 1 - Core de Batalla
- [ ] Estructura de datos del estado de batalla
- [ ] Sistema de selección de acciones (ambos jugadores)
- [ ] Sistema de prioridad (prioridad +6 para cambio, prioridad movimientos)
- [ ] Función coinflip() (solo cuando hayempate de prioridad)
- [ ] Sistema de ejecución de acciones en orden
- [ ] Cálculo de daño con fórmula completa
- [ ] Sistema de efectos (inmediatos vs siguiente turno vs por turno)
- [ ] Movimientos de 2 turnos
- [ ] Cambio de Pokémon
- [ ] Verificación de KO
- [ ] Fin de batalla
- [ ] UI de batalla (sprites, HP, panel)
- [ ] Pokémon con HP=0 visible pero no elegible

### Fase 2 - Extras (Pendiente)
- [ ] Botón de objetos (UI lista, funcional deshabilitado)
- [ ] Animaciones de ataques
- [ ] Sonidos

---

## 12. Notas Adicionales

1. **Sin velocidad:** La estadística de velocidad NO se usa en ningún momento
2. **Stats individuales:** Cada Pokémon mantiene su propio HP, no se comparte
3. **Cambio de Pokémon:** Al cambiar, el nuevo entra con el HP individual que tenía guardado, el anterior vuelve con HP actual
4. **Estados:** Duran exactamente 3 turnos, no se eliminan por cambio, el estado se mantiene pero no afecta si el Pokémon está fuera de combate, si el pokemon vuelve a entrar el estado se mantiene pero no afecta (ej: burn no reduce HP mientras está fuera, pero si vuelve a entrar sigue quemado y reduciendo el turno restante)
5. **Primera versión:** Sin objetos, pero botón presente para Fase 2
6. **Sprites:** usar sprites animados (jugador actual ve back_default y front_default de pokemon oponente, asi ambos jugadores ven animaciones) 

---

**Documento creado:** 15 de Mayo de 2026
**Última actualización:** 15 de Mayo de 2026 (Versión 2.1 Corregida)
**Estado:** Listo para implementación