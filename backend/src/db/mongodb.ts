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
let typeEffectivenessCache: Record<string, Record<string, number>> | null = null;

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

export async function loadTypeEffectivenessCache(): Promise<void> {
  try {
    const types = await getAllTypes();
    
    // Si la colección está vacía, cache = null (forzar fallback a DB)
    if (types.length === 0) {
      console.warn('⚠️ Colección types vacía — cache deshabilitado, se usará fallback a DB');
      typeEffectivenessCache = null;
      return;
    }

    const cache: Record<string, Record<string, number>> = {};

    for (const type of types) {
      const attackName = type.name.toLowerCase();
      const relations: Record<string, number> = {};

      for (const defender of type.damage_relations.to.double) {
        relations[defender.toLowerCase()] = 2;
      }
      for (const defender of type.damage_relations.to.half) {
        relations[defender.toLowerCase()] = 0.5;
      }
      for (const defender of type.damage_relations.to.immune) {
        relations[defender.toLowerCase()] = 0;
      }

      cache[attackName] = relations;
    }

    typeEffectivenessCache = cache;
    console.log(`✅ Cache de efectividad de tipos cargado (${Object.keys(cache).length} tipos)`);
  } catch (error) {
    console.error('❌ Error cargando cache de efectividad de tipos:', error);
    typeEffectivenessCache = null;
  }
}

export async function ensureTypeEffectivenessCache(): Promise<void> {
  if (!typeEffectivenessCache) {
    await loadTypeEffectivenessCache();
  } else {
    console.log('✅ Cache de efectividad de tipos ya cargado');
  }
}

/**
 * Valida y loguea el estado de la colección types para diagnóstico
 * Verifica:
 * - Cantidad de tipos cargados
 * - Ejemplos de relaciones de daño
 * - Si el cache está disponible
 */
export async function validateTypeEffectivenessData(): Promise<void> {
  try {
    const types = await getAllTypes();
    console.log(`\n📊 VALIDACIÓN DE TIPOS - Resumen:\n` +
      `   • Tipos en DB: ${types.length}\n` +
      `   • Cache disponible: ${typeEffectivenessCache ? 'SÍ' : 'NO'}`);

    if (types.length > 0) {
      // Mostrar ejemplos
      const fireType = types.find(t => t.name.toLowerCase() === 'fire');
      const waterType = types.find(t => t.name.toLowerCase() === 'water');
      
      if (fireType) {
        console.log(`\n🔥 Ejemplo - Tipo Fire:\n` +
          `   Súper efectivo contra: ${fireType.damage_relations.to.double.join(', ')}\n` +
          `   Poco efectivo contra: ${fireType.damage_relations.to.half.join(', ')}\n` +
          `   Inmune a: ${fireType.damage_relations.to.immune.join(', ') || 'ninguno'}`);
      }
      
      if (waterType) {
        console.log(`\n💧 Ejemplo - Tipo Water:\n` +
          `   Súper efectivo contra: ${waterType.damage_relations.to.double.join(', ')}\n` +
          `   Poco efectivo contra: ${waterType.damage_relations.to.half.join(', ')}\n` +
          `   Inmune a: ${waterType.damage_relations.to.immune.join(', ') || 'ninguno'}`);
      }
      
      // Verificar que un ataque sea correcto (Water -> Fire debe ser súper efectivo)
      if (waterType) {
        const isEffectiveAgainstFire = waterType.damage_relations.to.double.includes('fire');
        console.log(`\n✓ Water es súper efectivo contra Fire: ${isEffectiveAgainstFire ? 'CORRECTO ✅' : 'ERROR ❌'}`);
      }
    }
    
    console.log('✅ Validación de tipos completada\n');
  } catch (error) {
    console.error('❌ Error en validación de tipos:', error);
  }
}

/**
 * Calcula la efectividad de un tipo ataque contra uno o dos tipos defensores
 * Retorna: 0, 0.25, 0.5, 1.0, 2.0, o 4.0 (para tipos duales)
 */
export async function getTypeEffectiveness(
  attackTypeName: string,
  defenderTypes: string[]
): Promise<number> {
  // 1. Intentar desde el cache en memoria (rápido)
  const cached = getEffectivenessFromCache(attackTypeName, defenderTypes);
  if (cached !== null) {
    return cached;
  }

  // 2. Fallback: consultar DB directamente
  console.warn(`⚠️ Cache de tipos no disponible, consultando DB para ${attackTypeName}`);
  return await getTypeEffectivenessFromDB(attackTypeName, defenderTypes);
}

/**
 * Consulta el cache en memoria.
 * Retorna null si el cache no está disponible (para que el caller caiga a DB).
 */
function getEffectivenessFromCache(
  attackType: string,
  defenderTypes: string[]
): number | null {
  // Cache no cargado → null (el caller usará DB)
  if (!typeEffectivenessCache) {
    return null;
  }

  const attack = attackType.toLowerCase();
  const attackMap = typeEffectivenessCache[attack];
  
  if (!attackMap) {
    console.warn(`⚠️ Tipo de ataque "${attackType}" no encontrado en cache`);
    return null;
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
