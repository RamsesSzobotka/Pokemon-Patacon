# Implementación Sistema de Salas - Pokemon Patacon

**Versión:** 1.1  
**Fecha:** 14 de Mayo de 2026  
**Estado:** Parcialmente Implementado  
**Proyecto:** Sistema de Salas + Polling (WebSocket pendiente)

---

## 1. Visión General

Implementar el sistema de salas multijugador con WebSocket para el flujo:
- Crear sala (REST)
- Unirse a sala (REST)
- Lobby/Waiting (WebSocket)
- Draft/Selección de equipo (WebSocket)
- Iniciar batalla (WebSocket → REST)

**Arquitectura hibrida:** REST para gestión de salas, WebSocket para comunicación en tiempo real.

---

## 2. Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUJO DE SALAS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

[CREAR SALA]                          [UNIRSE A SALA]
      │                                     │
      ▼                                     ▼
POST /api/rooms                   POST /api/rooms/:code/join
  └─ Genera código                   └─ Valida código
  └─ Crea en MongoDB                 └─ Agrega player2
  └─ state: "waiting"               └─ state: "waiting"
      │                                     │
      ▼                                     ▼
      └────────────────┬────────────────────┘
                       │
                       ▼
              ┌───────────────┐
              │    LOBBY      │  ← WebSocket ws://localhost:3000/ws/:code
              └───────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
    [PLAYER 1]               [PLAYER 2]
    - Creador                 - Invitado
    - Puede iniciar draft    - Espera
           │                       │
           │   [AMBOS CONECTADOS]  │
           │           │           │
           ▼           ▼           ▼
    ┌─────────────────────────────────┐
    │         FASE DRAFT              │
    │  - Seleccionar 6 Pokémon      │
    │  - Seleccionar 4 moves/cada    │
    │  - Máximo 1 legendario/equipo   │
    └─────────────────────────────────┘
           │
           ▼
    [AMBOS CONFIRMAN EQUIPO]
           │
           ▼
    ┌─────────────────────────────────┐
    │       INICIA BATALLA            │
    │  - Crear documento en battles  │
    │  - state: "in_battle"           │
    │  - WS ruta: /battle/:code      │
    └─────────────────────────────────┘
```

---

## 3. Estructura de Datos - Rooms

### MongoDB: `rooms` collection

```typescript
interface Room {
  _id: ObjectId;
  code: string;                    // 6 caracteres alfanuméricos (único)
  created_at: Date;
  expires_at: Date;               // TTL: 30 min desde created_at
  state: "waiting" | "in_draft" | "in_battle" | "finished";
  
  players: {
    player1: {
      session_id: string;
      player_name: string;
      joined_at: Date;
      ready: boolean;
      team?: TeamMember[];        // Solo existe después de confirmar
    };
    player2: {
      session_id: string | null;  // null hasta que alguien se una
      player_name: string | null;
      joined_at: Date | null;
      ready: boolean;
      team?: TeamMember[];
    };
  };
  
  team_1: TeamMember[] | null;    // Confirmado por player1
  team_2: TeamMember[] | null;    // Confirmado por player2
  
  max_players: 2;
  battle_id: ObjectId | null;     // Referencia a battles cuando inicia
  winner: "player1" | "player2" | null;
  started_at: Date | null;
  finished_at: Date | null;
}

interface TeamMember {
  pokeapi_id: number;             // ID del Pokémon
  selected_moves: number[];       // 4 move_ids seleccionados
}
```

### Índices MongoDB

```javascript
// Único para códigos de sala
db.rooms.createIndex({ code: 1 }, { unique: true });

// TTL para auto-limpieza (30 minutos)
db.rooms.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Buscar sala por sesión activa
db.rooms.createIndex({ 'players.player1.session_id': 1 });
db.rooms.createIndex({ 'players.player2.session_id': 1 });
```

---

## 4. REST API - Endpoints

### 4.1 Crear Sala

| Aspecto | Valor |
|---------|-------|
| **Endpoint** | `POST /api/rooms` |
| **Body** | `{ session_id: string }` (opcional, generar si no existe) |
| **Respuesta 201** | `{ success: true, code: "AB12CD", state: "waiting" }` |
| **Errores** | 400 si session_id inválida |

```json
// Request
POST /api/rooms
{
  "session_id": "uuid-v4-generado-en-cliente"
}

