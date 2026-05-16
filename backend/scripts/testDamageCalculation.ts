/**
 * Test del Cálculo de Daño - Tarea 3
 */
import { calculateDamage, applyAilment, hasAilment } from '../src/services/battleService.js';
import type { PokemonInBattle, BattleMove, AilmentType } from '../src/types/battle.js';
import { BATTLE_CONFIG } from '../src/types/battle.js';

console.log('🧪 TESTEANDO TAREA 3: Cálculo de Daño\n');

// Crear Pokémon de prueba
function createPokemon(name: string, types: string[], attack: number, defense: number, spAttack: number, spDefense: number): PokemonInBattle {
  return {
    id: 1,
    pokeapiId: 1,
    name,
    types,
    hp: 100,
    maxHp: 100,
    attack,
    defense,
    spAttack,
    spDefense,
    sprites: { front_default: null, back_default: null, front_shiny: null, back_shiny: null },
    moveIds: [],
    ailments: [],
    isCharging: false,
    cannotActNextTurn: false,
    hasFlinched: false,
    isFainted: false,
    savedHp: 100
  };
}

// Crear movimiento de prueba
function createMove(name: string, type: string, damageClass: 'physical' | 'special', power: number | null): BattleMove {
  return {
    moveId: 1,
    name,
    type,
    damageClass,
    power,
    accuracy: 100,
    priority: 0,
    pp: 20,
    maxPp: 20,
    meta: { ailment: null, ailmentChance: 0, statChanges: [], flinchChance: 0, heal: 0, minHits: null, maxHits: null, minTurns: null, maxTurns: null },
    flags: { recharge: false, charge: false, protect: false, mirror: false }
  };
}

console.log('=== FÓRMULA BASE ===');
console.log(`Nivel: ${BATTLE_CONFIG.LEVEL}`);
console.log(`STAB: ${BATTLE_CONFIG.STAB_MULTIPLIER} (1.5x)`);
console.log(`Aleatorio: ${BATTLE_CONFIG.DAMAGE_RANDOM_MIN} - ${BATTLE_CONFIG.DAMAGE_RANDOM_MAX}`);
console.log(`Quemado (físico): ${BATTLE_CONFIG.BURN_PHYSICAL_MODIFIER}`);

// Test 1: Movimiento físico básico
console.log('\n--- Test 1: Tackle (Físico) ---');
const charizard = createPokemon('Charizard', ['fire', 'flying'], 84, 78, 109, 85);
const pidgey = createPokemon('Pidgey', ['normal', 'flying'], 45, 40, 35, 35);
const tackle = createMove('Tackle', 'normal', 'physical', 40);

const result1 = calculateDamage(charizard, pidgey, tackle);
console.log(`Charizard (Atk: ${charizard.attack}) usa Tackle (Poder: 40) vs Pidgey (Def: ${pidgey.defense})`);
console.log(`Daño: ${result1.damage}, Crítico: ${result1.isCritical}, Efectividad: ${result1.effectiveness}`);
console.log(`Rango esperado: ~25-35`);

// Test 2: Movimiento especial
console.log('\n--- Test 2: Flamethrower (Especial) ---');
const flamethrower = createMove('Flamethrower', 'fire', 'special', 90);
const result2 = calculateDamage(charizard, pidgey, flamethrower);
console.log(`Charizard usa Flamethrower (Poder: 90) vs Pidgey`);
console.log(`Daño: ${result2.damage}, Crítico: ${result2.isCritical}, Efectividad: ${result2.effectiveness}`);
console.log(`Rango esperado: ~50-60 (STAB 1.5x)`);

// Test 3: STAB (Same Type Attack Bonus)
console.log('\n--- Test 3: STAB ---');
const fireBlast = createMove('Fire Blast', 'fire', 'special', 110);
const result3 = calculateDamage(charizard, pidgey, fireBlast);
console.log(`Charizard (tipo Fire) usa Fire Blast (tipo Fire)`);
console.log(`Daño: ${result3.damage} (STAB aplicado: 1.5x)`);

