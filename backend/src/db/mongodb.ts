import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;
let pokemonCollection: Collection | null = null;
let movesCollection: Collection | null = null;

// Estados de validación de movimientos
export const PRIMARY_AILMENTS = ['paralysis', 'sleep', 'poison', 'burn', 'freeze'];
export const VALID_DAMAGE_CLASSES = ['physical', 'special', 'status'];

export async function connectDB(): Promise<Db> {
  if (db) {
    console.log('✅ MongoDB ya conectada');
    return db;
  }

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'pokemon-patacon';

    console.log(`🔌 Conectando a MongoDB: ${mongoUri}`);

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
    console.error('❌ Error conectando a MongoDB:', error);
    throw error;
  }
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

/**
 * Valida si un movimiento es válido para combate
 * Permite: movimientos con daño (physical/special) O movimientos que aplican estado primario
 * Excluye: solo stat changes, status sin efecto útil
 */
export function isMoveValidForCombat(move: any): { isValid: boolean; reason?: string } {
  const hasDamage = ['physical', 'special'].includes(move.damage_class) && 
                   move.power !== null && move.power > 0;

  const hasPrimaryAilment = move.meta?.ailment && 
                            PRIMARY_AILMENTS.includes(move.meta.ailment) &&
                            (move.meta?.ailment_chance || 0) > 0;

  // Válido si tiene daño O aplica estado primario
  if (hasDamage || hasPrimaryAilment) {
    return { isValid: true };
  }

  // Excluir: solo cambios de stats (buff/debuff puro)
  if (move.damage_class === 'status' && 
      move.meta?.stat_changes?.length > 0 && 
      !move.meta?.ailment) {
    return { isValid: false, reason: 'Solo modifica estadísticas sin estado primario' };
  }

  // Excluir: status sin efecto útil
  if (move.damage_class === 'status' && 
      !move.power && 
      (!move.meta?.stat_changes?.length) && 
      !move.meta?.ailment) {
    return { isValid: false, reason: 'Status sin efecto de combate' };
  }

  return { isValid: false, reason: 'No cumple criterios de validez' };
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
