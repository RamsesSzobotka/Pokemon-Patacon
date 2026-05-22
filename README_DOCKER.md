# Dockerización Pokémon Patacon

Este documento describe cómo iniciar el proyecto usando Docker y Docker Compose.

## Requisitos

- Docker instalado
- Docker Compose disponible (`docker compose`)
- Archivos de entorno:
  - `backend/.env`
  - `frontend/.env`

> El `docker-compose.yml` carga estos archivos con las variables necesarias para cada servicio.

## Servicios incluidos

- `mongo`: base de datos MongoDB
- `backend`: servidor Bun que expone la API en el puerto `3000`
- `frontend`: cliente Bun/Vite que expone la app en el puerto `5173`

## Pasos de inicialización

1. Abre una terminal en la raíz del proyecto:

```bash
cd "c:\Users\ramse\Documents\Universidad\Des_Software IX\Pokemon-Patacon"
```

2. Construye y levanta los contenedores:

```bash
docker compose up --build
```

3. Espera a que los contenedores arranquen.

- Mongo se inicia primero.
- Backend se conecta a `mongodb://mongo:27017/pokemon-patacon`.
- Frontend se inicia después y se conecta a `http://localhost:3000`.

## Puertos expuestos

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- MongoDB: `mongodb://localhost:27017`

## Notas importantes

- El backend ejecuta su inicialización interna al arrancar, incluida la importación de datos desde PokeAPI si no existen en la base de datos.
- Si la base de datos tarda en estar lista, el backend reintentará la conexión automáticamente.
- Si cambias variables de entorno, reinicia los contenedores con:

```bash
docker compose down
docker compose up --build
```

## Comandos útiles

- Parar contenedores:

```bash
docker compose down
```

- Ver registros en vivo:

```bash
docker compose logs -f
```

- Reconstruir un servicio específico:

```bash
docker compose up --build backend
```
