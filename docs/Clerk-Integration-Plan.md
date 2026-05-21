# Plan de Integración de Clerk

> **Propósito**: Agregar autenticación mediante Clerk al sistema actual,
> manteniendo compatibilidad total con el flujo anónimo existente.
> `session_id` sigue siendo el identificador principal para el gameplay.

---

## 1. Principios de Diseño

| Principio | Descripción |
|-----------|-------------|
| No romper el flujo actual | Usuarios no autenticados funcionan exactamente igual que ahora |
| Separación de responsabilidades | Clerk = identidad; `session_id` = estado de juego |
| Persistencia opcional | Solo usuarios autenticados guardan/reutilizan `session_id` |
| Mínimo cambio en gameplay | La lógica de salas, draft y batalla NO cambia |

---

## 2. Estructura de la Colección `users` en MongoDB

```json
{
  "_id": ObjectId,
  "clerk_user_id": "user_2abc123...",
  "email": "user@example.com",
  "player_name": "Ash",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": ISODate,
  "last_login_at": ISODate,
  "games_played": 10,
  "wins": 6
}
```

**Índices necesarios**:
- `{ clerk_user_id: 1 }` — único, búsqueda principal
- `{ session_id: 1 }` — opcional, para cruce con rooms

---

## 3. Cambios por Capa

### 3.1 Backend — Archivo: `backend/.env`

**Cambio**: Las variables de Clerk YA existen pero no se usan. Solo se necesita
verificar que están correctas.

```
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWT_ISSUER=https://<tu-instancia>.clerk.accounts.dev
```

### 3.2 Backend — Archivo nuevo: `backend/src/db/users.ts`

**Añadir**: Funciones CRUD para la colección `users`:

| Función | Propósito |
|---------|-----------|
| `getUserByClerkId(clerkUserId)` | Buscar usuario en MongoDB por `clerk_user_id` |
| `createUser(clerkUserId, email, playerName)` | Crear documento al primer login |
| `updateUserSession(clerkUserId, sessionId)` | Asociar/actualizar `session_id` |
| `getSessionIdByClerkId(clerkUserId)` | Obtener `session_id` persistente |
| `getClerkIdBySessionId(sessionId)` | (Opcional) cruce inverso |

### 3.3 Backend — Archivo nuevo: `backend/src/middleware/auth.ts`

**Añadir**: Middleware de autenticación Clerk para rutas REST.

```
- Extraer token JWT del header Authorization: Bearer <token>
- Verificar el token usando CLERK_JWT_ISSUER y la clave pública de Clerk
- Si es válido: adjuntar `userId` (de Clerk) al request
- Si no hay token: el request sigue como anónimo (sin `userId`)
```

**NO bloquear rutas anónimas.** El middleware solo *anota* el request si hay
token, nunca lo rechaza por falta de autenticación.

### 3.4 Backend — Archivo nuevo: `backend/src/routes/auth.ts`

**Añadir**: Endpoints REST para el flujo de autenticación:

```
POST /api/auth/session
  Propósito: Asociar session_id al usuario autenticado
  Auth: Requiere token Clerk (Bearer)
  Body: { "session_id": "550e8400-..." }
  Comportamiento:
    1. Buscar usuario por clerk_user_id
    2. Si no existe: crear usuario (usar datos opcionales del body:
       player_name)
    3. Actualizar session_id en el usuario
    4. Si la session_id ya existe en otro usuario, reemplazar (último
       login gana)
    5. Responder con session_id (la misma o recuperada)

GET /api/auth/session
  Propósito: Obtener session_id persistente del usuario autenticado
  Auth: Requiere token Clerk (Bearer)
  Respuesta: { "session_id": "550e8400-..." } o { "session_id": null }

POST /api/auth/webhook
  Propósito: Recibir webhooks de Clerk (user.created, user.updated)
  No requiere autenticación de app (usa CLERK_WEBHOOK_SECRET para
  verificar firma)
```

### 3.5 Backend — Archivo: `backend/src/index.ts`

**Cambios**:

1. Importar y montar las rutas de auth:
   ```typescript
   import authRoutes from './routes/auth';
   app.route('/api/auth', authRoutes);
   ```

2. (Opcional) Añadir middleware de auth global para anotar requests:
   ```typescript
   import { clerkAuth } from './middleware/auth';
   app.use('/api/*', clerkAuth);
   ```

### 3.6 Frontend — `frontend/package.json`

**Añadir dependencia**:

```json
"@clerk/clerk-react": "^5.0.0"
```

### 3.7 Frontend — `frontend/.env`

