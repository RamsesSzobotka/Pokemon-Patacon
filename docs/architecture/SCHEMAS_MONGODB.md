# MongoDB Schemas - Pokemon Patacon

**Versión:** 3.0  
**Fecha:** 16 de Mayo de 2026  
**Estado:** Especificación Técnica

---

## 📊 Colecciones de MongoDB

### 1. `pokemon` - Caché de Pokémon desde PokeAPI

**Propósito:** Almacenar datos de Pokémon para evitar llamadas repetidas a PokeAPI v2. Se importa automáticamente al iniciar el backend solo si no existen datos.

**Índices:**
- `pokeapi_id` (único)
- `name` (texto)
- `is_legendary` (booleano)
- `types` (array)
- `move_ids` (array)
- `generation` (1-5)
- `cached_at` (TTL)

```javascript
{
  "_id": ObjectId,                          // MongoDB ID único
  "pokeapi_id": 1,                          // ID de PokeAPI (1-649)
  "name": "bulbasaur",                      // Nombre en inglés (minúsculas)
  "name_es": "Bulbasaur",                   // Nombre en español
  "generation": 1,                          // 1-5 (Gen I-V)
  "types": ["grass", "poison"],             // Array de tipos (1-2)
  "stats": {
    "hp": 45,
    "attack": 49,
    "defense": 49,
    "sp_attack": 65,
    "sp_defense": 65,
    "speed": 45
  },
  "base_experience": 64,
  "is_legendary": false,
  "is_mythical": false,
  "move_ids": [1, 2, 3, 4, 5, 33, 45, 73, 74, 102, ...],  // TODOS los movimientos del Pokémon
  "sprites": {
    // Sprites animados Gen V Black/White (batalla)
    "front_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/1.gif",
    "back_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/back/1.gif",
    "front_shiny": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/shiny/1.gif",
    "back_shiny": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/back/shiny/1.gif",
    // Sprites female - no disponibles en Gen V animated
    "front_female": null,
    "back_female": null,
    "front_shiny_female": null,
    "back_shiny_female": null,
    // Sprites estáticos (fallback)
    "static_front_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/1.png",
    "static_back_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/back/1.png"
  },
  "height_dm": 7,                           // Altura en decímetros (PokeAPI)
  "weight_hg": 69,                          // Peso en hectogramos (PokeAPI)
  "cached_at": ISODate("2026-05-16T12:00:00Z"),
  "updated_at": ISODate("2026-05-16T12:00:00Z")
}
```

**Nota:** El campo `move_ids` contiene TODOS los movimientos que el Pokémon puede aprender en PokeAPI (sin filtro). Aproximadamente 20-100+ movimientos por Pokémon.

**Uso en batalla:**
```javascript
// Sprites para el combate
playerSprite = pokemon.sprites.back_default   // Sprite del Pokémon del jugador (espalda)
enemySprite = pokemon.sprites.front_default   // Sprite del Pokémon enemigo (frente)

// Sprites shiny
playerSpriteShiny = pokemon.sprites.back_shiny
enemySpriteShiny = pokemon.sprites.front_shiny

// Sprites estáticos (fallback si no hay animados)
staticSprite = pokemon.sprites.static_front_default
```

---

### 2. `moves` - Movimientos Normalizados (Colección Independiente)

**Propósito:** Almacenar TODOS los movimientos disponibles en una colección única y normalizada. Cada movimiento existe una sola vez y se referencia por ID desde los Pokémon.

**Cambio v3.0:** Ya no hay filtro de validación. Se guardan TODOS los movimientos (con daño, sin daño, con estados, solo stats, etc.).

**Índices:**
- `move_id` (único)
- `name` (texto)
- `type` (para filtrar por tipo)
- `damage_class` (physical/special/status)
- `power` (orden descendente)
- `meta.ailment` (para movimientos con estados)
- `type: 1, damage_class: 1` (filtrado compuesto)

