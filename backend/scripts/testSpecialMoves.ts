/**
 * Test de Movimientos Especiales - Tarea 5
 * - Carga (2 turnos): solar beam, fly, dig, skull bash
 * - Fatiga (recharge): hyper beam
 * - Multi-hit: fury swipes, pin missile, bullet seed
 */
import { executeMove, calculateDamage } from '../src/services/battleService.js';
import type { PokemonInBattle, BattleMove } from '../src/types/battle.js';
import { CHARGE_MOVES, RECHARGE_MOVES, MULTI_HIT_MOVES } from '../src/types/battle.js';

console.log('🧪 TESTEANDO TAREA 5: Movimientos Especiales\n');

console.log('=== LOOKUP TABLES ===');
console.log(`Carga (2 turnos): ${CHARGE_MOVES.size} movimientos`);
console.log(`Recharge (fatiga): ${RECHARGE_MOVES.size} movimientos`);
console.log(`Multi-hit: ${MULTI_HIT_MOVES.size} movimientos`);

// Crear Pokémon de prueba
function createPokemon(name: string, types: string[]): PokemonInBattle {
  return {
    id: 1,
    pokeapiId: 1,
    name,
    types,
    hp: 100,
    maxHp: 100,
    attack: 80,
    defense: 80,
    spAttack: 100,
    spDefense: 100,
    sprites: { front_default: null, back_default: null, front_shiny: null, back_shiny: null },
    moveIds: [],
    ailments: [],
    isCharging: false,
    chargingMoveId: undefined,
    cannotActNextTurn: false,
    hasFlinched: false,
    isFainted: false,
    savedHp: 100
  };
}

// Crear movimiento
function createMove(
  name: string, 
  type: string, 
  damageClass: 'physical' | 'special', 
  power: number,
  priority: number = 0
): BattleMove {
  return {
    moveId: 1,
    name,
    type,
    damageClass,
    power,
    accuracy: 100,
    priority,
    pp: 10,
    maxPp: 10,
    meta: { 
      ailment: null, 
      ailmentChance: 0, 
      statChanges: [], 
      flinchChance: 0, 
      heal: 0, 
      minHits: null, 
      maxHits: null, 
      minTurns: null, 
      maxTurns: null 
    },
    flags: { recharge: false, charge: false, protect: false, mirror: false }
  };
}

// Test 1: Verificar lookup tables
console.log('\n--- Test 1: Lookup Tables ---');
console.log(`Solar Beam en CHARGE: ${CHARGE_MOVES.has('solar-beam')}`);
console.log(`Fly en CHARGE: ${CHARGE_MOVES.has('fly')}`);
console.log(`Dig en CHARGE: ${CHARGE_MOVES.has('dig')}`);
console.log(`Hyper Beam en RECHARGE: ${RECHARGE_MOVES.has('hyper-beam')}`);
console.log(`Fury Swipes en MULTI: ${MULTI_HIT_MOVES.has('fury-swipes')}`);
console.log(`Tackle en CHARGE (no): ${CHARGE_MOVES.has('tackle')}`);

// Test 2: Movimiento de carga - primer turno
console.log('\n--- Test 2: Movimiento de carga - Primer turno ---');
const p1 = createPokemon('Venusaur', ['grass']);
const p2 = createPokemon('Charizard', ['fire', 'flying']);
const solarBeam = createMove('Solar Beam', 'grass', 'special', 120);

console.log(`Antes: isCharging=${p1.isCharging}, chargingMove=${p1.chargingMove?.name}`);
const result1 = executeMove(p1, p2, solarBeam, 'player1');
console.log(`Resultado: ${result1.message}`);
console.log(`Después: isCharging=${p1.isCharging}, chargingMove=${p1.chargingMove?.name}`);
console.log(`Es carga: ${result1.isCharging}`);

// Test 3: Movimiento de carga - segundo turno (ejecutar)
console.log('\n--- Test 3: Movimiento de carga - Segundo turno ---');
// Simular que ya está cargando
p1.isCharging = true;
p1.chargingMove = solarBeam;
console.log(`Venusaur cargando: isCharging=${p1.isCharging}`);

const result2 = executeMove(p1, p2, solarBeam, 'player1');
console.log(`Resultado: ${result2.message}`);
console.log(`Daño: ${result2.damage}`);
console.log(`Después: isCharging=${p1.isCharging}`);

// Test 4: Movimiento de fatiga (recharge)
console.log('\n--- Test 4: Movimiento de fatiga (recharge) ---');
const p3 = createPokemon('Blastoise', ['water']);
const p4 = createPokemon('Charizard', ['fire', 'flying']);
const hyperBeam = createMove('Hyper Beam', 'normal', 'special', 150);

