# Clarificaciones - Reglas Ambiguas

**Versión:** 1.0  
**Fecha:** 13 de Mayo de 2026  
**Propósito:** Resolver ambigüedades del PRD para desarrollo

---

## 🔍 Tabla de Desambiguación

| Regla | PRD Dice | Ambigüedad | DECISIÓN FINAL | Implementación |
|-------|----------|-----------|----------------|-----------------|
| **Movimientos <4** | "Se excluye o se maneja" | ¿Qué hacer si Pokémon tiene <4 movimientos Gen V? | ✅ **Incluir TODOS** - validar en PokeAPI Gen V exactamente 4+ | Backend valida en seed; excluye si <4 válidos |
| **Efectos - Decremento** | "Decrecen -1 turno" | ¿Quién decrementa: activo e inactivo? | ✅ **Solo activo** decrementa; inactivos NO afectados | `status.remainingTurns -= 1` si en batalla |
| **Efectos - Cambio** | "Se eliminan al cambiar" | ¿Todos los efectos o solo algunos? | ✅ **TODOS** (estado + confusión + atracción) | `clearAllStatus()` en switch |
| **Stats IV** | "Generados aleatoriamente 0-31" | ¿Mismos IVs toda la batalla o generados en cada turno? | ✅ **Generados al inicio batalla** y fijos para esa batalla | `generateIVs()` en `battle:start` |
| **Coinflip** | "50/50 cada turno" | ¿Quién calcula? ¿Se envía a ambos clientes? | ✅ **Servidor calcula**, envía en `turn:execute` | Bun genera, ambos ven resultado |
| **Draft** | "P1 elige → P2 elige" | ¿Tiempo límite por pick? ¿Penalización por timeout? | ✅ **60 segundos/pick** máximo; si timeout, pick automático aleatorio | Timer en servidor + frontend |
| **Salas** | "30 minutos inactivas" | ¿Qué significa "inactiva"? | ✅ **Sin acciones WebSocket** en 30 min | TTL en MongoDB + heartbeat |
| **Reconexión** | "30 segundos espera" | ¿Luego qué? ¿Victoria o pausa? | ✅ **Victoria automática** para oponente si >30s desconectado | Evento `battle:end` con reason: "opponent_disconnected" |
| **PP Movimientos** | "Sin limitación" | ¿Por qué no usar sistema Pokémon canon? | ✅ **Decisión deliberada** para simplificar mecánica | Sin campo `pp` en movimientos |
| **Sprites URL** | "Desde PokeAPI" | ¿Qué URL exacta? .gif o PNG? | ✅ **URL oficial**: `/.../generation-v/black-white/animated/{id}.gif` con fallback PNG | Frontend carga on-demand + caché |
| **Daño Crítico** | "Random() < 1/24" | ¿Es 1/24 o la probabilidad por movimiento? | ✅ **1/24 fijo** = 4.17% para todos los movimientos (no personalizado) | Aleatorio global, no por movimiento |
| **Burn Modificador** | "0.5 si atacante quemado y físico" | ¿También afecta especial? | ✅ **Solo FÍSICO** (canon). Especial NO afectado | Condicional en cálculo: `if (move.physical && status.burn)` |
| **Estado Quemadura** | "Pierde -50% ATK" | ¿Es durante cálculo o valor mostrado? | ✅ **Durante cálculo** de daño, no afecta stat visible | Modificador en `baseDamage`, stat visible íntegro |
| **Objeto Sincronización** | "Poción restaura 100%" | ¿Ambos ven consumo instantáneamente? | ✅ **SÍ**, evento `item:used` broadcast a ambos | Mensaje WebSocket inmediato |
| **Objeto Turno** | "Usar objeto = 1 acción" | ¿Puede atacar después o es fin de turno? | ✅ **Es fin de turno** - solo objeto, sin ataque | Validación: `if (action.type === 'item') { action.type = 'item'; noAttack(); }` |
| **Revivir HP** | "50% HP" | ¿Se restauran estados del Pokémon revivido? | ✅ **NO**, solo HP. Estados persisten | `hp = max_hp * 0.5`, status NO cleared |
| **Poción Restricción** | "No si 100% HP" | ¿Error o simplemente no se usa? | ✅ **Botón deshabilitado** en UI si 100% | Frontend valida antes de enviar |
| **Atracción/Confusión** | "¿Máximo 1 no-volátil + 2 volátiles?" | ¿Puede un Pokémon tener burn + confusion? | ✅ **SÍ**: máximo 1 no-volátil (burn/poison/sleep/etc.) + confusión + atracción simultáneamente | Array de status, validar count |
| **Cambio de Pokémon** | "Mod temporales se eliminan" | ¿Solo del cambiado o de ambos? | ✅ **Solo del Pokémon que sale**. Oponente mantiene sus mods | `activeTeam[oldIndex].tempMods.reset()` |
| **Precision Movimiento** | "randomInt(1,100) <= accuracy" | ¿Se aplica antes o después STAB? | ✅ **Antes de todo** - si falla, daño = 0 | Primer check: `if (hitRoll > accuracy) return 0;` |
| **Performance <100ms** | "Latencia en turnos" | ¿Desde qué acción a qué resultado? | ✅ **Desde acción usuario → ejecución turno en ambos clientes** | Timer: socket.send() → turn:execute recibido |