YA existe `VITE_CLERK_PUBLISHABLE_KEY`. Solo verificar.

### 3.8 Frontend — `frontend/src/main.tsx`

**Cambio**: Envolver la app con `<ClerkProvider>`:

```typescript
import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <RouterProvider router={router} />
    </ClerkProvider>
  </React.StrictMode>,
);
```

### 3.9 Frontend — Archivo nuevo: `frontend/src/hooks/useAuthSession.ts`

**Añadir**: Hook personalizado que conecta Clerk con el sistema de session_id:

```typescript
// Comportamiento:
// 1. Si el usuario no está autenticado (useAuth() de Clerk = null):
//    - Usar session_id aleatorio como ahora (desde localStorage)
//    - NO hacer llamadas a /api/auth/session
// 2. Si el usuario se autentica:
//    - Obtener userId de Clerk
//    - Llamar a GET /api/auth/session para obtener session_id persistente
//    - Si existe: cargarla en el WebSocketManager (reemplazar localStorage)
//    - Si no existe: generar nueva, llamar a POST /api/auth/session
// 3. El WebSocketManager usa el session_id que este hook establece
```

### 3.10 Frontend — `frontend/src/websocket.ts`

**Cambio en el constructor de `WebSocketManager`**:

```typescript
// Actual: genera session_id aleatorio siempre
// Nuevo: aceptar session_id inyectado externamente

// Añadir método setter:
public setSessionId(sessionId: string): void {
  this.sessionId = sessionId;
  localStorage.setItem('patacon_session_id', sessionId);
}

// El constructor actual sigue siendo válido como fallback:
// Si no se inyecta session_id externamente, genera uno aleatorio.
```

### 3.11 Frontend — Archivo: `frontend/src/app/splash.tsx`

**Añadir**: Botón de "Iniciar Sesión" y "Cuenta" usando Clerk:

```typescript
import { useAuth, useUser } from '@clerk/clerk-react';
import { SignInButton, UserButton } from '@clerk/clerk-react';

// En el splash:
// - Si NO autenticado: mostrar botón "CUENTA" con SignInButton
// - Si autenticado: mostrar UserButton (avatar, menú de cuenta)
// - El botón "COMENZAR" y "POKÉDEX" NO cambian
```

**Cambio en la navegación inicial**: Cuando un usuario autenticado vuelve al
splash, se debe restaurar su `session_id` ANTES de que pueda navegar al menú.

### 3.12 Frontend — Archivo: `frontend/src/app/__root.tsx`

**Añadir**: Hook de efecto global que sincroniza la sesión al montar la app:

```typescript
// 1. Obtener estado de Clerk (useAuth, useUser)
// 2. Si autenticado:
//    - Llamar GET /api/auth/session con token Bearer
//    - Si hay session_id persistente:
//      - socket.setSessionId(session_id)
//    - Si no:
//      - Llamar POST /api/auth/session con session_id actual
// 3. Si NO autenticado:
//    - No hacer nada (flujo actual)
```

---

## 4. Flujo Detallado

### 4.1 Usuario No Autenticado (sin cambios)

```
Splash → "COMENZAR" → Menú
  ↑                        |
  |   WebSocketManager     |
  |   genera session_id    |
  |   aleatorio, guarda    |
  |   en localStorage      |
  |                        |
  +-- Crea/une sala usando session_id
  +-- Draft, batalla... todo igual
  +-- Sin llamadas a Clerk ni /api/auth/
```

### 4.2 Usuario Autenticado — Primer Login

```
1. Splash → "CUENTA" → Login Clerk (Google, GitHub, email, etc.)
2. Clerk redirige al splash con sesión iniciada
3. __root.tsx detecta useAuth().isSignedIn = true
4. Llama GET /api/auth/session (Bearer token)
   → Respuesta: { "session_id": null }
5. Toma el session_id actual (aleatorio, de localStorage)
6. Llama POST /api/auth/session
   → Body: { "session_id": "550e8400-..." }
   → Backend crea usuario en MongoDB con ese session_id
7. El session_id NO cambia (es el mismo que ya estaba usando)
8. El usuario juega normalmente
```

### 4.3 Usuario Autenticado — Sesión Recurrente

```
1. Splash → Clerk detecta sesión activa (cookie/token)
2. __root.tsx llama GET /api/auth/session (Bearer token)
   → Respuesta: { "session_id": "550e8400-..." }
3. WebSocketManager.setSessionId("550e8400-...")
   → Sobrescribe localStorage con session_id persistente
4. El usuario entra al menú con su session_id de siempre
5. Si había una sala activa (por reconexión), funciona porque
   el session_id es el mismo
```

