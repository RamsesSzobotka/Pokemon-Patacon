# Especificación del Sistema de Batalla - Pokémon Patacon

**Versión:** 2.0 (Reestructurado)
**Fecha:** 15 de Mayo de 2026
**Estado:** Pendiente de Implementación
**Prioridad:** Alta - Core del juego

---

## 1. Visión General de la Batalla

La batalla de Pokémon Patacon es un sistema de turnos 1v1 donde dos jugadores compiten hasta que uno pierde todos sus Pokémon (HP = 0).

**Regla principal:** NO se usa la estadística de velocidad. El orden de ataque se determina por:
1. **Prioridad** de movimientos (movimientos de alta prioridad van primero)
2. **Cambio de Pokémon** (siempre tiene prioridad)
3. **Coinflip** (50/50) solo cuando ninguno o ambos tienen prioridad

---

## 2. Flujo Completo de la Batalla (NUEVO)

```
┌─────────────────────────────────────────────────────────────┐
│              TURNO N                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 1: SELECCIÓN DE ACCIONES                            │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  ┌───────────────────┐      ┌───────────────────┐          │
│  │   JUGADOR 1      │      │   JUGADOR 2      │          │
│  │                   │      │                   │          │
│  │  [Seleccionar]    │      │  [Seleccionar]    │          │
│  │  - Atacar        │      │  - Atacar         │          │
│  │  - Cambiar Pk     │      │  - Cambiar Pk     │          │
│  └───────────────────┘      └───────────────────┘          │
│           ↓                           ↓                    │
│  Acción seleccionada         Acción seleccionada           │
│  (movimiento o cambiar)     (movimiento o cambiar)         │
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
│  │  CASO A: Un jugador usa prioridad (movimiento o     │    │
│  │          cambio), el otro NO                         │    │
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
│    - Ejecuta su acción (ataque o cambio)                   │
│    - Aplica daño al oponente                                │
│    - Efectos inmediatos: estados aplicados                 │
│      (burn, poison, freeze, paralysis aplicados)           │
│    - Al FINAL de su turno:                                  │
│      Si aplico: parálisis, confusión, freeze, sleep,      │
│      flinch → se guarda para siguiente turno del rival     │
│                                                             │
│  JUGADOR SEGUNDO:                                           │
│    - Ejecuta su acción (ataque o cambio)                   │
│    - Aplica daño al oponente                                │
│    - Efectos inmediatos: estados aplicados                 │
│    - Al FINAL de su turno: aplicar efectos de no acción   │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 4: EFECTOS FINALES DEL TURNO                         │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  - Aplicar daño de estados (burn: -5%, poison: -5%)       │
│  - Decrementar turnos restantes de estados                 │
│  - Eliminar estados con turnos = 0                         │
│  - Verificar KO por daño de estados                        │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  FASE 5: PREPARAR SIGUIENTE TURNO                         │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  - Verificar si el oponente puede actuar (parálisis,      │
│    confusión, freeze, sleep, flinch)                        │
│  - Si cambió Pokémon: nuevo Pokémon sin estados           │
│                                                             │
│  ═══════════════════════════════════════════════════════   │
│  Si no hay ganador → Siguiente Turno (N+1)                │
│  ═══════════════════════════════════════════════════════   │
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

### 3.2 Movimientos con Prioridad (de la DB)

```
┌─────────────────────────────────────────────────────────────┐
│  MOVIMIENTOS CON PRIORIDAD (priority > 0)                  │
├─────────────────────────────────────────────────────────────┤
│  Priority +5:  -                                              │
│  Priority +4:  -                                              │
│  Priority +3:  -                                              │
│  Priority +2:  -                                              │
│  Priority +1:  fake out, quick attack,                       │
│                mach punch, vacuum wave,                     │
│                water sucker, galarian rapid spin,            │
│               ice shard, bullet punch,                       │
│                accelerated spin, aqua jet                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Lógica de Determinación de Orden

```typescript
/**
 * Determina el orden de ejecución de las acciones
 */
function determinarOrdenAcciones(
  accion1: AccionJugador,
  accion2: AccionJugador
): { primero: 'player1' | 'player2'; reason: string } {

  const prioridad1 = getPrioridadAccion(accion1);
  const prioridad2 = getPrioridadAccion(accion2);

  // CASO A: Prioridades diferentes
  if (prioridad1 !== prioridad2) {
    if (prioridad1 > prioridad2) {
      return { primero: 'player1', reason: 'mayor prioridad' };
    } else {
      return { primero: 'player2', reason: 'mayor prioridad' };
    }
  }

  // CASO B: Misma prioridad → COINFLIP
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

## 10. Estructura de Datos - Resumen

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
```