```javascript
{
  "_id": ObjectId,                          // MongoDB ID único
  "move_id": 36,                            // ID único del movimiento (de PokeAPI)
  "name": "flamethrower",                   // Nombre en inglés (base, sin guiones)
  "names": {
    "es": "lanzallamas",                    // Nombre en español
    "en": "flamethrower",
    "ja": "ひのこ"                          // Nombre en japonés
  },
  "description": "El usuario escupe un intenso chorro de llamas. Puede causar quemadura.",  // Descripción en español/inglés
  "type": "fire",                           // Tipo del movimiento
  "damage_class": "special",               // "physical" | "special" | "status"
  "power": 90,                              // Potencia del movimiento (null para status)
  "accuracy": 100,                          // Precisión (porcentaje)
  "pp": 15,                                 // Power Points (usos disponibles)
  "priority": 0,                            // Prioridad del movimiento [-6, +6]
  "target": "selected-pokemon",            // "self" | "opponent" | "all" | "all-opponents"
  "meta": {
    "ailment": "burn",                      // Estado aplicado (paralysis|sleep|poison|burn|freeze|null)
    "ailment_chance": 10,                  // Porcentaje de probabilidad de aplicar el estado
    "stat_changes": [
      // Array de cambios de estadísticas [{ stat: "attack", change: 1 }]
    ],
    "flinch_chance": 0,                     // Porcentaje de probabilidad de hacer flinch
    "heal": 0                               // Porcentaje de curación (0-100)
  },
  "flags": {
    "contact": false,                       // El movimiento hace contacto físico
    "recharge": true,                      // Requiere recargarse al siguiente turno
    "protect": true,                       // Puede ser bloqueado por Protect/Detect
    "mirror": true,                        // Puede ser reflejar por Magic Coat
    "sound": false,                        // Es un movimiento de sonido
    "powder": false,                       // Afectado por polvos (Bloom Wrap, etc.)
    "distance": false                      // Puede alcanzar a objetivos a distancia
  },
  "created_at": ISODate("2026-05-16T12:00:00Z"),
  "updated_at": ISODate("2026-05-16T12:00:00Z")
}
```

**Relación con Pokémon:**
- Cada Pokémon en la colección `pokemon` tiene un campo `move_ids: number[]` que contiene los IDs de TODOS los movimientos que puede aprender.
- La referencia es por `move_id`, no embebida - esto reduce redundancia y facilita el balanceo global.
- Un mismo movimiento puede ser usado por múltiples Pokémon pero solo se almacena una vez en `moves`.

---

### 3. `types` - Tipos de Pokémon (Gen V + Fairy)

**Propósito:** Almacenar los 18 tipos de Pokémon con sus relaciones de daño. Se importa automáticamente al iniciar el backend.

**Índices:**
- `type_id` (único)
- `name` (único)

```javascript
{
  "_id": ObjectId,
  "type_id": 10,                            // ID de PokeAPI (1-18)
  "name": "grass",                          // Nombre en inglés (único)
  "names": {
    "es": "Planta",                         // Nombre en español
    "en": "Grass"
  },
  "damage_relations": {
    "to": {
      "double": ["water", "ground", "rock"],  // Tipo al que hace x2 daño
      "half": ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],  // Tipo al que hace x0.5
      "immune": []                            // Tipo al que hace x0
    },
    "from": {
      "double": ["fire", "ice", "poison", "flying", "bug"],  // Tipo que hace x2 a este
      "half": ["water", "electric", "grass", "ground"],       // Tipo que hace x0.5 a este
      "immune": []                                                    // Tipo que hace x0 a este
    }
  },
  "imported_at": ISODate("2026-05-16T12:00:00Z")
}
```

**Lista de tipos (ID - Nombre ES - Nombre EN):**
| ID | ES | EN |
|----|----|----|
| 1 | Normal | normal |
| 2 | Lucha | fighting |
| 3 | Volador | flying |
| 4 | Veneno | poison |
| 5 | Tierra | ground |
| 6 | Roca | rock |
| 7 | Bicho | bug |
| 8 | Fantasma | ghost |
| 9 | Acero | steel |
| 10 | Fuego | fire |
| 11 | Agua | water |
| 12 | Planta | grass |
| 13 | Eléctrico | electric |
| 14 | Psíquico | psychic |
| 15 | Hielo | ice |
| 16 | Dragón | dragon |
| 17 | Siniestro | dark |
| 18 | Hada | fairy |

