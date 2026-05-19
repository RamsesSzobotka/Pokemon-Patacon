/**
 * Script para actualizar los flags de movimientos en la colección moves
 * Agrega: charge, evasive, interruptible, fatigue
 * 
 * Ejecutar: cd backend && bun run scripts/updateMoveFlags.ts
 */

import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'pokemon-patacon';

// Movimientos de 2 turnos (carga)
const CHARGE_MOVES = [
  { moveId: 76, name: 'solar-beam' },    // Solar Beam
  { moveId: 34, name: 'fly' },            // Fly
  { moveId: 91, name: 'dig' },            // Dig
  { moveId: 37, name: 'skull-bash' },     // Skull Bash
  { moveId: 13, name: 'razor-wind' },     // Razor Wind
  { moveId: 143, name: 'sky-attack' },    // Sky Attack
  { moveId: 339, name: 'bounce' },        // Bounce
  { moveId: 291, name: 'dive' },          // Dive
  { moveId: 442, name: 'shadow-force' },  // Shadow Force
  { moveId: 475, name: 'phantom-force' }, // Phantom Force
];

// Movimientos evasivos (pueden evadir durante carga)
const EVASIVE_MOVES = [
  34,  // Fly
  91,  // Dig
  339, // Bounce
  291, // Dive
  442, // Shadow Force
];

// Movimientos que causan fatiga (recharge)
const RECHARGE_MOVES = [
  { moveId: 63, name: 'hyper-beam' },      // Hyper Beam
  { moveId: 189, name: 'giga-impact' },     // Giga Impact
  { moveId: 307, name: 'blast-burn' },     // Blast Burn
  { moveId: 438, name: 'frenzy-plant' },   // Frenzy Plant
  { moveId: 308, name: 'hydro-cannon' },   // Hydro Cannon
  { moveId: 459, name: 'roar-of-time' },   // Roar of Time
  { moveId: 506, name: 'spin-out' },       // Spin Out
];

// Movimientos interruptibles (pueden ser interrumpidos durante carga)
const INTERRUPTIBLE_MOVES = [
  76,   // Solar Beam
  34,   // Fly
  91,   // Dig
  37,   // Skull Bash
  13,   // Razor Wind
  143,  // Sky Attack
  339,  // Bounce
  291,  // Dive
  442,  // Shadow Force
  475,  // Phantom Force
  264,  // Focus Punch
];

async function updateMoveFlags() {
  console.log('🔌 Conectando a MongoDB...');
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');
    
    const db = client.db(dbName);
    const movesCollection = db.collection('moves');
    
    let totalUpdated = 0;
    const results: { moveId: number; name: string; flags: string[]; success: boolean }[] = [];
    
    // 1. Actualizar movimientos de carga (2 turnos)
    console.log('\n📦 Actualizando movimientos de carga (2 turnos)...');
    for (const move of CHARGE_MOVES) {
      const isEvasive = EVASIVE_MOVES.includes(move.moveId);
      const isInterruptible = INTERRUPTIBLE_MOVES.includes(move.moveId);
      
      const flagsToSet: any = {
        'flags.charge': true,
      };
      
      if (isEvasive) {
        flagsToSet['flags.evasive'] = true;
      }
      if (isInterruptible) {
        flagsToSet['flags.interruptible'] = true;
      }
      
      const result = await movesCollection.updateOne(
        { move_id: move.moveId },
        { $set: flagsToSet }
      );
      
      if (result.modifiedCount > 0) {
        totalUpdated++;
        const flags: string[] = ['charge'];
        if (isEvasive) flags.push('evasive');
        if (isInterruptible) flags.push('interruptible');
        
        results.push({ moveId: move.moveId, name: move.name, flags, success: true });
        console.log(`  ✅ ${move.name} (ID: ${move.moveId}) → charge, ${isEvasive ? 'evasive, ' : ''}${isInterruptible ? 'interruptible' : ''}`);
      } else {
        results.push({ moveId: move.moveId, name: move.name, flags: [], success: false });
        console.log(`  ❌ ${move.name} (ID: ${move.moveId}) no encontrado`);
      }
    }
    
    // 2. Actualizar movimientos de recarga (fatiga)
    console.log('\n⚡ Actualizando movimientos de recarga (fatiga)...');
    for (const move of RECHARGE_MOVES) {
      const result = await movesCollection.updateOne(
        { move_id: move.moveId },
        { 
          $set: {
            'flags.recharge': true,
            'flags.fatigue': true
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        totalUpdated++;
        results.push({ moveId: move.moveId, name: move.name, flags: ['recharge', 'fatigue'], success: true });
        console.log(`  ✅ ${move.name} (ID: ${move.moveId}) → recharge, fatigue`);
      } else {
        results.push({ moveId: move.moveId, name: move.name, flags: [], success: false });
        console.log(`  ❌ ${move.name} (ID: ${move.moveId}) no encontrado`);
      }
    }
    
    // 3. Verificar movimientos actualizados
    console.log('\n📊 Verificando actualizaciones...');
    const updatedMoves = await movesCollection.find({
      $or: [
        { 'flags.charge': true },
        { 'flags.recharge': true },
        { 'flags.evasive': true }
      ]
    }).toArray();
    
    console.log(`   Movimientos con flags actualizados: ${updatedMoves.length}`);
    
    // Mostrar ejemplos
    console.log('\n📝 Ejemplos de movimientos actualizados:');
    for (const move of updatedMoves.slice(0, 5)) {
      console.log(`   - ${move.names?.es || move.name} (${move.move_id}): flags =`, move.flags);
    }
    
    // Resumen
    console.log('\n' + '='.repeat(50));
    console.log(`📋 RESUMEN`);
    console.log(`   Total de movimientos actualizados: ${totalUpdated}`);
    console.log(`   - Carga (2 turnos): ${CHARGE_MOVES.length}`);
    console.log(`   - Recarga (fatiga): ${RECHARGE_MOVES.length}`);
    console.log('='.repeat(50));
    
    if (totalUpdated > 0) {
      console.log('\n✅ Script completado exitosamente!');
    } else {
      console.log('\n⚠️  Advertencia: No se actualizó ningún movimiento');
    }
    
  } catch (error) {
    console.error('\n❌ Error al ejecutar el script:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar el script
updateMoveFlags();