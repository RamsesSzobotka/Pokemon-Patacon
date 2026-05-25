# 🎮 Pokémon Patacon - Liga Patacon

[![Status](https://img.shields.io/badge/Status-En%20Desarrollo-yellow)](https://github.com)
[![Version](https://img.shields.io/badge/Version-4.0-blue)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**Pokémon Patacon — Liga Patacon** es un videojuego de batallas Pokémon 1v1 en tiempo real basado en la **Generación V (Black/White)** con los **649 Pokémon** de Generaciones I-V. La **Liga Patacon** es una liga de combates Pokémon donde dos entrenadores se enfrentan en un sistema de draft competitivo para armar su equipo de 6 Pokémon y luego batallan hasta que uno de los dos se queda sin Pokémon. Diseñado para experiencia competitiva fluida con un sistema de batallas basado en prioridad de movimientos, estados alterados, movimientos de carga, fatiga y cambios de estadísticas.

---

## 🚀 Inicio Rápido

### Requisitos Previos
- **Docker** y **Docker Compose**
- Git (opcional, para clonar el repo)
- Puertos disponibles: `5173` (frontend), `3000` (backend), `27017` (MongoDB)

### Instalación y Ejecución con Docker

1. **Navega a la raíz del proyecto:**
   ```bash
   cd "ruta de carpetas/Pokemon-Patacon"
   ```

2. **Construye e inicia los contenedores:**
   ```bash
   docker compose up --build
   ```

3. **Espera a que los servicios se inicialicen:**
   - MongoDB se inicia primero
   - Backend importa datos de PokeAPI (puede tomar 1-2 horas la primera vez dado a que se obtienen datos de 649 Pokémon y sus movimientos y se filtran para solo incluir los movimientos válidos)
   - Frontend se conecta automáticamente

4. **Accede a la aplicación:**
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - API Backend: [http://localhost:3000](http://localhost:3000)
   - MongoDB: `mongodb://localhost:27017`

### Detener los Contenedores
```bash
docker compose down
```

### Reconstruir sin Cache
```bash
docker compose up --build --no-cache
```

---

## 📋 Descripción del Proyecto

### Visión General
Pokémon Patacon permite que dos jugadores compitan en batallas **1v1 simultáneas** sin requerimiento de autenticación. Cada jugador compone un equipo de **6 Pokémon** mediante un sistema de draft alternado, y luego se enfrentan en batallas tácticas donde el objetivo es vencer todos los Pokémon del oponente.

### Características Principales

✅ **Multijugador en Tiempo Real**
- Salas de juego con códigos únicos
- WebSocket para sincronización instantánea
- Comunicación bidireccional jugador-a-jugador

✅ **Pokédex Completo (Gen I-V)**
- 649 Pokémon disponibles
- Sprites animados .gif de Black/White
- Datos importados automáticamente desde PokeAPI
- Movimientos validados por Pokémon

✅ **Sistema de Draft Competitivo**
- Selección alternada de equipos (6v6)
- Máximo 1 legendario por equipo
- Sin Pokémon duplicados en equipo

✅ **Batallas Tácticas por Prioridad**
- Sistema de prioridad de movimientos + CoinFlip para desempates
- Estados alterados (quemadura, envenenamiento, parálisis, sueño, congelación, confusión)
- Movimientos de 2 turnos (Solar Beam, Hyper Beam, etc.) y sistema de fatiga
- Cambios de estadísticas (buffs/debuffs)
- Más de **400 movimientos** implementados

✅ **Personalización**
- Sprites Shiny para usuarios con Shiny Pack (Pokédex, Draft, Batalla)
- Tienda integrada con Shiny Pack
- Autenticación con Clerk (Google OAuth, email)

---

## ⚙️ Tecnologías

### Backend
- **Runtime:** [Bun](https://bun.sh/) v1.0+
- **Framework Web:** [Hono](https://hono.dev/) v4.0+
- **Base de Datos:** MongoDB v7.0
- **Autenticación:** Clerk
- **APIs Externas:** PokeAPI v2, Stripe

### Frontend
- **Framework:** React 18 + TypeScript
- **Enrutador:** TanStack Router v1.80+
- **Build Tool:** Vite v6.0+
- **Autenticación:** Clerk React
- **WebSocket:** Cliente nativo (WebSocket API)
- **Styling:** CSS personalizado + Pixel Art

### DevOps
- **Contenedorización:** Docker + Docker Compose
- **Orquestación:** 3 servicios (MongoDB, Backend, Frontend)
- **Redes:** Docker internal network para comunicación inter-contenedor

---

## 🎮 Reglas Implementadas

### Sistema de Batalla

#### 3.1 Flujo General de Turno
```
1. FASE DE SELECCIÓN: Ambos jugadores eligen acción simultáneamente
   ├─ Atacar con un movimiento
   └─ Cambiar de Pokémon

2. FASE DE ORDEN: Determina quién actúa primero
   ├─ Si hay diferencia de prioridad → mayor prioridad va primero
   └─ Si hay empate de prioridad → CoinFlip (50/50)

3. FASE DE EJECUCIÓN: Se aplican acciones en orden
   ├─ Cálculo de daño basado en tipos
   ├─ Efectividad de tipos
   └─ Verificación de KO

4. FASE FINAL: Preparación para siguiente turno
   ├─ Aplicar efectos de estado (V2+)
   └─ Verificar condición de victoria
```

#### 3.2 Sistema de Prioridad

| Acción | Prioridad | Descripción |
|--------|-----------|-------------|
| Cambiar Pokémon | +6 | **Siempre actúa primero** |
| Movimiento Prioridad Alta | +1 a +5 | Según movimiento (Quick Attack, Aqua Jet, etc.) |
| Movimiento Normal | 0 | Sin prioridad especial |
| Movimiento Prioridad Baja | -1 a -7 | Siempre actúa último (Trick Room) |

**Lógica de Resolución:**
- Si `prioridad_A ≠ prioridad_B` → Quien tenga mayor prioridad actúa primero
- Si `prioridad_A = prioridad_B` → CoinFlip (50/50 probabilidad)

#### 3.3 Cálculo de Daño (V1)

```
DAÑO = (((2 × Attack + 0.2) / 100) × Power × Efectividad + 2) × 1.0
```

Donde:
- **Attack:** Ataque del Pokémon atacante
- **Power:** Potencia del movimiento
- **Efectividad:** Multiplicador basado en tipos
  - Super Efectivo (Ventaja): ×2.0
  - Normal: ×1.0
  - Poco Efectivo (Desventaja): ×0.5
  - Sin Efecto: ×0.0 (sin daño)

**Ejemplo:**
```
Pikachu (Atk: 55) usa Thunderbolt (Power: 90) contra Gyarados (Agua)
Daño = (((2×55 + 0.2) / 100) × 90 × 2.0 + 2) × 1.0 = ~200 daño
```

#### 3.4 Versiones de Batalla

| Versión | Descripción | Estado |
|---------|------------|--------|
| **V1 (Core)** | Cálculo de daño y tipo. Movimientos de todo tipo disponibles | ✅ Implementado |
| **V2 (Estados)** | Estados (quemadura, envenenamiento, parálisis, sueño, congelación, confusión) con daño por estado al final del turno | ✅ Implementado |
| **V3 (2 Turnos)** | Movimientos de carga (Solar Beam, Hyper Beam, Fly, Dig) y sistema de fatiga | ✅ Implementado |
| **V4 (Stats)** | Cambios de estadísticas (buffs/debuffs) con movimientos como Swords Dance, Dragon Dance | ✅ Implementado |

---

## 📊 Fuente de Datos

### Pokémon Liga Patacon

**Pokémon Patacon** simula una **Liga Pokémon** donde dos entrenadores compiten para demostrar quién es el mejor. El nombre "Patacon" hace referencia a un plato típico latinoamericano, dando un toque divertido y único al proyecto.

#### Datos del Juego

| Dato | Valor |
|------|-------|
| **Pokémon disponibles** | 649 (Generaciones I-V, IDs 1-649) |
| **Tipos soportados** | 18 (Normal, Fuego, Agua, Eléctrico, Planta, Hielo, Lucha, Veneno, Tierra, Volador, Psíquico, Bicho, Roca, Fantasma, Dragón, Siniestro, Acero, Hada) |
| **Movimientos totales** | +400 movimientos con efectos implementados |
| **Movimientos por Pokémon** | Pool válido de 4+ movimientos cada uno |
| **Estadísticas por Pokémon** | HP, Ataque, Defensa, Ataque Especial, Defensa Especial, Velocidad |
| **Pokémon Legendarios** | ~48 validados (Mew, Rayquaza, Dialga, etc.) — máximo 1 por equipo |
| **Sprites** | Animados .gif de Black/White |
| **Estados alterados** | Quemadura, envenenamiento, parálisis, sueño, congelación, confusión |


### PokeAPI v2
El proyecto obtiene todos los datos de Pokémon de **[PokeAPI v2](https://pokeapi.co/)** - una API pública y gratuita que proporciona datos completos de Pokémon.

Los datos se importan automáticamente al arrancar por primera vez (puede tomar 1-2 horas por los 649 Pokémon y sus movimientos) y se cachean en MongoDB(Sprites tomados de la Api no se guardan Sprites).

---

## 🔒 Limitaciones Conocidas

### Batalla

⚠️ **NO IMPLEMENTADO:**
- Estadísticas de velocidad: Se usa prioridad de movimiento + CoinFlip
- Habilidades pasivas por pokemon: No implementadas
- Ítems de bolsa: No implementado
- Tasa de crítico: Todos los ataques tienen tasa crítica 0%

### Sprites y Visuales

⚠️ **Limitaciones de Sprites:**
- 11 Pokémon no tienen sprite .gif animado en Black/White
- Fallback automático a sprite PNG estático
- Algunos sprites pueden tener diferencias visuales vs. juegos originales

### Red y Conexión

⚠️ **Limitaciones de Conectividad:**
- Sin reconexión automática en frontend (recarga manual si pierde conexión)
- Timeout de sala: 30 segundos de inactividad(si un jugador se desconecta, la sala se cierra después de 30 segundos)
- Sin persistencia de datos de batalla si el servidor cae

### Arquitectura

⚠️ **Limitaciones Técnicas:**
- Sin historial de batallas persistido
- Sin sistema de rating/ELO
- Sin matchmaking automático
- API sin rate limiting

---

## 📁 Estructura del Proyecto

```
Pokemon-Patacon/
├── backend/                    # Servidor Bun + Hono
│   ├── src/
│   │   ├── index.ts           # Punto de entrada
│   │   ├── db/                # Conexión y modelos MongoDB
│   │   ├── routes/            # Endpoints REST
│   │   ├── services/          # Lógica de negocio
│   │   ├── websocket/         # Handlers WebSocket
│   │   ├── middleware/        # Auth, CORS, etc.
│   │   └── types/             # TypeScript interfaces
│   ├── scripts/               # Utilidades y tests
│   ├── Dockerfile             # Imagen Docker backend
│   ├── package.json           # Dependencias
│   └── env.example            # Variables de entorno
│
├── frontend/                   # TanStackStart + React + Vite
│   ├── src/
│   │   ├── main.tsx           # Entry point
│   │   ├── App.tsx            # Root component
│   │   ├── app/               # Rutas (TanStack Router)
│   │   ├── components/        # Componentes reutilizables
│   │   ├── hooks/             # Custom hooks
│   │   ├── styles/            # Estilos CSS
│   │   ├── types/             # TypeScript interfaces
│   │   └── utils/             # Utilidades
│   ├── public/                # Assets estáticos
│   ├── Dockerfile             # Imagen Docker frontend
│   ├── vite.config.ts         # Configuración Vite
│   ├── package.json           # Dependencias
│   └── env.example            # Variables de entorno
│
├── docs/                      # Documentación
│   ├── PRD.md                # Product Requirements
│   ├── Battle/               # Especificaciones de batalla
│   ├── architecture/         # APIs y protocolos
│   ├── Pokedex/             # Datos de Pokémon
│   └── wireframe/           # Diseños UI
│
├── docker-compose.yml         # Orquestación de contenedores
├── README.md                  # Este archivo
└── AGENT.md                   # PRD y detalles de desarrollo
```

---

## 🔌 Endpoints REST Principales

### Pokémon
```
GET  /api/pokemon                    # Listar con paginación y filtros
GET  /api/pokemon/:id/moves          # Movimientos de un Pokémon
GET  /api/pokemon/search             # Búsqueda avanzada
```

### Salas
```
POST   /api/rooms                    # Crear sala
GET    /api/rooms/:code              # Obtener estado sala
POST   /api/rooms/:code/join         # Unirse a sala
GET    /api/rooms/:code/leave        # Abandonar sala
```

### Autenticación
```
GET  /api/auth/profile               # Perfil usuario actual
POST /api/auth/logout                # Cerrar sesión
```

### Tienda
```
GET    /api/store/checkout           # Procesar compra
POST   /api/store/confirm            # Confirmar transacción
```

---

## 📡 WebSocket Eventos

### Conexión
```javascript
socket.on('room:joined', (data) => {
  // { session_id, player_number, room_code }
});

socket.on('room:left', (data) => {
  // { reason: string }
});
```

### Draft
```javascript
socket.on('draft:state', (data) => {
  // Estado actual del draft
});

socket.on('draft:picked', (data) => {
  // { player_number, pokemon_id, turn_count }
});
```

### Batalla
```javascript
socket.on('battle:start', (data) => {
  // Inicia batalla con ambos equipos
});

socket.on('battle:turn', (data) => {
  // Turno actual con acciones
});

socket.on('battle:end', (data) => {
  // { winner_player_number, reason }
});
```

Ver `docs/architecture/WEBSOCKET_PROTOCOL.md` para protocolo completo.

---

## 🐛 Conocidos y Reportados

### V4 Actual
- ✅ Sistema de batalla core funcional (V1-V4)
- ✅ Estados alterados (quemadura, envenenamiento, parálisis, sueño, congelación, confusión)
- ✅ Movimientos de 2 turnos y fatiga
- ✅ Cambios de estadísticas (buffs/debuffs)
- ✅ Draft alternado funcional
- ✅ Sincronización WebSocket en tiempo real
- ✅ Importación de datos PokeAPI
- ✅ Autenticación con Clerk
- ✅ Tienda y Shiny Pack
- ✅ Sprites Shiny en Pokédex, Draft y Batalla
- ⚠️ Algunos sprites sin animación (fallback a PNG)

Ver `docs/Error/ERRORES_DESARROLLO.md` para historial completo de bugs encontrados y solucionados.

---

## 🤝 Desarrollo Local (sin Docker)

Si prefieres correr el proyecto sin Docker:

### Backend
```bash
cd backend
cp env.example .env
# Edita .env con tus valores
bun install
bun run src/index.ts
```

### Frontend
```bash
cd frontend
cp env.example .env
# Edita .env con tus valores
bun install
bun run dev
```

**Nota:** Asegúrate de tener MongoDB corriendo localmente en `mongodb://localhost:27017`.

---

## 📝 Variables de Entorno

### Backend (`backend/.env`)
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://mongo:27017/pokemon-patacon
MONGODB_DB_NAME=pokemon-patacon
CORS_ORIGIN=http://localhost:5173
POKEAPI_BASE_URL=https://pokeapi.co/api/v2
POKEAPI_TIMEOUT=10000
CLERK_SECRET_KEY=xxxxxxxxxx
CLERK_JWT_ISSUER=xxxxxxxxxxx
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=xxxxxxxxxxxx
```

---

## 🎯 Roadmap Futuro

### Próximas Versiones
- [ ] Ítems de bolsa
- [ ] Sistema de críticos
- [ ] Sistema de rating/ELO
- [ ] Matchmaking automático
- [ ] Historial de batallas
- [ ] Modo espectador

---

## 🙏 Créditos

- **PokeAPI:** [pokeapi.co](https://pokeapi.co/) - Datos de Pokémon
- **Sprite Animados:** Pokémon Black/White (Game Freak)
- **Framework Backend:** [Hono](https://hono.dev/)
- **Framework Frontend:** [React](https://react.dev/) + [TanStack](https://tanstack.com/)
- **Runtime:** [Bun](https://bun.sh/)
- **TypeIcons:** https://github.com/partywhale/pokemon-type-icons/tree/main
- **Creador del Proyecto:** [Ramses Szobotka]

---

**Última actualización:** 22 de mayo de 2026  
**Estado:** En desarrollo activo — Core completo (V1-V4 implementado) V5+ en planificación.
