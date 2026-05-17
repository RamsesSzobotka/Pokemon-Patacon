# API REST Endpoints - Pokemon Patacon

**Versión:** 1.0  
**Fecha:** 13 de Mayo de 2026  
**Base URL:** `http://localhost:3000/api` (desarrollo) | `https://api.pokemon-patacon.com` (producción)  
**Protocolo:** HTTP/1.1 + WebSocket (upgrade)

---

## 📋 Endpoints Disponibles

### 1. Búsqueda de Pokémon

#### `GET /api/pokemon/search`

Buscar Pokémon por nombre, tipo o ID.

**Query Parameters:**
| Parámetro | Tipo | Obligatorio | Descripción |
|-----------|------|-------------|-------------|
| `q` | string | Sí | Query de búsqueda (nombre parcial, ej: "pika") |
| `type` | string | No | Filtrar por tipo (ej: "electric", "water") |
| `limit` | number | No | Límite de resultados (default: 20, max: 100) |
| `offset` | number | No | Paginación (default: 0) |

**Request:**
```bash
GET /api/pokemon/search?q=pikachu&limit=10
```

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": 25,
        "name": "pikachu",
        "types": ["electric"],
        "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/25.gif",
        "generation": 1,
        "is_legendary": false
      },
      {
        "id": 26,
        "name": "raichu",
        "types": ["electric"],
        "sprite": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/26.gif",
        "generation": 1,
        "is_legendary": false
      }
    ],
    "total": 2,
    "limit": 10,
    "offset": 0
  },
  "timestamp": "2026-05-13T12:00:00Z"
}
```

**Response 400 Bad Request:**
```json
{
  "success": false,
  "error": "Query too short (min 2 characters)",
  "code": "QUERY_TOO_SHORT"
}
```

---

### 2. Obtener Pokémon por ID

#### `GET /api/pokemon/:id`

Obtener datos completos de un Pokémon específico.

**Path Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | number | ID de PokeAPI (1-649) |

**Request:**
```bash
GET /api/pokemon/25
```

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "id": 25,
    "name": "pikachu",
    "generation": 1,
    "types": ["electric"],
    "stats": {
      "hp": 35,
      "attack": 55,
      "defense": 40,
      "sp_attack": 50,
      "sp_defense": 50,
      "speed": 90
    },
    "base_experience": 112,
    "height_dm": 4,
    "weight_hg": 60,
    "is_legendary": false,
    "is_mythical": false,
    "sprites": {
      "animated_gif": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/versions/generation-v/black-white/animated/25.gif",
      "static_png": "https://raw.githubusercontent.com/PokeAPI/sprites/master/pokemon/25.png"
    },
    "moves": [
      {
        "name": "thunder-shock",
        "type": "electric",
        "power": 40,
        "accuracy": 100,
        "priority": 0,
        "damage_class": "special"
      },
      {
        "name": "growl",
        "type": "normal",
        "power": null,
        "accuracy": 100,
        "priority": 0,
        "damage_class": "status"
      },
      {
        "name": "thunderbolt",
        "type": "electric",
        "power": 90,
        "accuracy": 100,
        "priority": 0,
        "damage_class": "special"
      },
      {
        "name": "thunder",
        "type": "electric",
        "power": 110,
        "accuracy": 70,
        "priority": 0,
        "damage_class": "special"
      }
    ]
  },
  "timestamp": "2026-05-13T12:00:00Z"
}
```

**Response 404 Not Found:**
```json
{
  "success": false,
  "error": "Pokémon not found",
  "code": "POKEMON_NOT_FOUND"
}
```

---

### 3. Obtener Tabla de Tipos

#### `GET /api/types`

Obtener tabla completa de efectividad de tipos (18×18).

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `attacker` | string | Filtrar por tipo atacante (opcional) |
| `defender` | string | Filtrar por tipo defensor (opcional) |

**Request:**
```bash
GET /api/types
```

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "types": [
      {
        "attacker_type": "electric",
        "matchups": {
          "water": 2,
          "flying": 2,
          "grass": 0.5,
          "dragon": 0.5,
          "ground": 0,
          "normal": 1,
          "fire": 1,
          "ice": 1,
          "poison": 1,
          "rock": 1,
          "ghost": 1,
          "bug": 1,
          "steel": 1,
          "psychic": 1,
          "fighting": 1,
          "dark": 1,
          "fairy": 1
        }
      }
      // ... 17 tipos más
    ]
  },
  "timestamp": "2026-05-13T12:00:00Z"
}
```

---

### 4. Obtener Lista de Legendarios

#### `GET /api/legendaries`

Obtener lista de todos los Pokémon legendarios disponibles.

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `include_mythical` | boolean | Incluir Mythicals (default: true) |

**Request:**
```bash
GET /api/legendaries?include_mythical=true
```

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "legendaries": [
      {
        "id": 144,
        "name": "articuno",
        "type": "ice/flying",
        "generation": 1
      },
      {
        "id": 145,
        "name": "zapdos",
        "type": "electric/flying",
        "generation": 1
      },
      // ... más legendarios
      {
        "id": 493,
        "name": "arceus",
        "type": "normal",
        "generation": 4
      }
    ],
    "total": 48,
    "include_mythical": true
  },
  "timestamp": "2026-05-13T12:00:00Z"
}
```

