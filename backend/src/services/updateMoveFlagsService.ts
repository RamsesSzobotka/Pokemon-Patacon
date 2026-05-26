/**
 * Service para actualizar los flags de movimientos en la colección moves
 * Agrega: charge, evasive, interruptible, recharge, fatigue
 *
 * Puede ejecutarse tanto desde el boot del servidor como desde el script standalone.
 *
 * NOTA: Solo los movimientos de recarga (Hyper Beam, Giga Impact, etc.) reciben
 * `flags.fatigue`. Los movimientos de carga (2 turnos como Fly, Solar Beam, Dig)
 * NO tienen fatiga en canon — solo reciben charge, evasive e interruptible.
 */

import { getMovesCollection } from '../db/mongodb';

// ============================================
// CONSTANTES DE MOVIMIENTOS
// ============================================

/** Movimientos de 2 turnos (carga) que reciben flags.charge = true */
export const CHARGE_MOVES = [
  { moveId: 76, name: 'solar-beam' },    // Solar Beam     — Rayo Solar (76)
  { moveId: 19, name: 'fly' },            // Fly             — Vuelo (19)
  { moveId: 91, name: 'dig' },            // Dig             — Excavar (91)
  { moveId: 130, name: 'skull-bash' },    // Skull Bash      — Cabezazo (130)
  { moveId: 13, name: 'razor-wind' },     // Razor Wind      — Viento Cortante (13)
  { moveId: 143, name: 'sky-attack' },    // Sky Attack      — Ataque Aéreo (143)
  { moveId: 340, name: 'bounce' },        // Bounce          — Bote (340)
  { moveId: 291, name: 'dive' },          // Dive            — Buceo (291)
  { moveId: 467, name: 'shadow-force' },  // Shadow Force    — Golpe Umbrío (467)
  { moveId: 566, name: 'phantom-force' }, // Phantom Force   — Golpe Fantasma (566)
];

/** IDs de movimientos evasivos (pueden evadir durante carga) */
export const EVASIVE_IDS = new Set([
  19,  // Fly
  91,  // Dig
  340, // Bounce
  291, // Dive
  467, // Shadow Force
]);

/** IDs de movimientos interruptibles (pueden ser interrumpidos durante carga) */
export const INTERRUPTIBLE_IDS = new Set([
  76,   // Solar Beam
  19,   // Fly
  91,   // Dig
  130,  // Skull Bash
  13,   // Razor Wind
  143,  // Sky Attack
  340,  // Bounce
  291,  // Dive
  467,  // Shadow Force
  566,  // Phantom Force
  264,  // Focus Punch
]);

/** Movimientos de recarga (fatiga tipo recharge) — ÚNICOS con fatigue en canon */
export const RECHARGE_MOVES = [
  { moveId: 63, name: 'hyper-beam' },      // Hyper Beam     — Hiperrayo (63)
  { moveId: 416, name: 'giga-impact' },     // Giga Impact    — Gigaimpacto (416)
  { moveId: 307, name: 'blast-burn' },     // Blast Burn     — Anillo Ígneo (307)
  { moveId: 338, name: 'frenzy-plant' },   // Frenzy Plant   — Planta Feroz (338)
  { moveId: 308, name: 'hydro-cannon' },   // Hydro Cannon   — Hidrocañón (308)
  { moveId: 459, name: 'roar-of-time' },   // Roar of Time   — Distorsión (459)
];

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

export interface UpdateFlagsResult {
  totalUpdated: number;
  chargeUpdated: number;
  rechargeUpdated: number;
  details: { moveId: number; name: string; flags: string[]; success: boolean }[];
}

/**
 * Actualiza los flags de todos los movimientos especiales en la DB.
 * Es idempotente: si los flags ya existen, no modifica nada (modifiedCount = 0).
 *
 * También limpia cualquier `flags.fatigue` que haya quedado incorrectamente
 * en movimientos de carga (no deben tener fatiga en canon).
 *
 * Se conecta usando getMovesCollection() que usa el pool de conexión existente.
 */
