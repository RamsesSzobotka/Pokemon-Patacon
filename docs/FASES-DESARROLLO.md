# Plan de Desarrollo Incremental
## Pokémon Patacon - Battle Arena

**Versión:** 1.1 (Actualizado 13 Mayo 2026)  
**Fecha Base:** 12 de Mayo de 2026

---

## Estrategia General

### MVP (Fase 1-5) vs Fase 2 Mejorada

**MVP (Mínimo Viable):** Entrega base funcional sin opcionales
- Backend: API REST, Pokémon, salas, batalla básica, daño, efectos
- Frontend: UI completa, draft, batalla con 4 acciones (atacar, cambiar, esperar)
- Resultado: Dos jugadores pueden jugar partidas completas 1v1

**Fase 2 Mejorada (Opcionales):** Características adicionales post-MVP
- Baneo de Pokémon en draft
- Orden avanzado (prioridad + velocidad)
- Clima/campos (lluvia, sol, arena, terreno)
- Temporizador por turno
- Replays y reconexión automática
- Modo espectador y filtros avanzados

La presente guía documenta el **MVP completo**. Los opcionales se implementan después de validar que el MVP es jugable.

---

## FASE 1: Backend Core - API REST y Base de Datos

### Objetivo
Construir la base del sistema: API REST, conexión a MongoDB, cliente de PokeAPI y gestión de salas.

### Tareas

#### 1.1 Configuración del Entorno Backend
- [x] Inicializar proyecto Bun + Hono ✅
- [x] Configurar TypeScript ✅
- [x] Crear estructura de carpetas (routes, services, models, middleware) ✅
- [x] Configurar variables de entorno (.env) ✅

#### 1.2 Conexión a MongoDB
- [x] Instalar driver MongoDB (`bun add mongodb`) ✅
- [x] Crear cliente de conexión en `backend/src/db/mongo.ts` ✅
- [x] Definir esquemas (schemas) para:
  - Pokémon (pokemon.ts) ✅
  - Salas (room.ts) ✅

#### 1.3 Cliente PokeAPI con Caché
- [x] Crear servicio en `backend/src/services/pokeapiClient.ts` ✅
- [x] Implementar función para obtener Pokémon por ID ✅
- [x] **Validar exactamente 4 movimientos:** Excluir Pokémon con < 4 movimientos válidos ✅
- [x] Implementar cacheo en MongoDB ✅
- [x] Agregar lógica de TTL (30 días) ✅
- [x] **Importante:** No hacer excepciones; si un Pokémon no tiene 4 movimientos, debe excluirse o documentarse ✅

#### 1.4 API REST - Endpoints Pokémon
- [x] `GET /api/pokemon/:id` - Obtener Pokémon por ID ✅
- [x] `GET /api/pokemon/search?query=` - Búsqueda por nombre ✅
- [x] `GET /api/types` - Obtener tabla de tipos ✅
- [x] `GET /api/moves/:id` - Obtener datos de habilidad ✅
- [x] `GET /api/pokemon/legendaries/all` - Listar legendarios ✅

#### 1.5 API REST - Endpoints de Salas
- [x] `POST /api/rooms` - Crear sala (generar código único) ✅
- [x] `GET /api/rooms/:code` - Obtener estado de sala ✅
- [x] `DELETE /api/rooms/:code` - Eliminar/cancelar sala ✅
- [x] `POST /api/rooms/:code/join` - Unirse a sala ✅
- [x] `POST /api/rooms/:code/leave` - Salir de sala (extra) ✅

#### 1.6 Carga Inicial de Datos
- [x] Mejorar `backend/src/db/seeds.ts` para cargar stats y moves completos ✅
- [ ] Ejecutar carga inicial (requiere MongoDB corriendo)

**Entregable FASE 1:** Backend exposes Pokémon data via REST API, salas creables desde Postman/curl

---

## FASE 2: Backend - WebSocket y Motor de Batalla

### Objetivo
Implementar la lógica de batallas en tiempo real y sincronización entre jugadores.

### Tareas

#### 2.1 Servidor WebSocket
- [ ] Configurar WebSocket en Hono (`bun add ws`)
- [ ] Crear handler en `backend/src/websocket/handler.ts`
- [ ] Implementar manejo de conexiones por sala
- [ ] Agregar heartbeat para detectar desconexiones

#### 2.2 Gestión de Salas WebSocket
- [ ] `rooms.ts` - Track de jugadores por sala
- [ ] Eventos: connection, disconnect, room_join, room_leave

