/**
 * Test del Motor de Turnos (Core del Juego) - Tarea 7
 * Este test verifica el flujo completo de un turno integrando todas las funciones anteriores
 */
import {
  createBattleState,
  createPlayerBattleState,
  determineExecutionOrder,
  canPokemonAct,
  executeMove,
  executeSwitch,
  getAilmentDamagePerTurn,
  decrementAilmentTurns,
  checkBattleEnd
} from '../src/services/battleService.js';
import type { PokemonInBattle, BattleMove, PlayerAction, AilmentType } from '../src/types/battle.js';

console.log('🧪 TESTEANDO TAREA 7: Motor de Turnos (Core del Juego)\n');

// ============================================
// HELPER FUNCTIONS
// ============================================

function createPokemon(id: number, name: string, types: string[], hp: number, moves: string[]): PokemonInBattle {
  return {
    id,
    pokeapiId: id,
    name,
    types,
    hp,
    maxHp: hp,
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
    savedHp: hp
  };
}

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

// ============================================
// TEST: FLUJO COMPLETO DE UN TURNO
// ============================================

console.log('=== ESCENARIO: Batalla 1v1 ===\n');

// Crear equipos
const p1Team = [
  createPokemon(1, 'Charizard', ['fire', 'flying'], 100, ['Flamethrower', 'Dragon Claw', 'Roost', 'Flare Blitz']),
  createPokemon(2, 'Blastoise', ['water'], 100, ['Hydro Pump', 'Ice Beam', 'Rest', 'Roar']),
  createPokemon(3, 'Venusaur', ['grass', 'poison'], 100, ['Solar Beam', 'Sleep Powder', 'Leech Seed', 'Growth']),
];

const p2Team = [
  createPokemon(1, 'Pikachu', ['electric'], 100, ['Thunderbolt', 'Quick Attack', 'Iron Tail', 'Light Screen']),
  createPokemon(2, 'Snorlax', ['normal'], 100, ['Body Slam', 'Rest', 'Crunch', 'Belly Drum']),
  createPokemon(3, 'Gengar', ['ghost', 'poison'], 100, ['Shadow Ball', 'Sludge Bomb', 'Hypnosis', 'Dream Eater']),
];

const player1 = createPlayerBattleState('player1', 'Ash', 'session-1', p1Team);
const player2 = createPlayerBattleState('player2', 'Gary', 'session-2', p2Team);

// Crear estado de batalla
const battle = createBattleState('ROOM-123', player1, player2);
console.log(`Batalla creada: sala=${battle.roomCode}, turno=${battle.turn}, fase=${battle.phase}`);

// ============================================
// FASE 1: SELECCIÓN DE ACCIONES
// ============================================

console.log('\n--- FASE 1: SELECCIÓN DE ACCIONES ---');

// Jugador 1 selecciona: Atacar con Flamethrower
const action1: PlayerAction = {
  playerId: 'player1',
  type: 'attack',
  moveId: 1,
  move: createMove('Flamethrower', 'fire', 'special', 90)
};

// Jugador 2 selecciona: Atacar con Thunderbolt
const action2: PlayerAction = {
  playerId: 'player2',
  type: 'attack',
  moveId: 1,
  move: createMove('Thunderbolt', 'electric', 'special', 90)
};

battle.pendingActions.player1 = action1;
battle.pendingActions.player2 = action2;

console.log(`P1 seleccionado: ${action1.type} - ${action1.move?.name}`);
console.log(`P2 seleccionado: ${action2.type} - ${action2.move?.name}`);

// ============================================
// FASE 2: DETERMINAR ORDEN
// ============================================

console.log('\n--- FASE 2: DETERMINAR ORDEN ---');

const { order, reason } = determineExecutionOrder(action1, action2);
battle.executionOrder = order;
console.log(`Orden: ${order[0]} va primero (${reason})`);

// ============================================
// FASE 3: EJECUTAR ACCIONES
// ============================================

console.log('\n--- FASE 3: EJECUTAR ACCIONES ---');

const attacker1 = player1.team[player1.activePokemonIndex];
const attacker2 = player2.team[player2.activePokemonIndex];

