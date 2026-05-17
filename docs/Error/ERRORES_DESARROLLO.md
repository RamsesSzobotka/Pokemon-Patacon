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

## Errores Anteriores

*(Esta sección se irá ampliando con nuevos errores encontrados)*

### Error: Actualización de Sprites Gen V

Documentado en: Ver implementación del script `backend/scripts/updatePokemonSprites.ts`

### Error: Selección de Movimientos en Draft

Documentado en: Ver cambios en `frontend/src/components/Draft.tsx` - funcionalidad de `selectedMoves`

---

**Última actualización:** 15 de Mayo de 2026