# Errores en Desarrollo - Pokemon Patacon

**Versión:** 1.0  
**Fecha:** 15 de Mayo de 2026  
**Estado:** Documentación de errores encontrados durante el desarrollo

---

## Error #1: Sincronización del Draft en Tiempo Real

### 📋 Resumen

Los jugadores no veían las selecciones del oponente ni el cambio de turno sin recargar la página. El evento `draft:picked` no se procesaba correctamente en el frontend.

### 🔍 Síntomas

1. Al hacer un pick, el otro jugador no veía la selección automáticamente
2. El turno no se actualizaba en tiempo real
3. Había que recargar la página para ver los picks del oponente y el turno actual
4. Errores en backend al intentar hacer picks: `"Error al realizar el pick"`

### 🧩 Causas Raíz

#### 1. Race Condition en el Frontend

**Problema:** El código enviaba solicitudes `draft:state` y `draft:picks` antes de tener el `playerNumber` válido.

```typescript
// ANTES - Código problemático
const requestDraftState = () => {
    socket.send({ type: 'draft:state' });  // Se enviaba con playerNumber = 0
    socket.send({ type: 'draft:picks' });
};

if (isConnected()) {
    requestDraftState();  // Se ejecutaba inmediatamente
}
```

**Consecuencia:** Los eventos `draft:picked` y `draft:picks` no se procesaban correctamente porque `playerNumberRef.current` era `0`.

#### 2. Validación Defensiva Insuficiente

**Problema:** Los handlers de eventos WebSocket no verificaban si `playerNumber` estaba disponible antes de procesar los datos.

```typescript
// ANTES - Sin validación
socket.on('draft:picked', (data) => {
    const pickerIsMe = data.player_number === playerNumberRef.current;  // Fallaba si era 0
    // ...
});
```

#### 3. Error en Backend (MongoDB)

**Problema:** La función `draftPick` en `rooms.ts` no manejaba correctamente la estructura de respuesta de `findOneAndUpdate` con `returnDocument: 'after'`.

```typescript
// ANTES - Código problemático
const result = await collection.findOneAndUpdate(
    { code },
    { $set: updateObj },
    { returnDocument: 'after' }
);

if (!result || !('value' in result)) {
    return null;  // Fallaba porque el driver retorna el documento directamente
}
```

### ✅ Solución Implementada

#### 1. Solicitar estado solo cuando playerNumber está disponible

```typescript
// DESPUÉS - Solo solicitar si tenemos playerNumber válido
const requestDraftState = () => {
    if (playerNumberRef.current === 0) {
        console.log('[Draft] Esperando playerNumber válido...');
        return;
    }
    socket.send({ type: 'draft:state' });
    socket.send({ type: 'draft:picks' });
};
```

#### 2. Solicitar estado después de recibir playerNumber

```typescript
// En room:joined
socket.on('room:joined', (data) => {
    if (typeof data.player_number === 'number') {
        setPlayerNumber(data.player_number);
        playerNumberRef.current = data.player_number;
        requestDraftState();  // Ahora sí solicitados estado
    }
});
```

#### 3. Validación defensiva en handlers

```typescript
// En draft:picked
socket.on('draft:picked', (data) => {
    if (playerNumberRef.current === 0) {
        console.warn('[Draft] Ignorando - playerNumber no disponible');
        return;
    }
    // Procesar normalmente...
});
```

#### 4. Corregir manejo de respuesta de MongoDB

```typescript
// DESPUÉS - Manejar ambas estructuras de respuesta
let updatedRoom: Room | null = null;

if (!result) return null;

if ('value' in result) {
    updatedRoom = result.value as Room | null;
} else if (result && typeof result === 'object') {
    updatedRoom = result as unknown as Room;
}

return updatedRoom;
```

### 📁 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/Draft.tsx` | Validación defensiva, logs de debug, handler para `draft:error` |
| `backend/src/db/rooms.ts` | Logs de debug, manejo de respuesta de MongoDB |

### 🧪 Cómo Verificar la Solución

1. Iniciar dos jugadores en una sala de draft
2. Jugador 1 hace un pick
3. Verificar que Jugador 2 ve:
   - El pick del oponente en tiempo real
   - El cambio de turno actualizado
4. No requiere recargar la página

### 📝 Lecciones Aprendidas

