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

Pokémon Patacon es un videojuego de batallas Pokémon en tiempo real donde dos jugadores compiten simultáneamente en partidas 1v1 a través de una interfaz moderna. Basado en la **Generación V (Black/White)**, incluirá los 156 Pokémon de esta generación + evoluciones de generaciones anteriores, utilizando los **sprites animados .gif** característicos de Black/White. El juego utiliza la API oficial de Pokémon (PokeAPI v2) para obtener datos, almacenándolos en una base de datos local para mejor rendimiento.

---

## 2. Objetivos Principales

- ✅ Crear un sistema de batallas Pokémon competitivo, fluido y sin lag
- ✅ Permitir multijugador en tiempo real con salas de juego
- ✅ Acceso sin requerimiento de autenticación (inicio de sesión)
- ✅ Soportar mínimo 300 Pokémon con sus habilidades y stats
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

### 3.2 Pokédex Disponible (Generación V)

**Pool de Pokémon:** 156 Pokémon nativos de Unova + 493 totales de Gen I-V

- **Generación V (Unova natives):** Victini, Snivy, Tepig, Oshawott, ... Genesect (156 nuevos)
- **Compatibilidad Gen I-IV:** Todos los Pokémon de generaciones anteriores que pueden evolucionar en Gen V
- **Legendarios Gen V:** Reshiram, Zekrom, Kyurem (máximo 1 por equipo)
- **Sprites Black/White:** Todos los Pokémon mostrarán sus sprites .gif animados de Black/White desde PokeAPI
- **Movepool:** Se usa el movepool de Generación V para cada Pokémon

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

### 3.5 Sistema de Habilidades

| Parámetro | Detalles |
|-----------|---------|
| **Habilidades por Pokémon** | 4 habilidades (Moves) seleccionables del moveset del Pokémon |
| **Fuente de Datos** | PokeAPI v2: `pokemon/{id}/moves` |
| **Atributos de Habilidad** | Poder (Power), Precisión (Accuracy), PP (Power Points), Tipo (Type) |
| **PP en Batalla** | Sin limitación de PP (sin necesidad de rastrear) |
| **Efectos Especiales** | Daño fijo, daño porcentual, cambio de stats, aplicación de estados |

### 3.6 Sistema de Daño y Tipos

#### 3.6.1 Cálculo de Daño

```
Daño Base = Move Power × (Ataque_Atacante / Defensa_Defensor) × Multiplicador_Tipo

Donde:
- Move Power: Poder base de la habilidad
- Stats: Máximos (sin variación por nivel)
- Multiplicador_Tipo: 0.5x (débil), 1.0x (normal), 2.0x (efectivo)
```

#### 3.6.2 Tabla de Tipos

Incluye la tabla estándar de Pokémon:
- **Ventajas (2x daño):** Ej: Fuego > Planta
- **Desventajas (0.5x daño):** Ej: Agua < Planta
- **Inmunidades (0x daño):** Ej: Volador > Tierra (para ciertos movimientos)

| Tipo | Efectivo Contra | Débil Contra | Resiste | Inmune |
|------|-----------------|-------------|---------|--------|
| Fuego | Planta, Hielo, Bicho, Acero | Agua, Tierra, Roca | Fuego, Planta, Hielo, Bicho, Acero, Hada | - |
| Agua | Fuego, Tierra, Roca | Planta, Eléctrico | Fuego, Agua, Hielo, Acero | - |
| (... resto de tabla estándar Pokemon) | | | | |

### 3.7 Sistema de Efectos de Estado

| Estado | Duración | Efecto Mecánico | Puede Removerse |
|--------|----------|-----------------|-----------------|
| **Quemadura (Burn)** | 3 turnos | -25% Ataque efectivo | Sí (habilidad/item) |
| **Parálisis (Paralysis)** | 3 turnos | -50% velocidad (cosmético, no afecta orden) | Sí |
| **Sueño (Sleep)** | 3 turnos | Pokémon no ataca | Sí |
| **Congelación (Freeze)** | 3 turnos | Pokémon no ataca | Sí |
| **Envenenamiento (Poison)** | 3 turnos | -12.5% HP por turno | Sí |
| **Atracción (Attraction)** | 3 turnos | 50% chance de no atacar | Sí |
| **Desorientación (Confusion)** | 3 turnos | 33% chance de atacar a sí mismo | Sí |