// Test 4: Efectividad - Super efectivo
console.log('\n--- Test 4: Super efectivo ---');
const blastoise = createPokemon('Blastoise', ['water'], 83, 100, 85, 105);
const waterGun = createMove('Water Gun', 'water', 'special', 40);
const result4 = calculateDamage(blastoise, charizard, waterGun);
console.log(`Blastoise (Water) vs Charizard (Fire/Flying)`);
console.log(`Daño: ${result4.damage}, Efectividad: ${result4.effectiveness}x`);
console.log(`Esperado: 2x (Water es efectivo contra Fire en Gen V)`);

// Test 5: Efectividad - No muy efectivo
console.log('\n--- Test 5: No muy efectivo ---');
const venusaur = createPokemon('Venusaur', ['grass', 'poison'], 82, 83, 100, 100);
const razorLeaf = createMove('Razor Leaf', 'grass', 'physical', 55);
const result5 = calculateDamage(venusaur, charizard, razorLeaf);
console.log(`Venusaur (Grass) vs Charizard (Fire/Flying)`);
console.log(`Daño: ${result5.damage}, Efectividad: ${result5.effectiveness}x`);
console.log(`Esperado: 0.5x (Grass no efectivo contra Fire)`);

// Test 6: Quemado - Modificador físico
console.log('\n--- Test 6: Quemado (modificador físico) ---');
const burnedCharizard = createPokemon('Charizard', ['fire', 'flying'], 84, 78, 109, 85);
burnedCharizard.ailments.push({
  type: 'burn' as AilmentType,
  turnsRemaining: 3,
  appliedBy: 'player2'
});
console.log(`Charizard tiene quemadura: ${hasAilment(burnedCharizard, 'burn')}`);
const tackleBurned = createMove('Tackle', 'normal', 'physical', 40);
const result6 = calculateDamage(burnedCharizard, pidgey, tackleBurned);
console.log(`Daño con quemadura (físico): ${result6.damage}`);
console.log(`Sin quemadura sería: ~${Math.round(result6.damage / 0.5)}`);

// Test 7: Inmunidad
console.log('\n--- Test 7: Inmunidad ---');
const gengar = createPokemon('Gengar', ['ghost', 'poison'], 65, 60, 130, 75);
const normalMove = createMove('Scratch', 'normal', 'physical', 40);
const result7 = calculateDamage(pidgey, gengar, normalMove);
console.log(`Pidgey (Normal) vs Gengar (Ghost)`);
console.log(`Daño: ${result7.damage}, Efectividad: ${result7.effectiveness}x`);
console.log(`Esperado: 0x (Normal no afecta a Ghost)`);

// Test 8: Múltiples tipos
console.log('\n--- Test 8: Múltiples tipos defensores ---');
const dragonite = createPokemon('Dragonite', ['dragon', 'flying'], 134, 95, 110, 100);
const iceBeam = createMove('Ice Beam', 'ice', 'special', 90);
const result8 = calculateDamage(blastoise, dragonite, iceBeam);
console.log(`Blastoise (Water) vs Dragonite (Dragon/Flying)`);
console.log(`Daño: ${result8.damage}, Efectividad: ${result8.effectiveness}x`);
console.log(`Esperado: 0.5x (Water no efectivo contra Dragon), 2x (Ice efectivo contra Flying)`);
console.log(`Resultado esperado: 0.5 * 2 = 1x (neutral)`);

// Test 9: Crítico
console.log('\n--- Test 9: Golpe crítico ---');
let criticalHits = 0;
const trials = 1000;
for (let i = 0; i < trials; i++) {
  const r = calculateDamage(charizard, pidgey, tackle);
  if (r.isCritical) criticalHits++;
}
const critRate = (criticalHits / trials * 100).toFixed(2);
console.log(`Críticos en ${trials} intentos: ${criticalHits} (${critRate}%)`);
console.log(`Esperado: ~6.25%`);

console.log('\n✅ TESTS COMPLETADOS');