/**
 * Script para actualizar el campo sprites de la colección pokemon
 * Expande el objeto sprites para soportar sprites completos de batalla (Gen V animados)
 * 
 * Ejecutar: bun run scripts/updatePokemonSprites.ts
 */

import { MongoClient } from 'mongodb';

interface PokeAPISprite {
  front_default: string | null;
  back_default: string | null;
  front_shiny: string | null;
  back_shiny: string | null;
  front_female: string | null;
  back_female: string | null;
  front_shiny_female: string | null;
  back_shiny_female: string | null;
  versions?: {
    [key: string]: {
      [key: string]: {
        animated?: {
          front_default: string | null;
          back_default: string | null;
          front_shiny: string | null;
          back_shiny: string | null;
        };
      };
    };
  };
}

interface PokeAPIPokemon {
  id: number;
  name: string;
  sprites: PokeAPISprite;
}

interface NewSprites {
  front_default: string | null;
  back_default: string | null;
  front_shiny: string | null;
  back_shiny: string | null;
  front_female: string | null;
  back_female: string | null;
  front_shiny_female: string | null;
  back_shiny_female: string | null;
  static_front_default: string | null;
  static_back_default: string | null;
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'pokemon-patacon';

async function updatePokemonSprites() {
  console.log('🔄 Iniciando actualización de sprites...\n');

  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db(dbName);
    const pokemonCollection = db.collection('pokemon');

    // Obtener todos los Pokémon con pokeapi_id
    const allPokemon = await pokemonCollection
      .find({ pokeapi_id: { $gte: 1, $lte: 649 } })
      .project({ pokeapi_id: 1, name: 1 })
      .toArray();

    console.log(`📊 Total de Pokémon a actualizar: ${allPokemon.length}\n`);

    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < allPokemon.length; i++) {
      const pokemon = allPokemon[i];
      const { pokeapi_id, name } = pokemon;

      try {
        // Consumir PokeAPI
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeapi_id}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: PokeAPIPokemon = await response.json();
        const sprites = data.sprites;

        // Extraer sprites de Generation V Black/White animated
        const genV = sprites.versions?.['generation-v']?.['black-white']?.animated;

        // Construir nuevo objeto sprites
        const newSprites: NewSprites = {
          // Sprites animados Gen V (front/back)
          front_default: genV?.front_default || null,
          back_default: genV?.back_default || null,
          front_shiny: genV?.front_shiny || null,
          back_shiny: genV?.back_shiny || null,
          
          // Sprites female - no disponibles en Gen V animated
          front_female: null,
          back_female: null,
          front_shiny_female: null,
          back_shiny_female: null,
          
          // Sprites estáticos (fallback)
          static_front_default: sprites.front_default || null,
          static_back_default: sprites.back_default || null,
        };

        // Actualizar documento en MongoDB
        await pokemonCollection.updateOne(
          { pokeapi_id },
          {
            $set: {
              sprites: newSprites,
              updated_at: new Date()
            }
          }
        );

        updated++;
        
        // Mostrar progreso cada 50 Pokémon
        if (updated % 50 === 0 || updated === allPokemon.length) {
          console.log(`📈 Progreso: ${updated}/${allPokemon.length} actualizados`);
        }

      } catch (err) {
        errors++;
        const errorMsg = `❌ Error con Pokémon ${pokeapi_id} (${name}): ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.log(errorMsg);
        errorDetails.push(errorMsg);
      }

      // Rate limiting: pequeña pausa para no sobrecargar PokeAPI
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Resumen final
    console.log('\n' + '='.repeat(50));
    console.log('📋 RESUMEN DE ACTUALIZACIÓN');
    console.log('='.repeat(50));
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📊 Total procesados: ${allPokemon.length}`);
    console.log('='.repeat(50));

    if (errorDetails.length > 0) {
      console.log('\n📝 Detalles de errores:');
      errorDetails.forEach(e => console.log(e));
    }

    console.log('\n✨ Actualización completada!');

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Conexión MongoDB cerrada');
  }
}

// Ejecutar el script
updatePokemonSprites();