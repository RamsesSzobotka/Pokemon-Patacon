# Product Requirements Document (PRD)
## Pokemon Patacon - Battle Arena

**Versión:** 1.0  
**Fecha:** 12 de Mayo de 2026  
**Estado:** Inicial  
**Entrega Esperada:** Próxima semana

---

## 1. Visión General

**Nombre del Producto:** Pokémon Patacon  
**Género:** Videojuego de Batallas Competitivas 1v1  
**Generación:** Pokémon Black/White (Generación V)  
**Estilo de Referencia:** Pokémon Stadium, Pokémon Champions

Pokémon Patacon es un videojuego de batallas Pokémon en tiempo real donde dos jugadores compiten simultáneamente en partidas 1v1 a través de una interfaz moderna. Basado en la **Generación V (Black/White)**, incluirá todos los **649 Pokémon de Generaciones I-V**, utilizando los **sprites animados .gif** característicos de Black/White. El juego utiliza la API oficial de Pokémon (PokeAPI v2) para obtener datos, almacenándolos en una base de datos local para mejor rendimiento.

---

## 2. Objetivos Principales

- ✅ Crear un sistema de batallas Pokémon competitivo, fluido y sin lag
- ✅ Permitir multijugador en tiempo real con salas de juego
- ✅ Acceso sin requerimiento de autenticación (inicio de sesión)
- ✅ Soportar todos los 649 Pokémon de Gen I-V con sus habilidades y stats
- ✅ Crear una experiencia visualmente atractiva con animaciones y sonidos
- ✅ Implementar un sistema de balanceo basado en tipos y efectos de estado

---

## 3. Características Funcionales Principales

### 3.1 Sistema de Salas Multijugador

| Feature | Descripción |
|---------|------------|
| **Crear Sala** | Jugador A crea una sala única con código de sala (4-6 caracteres) |
| **Código de Sala** | Identificador único para acceder a la sala |
| **Invitar Jugador** | Jugador B ingresa el código para unirse a la sala |
| **Búsqueda de Sala** | Validación y búsqueda por código en BD |
| **Límite de Jugadores** | Máximo 2 jugadores por sala (1v1) |
| **Timeout de Sala** | Salas inactivas se cierran después de 30 minutos |
| **Lobby Pre-batalla** | Ambos jugadores seleccionan equipo antes de iniciar |

### 3.2 Pokédex Disponible (Generación V - Pool Fijo)

**Pool de Pokémon:** Exactamente **649 Pokémon** (Gen I-V, fijo del proyecto)