1. **Siempre validar estado antes de procesar eventos WebSocket** - No asumir que los datos están disponibles inmediatamente
2. **Manejar diferentes estructuras de respuesta** - Los drivers de MongoDB pueden retornar estructuras diferentes según la configuración
3. **Agregar logs de debug** - Facilita enormemente el diagnóstico de problemas
4. **Validación defensiva en el frontend** - Siempre verificar que `playerNumber` o `sessionId` estén disponibles antes de procesar

### 🔮 Recomendaciones Futuras

1. **Implementar reconexión automática con reintento** - Si se pierde la conexión, intentar reconectar antes de mostrar error
2. **Agregar timeout para acciones** - Si un pick no responde en X segundos, mostrar error y permitir reintento
3. **Sistema de debug en producción** - Agregar variable de entorno para habilitar logs detallados en producción si es necesario
4. **Validar estructura de respuestas MongoDB** - Crear helpers reutilizables para manejar diferentes estructuras de respuesta

---

## Error #2: Motor de Batalla V1 - Errores 500 y Desincronización de Mensajes

### 📋 Resumen

Después de cada turno de batalla, el servidor devolvía errores HTTP 500 (Internal Server Error), cerraba la conexión WebSocket y generaba bucles de reconexión. Además, los mensajes de batalla narrados no se mostraban correctamente en el frontend debido a un bug de React con "Maximum update depth exceeded".

### 🔍 Síntomas

1. **En la consola del backend:**
   ```
   Failed to load resource: the server responded with a status of 500 (Internal Server Error)
   ```

2. **En el WebSocket:**
   ```
   WebSocket connection to 'ws://localhost:3000/ws?session_id=...' failed
   ```
   (Se repetía ~1000 veces en bucle infinito)

3. **En React DevTools:**
   ```
   Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
   at Battle (Battle.tsx)
   ```

4. **Mensajes de batalla desaparecidos** - El panel de narración no mostraba qué pasaba en cada acción

### 🧩 Causas Raíz

#### 1. Backend: `handleBattleAction()` sin try-catch (L240-360)

**Problema:** Cuando `executeTurn()` fallaba (por error en `serializePokemon()`, validación de datos, etc.), la excepción se propagaba sin ser capturada, causando que Hono respondiera con un 500 genérico.

```typescript
// ANTES - Sin protección
export async function handleBattleAction(
  sessionId: string,
  roomCode: string,
  actionData: { type: 'attack' | 'change'; moveId?: number; pokemonId?: number }
): Promise<void> {
  // ... código ...
  
  if (battle.pendingActions.player1 && battle.pendingActions.player2) {
    await executeTurn(roomCode, battle);  // ← Si falla aquí, crash total
  }
}
```

**Consecuencia:** El cliente recibía un error 500 sin detalles, desconectaba el WebSocket y pasaba a reconectar infinitamente.

#### 2. Backend: `executeTurn()` sin validación en `serializePokemon()`

**Problema:** La función `serializePokemon()` asumía que `pokemon.moves` siempre existía:

```typescript
// ANTES - Sin validación
function serializePokemon(pokemon: PokemonInBattle, includeMoves: boolean = true) {
  const moves = pokemon.moves || [];
  return {
    // ...
    ...(includeMoves && moves.length > 0 && { 
      moves: moves.map(m => ({  // ← Crashea si moves es null/undefined
        moveId: m.moveId,
        name: m.name,
        // ...
      }))
    })
  };
}
```

Si `pokemon.moves` era `null` o estaba mal formado, el `.map()` fallaba silenciosamente y la serialización incompleta causaba problemas en el cliente.

#### 3. Frontend: Mega `useEffect` con queue de mensajes (L730-1100)

**Problema:** El componente `Battle.tsx` tenía una cola de mensajes (`messageQueue`) que se actualizaba dentro del mismo `useEffect` que procesaba los mensajes:

```typescript
// ANTES - Loop infinito
const [messageQueue, setMessageQueue] = useState<string[]>([]);
const [isProcessing, setIsProcessing] = useState(false);

useEffect(() => {
  if (messageQueue.length === 0 || isProcessing) return;
  
  setIsProcessing(true);
  const currentMessage = messageQueue[0];
  setLastBattleMessage(currentMessage);

  const timer = setTimeout(() => {
    setMessageQueue(prev => prev.slice(1));  // ← Dispara el efecto de nuevo
    setIsProcessing(false);
  }, 1500);

  return () => clearTimeout(timer);
}, [messageQueue, isProcessing]);  // ← messageQueue en dependencias
```

