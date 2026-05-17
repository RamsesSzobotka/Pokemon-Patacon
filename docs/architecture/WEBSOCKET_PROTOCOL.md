# WebSocket Protocol - Pokemon Patacon

**Versión:** 1.0  
**Fecha:** 13 de Mayo de 2026  
**Runtime:** Bun + Hono  
**Protocolo:** WebSocket (RFC 6455)

---

## 🔗 Conexión

**URL:** `ws://localhost:3000/battle/:room_code`

**Headers Requeridos:**
```
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: [generated]
Sec-WebSocket-Version: 13
```

**Response (101 Switching Protocols):**
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: [response-key]
```

---

## 📨 Estructura General de Mensajes

Todos los mensajes JSON contienen:

```typescript
{
  "type": "string",              // Tipo de evento
  "player": "player1" | "player2",  // Quién envía (opcional en algunos)
  "data": object,                // Payload específico del evento
  "timestamp": "ISO8601",        // Timestamp del servidor
  "seq": number                  // Número de secuencia (para deduplicación)
}
```

---

## 🔄 Flujos de Estado

### Flujo General: Connection → Draft → Battle → End

```
[CLIENT]                        [SERVER]
  │                               │
  ├─ ws://battle/AB12CD (connect)─┤
  │<────── room:joined ────────────┤
  │                               │
  ├─ pokemon:select ──────────────┤
  │                               │
  │<────── pokemon:selected ───────┤ (broadcast a ambos)
  │                               │
  ├─ team:confirmed ──────────────┤
  │                               │
  │<────── team:ready ─────────────┤ (cuando ambos confirman)
  │                               │
  │<────── battle:start ───────────┤ (inicia batalla)
  │                               │
  ├─ turn:action ─────────────────┤
  │                               │
  │<────── turn:waiting ───────────┤ (espera otro jugador)
  │                               │
  │<────── turn:execute ───────────┤ (resultado del turno)
  │                               │
  │<────── pokemon:fainted (si) ───┤
  │                               │
  ├─ pokemon:switch (si) ─────────┤
  │                               │
  │<────── pokemon:switched ───────┤ (confirmación)
  │                               │
  ├─ (próximo turno) ─────────────┤
  │                               │
  │<────── battle:end ─────────────┤ (cuando acaba)