- **Generación I (Kanto):** 151 Pokémon (Bulbasaur #1 - Mew #151)
- **Generación II (Johto):** 100 Pokémon nuevos (Chikorita #152 - Ho-Oh #251)
- **Generación III (Hoenn):** 135 Pokémon nuevos (Treecko #252 - Deoxys #386)
- **Generación IV (Sinnoh):** 107 Pokémon nuevos (Turtwig #387 - Arceus #493)
- **Generación V (Unova):** 156 Pokémon nuevos (Victini #494 - Genesect #649)
- **Total disponible:** **649 Pokémon de ID 1-649** (todas las generaciones hasta Gen V)
- **Legendarios:** Máximo 1 por equipo. Lista validada: ~48 legendarios incluidos Victini, Reshiram, Zekrom, Kyurem, etc. *(ver LEGENDARIOS.md para lista completa)*
- **Sprites Black/White:** Todos los 649 mostrarán sprites .gif animados de Pokémon Black/White desde PokeAPI:
  - URL oficial: `https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/{id}.gif`
  - Fallback a PNG si .gif no disponible
- **Movepool:** Cada Pokémon tiene exactamente 4 movimientos válidos en Gen V (validados en PokeAPI)
- **Validación:** Todos los 649 tienen 4+ movimientos válidos; ninguno se excluye por falta de movimientos
- **Data:** Importada desde PokeAPI v2 al iniciar; persistida en MongoDB para caché local (no hardcodeada)

### 3.3 Selección de Equipo

| Requirement | Especificación |
|-------------|----------------|
| **Cantidad de Pokémon** | 6 Pokémon por equipo |
| **Legendarios** | Máximo 1 legendario por equipo |
| **No Repetibles** | Un mismo Pokémon no puede aparecer dos veces |
| **Selección Secuencial** | Se alterna: P1 elige → P2 elige → P1 elige (draft style) |
| **Interfaz** | Búsqueda por nombre/tipo, preview de stats y habilidades |
| **Confirmación** | Ambos jugadores deben confirmar equipo para iniciar batalla |

### 3.4 Sistema de Batallas

#### 3.4.1 Mecánica General

```
Pre-batalla:
  ├─ Ambos equipos seleccionados ✓
  ├─ Coinflip determina quién ataca primero
  └─ Se inicia la batalla

Por Turno:
  1. Jugador Activo selecciona Pokémon activo (si le queda)
  2. Selecciona una de 4 habilidades disponibles
  3. Coinflip determina orden de ejecución si ambos atacan
  4. Se aplica daño, efectos de estado, cambios de stats
  5. Se verifica si hay KO
  6. Se alternan turnos
  7. Efectos de estado decrecen (-1 turno)

Victoria/Derrota:
  └─ Se alcanza cuando un equipo pierde todos sus Pokémon
```

#### 3.5.2 Sistema de Turnos

| Aspecto | Especificación |
|--------|-----------------|
| **Orden de Turnos** | Coinflip (50/50) cada turno para decidir quién ataca primero |
| **SIN Cálculo de Velocidad** | La estadística de velocidad NO afecta el orden |
| **Acciones por Turno** | 1 acción = 1 habilidad ó cambio de Pokémon |
| **Tiempo Real** | Velocidad moderada para permitir reacción (indicador visual de contador) |
| **Sincronización** | Ambos clientes sincronizados mediante servidor Hono |

### 3.5 Sistema de Habilidades (Movimientos)

| Parámetro | Detalles |
|-----------|----------|
| **Habilidades por Pokémon** | Exactamente 4 movimientos por Pokémon en batalla |
| **Selección de Movimientos** | Elegidos del movepool disponible en PokeAPI del Pokémon |
| **No Repetibles** | Un mismo movimiento no puede aparecer dos veces |
| **Exclusión de Pokémon** | Si un Pokémon no tiene 4 movimientos válidos, se excluye o se maneja con regla documentada |
| **Fuente de Datos** | PokeAPI v2: `pokemon/{id}/moves` |
| **Atributos por Movimiento** | Nombre, Tipo, Poder (Power), Precisión (Accuracy), Prioridad, Categoría de daño (Physical/Special/Status) |
| **PP en Batalla** | Sin limitación de PP (sin necesidad de rastrear) |
| **Efectos Especiales** | Daño fijo, daño porcentual, cambio de stats, aplicación de estados |

### 3.6 Sistema de Daño y Tipos

#### 3.6.1 Nivel y Stats Fijos

Todos los Pokémon en batalla tienen **nivel 50** fijo (no variable).

```
Calcular Stats Iniciales:
  level = 50
  iv = randomInt(0, 31)  // IV generado al iniciar partida, NO se recalcula cada turno
  hp = floor(((2 * baseHp + ivHp) * level) / 100) + level + 10
  stat = floor(((2 * baseStat + ivStat) * level) / 100) + 5

Donde:
- baseHp, baseStat: Valores base del Pokémon desde PokeAPI
- iv: Valor Individual generado aleatoriamente [0-31] por Pokémon
- Estos IVs se guardan en el estado de batalla y NO se recalculan
```

#### 3.6.2 Cálculo de Daño Completo

```
baseDamage = floor(
  floor(
    floor((2 * level) / 5 + 2) * movePower * attackStat / defenseStat
  ) / 50
) + 2

finalDamage = floor(baseDamage * modifier)

modifier = randomFactor * stab * typeMultiplier * critical * burnModifier * fieldModifier

Donde:
- level = 50
- movePower = Poder del movimiento (desde PokeAPI)
- attackStat = ATK (físico) o SpA (especial) según damageClass
- defenseStat = DEF (física) o SpD (especial) según damageClass
- randomFactor = randomInt(85, 100) / 100  // Varianza de ±15%
- stab = 1.5 si tipo movimiento coincide con tipo atacante; si no, 1
- typeMultiplier = x2, x0.5, x0 o x1 por efectividad de tipo
- critical = 1.5 si random() < 1/24; si no, 1
- burnModifier = 0.5 si atacante quemado y movimiento físico; si no, 1
- fieldModifier = 1 (por defecto; lluvia/sol en opcionales)

Si movimiento falla por precisión: finalDamage = 0
Si typeMultiplier === 0: finalDamage = 0
```

#### 3.6.3 Determinación de Stat según Categoría

```
if (move.damageClass === 'physical') {
  attackStat = attacker.attack
  defenseStat = defender.defense
}
if (move.damageClass === 'special') {
  attackStat = attacker.specialAttack
  defenseStat = defender.specialDefense
}
if (move.damageClass === 'status') {
  damage = 0
}
```

#### 3.6.4 Multiplicador por Tipo

```
typeMultiplier = 1
for (const defenderType of defender.types) {
  typeMultiplier *= getMultiplier(move.type, defenderType)
}

if (typeMultiplier === 0) {
  finalDamage = 0
}

Ejemplo: Un movimiento eléctrico contra Agua/Volador produce x2 * x2 = x4
```

**La tabla de tipos se obtiene desde PokeAPI, NO está hardcodeada.** Cada combinación (movimiento tipo vs Pokémon tipo) se consulta desde el endpoint `/type/{id-or-name}/`.

#### 3.6.5 Precisión del Movimiento

```
accuracy = move.accuracy ?? 100
hitRoll = randomInt(1, 100)
hits = hitRoll <= accuracy

Si el movimiento falla: no se calcula daño ni efecto.
```

#### 3.6.6 Modificadores Temporales de Stats

Durante batalla, los stats pueden cambiar temporalmente (ej: Ataque +2):\n\n```
stage = clamp(stage, -6, 6)  // Mínimo -6, máximo +6

if (stage >= 0) {
  multiplier = (2 + stage) / 2
} else {
  multiplier = 2 / (2 - stage)
}

effectiveStat = floor(baseBattleStat * multiplier)
```

**Comportamiento:**
- Si el Pokémon es cambiado o retirado, sus modificadores temporales se eliminan
- Los modificadores solo afectan cálculos de daño (no la precisión del turno)

### 3.7 Sistema de Efectos de Estado

| Estado | Duración | Efecto Mecánico | Puede Removerse |
|--------|----------|-----------------|-----------------|
| **Quemadura (Burn)** | 3 turnos | -50% Ataque físico efectivo (durante aplicación de daño) | Sí (habilidad/item) |
| **Parálisis (Paralysis)** | 3 turnos | -50% velocidad (cosmético, no afecta orden) + 25% chance no moverse (opcional) | Sí |
| **Sueño (Sleep)** | 3 turnos | Pokémon no ataca, despierta al recibir daño | Sí |
| **Congelación (Freeze)** | 3 turnos | Pokémon no ataca | Sí |
| **Envenenamiento (Poison)** | 3 turnos | -5% HP máximo por turno (daño pasivo) | Sí |
| **Atracción (Attraction)** | 3 turnos | 50% chance de no atacar | Sí |
| **Desorientación (Confusion)** | 3 turnos | 33% chance de atacar a sí mismo | Sí |

**Comportamiento:**
- Decrecen 1 turno por cada acción del Pokémon afectado: `status.remainingTurns -= 1`
- Habilidades de "quitar estado" (ej: Refresh) limpian todos los estados
- Máximo 1 estado no-volátil por Pokémon (excepto confusión/atracción que son volátiles)
- Si el Pokémon es cambiado o retirado, el estado temporal se elimina

**Daño por Estados Pasivos:**
```
burnDamage = floor(target.maxHp * 0.05)
poisonDamage = floor(target.maxHp * 0.05)
status.remainingTurns -= 1
if (status.remainingTurns <= 0) removeStatus(target)
```

### 3.8 Sistema de Stats

| Stat | Base | Comportamiento |
|------|------|-----------------|
| **HP** | Máximo del Pokémon | Disminuye con daño recibido |
| **Ataque (ATK)** | Máximo | Base para cálculo de daño físico |
| **Defensa (DEF)** | Máximo | Base para reducción de daño físico |
| **Ataque Especial (SpA)** | Máximo | Base para cálculo de daño especial |
| **Defensa Especial (SpD)** | Máximo | Base para reducción de daño especial |
| **Velocidad (SPE)** | Máximo | **VISUAL ONLY** (no afecta orden de turnos) |

**Opcionales (Fase 2):**
- **Stats Variables por Porcentaje:** Mostrar barra de HP con % (ej: "80% ATK"), permitir cambios temporales de stats por habilidades

### 3.9 Sistema de Objetos en Batalla

| Objeto | Cantidad | Efecto | Cooldown |
|--------|----------|--------|----------|
| **Poción Total** | 3 máximo | Restaura 100% HP del Pokémon activo | 1 uso por objeto |
| **Revivir** | 2 máximo | Revive un Pokémon debilitado con 50% HP | 1 uso por objeto |

**Mecánica:**
- **Disponibilidad:** 1 botón "Objetos" en el panel de acciones cada turno (junto a "Atacar" y "Cambiar Pokémon")
- **Interfaz:** Muestra inventario actual (ej: "Pociones: 2/3 | Revivir: 1/2")
- **Restricción:** No puede usarse poción si el Pokémon activo está al 100% HP
- **Revivir:** Solo aplica a Pokémon del equipo que están debilitados (no al activo)
- **Sincronización:** El objeto se consume inmediatamente y ambos jugadores ven el cambio
- **Ataque después:** Usar un objeto = 1 acción del turno (no ataca en ese turno)

### 3.10 Sistema de Base de Datos Pokémon

#### Flujo de Datos:

```
1. Usuario selecciona Pokémon
   ↓
2. Sistema verifica si existe en MongoDB
   ├─ Sí: Recupera datos locales (rápido)
   └─ No: Llama PokeAPI v2
   ↓
3. Si viene de API: Extrae datos y almacena en MongoDB
   ├─ ID, Nombre, Sprites, Stats, Tipos
   ├─ Moveset (habilidades aprendibles)
   └─ Datos de evolución, peso, altura
   ↓
4. Retorna datos al cliente
```

#### Estructura de Documento Pokémon (MongoDB)

```json
{
  "_id": ObjectId,
  "pokeapi_id": 1,
  "name": "Bulbasaur",
  "type": ["Grass", "Poison"],
  "stats": {
    "hp": 45,
    "attack": 49,
    "defense": 49,
    "sp_attack": 65,
    "sp_defense": 65,
    "speed": 45
  },
  "moves": [
    { "name": "Tackle", "power": 40, "accuracy": 100, "type": "Normal" },
    // ... 3 more moves
  ],
  "is_legendary": false,
  "sprites": {
    "official_artwork": "url",
    "front_default": "url"
  },
  "cached_at": ISODate,
  "updated_at": ISODate
}
```

---

## 4. Requisitos Técnicos

### 4.1 Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|----------|
| **Frontend** | TanStack Start + Vite | Web progresiva (SPA), UI moderna, sin compilación nativa |
| **Backend** | Bun + Hono | Servidor HTTP/WebSocket rápido y ligero, sin Node.js |
| **Base de Datos** | MongoDB | Almacenar Pokémon cacheados, salas, historial |
| **API Externa** | PokeAPI v2 | Datos de Pokémon (https://pokeapi.co/api/v2/) |

### 4.2 Arquitectura

**Plataforma:** Aplicación Web Progresiva (SPA) ejecutada en navegador, sin requerimientos de instalación nativa.

```
┌─────────────────────────────────────────┐
│      Navegador (TanStack Start + Vite)  │
│  - UI Batalla en tiempo real             │
│  - Selección de Equipo (draft)           │
│  - Gestión de Salas Multijugador         │
│  - WebSocket conectado permanente        │
└────────────┬────────────────────────────┘
             │ HTTP + WebSocket (ws://)
             ↓
┌─────────────────────────────────────────┐
│      Hono Server (Bun Runtime)          │
│  - REST API: GET /api/pokemon/:id       │
│  - WebSocket: ws://host/battle/:roomId  │
│  - Motor de Batalla: turnos, daño       │
│  - Sincronización en tiempo real         │
│  - Gestión de salas en memoria          │
└────────────┬────────────────────────────┘
             │
   ┌─────────┼─────────┐
   ↓         ↓         ↓
MongoDB   PokeAPI   Cache Local
(persistencia) (fetch on-demand) (sprites, type matchups)
```

**Notas de Implementación:**
- CORS habilitado en Bun para desarrollo (`localhost:*`) y producción (dominio específico)
- WebSocket nativo: Bun maneja upgrade de HTTP a WS automáticamente
- Salas: estado en memoria de Bun + persistencia opcional en MongoDB para historial
- Sprites: descargados on-demand desde PokeAPI, cacheados en navegador + MongoDB

### 4.3 Endpoints Básicos

#### REST API

```
GET    /api/pokemon/search?query=pikachu
GET    /api/pokemon/:id
GET    /api/moves/:move_id
GET    /api/types
GET    /api/legendaries

POST   /api/rooms
GET    /api/rooms/:code
DELETE /api/rooms/:code
```

#### WebSocket Events

```
battle:start          → Inicia la batalla
turn:action          → Jugador selecciona acción
turn:execute         → Servidor ejecuta turno
pokemon:fainted      → Pokémon debilitado
pokemon:selected     → Jugador seleccionó Pokémon (draft)
item:used           → Objeto consumido en batalla
battle:end           → Batalla finalizada
```

### 4.4 Estructura de Carpetas del Proyecto

```
pokemon-patacon/
│
├── frontend/                      # TanStack Start + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Battle.tsx             # Pantalla principal de batalla
│   │   │   ├── PokemonSprite.tsx      # Renderer de sprites .gif
│   │   │   ├── ActionPanel.tsx        # Panel de acciones (atacar, cambiar, objetos)
│   │   │   ├── ObjectsMenu.tsx        # Menú de objetos (pociones, revivir)
│   │   │   ├── DraftSelector.tsx      # Selector de equipo (draft)
│   │   │   ├── RoomLobby.tsx          # Sala de espera
│   │   │   └── MainMenu.tsx           # Menú principal
│   │   ├── store/
│   │   │   ├── battle.ts              # Estado de batalla (TanStack Store)
│   │   │   ├── room.ts                # Estado de sala
│   │   │   └── pokemon.ts             # Cache de Pokémon
│   │   ├── services/
│   │   │   ├── websocket.ts           # WebSocket client
│   │   │   ├── pokemonApi.ts          # Llamadas a API backend
│   │   │   └── sync.ts                # Sincronización
│   │   ├── utils/
│   │   │   ├── damage.ts              # Cálculo de daño
│   │   │   ├── typeChart.ts           # Tabla de tipos
│   │   │   └── spriteRenderer.ts      # Manejo de .gif animados
│   │   ├── App.tsx
│   │   └── main.js
│   ├── public/
│   │   └── assets/
│   │       ├── sprites/                # Sprites .gif de Pokémon (generados o descargados)
│   │       ├── sounds/                 # Efectos de sonido
│   │       └── music/                  # BGM de batalla
│   ├── vite.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                       # Bun + Hono
│   ├── src/
│   │   ├── routes/
│   │   │   ├── pokemon.ts             # GET /api/pokemon/:id, /search
│   │   │   ├── rooms.ts               # POST /api/rooms, GET /api/rooms/:code
│   │   │   ├── types.ts               # GET /api/types
│   │   │   └── moves.ts               # GET /api/moves/:id
│   │   ├── websocket/
│   │   │   ├── handler.ts             # Event handlers (battle:start, turn:action, etc)
│   │   │   ├── sync.ts                # Sincronización de estado
│   │   │   └── rooms.ts               # Gestión de conexiones por sala
│   │   ├── services/
│   │   │   ├── battleEngine.ts        # Lógica de turnos, daño, efectos
│   │   │   ├── pokeapiClient.ts       # Cliente de PokeAPI con caché
│   │   │   ├── objectManager.ts       # Gestión de objetos (pociones, revivir)
│   │   │   ├── typeChart.ts           # Tabla de tipos
│   │   │   └── syncService.ts         # Envío de actualizaciones sincronizadas
│   │   ├── models/
│   │   │   ├── pokemon.ts             # Schema de Pokémon
│   │   │   ├── room.ts                # Schema de sala
│   │   │   ├── battle.ts              # Estado de batalla
│   │   │   └── objects.ts             # Inventario de objetos
│   │   ├── middleware/
│   │   │   ├── wsAuth.ts              # Autenticación WebSocket (sesión anónima)
│   │   │   └── errorHandler.ts        # Manejo de errores
│   │   ├── db/
│   │   │   ├── mongo.ts               # Conexión a MongoDB
│   │   │   └── seeds.ts               # Carga inicial de Pokémon Gen V
│   │   ├── config/
│   │   │   ├── constants.ts           # Constantes del juego
│   │   │   └── env.ts                 # Variables de entorno
│   │   └── index.ts                   # Entrada principal (Hono app)
│   ├── .env.example
│   ├── bun.lockb
│   ├── tsconfig.json
│   └── package.json
│
├── docs/
│   ├── PRD.md                      # Este documento
│   ├── API.md                      # Documentación de endpoints
│   └── ARCHITECTURE.md             # Detalles técnicos profundos
│
├── .gitignore
└── README.md
```

### 4.5 Sincronización en Tiempo Real (WebSocket)

**Principio:** Ambas pantallas (Jugador A y B) ven cambios instantáneamente

#### 4.5.1 Eventos de Sincronización

| Evento | Trigger | Quién lo recibe | Efecto en Pantalla |
|--------|---------|-----------------|-------------------|
| **pokemon:selected** | Jugador selecciona Pokémon en draft | Ambos | Pokémon se marca como NO disponible en el otro lado |
| **team:locked** | Ambos jugadores confirman equipo | Ambos | Se inicia pantalla de selección inicial |
| **turn:action** | Jugador ejecuta acción | Otro jugador | Se muestra animación de espera ("Jugador B está eligiendo...") |
| **turn:execute** | Servidor procesa turno | Ambos | Se sincronizan animaciones, daño, efectos de estado |
| **pokemon:switched** | Jugador cambia Pokémon | Ambos | Se muestra animación de cambio en tiempo real |
| **item:used** | Jugador usa poción/revivir | Ambos | Se actualiza contador de objetos en ambas pantallas |
| **pokemon:fainted** | HP llega a 0 | Ambos | Se muestra animación KO, opción de cambiar Pokémon |
| **battle:end** | Última Pokémon cae | Ambos | Pantalla de victoria/derrota sincronizada |

#### 4.5.2 Flujo de Sincronización por Turno

```
TURNO N - Sincronización Detallada:

1. Servidor recibe acción de Jugador A
   └─ Envía { event: "turn:waiting", player: "A" } a Jugador B

2. Servidor recibe acción de Jugador B
   └─ Acciones completas en ambos lados

3. Servidor procesa turno:
   ├─ Coinflip (compartido a ambos)
   ├─ Cálculo de daño
   ├─ Aplicación de efectos
   └─ Decremento de turnos de efectos

4. Broadcast a ambos clientes:
   {
     "event": "turn:execute",
     "turn": n,
     "actions": [
       {
         "player": "A",
         "action": "attack",
         "move": "Tackle",
         "damage": 42,
         "target_hp": 58,
         "effects_applied": ["none"]
       },
       {
         "player": "B",
         "action": "attack",
         "move": "Ember",
         "damage": 38,
         "target_hp": 62,
         "effects_applied": ["burn"]
       }
     ],
     "state": {
       "active_pokemon_a": { ... },
       "active_pokemon_b": { ... },
       "items_a": { "potion": 3, "revive": 2 },
       "items_b": { "potion": 2, "revive": 2 }
     }
   }

5. Frontend renderiza sincronizado:
   ├─ Ambos ven las mismas animaciones
   ├─ Mismo HP reflejado
   ├─ Mismo inventario
   └─ Mismo estado de efectos
```

#### 4.5.3 Manejo de Desconexiones

- **Desconexión antes de batalla:** Sala se elimina después de 5 segundos de espera
- **Desconexión durante batalla:** Juego se pausa, espera 30 segundos reconexión
- **Desconexión permanente:** Oponente gana automáticamente
- **Sincronización post-reconexión:** Se envía estado completo al cliente reconectado

---

## 5. Características Visuales

### 5.1 Interfaz (UI/UX)

- **Estilo Visual Principal:**
  - **Sprites Pokémon:** Animados .gif de Pokémon Black/White (Generación V)
  - **Resolución:** 256x192 escalado (Black/White battle res)
  - **Interfaz:** Moderno con elementos retro (fusion estética)
  - **Paleta de Colores:** Inspirada en Black/White

- **Elementos Principales:**
  - Arena de batalla (2 lados, un Pokémon activo por lado con animación .gif)
  - Barra de HP y estado del Pokémon
  - Panel de acciones (3 botones): "Atacar" | "Cambiar Pokémon" | "Objetos"
  - Selector de habilidades (4 botones, solo si elige "Atacar")
  - Menú de objetos (desplegable con pociones y revivir disponibles)
  - Indicador de inventario (ej: "Pociones: 2/3 | Revivir: 1/2")
  - Chat/comunicación pre-batalla
  - Historial de acciones (log de batalla)
  - Indicador de estado "Esperando acción del oponente..."

### 5.2 Sprites y Assets de Generación V

| Recurso | Fuente | Descripción |
|--------|--------|-------------|
| **Sprites Batalla** | Pokémon Black/White .gif | Animaciones de Pokémon en batalla (frente) |
| **Sprites Movimiento** | Black/White back sprites | Pokémon entrenador (trasero, animado) |
| **Efectos de Ataque** | Black/White effect sprites | Efectos visuales de movimientos |
| **Paleta de Color** | Gen V official | Colores característicos de la era Black/White |

**Nota:** Los .gif de Black/White incluyen loops de 2-4 frames para cada Pokémon. El frontend mostrará estos loops durante la batalla con timing sincronizado a los turnos.

### 5.3 Panel de Objetos (Interfaz)

**Interfaz del Menú de Objetos:**

```
┌─ OBJETOS ────────────────────────────────────┐
│                                              │
│  ⬤ Poción Total           3 / 3 disponibles  │
│    └─ Restaura 100% HP    [USO DISPONIBLE]   │
│                                              │
│  ⬜ Revivir              2 / 2 disponibles    │
│    └─ 50% HP + Revive    [USO DISPONIBLE]    │
│                                              │
│              [Cerrar]   [Usar Seleccionado]  │
└──────────────────────────────────────────────┘
```

**Estados de Botones:**
- **DISPONIBLE (color verde):** Recurso disponible, puede usarse
- **AGOTADO (color gris):** Recurso en 0, botón deshabilitado
- **NO APLICABLE (color naranja):** Poción cuando HP = 100%, revivir sin Pokémon debilitados

**Animaciones:**
- Al usar: Flash de luz, consumo del objeto, actualización de contador
- Al agotar: Transición a gris con "X" visual

### 5.4 Animaciones

| Elemento | Descripción |
|----------|------------|
| **Ataque** | Animación del Pokémon atacante + efecto visual del ataque |
| **Daño** | Destello rojo, desplazamiento del sprite, número flotante de daño |
| **Cambio de Pokémon** | Transición suave (fade / slide) |
| **Uso de Objeto** | Flash de luz, consumo visual del objeto, HP restore animation |
| **Efectos de Estado** | Iconos animados (llama para quemadura, etc.) |
| **Coinflip** | Animación visual de moneda |

### 5.5 Sonidos

| Evento | Sonido |
|--------|--------|
| **Ataque** | Efecto de sonido genérico de ataque + específico por tipo |
| **Daño** | Sonido de impacto |
| **KO** | Sonido de derrota |
| **Uso de Objeto** | Sonido de "poción bebida" o "revivir" |
| **Victoria** | Música/fanfare de victoria |
| **Botón UI** | Click suave |
| **BGM Batalla** | Música de fondo loop |

---

## 6. Requerimientos No Funcionales

| Aspecto | Especificación |
|--------|-----------------|
| **Performance** | <100ms latencia en turnos de batalla |
| **Disponibilidad** | 99% uptime del servidor durante horas de juego |
| **Concurrencia** | Soportar mínimo 100 salas simultáneas |
| **Almacenamiento** | MongoDB: ~500MB para 1000+ Pokémon cacheados |
| **Compatibilidad** | Web moderna (navegador): Chrome, Firefox, Safari, Edge |
| **Sin Autenticación** | Acceso abierto (opcional: ID sesión anónima) |

---

## 7. Flujo de Juego Detallado

### 7.1 Inicio de Sesión / Acceso

```
Paso 1: Usuario abre aplicación
  └─ Sin login: genera Session ID anónimo
  
Paso 2: Pantalla Principal
  ├─ Botón "Crear Sala"
  ├─ Botón "Unirse a Sala"
  └─ Historial de salas recientes
```

### 7.2 Crear Sala

```
Paso 1: Jugador A hace clic "Crear Sala"
  └─ Backend genera código único (ej: "AB3F2K")
  
Paso 2: Sistema crea documento en MongoDB (rooms collection)
  {
    "code": "AB3F2K",
    "player_1": "session-id-1",
    "player_2": null,
    "status": "waiting",
    "created_at": timestamp
  }
  
Paso 3: Jugador A ve pantalla de espera con código QR/copiar
  └─ Comparte código con Jugador B
```

### 7.3 Unirse a Sala

```
Paso 1: Jugador B hace clic "Unirse a Sala"
  └─ Ingresa código: "AB3F2K"
  
Paso 2: Validación
  ├─ Si existe y está vacía: ✓
  ├─ Si no existe: ✗ "Sala no encontrada"
  └─ Si ya tiene 2: ✗ "Sala llena"
  
Paso 3: Se actualiza documento
  └─ player_2 = "session-id-2"
  
Paso 4: Ambos jugadores ven "Sala lista. Seleccionar equipo"
```

### 7.4 Selección de Equipo (Draft)

```
DRAFT STYLE:
Turno 1: Jugador A elige Pokémon #1 (de 6)
Turno 2: Jugador B elige Pokémon #1 (de 6)
Turno 3: Jugador A elige Pokémon #2 (de 5 restantes)
... (alternancia hasta 6 cada uno)

Validaciones:
- No repetición: Si A elige Pikachu, B no puede elegirlo
- Mínimo 1 equipo válido: No pueden quedar sin Pokémon
- Legendarios: Máximo 1 por equipo durante el draft
- Confirmación: Ambos deben confirmar antes de iniciar

Vista:
- Buscador con filtros (tipo, generación, stats)
- Preview: sprite, stats, moveset, si es legendario
- Equipo actual (6 slots)
- Botón "LISTO" (habilitado cuando hay 6)
```

### 7.5 Inicio de Batalla

```
Paso 1: Ambos confirman equipo
  └─ Status de sala = "in_battle"
  
Paso 2: Coinflip determina orden
  ├─ 50% Jugador A ataca primero
  └─ 50% Jugador B ataca primero
  
Paso 3: Selección de Pokémon activo
  ├─ Cada jugador elige cuál de sus 6 iniciará
  └─ O automático: el primero no debilitado
  
Paso 4: Batalla commence
```

### 7.6 Loop de Batalla (Por Turno)

```
TURNO N:

1. Mostrar estado actual
   - Pokémon activos en ambos lados
   - HP, estado de salud
   - Efectos activos
   
2. Jugador A selecciona acción
   - Opción 1: Atacar (elige 1 de 4 habilidades)
   - Opción 2: Cambiar Pokémon (elige de los restantes)
   - Opción 3: Usar Objeto (si hay disponibles: poción o revivir)
   
3. Jugador B selecciona acción
   - Mismo menú paralelo (3 opciones)
   
4. Coinflip: ¿Quién ejecuta primero?
   - P(A primero) = 0.5
   - P(B primero) = 0.5
   
5. Ejecutar acciones en orden
   
   Si es cambio de Pokémon:
     - Pokémon anterior se retira
     - Nuevo entra a batalla
     - Estados se mantienen (salvo evolución temporal)
   
   Si es ataque:
     - Calcular multiplicador tipo (0.5x, 1.0x, 2.0x)
     - Calcular daño: MovePower × (ATK/DEF) × Mult_Tipo
     - Restar HP al defensor
     - ¿Hay efecto de estado? Aplicar
     - ¿Hay cambio de stats? Aplicar (temporal, ese turno)
   
   Si el defensor está dormido/congelado:
     - No ejecuta su acción
     - Salta su turno
   
   Si el defensor está confundido:
     - 33% chance de atacar a sí mismo
   
   Si el defensor está atraído:
     - 50% chance de no atacar al oponente
   
6. Decrementar duraciones de efectos
   - Quemadura: turnos -= 1
   - Si llega a 0: se remueve estado
   
7. Verificar KOs
   - Si HP = 0: Pokémon debilitado
   - Si equipo completo debilitado: Fin de batalla
   
8. Siguiente turno
```

### 7.7 Fin de Batalla

```
Jugador con Pokémon restantes = GANADOR

Pantalla de Victoria:
├─ Equipo ganador resaltado
├─ Historial de batalla
├─ Botones:
│  ├─ "Revancha" (nueva sala con mismo código?)
│  └─ "Menú Principal"
└─ Opcional: guardar replay
```

---

## 8. Base de Datos - Estructura MongoDB

### 8.1 Colecciones

```
collections/
├── pokemon
│   ├── _id (ObjectId)
│   ├── pokeapi_id (Number)
│   ├── name (String)
│   ├── type (Array: String)
│   ├── stats (Object: hp, attack, defense, sp_attack, sp_defense, speed)
│   ├── moves (Array of Objects)
│   ├── is_legendary (Boolean)
│   ├── sprites (Object: urls)
│   └── cached_at (Date)
│
├── rooms
│   ├── _id (ObjectId)
│   ├── code (String, unique)
│   ├── player_1 (String: session_id)
│   ├── player_2 (String: session_id, null si espera)
│   ├── team_1 (Array: pokemon_ids)
│   ├── team_2 (Array: pokemon_ids)
│   ├── status (String: waiting | in_draft | in_battle | finished)
│   ├── winner (String: session_id o null)
│   ├── created_at (Date)
│   ├── started_at (Date, null si no inició)
│   └── finished_at (Date, null si está activa)
│
└── battle_log (Opcional)
    ├── room_id (ObjectId reference)
    ├── turn_number (Number)
    ├── actions (Array of Objects)
    │   ├── player (String: P1 | P2)
    │   ├── action_type (String: attack | switch)
    │   ├── move_name (String)
    │   ├── damage_dealt (Number)
    │   ├── effects_applied (Array)
    │   └── timestamp (Date)
    └── result (Object: winner, reason)
```

---

## 9. Integración con PokeAPI (Generación V)

### 9.1 Endpoints Utilizados

**Filtro de Generación:** Todos los requests incluyen validación para Generación V (IDs 1-649)

```
GET https://pokeapi.co/api/v2/generation/5
  └─ Obtiene listado de 156 Pokémon nativos de Unova

GET https://pokeapi.co/api/v2/pokemon/{id}
  └─ Incluye: sprites de Black/White, stats Gen V, movepool Gen V
```

```
GET https://pokeapi.co/api/v2/pokemon/{id_or_name}
  └─ Retorna: stats, moves, sprites, types, is_legendary

GET https://pokeapi.co/api/v2/move/{id_or_name}
  └─ Retorna: power, accuracy, type, effect

GET https://pokeapi.co/api/v2/type/{id_or_name}
  └─ Retorna: effective_against, weak_to

GET https://pokeapi.co/api/v2/pokemon/?limit=300&offset=0
  └─ Retorna: listado de ~1000 Pokémon (paginar)
```

### 9.2 Estrategia de Caché

1. **Inicialización:** Pre-cargar todos los 649 Pokémon de Gen I-V desde PokeAPI
2. **Storage:** Almacenar en MongoDB con sprites de Black/White
3. **Prioridad:** Mostrar siempre sprites gen-v (si PokeAPI lo proporciona)
4. **TTL (Time To Live):** Actualizar cada 30 días
5. **Fallback:** Si PokeAPI no tiene sprite gen-v, usar National Dex

---

## 10. Opcionales / Fase 2 — Mejoras Post-MVP

Estas características NO son obligatorias para la entrega inicial, pero mejoran significativamente la experiencia. El MVP debe ser funcional sin ellas.

### 10.1 Sistema de Baneos Previo (Draft Banning)

```
Pre-Draft Banning Phase:
- Cada jugador elige 1-3 Pokémon para banear (no pueden ser elegidos después)
- Alternancia: P1 balea 1 → P2 balea 1 → P1 balea 1 (opcional 2-3 rondas)
- Total baneados: 2-6 Pokémon (según rondas)
- Después: Procede draft normal con Pokémon restantes

Requisitos:
- Interfaz clara mostrando baneados
- Legendarios pueden ser baneados igual que otros
- Validación de que hay suficientes Pokémon disponibles post-baneo
```

### 10.2 Variación de Estadísticas por Partida (IVs)

**Status:** Ya implementado en versión base

```
Cómo funciona (recuérdese):
- Al iniciar partida: generar IV[0-31] para cada stat de cada Pokémon
- IVs se almacenan en estado de batalla, NO se recalculan cada turno
- Cada Pokémon tiene sus propios IVs (varían partida a partida)

Fórmula (nivel 50):
  iv = randomInt(0, 31)
  hp = floor(((2 * baseHp + ivHp) * 50) / 100) + 50 + 10
  stat = floor(((2 * baseStat + ivStat) * 50) / 100) + 5

Resultado: Mismo Pokémon puede tener stats ligeramente diferentes cada batalla
```

### 10.3 Orden de Turno Avanzado (Prioridad + Velocidad)

**Estado:** Versión mejorada, mantener coinflip como base

```
Mejora opcional al orden actual (coinflip simple):

Nuevo Orden de Resolución (si se implementa):
1. Mayor prioridad de movimiento
2. Mayor velocidad efectiva
3. Coinflip solo si hay empate

Implementación:
  actionPriority = 
    action.type === 'switch' ? 6 :
    action.type === 'item' ? 6 :
    move.priority (1, 0, -1, etc)

  Orden final = sort by:
    1. actionPriority DESC
    2. effectiveSpeed DESC
    3. random()

Nota: Coinflip simple (versión actual) sigue siendo válido para MVP.
```

### 10.4 Sistema de Campos/Clima (Weather & Terrain)

```
Mecánica de Clima (Weather):
- Durabilidad: 5 turnos (decrementan cada turno sin acción específica)
- Efectos:
  - Lluvia: Agua ×1.5 daño, Fuego ×0.5
  - Soleado: Fuego ×1.5 daño, Agua ×0.5
  - Tormenta de Arena: Roca/Tierra/Acero resistencia, Roca ×1.5 defensa
  - Terreno Eléctrico: Eléctrico ×1.5 daño, previene sueño

- Movimientos que activan clima: Weather Move (Rain, Sunny Day, Sandstorm, etc)

Integración en Cálculo de Daño:
  fieldModifier = getFieldModifier(weather, move.type, defender.types)
  // En lugar de fieldModifier = 1 por defecto
```

### 10.5 Temporizador por Turno (Turn Timer)

```
Mecánica:
- Cada jugador tiene 15-30 segundos por turno (configurable)
- Barra visual mostrando tiempo restante
- Si expira: acción por defecto (ej: defender, cambiar Pokémon aleatorio)

Implementación:
- WebSocket evento: turn:timer (cada segundo)
- turn:timeout → backend ejecuta acción default
- Sincronización exacta entre clientes
```

### 10.6 Historial y Replay de Partidas

```
Almacenamiento en MongoDB (battle_log):
- Grabar cada turno: acciones, daño, efectos aplicados
- Incluir timestamps de cada evento
- Guardar estado final (ganador, duración, fecha)

Reproducción:
- Panel "Ver Replay"
- Play/Pause de la batalla
- Velocidad (1x, 2x, 4x)
- Saltar a turno específico
- Exportar como JSON o video

Almacenamiento:
  battle_replays collection:
  {
    _id, room_id, player_1, player_2, winner,
    turns: [{ turn_num, actions: [...], state: {...} }],
    duration, recorded_at
  }
```

### 10.7 Reconexión a Sala (Browser Reconnect)

```
Mecánica:
- Si jugador se desconecta durante batalla, tiene 30 segundos para reconectar
- Session ID se almacena en localStorage
- Reconexión automática si room_id coincide

Implementación:
- WebSocket reconnect logic (exponential backoff)
- Enviar estado completo al cliente reconectado
- Si es en fase de selección: vuelve a draft
- Si es en batalla: continúa turno actual

TTL de Sala:
- Sala inactiva 2 minutos → estado "paused"
- Sala inactiva 5+ minutos → auto-cierre
```

### 10.8 Modo Espectador (Spectator Mode)

```
Funcionalidad:
- Usuarios no involucrados pueden ver batalla en vivo
- Múltiples espectadores simultáneos
- Chat en vivo entre espectadores
- Sin acceso a decisiones (solo lectura)

Implementación:
- Nuevo rol: "spectator" en batalla
- Endpoint: GET /api/rooms/:code/spectate
- WebSocket sala con broadcast a espectadores
- Base de datos: agregar campo spectators[] en rooms
```

### 10.9 Filtros y Búsqueda Avanzada en Pokédex

```
Filtros en Selector de Equipo/Draft:
1. Por Nombre (búsqueda texto)
2. Por Tipo (seleccionar 1 o más tipos)
3. Por Generación (Gen I, II, III, IV, V)
4. Por Stats Base (ATK > 100, SPE < 80, etc)
5. Por Legendario (Sí/No)
6. Por Rol (Ataque, Defensa, Especial, Velocidad)

Implementación:
- Frontend: filtros locales (caché de Pokémon)
- Backend: GET /api/pokemon/search?type=fire&gen=5&minAttack=100
- Ordenamiento: Nombre, Stats, ID
```

### 10.10 Sistemas Opcionales del PDF (Bajo Prioridad)

- **Antídotos y Removedores de Estado:** Items adicionales para combate estratégico
- **Habilidades Capas:** Múltiples habilidades con efectos complejos
- **Evoluciones Temporales:** Cambios visuales durante batalla
- **Tutorial Interactivo:** Enseñanza de mecánicas para nuevos jugadores

---

## 11. Timeline y Milestones

### Fase 1: MVP — Versión Mínima Funcional (Semanas 1-3)

**Objetivo:** Entregar un juego completo y jugable sin opcionales

| Milestone | Funcionalidad | Prioridad |
|-----------|---------------|-----------|
| **Backend MVP** | Pokémon CRUD, tipos, movimientos, fórmula daño | 🔴 Crítica |
| **Sistema de Salas** | Crear, unirse, lobby, validación | 🔴 Crítica |
| **Motor de Batalla** | Turnos, coinflip, daño, estados (3 turnos) | 🔴 Crítica |
| **Frontend MVP** | TanStack Start + Vite, Battle UI, panel de acciones | 🔴 Crítica |
| **WebSocket Real-time** | Sincronización jugadores, eventos batalla | 🔴 Crítica |
| **Pokédex** | 300+ Pokémon cargados, sprites gen-v | 🔴 Crítica |
| **UI Completa** | Menú principal, draft, lobby, batalla, fin | 🟡 Alta |
| **Animaciones Básicas** | Ataque, daño, cambio, KO | 🟡 Alta |
| **Testing** | Pruebas manuales batalla, multijugador | 🟡 Alta |

**Resultado esperado:** Dos jugadores pueden completar una batalla 1v1 funcional

### Fase 2: Mejoras y Pulido (Semanas 4-6, opcional)

| Mejora | Impacto | Complejidad |
|--------|--------|------------|
| **Baneo de Pokémon (Draft)** | Profundidad competitiva ↑ | Media |
| **IVs + Stats variables** | Rejugabilidad ↑ | Media |
| **Orden avanzado (Prioridad+Velocidad)** | Balance competitivo ↑ | Media |
| **Clima/Campos** | Estrategia ↑ | Alta |
| **Temporizador por turno** | Competitividad ↑ | Baja |
| **Replay + Historial** | Valor educativo ↑ | Media |
| **Reconexión automática** | Confiabilidad ↑ | Media |
| **Modo Espectador** | Experiencia social ↑ | Alta |
| **Filtros avanzados** | Usabilidad ↑ | Baja |
| **Sonidos + Música** | Inmersión ↑ | Baja |

**Estrategia:** Implementar en orden de complejidad/impacto. MVP es suficiente para pasar; mejoras son bonus.

---

---

## 12. Criterios de Éxito — MVP

### Funcionales

- ✅ **Pokédex funcional:** Mínimo 300 Pokémon cargados desde PokeAPI, con sprites Gen V
- ✅ **Movimientos válidos:** Cada Pokémon tiene exactamente 4 movimientos en batalla
- ✅ **Sistema de Salas:** Crear sala → generar código → unirse por código → iniciar
- ✅ **Batalla 1v1 completa:** Selección equipo → draft → batalla → fin de partida
- ✅ **Cálculo de daño correcto:** Fórmula con tipo, STAB, crítico, aleatorio, quemadura
- ✅ **Efectos de tipo:** Vulnerabilidades, resistencias, inmunidades funcionan (desde PokeAPI)
- ✅ **Estados temporales:** Duran exactamente 3 turnos, se eliminen al cambiar Pokémon
- ✅ **Orden de turnos:** Coinflip justo (50/50) para determinar quién ataca primero
- ✅ **Victorias/Derrotas:** Sistema determina ganador correctamente
- ✅ **Sincronización real-time:** WebSocket sin lag perceptible

### Técnicos

- ✅ **MongoDB:** Pokémon persistidos, salas, historial de batalla funcionales
- ✅ **Backend (Hono+Bun):** Endpoints activos, WebSocket estable
- ✅ **Frontend (TanStack Start + Vite):** UI responsiva, sin errores críticos
- ✅ **Docker:** docker-compose.yml funcional, levanta todo en 1 comando
- ✅ **Sin hardcodeo:** Datos desde PokeAPI, no tablas fijas

### Calidad

- ✅ **Sprites consistentes:** Gen V Black/White, sin mezcla de estilos
- ✅ **Animaciones básicas:** Ataque, daño, cambio de Pokémon visibles
- ✅ **Sin lag:** Latencia < 100ms en turnos de batalla
- ✅ **2+ jugadores simultáneos:** Salas paralelas funcionan

---

## 13. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|--------|-----------|
| PokeAPI lenta o offline | Alto | Caché en MongoDB, fallback a datos default |
| Sincronización desincronizada | Alto | Implementar heartbeat + reconciliación |
| MongoDB sobrecargado | Medio | Indexes en fields frecuentes, TTL automático |
| Desbalance de tipos | Medio | Tabla de tipos estándar + testing manual |
| Lag en red | Bajo | WebSocket con compresión, delta sync |
| Errores en multijugador | Alto | Pruebas exhaustivas con 2 browsers |

---

## 14. Referencias y Recursos

- **PokeAPI v2 Docs:** https://pokeapi.co/docs/v2
- **PDF Especificaciones:** Enunciado funcional y fórmulas sugeridas
- **Pokémon Type Chart:** https://pokémondb.net/type
- **TanStack Start Docs:** https://tanstack.com/start/latest
- **Vite Docs:** https://vitejs.dev/
- **Hono Docs:** https://hono.dev/
- **MongoDB Docs:** https://docs.mongodb.com/

---

**Documento actualizado desde:** PDF Especificaciones (v1.0 - 2026-05-12) + PRD (v1.0 - 2026-05-12)  
**Última actualización:** 13 de Mayo, 2026  
**Estado:** Alineado con PDF, priorizando PRD en conflictos  
**Próxima revisión:** Después de Fase 1
- **MongoDB Docs:** https://docs.mongodb.com/

---

**Documento preparado por:** Sistema IA  
**Última actualización:** 12 de Mayo, 2026  
**Próxima revisión:** Después de Fase 1