---

### 4. `rooms` - Salas de Batalla Multijugador

**Propósito:** Gestionar salas, códigos de acceso, jugadores y estado de pre-batalla.

**Índices:**
- `code` (único)
- `created_at` (TTL: 30 minutos)
- `state`

```javascript
{
  "_id": ObjectId,
  "code": "AB12CD",                         // Código 4-6 caracteres (único)
  "created_at": ISODate("2026-05-16T12:00:00Z"),
  "expires_at": ISODate("2026-05-16T12:30:00Z"),  // TTL para limpieza
  "state": "waiting",                       // "waiting" | "in_draft" | "in_battle" | "finished"
  "players": {
    "player1": {
      "session_id": "uuid-here",
      "joined_at": ISODate("2026-05-16T12:00:00Z"),
      "ready": false                        // Confirmó equipo
    },
    "player2": {
      "session_id": "uuid-here",
      "joined_at": ISODate("2026-05-16T12:05:00Z"),
      "ready": false
    }
  },
  // Equipos seleccionados durante fase draft (6 Pokémon cada uno)
  // Cada Pokémon: pokeapi_id + 4 movimientos seleccionados del movepool disponible
  // Validación: máximo 1 legendario por equipo (míticos sin límite)
  "team_1": [
    {
      "pokeapi_id": 25,                     // ID de PokeAPI
      "selected_moves": [25, 87, 93, 98]    // 4 move_ids seleccionados
    },
    { "pokeapi_id": 6, "selected_moves": [34, 98, 102, 156] },
    { "pokeapi_id": 150, "selected_moves": [7, 15, 25, 118] },
    { "pokeapi_id": 94, "selected_moves": [85, 87, 103, 251] },
    { "pokeapi_id": 65, "selected_moves": [94, 95, 100, 248] },
    { "pokeapi_id": 3, "selected_moves": [33, 73, 74, 202] }
  ],
  "team_2": [
    // Misma estructura que team_1
    // ...
  ],
  "max_players": 2,
  "battle_id": ObjectId || null,           // Referencia a battles cuando inicia
  "winner": null,                          // null | "player1" | "player2"
  "started_at": null,                     // null | ISODate (cuando inicia battle)
  "finished_at": null                     // null | ISODate (cuando termina)
}
```

---

### 5. `battles` - Estado de Batalla en Progreso

**Propósito:** Persistir estado de batalla para reconexión y historial.

**Índices:**
- `room_code` (único)
- `started_at` (TTL: 1 hora)

```javascript
{
  "_id": ObjectId,
  "room_code": "AB12CD",
  "started_at": ISODate("2026-05-16T12:10:00Z"),
  "current_turn": 15,
  "state": "active",                        // "active" | "finished"
  "players": {
    "player1": {
      "session_id": "uuid1",
      "team": [
        {
          "pokeapi_id": 25,
          "name": "pikachu",
          "current_hp": 45,
          "max_hp": 45,
          "active": true,                   // Es el Pokémon activo
          "stats": {
            "hp": 45,
            "attack": 55,
            "defense": 40,
            "sp_attack": 50,
            "sp_defense": 50,
            "speed": 90,
            "temp_modifications": {
              "attack": 0,                  // Modificadores temporales [-6, 6]
              "defense": 1,
              "sp_attack": -1,
              "sp_defense": 0,
              "speed": 0
            }
          },
          "iv_stats": {
            "hp": 15,
            "attack": 20,
            "defense": 18,
            "sp_attack": 22,
            "sp_defense": 16,
            "speed": 25
          },
          "moves": [
            {
              "name": "thunderbolt",
              "remaining_pp": null            // Sin límite de PP
            },
            // ... 3 más
          ],
          "status_condition": null,         // null | { type: "burn", remaining_turns: 2 }
          "fainted": false
        }
        // ... 5 más Pokémon
      ],
      "active_pokemon_index": 0,
      "items": {
        "full_restore": 3,
        "revive": 2
      },
      "last_action": {
        "action_type": "attack",            // "attack" | "switch" | "item"
        "action_data": "thunderbolt",
        "timestamp": ISODate("2026-05-16T12:10:45Z")
      }
    },
    "player2": {
      // ... estructura idéntica
    }
  },
  "turn_order": [
    {
      "turn_number": 15,
      "first_player": "player1",            // Determinado por coinflip
      "first_action": {
        "player": "player1",
        "type": "attack",
        "data": "thunderbolt",
        "damage_dealt": 35,
        "accuracy_roll": 95,
        "critical": false
      },
      "second_action": {
        "player": "player2",
        "type": "switch",
        "data": { "from_index": 0, "to_index": 2 },
        "damage_dealt": 0
      },
      "executed_at": ISODate("2026-05-16T12:10:50Z")
    }
    // ... histórico de turnos anteriores
  ],
  "winner": null,                           // null | "player1" | "player2"
  "finished_at": null                       // null o ISODate cuando termina
}
```

