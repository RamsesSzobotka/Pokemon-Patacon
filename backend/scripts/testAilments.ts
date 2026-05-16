/**
 * Test del Sistema de Estados (Ailments) - Tarea 4
 */
import { 
  applyAilment, 
  hasAilment, 
  canPokemonAct, 
  getAilmentDamagePerTurn,
  decrementAilmentTurns
} from '../src/services/battleService.js';
import type { PokemonInBattle, AilmentType } from '../src/types/battle.js';
import { BATTLE_CONFIG } from '../src/types/battle.js';

console.log('🧪 TESTEANDO TAREA 4: Sistema de Estados (Ailments)\n');

// Crear Pokémon de prueba
function createPokemon(name: string = 'TestPkm', types: string[] = ['normal']): PokemonInBattle {
  return {
    id: 1,
    pokeapiId: 1,
    name,
    types,
    hp: 100,
    maxHp: 100,
    attack: 50,
    defense: 50,
    spAttack: 50,
    spDefense: 50,
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

console.log('=== CONFIGURACIÓN ===');
console.log(`Turnos por defecto: ${BATTLE_CONFIG.DEFAULT_AILMENT_TURNS}`);
console.log(`Paralysis chance: ${BATTLE_CONFIG.PARALYSIS_FREEZE_CHANCE * 100}%`);
console.log(`Freeze unfreeze: ${BATTLE_CONFIG.FREEZE_UNFREEZE_CHANCE * 100}%`);
console.log(`Confusion self-hit: ${BATTLE_CONFIG.CONFUSION_SELF_HIT_CHANCE * 100}%`);
console.log(`Burn damage: ${BATTLE_CONFIG.BURN_DAMAGE * 100}%`);
console.log(`Poison damage: ${BATTLE_CONFIG.POISON_DAMAGE * 100}%`);
console.log(`Toxic base: ${BATTLE_CONFIG.TOXIC_BASE_DAMAGE * 100}%`);
console.log(`Leech Seed: ${BATTLE_CONFIG.LEECH_SEED_DAMAGE * 100}%`);
console.log(`Curse: ${BATTLE_CONFIG.CURSE_DAMAGE * 100}%`);

// Test 1: hasAilment
console.log('\n--- Test 1: hasAilment ---');
const p1 = createPokemon();
console.log(`Sin estados: ${hasAilment(p1, 'burn')}`);
p1.ailments.push({ type: 'burn', turnsRemaining: 3, appliedBy: 'player2' });
console.log(`Con burn: ${hasAilment(p1, 'burn')}`);
console.log(`Verificando poison (no tiene): ${hasAilment(p1, 'poison')}`);

// Test 2: applyAilment - burn
console.log('\n--- Test 2: applyAilment - Burn ---');
const p2 = createPokemon('Charizard', ['fire']);
const burnResult = applyAilment(p2, 'burn', 'player2');
console.log(`Aplicar burn a Fire: ${burnResult.success} - ${burnResult.message}`);

const p3 = createPokemon('Charmander', ['fire']);
const burnImmune = applyAilment(p3, 'burn', 'player1');
console.log(`Aplicar burn a Fire (inmune): ${burnImmune.success} - ${burnImmune.message}`);

// Test 3: applyAilment - poison (Steel immune)
console.log('\n--- Test 3: applyAilment - Poison ---');
const steelix = createPokemon('Steelix', ['steel', 'ground']);
const poisonSteel = applyAilment(steelix, 'poison', 'player1');
console.log(`Aplicar poison a Steel: ${poisonSteel.success} - ${poisonSteel.message}`);

const onix = createPokemon('Onix', ['rock', 'ground']);
const poisonRock = applyAilment(onix, 'poison', 'player1');
console.log(`Aplicar poison a Rock: ${poisonRock.success} - ${poisonRock.message}`);

// Test 4: applyAilment - toxic
console.log('\n--- Test 4: applyAilment - Toxic ---');
const p4 = createPokemon();
const toxicResult = applyAilment(p4, 'toxic', 'player2');
console.log(`Aplicar toxic: ${toxicResult.success} - ${toxicResult.message}`);
console.log(`Toxic turnos: ${p4.ailments[0].turnsRemaining}`);
console.log(`Toxic toxicTurn: ${p4.ailments[0].toxicTurn}`);

// Test 5: applyAilment - paralysis (no immunity)
console.log('\n--- Test 5: applyAilment - Paralysis ---');
const p5 = createPokemon();
const paraResult = applyAilment(p5, 'paralysis', 'player2');
console.log(`Aplicar paralysis: ${paraResult.success} - ${paraResult.message}`);

// Test 6: applyAilment - freeze (Ice immune)
console.log('\n--- Test 6: applyAilment - Freeze ---');
const p6 = createPokemon('Lapras', ['water', 'ice']);
const freezeIce = applyAilment(p6, 'freeze', 'player1');
console.log(`Aplicar freeze a Ice: ${freezeIce.success} - ${freezeIce.message}`);

const p7 = createPokemon('Pikachu', ['electric']);
const freezeNormal = applyAilment(p7, 'freeze', 'player1');
console.log(`Aplicar freeze a Electric: ${freezeNormal.success} - ${freezeNormal.message}`);

// Test 7: applyAilment - sleep
console.log('\n--- Test 7: applyAilment - Sleep ---');
const p8 = createPokemon();
const sleepResult = applyAilment(p8, 'sleep', 'player2');
console.log(`Aplicar sleep: ${sleepResult.success} - ${sleepResult.message}`);

// Test 8: applyAilment - flinch (no immunity)
console.log('\n--- Test 8: applyAilment - Flinch ---');
const p9 = createPokemon();
const flinchResult = applyAilment(p9, 'flinch', 'player2');
console.log(`Aplicar flinch: ${flinchResult.success} - ${flinchResult.message}`);

// Test 9: applyAilment - leech_seed
console.log('\n--- Test 9: applyAilment - Leech Seed ---');
const p10 = createPokemon();
const leechResult = applyAilment(p10, 'leech_seed', 'player2');
console.log(`Aplicar leech_seed: ${leechResult.success} - ${leechResult.message}`);

// Test 10: applyAilment - curse
console.log('\n--- Test 10: applyAilment - Curse ---');
const p11 = createPokemon();
const curseResult = applyAilment(p11, 'curse', 'player2');
console.log(`Aplicar curse: ${curseResult.success} - ${curseResult.message}`);

// Test 11: getAilmentDamagePerTurn - Burn
console.log('\n--- Test 11: getAilmentDamagePerTurn - Burn ---');
const p12 = createPokemon();
p12.maxHp = 100;
p12.ailments.push({ type: 'burn', turnsRemaining: 3, appliedBy: 'player2' });
const burnDamage = getAilmentDamagePerTurn(p12);
console.log(`Daño burn (100 HP): ${burnDamage} (esperado: 5)`);

// Test 12: getAilmentDamagePerTurn - Poison
console.log('\n--- Test 12: getAilmentDamagePerTurn - Poison ---');
const p13 = createPokemon();
p13.maxHp = 100;
p13.ailments.push({ type: 'poison', turnsRemaining: 3, appliedBy: 'player2' });
const poisonDamage = getAilmentDamagePerTurn(p13);
console.log(`Daño poison (100 HP): ${poisonDamage} (esperado: 5)`);

// Test 13: getAilmentDamagePerTurn - Toxic (acumulativo)
console.log('\n--- Test 13: getAilmentDamagePerTurn - Toxic ---');
const p14 = createPokemon();
p14.maxHp = 100;
p14.ailments.push({ type: 'toxic', turnsRemaining: 5, appliedBy: 'player2', toxicTurn: 1 });
const toxicDamage1 = getAilmentDamagePerTurn(p14);
console.log(`Toxic Turn 1 (100 HP): ${toxicDamage1} (esperado: 5)`);

p14.ailments[0].toxicTurn = 2;
const toxicDamage2 = getAilmentDamagePerTurn(p14);
console.log(`Toxic Turn 2 (100 HP): ${toxicDamage2} (esperado: 10)`);

p14.ailments[0].toxicTurn = 3;
const toxicDamage3 = getAilmentDamagePerTurn(p14);
console.log(`Toxic Turn 3 (100 HP): ${toxicDamage3} (esperado: 15)`);

// Test 14: getAilmentDamagePerTurn - Leech Seed
console.log('\n--- Test 14: getAilmentDamagePerTurn - Leech Seed ---');
const p15 = createPokemon();
p15.maxHp = 100;
p15.ailments.push({ type: 'leech_seed', turnsRemaining: 3, appliedBy: 'player2' });
const leechDamage = getAilmentDamagePerTurn(p15);
console.log(`Daño leech_seed (100 HP): ${leechDamage} (esperado: 10)`);

// Test 15: getAilmentDamagePerTurn - Curse
console.log('\n--- Test 15: getAilmentDamagePerTurn - Curse ---');
const p16 = createPokemon();
p16.maxHp = 100;
p16.ailments.push({ type: 'curse', turnsRemaining: 3, appliedBy: 'player2' });
const curseDamage = getAilmentDamagePerTurn(p16);
console.log(`Daño curse (100 HP): ${curseDamage} (esperado: 25)`);

// Test 16: decrementAilmentTurns
console.log('\n--- Test 16: decrementAilmentTurns ---');
const p17 = createPokemon();
p17.ailments.push({ type: 'burn', turnsRemaining: 3, appliedBy: 'player2' });
p17.ailments.push({ type: 'toxic', turnsRemaining: 5, appliedBy: 'player2', toxicTurn: 1 });

console.log(`Antes: burn=${p17.ailments[0].turnsRemaining}, toxic=${p17.ailments[1].turnsRemaining}`);
decrementAilmentTurns(p17);
console.log(`Después: burn=${p17.ailments[0].turnsRemaining}, toxic=${p17.ailments[1].turnsRemaining}, toxicTurn=${p17.ailments[1].toxicTurn}`);

// Decrementar hasta que se acabe
decrementAilmentTurns(p17);
decrementAilmentTurns(p17);
decrementAilmentTurns(p17);
decrementAilmentTurns(p17);
decrementAilmentTurns(p17);
console.log(`Después de 6 decrementos: ailments=${p17.ailments.length}`);

// Test 17: canPokemonAct - Paralysis
console.log('\n--- Test 17: canPokemonAct - Paralysis ---');
const p18 = createPokemon();
p18.ailments.push({ type: 'paralysis', turnsRemaining: 3, appliedBy: 'player2' });
// Probar múltiples veces para ver si aplica el 25%
let stuckCount = 0;
for (let i = 0; i < 20; i++) {
  const result = canPokemonAct(p18);
  if (!result.canAct && result.reason.includes('Paralizado')) stuckCount++;
}
console.log(`Paralysis: ${stuckCount}/20 turnos paralizado (esperado ~5)`);

// Test 18: canPokemonAct - Sleep
console.log('\n--- Test 18: canPokemonAct - Sleep ---');
const p19 = createPokemon();
p19.ailments.push({ type: 'sleep', turnsRemaining: 3, appliedBy: 'player2' });
const sleepAct = canPokemonAct(p19);
console.log(`Sleep (turnos ${p19.ailments[0].turnsRemaining}): puede actuar=${sleepAct.canAct}`);

// Dormir 3 turnos y verificar que despierte
for (let i = 0; i < 4; i++) {
  decrementAilmentTurns(p19);
}
const afterSleep = canPokemonAct(p19);
console.log(`After sleep (turnos 0): puede actuar=${afterSleep.canAct}, ailments=${p19.ailments.length}`);

// Test 19: canPokemonAct - Flinch
console.log('\n--- Test 19: canPokemonAct - Flinch ---');
const p20 = createPokemon();
p20.hasFlinched = true;
const flinchAct = canPokemonAct(p20);
console.log(`Flinch: puede actuar=${flinchAct.canAct}, razón=${flinchAct.reason}`);

// Test 20: canPokemonAct - Cannot act next turn (fatiga)
console.log('\n--- Test 20: canPokemonAct - Fatiga ---');
const p21 = createPokemon();
p21.cannotActNextTurn = true;
const fatigueAct = canPokemonAct(p21);
console.log(`Fatiga: puede actuar=${fatigueAct.canAct}, razón=${fatigueAct.reason}`);

console.log('\n✅ TESTS COMPLETADOS');