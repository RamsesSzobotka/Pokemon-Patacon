# Pokémon Patacon - Battle Arena

Videojuego de batallas Pokémon 1v1 en tiempo real basado en Generación V (Black/White).

## Stack Tecnológico

- **Frontend:** TanStack Start + Vite + React
- **Backend:** Bun + Hono
- **Base de Datos:** MongoDB (local)

## Estructura del Proyecto

```
pokemon-patacon/
├── frontend/          # TanStack Start + React
│   ├── src/
│   │   ├── components/    # Componentes UI
│   │   ├── routes/        # Rutas de la app
│   │   ├── stores/        # Zustand stores
│   │   ├── services/      # API client, WebSocket
│   │   └── utils/         # Utilidades
│   └── app.config.ts
│
└── backend/           # Bun + Hono
    └── src/
        ├── routes/        # Endpoints REST
        ├── websocket/     # Handlers WS
        ├── services/      # Lógica de negocio
        ├── models/        # Modelos de datos
        └── db/            # Conexión MongoDB
```

## Prerequisites

- Node.js 18+
- Bun 1.0+
- MongoDB local

## Installation

```bash
# Backend
cd backend
bun install

# Frontend
cd frontend
bun install
```

## Running

```bash
# Backend (Puerto 3000)
cd backend && bun run dev

# Frontend (Puerto 3001)
cd frontend && bun run dev
```

## API Endpoints

- `GET /api/pokemon/search?query=...`
- `GET /api/pokemon/:idOrName`
- `GET /api/pokemon/list/gen5`
- `POST /api/rooms`
- `GET /api/rooms/:code`
- `POST /api/rooms/:code/join`

## WebSocket Events

- `room:create` / `room:join`
- `pokemon:select`
- `turn:action`
- `item:used`