---

### 6. `sessions` - Sesiones de Jugador (Opcional)

**Propósito:** Rastrear sesiones anónimas para estadísticas y reconexión.

**Índices:**
- `session_id` (único)
- `created_at` (TTL: 24 horas)

```javascript
{
  "_id": ObjectId,
  "session_id": "uuid-v4",                  // Generado por cliente
  "created_at": ISODate("2026-05-16T12:00:00Z"),
  "last_active": ISODate("2026-05-16T12:45:00Z"),
  "stats": {
    "battles_played": 5,
    "battles_won": 2,
    "battles_lost": 3
  },
  "current_room": "AB12CD" || null          // Sala actual si en juego
}
```

---

## 🔑 Índices y Configuración

### Index Creation (Bun/Hono startup)

```typescript
// En backend initialization

// === COLECCIÓN POKEMON ===
await db.collection('pokemon').createIndex({ pokeapi_id: 1 }, { unique: true });
await db.collection('pokemon').createIndex({ name: 1 });
await db.collection('pokemon').createIndex({ name: 'text' });
await db.collection('pokemon').createIndex({ is_legendary: 1 });
await db.collection('pokemon').createIndex({ is_mythical: 1 });
await db.collection('pokemon').createIndex({ types: 1 });
await db.collection('pokemon').createIndex({ generation: 1 });
await db.collection('pokemon').createIndex({ move_ids: 1 });  // Para buscar Pokémon por movimiento
await db.collection('pokemon').createIndex({ cached_at: 1 });

// === COLECCIÓN MOVES (Optimizados para Battle Engine) ===
await db.collection('moves').createIndex({ move_id: 1 }, { unique: true });
await db.collection('moves').createIndex({ name: 1 });
await db.collection('moves').createIndex({ type: 1 });
await db.collection('moves').createIndex({ damage_class: 1 });
await db.collection('moves').createIndex({ power: -1 });  // Ordenar por poder descendente
await db.collection('moves').createIndex({ 'meta.ailment': 1 });
await db.collection('moves').createIndex({ type: 1, damage_class: 1 });  // Filtrado compuesto
await db.collection('moves').createIndex({ power: 1, accuracy: 1 });  // Optimización de daño

// === COLECCIÓN TYPES ===
await db.collection('types').createIndex({ type_id: 1 }, { unique: true });
await db.collection('types').createIndex({ name: 1 }, { unique: true });

// === COLECCIÓN ROOMS ===
await db.collection('rooms').createIndex({ code: 1 }, { unique: true });
await db.collection('rooms').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
await db.collection('rooms').createIndex({ state: 1 });
await db.collection('rooms').createIndex({ 'players.session_id: 1 });  // Buscar sala por sesión
await db.collection('rooms').createIndex({ 'team_1.pokeapi_id': 1 });   // Validar equipo P1
await db.collection('rooms').createIndex({ 'team_2.pokeapi_id': 1 });   // Validar equipo P2

// === COLECCIÓN BATTLES ===
await db.collection('battles').createIndex({ room_code: 1 }, { unique: true });
await db.collection('battles').createIndex({ started_at: 1 }, { expireAfterSeconds: 3600 });

// === COLECCIÓN SESSIONS (Opcional) ===
await db.collection('sessions').createIndex({ session_id: 1 }, { unique: true });
await db.collection('sessions').createIndex({ created_at: 1 }, { expireAfterSeconds: 86400 });
```