---

## 📝 Decisiones por Categoría

### 1. Movimientos y Habilidades

**P: ¿Qué pasa si un Pokémon tiene <4 movimientos válidos en Gen V?**

**R:** Todos los 649 Pokémon del pool tienen exactamente 4+ movimientos válidos. Validación en seed de datos. Si alguno falla: **se excluye del pool** (no ocurre en JSON actual).

**Código Backend:**
```typescript
function validatePokemonMoves(pokemon) {
  const validMoves = pokemon.moves.filter(m => m.generation <= 5);
  if (validMoves.length < 4) {
    console.warn(`Excluding ${pokemon.name}: only ${validMoves.length} moves`);
    return false;
  }
  return true;
}
```

---

### 2. Efectos de Estado

**P: ¿El Pokémon inactivo también sufre efectos?**

**R:** NO. Solo el Pokémon activo decrementa estados. Pokémon en banco no reciben daño de estado ni decremento.

**P: ¿Se limpian todos los efectos al cambiar?**

**R:** SÍ, TODOS: estado principal (burn/poison) + confusión + atracción. Se restauran si vuelve a entrar después.

**Código:**
```typescript
function switchPokemon(team, outIndex, inIndex) {
  team[outIndex].status = null;
  team[outIndex].confusion = null;
  team[outIndex].attraction = null;
  team[outIndex].tempModifiers = { /* reset */ };
  
  const incoming = team[inIndex];
  updateActiveDisplay(incoming);
}
```

---

### 3. IVs (Valores Individuales)

**P: ¿Los IVs cambian cada turno o se generan una sola vez?**

**R:** Se generan una sola vez al iniciar la batalla y son fijos para toda esa batalla. Esto afecta stats base que se usan en todos los cálculos de daño.

**Flujo:**
```
battle:start
  → generateIVs() para cada Pokémon en cada equipo
  → IVs guardados en estado de batalla
  → se usan durante toda la batalla
```

---

### 4. Turnos y Orden

**P: ¿Quién genera el coinflip? ¿Se ve en ambos clientes?**

**R:** Servidor (Bun) genera el random 50/50 cada turno y envía el resultado en `turn:execute`. Ambos clientes ven el mismo resultado (no local random).

**Por qué:** Evita desincronización. El servidor es la fuente de verdad.

---

### 5. Draft (Selección de Equipo)

**P: ¿Hay límite de tiempo para elegir Pokémon?**

**R:** SÍ, 60 segundos máximo por pick. Si timeout:
- Frontend: muestra cuenta regresiva
- Backend: selecciona Pokémon aleatorio automáticamente

**P: ¿Qué pasa si intenta elegir un Pokémon ya elegido?**

**R:** Error: `POKEMON_ALREADY_SELECTED`. No se registra en el equipo.

---

### 6. Salas y Desconexión

**P: ¿Qué significa "sala inactiva"?**

