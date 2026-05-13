# 🎮 Pokémon Patacon - Esqueleto Inicial

**Versión**: 1.0.0 | **Estado**: En Desarrollo ⚙️

## 📋 Descripción

Pokémon Patacon es un juego de batallas 1v1 multijugador en tiempo real basado en la Generación I-V de Pokémon. Los jugadores crean o se unen a salas privadas, seleccionan equipos de 6 Pokémon y luchan en turnos con mecánicas estratégicas de tipo y efectos.

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: [Bun](https://bun.sh/) - Runtime JavaScript ultrarrápido optimizado para edge computing
- **Framework**: [Hono](https://hono.dev/) - Framework HTTP/WebSocket ligero y moderno
- **Base de Datos**: [MongoDB](https://www.mongodb.com/) - Base de datos NoSQL para almacenamiento persistente
- **Lenguaje**: TypeScript 5 (configuración estricta)

### Frontend
- **Framework**: [React](https://react.dev/) 18 + [React Router](https://reactrouter.com/)
- **Build Tool**: [Vite](https://vitejs.dev/) - Servidor de desarrollo ultrarrápido
- **Lenguaje**: TypeScript 5
- **Estilos**: CSS3 con animaciones modernas

### Datos
- **API Principal**: [PokeAPI v2](https://pokeapi.co/api/v2/) - Datos oficiales de Pokémon
- **Pool de Pokémon**: Exactamente 493 (Generaciones I-V)
- **Cache Local**: MongoDB para reducir llamadas a PokeAPI

## 📁 Estructura del Proyecto

```
pokemon-patacon/
├── backend/                          # Servidor Bun + Hono
│   ├── src/
│   │   ├── index.ts                 # Punto de entrada del servidor
│   │   ├── routes/                  # Controladores API (pokemon, rooms, etc)
│   │   ├── services/                # Lógica de negocio (batalla, PokeAPI)
│   │   ├── types/                   # Tipos TypeScript
│   │   └── middleware/              # Middleware (CORS, logging, etc)
│   ├── package.json                 # Dependencias Bun
│   ├── tsconfig.json               # Configuración TypeScript
│   ├── .env.example                # Variables de entorno (plantilla)
│   └── bun.lockb                   # Lock file Bun (generado)
│
├── frontend/                         # SPA React + Vite
│   ├── src/
│   │   ├── main.tsx                # Punto de entrada
│   │   ├── App.tsx                 # Componente raíz
│   │   ├── components/
│   │   │   └── MainMenu.tsx        # Menú inicial con logo
│   │   ├── routes/                 # Páginas principales
│   │   ├── styles/
│   │   │   ├── main.css            # Estilos globales
│   │   │   ├── MainMenu.css        # Estilos del menú
│   │   │   └── App.css             # Estilos de la app
│   │   └── assets/
│   ├── public/
│   │   └── assets/                 # Recursos estáticos (title.png)
│   ├── index.html                  # Punto de entrada HTML
│   ├── package.json                # Dependencias Node
│   ├── vite.config.ts             # Configuración Vite
│   ├── tsconfig.json              # Configuración TypeScript
│   └── node_modules/              # Dependencias (generado)
│
├── docs/                            # Documentación técnica
│   ├── PRD.md                      # Especificación de requisitos
│   ├── SCHEMAS_MONGODB.md          # Esquemas de base de datos
│   ├── API_ENDPOINTS.md            # Documentación de endpoints REST
│   ├── WEBSOCKET_PROTOCOL.md       # Protocolo WebSocket para batallas
│   ├── LEGENDARIOS.md              # Lista validada de Pokémon legendarios (48)
│   ├── CLARIFICACIONES.md          # Resolución de 20+ ambigüedades del PRD
│   ├── gen5-pokemon-expanded.json  # Datos maestros de 649 Pokémon
│   └── gen5-pokemon-expanded-table.md # Tabla de referencia
│
├── data/
│   └── README.md                   # Documentación de datos
│
├── AGENT.md                        # Configuración del agente de IA
├── .gitignore                      # Archivos ignorados por Git
├── README.md                       # Este archivo

```

## 🚀 Inicio Rápido

### Prerequisitos
- **Bun** ≥ 1.0 instalado ([descargar](https://bun.sh))
- **Node.js** ≥ 18 (para frontend)
- **MongoDB** ≥ 5.0 corriendo localmente o accesible

### 1️⃣ Instalar Dependencias

#### Backend (Bun)
```bash
cd backend
bun install
```

#### Frontend (Node)
```bash
cd frontend
npm install
# o con bun:
bun install
```

### 2️⃣ Configurar Variables de Entorno

#### Backend
```bash
cd backend
cp .env.example .env
# Editar .env con tus valores:
# - MONGODB_URI=mongodb://localhost:27017/pokemon-patacon
# - PORT=3000
# - NODE_ENV=development
```

#### Frontend (opcional, ya tiene valores por defecto)
```bash
cd frontend
# No requiere .env para desarrollo local
# Proxy a http://localhost:3000 configurado en vite.config.ts
```

### 3️⃣ Iniciar Servidores

#### Terminal 1 - Backend (Puerto 3000)
```bash
cd backend
bun run dev
# Salida esperada:
# 🚀 Pokémon Patacon Backend
# 📍 Server running on http://localhost:3000
# 📚 API Docs: http://localhost:3000
```

#### Terminal 2 - Frontend (Puerto 5173)
```bash
cd frontend
npm run dev
# Salida esperada:
#   VITE v5.0.0  ready in 500 ms
#   ➜  Local:   http://localhost:5173/
#   ➜  press h to show help
```

### 4️⃣ Acceder a la Aplicación

Abre tu navegador en: **http://localhost:5173**

Deberías ver:
- 🎨 Menú principal con logo de Pokémon
- 📝 Campos para tu nombre de jugador
- ➕ Botón "Crear Sala"
- 🔗 Botón "Unirse a Sala"

## 📚 Documentación Técnica

Todos los detalles técnicos están documentados en la carpeta `docs/`:

### Especificaciones Principales
- **[PRD.md](docs/PRD.md)** - Requisitos funcionales y restricciones
- **[SCHEMAS_MONGODB.md](docs/SCHEMAS_MONGODB.md)** - Estructura de 5 colecciones MongoDB
- **[API_ENDPOINTS.md](docs/API_ENDPOINTS.md)** - 8 endpoints REST documentados
- **[WEBSOCKET_PROTOCOL.md](docs/WEBSOCKET_PROTOCOL.md)** - Protocolo bidireccional de batallas en tiempo real
- **[LEGENDARIOS.md](docs/LEGENDARIOS.md)** - 48 Pokémon legendarios/míticos validados
- **[CLARIFICACIONES.md](docs/CLARIFICACIONES.md)** - 20+ reglas ambiguas clarificadas con ejemplos

## 🎯 Qué se Creó en Esta Sesión

### ✅ Backend
- Estructura de carpetas siguiendo convenciones Node.js para Bun
- **package.json** con dependencias: Hono, MongoDB, Axios
- **tsconfig.json** optimizado para ES2022 + módulos
- **src/index.ts** servidor inicial con:
  - Middleware de CORS configurado
  - Logging automático
  - Health check endpoint (`/api/health`)
  - Placeholder endpoints para escalar

### ✅ Frontend
- Estructura SPA con React + Vite
- **package.json** con react-router, axios
- **vite.config.ts** con proxy a backend
- **MainMenu.tsx** componente inicial con:
  - 🖼️ Logo de Pokémon desde `/public/assets/title.png`
  - 📝 Formulario para crear sala
  - 🔗 Formulario para unirse a sala
  - 🎨 Animaciones suaves (gradiente, float, slide-in)
  - ✅ Validación de entrada
  - 🔌 Conexión a endpoints backend

### ✅ Estilos
- **main.css** - Estilos globales (gradientes, botones)
- **MainMenu.css** - Estilos del menú con animaciones
- **App.css** - Estilos base de la aplicación
- Responsive design (móvil + desktop)
- Animaciones suaves y transiciones

### ✅ Configuración
- **.env.example** con 15 variables de entorno
- **Proxy Vite** configurado para desarrollo
- **TypeScript estricto** en ambos lados
- **Paths alias** para imports limpios (@/, @components/, etc)

## 🔧 Comandos Disponibles

### Backend
```bash
bun run dev        # Servidor con hot-reload
bun run start      # Producción
bun run build      # Compilar a JavaScript
bun run lint       # Validación de código
bun run format     # Formatear código
```

### Frontend
```bash
npm run dev        # Dev server con hot-reload
npm run build      # Compilar para producción (dist/)
npm run preview    # Previsualizar build de producción
npm run lint       # Validación de código
npm run format     # Formatear código
```

## 📡 API Endpoints Disponibles (Fase 1)

| Método | Endpoint | Estado |
|--------|----------|--------|
| GET | `/api/health` | ✅ Implementado |
| GET | `/` | ✅ Información del servidor |
| GET | `/api/pokemon/search?q=pikachu` | 🔄 Placeholder |
| POST | `/api/rooms` | 🔄 Placeholder (retorna código mock) |
| GET | `/api/rooms/:code` | 🔄 Por implementar |
| WS | `/battle/:room_code` | 🔄 Por implementar |

## 🌐 WebSocket (Por Implementar)

El protocolo WebSocket está completamente especificado en [WEBSOCKET_PROTOCOL.md](docs/WEBSOCKET_PROTOCOL.md):

```
Cliente → Servidor:
- connection:init         # Iniciar batalla
- pokemon:select         # Seleccionar un Pokémon
- team:confirmed         # Equipo listo (6 Pokémon)
- turn:action           # Atacar, cambiar, usar objeto
- ping                  # Keep-alive

Servidor → Cliente:
- room:joined           # Jugador unido
- battle:start          # Batalla iniciada
- turn:waiting          # Tu turno
- turn:execute          # Resultado del turno
- pokemon:fainted       # Pokémon noqueado
- pokemon:switched      # Cambio de Pokémon
- battle:end            # Fin de la batalla
- error                 # Error del servidor
```

## 🗄️ Base de Datos

MongoDB (por configurar):

```javascript
// 5 colecciones:
1. pokemon          // 493 Pokémon cache (preload desde PokeAPI)
2. rooms            // Salas activas (TTL 30 min)
3. battles          // Histórico de batallas
4. type_matchups    // Tabla de efectividad 18×18
5. sessions         // Sesiones anónimas (TTL 24h)
```

Ver [SCHEMAS_MONGODB.md](docs/SCHEMAS_MONGODB.md) para detalles completos.

## 🐛 Debugging

### Backend no inicia
```bash
# Verificar Bun
bun --version

# Verificar puerto 3000 disponible
netstat -an | grep 3000

# Logs detallados
NODE_ENV=development bun run dev
```

### Frontend no carga
```bash
# Verificar puerto 5173
netstat -an | grep 5173

# Limpiar cache Vite
rm -rf .vite frontend/dist

# Reiniciar
npm run dev
```

### Backend → Frontend sin conexión
Verificar `vite.config.ts`:
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:3000',  // ← Backend URL
    changeOrigin: true
  }
}
```

## 🎨 Menú Principal

El componente **MainMenu.tsx** es el punto de entrada visual:

1. **Pantalla de Bienvenida**: Logo + 2 botones (Crear/Unirse)
2. **Crear Sala**: 
   - Campo: Tu nombre
   - Acción: POST `/api/rooms` → obtiene código
3. **Unirse a Sala**:
   - Campos: Tu nombre + Código (6 caracteres)
   - Acción: POST `/api/rooms/:code` → se une

El logo busca la imagen en `/public/assets/title.png` con fallback gracioso si no existe.

## 📊 Progreso del Proyecto

### ✅ Completado
- [x] Estructura de carpetas (backend + frontend)
- [x] Configuración TypeScript (ambos)
- [x] Package.json (ambos)
- [x] Servidor Hono inicial
- [x] Frontend React + Vite
- [x] MainMenu con logo
- [x] Estilos + animaciones
- [x] Proxy API configurado

### 🔄 Próximos Pasos
1. **Conectar MongoDB** - Inicializar colecciones
2. **Implementar Endpoints REST** - pokemon search, rooms, types
3. **WebSocket Handler** - Protocolo de batallas
4. **Battle Engine** - Cálculo de daño, efectos, turnos
5. **Validación de Equipos** - Máximo 1 legendario, 4+ movimientos
6. **Pruebas** - Tests unitarios + integración

## 📚 Referencias

- **PokeAPI**: https://pokeapi.co/api/v2/
- **Bun Docs**: https://bun.sh/docs
- **Hono Docs**: https://hono.dev/
- **MongoDB Docs**: https://docs.mongodb.com/
- **React Docs**: https://react.dev/
- **Vite Docs**: https://vitejs.dev/

## 🤝 Contribuir

Sigue la estructura de carpetas. Para añadir nuevas rutas:
1. Crear archivo en `backend/src/routes/`
2. Actualizar `backend/src/index.ts`
3. Documentar en `docs/API_ENDPOINTS.md`

## 📝 Notas de Desarrollo

- **TypeScript Strict**: No usar `any`, siempre tipar
- **Commits**: Uno por feature/bugfix con mensaje descriptivo
- **Branches**: `feature/xxx` para nuevas funciones
- **Testing**: Mínimo 80% de cobertura en funciones críticas

## 🎯 Objetivo Final

Un cliente web progresivo accesible desde cualquier navegador donde 2 jugadores pueden:
1. Crear una sala con código (4-6 caracteres)
2. Compartir código y que otros se unan
3. Seleccionar 6 Pokémon de 493 posibles (Gen I-V)
4. Máximo 1 Pokémon legendario por equipo
5. Batallar en turnos en tiempo real via WebSocket
6. Ver cambios de estado, daño, efectos instantáneamente

---

**Creado**: 13 de Mayo de 2026  
**Versión Inicial**: Esqueleto funcional con menú principal  
**Stack**: Bun + Hono + React + Vite + MongoDB  
**Autor**: Ramses Szobotka