---

## 📝 Operaciones Comunes

### Buscar Pokémon por nombre
```javascript
db.pokemon.findOne({ name: /pikachu/i })
```

### Buscar Pokémon por nombre en español
```javascript
db.pokemon.findOne({ name_es: /pikachu/i })
```

### Obtener tabla de tipos para un matchup
```javascript
// Usando colección types
const defenderType = db.types.findOne({ name: "water" });
const effectiveness = defenderType.damage_relations.from.double.includes("electric") ? 2 : 1;
```

### Limpiar salas expiradas
```javascript
// Automático con TTL index
```

### Obtener sala por código
```javascript
db.rooms.findOne({ code: "AB12CD" })
```

### Unirse a sala (player2)
```javascript
db.rooms.updateOne(
  { code: "AB12CD", state: "waiting" },
  {
    $set: {
      "players.player2.session_id": "uuid-new-player",
      "players.player2.joined_at": ISODate(),
      state: "in_draft"
    }
  }
)
```

### Actualizar equipo durante draft (seleccionar Pokémon + 4 movimientos)
```javascript
db.rooms.updateOne(
  { code: "AB12CD" },
  {
    $set: {
      "team_1": [
        { pokeapi_id: 25, selected_moves: [25, 87, 93, 98] },
        { pokeapi_id: 6, selected_moves: [34, 98, 102, 156] },
        { pokeapi_id: 150, selected_moves: [7, 15, 25, 118] },
        { pokeapi_id: 94, selected_moves: [85, 87, 103, 251] },
        { pokeapi_id: 65, selected_moves: [94, 95, 100, 248] },
        { pokeapi_id: 3, selected_moves: [33, 73, 74, 202] }
      ]
    }
  }
)
```

### Confirmar equipo (ready)
```javascript
db.rooms.updateOne(
  { code: "AB12CD" },
  { $set: { "players.player1.ready": true } }
)
```

### Iniciar batalla (ambos ready)
```javascript
db.rooms.updateOne(
  { code: "AB12CD", "players.player1.ready": true, "players.player2.ready": true },
  {
    $set: {
      state: "in_battle",
      started_at: ISODate()
    }
  }
)
```

### Validar legendary (máximo 1 por equipo)
```javascript
// Verificar que team_1 no tenga más de 1 legendario
const team1Ids = team_1.map(t => t.pokeapi_id);
const legendaries = await db.pokemon.find({ pokeapi_id: { $in: team1Ids }, is_legendary: true }).toArray();
// Si legendaries.length > 1 → reject
```

### Obtener estado de batalla actual
```javascript
db.battles.findOne({ room_code: "AB12CD" })
```

### Obtener los movimientos de un Pokémon (por IDs)
```javascript
// 1. Obtener move_ids del Pokémon
const pokemon = db.pokemon.findOne({ pokeapi_id: 25 });
// pokemon.move_ids = [25, 87, 93, 98, 145, ...] (TODOS los movimientos)

// 2. Obtener detalles de los movimientos
db.moves.find({ move_id: { $in: pokemon.move_ids } })
```

### Obtener nombre en español de un movimiento
```javascript
const move = db.moves.findOne({ move_id: 36 });
// move.names.es = "lanzallamas"
```

### Buscar Pokémon que pueden aprender un movimiento específico
```javascript
db.pokemon.find({ move_ids: 25 })  // Buscar Pokémon con "thunderbolt"
```

