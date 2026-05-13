---
name: Pokemon PokeAPI Integration & Caching
description: Integration with PokeAPI v2 for Pokemon Patacon, including Gen V filtering, caching strategy, MongoDB storage, and data validation.
trigger: When fetching Pokemon data, implementing PokeAPI client, setting up caching, or managing Pokemon database. Use when working with pokeapiClient.ts, Pokemon schema, or data initialization.
domain: Pokemon Patacon Data Integration
version: 1.0
---

# Pokémon Patacon - PokeAPI Integration & Caching Skill

## Overview

Pokemon Patacon uses **PokeAPI v2** as the authoritative source for Pokémon data, with **MongoDB as local cache**. This skill covers integration patterns, caching strategy, Gen V filtering, and data synchronization.

**Core Principle:** Cache-first reads, PokeAPI fallback, always validate Gen V.

---

## 1. PokeAPI Endpoints

### 1.1 Key Endpoints for Gen V

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /generation/5` | All Gen V Pokémon | List of 156 native species |
| `GET /pokemon/{id}` | Individual Pokémon | Stats, moves, sprites, types |
| `GET /move/{id}` | Move details | Power, accuracy, type, effect |
| `GET /type/{name}` | Type effectiveness | Damage relations |

### 1.2 Generation 5 Pokemon Range

- **IDs:** 494-649 (new Pokémon)
- **Total available:** 493 (Gen I-V combined)
- **Endpoint:** `https://pokeapi.co/api/v2/generation/5`

```json
{
  "pokemon_species": [
    {
      "name": "victini",
      "url": "https://pokeapi.co/api/v2/pokemon-species/494/"
    },
    // ... 155 more
  ]
}
```

### 1.3 Individual Pokemon Response

```json
{
  "id": 25,
  "name": "pikachu",
  "height": 4,
  "weight": 60,
  "types": [
    {
      "type": {
        "name": "electric",
        "url": "https://pokeapi.co/api/v2/type/13/"
      },
      "slot": 1
    }
  ],
  "stats": [
    {
      "stat": {
        "name": "hp",
        "url": "https://pokeapi.co/api/v2/stat/1/"
      },
      "base_stat": 35
    },
    // ATK, DEF, SpA, SpD, SPE
  ],
  "moves": [
    {
      "move": {
        "name": "thunderbolt",
        "url": "https://pokeapi.co/api/v2/move/24/"
      },
      "version_group_details": [
        {
          "version_group": {
            "name": "generation-v",
            "url": "https://pokeapi.co/api/v2/version-group/9/"
          },
          "level_learned_at": 0,
          "move_learn_method": { "name": "tutor", ... }
        }
      ]
    }
  ],
  "sprites": {
    "back_default": "...",
    "front_default": "...",
    "back_shiny": "...",
    "front_shiny": "...",
    "other": {
      "official-artwork": {
        "front_default": "...",
        "front_shiny": "..."
      }
    },
    "versions": {
      "generation-v": {
        "black-white": {
          "animated": {
            "back_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/1.gif",
            "front_default": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif",
            "back_shiny": "...",
            "front_shiny": "..."
          }
        }
      }
    }
  }
}
```

---

## 2. MongoDB Schema

### 2.1 Pokemon Collection

```javascript
// Database: pokemon_patacon
// Collection: pokemon

db.pokemon.insertOne({
  _id: ObjectId("..."),
  
  // PokeAPI mapping
  pokeapi_id: 25,
  name: "pikachu",
  name_lower: "pikachu",  // For searching
  
  // Typing
  types: ["electric"],
  
  // Stats (max stats, no variation)
  stats: {
    hp: 35,
    attack: 55,
    defense: 40,
    sp_attack: 50,
    sp_defense: 50,
    speed: 90
  },
  
  // Moveset (Gen V moves only)
  moves: [
    {
      name: "thunder-shock",
      power: 40,
      accuracy: 100,
      type: "electric",
      category: "special"
    },
    {
      name: "thunderbolt",
      power: 90,
      accuracy: 100,
      type: "electric",
      category: "special"
    },
    {
      name: "thunder-wave",
      power: null,
      accuracy: 90,
      type: "electric",
      category: "status"
    },
    {
      name: "quick-attack",
      power: 40,
      accuracy: 100,
      type: "normal",
      category: "physical"
    }
  ],
  
  // Legendary classification
  is_legendary: false,
  
  // Sprites (Gen V Black/White animated)
  sprites: {
    front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif",
    back_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/25.gif",
    front_shiny: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/shiny/25.gif",
    back_shiny: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/shiny/25.gif"
  },
  
  // Metadata
  generation: 1,
  height: 4,
  weight: 60,
  
  // Caching
  cached_at: ISODate("2026-05-12T10:30:00.000Z"),
  updated_at: ISODate("2026-05-12T10:30:00.000Z"),
  cache_ttl: ISODate("2026-06-12T10:30:00.000Z")  // 30 days
})

// Indexes
db.pokemon.createIndex({ pokeapi_id: 1 }, { unique: true });
db.pokemon.createIndex({ name_lower: 1 });
db.pokemon.createIndex({ types: 1 });
db.pokemon.createIndex({ is_legendary: 1 });
db.pokemon.createIndex({ cache_ttl: 1 }, { expireAfterSeconds: 0 });  // TTL index
```

