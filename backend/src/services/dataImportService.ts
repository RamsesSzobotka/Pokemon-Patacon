/**
 * Servicio unificado de importación de datos desde PokeAPI
 * Se ejecuta al iniciar el backend para verificar y cargar datos si no existen
 * 
 * Datos importados:
 * - Tipos (18 tipos con relaciones de daño)
 * - Movimientos (solo los útiles para batalla)
 * - Pokémons (649 de Gen I-V)
 * 
 * Filtro de movimientos:
 * - GUARDAR si: hace daño, aplica efecto, o cambia estadísticas (excepto evasion/accuracy)
 * - EXCEPCIONES: transform y metronome siempre se guardan
 * - ELIMINAR: Pokemon con move_id = 0
 */

import axios from 'axios';
import {
  getPokemonCollection,
  getMovesCollection,
  getTypesCollection,
  insertPokemon,
  insertMovesBatch
} from '../db/mongodb';

const POKEAPI_BASE = process.env.POKEAPI_BASE_URL || 'https://pokeapi.co/api/v2';
const POKEAPI_ASSETS = process.env.POKEAPI_ASSETS_URL || 'https://raw.githubusercontent.com/PokeAPI/sprites/master';

// IDs de tipos en PokeAPI (Gen V + Fairy)
const TYPE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// Pokémons válidos: Gen I-V (1-649)
const POKEMON_IDS = Array.from({ length: 649 }, (_, i) => i + 1);

interface ImportStats {
  types: { existing: number; imported: number };
  moves: { existing: number; imported: number };
  pokemon: { existing: number; imported: number; cleaned: number };
  errors: string[];
}

const stats: ImportStats = {
  types: { existing: 0, imported: 0 },
  moves: { existing: 0, imported: 0 },
  pokemon: { existing: 0, imported: 0, cleaned: 0 },
  errors: []
};

const SPECIAL_MOVES = ['transform', 'metronome'];
const EXCLUDED_STATS = ['evasion', 'accuracy'];

function shouldSaveMove(move: any): boolean {
  const moveName = move.name.toLowerCase().replace(/-/g, ' ');
  
  if (SPECIAL_MOVES.includes(moveName)) {
    return true;
  }
  
  const hasDamage = move.power && move.power > 0;
  
  const hasAilment = move.meta?.ailment && 
                     move.meta.ailment.name !== 'none' && 
                     move.meta.ailment_chance > 0;
  
  const hasStatChanges = move.stat_changes && move.stat_changes.length > 0;
  const hasValidStatChanges = hasStatChanges && move.stat_changes.some((sc: any) => 
    !EXCLUDED_STATS.includes(sc.stat.name)
  );
  
  return hasDamage || hasAilment || hasValidStatChanges;
}

/**
 * Punto de entrada principal - importa todos los datos si no existen
 */
export async function importAllData(): Promise<ImportStats> {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 INICIANDO IMPORTACIÓN DE DATOS DESDE POKEAPI');
  console.log('='.repeat(60));

  try {
    // 1. Importar tipos si no existen
    await importTypesIfNeeded();

    // 2. Verificar movimientos (se cargan con cada Pokémon)
    await checkMovesStatus();

    // 3. Importar pokemones si no existen
    await importPokemonIfNeeded();

    // Mostrar resumen final
    printSummary();

  } catch (error) {
    console.error('❌ Error en importación:', error);
    stats.errors.push(`Error general: ${error}`);
  }

  return stats;
}

/**
 * 1. Importar tipos desde PokeAPI si no existen en la BD
 */