### Filtrar movimientos por tipo y clase de daño
```javascript
db.moves.find({ type: "fire", damage_class: "special" })
```

### Obtener movimientos que aplican estado (para estrategias)
```javascript
db.moves.find({ "meta.ailment": "paralysis" })
```

### Obtener movimientos de alto poder para damage dealer
```javascript
db.moves.find({ power: { $gte: 100 } }).sort({ power: -1 }).limit(10)
```

### Obtener todos los tipos disponibles
```javascript
db.types.find().sort({ type_id: 1 })
```

---

## 🚀 Data Seeding (Inicialización Automática)

### Flujo de Importación (v3.0)

Al iniciar la aplicación, el backend ejecuta automáticamente `importAllData()`:

```
1. Verificar colección "types"
   ├── Si existe → omitir importación
   └── Si no existe → importar 18 tipos desde PokeAPI

2. Verificar colección "moves"
   ├── Contar documentos
   └── Si < 10000 → reimportar pokemones (moves incompletos)

3. Verificar colección "pokemon"
   ├── Si existe → omitir importación
   └── Si no existe → importar 649 pokemones + TODOS sus moves
```

**Logging de ejemplo:**
```
============================================================
🔄 INICIANDO IMPORTACIÓN DE DATOS DESDE POKEAPI
============================================================

📦 Verificando tipos en base de datos...
🔄 Importando 18 tipos desde PokeAPI...
  ✅ Normal (normal)
  ✅ Lucha (fighting)
  ...
✅ Tipos importados: 18

📦 Verificando movimientos en base de datos...
⚠️ Solo hay 0 movimientos en BD (esperados: ~10000)
   Los movimientos podrían estar incompletos o filtrados

📦 Verificando pokemones en base de datos...
🔄 Importando 649 pokemones desde PokeAPI...
⚠️ Esto puede tomar varios minutos...

   📋 Movimientos de bulbasaur:
   - Viento Cortante (normal, power: 80)
   - Danza Espada (normal, power: N/A)
   - Corte (normal, power: 50)
   ...
   ... y 71 más

🐾 [1] Bulbasaur (bulbasaur)

============================================================
📋 RESUMEN DE IMPORTACIÓN
============================================================
📦 Tipos:
   - Existentes: 0
   - Importados: 18
📦 Movimientos:
   - Existentes: 0
   - Nuevos agregados: ~15000
📦 Pokemones:
   - Existentes: 0
   - Importados: 649
============================================================
✨ Importación completada!
============================================================
```

### Cambio Clave v2.0 → v3.0

| Aspecto | v2.0 | v3.0 |
|---------|------|------|
| Movimientos | Solo válidos para combate (damage + estados primarios) | **TODOS** los movimientos |
| Tipos | No existían | Nueva colección `types` (18 tipos) |
| Importación | Scripts manuales | **Automática** al iniciar backend |
| Verificación | No había | Verifica si existen datos antes de importar |
| Nombres ES | No había | `name_es` en pokémon, `names.es` en moves |

**Tiempo estimado primera importación:**
- Tipos: ~2 segundos (18 tipos)
- Movimientos: ~5-10 minutos (todas las move pools de 649 pokemones)
- Total: ~10-15 minutos con rate limiting

---

## 📊 Estadísticas Esperadas

| Colección | Documentos Estimados |
|-----------|---------------------|
| `pokemon` | 649 (Gen I-V) |
| `moves` | ~15,000-20,000 (todos los moves únicos) |
| `types` | 18 (Gen V + Fairy) |
| `rooms` | Variable (activo por sesión) |
| `battles` | Variable (activo por partida) |

---

## 🗑️ Reiniciar Datos

Si necesitas reimportar todos los datos (por ejemplo, para aplicar el nuevo filtro de TODOS los movimientos):

```javascript
// En MongoDB shell:
use pokemon-patacon

// Opcional: borrar todo
db.pokemon.drop()
db.moves.drop()
db.types.drop()

// Opcional: solo reimportar moves (si pokemon ya existe)
db.moves.drop()

// Luego reiniciar el backend -会自动 reimportará
```