#### 2.3 Motor de Batalla (Battle Engine)
- [ ] Crear `backend/src/services/battleEngine.ts`

**Implementar nivel y stats fijos (Nivel 50):**
- [ ] Nivel = 50 (constante para todos los Pokémon)
- [ ] Generar IVs [0-31] por Pokémon al iniciar partida
- [ ] Calcular HP: `floor(((2 * baseHp + ivHp) * 50) / 100) + 50 + 10`
- [ ] Calcular otros stats: `floor(((2 * baseStat + ivStat) * 50) / 100) + 5`
- [ ] **Guardar IVs en estado de batalla (NO recalcular cada turno)**

**Implementar cálculo de daño completo:**
- [ ] Fórmula: `baseDamage = floor(floor(floor((2*50)/5+2) * movePower * atkStat / defStat) / 50) + 2`
- [ ] Multiplicadores: `modifier = randomFactor(85-100%) × stab × typeMultiplier × critical × burnModifier × fieldModifier`
- [ ] **Random Factor:** ±15% varianza (randomInt 85-100 / 100)
- [ ] **STAB:** 1.5 si tipo movimiento = tipo atacante; sino 1
- [ ] **Crítico:** 1.5 si random() < 1/24; sino 1
- [ ] **Quemadura:** 0.5 si atacante quemado Y movimiento físico; sino 1
- [ ] **Campo/Clima:** 1.0 por defecto (lluvia/sol en opcionales)

**Implementar precisión del movimiento:**
- [ ] `accuracy = move.accuracy ?? 100`
- [ ] `hitRoll = randomInt(1, 100)`
- [ ] `hits = hitRoll <= accuracy` (si falla, daño = 0)

**Implementar tabla de tipos (desde PokeAPI, NO hardcodeada):**
- [ ] `typeChart.ts` - Función getMultiplier(moveType, defenderType)
- [ ] Multiplicadores: x2, x0.5, x0, x1 según tipo atacante vs tipo defensor
- [ ] Si defensor tiene 2 tipos: multiplicar ambos (ej: Eléctrico vs Agua/Volador = x2 × x2 = x4)
- [ ] Si typeMultiplier === 0: daño final = 0

**Implementar determinación de stat según categoría:**
- [ ] Si move.damageClass === 'physical': usar attack/defense
- [ ] Si move.damageClass === 'special': usar sp.attack/sp.defense
- [ ] Si move.damageClass === 'status': damage = 0

**Implementar modificadores temporales de stats:**
- [ ] System stage: clamp(stage, -6, 6)
- [ ] Si stage >= 0: multiplier = (2 + stage) / 2
- [ ] Si stage < 0: multiplier = 2 / (2 - stage)
- [ ] effectiveStat = floor(baseStat × multiplier)
- [ ] Al cambiar/retirar Pokémon: resetear todos los stages a 0

- [ ] Implementar lógica de turnos
- [ ] Implementar tabla de tipos (`typeChart.ts`)
- [ ] Implementar efectos de estado (burn, paralysis, sleep, freeze, poison, confusion, attraction)
- [ ] Implementar decremento de duración de estados

#### 2.4 Efectos de Estado con Duraciones
- [ ] **Quemadura (Burn):** 3 turnos, -50% daño físico durante cálculo
- [ ] **Parálisis (Paralysis):** 3 turnos, -50% velocidad (visual), 25% no moverse (opcional)
- [ ] **Sueño (Sleep):** 3 turnos, Pokémon no ataca
- [ ] **Congelación (Freeze):** 3 turnos, Pokémon no ataca
- [ ] **Envenenamiento (Poison):** 3 turnos, daño pasivo `floor(maxHp * 0.05)` por turno
- [ ] **Atracción (Attraction):** 3 turnos, 50% chance de no atacar
- [ ] **Confusión (Confusion):** 3 turnos, 33% chance de atacar a sí mismo

**Decrementación:**
- [ ] Cada turno: `status.remainingTurns -= 1`
- [ ] Si `remainingTurns <= 0`: remover estado
- [ ] Al cambiar/retirar Pokémon: remover TODOS los estados