console.log(`P1 activo: ${attacker1.name} (HP: ${attacker1.hp})`);
console.log(`P2 activo: ${attacker2.name} (HP: ${attacker2.hp})`);

// Ejecutar acción del primero
const firstAttacker = order[0] === 'player1' ? attacker1 : attacker2;
const firstDefender = order[0] === 'player1' ? attacker2 : attacker1;
const firstAction = order[0] === 'player1' ? action1 : action2;

const canAct1 = canPokemonAct(firstAttacker);
console.log(`${firstAttacker.name} puede actuar: ${canAct1.canAct} (${canAct1.reason})`);

if (canAct1.canAct) {
  const result1 = executeMove(firstAttacker, firstDefender, firstAction.move!, firstAction.playerId);
  console.log(`Resultado: ${result1.message}`);
  console.log(`Daño: ${result1.damage}, HP rival: ${firstDefender.hp}`);
  battle.actionResults.push(result1);
}

// Ejecutar acción del segundo (si el primero no faintó al segundo)
const secondAttacker = order[0] === 'player1' ? attacker2 : attacker1;
const secondDefender = order[0] === 'player1' ? attacker1 : attacker2;
const secondAction = order[0] === 'player1' ? action2 : action1;

if (!secondDefender.isFainted) {
  const canAct2 = canPokemonAct(secondAttacker);
  console.log(`${secondAttacker.name} puede actuar: ${canAct2.canAct} (${canAct2.reason})`);
  
  if (canAct2.canAct) {
    const result2 = executeMove(secondAttacker, secondDefender, secondAction.move!, secondAction.playerId);
    console.log(`Resultado: ${result2.message}`);
    console.log(`Daño: ${result2.damage}, HP rival: ${secondDefender.hp}`);
    battle.actionResults.push(result2);
  }
} else {
  console.log(`${secondDefender.name} faintó, no puede actuar`);
}

// ============================================
// FASE 4: EFECTOS FINALES DEL TURNO
// ============================================

console.log('\n--- FASE 4: EFECTOS FINALES DEL TURNO ---');

// Aplicar daño por estados
const p1Damage = getAilmentDamagePerTurn(attacker1);
const p2Damage = getAilmentDamagePerTurn(attacker2);

if (p1Damage > 0) {
  attacker1.hp = Math.max(0, attacker1.hp - p1Damage);
  console.log(`${attacker1.name} recibe ${p1Damage} por estados. HP: ${attacker1.hp}`);
}
if (p2Damage > 0) {
  attacker2.hp = Math.max(0, attacker2.hp - p2Damage);
  console.log(`${attacker2.name} recibe ${p2Damage} por estados. HP: ${attacker2.hp}`);
}

// Verificar KO por daño de estados
if (attacker1.hp <= 0) attacker1.isFainted = true;
if (attacker2.hp <= 0) attacker2.isFainted = true;

// Decrementar turnos de estados
decrementAilmentTurns(attacker1);
decrementAilmentTurns(attacker2);

console.log(`Estados después de decrementar: P1=${attacker1.ailments.length}, P2=${attacker2.ailments.length}`);

// ============================================
// FASE 5: VERIFICAR FIN DE BATALLA
// ============================================

console.log('\n--- FASE 5: VERIFICAR FIN DE BATALLA ---');

const endResult = checkBattleEnd(player1, player2);
console.log(`¿Batalla terminada?: ${endResult.ended}, Ganador: ${endResult.winner}`);
console.log(`Mensaje: ${endResult.message}`);

// ============================================
// TEST: ESCENARIO 2 - UN JUGADOR CAMBIA
// ============================================

console.log('\n\n=== ESCENARIO 2: Un jugador cambia ===\n');

// Reiniciar con nuevo escenario
const p1Team2 = [
  createPokemon(1, 'Charizard', ['fire', 'flying'], 100, ['Flamethrower']),
  createPokemon(2, 'Blastoise', ['water'], 100, ['Hydro Pump']),
];

const p2Team2 = [
  createPokemon(1, 'Pikachu', ['electric'], 100, ['Thunderbolt']),
  createPokemon(2, 'Jigglypuff', ['normal'], 100, ['Sing']),
];