**Problema de flujo:**
1. `messageQueue` cambia → dispara `useEffect`
2. `useEffect` muestra mensaje y luego hace `setMessageQueue()` (slice)
3. `messageQueue` cambia → dispara `useEffect` de nuevo
4. Si hay muchos mensajes o la cola crece rápido, React detecta "Maximum update depth" porque el componente se re-renderiza infinitamente

#### 4. Frontend: Dependencias incorrectas en el mega useEffect

**Problema:** El `useEffect` que procesaba mensajes WebSocket tenía dependencias:
```typescript
}, [lastMessage, battleState, playerNumber]);  // ← Demasiadas dependencias
```

Cada vez que `battleState` o `playerNumber` cambiaban, el efecto se re-ejecutaba, y si había múltiples llamadas a `addMessagesToQueue()` o `setMessageQueue()` dentro, podía desencadenar loops.

### ✅ Solución Implementada

#### 1. Agregar try-catch a `handleBattleAction()` (Backend)

```typescript
// DESPUÉS
export async function handleBattleAction(
  sessionId: string,
  roomCode: string,
  actionData: { type: 'attack' | 'change'; moveId?: number; pokemonId?: number }
): Promise<void> {
  try {
    // ... código ...
    if (battle.pendingActions.player1 && battle.pendingActions.player2) {
      await executeTurn(roomCode, battle);
    }
  } catch (error) {
    console.error('[BATTLE] Error in handleBattleAction:', error);
    console.error('[BATTLE] Stack:', (error as Error).stack);
    sendTo(sessionId, { 
      type: 'battle:error', 
      data: { 
        message: 'Error al procesar la acción',
        error: (error as Error).message
      }
    });
  }
}
```

**Beneficio:** Los errores se capturan, se loguean en detalle y se envían al cliente como `battle:error`, no como 500.

#### 2. Agregar try-catch a `executeTurn()` (Backend)

```typescript
// DESPUÉS
async function executeTurn(roomCode: string, battle: BattleState): Promise<void> {
  try {
    console.log(`[BATTLE] Ejecutando turno ${battle.turn} en sala ${roomCode}`);
    // ... lógica del turno ...
  } catch (error) {
    console.error('[BATTLE] Error in executeTurn:', error);
    broadcast(roomCode, {
      type: 'battle:error',
      data: {
        message: 'Error al ejecutar el turno',
        error: (error as Error).message
      }
    });
  }
}
```

#### 3. Validar `serializePokemon()` (Backend)

```typescript
// DESPUÉS - Con validaciones
function serializePokemon(pokemon: PokemonInBattle, includeMoves: boolean = true) {
  try {
    if (!pokemon) {
      console.error('[BATTLE] serializePokemon: pokemon es null/undefined');
      return null;
    }
    
    const moves = pokemon.moves || [];
    const sprites = pokemon.sprites || { front_default: null, back_default: null };
    
    const serialized = {
      id: pokemon.id,
      pokeapiId: pokemon.pokeapiId,
      name: pokemon.name || 'Unknown',
      types: pokemon.types || [],
      hp: pokemon.hp || 0,
      maxHp: pokemon.maxHp || 100,
      sprites: sprites,
      isFainted: pokemon.isFainted || false,
      ...(includeMoves && moves.length > 0 && { 
        moves: moves.map(m => ({
          moveId: m.moveId || 0,
          name: m.name || 'Unknown Move',
          // ... resto de campos con valores por defecto
        }))
      })
    };
    
    return serialized;
  } catch (error) {
    console.error('[BATTLE] Error serializing pokemon:', error);
    // Retornar objeto "safe" vacío
    return {
      id: 0,
      pokeapiId: 0,
      name: 'Error',
      types: [],
      hp: 0,
      maxHp: 0,
      sprites: { front_default: null, back_default: null },
      isFainted: true
    };
  }
}
```

#### 4. Eliminar cola de mensajes del Frontend

**Antes:**
```typescript
const [messageQueue, setMessageQueue] = useState<string[]>([]);
const addMessagesToQueue = useCallback((messages: string[]) => {
  setMessageQueue(prev => [...prev, ...messages]);
}, []);

// useEffect complicado para procesar la cola
useEffect(() => {
  if (messageQueue.length === 0 || isProcessing) return;
  // ... procesar y actualizar cola ...
}, [messageQueue, isProcessing]);
```