**Función recomendada:**
```typescript
if (move.damageClass === 'status' || !move.power) return 0
attackStat = chooseAttackStat(attacker, move.damageClass)
defenseStat = chooseDefenseStat(defender, move.damageClass)
baseDamage = floor(floor((floor((2 * level) / 5 + 2) * move.power * attackStat / defenseStat) / 50) + 2)
typeMultiplier = getTypeMultiplier(move.type, defender.types)
if (typeMultiplier === 0) return 0
modifier = randomFactor * stab * typeMultiplier * critical * burnModifier * fieldModifier
return max(1, floor(baseDamage * modifier))
```
- [ ] `battle:start` - Iniciar batalla tras selección de equipos
- [ ] `turn:action` - Recibir acción del jugador (atacar/cambiar/objeto)
- [ ] `turn:execute` - Ejecutar turno y enviar resultado a ambos
- [ ] `pokemon:fainted` - Notificar KO
- [ ] `pokemon:switched` - Notificar cambio de Pokémon
- [ ] `item:used` - Sincronizar uso de objetos
- [ ] `battle:end` - Finalizar batalla

#### 2.6 Sincronización
- [ ] Implementar servicio `syncService.ts`
- [ ] Definir formato de mensajes broadcast
- [ ] **Orden de Turnos (MVP):** Coinflip 50/50 cada turno (P(A ataca primero) = 0.5)
- [ ] Manejar reconexiones (enviar estado completo)
- [ ] Validar: evitar que jugador actúe 2 veces en mismo turno

**Entregable FASE 2:** Dos clientes pueden iniciar una batalla y jugar turnos completos con cálculo de daño preciso, efectos de estado, y sincronización correcta

---

## FASE 3: Frontend - Estructura Base y Componentes UI

### Objetivo
Configurar Tauri + Svelte y construir los componentes principales de la interfaz.

### Tareas

#### 3.1 Configuración del Entorno Frontend
- [ ] Inicializar proyecto Tauri + Svelte + Vite
- [ ] Configurar TypeScript
- [ ] Instalar dependencias (svelte-routing si es necesario)
- [ ] Crear estructura de carpetas

#### 3.2 Estilos y Tema
- [ ] Definir variables CSS (colores, fuentes)
- [ ] Crear estilos base (reset, tipografía)
- [ ] Agregar fonts (Press Start 2P, Bebas Neue)

#### 3.3 Componentes UI Principales
- [ ] `MainMenu.svelte` - Menú principal (ya existente)
- [ ] `RoomLobby.svelte` - Sala de espera
- [ ] `PokemonSprite.svelte` - Renderizador de sprites .gif

#### 3.4 Stores de Estado
- [ ] `store/room.js` - Estado de sala
- [ ] `store/pokemon.js` - Cache de Pokémon locales

#### 3.5 Servicios de Comunicación
- [ ] `services/pokemonApi.js` - Llamadas a API REST
- [ ] `services/websocket.js` - Cliente WebSocket

**Entregable FASE 3:** Frontend puede crear/unirse a salas y mostrar sprites de Pokémon

---

## FASE 4: Frontend - Selección de Equipo y Draft

### Objetivo
Implementar la pantalla de selección de equipos con mecánicas de draft.

### Tareas

#### 4.1 Componente DraftSelector
- [ ] Crear `DraftSelector.svelte`
- [ ] Implementar navegador de Pokémon (lista con filtros)
- [ ] Agregar búsqueda por nombre/tipo
- [ ] Mostrar preview (sprite, stats, moves, si es legendario)
- [ ] Mostrar equipo actual (6 slots)

#### 4.2 Lógica de Draft
- [ ] Implementar alternancia P1 → P2 → P1...
- [ ] Validar: no repetición de Pokémon
- [ ] Validar: máximo 1 legendario por equipo
- [ ] Sincronizar estado con servidor (eventos pokemon:selected, team:locked)

#### 4.3 Confirmación de Equipo
- [ ] Botón "LISTO" (habilitado con 6 Pokémon)
- [ ] Validar que ambos confirmen
- [ ] Enviar equipos al servidor

#### 4.4 Integración WebSocket Draft
- [ ] Escuchar eventos: pokemon:selected, team:locked
- [ ] Actualizar UI en tiempo real

**Entregable FASE 4:** Dos jugadores pueden seleccionar equipos mediante draft

---

## FASE 5: Frontend - Pantalla de Batalla

### Objetivo
Implementar la interfaz de batalla completa. Se divide en:
- **FASE 5.1 (MVP):** Versión funcional mínima sin objetos
- **FASE 5.2 (Mejorada):** Agregar sistema de objetos post-MVP

---

### FASE 5.1: Batalla MVP (Sin Objetos)