---

**Documento actualizado:** 15 de Mayo de 2026
**Versión:** 2.0
**Estado:** Listo para implementación

---

## 4. Sistema de Efectos de Estado

### 4.1 Clasificación de Estados

| Estado | Tipo de Efecto | Cuándo se Aplica | Comportamiento |
|--------|----------------|------------------|----------------|
| **BURN** | Daño por turno | Al final del turno | -50% poder físico + -5% HP por turno |
| **POISON** | Daño por turno | Al final del turno | -5% HP por turno |
| **PARALYSIS** | No acción siguiente | Al final del turno del aplicador | 25% de no actuar en siguiente turno |
| **FREEZE** | No acción siguiente | Al final del turno del aplicador | No puede actuar hasta que descongele |
| **SLEEP** | No acción siguiente | Al final del turno del aplicador | No puede actuar hasta que despierte |
| **CONFUSION** | No acción siguiente | Al final del turno del aplicador | 33% de autolesión en siguiente turno |
| **FLINCH** | No acción siguiente | Después del ataque | No puede actuar en siguiente turno |

### 4.2 Aplicación de Efectos - Flujo Detallado

```
╔═══════════════════════════════════════════════════════════════╗
║               APLICACIÓN DE EFECTOS EN CADA TURNO              ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  DURANTE LA ACCIÓN DEL JUGADOR 1:                            ║
║  ────────────────────────────────                            ║
║  1. Ejecuta su movimiento                                     ║
║  2. Aplica daño al oponente                                   ║
║  3. Si aplica estado (burn, poison, etc):                    ║
║     - Se guarda el estado en el oponente                      ║
║     - Se mostrará en UI: "Pokemon tiene quemadura"            ║
║  4. Al FINAL del turno del Jugador 1:                        ║
║     - Si aplico efecto que afecta SIGUIENTE turno del rival:  ║
║       → Parálisis: 25% no actuar                              ║
║       → Confusión: 33% autolesión                             ║
║       → Freeze: no puede actuar                               ║
║       → Sleep: no puede actuar                                ║
║       → Flinch: no puede actuar                              ║
║     - Estos efectos se activarán cuando le toque al rival     ║
║                                                               ║
║  DURANTE LA ACCIÓN DEL JUGADOR 2:                            ║
║  ────────────────────────────────                            ║
║  (Misma secuencia que Jugador 1)                             ║
║                                                               ║
║  AL FINAL DEL TURNO (después de ambos):                      ║
║  ────────────────────────────────────                        ║
║  1. Aplicar daño por estados (burn: -5%, poison: -5%)        ║
║  2. Decrementar turnos restantes de TODOS los estados        ║
║  3. Eliminar estados con turnos = 0                          ║
║  4. Verificar KO                                             ║
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
  // Nota: Solo verificamos efectos aplicados por el oponente en turnos anteriores

  for (const estado of pokemon.estados) {
    switch (estado.tipo) {
      case 'paralysis':
        // 25% probabilidad de no actuar
        if (Math.random() * 100 < 25) {
          return { puede: false, razon: 'paralizado - no puede moverse', actionTaken: true };
        }
        break;

      case 'sleep':
        // No puede actuar mientras duerma
        return { puede: false, razon: 'dormido - no puede moverse', actionTaken: true };

      case 'freeze':
        // No puede actuar mientras congelado
        return { puede: false, razon: 'congelado - no puede moverse', actionTaken: true };

      case 'confusion':
        // 33% probabilidad de atacarse a sí mismo
        if (Math.random() * 100 < 33) {
          // Ataca a sí mismo (similar a fallar el movimiento)
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

### 4.4 Ejemplo de Ejecución de un Turno

```
TURNO 5 - Ejemplo Completo:

═══════════════════════════════════════════════════════════════
FASE 1: SELECCIÓN
═══════════════════════════════════════════════════════════════
Jugador 1: Selecciona "Quick Attack" (prioridad +1)
Jugador 2: Selecciona "Flamethrower" (prioridad 0)

═══════════════════════════════════════════════════════════════
FASE 2: DETERMINAR ORDEN (Prioridad)
═══════════════════════════════════════════════════════════════
- Jugador 1: prioridad +1 (Quick Attack)
- Jugador 2: prioridad 0 (Flamethrower)