**Después:**
```typescript
// Eliminar messageQueue completamente
// Usar setLastBattleMessage() directamente en los casos
```

#### 5. Simplificar dependencias del mega useEffect

**Antes:**
```typescript
}, [lastMessage, battleState, playerNumber]);
```

**Después:**
```typescript
}, [lastMessage]);  // Solo reacciona a nuevos mensajes WebSocket
```

#### 6. Usar `setLastBattleMessage()` directamente

**Antes:**
```typescript
case 'battle:action-result':
  const messages: string[] = [];
  if (message.data.action.type === 'attack') {
    messages.push(result.message);
  }
  addMessagesToQueue(messages);  // Entra a la cola
  break;
```

**Después:**
```typescript
case 'battle:action-result':
  if (message.data.action.type === 'attack') {
    const result = message.data.result;
    setLastBattleMessage(result.message);  // Directo, sin cola
  }
  break;
```

### 📁 Archivos Modificados

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `backend/src/websocket/battleHandler.ts` | Agregado try-catch a `handleBattleAction()` | L202-360 |
| `backend/src/websocket/battleHandler.ts` | Agregado try-catch a `executeTurn()` | L274-530 |
| `backend/src/websocket/battleHandler.ts` | Refactorizado `serializePokemon()` con validaciones | L413-460 |
| `frontend/src/components/battle/Battle.tsx` | Eliminada cola de mensajes (`messageQueue`, `messageProcessing`) | L800-850 |
| `frontend/src/components/battle/Battle.tsx` | Mensajes directos con `setLastBattleMessage()` | L900-980 |
| `frontend/src/components/battle/Battle.tsx` | Simplificadas dependencias del useEffect | L1100 |

### 🧪 Cómo Verificar la Solución

1. **Terminal 1 - Backend:**
   ```bash
   cd backend
   bun run dev
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   cd frontend
   bun run dev
   ```

3. **Test:**
   - Abre dos navegadores en `http://localhost:5173`
   - Crea una sala de batalla
   - Ambos jugadores seleccionan acciones
   - Verifica:
     - ✅ Sin errores 500 en la consola del backend
     - ✅ WebSocket se mantiene conectado
     - ✅ Sin "Maximum update depth" en React DevTools
     - ✅ Los mensajes de batalla aparecen en la UI (qué atacó, cuánto daño, etc.)
     - ✅ Los turnos avanzan correctamente

### 📝 Lecciones Aprendidas

1. **Siempre usar try-catch en funciones async que interactúan con datos extenos** - Bases de datos, cálculos complejos, serialización
2. **Loguear los errores completamente** - Stack trace, contexto (sessionId, roomCode, turno), datos que causaron el error
3. **Validar todos los campos antes de serializar** - No asumir que los datos están bien formados
4. **Evitar colas de estado en el frontend** - Pueden causar loops de re-render. Usar setState directo es más simple y predecible
5. **Mantener useEffect simples con pocas dependencias** - Más fácil de razonar y menos propenso a loops infinitos

### 🔮 Recomendaciones Futuras

1. **Agregar circuit breaker en WebSocket** - Si hay muchos errores consecutivos, cerrar la conexión cleanly en lugar de crashear
2. **Implementar retry exponencial en el cliente** - No reconectar infinitamente, reintenta con delay creciente
3. **Agregar timeout en acciones de batalla** - Si ejecuteTurn() tarda más de X segundos, enviar error timeout
4. **Monitoreo de salud del servidor** - Endpoints que verifiquen que todas las batallas activas están en estado válido
5. **Tests unitarios para cálculo de daño** - Asegurar que los valores siempre sean válidos antes de llegar a la serialización

---

## Errores Anteriores

*(Esta sección se irá ampliando con nuevos errores encontrados)*

### Error: Actualización de Sprites Gen V

Documentado en: Ver implementación del script `backend/scripts/updatePokemonSprites.ts`

### Error: Selección de Movimientos en Draft

Documentado en: Ver cambios en `frontend/src/components/Draft.tsx` - funcionalidad de `selectedMoves`

---

**Última actualización:** 15 de Mayo de 2026