---

### 5. Crear Sala

#### `POST /api/rooms`

Crear nueva sala de batalla (no necesita autenticación).

**Request Body:**
```json
{
  "player_name": "Trainer_A"  // Opcional, solo para UI
}
```

**Response 201 Created:**
```json
{
  "success": true,
  "data": {
    "room_code": "AB12CD",
    "created_at": "2026-05-13T12:00:00Z",
    "expires_at": "2026-05-13T12:30:00Z",
    "url": "ws://localhost:3000/battle/AB12CD"
  },
  "timestamp": "2026-05-13T12:00:00Z"
}
```

**Response 400 Bad Request:**
```json
{
  "success": false,
  "error": "Room creation limit reached",
  "code": "ROOM_LIMIT_EXCEEDED"
}
```

---

### 6. Obtener Sala

#### `GET /api/rooms/:code`

Verificar si una sala existe y está disponible.

**Path Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `code` | string | Código de sala (4-6 caracteres) |

**Request:**
```bash
GET /api/rooms/AB12CD
```

**Response 200 OK:**
```json
{
  "success": true,
  "data": {
    "room_code": "AB12CD",
    "state": "waiting",
    "players_joined": 1,
    "max_players": 2,
    "created_at": "2026-05-13T12:00:00Z",
    "expires_at": "2026-05-13T12:30:00Z"
  },
  "timestamp": "2026-05-13T12:00:00Z"
}
```

**Response 404 Not Found:**
```json
{
  "success": false,
  "error": "Room not found",
  "code": "ROOM_NOT_FOUND"
}
```

---

### 7. Eliminar Sala (Admin)

#### `DELETE /api/rooms/:code`

Eliminar sala (solo administrador o sala vacía).

**Request:**
```bash
DELETE /api/rooms/AB12CD
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Room deleted successfully"
}
```

**Response 403 Forbidden:**
```json
{
  "success": false,
  "error": "Room has active players",
  "code": "ROOM_IN_USE"
}
```

---

### 8. Health Check

#### `GET /api/health`

Verificar si el servidor está operativo.

**Request:**
```bash
GET /api/health
```

**Response 200 OK:**
```json
{
  "success": true,
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-05-13T12:00:00Z"
}
```

---

## 🔄 WebSocket Upgrade

Todos los clientes deben conectarse a WebSocket después de obtener el código de sala.

**URL:** `ws://localhost:3000/battle/:room_code`

Ver documento [WEBSOCKET_PROTOCOL.md](WEBSOCKET_PROTOCOL.md) para eventos y flujos detallados.

---

## ⚠️ Códigos de Error HTTP

| Status | Significado | Causa Común |
|--------|-------------|-------------|
| `200 OK` | Éxito | Request procesado correctamente |
| `201 Created` | Recurso creado | Sala creada exitosamente |
| `400 Bad Request` | Solicitud inválida | Parámetros faltantes o mal formados |
| `404 Not Found` | Recurso no existe | Pokémon o sala no encontrados |
| `409 Conflict` | Conflicto de estado | Ej: intentar unirse a sala llena |
| `429 Too Many Requests` | Rate limit | Demasiadas requests (max 100/min) |
| `500 Internal Server Error` | Error del servidor | Contactar admin |
| `503 Service Unavailable` | Servicio no disponible | Mantenimiento o PokeAPI caída |

---

## 🚀 Rate Limiting

- **General:** 100 requests/minuto por IP
- **Búsqueda:** 50 requests/minuto
- **PokeAPI Proxy:** 10 requests/minuto (caché mitiga esto)

Si se excede:
```json
{
  "success": false,
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```

---

## 📡 Headers Recomendados

**Todos los requests deben incluir:**
```
Content-Type: application/json
Accept: application/json
User-Agent: PokemonPatacon/1.0
```

**CORS Headers (respuesta del servidor):**
```
Access-Control-Allow-Origin: * (dev) | https://pokemon-patacon.com (prod)
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 3600
```