export async function updateMoveFlags(): Promise<UpdateFlagsResult> {
  console.log('[updateMoveFlags] Actualizando flags de movimientos...');

  const movesCollection = getMovesCollection();
  let totalUpdated = 0;
  const details: UpdateFlagsResult['details'] = [];

  // ──────────────────────────────────────────
  // 0. Limpieza: remover fatigue de movimientos de carga
  //    (en canon, ningún ataque de 2 turnos causa fatiga)
  // ──────────────────────────────────────────
  const chargeMoveIds = CHARGE_MOVES.map(m => m.moveId);
  const cleanupResult = await movesCollection.updateMany(
    {
      move_id: { $in: chargeMoveIds },
      'flags.fatigue': { $in: [true, false] },
    },
    {
      $unset: { 'flags.fatigue': '' },
    }
  );
  if (cleanupResult.modifiedCount > 0) {
    console.log(`  🧹 Limpiados flags.fatigue de ${cleanupResult.modifiedCount} movimientos de carga`);
  }

  // ──────────────────────────────────────────
  // 1. Movimientos de carga (2 turnos)
  //    Flags: charge, opcionalmente evasive + interruptible
  // ──────────────────────────────────────────
  console.log('[updateMoveFlags] Movimientos de carga (2 turnos)...');
  let chargeUpdated = 0;

  for (const move of CHARGE_MOVES) {
    const isEvasive = EVASIVE_IDS.has(move.moveId);
    const isInterruptible = INTERRUPTIBLE_IDS.has(move.moveId);

    const flagsToSet: Record<string, boolean> = {
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

    if (result.modifiedCount > 0 || result.matchedCount > 0) {
      if (result.modifiedCount > 0) totalUpdated++;
      chargeUpdated++;
      const flags: string[] = ['charge'];
      if (isEvasive) flags.push('evasive');
      if (isInterruptible) flags.push('interruptible');

      details.push({ moveId: move.moveId, name: move.name, flags, success: true });
      console.log(`  ✅ ${move.name} (ID: ${move.moveId}) → ${flags.join(', ')}`);
    } else {
      details.push({ moveId: move.moveId, name: move.name, flags: [], success: false });
      console.log(`  ❌ ${move.name} (ID: ${move.moveId}) no encontrado`);
    }
  }

  // ──────────────────────────────────────────
  // 2. Movimientos de recarga (fatiga tipo recharge)
  //    Flags: recharge + fatigue
  // ──────────────────────────────────────────
  console.log('[updateMoveFlags] Movimientos de recarga (fatiga)...');
  let rechargeUpdated = 0;

  for (const move of RECHARGE_MOVES) {
    const result = await movesCollection.updateOne(
      { move_id: move.moveId },
      {
        $set: {
          'flags.recharge': true,
          'flags.fatigue': true,
        },
      }
    );

    if (result.modifiedCount > 0 || result.matchedCount > 0) {
      if (result.modifiedCount > 0) totalUpdated++;
      rechargeUpdated++;
      details.push({ moveId: move.moveId, name: move.name, flags: ['recharge', 'fatigue'], success: true });
      console.log(`  ✅ ${move.name} (ID: ${move.moveId}) → recharge, fatigue`);
    } else {
      details.push({ moveId: move.moveId, name: move.name, flags: [], success: false });
      console.log(`  ❌ ${move.name} (ID: ${move.moveId}) no encontrado`);
    }
  }

  // ──────────────────────────────────────────
  // RESUMEN
  // ──────────────────────────────────────────
  console.log('');
  console.log('='.repeat(50));
  console.log('📋 RESUMEN updateMoveFlags');
  console.log(`   Total modificados: ${totalUpdated}`);
  console.log(`   - Carga (2 turnos): ${chargeUpdated}`);
  console.log(`   - Recarga (recharge): ${rechargeUpdated}`);
  console.log('='.repeat(50));

  return {
    totalUpdated,
    chargeUpdated,
    rechargeUpdated,
    details,
  };
}