### 4.4 Usuario Autenticado — Múltiples Dispositivos

```
Contexto: Mismo usuario en PC y celular

1. En PC: login → GET /api/auth/session → obtiene session_id_A
2. En celular: login → GET /api/auth/session → obtiene session_id_A
   (el mismo)
3. POST /api/auth/session en celular actualiza a session_id_B
4. Ahora PC y celular tienen session_id DISTINTOS
5. Esto es correcto — cada dispositivo es una sesión de juego separada
   NOTA: Si se desea unificar, será una feature futura.
   El session_id identifica la sesión runtime, no al usuario.
```

---

## 5. Puntos de Atención

| # | Tema | Detalle |
|---|------|---------|
| 1 | **WebSockets y autenticación** | No se necesita autenticar WebSocket. Clerk es solo REST. El WebSocket sigue usando `session_id` en query param como ahora. |
| 2 | **Clerk JWT verificador** | Usar `@clerk/backend` SDK en el backend para verificar tokens. NO implementar verificación manual de JWKS. |
| 3 | **Clerk Webhooks** | Configurar en Dashboard de Clerk los webhooks `user.created` y `user.updated` apuntando a `POST /api/auth/webhook`. No es crítico para MVP — el usuario se crea bajo demanda en `POST /api/auth/session`. |
| 4 | **CORS** | Clerk puede necesitar configuración CORS adicional para la redirección post-login. Verificar que `CORS_ORIGIN` incluye el origen correcto. |
| 5 | **Rutas protegidas** | En MVP, ninguna ruta requiere autenticación. Solo el splash muestra el botón de login. El gameplay completo es anónimo. |
| 6 | **Middleware: no bloquear** | El middleware de auth NUNCA debe devolver 401. Solo anotar el request con `c.set('clerkUserId', userId)` si hay token. |

---

## 6. Resumen de Archivos a Modificar/Crear

### Archivos NUEVOS

| Archivo | Propósito |
|---------|-----------|
| `backend/src/db/users.ts` | Operaciones CRUD colección `users` |
| `backend/src/middleware/auth.ts` | Middleware de verificación de token Clerk |
| `backend/src/routes/auth.ts` | Endpoints REST para sesión autenticada |
| `frontend/src/hooks/useAuthSession.ts` | Hook que conecta Clerk con session_id |

### Archivos a MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `backend/src/index.ts` | Montar rutas `/api/auth/*` |
| `frontend/src/main.tsx` | Envolver con `<ClerkProvider>` |
| `frontend/src/websocket.ts` | Añadir `setSessionId()` público |
| `frontend/src/app/__root.tsx` | Sincronizar session_id al montar |
| `frontend/src/app/splash.tsx` | Añadir botones SignIn/UserButton |

### Archivos SIN CAMBIOS (funcionan igual)

- `backend/src/websocket/handler.ts`
- `backend/src/websocket/roomManager.ts`
- `backend/src/db/rooms.ts`
- `backend/src/services/roomService.ts`
- `backend/src/routes/rooms.ts`
- `backend/src/services/battleService.ts`
- `backend/src/websocket/battleHandler.ts`
- `frontend/src/app/menu.tsx`
- `frontend/src/components/MainMenu.tsx`
- `frontend/src/components/Draft.tsx`
- `frontend/src/app/draft.$roomCode.tsx`
- `frontend/src/app/battle.$roomCode.tsx`

---

## 7. Orden de Implementación Sugerido

```
Fase 1: Backend — Colección users y endpoints auth
  1. Crear backend/src/db/users.ts
  2. Agregar middleware de auth en backend/src/middleware/auth.ts
  3. Crear backend/src/routes/auth.ts
  4. Montar rutas en backend/src/index.ts
  ⬇ Verificar: POST/GET /api/auth/session con curl/Postman

Fase 2: Frontend — ClerkProvider y hook
  5. Instalar @clerk/clerk-react
  6. Envolver app con ClerkProvider en main.tsx
  7. Crear frontend/src/hooks/useAuthSession.ts
  8. Modificar websocket.ts (setSessionId)
  9. Modificar __root.tsx (sincronización al montar)
  ⬇ Verificar: login en splash restaura session_id

Fase 3: UI — Botones de autenticación
  10. Modificar splash.tsx (SignInButton / UserButton)
  ⬇ Verificar: flujo completo login→sesión persistente→gameplay

Fase 4: Opcional — Webhooks Clerk
  11. Configurar webhooks en Dashboard de Clerk
  12. Validar firma en POST /api/auth/webhook
```