console.log(`Antes: cannotActNextTurn=${p3.cannotActNextTurn}`);
const result4 = executeMove(p3, p4, hyperBeam, 'player1');
console.log(`Resultado: ${result4.message}`);
console.log(`Después: cannotActNextTurn=${p3.cannotActNextTurn}`);
console.log(`Fatiga aplicada: ${result4.cannotActNextTurn}`);

// Test 5: Movimiento normal (sin efectos especiales)
console.log('\n--- Test 5: Movimiento normal (sin efectos) ---');
const p5 = createPokemon('Pikachu', ['electric']);
const p6 = createPokemon('Pidgey', ['normal', 'flying']);
const thunderbolt = createMove('Thunderbolt', 'electric', 'special', 90);

const result5 = executeMove(p5, p6, thunderbolt, 'player1');
console.log(`Resultado: ${result5.message}`);
console.log(`Daño: ${result5.damage}`);
console.log(`isCharging: ${result5.isCharging}`);
console.log(`cannotActNextTurn: ${result5.cannotActNextTurn}`);

// Test 6: Movimiento con flinch
console.log('\n--- Test 6: Movimiento con flinch ---');
const p7 = createPokemon('Aerodactyl', ['rock', 'flying']);
const p8 = createPokemon('Pikachu', ['electric']);
const rockSlide = createMove('Rock Slide', 'rock', 'physical', 75);
rockSlide.meta.flinchChance = 30;

const result6 = executeMove(p7, p8, rockSlide, 'player1');
console.log(`Resultado: ${result6.message}`);
console.log(`Flinch aplicado: ${result6.flinchedTarget}`);
console.log(`Pikachu flinch flag: ${p8.hasFlinched}`);

// Test 7: Movimiento que aplica estado
console.log('\n--- Test 7: Movimiento que aplica estado (Will-O-Wisp) ---');
const p9 = createPokemon('Gastly', ['ghost', 'poison']);
const p10 = createPokemon('Charizard', ['fire', 'flying']);
const willOWisp = createMove('Will-O-Wisp', 'fire', 'status', null);
willOWisp.meta.ailment = 'burn';
willOWisp.meta.ailmentChance = 100;

const result7 = executeMove(p9, p10, willOWisp, 'player1');
console.log(`Resultado: ${result7.message}`);
console.log(`Estado aplicado: ${result7.ailmentApplied}, éxito: ${result7.ailmentSuccess}`);
console.log(`Charizard quemado: ${p10.ailments.some(a => a.type === 'burn')}`);

// Test 8: Movimiento de carga - pokeapi naming
console.log('\n--- Test 8: Verificar nombres en PokeAPI format ---');
// Los nombres en la API pueden tener diferentes formatos
console.log(`solar-beam: ${CHARGE_MOVES.has('solar-beam')}`);
console.log(`solarbeam (sin guión): ${CHARGE_MOVES.has('solarbeam')}`);

// Test 9: Movimiento con varios hits (multi-hit) - simulado
console.log('\n--- Test 9: Movimiento multi-hit (simulado) ---');
// Nota: El sistema actual no implementa multi-hit en executeMove
// Esto es para mostrar la intención
const furySwipes = createMove('Fury Swipes', 'normal', 'physical', 18);
furySwipes.meta.minHits = 2;
furySwipes.meta.maxHits = 5;

console.log(`Fury Swipes minHits: ${furySwipes.meta.minHits}`);
console.log(`Fury Swipes maxHits: ${furySwipes.meta.maxHits}`);
console.log(`(El sistema de multi-hit requiere implementación adicional)`);

// Test 10: Secuencia completa de batalla con carga
console.log('\n--- Test 10: Secuencia completa - Venusaur vs Charizard ---');
const venusaur = createPokemon('Venusaur', ['grass']);
const charizard = createPokemon('Charizard', ['fire', 'flying']);

// Turno 1: Venusaur usa Solar Beam (carga)
console.log('\nTurno 1:');
const turn1 = executeMove(venusaur, charizard, solarBeam, 'player1');
console.log(`  ${turn1.message}`);
console.log(`  Venusaur cargando: ${venusaur.isCharging}`);

// Turno 2: Charizard ataca mientras Venusaur carga
const flamethrower = createMove('Flamethrower', 'fire', 'special', 90);
console.log('\nTurno 2 (Charizard ataca):');
const turn2 = executeMove(charizard, venusaur, flamethrower, 'player2');
console.log(`  ${turn2.message}`);

// Turno 2 (continuación): Venusaur completa el Solar Beam
console.log('\nTurno 2 (Venusaur completa carga):');
const turn2b = executeMove(venusaur, charizard, solarBeam, 'player1');
console.log(`  ${turn2b.message}`);
console.log(`  Daño: ${turn2b.damage}`);
console.log(`  Venusaur cargando: ${venusaur.isCharging}`);

console.log('\n✅ TESTS COMPLETADOS');