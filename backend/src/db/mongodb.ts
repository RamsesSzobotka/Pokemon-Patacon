import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;
let pokemonCollection: Collection | null = null;
let movesCollection: Collection | null = null;

export async function connectDB(): Promise<Db> {
  if (db) {
    console.log('✅ MongoDB ya conectada');
    return db;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'pokemon-patacon';
  const maxRetries = 10;
  const retryDelayMs = 2000;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log(`🔌 Conectando a MongoDB: ${mongoUri} (intento ${attempt + 1}/${maxRetries})`);

      client = new MongoClient(mongoUri);
      await client.connect();

      db = client.db(dbName);

      // Verificar conexión
      await db.admin().ping();
      console.log('✅ MongoDB conectada correctamente');

      // Crear índices
      await initializeIndexes();

      return db;
    } catch (error) {
      attempt += 1;
      console.error(`❌ Error conectando a MongoDB (intento ${attempt}/${maxRetries}):`, error);

      if (attempt >= maxRetries) {
        throw error;
      }

      console.log(`⏳ Reintentando en ${retryDelayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error('No se pudo conectar a MongoDB después de varios intentos');
}

export async function disconnectDB(): Promise<void> {
  if (client) {
    await client.close();
    console.log('🔌 MongoDB desconectada');
    client = null;
    db = null;
    pokemonCollection = null;
    movesCollection = null;
  }
}

export function getDB(): Db {
  if (!db) {
    throw new Error('MongoDB no está conectada. Llama a connectDB() primero');
  }
  return db;
}

export function getPokemonCollection(): Collection {
  if (!pokemonCollection) {
    const database = getDB();
    pokemonCollection = database.collection('pokemon');
  }
  return pokemonCollection;
}

export function getMovesCollection(): Collection {
  if (!movesCollection) {
    const database = getDB();
    movesCollection = database.collection('moves');
  }
  return movesCollection;
}

async function initializeIndexes() {
  const collection = getPokemonCollection();
  const moves = getMovesCollection();

  try {
    // Índices para pokemon
    await collection.createIndex({ pokeapi_id: 1 }, { unique: true });
    await collection.createIndex({ name: 1 });
    await collection.createIndex({ generation: 1 });
    await collection.createIndex({ is_legendary: 1 });
    await collection.createIndex({ is_mythical: 1 });
    await collection.createIndex({ types: 1 });
    await collection.createIndex({ move_ids: 1 });
    await collection.createIndex({ cached_at: 1 });
    await collection.createIndex({ name: 'text' });

    // Índices para moves (optimizados para battle engine)
    await moves.createIndex({ move_id: 1 }, { unique: true });
    await moves.createIndex({ name: 1 });
    await moves.createIndex({ type: 1 });
    await moves.createIndex({ damage_class: 1 });
    await moves.createIndex({ power: -1 });
    await moves.createIndex({ 'meta.ailment': 1 });
    await moves.createIndex({ type: 1, damage_class: 1 });
    await moves.createIndex({ power: 1, accuracy: 1 });

    console.log('✅ Índices de MongoDB creados (pokemon + moves)');
  } catch (error) {
    console.log('⚠️ Índices ya existen o error menor:', (error as Error).message);
  }
}

export async function insertPokemon(pokemon: any): Promise<void> {
  const collection = getPokemonCollection();
  await collection.updateOne(
    { pokeapi_id: pokemon.pokeapi_id },
    { $set: pokemon },
    { upsert: true }
  );
}

export async function getPokemonById(id: number): Promise<any | null> {
  const collection = getPokemonCollection();
  return await collection.findOne({ pokeapi_id: id });
}

export async function getPokemonList(filter: any, limit: number, offset: number): Promise<any[]> {
  const collection = getPokemonCollection();
  return await collection
    .find(filter)
    .limit(limit)
    .skip(offset)
    .toArray();
}

export async function countPokemon(filter: any): Promise<number> {
  const collection = getPokemonCollection();
  return await collection.countDocuments(filter);
}

export async function deletePokemon(id: number): Promise<void> {
  const collection = getPokemonCollection();
  await collection.deleteOne({ pokeapi_id: id });
}

export async function getAllPokemonIds(): Promise<number[]> {
  const collection = getPokemonCollection();
  const docs = await collection.find({}, { projection: { pokeapi_id: 1 } }).toArray();
  return docs.map(doc => doc.pokeapi_id);
}

// ============ FUNCIONES PARA MOVIMIENTOS ============

export async function insertMove(move: any): Promise<void> {
  const collection = getMovesCollection();
  await collection.updateOne(
    { move_id: move.move_id },
    { $set: move },
    { upsert: true }
  );
}

export async function insertMovesBatch(moves: any[]): Promise<void> {
  const collection = getMovesCollection();
  const operations = moves.map(move => ({
    updateOne: {
      filter: { move_id: move.move_id },
      update: { $set: move },
      upsert: true
    }
  }));
  await collection.bulkWrite(operations, { ordered: false });
}

export async function getMoveById(moveId: number): Promise<any | null> {
  const collection = getMovesCollection();
  return await collection.findOne({ move_id: moveId });
}

export async function getMovesByIds(moveIds: number[]): Promise<any[]> {
  const collection = getMovesCollection();
  return await collection.find({ move_id: { $in: moveIds } }).toArray();
}

export async function getAllMoves(): Promise<any[]> {
  const collection = getMovesCollection();
  return await collection.find({}).toArray();
}

export async function getMovesByType(type: string): Promise<any[]> {
  const collection = getMovesCollection();
  return await collection.find({ type: type.toLowerCase() }).toArray();
}

export async function getMovesByDamageClass(damageClass: string): Promise<any[]> {
  const collection = getMovesCollection();
  return await collection.find({ damage_class: damageClass }).toArray();
}

export async function getMovesWithAilment(ailment: string): Promise<any[]> {
  const collection = getMovesCollection();
  return await collection.find({ 'meta.ailment': ailment }).toArray();
}

export async function countMoves(): Promise<number> {
  const collection = getMovesCollection();
  return await collection.countDocuments({});
}

export async function deleteMove(moveId: number): Promise<void> {
  const collection = getMovesCollection();
  await collection.deleteOne({ move_id: moveId });
}

// ============ FUNCIONES PARA TIPOS ============

interface TypeDocument {
  type_id: number;
  name: string;
  names: {
    es: string;
    en: string;
  };
  damage_relations: {
    to: {
      double: string[];
      half: string[];
      immune: string[];
    };
    from: {
      double: string[];
      half: string[];
      immune: string[];
    };
  };
  imported_at: Date;
}

let typesCollection: Collection<TypeDocument> | null = null;

export function getTypesCollection(): Collection<TypeDocument> {
  if (!typesCollection) {
    const database = getDB();
    typesCollection = database.collection<TypeDocument>('types');
  }
  return typesCollection;
}

export async function getTypeByName(name: string): Promise<TypeDocument | null> {
  const collection = getTypesCollection();
  return await collection.findOne({ name: name.toLowerCase() });
}

export async function getTypeById(typeId: number): Promise<TypeDocument | null> {
  const collection = getTypesCollection();
  return await collection.findOne({ type_id: typeId });
}

export async function getAllTypes(): Promise<TypeDocument[]> {
  const collection = getTypesCollection();
  return await collection.find({}).sort({ type_id: 1 }).toArray();
}

/**
 * Calcula la efectividad de un tipo ataque contra uno o dos tipos defensores
 * Retorna: 0, 0.25, 0.5, 1.0, 2.0, o 4.0 (para tipos duales)
 */
export function getTypeEffectiveness(
  attackTypeName: string,
  defenderTypes: string[]
): number {
  const typeMap: Record<string, TypeDocument> = {};
  
  // Cache de tipos (usar en memoria si ya están cargados)
  // Por ahora usamos una función sincrónica con datos hardcodeados como fallback
  // En producción, esto consultaría la DB
  
  const effectiveness = getEffectivenessFromCache(attackTypeName, defenderTypes);
  return effectiveness;
}

// Mapa de efectividad hardcodeado (basado en datos de PokeAPI Gen V + Fairy)
const TYPE_EFFECTIVENESS_MAP: Record<string, Record<string, number>> = {
  // type que ataca -> { tipo defensor: efectividad }
  normal: { normal: 1, fighting: 1, flying: 1, poison: 1, ground: 1, rock: 0.5, bug: 1, ghost: 0, steel: 0.5, fire: 1, water: 1, grass: 1, electric: 1, psychic: 1, ice: 1, dragon: 1, dark: 1, fairy: 1 },
  fighting: { normal: 2, fighting: 1, flying: 0.5, poison: 0.5, ground: 1, rock: 2, bug: 0.5, ghost: 0, steel: 2, fire: 1, water: 1, grass: 1, electric: 1, psychic: 0.5, ice: 2, dragon: 1, dark: 2, fairy: 0.5 },
  flying: { normal: 1, fighting: 2, flying: 1, poison: 1, ground: 0, rock: 0.5, bug: 2, ghost: 1, steel: 0.5, fire: 1, water: 1, grass: 2, electric: 0.5, psychic: 1, ice: 1, dragon: 1, dark: 1, fairy: 1 },
  poison: { normal: 1, fighting: 1, flying: 1, poison: 0.5, ground: 0.5, rock: 0.5, bug: 0.5, ghost: 0.5, steel: 0, fire: 1, water: 1, grass: 2, electric: 1, psychic: 1, ice: 1, dragon: 1, dark: 1, fairy: 2 },
  ground: { normal: 1, fighting: 1, flying: 1, poison: 2, rock: 2, bug: 0.5, ghost: 1, steel: 2, fire: 2, water: 0.5, grass: 0.5, electric: 2, psychic: 1, ice: 1, dragon: 1, dark: 1, fairy: 1 },
  rock: { normal: 1, fighting: 0.5, flying: 2, poison: 1, ground: 0.5, rock: 0.5, bug: 2, ghost: 1, steel: 0.5, fire: 2, water: 0.5, grass: 0.5, electric: 1, psychic: 1, ice: 2, dragon: 1, dark: 1, fairy: 1 },
  bug: { normal: 1, fighting: 0.5, flying: 0.5, poison: 0.5, ground: 0.5, rock: 0.5, bug: 1, ghost: 0.5, steel: 0.5, fire: 0.5, water: 1, grass: 2, electric: 1, psychic: 2, ice: 1, dragon: 1, dark: 2, fairy: 0.5 },
  ghost: { normal: 0, fighting: 1, flying: 1, poison: 1, ground: 1, rock: 1, bug: 1, ghost: 2, steel: 1, fire: 1, water: 1, grass: 1, electric: 1, psychic: 2, ice: 1, dragon: 1, dark: 0.5, fairy: 1 },
  steel: { normal: 1, fighting: 1, flying: 1, poison: 1, ground: 1, rock: 2, bug: 1, ghost: 1, steel: 0.5, fire: 0.5, water: 0.5, grass: 1, electric: 0.5, psychic: 1, ice: 2, dragon: 1, dark: 1, fairy: 2 },
  fire: { normal: 1, fighting: 1, flying: 1, poison: 1, ground: 1, rock: 0.5, bug: 2, ghost: 1, steel: 2, fire: 0.5, water: 0.5, grass: 2, electric: 1, psychic: 1, ice: 2, dragon: 0.5, dark: 1, fairy: 1 },
  water: { normal: 1, fighting: 1, flying: 1, poison: 1, ground: 2, rock: 2, bug: 1, ghost: 1, steel: 1, fire: 2, water: 0.5, grass: 0.5, electric: 1, psychic: 1, ice: 1, dragon: 0.5, dark: 1, fairy: 1 },
  grass: { normal: 1, fighting: 1, flying: 0.5, poison: 0.5, ground: 2, rock: 2, bug: 0.5, ghost: 1, steel: 0.5, fire: 0.5, water: 2, grass: 0.5, electric: 1, psychic: 1, ice: 1, dragon: 0.5, dark: 1, fairy: 1 },
  electric: { normal: 1, fighting: 1, flying: 2, poison: 1, ground: 0, rock: 1, bug: 1, ghost: 1, steel: 1, fire: 1, water: 2, grass: 0.5, electric: 0.5, psychic: 1, ice: 1, dragon: 0.5, dark: 1, fairy: 1 },
  psychic: { normal: 1, fighting: 2, flying: 1, poison: 2, ground: 1, rock: 1, bug: 1, ghost: 1, steel: 0.5, fire: 1, water: 1, grass: 1, electric: 1, psychic: 0.5, ice: 1, dragon: 1, dark: 0, fairy: 1 },
  ice: { normal: 1, fighting: 1, flying: 2, poison: 1, ground: 2, rock: 1, bug: 1, ghost: 1, steel: 0.5, fire: 0.5, water: 0.5, grass: 2, electric: 1, psychic: 1, ice: 0.5, dragon: 2, dark: 1, fairy: 1 },
  dragon: { normal: 1, fighting: 1, flying: 1, poison: 1, ground: 1, rock: 1, bug: 1, ghost: 1, steel: 0.5, fire: 1, water: 1, grass: 1, electric: 1, psychic: 1, ice: 1, dragon: 2, dark: 1, fairy: 0 },
  dark: { normal: 1, fighting: 1, flying: 1, poison: 1, ground: 1, rock: 1, bug: 1, ghost: 2, steel: 1, fire: 1, water: 1, grass: 1, electric: 1, psychic: 2, ice: 1, dragon: 1, dark: 0.5, fairy: 0.5 },
  fairy: { normal: 1, fighting: 2, flying: 1, poison: 0.5, ground: 1, rock: 1, bug: 1, ghost: 1, steel: 0.5, fire: 0.5, water: 1, grass: 1, electric: 1, psychic: 1, ice: 1, dragon: 2, dark: 2, fairy: 1 }
};

/**
 * Calcula efectividad de tipo usando el mapa en memoria
 * Más rápido que consultar DB en cada ataque
 */
function getEffectivenessFromCache(
  attackType: string,
  defenderTypes: string[]
): number {
  const attack = attackType.toLowerCase();
  const attackMap = TYPE_EFFECTIVENESS_MAP[attack];
  
  if (!attackMap) {
    console.warn(`⚠️ Tipo de ataque desconocido: ${attackType}`);
    return 1.0;
  }
  
  let effectiveness = 1.0;
  
  for (const defender of defenderTypes) {
    const defenderName = defender.toLowerCase();
    const modifier = attackMap[defenderName] ?? 1.0;
    effectiveness *= modifier;
  }
  
  return effectiveness;
}

// Función alternativa que consulta la DB (más lenta pero actualizada)
export async function getTypeEffectivenessFromDB(
  attackTypeName: string,
  defenderTypes: string[]
): Promise<number> {
  const attackType = await getTypeByName(attackTypeName);
  
  if (!attackType) {
    console.warn(`⚠️ Tipo no encontrado: ${attackTypeName}`);
    return 1.0;
  }
  
  let effectiveness = 1.0;
  
  for (const defender of defenderTypes) {
    const defenderLower = defender.toLowerCase();
    
    if (attackType.damage_relations.to.immune.includes(defenderLower)) {
      effectiveness *= 0;
    } else if (attackType.damage_relations.to.double.includes(defenderLower)) {
      effectiveness *= 2;
    } else if (attackType.damage_relations.to.half.includes(defenderLower)) {
      effectiveness *= 0.5;
    }
  }
  
  return effectiveness;
}