### 2.2 Index Strategy

```javascript
// Fast lookups
db.pokemon.createIndex({ pokeapi_id: 1 });

// Search by name
db.pokemon.createIndex({ name_lower: 1 });

// Filter by type (for team builder suggestions)
db.pokemon.createIndex({ types: 1 });

// Filter legendaries
db.pokemon.createIndex({ is_legendary: 1 });

// Auto-expire cache (MongoDB TTL)
db.pokemon.createIndex({ cache_ttl: 1 }, { expireAfterSeconds: 0 });
```

---

## 3. PokeAPI Client Implementation

### 3.1 Basic Client

```typescript
import axios from 'axios';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

class PokeAPIClient {
  private cache = new Map<string, any>();
  
  async getPokemon(idOrName: string | number): Promise<any> {
    const url = `${POKEAPI_BASE}/pokemon/${idOrName}`;
    
    // Check in-memory cache
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }
    
    try {
      const response = await axios.get(url, { timeout: 5000 });
      this.cache.set(url, response.data);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch Pokemon ${idOrName}:`, error);
      throw new Error(`PokeAPI unavailable for ${idOrName}`);
    }
  }
  
  async getMove(idOrName: string | number): Promise<any> {
    const url = `${POKEAPI_BASE}/move/${idOrName}`;
    
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }
    
    const response = await axios.get(url, { timeout: 5000 });
    this.cache.set(url, response.data);
    return response.data;
  }
  
  async getType(name: string): Promise<any> {
    const url = `${POKEAPI_BASE}/type/${name}`;
    
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }
    
    const response = await axios.get(url, { timeout: 5000 });
    this.cache.set(url, response.data);
    return response.data;
  }
  
  async getGeneration5(): Promise<number[]> {
    const url = `${POKEAPI_BASE}/generation/5`;
    
    const response = await axios.get(url, { timeout: 5000 });
    
    // Extract pokemon IDs from species URLs
    const pokemonIds = response.data.pokemon_species.map((species: any) => {
      const match = species.url.match(/\/(\d+)\//);
      return match ? parseInt(match[1]) : null;
    }).filter(Boolean);
    
    return pokemonIds;
  }
}

export const pokeAPIClient = new PokeAPIClient();
```

---

## 4. Caching Strategy

### 4.1 Cache-First Retrieval

```typescript
async function getPokemonData(pokemonId: number): Promise<Pokemon> {
  // Step 1: Check MongoDB cache
  const cached = await db.pokemon.findOne({ pokeapi_id: pokemonId });
  
  if (cached && !isCacheExpired(cached)) {
    console.log(`[CACHE HIT] Pokemon ${pokemonId} from DB`);
    return cached;
  }
  
  // Step 2: Fetch from PokeAPI
  console.log(`[CACHE MISS] Fetching Pokemon ${pokemonId} from PokeAPI`);
  const apiData = await pokeAPIClient.getPokemon(pokemonId);
  
  // Step 3: Transform and validate Gen V
  const transformed = transformPokemonData(apiData);
  
  if (!isValidGen5(transformed)) {
    throw new Error(`Pokemon ${pokemonId} not valid for Gen V`);
  }
  
  // Step 4: Cache in MongoDB
  await db.pokemon.updateOne(
    { pokeapi_id: pokemonId },
    { $set: transformed, $setOnInsert: { _id: new ObjectId() } },
    { upsert: true }
  );
  
  return transformed;
}

function isCacheExpired(document: any): boolean {
  if (!document.cache_ttl) return true;
  return Date.now() > document.cache_ttl.getTime();
}
```

### 4.2 Transformation & Validation

```typescript
interface PokemonData {
  pokeapi_id: number;
  name: string;
  types: string[];
  stats: { hp: number; attack: number; /* ... */ };
  moves: Move[];
  is_legendary: boolean;
  sprites: any;
}