**Comportamiento:**
- Decrecen 1 turno por cada acción del Pokémon afectado
- Habilidades de "quitar estado" (ej: Refresh) limpian todos los estados
- Máximo 1 estado no-volátil por Pokémon (excepto confusión/atracción que son volátiles)

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
| **Frontend** | Tauri + Svelte + Vite | Desktop app nativa, UI moderna |
| **Backend** | Bun + Hono | Servidor HTTP/WebSocket rápido y ligero |
| **Base de Datos** | MongoDB | Almacenar Pokémon cacheados, salas, historial |
| **API Externa** | PokeAPI v2 | Datos de Pokémon (https://pokeapi.co/api/v2/) |

### 4.2 Arquitectura

```
┌─────────────────────────────────────────┐
│         Tauri Window (Svelte/Vite)      │
│  - UI Batalla                           │
│  - Selección de Equipo                  │
│  - Salas Multijugador                   │
└────────────┬────────────────────────────┘
             │ HTTP + WebSocket
             ↓
┌─────────────────────────────────────────┐
│      Hono Server (Bun)                  │
│  - Endpoints: GET /pokemon/:id          │
│  - WebSocket: /battle/:room_id          │
│  - Logic: Turno, Daño, Sincronización  │
└────────────┬────────────────────────────┘
             │
   ┌─────────┼─────────┐
   ↓         ↓         ↓
MongoDB   PokeAPI   Cache
```

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
├── frontend/                      # Tauri + Svelte
│   ├── src/
│   │   ├── components/
│   │   │   ├── Battle.svelte           # Pantalla principal de batalla
│   │   │   ├── PokemonSprite.svelte    # Renderer de sprites .gif
│   │   │   ├── ActionPanel.svelte      # Panel de acciones (atacar, cambiar, objetos)
│   │   │   ├── ObjectsMenu.svelte      # Menú de objetos (pociones, revivir)
│   │   │   ├── DraftSelector.svelte    # Selector de equipo (draft)
│   │   │   ├── RoomLobby.svelte        # Sala de espera
│   │   │   └── MainMenu.svelte         # Menú principal
│   │   ├── store/
│   │   │   ├── battle.js               # Estado de batalla (Svelte store)
│   │   │   ├── room.js                 # Estado de sala
│   │   │   └── pokemon.js              # Cache de Pokémon
│   │   ├── services/
│   │   │   ├── websocket.js            # WebSocket client
│   │   │   ├── pokemonApi.js           # Llamadas a API backend
│   │   │   └── sync.js                 # Sincronización
│   │   ├── utils/
│   │   │   ├── damage.js               # Cálculo de daño
│   │   │   ├── typeChart.js            # Tabla de tipos
│   │   │   └── spriteRenderer.js       # Manejo de .gif animados
│   │   ├── App.svelte
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
| **Compatibilidad** | Windows, macOS, Linux (Tauri) |
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

1. **Inicialización:** Pre-cargar todos los 493 Pokémon de Gen I-V desde PokeAPI
2. **Storage:** Almacenar en MongoDB con sprites de Black/White
3. **Prioridad:** Mostrar siempre sprites gen-v (si PokeAPI lo proporciona)
4. **TTL (Time To Live):** Actualizar cada 30 días
5. **Fallback:** Si PokeAPI no tiene sprite gen-v, usar National Dex

---

## 10. Opcionales / Fase 2

### 10.1 Items y Consumibles

- **Pociones:** Recuperan % de HP
- **Revivir:** Devuelven un Pokémon debilitado con 50% HP
- **Antídotos:** Curan envenenamiento, etc.

### 10.2 Sistema de Baneos (Draft Champions)

```
Fase de Baneos (pre-draft):
- Cada jugador blea 1-2 Pokémon (no pueden ser elegidos)
- Total: 2-4 Pokémon baneados
- Luego procede el draft normal con los restantes
```

### 10.3 Stats Dinámicos por Porcentaje

```
Mostrar en batalla:
- Barra visual de HP con %
- Indicadores de ATK "80%", SPD "100%"
- Cambios temporales después de usar habilidades
```

### 10.4 Replays y Estadísticas

- Guardar historial de batallas
- Reproducción de replays
- Estadísticas del jugador (W/L, Pokémon favoritos)

---

## 11. Timeline y Milestones

| Milestone | Funcionalidad | Semana |
|-----------|---------------|--------|
| **Fase 1: MVP** | Backend setup, Pokémon CRUD, Batalla básica | Semana 1-2 |
| **Fase 1: UI** | Tauri + Svelte frontend, selección equipo | Semana 2-3 |
| **Fase 1: Multijugador** | Salas, WebSocket, sincronización | Semana 3-4 |
| **Fase 2: Polish** | Animaciones, sonidos, efectos visuales | Semana 4-5 |
| **Fase 2: Opcionales** | Items, baneos, stats dinámicos | Semana 5-6 |

---

## 12. Criterios de Éxito

- ✅ Batalla fluida sin lag (< 100ms latencia)
- ✅ Mínimo 300 Pokémon disponibles
- ✅ 2+ jugadores pueden jugar simultáneamente
- ✅ UI responsive y atractiva
- ✅ Sin necesidad de login
- ✅ Efectos de estado funcionan correctamente
- ✅ Coinflip balanceado (no favorece a ningún jugador)

---

## 13. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|--------|-----------|
| PokeAPI lenta o offline | Alto | Caché en MongoDB, fallback a datos default |
| Sincronización desincronizada | Alto | Implementar heartbeat + reconciliación |
| MongoDB sobrecargado | Medio | Indexes en fields frecuentes, TTL automático |
| Desbalance de tipos | Medio | Tabla de tipos estándar + testing |
| Lag en red local | Bajo | WebSocket con compresión, delta sync |

---

## 14. Referencias y Recursos

- **PokeAPI v2 Docs:** https://pokeapi.co/docs/v2
- **Pokémon Type Chart:** https://pokémondb.net/type
- **Tauri Docs:** https://tauri.app/
- **Hono Docs:** https://hono.dev/
- **MongoDB Docs:** https://docs.mongodb.com/

---

**Documento preparado por:** Sistema IA  
**Última actualización:** 12 de Mayo, 2026  
**Próxima revisión:** Después de Fase 1
