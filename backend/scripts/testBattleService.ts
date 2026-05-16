/**
 * Test del Battle Service - Tarea 2
 */
import { 
  getActionPriority, 
  determineExecutionOrder, 
  coinflip,
  calculateDamage,
  hasAilment,
  applyAilment,
  canPokemonAct,
  getAilmentDamagePerTurn,
  hasAvailablePokemon,
  checkBattleEnd,
  createBattleState,
  createPlayerBattleState
} from '../src/services/battleService.js';
import type { PlayerAction, PokemonInBattle, BattleMove } from '../src/types/battle.js';

console.log('🧪 TESTEANDO TAREA 2: Sistema de Prioridad y Orden\n');

// Test 1: coinflip
console.log('1. Test coinflip (10 veces):');
const results = { player1: 0, player2: 0 };
for (let i = 0; i < 10; i++) {
  const result = coinflip();
  results[result]++;
}
console.log(`   player1: ${results.player1}, player2: ${results.player2}`);

// Test 2: getActionPriority - cambio (+6)
console.log('\n2. Test getActionPriority:');
const switchAction: PlayerAction = { playerId: 'player1', type: 'change', pokemonId: 2 };
console.log(`   Cambio: ${getActionPriority(switchAction)} (esperado: 6)`);

const moveAction: PlayerAction = { 
  playerId: 'player1', 
  type: 'attack', 
  moveId: 1,
  move: { 
    moveId: 1, 
    name: 'Tackle', 
    type: 'normal', 
    damageClass: 'physical', 
    power: 40, 
    accuracy: 100, 
    priority: 1, 
    pp: 35, 
    maxPp: 35,
    meta: { ailment: null, ailmentChance: 0, statChanges: [], flinchChance: 0, heal: 0, minHits: null, maxHits: null, minTurns: null, maxTurns: null },
    flags: { recharge: false, charge: false, protect: false, mirror: false }
  }
};
console.log(`   Movimiento prioridad +1: ${getActionPriority(moveAction)} (esperado: 1)`);

const lowPriorityMove: PlayerAction = {
  playerId: 'player1',
  type: 'attack',
  moveId: 2,
  move: {
    moveId: 2,
    name: 'Quick Attack',
    type: 'normal',
    damageClass: 'physical',
    power: 40,
    accuracy: 100,
    priority: 1,
    pp: 30,
    maxPp: 30,
    meta: { ailment: null, ailmentChance: 0, statChanges: [], flinchChance: 0, heal: 0, minHits: null, maxHits: null, minTurns: null, maxTurns: null },
    flags: { recharge: false, charge: false, protect: false, mirror: false }
  }
};
console.log(`   Movimiento prioridad 0: ${getActionPriority(lowPriorityMove)} (esperado: 0)`);

// Test 3: determineExecutionOrder
console.log('\n3. Test determineExecutionOrder:');
const action1: PlayerAction = { 
  playerId: 'player1', 
  type: 'attack', 
  moveId: 1,
  move: { 
    moveId: 1, 
    name: 'Tackle', 
    type: 'normal', 
    damageClass: 'physical', 
    power: 40, 
    accuracy: 100, 
    priority: 0, 
    pp: 35, 
    maxPp: 35,
    meta: { ailment: null, ailmentChance: 0, statChanges: [], flinchChance: 0, heal: 0, minHits: null, maxHits: null, minTurns: null, maxTurns: null },
    flags: { recharge: false, charge: false, protect: false, mirror: false }
  }
};
const action2: PlayerAction = { 
  playerId: 'player2', 
  type: 'change', 
  pokemonId: 2 
};

const order1 = determineExecutionOrder(action1, action2);
console.log(`   P1 ataque vs P2 cambio: ${order1.order[0]} va primero (${order1.reason})`);

// Misma prioridad - debe usar coinflip
const order2 = determineExecutionOrder(action1, action1);
console.log(`   Misma prioridad: ${order2.order[0]} vs ${order2.order[1]} (${order2.reason})`);

// Test 4: createPlayerBattleState
console.log('\n4. Test createPlayerBattleState:');
const mockTeam = [
  { name: 'Pikachu', types: ['electric'], stats: { hp: 35, attack: 55, defense: 40, sp_attack: 50, sp_defense: 50 }, sprites: { front_default: 'url' }, move_ids: [1, 2, 3, 4] },
  { name: 'Charizard', types: ['fire', 'flying'], stats: { hp: 78, attack: 84, defense: 78, sp_attack: 109, sp_defense: 85 }, sprites: { front_default: 'url' }, move_ids: [1, 2, 3, 4] },
];
const playerState = createPlayerBattleState('player1', 'TestPlayer', 'session-123', mockTeam);
console.log(`   Jugador creado: ${playerState.name}`);
console.log(`   Equipo: ${playerState.team.length} Pokémon`);
console.log(`   Pokémon activo: ${playerState.team[playerState.activePokemonIndex].name}`);

// Test 5: hasAvailablePokemon
console.log('\n5. Test hasAvailablePokemon:');
const p1Available = hasAvailablePokemon(playerState);
console.log(`   P1 tiene Pokémon disponibles: ${p1Available}`);

// Simular que un Pokémon faintó
playerState.team[0].isFainted = true;
playerState.team[0].hp = 0;
const p1AvailableAfter = hasAvailablePokemon(playerState);
console.log(`   P1 tiene Pokémon tras faintar: ${p1AvailableAfter}`);

console.log('\n✅ TESTS COMPLETADOS');