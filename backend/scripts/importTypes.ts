/**
 * Script para importar tipos de Pokémon desde PokeAPI y guardarlos en MongoDB
 * Incluye los 18 tipos (Gen V + Fairy) con relaciones de daño en español
 * 
 * Ejecutar: bun run scripts/importTypes.ts
 */

import { MongoClient, Collection } from 'mongodb';

interface PokeAPIType {
  id: number;
  name: string;
  names: Array<{
    language: { name: string };
    name: string;
  }>;
  damage_relations: {
    double_damage_to: Array<{ name: string }>;
    half_damage_to: Array<{ name: string }>;
    no_damage_to: Array<{ name: string }>;
    double_damage_from: Array<{ name: string }>;
    half_damage_from: Array<{ name: string }>;
    no_damage_from: Array<{ name: string }>;
  };
}

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

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'pokemon-patacon';

async function importTypes() {
  console.log('🔄 Iniciando importación de tipos de Pokémon...\n');

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db(dbName);
    const typesCollection = db.collection<TypeDocument>('types');

    // IDs de los 18 tipos en PokeAPI
    const typeIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    console.log(`📊 Importando ${typeIds.length} tipos desde PokeAPI...\n`);

    for (const typeId of typeIds) {
      try {
        console.log(`  ⏳ Obteniendo tipo ${typeId}...`);
        
        const response = await fetch(`https://pokeapi.co/api/v2/type/${typeId}/`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: PokeAPIType = await response.json();

        // Extraer nombres en español e inglés
        const nameEs = data.names.find(n => n.language.name === 'es')?.name || data.name;
        const nameEn = data.names.find(n => n.language.name === 'en')?.name || data.name;

        // Transformar relaciones de daño
        const typeDocument: TypeDocument = {
          type_id: data.id,
          name: data.name,
          names: {
            es: nameEs,
            en: nameEn
          },
          damage_relations: {
            to: {
              double: data.damage_relations.double_damage_to.map(d => d.name),
              half: data.damage_relations.half_damage_to.map(d => d.name),
              immune: data.damage_relations.no_damage_to.map(d => d.name)
            },
            from: {
              double: data.damage_relations.double_damage_from.map(d => d.name),
              half: data.damage_relations.half_damage_from.map(d => d.name),
              immune: data.damage_relations.no_damage_from.map(d => d.name)
            }
          },
          imported_at: new Date()
        };

        // Upsert - insertar o actualizar
        const result = await typesCollection.updateOne(
          { type_id: typeId },
          { $set: typeDocument },
          { upsert: true }
        );

        if (result.upsertedCount) {
          inserted++;
          console.log(`  ✅ Insertado: ${nameEs} (${data.name})`);
        } else {
          updated++;
          console.log(`  🔄 Actualizado: ${nameEs} (${data.name})`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (err) {
        errors++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.log(`  ❌ Error con tipo ${typeId}: ${errorMsg}`);
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(50));
    console.log('📋 RESUMEN DE IMPORTACIÓN DE TIPOS');
    console.log('='.repeat(50));
    console.log(`✅ Insertados: ${inserted}`);
    console.log(`🔄 Actualizados: ${updated}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📊 Total procesados: ${typeIds.length}`);
    console.log('='.repeat(50));

    // Mostrar tipos guardados
    console.log('\n📝 Tipos en base de datos:');
    const allTypes = await typesCollection.find({}).sort({ type_id: 1 }).toArray();
    allTypes.forEach(t => {
      const relations = t.damage_relations;
      console.log(`  ${t.type_id}. ${t.names.es} (${t.name})`);
      console.log(`     → Doble a: ${relations.to.double.join(', ') || 'ninguno'}`);
      console.log(`     → Resiste: ${relations.to.half.join(', ') || 'ninguno'}`);
      console.log(`     → Inmune a: ${relations.to.immune.join(', ') || 'ninguno'}`);
    });

    console.log('\n✨ Importación completada!');

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Conexión MongoDB cerrada');
  }
}

// Ejecutar el script
importTypes();