// Response 201
{
  "success": true,
  "code": "AB12CD",
  "state": "waiting",
  "max_players": 2,
  "expires_at": "2026-05-13T12:30:00Z"
}
```

### 4.2 Obtener Sala por Código

| Aspecto | Valor |
|---------|-------|
| **Endpoint** | `GET /api/rooms/:code` |
| **Query Params** | `?session_id=uuid` (requerido para determinar host) |
| **Respuesta 200** | `{ code, state, players, isHost, ... }` |
| **Errores** | 404 si no existe |

**Respuesta incluye:**
- `isHost: boolean` - indica si el cliente actual es el creador (player1)

```json
// Request
GET /api/rooms/AB12CD?session_id=abc123

// Response 200
{
  "success": true,
  "room": {
    "code": "AB12CD",
    "state": "waiting",
    "players": {
      "player1": { "session_id": "abc123", "player_name": "Ash", "ready": false },
      "player2": { "session_id": "def456", "player_name": "Misty", "ready": false }
    },
    "isHost": true   // ← Basado en session_id vs player1.session_id
  }
}
```

### 4.3 Unirse a Sala

| Aspecto | Valor |
|---------|-------|
| **Endpoint** | `POST /api/rooms/:code/join` |
| **Body** | `{ session_id: string }` |
| **Respuesta 200** | `{ success: true, code, state: "waiting", ... }` |
| **Errores** | 400 (sala llena/ya estás dentro), 404 (no existe) |

```json
// Request
POST /api/rooms/AB12CD/join
{
  "session_id": "otro-uuid-v4"
}

// Response 200
{
  "success": true,
  "code": "AB12CD",
  "state": "waiting",
  "player_number": 2,
  "player1_ready": false
}

// Response 400 (sala llena)
{
  "success": false,
  "error": "ROOM_FULL",
  "message": "La sala ya tiene 2 jugadores"
}
```

### 4.4 Eliminar Sala (Solo Creador)

| Aspecto | Valor |
|---------|-------|
| **Endpoint** | `DELETE /api/rooms/:code` |
| **Auth** | Validar que quien pide es player1 |
| **Respuesta 200** | `{ success: true, message: "Room deleted" }` |
| **Errores** | 403 (no eres el creador), 404 (no existe) |

### 4.5 Actualizar Estado (Interno)

| Aspecto | Valor |
|---------|-------|
| **Endpoint** | `PUT /api/rooms/:code/state` |
| **Body** | `{ state: "in_draft" | "in_battle" | "finished", ... }` |
| **Uso** | WebSocket lo llama después de draft:start |

---

## 5. WebSocket - Protocolo

### 5.1 Conexión

| Aspecto | Valor |
|---------|-------|
| **URL** | `ws://localhost:3000/ws/:room_code` |
| **Query Params** | `?session_id=uuid&player_number=1|2` |
| **Upgrade** | HTTP 101 Switching Protocols |

```
Cliente:
GET /ws/AB12CD?session_id=abc123&player_number=1 HTTP/1.1
Host: localhost:3000
Upgrade: websocket
Connection: Upgrade

Servidor:
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
```

### 5.2 Eventos Cliente → Servidor

#### 5.2.1 connection:init (requerido al conectar)

```json
{
  "type": "connection:init",
  "data": {
    "session_id": "uuid-v4",
    "player_number": 1
  }
}
```

**Respuesta:** `room:joined`

#### 5.2.2 draft:start (solo player1)

```json
{
  "type": "draft:start",
  "player": "player1"
}
```

**Validaciones:**
- Solo player1 puede enviar
- Ambos jugadores deben estar conectados
- Sala debe estar en estado "waiting"

**Respuesta:** `draft:started` (broadcast a ambos)

#### 5.2.3 team:confirmed (ambos jugadores)

