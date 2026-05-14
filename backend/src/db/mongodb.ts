import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;
let pokemonCollection: Collection | null = null;

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

async function initializeIndexes() {
  const collection = getPokemonCollection();

  try {
    // Índices para búsquedas rápidas
    await collection.createIndex({ pokeapi_id: 1 }, { unique: true });
    await collection.createIndex({ name: 1 });
    await collection.createIndex({ generation: 1 });
    await collection.createIndex({ is_legendary: 1 });
    await collection.createIndex({ is_mythical: 1 });
    await collection.createIndex({ types: 1 });
    await collection.createIndex({ cached_at: 1 });

    // Índice de texto para búsqueda por nombre
    await collection.createIndex({ name: 'text' });

    console.log('✅ Índices de MongoDB creados');
  } catch (error) {
    // Los índices pueden existir ya
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