```

---

## 📤 Eventos Cliente → Servidor

### 1. `connection:init`

**Trigger:** Cliente conecta a WebSocket

**Payload:**
```json
{
  "type": "connection:init",
  "data": {
    "session_id": "uuid-v4",
    "player_name": "Trainer_A"
  }
}
```

**Respuesta del Servidor (201):** `room:joined`

---

### 2. `pokemon:select`

**Trigger:** Jugador selecciona un Pokémon durante draft

**Payload:**
```json
{
  "type": "pokemon:select",
  "player": "player1",
  "data": {
    "pokemon_id": 25,
    "position_in_team": 0
  }
}
```

**Validaciones:**
- Pokémon no debe estar ya seleccionado por otro jugador
- No más de 1 legendario
- Máximo 6 Pokémon por equipo

**Respuesta (Broadcast):** `pokemon:selected` (a ambos jugadores)

---

### 3. `team:confirmed`

**Trigger:** Jugador confirma equipo y está listo para batalla

**Payload:**
```json
{
  "type": "team:confirmed",
  "player": "player1",
  "data": {
    "team": [
      {
        "pokemon_id": 25,
        "moves": [33, 24, 87, 85]  // IDs de movimientos
      },
      // ... 5 más
    ]
  }
}
```

**Validaciones:**
- Exactamente 6 Pokémon
- Exactamente 4 movimientos por Pokémon
- Máximo 1 legendario

**Respuesta:** 
- Si ambos confirman: `battle:start` (broadcast)
- Si solo uno: `team:waiting` (al otro jugador)

---

### 4. `turn:action`

**Trigger:** Jugador ejecuta acción en su turno

**Payload (Ataque):**
```json
{
  "type": "turn:action",
  "player": "player1",
  "data": {
    "action_type": "attack",
    "move_id": 33,
    "move_name": "tackle"
  }
}
```

**Payload (Cambiar Pokémon):**
```json
{
  "type": "turn:action",
  "player": "player1",
  "data": {
    "action_type": "switch",
    "new_active_index": 2
  }
}
```

**Payload (Usar Objeto):**
```json
{
  "type": "turn:action",
  "player": "player1",
  "data": {
    "action_type": "item",
    "item_type": "full_restore",  // "full_restore" | "revive"
    "target_index": 0
  }
}
```

**Timeout:** 30 segundos. Si no recibe acción:
- Turno 1-3: Se forza ataque aleatorio
- Turno 4+: Se forza switch aleatorio
- Turno 10+: Desconexión automática → victoria oponente

**Respuesta:**
- `turn:waiting` (al otro jugador, para UI "esperando...")
- `turn:execute` (broadcast, después de recibir 2 acciones)

---

### 5. `ping`

**Trigger:** Heartbeat del cliente cada 15 segundos

**Payload:**
```json
{
  "type": "ping",
  "data": {}
}
```

**Respuesta:** `pong`

---

## 📥 Eventos Servidor → Cliente

### 1. `room:joined`

**Trigger:** Jugador se conecta exitosamente

**Payload:**
```json
{
  "type": "room:joined",
  "data": {
    "room_code": "AB12CD",
    "your_player_number": 1,
    "opponent_status": "waiting_for_opponent" | "waiting_for_pokemon" | "ready"
  }
}
```

---

### 2. `pokemon:selected`

**Trigger:** Cualquier jugador selecciona un Pokémon (broadcast)

**Payload:**
```json
{
  "type": "pokemon:selected",
  "player": "player1",
  "data": {
    "pokemon_id": 25,
    "pokemon_name": "pikachu",
    "position": 0
  }
}
```

---

### 3. `team:ready`

**Trigger:** Ambos jugadores confirman equipos

**Payload:**
```json
{
  "type": "team:ready",
  "data": {
    "player1_ready": true,
    "player2_ready": true,
    "starting_in": 3
  }
}
```

---

### 4. `battle:start`

**Trigger:** Inicia la batalla

**Payload:**
```json
{
  "type": "battle:start",
  "data": {
    "player1": {
      "active_pokemon": {
        "id": 25,
        "name": "pikachu",
        "hp": 35,
        "max_hp": 35
      }
    },
    "player2": {
      "active_pokemon": {
        "id": 4,
        "name": "charmander",
        "hp": 39,
        "max_hp": 39
      }
    },
    "current_turn": 1
  }
}
```

---

### 5. `turn:waiting`

**Trigger:** Se recibe acción del otro jugador, se espera la tuya

**Payload:**
```json
{
  "type": "turn:waiting",
  "data": {
    "waiting_for_player": "player1",
    "opponent_action_received": true,
    "time_remaining": 30
  }
}
```

---

### 6. `turn:execute`

**Trigger:** Ambas acciones recibidas; se procesa el turno

**Payload:**
```json
{
  "type": "turn:execute",
  "data": {
    "turn_number": 1,
    "coinflip": "player1",           // Quién ataca primero
    "actions": [
      {
        "player": "player1",
        "action_type": "attack",
        "action_description": "pikachu used Tackle!",
        "target_pokemon": "charmander",
        "damage": 8,
        "damage_text": "It's not very effective...",
        "critical": false,
        "accuracy_check": true,
        "status_applied": null
      },
      {
        "player": "player2",
        "action_type": "attack",
        "action_description": "charmander used Ember!",
        "target_pokemon": "pikachu",
        "damage": 15,
        "damage_text": "It's super effective!",
        "critical": false,
        "accuracy_check": true,
        "status_applied": {
          "type": "burn",
          "turns": 3
        }
      }
    ],
    "after_state": {
      "player1": {
        "active_pokemon": {
          "id": 25,
          "name": "pikachu",
          "hp": 20,
          "max_hp": 35,
          "status": "burn"
        }
      },
      "player2": {
        "active_pokemon": {
          "id": 4,
          "name": "charmander",
          "hp": 39,
          "max_hp": 39,
          "status": null
        }
      }
    },
    "next_turn": 2
  }
}
```

---

### 7. `pokemon:fainted`

**Trigger:** Un Pokémon llega a 0 HP

**Payload:**
```json
{
  "type": "pokemon:fainted",
  "data": {
    "player": "player1",
    "pokemon_name": "pikachu",
    "remaining_pokemon": 5,
    "action_required": true
  }
}
```

---

### 8. `pokemon:switched`

**Trigger:** Jugador cambia de Pokémon (confirmación)

**Payload:**
```json
{
  "type": "pokemon:switched",
  "data": {
    "player": "player1",
    "old_pokemon": "pikachu",
    "new_pokemon": "charizard",
    "new_pokemon_hp": 50,
    "new_pokemon_max_hp": 78
  }
}
```

---

### 9. `item:used`

**Trigger:** Jugador usa un objeto

**Payload:**
```json
{
  "type": "item:used",
  "data": {
    "player": "player1",
    "item_type": "full_restore",
    "target_pokemon": "pikachu",
    "new_hp": 35,
    "new_max_hp": 35,
    "remaining_items": {
      "full_restore": 2,
      "revive": 2
    }
  }
}
```

---

### 10. `battle:end`

**Trigger:** Uno o ambos equipos llegan a 0 Pokémon

**Payload:**
```json
{
  "type": "battle:end",
  "data": {
    "winner": "player1",
    "loser": "player2",
    "reason": "all_pokemon_fainted",  // o "opponent_disconnected"
    "turn_count": 15,
    "duration_seconds": 180,
    "xp_earned": {
      "player1": 100,
      "player2": 50
    }
  }
}
```

---

### 11. `error`

**Trigger:** Error en el servidor

**Payload:**
```json
{
  "type": "error",
  "data": {
    "code": "INVALID_ACTION",
    "message": "Pokémon not found in your team",
    "recoverable": true
  }
}
```

---

### 12. `pong`

**Trigger:** Respuesta a `ping`

**Payload:**
```json
{
  "type": "pong",
  "data": {}
}
```

---

## 🔐 Seguridad y Validación

### Rate Limiting WebSocket
- Máximo 10 mensajes/segundo por conexión
- Si se excede: desconexión automática

### Validación de Acciones
Antes de procesar `turn:action`:
```
1. ¿El Pokémon está en el equipo del jugador?
2. ¿El movimiento es válido para ese Pokémon?
3. ¿Es turno del jugador? (coinflip válido)
4. ¿El objeto existe en el inventario?
5. ¿El Pokémon objetivo es válido?
```

Si falla: enviar `error` event, NO procesar acción.

---

## 🔄 Reconexión

### Escenario: Cliente desconectado durante batalla

**Cliente intenta reconectarse:**
```json
{
  "type": "connection:init",
  "data": {
    "session_id": "uuid-v4",
    "room_code": "AB12CD"  // Indicar sala anterior
  }
}
```

**Servidor valida:**
- ¿Existe la sala?
- ¿Está en progreso?
- ¿Turno actual ejecutado?

**Respuestas posibles:**

1. **Reconexión exitosa (dentro de 30 seg):**
```json
{
  "type": "connection:restored",
  "data": {
    "battle_state": { ... },
    "current_turn": 5,
    "your_active_pokemon": { ... }
  }
}
```

2. **Reconexión tardía (>30 seg):**
```json
{
  "type": "error",
  "data": {
    "code": "CONNECTION_TIMEOUT",
    "message": "Opponent was granted victory",
    "final_state": "game_over"
  }
}
```

---

## ⚡ Performance Targets

| Métrica | Target | Definición |
|---------|--------|-----------|
| **Message Latency** | <50ms | Desde envío a recepción |
| **Broadcast Sync** | <100ms | Ambos clientes reciben resultado |
| **Action Processing** | <200ms | Validación + cálculo de daño |
| **Reconnect Time** | <5s | Desde desconexión a estado restaurado |

---

## 📋 Checklist de Implementación (Bun)

- [ ] Configurar WebSocket handler en Hono
- [ ] Implementar gestión de salas en memoria (Map)
- [ ] Validar formato de mensajes JSON
- [ ] Implementar rate limiting
- [ ] Agregar heartbeat/ping-pong
- [ ] Manejar desconexiones y timeouts
- [ ] Persistencia de batalla en MongoDB (opcional)
- [ ] Tests de sincronización