```json
{
  "type": "team:confirmed",
  "player": "player1",
  "data": {
    "team": [
      { "pokeapi_id": 25, "selected_moves": [33, 87, 93, 98] },
      { "pokeapi_id": 6, "selected_moves": [34, 98, 102, 156] },
      { "pokeapi_id": 150, "selected_moves": [7, 15, 25, 118] },
      { "pokeapi_id": 94, "selected_moves": [85, 87, 103, 251] },
      { "pokeapi_id": 65, "selected_moves": [94, 95, 100, 248] },
      { "pokeapi_id": 3, "selected_moves": [33, 73, 74, 202] }
    ]
  }
}
```

**Validaciones:**
- Exactamente 6 Pokémon
- Exactly 4 movimientos por Pokémon
- Máximo 1 legendario
- Pokémon no repetido entre equipos

**Respuestas:**
- Uno confirma: `team:waiting`
- Ambos confirman: `team:ready` + iniciar batalla

#### 5.2.4 ping

```json
{
  "type": "ping"
}
```

**Respuesta:** `pong` (heartbeat cada 15-30 segundos)

---

### 5.3 Eventos Servidor → Cliente

#### 5.3.1 room:joined

```json
{
  "type": "room:joined",
  "data": {
    "room_code": "AB12CD",
    "your_player_number": 1,
    "state": "waiting",
    "opponent": {
      "connected": false,
      "ready": false
    }
  }
}
```

#### 5.3.2 player:joined (broadcast)

```json
{
  "type": "player:joined",
  "data": {
    "player_number": 2,
    "session_id": "uuid-...",
    "joined_at": "2026-05-13T12:05:00Z"
  }
}
```

#### 5.3.3 room:state

```json
{
  "type": "room:state",
  "data": {
    "state": "waiting",
    "players": {
      "player1": { "connected": true, "ready": false },
      "player2": { "connected": true, "ready": false }
    }
  }
}
```

#### 5.3.4 draft:started (broadcast)

```json
{
  "type": "draft:started",
  "data": {
    "draft_order": "player1_first",
    "turn": 1
  }
}
```

#### 5.3.5 team:waiting

```json
{
  "type": "team:waiting",
  "data": {
    "waiting_for_player": "player2"
  }
}
```

#### 5.3.6 team:ready (broadcast)

```json
{
  "type": "team:ready",
  "data": {
    "player1_ready": true,
    "player2_ready": true,
    "battle_starts_in": 3
  }
}
```

#### 5.3.7 error

```json
{
  "type": "error",
  "data": {
    "code": "INVALID_ACTION",
    "message": "Solo el creador puede iniciar el draft",
    "recoverable": true
  }
}
```

---

## 6. Generación de Código de Sala

```typescript
function generateRoomCode(): string {
  // Excluir: I, O, 0, 1 para evitar confusión
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  
  return code; // Ejemplo: "AB12CD", "XK9MNP"
}
```

**Características:**
- 6 caracteres de longitud
- 32 caracteres posibles → 32^6 = 1 mil millones de combinaciones
- Sin caracteres confusos (I, O, 0, 1)
- Verificar unicidad antes de usar

---

## 7. Validaciones del Sistema

| Regla | Descripción | Fase |
|-------|-------------|------|
| **Máximo 2 jugadores** | Rechazar tercer connection | Lobby |
| **Solo player1 inicia draft** | Validar session_id coincide | WebSocket |
| **TTL de 30 min** | Auto-delete sala sin actividad | MongoDB TTL |
| **Equipos no repetidos** | Mismo Pokémon no en ambos | Draft |
| **Máximo 1 legendario** | Validar antes de confirmar | Draft |
| **6 Pokémon exactos** | Validar longitud array | Team Confirm |
| **4 moves por Pokémon** | Validar moves.length === 4 | Team Confirm |

---

## 8. Manejo de Errores

### Errores REST

| Código | Significado | Ejemplo |
|--------|-------------|---------|
| 400 | Solicitud inválida | Sala llena, parámetros incorrectos |
| 401 | No autorizado | Session inválida |
| 403 | Prohibido | No eres el creador (delete) |
| 404 | No encontrado | Sala no existe |
| 409 | Conflicto | Ya estás en esa sala |