**R:** Sin mensajes WebSocket durante 30 minutos. TTL automático en MongoDB elimina la sala.

**P: ¿Si me desconecto durante batalla?**

**R:** 30 segundos para reconectarse. Pasado ese tiempo: oponente gana automáticamente (`battle:end` con reason: "opponent_disconnected").

---

### 7. Sistema de Daño

**P: ¿El burn (quemadura) afecta daño especial?**

**R:** NO, solo físico. Esto es canon de Pokémon Gen V.

```typescript
let effectiveStat = attackStat;
if (move.damageClass === 'physical' && attacker.status.type === 'burn') {
  effectiveStat *= 0.5;
}
```

**P: ¿La probabilidad de crítico es fija en 1/24?**

**R:** SÍ. Todos los movimientos tienen 1/24 = 4.17%. No hay movimientos con crítico aumentado.

---

### 8. Objetos

**P: ¿Usar una Poción Total consume el turno?**

**R:** SÍ. Si usas objeto = 1 acción del turno. No puedes atacar en ese turno.

**P: ¿Se ve inmediatamente cuando el oponente usa un objeto?**

**R:** SÍ. Evento `item:used` broadcast a ambos clientes con estado actualizado del inventario.

**P: ¿Revivir restaura el estado de efectos?**

**R:** NO. Solo HP al 50%. Si el Pokémon tenía burn, mantiene burn al revivir.

---

## 🎯 Checklist de Validación

Usar este checklist durante desarrollo para confirmar que se cumple cada clarificación:

- [ ] Seed de datos valida: todos los 649 tienen 4+ movimientos
- [ ] Efectos: solo decrementa en Pokémon activo
- [ ] Cambio: limpia TODOS los efectos
- [ ] IVs: generados en `battle:start`, inmutables
- [ ] Coinflip: servidor genera, broadcast en `turn:execute`
- [ ] Draft: 60 segundos/pick, timeout = pick aleatorio
- [ ] Desconexión: 30 segundos reconexión, luego victoria oponente
- [ ] Burn: solo afecta daño físico (no especial)
- [ ] Crítico: 1/24 global (no por movimiento)
- [ ] Objeto: consume turno, broadcast inmediato
- [ ] Revivir: 50% HP, status NO limpiados

---

## 📋 Ejemplos de Validación

### Ejemplo 1: Efectos de Estado

```typescript
// CORRECTO ✅
async function applyStatus(pokemon: Pokemon, status: StatusType) {
  if (pokemon.is_active) {
    pokemon.status = { type: status, remainingTurns: 3 };
  }
  // Si inactivo: no aplica
}

// INCORRECTO ❌
async function applyStatus(pokemon: Pokemon, status: StatusType) {
  pokemon.status = { type: status, remainingTurns: 3 }; // Aplica a todos
}
```

### Ejemplo 2: Cambio de Pokémon

```typescript
// CORRECTO ✅
function switchPokemon(team, outIndex, inIndex) {
  const outgoing = team[outIndex];
  outgoing.status = null;           // ✅ Limpia todos
  outgoing.confusion = null;
  outgoing.attraction = null;
  outgoing.tempModifiers.reset();
  
  setActiveIndex(inIndex);
}

// INCORRECTO ❌
function switchPokemon(team, outIndex, inIndex) {
  setActiveIndex(inIndex);
  // No limpia estado → persiste si vuelve a entrar
}
```

### Ejemplo 3: Cálculo de Daño con Burn

```typescript
// CORRECTO ✅
function calculateDamage(attacker, defender, move) {
  let attackStat = move.damageClass === 'physical' 
    ? attacker.stats.attack 
    : attacker.stats.sp_attack;
  
  // Burn solo afecta físico
  if (move.damageClass === 'physical' && attacker.status?.type === 'burn') {
    attackStat *= 0.5;
  }
  
  // ... resto del cálculo
}

// INCORRECTO ❌
function calculateDamage(attacker, defender, move) {
  let attackStat = attacker.stats.attack;
  
  // Aplica burn a todos ❌
  if (attacker.status?.type === 'burn') {
    attackStat *= 0.5;
  }
}
```