**ESTA ES LA VERSIÓN REQUERIDA PARA PASAR.** El sistema de objetos (5.2) es OPCIONAL post-MVP.

#### 5.1.1 Componente Battle
- [ ] Crear `Battle.svelte` - Pantalla principal
- [ ] Layout: arena con dos lados (Jugador vs Oponente)
- [ ] Mostrar sprites .gif animados de ambos Pokémon activos
- [ ] Barras de HP y estado (efectos activos)

#### 5.1.2 Panel de Acciones (MVP)
- [ ] Crear `ActionPanel.svelte`
- [ ] **Tres botones principales (MVP):**
  1. **Atacar** → selector de habilidades (4 botones)
  2. **Cambiar Pokémon** → selector de equipo
  3. **Esperar** (opcional) → pasar turno sin acción
- [ ] **NO incluir** botón de objetos en MVP
- [ ] Enviar selección via WebSocket

#### 5.1.3 Selector de Habilidades
- [ ] Mostrar 4 habilidades disponibles del Pokémon activo
- [ ] Mostrar: nombre, tipo, poder, precisión
- [ ] Enviar selección via WebSocket

#### 5.1.4 Selector de Cambio de Pokémon
- [ ] Mostrar los 5 Pokémon de reserva (no el activo)
- [ ] Validar: no puede seleccionar Pokémon debilitado
- [ ] Enviar selección via WebSocket

#### 5.1.5 Sincronización de Batalla
- [ ] Escuchar eventos: turn:execute, pokemon:fainted, pokemon:switched
- [ ] Renderizar animaciones sincronizadas
- [ ] Actualizar HP en tiempo real

#### 5.1.6 Fin de Batalla
- [ ] Mostrar pantalla de victoria/derrota
- [ ] Mostrar equipo restante
- [ ] Botones: "Revancha" o "Menú Principal"

**Entregable 5.1 (MVP):** Batalla funcional y jugable con ataques y cambios de Pokémon. DOS JUGADORES PUEDEN COMPLETAR UNA PARTIDA DESDE INICIO A FIN.

---

### FASE 5.2: Batalla Mejorada (Con Objetos - OPCIONAL POST-MVP)

#### 5.2.1 Integración de Objetos en Panel de Acciones
- [ ] Agregar botón "Objetos" en `ActionPanel.svelte`
- [ ] Habilitar/deshabilitar según inventario disponible

#### 5.2.2 Menú de Objetos
- [ ] Crear `ObjectsMenu.svelte`
- [ ] Mostrar inventario: Pociones (3/3), Revivir (2/2)
- [ ] Indicador visual de disponibilidad (verde/gris/naranja)

#### 5.2.3 Validaciones de Uso
- [ ] Poción: solo si HP del activo < 100%
- [ ] Revivir: solo si hay Pokémon debilitados en el equipo

#### 5.2.4 Sincronización de Objetos
- [ ] Evento WebSocket `item:used`
- [ ] Actualizar contadores en tiempo real para ambos jugadores

**Entregable 5.2:** Batalla completa con sistema de objetos (pociones y revivir). SóLO DESPUÉS DE VALIDAR QUE MVP ES FUNCIONAL.

---

## FASE 6: Polish del MVP

### Objetivo
Mejorar experiencia visual del MVP. **Estos items NO son bloqueantes; MVP es jugable sin ellos.**

### Tareas

#### 6.1 Animaciones (MVP Polish)
- [ ] Animación de ataque (sprite + efecto visual)
- [ ] Animación de daño (destello rojo, número flotante)
- [ ] Animación de cambio de Pokémon
- [ ] Animación de efectos de estado (iconos animados)
- [ ] Animación de coinflip

#### 6.2 Sonidos (MVP Polish)
- [ ] Efectos de sonido para ataques
- [ ] Sonido de daño y KO
- [ ] Sonido de victoria/derrota
- [ ] Música de fondo de batalla (loop)

#### 6.3 UI Polish
- [ ] Barras de HP con transiciones suaves
- [ ] Indicadores visuales de estado (iconos burn, paralysis, sleep, etc)
- [ ] Mensaje "Tu turno" / "Esperando oponente..."
- [ ] Log de batalla con historial de acciones

**Entregable FASE 6 (MVP Pulido):** MVP completamente jugable con UI/animaciones/sonidos funcionales

---

## FASE 7: Opcionales y Mejoras (Post-MVP)

### Objetivo
**ESTAS FASES SON SOLO SI QUEDA TIEMPO.** Se implementan después de que el MVP esté validado.