### Errores WebSocket

| Code | Significado |
|------|-------------|
| `ROOM_NOT_FOUND` | Sala no existe |
| `ROOM_FULL` | Ya hay 2 jugadores |
| `NOT_CREATOR` | Solo player1 puede iniciar draft |
| `INVALID_TEAM` | Equipo no cumple requisitos |
| `ALREADY_READY` | Ya enviaste team:confirmed |
| `NOT_YOUR_TURN` | No es tu momento de acción |

---

## 9. Transiciones de Estado

```
┌──────────┐  player2 join   ┌──────────┐
│ waiting  │ ───────────────→│ waiting  │
└──────────┘  (ambos online) └────┬─────┘
                                  │
                     draft:start  │
                                  ▼
                          ┌──────────────┐
                          │   in_draft   │← (equipos confirmado)
                          └──────┬───────┘
                                 │
                    team:ready   │
                    (ambos ready)│
                                 ▼
                         ┌──────────────┐
                         │  in_battle   │← (batalla activa)
                         └──────┬───────┘
                                │
                     battle:end │
                                ▼
                         ┌──────────────┐
                         │   finished   │
                         └──────────────┘
```

---

## 10. Consideraciones Técnicas

### WebSocket con Bun + Hono

```typescript
// Bun no tiene WebSocket built-in en Hono
// Solución: Usar Bun.serve con upgrade manual

Bun.serve({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Si es WS path, hacer upgrade
    if (url.pathname.startsWith('/ws/')) {
      const roomCode = url.pathname.split('/ws/')[1];
      const success = server.upgrade(req, {
        data: { roomCode }
      });
      return success ? undefined : new Response('Upgrade failed', { status: 500 });
    }
    
    // otherwise use Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws) { /* handler */ },
    message(ws, msg) { /* handler */ },
    close(ws) { /* handler */ }
  }
});
```

### Sincronización

| Escenario | Acción |
|-----------|--------|
| Player1 desconecta | Player2 recibe notificación, sala espera 30s |
| Player2 desconecta | Player1 recibe notificación, sala espera 30s |
| Ambos desconectan | Sala pasa a estado "paused", TTL sigue corriendo |
| Re-conexión | Verificar session_id, restaurar estado |

### Persistencia

| Moment | Acción |
|--------|--------|
| Crear sala | Insertar en MongoDB `rooms` |
| Unir jugador | Update `players.player2` |
| Confirmar equipo | Update `team_1` o `team_2` |
| Iniciar batalla | Update `state: "in_battle"`, crear `battles` |
| Fin batalla | Update `winner`, `finished_at`, `state: "finished"` |

---

## 11. Archivos Creados/Modificados

### Implementados ✅

| Archivo | Descripción |
|---------|-------------|
| `src/db/rooms.ts` | Conexión + funciones CRUD para rooms |
| `src/services/roomService.ts` | Lógica de negocio + campo `isHost` |
| `src/routes/rooms.ts` | Endpoints REST + `isHost` en GET |
| `frontend/src/components/MainMenu.tsx` | UI lobby + polling + botones según host |

### Por Crear ⏳

| Archivo | Descripción |
|---------|-------------|
| `src/websocket/handler.ts` | WebSocket message handler |
| `src/websocket/roomManager.ts` | Gestión de conexiones por sala |

### Por Modificar

| Archivo | Cambio |
|---------|--------|
| `src/index.ts` | Agregar WebSocket server |
| `frontend/src/components/MainMenu.tsx` | Reemplazar polling por WebSocket |

---

## 12. Testing Checklist

- [ ] POST /api/rooms → 201 con código válido
- [ ] GET /api/rooms/:code → 200 con datos correctos
- [ ] POST /api/rooms/:code/join → 400 si sala llena
- [ ] POST /api/rooms/:code/join → 200 + player2 agregado
- [ ] WS connect → room:joined correcto
- [ ] WS connect player2 → player:joined broadcast a player1
- [ ] draft:start desde player2 → 403 error
- [ ] draft:start desde player1 → draft:started a ambos
- [ ] team:confirmed (uno) → team:waiting al otro
- [ ] team:confirmed (ambos) → team:ready + iniciar battle
- [ ] Desconexión player1 → notificación a player2
- [ ] TTL 30min → sala eliminada automáticamente