function transformPokemonData(apiData: any): PokemonData {
  const pokeApi_id = apiData.id;
  const name = apiData.name;
  
  // Extract types
  const types = apiData.types
    .sort((a: any, b: any) => a.slot - b.slot)
    .map((t: any) => t.type.name);
  
  // Extract base stats
  const stats: any = {};
  apiData.stats.forEach((stat: any) => {
    const statName = {
      'hp': 'hp',
      'attack': 'attack',
      'defense': 'defense',
      'special-attack': 'sp_attack',
      'special-defense': 'sp_defense',
      'speed': 'speed'
    }[stat.stat.name];
    
    if (statName) {
      stats[statName] = stat.base_stat;
    }
  });
  
  // Extract Gen V moves only
  const moves = extractGen5Moves(apiData.moves);
  
  // Check if legendary
  const is_legendary = checkIfLegendary(pokeapi_id);
  
  // Extract Gen V sprites (Black/White animated)
  const sprites = extractGen5Sprites(apiData.sprites);
  
  return {
    pokeapi_id,
    name,
    name_lower: name.toLowerCase(),
    types,
    stats,
    moves,
    is_legendary,
    sprites,
    generation: getGeneration(pokeapi_id),
    height: apiData.height,
    weight: apiData.weight,
    cached_at: new Date(),
    updated_at: new Date(),
    cache_ttl: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 days
  };
}

function extractGen5Moves(movesData: any[]): Move[] {
  return movesData
    .filter(moveData => {
      // Only moves from Gen V or earlier
      return moveData.version_group_details.some((vgd: any) => {
        const genNum = parseInt(vgd.version_group.name.split('-')[1]);
        return genNum <= 5;  // Gen I-V
      });
    })
    .slice(0, 20)  // Limit to most common moves
    .map(moveData => ({
      name: moveData.move.name,
      url: moveData.move.url
    }));
}

function extractGen5Sprites(spritesData: any): any {
  // Prioritize Black/White animated sprites
  const bw = spritesData.versions?.['generation-v']?.['black-white']?.animated;
  
  if (bw) {
    return {
      front_default: bw.front_default,
      back_default: bw.back_default,
      front_shiny: bw.front_shiny,
      back_shiny: bw.back_shiny
    };
  }
  
  // Fallback to static
  return {
    front_default: spritesData.front_default,
    back_default: spritesData.back_default,
    front_shiny: spritesData.front_shiny || spritesData.front_default,
    back_shiny: spritesData.back_shiny || spritesData.back_default
  };
}

function checkIfLegendary(pokeapiId: number): boolean {
  const legendaryIds = [
    144, 145, 146,  // Gen I birds
    150, 151,       // Gen I dragons
    243, 244, 245,  // Gen II beasts
    249, 250,       // Gen II tower duo
    384,            // Gen III
    483, 484, 487,  // Gen IV legends
    643, 644, 645, 646, 647, 648, 649  // Gen V legends (Reshiram, Zekrom, etc)
  ];
  
  return legendaryIds.includes(pokeapiId);
}
```

### 4.3 Move Details Fetching

```typescript
async function enrichMoveData(move: { name: string; url: string }): Promise<Move> {
  // Move name format: "thunder-bolt" -> fetch full details
  const moveDetails = await pokeAPIClient.getMove(move.name);
  
  return {
    name: moveDetails.name,
    power: moveDetails.power,
    accuracy: moveDetails.accuracy,
    type: moveDetails.type.name,
    category: moveDetails.damage_class.name,  // "physical", "special", "status"
    effect: moveDetails.effect_entries?.[0]?.effect || null
  };
}

// Called during Pokemon setup
async function enrichPokemonMoves(pokemon: any): Promise<Move[]> {
  const enrichedMoves = await Promise.all(
    pokemon.moves.map(m => enrichMoveData(m))
  );
  
  return enrichedMoves;
}
```

---

## 5. Batch Operations & Initialization

### 5.1 Bootstrap Gen V Pokemon

```typescript
async function bootstrapGen5Pokemon(): Promise<void> {
  console.log('Bootstrapping Gen V Pokemon...');
  
  try {
    // Get all Gen V Pokemon IDs
    const gen5Ids = await pokeAPIClient.getGeneration5();
    console.log(`Found ${gen5Ids.length} Gen V Pokemon`);
    
    // Fetch in batches (don't hammer API)
    const BATCH_SIZE = 10;
    for (let i = 0; i < gen5Ids.length; i += BATCH_SIZE) {
      const batch = gen5Ids.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(id => getPokemonData(id).catch(err => {
          console.error(`Failed to fetch Pokemon ${id}:`, err.message);
        }))
      );
      
      console.log(`Loaded ${Math.min(i + BATCH_SIZE, gen5Ids.length)}/${gen5Ids.length}`);
    }
    
    console.log('✅ Gen V Pokemon bootstrap complete');
  } catch (error) {
    console.error('Bootstrap failed:', error);
    throw error;
  }
}