Ver sección "Opcionales / Fase 2" en el PRD para detalles:
- Sistema de baneos en draft
- Orden avanzado (prioridad + velocidad)
- Clima/campos (lluvia, sol, arena, terreno)
- Temporizador por turno
- Historial y replay de partidas
- Reconexión automática
- Modo espectador
- Filtros avanzados en Pokédex

---

## Orden de Desarrollo Sugerido (MVP)

```
Backend MVP: FASE 1 → FASE 2
             ↑
             ↑ (API + WebSocket funcionando)
             ↑
Frontend MVP: FASE 3 → FASE 4 → FASE 5.1 → FASE 6
                         ↑
                    (Draft necesario
                     antes de batalla)

Post-MVP (si queda tiempo):
             FASE 5.2 (Objetos) → FASE 7 (Opcionales del PRD)
```

### Justificación

1. **Backend primero (FASE 1-2)** porque el frontend depende de la API para funcionar
   - FASE 1: API REST básica
   - FASE 2: WebSocket + batalla engine (motor debe estar listo ANTES de que frontend intente comunicar)

2. **Frontend estructural (FASE 3)** establece componentes base que todas las fases futuras usan

3. **Draft antes de batalla (FASE 4 → FASE 5)** porque la selección de equipo debe completarse antes de empezar

4. **Battle MVP (FASE 5.1)** es la versión mínima jugable SIN objetos
   - Esto es lo que se entrega para pasar
   - Validar que 2 jugadores pueden jugar partidas completas

5. **Polish (FASE 6)** mejora la experiencia del MVP pero NO añade funcionalidad core

6. **Objetos (FASE 5.2)** se implementa DESPUÉS de validar que MVP funciona

7. **Opcionales (FASE 7)** solo si quedan días/semanas disponibles post-validación

---

## Notas Importantes — Cambios del PRD (Actualización 13 Mayo 2026)

### Especificaciones Críticas para FASE 2 (Backend)

**1. IVs Generados por Partida**
- Al iniciar batalla: generar IV[0-31] para CADA stat de CADA Pokémon
- Guardar en estado de batalla, NO recalcular cada turno
- Resultado: Mismo Pokémon tiene stats ligeramente diferentes en cada batalla

**2. Nivel Fijo = 50**
- TODOS los Pokémon en batalla tienen nivel 50 (constante, no variable)
- Simplifica el cálculo y balancea el juego

**3. Exactamente 4 Movimientos**
- CERO excepciones: si Pokémon no tiene 4 movimientos válidos desde PokeAPI, debe excluirse
- No adaptar/rellenar movimientos
- Validación en FASE 1.3

**4. Fórmula de Daño Completa**
- Ver FASE 2.3 para especificación exacta
- Incluir TODOS los multiplicadores: random, STAB, tipo, crítico, quemadura, clima
- NO simplificar
- Testing: verificar x4 (eléctrico vs Agua/Volador) funciona

**5. Tabla de Tipos desde PokeAPI**
- NUNCA hardcodear la tabla de tipos
- Siempre llamar endpoint `/type/{id}/` para obtener multiplicadores

**6. Efectos de Estado**
- Todos duran **3 turnos exactos** (no 2, no 4)
- Decrementan 1 por turno: `status.remainingTurns -= 1`
- Se eliminan al cambiar/retirar Pokémon
- Ver tabla en FASE 2.4 para efectos específicos

### Sobre el MVP

- **MVP = Versión jugable sin opcionales**
- No incluir: baneos, orden avanzado, clima, temporizador, replay, espectador
- Sí incluir: coinflip 50/50 simple (orden avanzado es Fase 7)
- Meta final: Dos jugadores pueden jugar partidas 1v1 **COMPLETAS** desde inicio a fin

### Sobre los Opcionales

- Ver sección "Opcionales / Fase 2" en el PRD para detalles completos
- Solo implementar SI MVP es completamente funcional y validado
- No son bloqueantes para pasar
- Pueden ser bonus adicionales si queda tiempo

### Otras Notas
- Las fases son incrementales: cada una entrega algo usable
- FASE 5.1 (sin objetos) es MVP; FASE 5.2 (con objetos) es post-MVP
- FASE 6 es polish del MVP (animaciones, sonidos, UI)
- FASE 7 es opcionales (todo lo que NO es core)
- Fases 1-2 (Backend) son críticas; sin ellas el frontend no puede comunicarse