async function importTypesIfNeeded(): Promise<void> {
  console.log('\n📦 Verificando tipos en base de datos...');

  const typesCollection = getTypesCollection();
  const existingTypes = await typesCollection.countDocuments();

  if (existingTypes > 0) {
    stats.types.existing = existingTypes;
    console.log(`✅ Ya existen ${existingTypes} tipos en BD - omitiendo importación`);
    return;
  }

  console.log(`🔄 Importando ${TYPE_IDS.length} tipos desde PokeAPI...`);

  for (const typeId of TYPE_IDS) {
    try {
      const response = await axios.get(`${POKEAPI_BASE}/type/${typeId}`, { timeout: 10000 });
      const data = response.data;

      // Extraer nombres en español e inglés
      const nameEs = data.names.find((n: any) => n.language.name === 'es')?.name || data.name;
      const nameEn = data.names.find((n: any) => n.language.name === 'en')?.name || data.name;

      const typeDocument = {
        type_id: data.id,
        name: data.name,
        names: { es: nameEs, en: nameEn },
        damage_relations: {
          to: {
            double: data.damage_relations.double_damage_to.map((d: any) => d.name),
            half: data.damage_relations.half_damage_to.map((d: any) => d.name),
            immune: data.damage_relations.no_damage_to.map((d: any) => d.name)
          },
          from: {
            double: data.damage_relations.double_damage_from.map((d: any) => d.name),
            half: data.damage_relations.half_damage_from.map((d: any) => d.name),
            immune: data.damage_relations.no_damage_from.map((d: any) => d.name)
          }
        },
        imported_at: new Date()
      };

      await typesCollection.updateOne(
        { type_id: typeId },
        { $set: typeDocument },
        { upsert: true }
      );

      stats.types.imported++;
      console.log(`  ✅ ${nameEs} (${data.name})`);

      // Rate limiting
      await sleep(50);
    } catch (error) {
      const msg = `Error importando tipo ${typeId}: ${error}`;
      stats.errors.push(msg);
      console.log(`  ❌ ${msg}`);
    }
  }

  console.log(`✅ Tipos importados: ${stats.types.imported}`);
}

/**
 * 2. Verificar estado de movimientos en la BD
 */
async function checkMovesStatus(): Promise<void> {
  console.log('\n📦 Verificando movimientos en base de datos...');

  const movesCollection = getMovesCollection();
  const existingMoves = await movesCollection.countDocuments();

  stats.moves.existing = existingMoves;
  console.log(`✅ ${existingMoves} movimientos en la base de datos`);
}

/**
 * 3. Importar/actualizar pokemones
 * Siempre reprocesa todos los Pokemon (nuevos y existentes)
 * - Importa Pokemon nuevos
 * - Actualiza movimientos de Pokemon existentes
 * - Limpia Pokemon con move_id = 0
 * - Agrega sprites icons
 */
