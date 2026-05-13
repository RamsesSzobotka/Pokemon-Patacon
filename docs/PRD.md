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

### 3.9 Sistema de Base de Datos Pokémon

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
battle:end           → Batalla finalizada
```

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
  - Selector de habilidades (4 botones)
  - Chat/comunicación pre-batalla
  - Historial de acciones (log de batalla)

### 5.2 Sprites y Assets de Generación V

| Recurso | Fuente | Descripción |
|--------|--------|-------------|
| **Sprites Batalla** | Pokémon Black/White .gif | Animaciones de Pokémon en batalla (frente) |
| **Sprites Movimiento** | Black/White back sprites | Pokémon entrenador (trasero, animado) |
| **Efectos de Ataque** | Black/White effect sprites | Efectos visuales de movimientos |
| **Paleta de Color** | Gen V official | Colores característicos de la era Black/White |

**Nota:** Los .gif de Black/White incluyen loops de 2-4 frames para cada Pokémon. El frontend mostrará estos loops durante la batalla con timing sincronizado a los turnos.

### 5.3 Animaciones

| Elemento | Descripción |
|----------|------------|
| **Ataque** | Animación del Pokémon atacante + efecto visual del ataque |
| **Daño** | Destello rojo, desplazamiento del sprite, número flotante de daño |
| **Cambio de Pokémon** | Transición suave (fade / slide) |
| **Efectos de Estado** | Iconos animados (llama para quemadura, etc.) |
| **Coinflip** | Animación visual de moneda |

### 5.4 Sonidos

| Evento | Sonido |
|--------|--------|
| **Ataque** | Efecto de sonido genérico de ataque + específico por tipo |
| **Daño** | Sonido de impacto |
| **KO** | Sonido de derrota |
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
   
3. Jugador B selecciona acción
   - Mismo menú paralelo
   
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
