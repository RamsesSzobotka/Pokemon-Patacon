# Validación de Renderizado de Sprites Shiny en Batalla

## Resumen de Cambios

### Backend (battleHandler.ts)
1. **serializePokemon()** - Ahora loguea `owner_shiny` para debugging
2. **battle:action-result** - Envía Pokémon completos serializados (con owner_shiny)
3. Todos los broadcasts ya usan serializePokemon():
   - `battle:start` ✅
   - `battle:turn-end` ✅ 
   - `battle:switch-success` ✅
   - `battle:end-of-turn-effects` ✅
   - `battle:end` ✅
   - `battle:action-result` ✅ (mejora reciente)

### Frontend (Battle.tsx + spriteResolver.ts)
1. **spriteResolver.ts** - Centralized `getPokemonBattleSprite()` con validación
2. **Battle.tsx**:
   - Usa `getPokemonBattleSprite()` para toda decisión de shiny
   - Preserva `owner_shiny` en spreads de estado
   - Usa Pokémon completos del backend (ya no solo HP)
3. **BattleState interface** - Removidos campos `shiny_pack` innecesarios
4. **BattlePokemon interface** - Agrega comentario sobre `owner_shiny`

---

## Escenario de Prueba Manual

### Setup
```
Jugador 1 (P1):
  - Usuario con shiny_pack: true (tiene pack de shiny premium)
  - Pokémon de prueba: Pikachu, Charizard, etc.

Jugador 2 (P2):
  - Usuario con shiny_pack: false (sin pack)
  - Pokémon de prueba: cualesquiera
```

### Validación en Batalla (tanto P1 como P2 ven lo mismo)

#### 1. Battle Start (Inicio)
**Esperado:**
- Pokémon de P1 muestran back_shiny (porque P1.shiny_pack=true)
- Pokémon de P2 muestran front_default (porque P2.shiny_pack=false)
- En el navegador de P1: DevTools → Network → WS → buscar mensaje "battle:start"
  - Verificar que data.player1.activePokemon incluya `owner_shiny: true`
  - Verificar que data.player2.activePokemon incluya `owner_shiny: false`

#### 2. Durante Batalla (Ataques)
**Esperado:**
- Sprites mantienen shiny/default después de ataques
- Console logs muestran: `[Sprite] Pokémon {id}: back_shiny (owner_shiny=true)`
- DevTools Network → WS → buscar "battle:action-result"
  - Verificar que data.attackerPokemon y defenderPokemon incluyan owner_shiny

#### 3. Switch/Cambio de Pokémon
**Esperado:**
- Nuevo Pokémon heredado mantiene el mismo estado shiny/default que su dueño
- DevTools Network → WS → buscar "battle:switch-success"
  - Verificar que data.pokemon incluya owner_shiny correcto

#### 4. Fin de Turno (End of Turn Effects)
**Esperado:**
- Sprites no cambian
- Pokémon reciben daño de efectos (burn, poison, etc.) pero mantienen shiny/default
- DevTools Network → buscar "battle:end-of-turn-effects"
  - Verificar que data.player1.activePokemon incluya owner_shiny

#### 5. Fin de Batalla
**Esperado:**
- Sprites finales muestran shiny/default según dueño
- DevTools Network → buscar "battle:end"
  - Verificar que data.finalState incluya owner_shiny en ambos Pokémon

---

## Debugging con Browser Console

### Verificar que owner_shiny está en el estado de React

```javascript
// En React DevTools → console
// Asumir que battleState está disponible en window
console.log(battleState.player1.activePokemon.owner_shiny); // debe ser: true o false
console.log(battleState.player2.activePokemon.owner_shiny); // debe ser: true o false
```

### Verificar logs en consola

**Backend Console:**
```
[BATTLE] serializePokemon: Pikachu serializado correctamente (owner_shiny: true)
[BATTLE] serializePokemon: Charizard serializado correctamente (owner_shiny: false)
```

**Frontend Console (DevTools):**
```
[Sprite] Pokémon 25: back_shiny (owner_shiny=true)
[Sprite] Pokémon 6: front_default (owner_shiny=false)
```

---

## Edge Cases