// Run at server startup
server.on('start', () => {
  bootstrapGen5Pokemon();
});
```

### 5.2 Search Pokemon by Name/Type

```typescript
async function searchPokemon(query: string, filter?: { type?: string }): Promise<Pokemon[]> {
  const mongoQuery: any = {
    $or: [
      { name_lower: { $regex: query.toLowerCase(), $options: 'i' } },
      { name: { $regex: query, $options: 'i' } }
    ]
  };
  
  if (filter?.type) {
    mongoQuery.types = filter.type;
  }
  
  const results = await db.pokemon
    .find(mongoQuery)
    .limit(20)
    .toArray();
  
  return results;
}

// API endpoint
app.get('/api/pokemon/search', async (req) => {
  const { q, type } = req.query;
  
  const results = await searchPokemon(q as string, { type: type as string });
  
  return {
    total: results.length,
    results: results.map(p => ({
      id: p.pokeapi_id,
      name: p.name,
      types: p.types,
      sprites: p.sprites,
      is_legendary: p.is_legendary
    }))
  };
});
```

---

## 6. Error Handling

### 6.1 PokeAPI Rate Limiting

```typescript
// Implement exponential backoff
async function fetchWithRetry(url: string, maxAttempts = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios.get(url, { timeout: 5000 });
    } catch (error: any) {
      if (error.response?.status === 429) {
        // Rate limited
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Failed after ${maxAttempts} attempts`);
}
```

### 6.2 Validation & Fallback

```typescript
async function getPokemonSafe(pokemonId: number): Promise<Pokemon | null> {
  try {
    return await getPokemonData(pokemonId);
  } catch (error) {
    console.error(`Failed to get Pokemon ${pokemonId}:`, error);
    
    // Try cached version even if expired
    const expired = await db.pokemon.findOne({ pokeapi_id: pokemonId });
    if (expired) {
      console.log(`Using expired cache for Pokemon ${pokemonId}`);
      return expired;
    }
    
    return null;
  }
}
```

---

## 7. Type Chart from PokeAPI

### 7.1 Fetch & Cache Type Chart

```typescript
async function initTypeChart(): Promise<void> {
  const types = await Promise.all(
    ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
     'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']
      .map(name => pokeAPIClient.getType(name))
  );
  
  const typeChart: any = {};
  
  types.forEach(typeData => {
    typeChart[typeData.name] = {
      effective_against: typeData.damage_relations.double_damage_to.map((t: any) => t.name),
      weak_to: typeData.damage_relations.take_damage_from.map((t: any) => t.name),
      resists: typeData.damage_relations.half_damage_from.map((t: any) => t.name),
      immune_to: typeData.damage_relations.no_damage_from.map((t: any) => t.name)
    };
  });
  
  // Cache in memory for fast lookup
  global.TYPE_CHART = typeChart;
}
```

---

## 8. Implementation Checklist

- [ ] PokeAPI client implemented with timeout handling
- [ ] MongoDB Pokemon collection created with indexes
- [ ] Gen V Pokemon transformation and validation working
- [ ] Gen V sprites (Black/White animated) extraction working
- [ ] Caching strategy implemented (cache-first)
- [ ] TTL index on MongoDB for auto-expiration
- [ ] Move enrichment fetching power/accuracy/type
- [ ] Batch bootstrap operation fetches all Gen V Pokemon
- [ ] Search by name/type working
- [ ] Error handling with fallback to expired cache
- [ ] Type chart cached in memory for fast lookup
- [ ] Rate limiting handled with exponential backoff
- [ ] No duplicate Pokemon in DB

---

## 9. Performance Considerations

- **In-memory cache:** 1000 Pokemon IDs → ~50KB
- **MongoDB cache:** 500MB for full Gen V + Gen I-IV
- **Query latency:** <10ms for cached, <500ms for API fetch
- **API call reduction:** 99% after first load (cache hit rate)

---

## 10. References

- PokeAPI Docs: https://pokeapi.co/docs/v2
- Gen V Pokemon: https://pokeapi.co/api/v2/generation/5
- Pokemon Patacon PRD: `/docs/PRD.md` (Section 9)
- Gen V Design: `pokemon-gen-v-design` skill

---

**Skill Version:** 1.0  
**Last Updated:** 12 de Mayo 2026  
**Maintainer:** Pokemon Patacon Dev Team