async function importPokemonIfNeeded(): Promise<void> {
  console.log('\n📦 Procesando pokemones...');

  const pokemonCollection = getPokemonCollection();
  let imported = 0;
  let skipped = 0;

  console.log('🔄 Verificando pokemones...\n');

  for (let i = 0; i < POKEMON_IDS.length; i++) {
    const pokeId = POKEMON_IDS[i];
    const isLastPokemon = i === POKEMON_IDS.length - 1;
    
    try {
      // 1. Verificar si el pokémon ya existe
      const existingPokemon = await pokemonCollection.findOne({ pokeapi_id: pokeId });
      
      if (existingPokemon) {
        console.log(`  ⏭️ [${pokeId}] ${existingPokemon.name} - omitido`);
        skipped++;
        continue;
      } else {
        // El pokémon no existe → importar todo
        const pokemonResponse = await axios.get(`${POKEAPI_BASE}/pokemon/${pokeId}`, { timeout: 10000 });
        const pokemonData = pokemonResponse.data;

        // Obtener generación y nombre en español desde species
        const speciesResponse = await axios.get(pokemonData.species.url, { timeout: 10000 });
        const speciesData = speciesResponse.data;
        const generation = extractGenerationNumber(speciesData.generation.url);
        
        // Extraer nombre en español
        const nameEs = speciesData.names?.find((n: any) => n.language.name === 'es')?.name || pokemonData.name;

        // Obtener movimientos filtrados del Pokémon
        const moveIds = await fetchAndSaveMoves(pokemonData.moves, pokemonData.name);
        
        // Limpiar move_ids con valor 0
        const cleanMoveIds = moveIds.filter(id => id !== 0);
        
        if (cleanMoveIds.length !== moveIds.length) {
          cleaned += (moveIds.length - cleanMoveIds.length);
        }

        const isLegendary = speciesData.is_legendary === true;
        const isMythical = speciesData.is_mythical === true;

        // Obtener sprites (incluir icons)
        const sprites = extractSprites(pokemonData.sprites, pokeId);

        const pokemonDoc = {
          pokeapi_id: pokeId,
          name: pokemonData.name,
          name_es: nameEs,
          generation,
          types: pokemonData.types.map((t: any) => t.type.name.toLowerCase()),
          stats: {
            hp: pokemonData.stats[0]?.base_stat || 0,
            attack: pokemonData.stats[1]?.base_stat || 0,
            defense: pokemonData.stats[2]?.base_stat || 0,
            sp_attack: pokemonData.stats[3]?.base_stat || 0,
            sp_defense: pokemonData.stats[4]?.base_stat || 0,
            speed: pokemonData.stats[5]?.base_stat || 0
          },
          base_experience: pokemonData.base_experience || 0,
          is_legendary: isLegendary,
          is_mythical: isMythical,
          move_ids: cleanMoveIds,
          sprites: sprites,
          height_dm: pokemonData.height,
          weight_hg: pokemonData.weight,
          cached_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await insertPokemon(pokemonDoc);
        console.log(`  ✅ [${pokeId}] ${nameEs} (${pokemonData.name}) - agregado`);
        imported++;
      }

      // Rate limiting (menor para mayor velocidad)
      await sleep(30);
    } catch (error) {
      const msg = `Error procesando pokémon ${pokeId}: ${error}`;
      stats.errors.push(msg);
      console.log(`  ❌ ${msg}`);
    }
  }

  stats.pokemon.imported = imported;
  stats.pokemon.existing = skipped;
  
  console.log(`\n\n✅ Proceso completado`);
  console.log(`   📥 Nuevos: ${imported}`);
  console.log(`   ⏭️  Omitidos: ${skipped}`);
}

/**
 * Extrae los sprites del Pokémon, incluyendo icons
 */
function extractSprites(sprites: any, pokeId: number): any {
  return {
    front_default: sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default || null,
    back_default: sprites.versions?.['generation-v']?.['black-white']?.animated?.back_default || null,
    front_shiny: sprites.versions?.['generation-v']?.['black-white']?.animated?.front_shiny || null,
    back_shiny: sprites.versions?.['generation-v']?.['black-white']?.animated?.back_shiny || null,
    front_female: null,
    back_female: null,
    front_shiny_female: null,
    back_shiny_female: null,
    static_front_default: sprites.front_default || null,
    static_back_default: sprites.back_default || null,
    icon: `${POKEAPI_ASSETS}/sprites/pokemon/${pokeId}.png`
  };
}

/**
 * Fetch y guarda los movimientos útiles de un pokémon
 * Filtra según reglas: daño, ailment, o cambios de stat válidos
 * Excepciones: transform y metronome siempre se guardan
 * @param moves - Lista de movimientos del pokémon desde PokeAPI
 * @param pokemonName - Nombre del pokémon para logging
 */
async function fetchAndSaveMoves(moves: any[], pokemonName: string): Promise<number[]> {
  const moveIds: number[] = [];
  const seenMoveIds = new Set<number>();
  const movesToInsert: any[] = [];
  const validMovesCount = { total: 0, kept: 0 };

  for (const moveData of moves) {
    try {
      const moveResponse = await axios.get(moveData.move.url, { timeout: 5000 });
      const move = moveResponse.data;
      const moveId = move.id;

      if (seenMoveIds.has(moveId)) continue;
      seenMoveIds.add(moveId);
      validMovesCount.total++;

      // FILTRO: Verificar si el movimiento debe guardarse
      if (!shouldSaveMove(move)) {
        continue;
      }

      validMovesCount.kept++;
      moveIds.push(moveId);

      // Extraer nombres en español, inglés, japonés
      const names = extractMoveNames(move.names || []);
      
      // Extraer descripción (español > inglés)
      const description = extractMoveDescription(move.flavor_text_entries || []);

      // Obtener campos adicionales del meta
      const critRate = move.meta?.crit_rate || 0;
      const drain = move.meta?.drain || 0;
      const healing = move.meta?.heal || 0;
      const statChance = move.meta?.stat_chance || 0;
      const flinchChance = move.meta?.flinch_chance || 0;
      
      // Campos de hits y turns (para movimientos de múltiples turnos/golpes)
      const maxHits = move.meta?.max_hits || null;
      const minHits = move.meta?.min_hits || null;
      const maxTurns = move.meta?.max_turns || null;
      const minTurns = move.meta?.min_turns || null;

      const normalizedMove = {
        move_id: moveId,
        name: move.name.replace(/-/g, ' ').toLowerCase(),
        names: names,
        type: move.type.name.toLowerCase(),
        damage_class: move.damage_class?.name || 'status',
        power: move.power || null,
        accuracy: move.accuracy || null,
        pp: move.pp || 5,
        priority: move.priority || 0,
        target: move.target?.name || 'selected-pokemon',
        description: description,
        meta: {
          ailment: move.meta?.ailment?.name || null,
          ailment_chance: move.meta?.ailment_chance || 0,
          stat_changes: (move.stat_changes || []).map((sc: any) => ({
            stat: sc.stat.name,
            change: sc.change
          })),
          crit_rate: critRate,
          drain: drain,
          flinch_chance: flinchChance,
          healing: healing,
          max_hits: maxHits,
          min_hits: minHits,
          max_turns: maxTurns,
          min_turns: minTurns,
          stat_chance: statChance,
          heal: healing
        },
        flags: {
          contact: move.flags?.contact || false,
          recharge: move.flags?.recharge || false,
          protect: move.flags?.protect || false,
          mirror: move.flags?.mirror_move || false,
          sound: move.flags?.sound || false
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      movesToInsert.push(normalizedMove);
    } catch (error) {
      // Silencioso - no detener por un move fallido
    }
  }

  // Insertar movimientos filtrados en batch
  if (movesToInsert.length > 0) {
    try {
      await insertMovesBatch(movesToInsert);
      stats.moves.imported += movesToInsert.length;
    } catch (error) {
      console.warn(`⚠️ Error guardando movimientos en batch: ${error}`);
    }
  }

  moveIds.sort((a, b) => a - b);
  return moveIds;
}

/**
 * Extrae el número de generación desde la URL
 */
function extractGenerationNumber(url: string): number {
  const match = url.match(/\/(\d+)\//);
  return match ? parseInt(match[1]) : 1;
}

/**
 * Extrae nombres del movimiento (es, en, ja)
 */
function extractMoveNames(names: any[]): { es: string; en: string; ja: string } {
  let esName = '';
  let enName = '';
  let jaName = '';

  for (const nameEntry of names) {
    switch (nameEntry.language.name) {
      case 'es': esName = nameEntry.name; break;
      case 'en': enName = nameEntry.name; break;
      case 'ja': jaName = nameEntry.name; break;
    }
  }

  return { es: esName || '', en: enName || '', ja: jaName || '' };
}

/**
 * Extrae descripción del movimiento (prioridad: español > inglés)
 */
function extractMoveDescription(flavorTextEntries: any[]): string | null {
  let descES = null;
  let descEN = null;

  for (const entry of flavorTextEntries) {
    if (entry.language.name === 'es') {
      descES = entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    } else if (entry.language.name === 'en' && !descEN) {
      descEN = entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  return descES || descEN || null;
}

/**
 * Utility: sleep para rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Imprime el resumen final de la importación
 */
function printSummary(): void {
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMEN DE IMPORTACIÓN');
  console.log('='.repeat(60));
  console.log(`📦 Tipos:`);
  console.log(`   - Existentes: ${stats.types.existing}`);
  console.log(`   - Importados: ${stats.types.imported}`);
  console.log(`\n📦 Movimientos:`);
  console.log(`   - Existentes: ${stats.moves.existing}`);
  console.log(`   - Nuevos agregados: ${stats.moves.imported}`);
  console.log(`\n📦 Pokemones:`);
  console.log(`   - Importados: ${stats.pokemon.imported}`);
  console.log(`   - Actualizados: ${stats.pokemon.existing}`);
  console.log(`   - Move_ids limpiados (0): ${stats.pokemon.cleaned}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️ Errores: ${stats.errors.length}`);
    stats.errors.forEach(e => console.log(`   - ${e}`));
  }

  console.log('='.repeat(60));
  console.log('✨ Importación completada!');
  console.log('='.repeat(60) + '\n');
}