---

## 13. Estado de Implementación

### Implementado ✅

| Componente | Archivo | Estado |
|------------|---------|--------|
| Estructura Room en MongoDB | `backend/src/db/rooms.ts` | ✅ Completo |
| Servicio de salas | `backend/src/services/roomService.ts` | ✅ Completo |
| Endpoint POST /api/rooms (crear) | `backend/src/routes/rooms.ts` | ✅ Completo |
| Endpoint GET /api/rooms/:code | `backend/src/routes/rooms.ts` | ✅ Completo + `isHost` |
| Endpoint POST /api/rooms/:code/join | `backend/src/routes/rooms.ts` | ✅ Completo |
| Endpoint PUT /api/rooms/:code/state | `backend/src/routes/rooms.ts` | ✅ Completo |
| Endpoint POST /api/rooms/:code/ready | `backend/src/routes/rooms.ts` | ✅ Completo |
| Endpoint POST /api/rooms/:code/leave | `backend/src/routes/rooms.ts` | ✅ Completo |
| Lobby UI con botones | `frontend/src/components/MainMenu.tsx` | ✅ Completo |
| Detección de host por backend | `backend/src/routes/rooms.ts` | ✅ Completo |
| Polling para estado de sala | `frontend/src/components/MainMenu.tsx` | ✅ Completo |

### Pendiente ⏳

| Componente | Descripción | Prioridad |
|------------|-------------|-----------|
| **WebSocket server** | Servidor WS con Bun + Hono para comunicación en tiempo real | Alta |
| **WebSocket room manager** | Gestión de conexiones por sala | Alta |
| **WS connection:init** | Evento para inicializar conexión WS | Alta |
| **WS player:joined** | Notificación cuando opponent se conecta | Alta |
| **WS draft:start** | Evento para iniciar draft (solo host) | Alta |
| **WS team:confirmed** | Confirmación de equipo por jugador | Media |
| **WS team:waiting** | Indicador de esperar al opponent | Media |
| **WS team:ready** | Ambos equipos listos → iniciar batalla | Media |
| **Reemplazar polling por WS** | Cambiar polling 2s por eventos WebSocket | Media |
| **Desconexión handling** | Notificar cuando opponent se desconecta | Media |
| **TTL 30 min** | Auto-delete de salas inactivas en MongoDB | Baja |

---

## 14. Próximos Pasos (Prioridad)

### Paso 1: Implementar WebSocket Server (Alta)

Crear `backend/src/websocket/handler.ts` y `backend/src/websocket/roomManager.ts`:
- Configurar Bun.serve con upgrade manual para WebSocket
- Rutas: `/ws/:room_code?session_id=xxx`
- Eventos: `connection:init`, `draft:start`, `team:confirmed`, `ping`

### Paso 2: Reemplazar Polling por WebSocket (Alta)

Modificar `frontend/src/components/MainMenu.tsx`:
- Conectar a WebSocket en lugar de polling cada 2 segundos
- Escuchar eventos: `room:joined`, `player:joined`, `room:state`

### Paso 3: Sistema de Draft (Media)

Implementar flujo de selección de Pokémon:
- `draft:started` → `draft:pick` → `draft:confirm`
- Validaciones: 6 Pokémon, 4 moves, máximo 1 legendario

### Paso 4: Inicio de Batalla (Media)

Conectar draft con sistema de batallas:
- Crear documento en `battles` collection
- Transición: `in_draft` → `in_battle`

---

## 15. Referencias

- **PRD.md** - Sección 3.1 (Sistema de Salas), 7 (Flujo de Juego)
- **SCHEMAS_MONGODB.md** - Sección 2 (rooms collection)
- **WEBSOCKET_PROTOCOL.md** - Eventos definidos

---

**Documento creado:** 13 Mayo 2026  
**Última actualización:** 14 Mayo 2026  
**Próximo paso:** Implementar WebSocket Server (`backend/src/websocket/`)