### 1. Reconexión (Reconnect)
**Paso:**
1. P1 inicia batalla
2. P1 desconecta y reconecta
3. Battle state se restaura desde servidor

**Esperado:**
- Pokémon de P1 siguen con back_shiny
- Pokémon de P2 siguen con front_default

### 2. Rematch
**Paso:**
1. Batalla termina
2. Ambos jugadores aceptan rematch
3. Nueva batalla inicia

**Esperado:**
- `loadTeamMoves()` re-ejecuta y recalcula owner_shiny desde user.shiny_pack
- Pokémon de P1 usan shiny si P1 aún tiene shiny_pack=true

### 3. Ver Batalla (Viewer/Spectator)
**Paso:**
1. Otro usuario se une como espectador
2. Recibe battle:start

**Esperado:**
- Espectador ve exactamente lo mismo que los 2 jugadores
- P1's Pokémon con shiny, P2's sin shiny (suponiendo mismo setup)

---

## Checklist de Validación

- [ ] Backend: serializePokemon() loguea owner_shiny correctamente
- [ ] Frontend: battle:start contiene owner_shiny para ambos jugadores
- [ ] Frontend: getPokemonBattleSprite() usa owner_shiny como fuente única de verdad
- [ ] Frontend: Spreads en setBattleState preservan owner_shiny (no sobrescriben)
- [ ] Frontend: Ataque y ataques reciben Pokémon completos del backend
- [ ] Frontend: Switch mantiene shiny/default del nuevo Pokémon
- [ ] Frontend: Fin de turno (efectos) preserva sprites
- [ ] Browser DevTools: WS messages contienen owner_shiny
- [ ] Console: Backend loguea owner_shiny, Frontend loguea decisión de sprite
- [ ] Reconexión: Pokémon mantienen shiny/default
- [ ] Rematch: owner_shiny recalculado correctamente

---

## Prueba Rápida de Regresión

Si los sprites ahora funcionan, estos escenarios NO deben tener problemas:

1. ✅ Dos jugadores normales (sin shiny) ven sprites default todo el tiempo
2. ✅ Un jugador con shiny, otro sin; se ven distintos a ambos clientes
3. ✅ Cambio de Pokémon mantiene shiny/default correcto
4. ✅ Daño de ataques NO afecta sprite (seguirá siendo shiny o default)
5. ✅ Efectos de turno (burn, poison) NO cambian sprite

---

## Logs de Referencia

### Backend (battleHandler.ts)
```typescript
// En loadTeamMoves() - línea ~270
console.log(`[BATTLE] Equipo de jugador ${playerId} cargado, owner_shiny asignado`);

// En serializePokemon() - línea ~360
console.log(`[BATTLE] serializePokemon: ${pokemon.name} serializado correctamente (owner_shiny: ${pokemon.owner_shiny})`);

// En battle:action-result - línea ~830
// El broadcast ahora incluye attackerPokemon y defenderPokemon completos
```

### Frontend (Battle.tsx + spriteResolver.ts)
```typescript
// En getPokemonBattleSprite() - spriteResolver.ts
console.debug(`[Sprite] Pokémon ${pokemon.pokeapiId || 'unknown'}: ${spriteType}_${variant} (owner_shiny=${useShiny})`);

// En battle:action-result handler - Battle.tsx línea ~1300
// Ahora usa message.data.attackerPokemon y message.data.defenderPokemon
```

---

## Notas Importantes

1. **Source of Truth**: `pokemon.owner_shiny` es la ÚNICA fuente de verdad
   - Se calcula una vez en backend basado en `user.shiny_pack`
   - Se envía en TODOS los broadcasts
   - Frontend lo preserva en todos los spreads

2. **No es por Posición**: La decisión NO es "si es jugador 1 o 2"
   - Es "si el DUEÑO tiene shiny_pack"
   - P1 puede tener shiny o default; P2 idem
   - Se ve igual para ambos clientes

3. **Broadcasts**: Todos los message types incluyen Pokémon serializados:
   - battle:start, battle:turn-end, battle:switch-success
   - battle:end-of-turn-effects, battle:action-result, battle:end

4. **Logging Temporal**: console.debug en spriteResolver puede removerse
   - Mantenerlo para development
   - Remover en producción si causa noise
