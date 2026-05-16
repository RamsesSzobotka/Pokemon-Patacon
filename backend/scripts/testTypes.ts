/**
 * Script de prueba para verificar funciones de tipos
 */
import { connectDB, getAllTypes, getTypeByName, getTypeEffectiveness, getTypeEffectivenessFromDB } from '../src/db/mongodb';

async function testTypes() {
  // Conectar a la base de datos primero
  await connectDB();
  
  console.log('🧪 Probando funciones de tipos...\n');

  // Probar getAllTypes
  const types = await getAllTypes();
  console.log(`✅ getAllTypes(): ${types.length} tipos encontrados`);
  
  // Probar getTypeByName
  const fire = await getTypeByName('fire');
  console.log(`✅ getTypeByName('fire'): ${fire?.names.es} (${fire?.name})`);
  
  // Probar getTypeEffectiveness (sincrónico, cache)
  const tests = [
    { attack: 'fire', defend: ['grass'], expected: 2 },
    { attack: 'fire', defend: ['water'], expected: 0.5 },
    { attack: 'water', defend: ['fire'], expected: 2 },
    { attack: 'electric', defend: ['ground'], expected: 0 },
    { attack: 'dragon', defend: ['fairy'], expected: 0 },
    { attack: 'fire', defend: ['grass', 'water'], expected: 1 }, // 2 * 0.5 = 1
    { attack: 'fire', defend: ['bug', 'steel'], expected: 4 }, // 2 * 2 = 4
    // Tests adicionales para debug
    { attack: 'electric', defend: ['water'], expected: 2 },
    { attack: 'ground', defend: ['electric'], expected: 2 },
  ];

  console.log('\n📊 Pruebas de efectividad (cache):');
  for (const test of tests) {
    const result = getTypeEffectiveness(test.attack, test.defend);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`  ${status} ${test.attack} vs ${test.defend.join(',')}: ${result} (esperado: ${test.expected})`);
  }

  // Probar getTypeEffectivenessFromDB (asincrónico)
  console.log('\n📊 Pruebas de efectividad (DB):');
  const dbResult = await getTypeEffectivenessFromDB('fire', ['grass']);
  console.log(`  ✅ fire vs grass (DB): ${dbResult}`);

  console.log('\n✨ Pruebas completadas!');
}

testTypes().catch(console.error);