const player1Scenario2 = createPlayerBattleState('player1', 'Ash', 'session-1', p1Team2);
const player2Scenario2 = createPlayerBattleState('player2', 'Gary', 'session-2', p2Team2);
const battle2 = createBattleState('ROOM-456', player1Scenario2, player2Scenario2);

// P1 ataca, P2 cambia
const attackAction: PlayerAction = {
  playerId: 'player1',
  type: 'attack',
  moveId: 1,
  move: createMove('Flamethrower', 'fire', 'special', 90)
};

const changeAction: PlayerAction = {
  playerId: 'player2',
  type: 'change',
  pokemonId: 2
};

battle2.pendingActions.player1 = attackAction;
battle2.pendingActions.player2 = changeAction;

console.log('P1 selecciona: Atacar (Flamethrower)');
console.log('P2 selecciona: Cambiar a Jigglypuff');

const { order: order2, reason: reason2 } = determineExecutionOrder(attackAction, changeAction);
console.log(`Orden: ${order2[0]} primero (${reason2})`);

// El cambio siempre va primero (prioridad +6)
if (order2[0] === 'player2') {
  console.log('\n--- P2 cambia primero (prioridad +6) ---');
  const switchResult = executeSwitch(player2Scenario2, 1, 0); // Cambiar a Jigglypuff
  console.log(`Cambio: ${switchResult.success} - ${switchResult.message}`);
  console.log(`Nuevo activo: ${player2Scenario2.team[player2Scenario2.activePokemonIndex].name}`);
}

// ============================================
// TEST: ESCENARIO 3 - ESTADOS Y DAÑO
// ============================================

console.log('\n\n=== ESCENARIO 3: Estados y efectos ===\n');

const p1Team3 = [
  createPokemon(1, 'Charizard', ['fire', 'flying'], 100, ['Flamethrower']),
];

const p2Team3 = [
  createPokemon(1, 'Bulbasaur', ['grass', 'poison'], 100, ['Leech Seed']),
];

const player1Scenario3 = createPlayerBattleState('player1', 'Ash', 'session-1', p1Team3);
const player2Scenario3 = createPlayerBattleState('player2', 'Gary', 'session-2', p2Team3);

// Aplicar Leech Seed a Charizard
player1Scenario3.team[0].ailments.push({
  type: 'leech_seed' as AilmentType,
  turnsRemaining: 3,
  appliedBy: 'player2'
});

console.log(`Charizard tiene Leech Seed: ${player1Scenario3.team[0].ailments.some(a => a.type === 'leech_seed')}`);

// Calcular daño por turno
const leechDamage = getAilmentDamagePerTurn(player1Scenario3.team[0]);
console.log(`Daño por Leech Seed (100 HP): ${leechDamage}% (esperado: 10)`);

// ============================================
// TEST: ESCENARIO 4 - VICTORY
// ============================================

console.log('\n\n=== ESCENARIO 4: Victoria ===\n');

const p1Team4 = [
  createPokemon(1, 'Charizard', ['fire'], 10, ['Flamethrower']),
  createPokemon(2, 'Blastoise', ['water'], 100, ['Hydro Pump']),
];

const p2Team4 = [
  createPokemon(1, 'Pikachu', ['electric'], 100, ['Thunderbolt']),
  createPokemon(2, 'Jigglypuff', ['normal'], 0, ['Sing']), // faintado
];

const player1Scenario4 = createPlayerBattleState('player1', 'Ash', 'session-1', p1Team4);
const player2Scenario4 = createPlayerBattleState('player2', 'Gary', 'session-2', p2Team4);

console.log(`P1: Charizard HP=${p1Team4[0].hp}, Blastoise HP=${p1Team4[1].hp}`);
console.log(`P2: Pikachu HP=${p2Team4[0].hp}, Jigglypuff HP=${p2Team4[1].hp} (faintado)`);

// Simular que Charizard recibe daño
p1Team4[0].hp = 0;
p1Team4[0].isFainted = true;

// Verificar fin
const victoryCheck = checkBattleEnd(player1Scenario4, player2Scenario4);
console.log(`¿Terminó?: ${victoryCheck.ended}, Ganador: ${victoryCheck.winner}`);
console.log(`Mensaje: ${victoryCheck.message}`);

console.log('\n✅ TESTS COMPLETADOS');