→ Jugador 1 tiene MAYOR prioridad → ATACA PRIMERO

═══════════════════════════════════════════════════════════════
FASE 3: EJECUTAR ACCIONES
═══════════════════════════════════════════════════════════════

JUGADOR 1 (PRIMERO):
- Quick Attack → 20 dmg al oponente
- Sin efectos de estado aplicados

JUGADOR 2 (SEGUNDO):
- Flamethrower → 40 dmg al oponente
- Aplica BURN (10% probabilidad) → ¡Se aplica quemadura!
- Al FINAL del turno del Jugador 2:
  → Se registra: "Efectoquemadura afectará siguiente turno de Jugador 1"

═══════════════════════════════════════════════════════════════
FASE 4: EFECTOS FINALES DEL TURNO
═══════════════════════════════════════════════════════════════
- Burn causa -5% HP máximo al Jugador 1
- Decrementar turnos de estados
- Verificar KO

═══════════════════════════════════════════════════════════════
FASE 5: PREPARAR SIGUIENTE TURNO
═══════════════════════════════════════════════════════════════
- Jugador 1 tiene estado BURN (pero puede actuar)
- Turno 6 comienza...
```

---

## 6. Sistema de Cambio de Pokémon

### 6.1 Reglas

- **Cambiar Pokémon tiene prioridad +6** (siempre ataca primero)
- Al cambiar: el Pokémon anterior vuelve con su HP actual
- El nuevo Pokémon entra con 100% HP y SIN estados
- Pokémon con HP = 0 **aparecen pero no son elegibles**

### 6.2 Interfaz de Cambio

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

## 7. Movimientos Especiales

### 7.1 Movimientos de 2 Turnos (Carga)

Estos movimientos requieren 2 turnos para ejecutarse:

| Movimiento | Comportamiento |
|-------------|-----------------|
| `solar beam` | Turno 1: carga, Turno 2: ataca |
| `fly` | Turno 1: vuela, Turno 2: ataca |
| `dig` | Turno 1: cava, Turno 2: ataca |
| `skull bash` | Turno 1: +1 Defense, Turno 2: ataca |
| `hyper beam` | Turno 1: ataca, Turno 2: no puede actuar (repos) |
| `shadow force` | Turno 1: desaparece, Turno 2: ataca |

### 7.2 Multi-Hit (Múltiples Golpes)

Movimientos que golpean múltiples veces: `fury swipes`, `pin missile`, `bullet seed`, etc.

---

## 8. Checklist de Implementación

### Fase 1 - Core de Batalla
- [ ] Estructura de datos del estado de batalla
- [ ] Sistema de selección de acciones (ambos jugadores)
- [ ] Sistema de prioridad (prioridad +6 para cambio, prioridad movimientos)
- [ ] Función coinflip() (solo cuando hayempate de prioridad)
- [ ] Sistema de ejecución de acciones en orden
- [ ] Cálculo de daño
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

**Documento actualizado:** 15 de Mayo de 2026
**Versión:** 2.0 (Reestructurado)
**Estado:** Listo para implementación

### Fase 1 - Core de Batalla
- [ ] Estructura de datos del estado de batalla
- [ ] Función coinflip()
- [ ] Sistema de acciones del jugador
- [ ] Cálculo de daño
- [ ] Sistema de efectos de estado
- [ ] Cambio de Pokémon
- [ ] Verificación de KO
- [ ] Fin de batalla
- [ ] UI de batalla (sprites, HP, panel)

### Fase 2 - Extras (Pendiente)
- [ ] Botón de objetos (UI lista, funcional deshabilitado)
- [ ] Animaciones de ataques
- [ ] Sonidos
- [ ] Historial de batalla
- [ ] Modo espectadores

---

## 12. Notas Adicionales

1. **Sin velocidad:** La estadística de velocidad NO se usa en ningún momento
2. **Stats individuales:** Cada Pokémon mantiene su propio HP, no se comparte
3. **Cambio de Pokémon:** Al cambiar, el nuevo entra con 100% HP, el anterior vuelve con HP actual
4. **Estados:** Duran exactamente 3 turnos, se eliminan al cambiar Pokémon
5. **Primera versión:** Sin objetos, pero botón presente para Fase 2
6. **Sprites:** Solo sprites estáticos (sin animaciones) en v1.0

---

**Documento creado:** 15 de Mayo de 2026
**Última actualización:** 15 de Mayo de 2026
**Estado:** Listo para implementación