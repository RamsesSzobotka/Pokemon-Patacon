# 🗄️ Configuración MongoDB - Pokémon Patacon

## Opciones de Instalación

### Opción 1: MongoDB Local (Recomendado para desarrollo)

#### Windows
```powershell
# Descargar e instalar desde: https://www.mongodb.com/try/download/community

# O usando Chocolatey
choco install mongodb-community

# Inicia el servicio
net start MongoDB
```

#### macOS
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

### Opción 2: MongoDB Atlas (Nube - Recomendado para producción)

1. Ir a https://www.mongodb.com/cloud/atlas
2. Crear cuenta gratis
3. Crear cluster (tier gratis disponible)
4. Obtener connection string: `mongodb+srv://user:password@cluster.mongodb.net/pokemon-patacon`

### Opción 3: Docker

```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest
```

Connection string: `mongodb://admin:password@localhost:27017/pokemon-patacon`

---

## Configuración del Proyecto

### 1. Copiar .env.example a .env

```bash
cd backend
cp .env.example .env
```

### 2. Editar .env con variables MongoDB

**Para desarrollo local:**
```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=pokemon-patacon
```

**Para MongoDB Atlas (Nube):**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokemon-patacon?retryWrites=true&w=majority
MONGODB_DB_NAME=pokemon-patacon
```

### 3. Iniciar servidor

```bash
cd backend
bun run dev
```

---

## Verificación de Conexión

### Via endpoint health
```bash
curl http://localhost:3000/api/health
```

### Via Pokédex
```bash
# Primer Pokémon (debe conectarse a MongoDB y PokeAPI)
curl http://localhost:3000/api/pokemon/1

# Debería retornar algo como:
# {
#   "success": true,
#   "data": {
#     "pokeapi_id": 1,
#     "name": "bulbasaur",
#     ...
#   }
# }
```

### Monitorear logs
Buscar mensajes como:
- ✅ MongoDB conectada correctamente
- 📦 Pokémon en MongoDB: X
- 💾 Pokémon #1 guardado en MongoDB

---

## Estructura de Datos en MongoDB

Colección: `pokemon`

```javascript
{
  "_id": ObjectId(...),
  "pokeapi_id": 1,
  "name": "bulbasaur",
  "generation": 1,
  "types": ["grass", "poison"],
  "stats": {
    "hp": 45,
    "attack": 49,
    "defense": 49,
    "sp_attack": 65,
    "sp_defense": 65,
    "speed": 45
  },
  "base_experience": 64,
  "is_legendary": false,
  "is_mythical": false,
  "moves": [
    {
      "name": "razor-leaf",
      "type": "grass",
      "power": 55,
      "accuracy": 95,
      "priority": 0,
      "damage_class": "physical"
    }
  ],
  "sprites": {
    "animated_gif": "https://raw.githubusercontent.com/...",
    "static_png": "https://raw.githubusercontent.com/..."
  },
  "height_dm": 7,
  "weight_hg": 69,
  "cached_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z"
}
```

### Índices Creados Automáticamente
- `pokeapi_id` (único)
- `name` (para búsquedas)
- `generation`
- `is_legendary`
- `is_mythical`
- `types`
- `cached_at`

---

## Solución de Problemas

### ❌ "ECONNREFUSED" al iniciar servidor

**Causa**: MongoDB no está corriendo

**Solución**:
```bash
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongodb

# Docker
docker start mongodb
```

### ❌ "Authentication failed"

**Causa**: Credenciales incorrectas en MONGODB_URI

**Verificar**:
- Username y password correctos
- Database name correcto
- URL escapada correctamente (espacios, caracteres especiales)

### ❌ "connection timeout"

**Causa**: Network/firewall bloqueando MongoDB

**Solución**:
```bash
# Verificar conectividad
ping localhost:27017

# Para MongoDB Atlas, revisar:
# 1. IP Whitelist en Atlas
# 2. Firewall del sistema
# 3. VPN/Proxy settings
```

### ⚠️ "MongoDB not available, using memory cache"

**Significado**: El servicio conectó a PokeAPI pero no a MongoDB

**Acción**: Los datos se cachean en memoria pero se pierden al reiniciar

---

## Próximos Pasos

1. ✅ Configurar MongoDB
2. ✅ Ejecutar `bun run dev`
3. ✅ Verificar con `curl http://localhost:3000/api/pokemon/1`
4. 📋 Los Pokémon se guardarán automáticamente en MongoDB
5. 🚀 En la Pokédex, las búsquedas serán muy rápidas (caché MongoDB)

