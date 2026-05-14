# MongoDB Schemas - Pokemon Patacon

**Versión:** 1.0  
**Fecha:** 13 de Mayo de 2026  
**Estado:** Especificación Técnica

---

## 📊 Colecciones de MongoDB

### 1. `pokemon` - Caché de Pokémon desde PokeAPI

**Propósito:** Almacenar datos de Pokémon para evitar llamadas repetidas a PokeAPI v2.

**Índices Recomendados:**
- `pokeapi_id` (único)
- `name` (texto)
- `is_legendary` (booleano)

```javascript
{
  "_id": ObjectId,                          // MongoDB ID único
  "pokeapi_id": 1,                          // ID de PokeAPI (1-649)
  "name": "bulbasaur",
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
  "moves": [
    {
      "name": "tackle",
      "type": "normal",
      "power": 40,
      "accuracy": 100,
      "priority": 0,
      "damage_class": "physical",  // "physical" | "special" | "status"
      "pokeapi_id": 33
    },
    // ... 3+ movimientos más (validados para Gen V)
  ],
  "sprites": {
    "animated_gif": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/1.gif",
    "static_png": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/1.png"
  },
  "height_dm": 7,                           // Altura en decímetros (PokeAPI)
  "weight_hg": 69,                          // Peso en hectogramos (PokeAPI)
  "cached_at": ISODate("2026-05-13T12:00:00Z"),
  "updated_at": ISODate("2026-05-13T12:00:00Z")
}
```

---

### 2. `rooms` - Salas de Batalla Multijugador

**Propósito:** Gestionar salas, códigos de acceso, jugadores y estado de pre-batalla.

**Índices Recomendados:**
- `code` (único)
- `created_at` (TTL: 30 minutos)
- `state`

```javascript
{
  "_id": ObjectId,
  "code": "AB12CD",                         // Código 4-6 caracteres (único)
  "created_at": ISODate("2026-05-13T12:00:00Z"),
  "expires_at": ISODate("2026-05-13T12:30:00Z"),  // TTL para limpieza
  "state": "waiting",                       // "waiting" | "draft" | "battle" | "finished"
  "players": {
    "player1": {
      "session_id": "uuid-here",
      "joined_at": ISODate("2026-05-13T12:00:00Z"),
      "ready": false                        // Confirmó equipo
    },
    "player2": {
      "session_id": "uuid-here",
      "joined_at": ISODate("2026-05-13T12:05:00Z"),
      "ready": true
    }
  },
  "max_players": 2,
  "battle_id": ObjectId || null            // Referencia a battle_state cuando inicia
}
```

---

### 3. `battles` - Estado de Batalla en Progreso

**Propósito:** Persistir estado de batalla para reconexión y historial.

**Índices Recomendados:**
- `room_code` (único)
- `started_at` (TTL: 1 hora)

```javascript
{
  "_id": ObjectId,
  "room_code": "AB12CD",
  "started_at": ISODate("2026-05-13T12:10:00Z"),
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
        "timestamp": ISODate("2026-05-13T12:10:45Z")
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
      "executed_at": ISODate("2026-05-13T12:10:50Z")
    }
    // ... histórico de turnos anteriores
  ],
  "winner": null,                           // null | "player1" | "player2"
  "finished_at": null                       // null o ISODate cuando termina
}
```

---

### 4. `type_matchups` - Caché de Tabla de Tipos

**Propósito:** Almacenar tabla de efectividad de tipos para no consultar PokeAPI en cada cálculo.

**Índices Recomendados:**
- `attacker_type` + `defender_type` (único compuesto)

```javascript
{
  "_id": ObjectId,
  "attacker_type": "electric",
  "defender_type": "water",
  "multiplier": 2.0,                        // 0.5 | 1 | 2 | etc.
  "description": "Super effective",
  "cached_at": ISODate("2026-05-13T12:00:00Z")
}
```

---

### 5. `sessions` - Sesiones de Jugador (Opcional)

**Propósito:** Rastrear sesiones anónimas para estadísticas y reconexión.

**Índices Recomendados:**
- `session_id` (único)
- `created_at` (TTL: 24 horas)

```javascript
{
  "_id": ObjectId,
  "session_id": "uuid-v4",                  // Generado por cliente
  "created_at": ISODate("2026-05-13T12:00:00Z"),
  "last_active": ISODate("2026-05-13T12:45:00Z"),
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
await db.collection('pokemon').createIndex({ pokeapi_id: 1 }, { unique: true });
await db.collection('pokemon').createIndex({ name: 'text' });
await db.collection('pokemon').createIndex({ is_legendary: 1 });

await db.collection('rooms').createIndex({ code: 1 }, { unique: true });
await db.collection('rooms').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
await db.collection('rooms').createIndex({ state: 1 });

await db.collection('battles').createIndex({ room_code: 1 }, { unique: true });
await db.collection('battles').createIndex({ started_at: 1 }, { expireAfterSeconds: 3600 });

await db.collection('type_matchups').createIndex(
  { attacker_type: 1, defender_type: 1 },
  { unique: true }
);

await db.collection('sessions').createIndex({ session_id: 1 }, { unique: true });
await db.collection('sessions').createIndex({ created_at: 1 }, { expireAfterSeconds: 86400 });
```

---

## 📝 Operaciones Comunes

### Buscar Pokémon por nombre
```javascript
db.pokemon.findOne({ name: /pikachu/i })
```

### Obtener tabla de tipos para un matchup
```javascript
db.type_matchups.findOne({ attacker_type: "electric", defender_type: "water" })
```

### Limpiar salas expiradas
```javascript
// Automático con TTL index
```

### Obtener estado de batalla actual
```javascript
db.battles.findOne({ room_code: "AB12CD" })
```

---

## 🚀 Data Seeding (Inicialización)

Al iniciar la aplicación por primera vez:

1. Descargar 649 Pokémon desde PokeAPI v2
2. Insertar en colección `pokemon`
3. Descargar tabla de tipos (18×18 matchups)
4. Insertar en colección `type_matchups`
5. Crear índices automáticamente

**Tiempo estimado:** ~30 segundos en primera conexión (incluye rate limiting de PokeAPI)

