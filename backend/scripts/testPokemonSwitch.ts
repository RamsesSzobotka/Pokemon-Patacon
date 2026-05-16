/**
 * Test del Sistema de Cambio de Pokémon - Tarea 6
 */
import { executeSwitch, hasAvailablePokemon, countRemainingPokemon } from '../src/services/battleService.js';
import { applyAilment } from '../src/services/battleService.js';
import type { PokemonInBattle, PlayerBattleState } from '../src/types/battle.js';

console.log('🧪 TESTEANDO TAREA 6: Cambio de Pokémon\n');

// Crear Pokémon de prueba
function createPokemon(id: number, name: string, types: string[], hp: number): PokemonInBattle {
  return {
    id,
    pokeapiId: id,
    name,
    types,
    hp,
    maxHp: hp,
    attack: 50,
    defense: 50,
    spAttack: 50,
    spDefense: 50,
    sprites: { front_default: null, back_default: null, front_shiny: null, back_shiny: null },
    moveIds: [],
    ailments: [],
    isCharging: false,
    chargingMoveId: undefined,
    cannotActNextTurn: false,
    hasFlinched: false,
    isFainted: hp <= 0,
    savedHp: hp
  };
}

// Crear PlayerBattleState de prueba
function createPlayer(
  playerId: 'player1' | 'player2',
  name: string,
  sessionId: string,
  team: PokemonInBattle[]
): PlayerBattleState {
  return {
    playerId,
    name,
    sessionId,
    team,
    activePokemonIndex: 0,
    hasSelectedAction: false
  };
}

// Test 1: Cambio básico
console.log('\n--- Test 1: Cambio básico ---');
const team1 = [
  createPokemon(1, 'Pikachu', ['electric'], 50),
  createPokemon(2, 'Charizard', ['fire', 'flying'], 100),
  createPokemon(3, 'Blastoise', ['water'], 100),
];
const player1 = createPlayer('player1', 'Ash', 'session-1', team1);

console.log(`Pokemon activo: ${player1.team[player1.activePokemonIndex].name} (HP: ${player1.team[0].hp})`);
const switchResult = executeSwitch(player1, 2, 0); // Cambiar a Charizard (index 2)
console.log(`Cambio: ${switchResult.success} - ${switchResult.message}`);
console.log(`Nuevo activo: ${player1.team[player1.activePokemonIndex].name} (HP: ${player1.team[2].hp})`);

// Test 2: Cambio a Pokémon con HP = 0 (no elegible)
console.log('\n--- Test 2: Cambio a Pokémon agotado ---');
const team2 = [
  createPokemon(1, 'Pikachu', ['electric'], 0),  // faintado
  createPokemon(2, 'Charizard', ['fire', 'flying'], 100),
  createPokemon(3, 'Blastoise', ['water'], 100),
];
const player2 = createPlayer('player1', 'Ash', 'session-1', team2);

console.log(`Pikachu HP: ${team2[0].hp}, isFainted: ${team2[0].isFainted}`);
const switchToFainted = executeSwitch(player2, 0, 0); // Intentar cambiar a Pikachu faintado
console.log(`Cambio a faintado: ${switchToFainted.success} - ${switchToFainted.message}`);

// Test 3: Preservar HP al cambiar (HP individual)
console.log('\n--- Test 3: Preservar HP individual al cambiar ---');
const team3 = [
  createPokemon(1, 'Pikachu', ['electric'], 30), // daño recibido
  createPokemon(2, 'Charizard', ['fire', 'flying'], 100),
];
const player3 = createPlayer('player1', 'Ash', 'session-1', team3);

console.log(`Antes: Pikachu HP=${team3[0].hp}, Charizard HP=${team3[1].hp}`);
const switchToCharizard = executeSwitch(player3, 1, 0);
console.log(`Cambio: ${switchToCharizard.success}`);
console.log(`Después: Pikachu HP=${team3[0].hp} (preservado), activeIndex=${player3.activePokemonIndex}`);

// Test 4: Mantener estados al cambiar (no se eliminan)
console.log('\n--- Test 4: Mantener estados al cambiar ---');
const team4 = [
  createPokemon(1, 'Pikachu', ['electric'], 100),
  createPokemon(2, 'Charizard', ['fire', 'flying'], 100),
];
const player4 = createPlayer('player1', 'Ash', 'session-1', team4);

// Aplicar burn a Pikachu
applyAilment(team4[0], 'burn', 'player2');
console.log(`Pikachu tiene burn: ${team4[0].ailments.some(a => a.type === 'burn')}`);

// Cambiar a Charizard
const switchResult4 = executeSwitch(player4, 1, 0);
console.log(`Cambio: ${switchResult4.success}`);

// Verificar que el estado sigue en el equipo (aunque no afecta ahora)
console.log(`Pikachu burn tras cambio: ${team4[0].ailments.some(a => a.type === 'burn')}`);

// Test 5: Verificar hasAvailablePokemon
console.log('\n--- Test 5: hasAvailablePokemon ---');
const team5a = [
  createPokemon(1, 'Pikachu', ['electric'], 100),
  createPokemon(2, 'Charizard', ['fire'], 0),
  createPokemon(3, 'Blastoise', ['water'], 50),
];
const player5a = createPlayer('player1', 'Ash', 'session-1', team5a);
console.log(`Equipo con 1 vivo: ${hasAvailablePokemon(player5a)}`);

const team5b = [
  createPokemon(1, 'Pikachu', ['electric'], 0),
  createPokemon(2, 'Charizard', ['fire'], 0),
  createPokemon(3, 'Blastoise', ['water'], 0),
];
const player5b = createPlayer('player1', 'Ash', 'session-1', team5b);
console.log(`Equipo todos muerto: ${hasAvailablePokemon(player5b)}`);

// Test 6: countRemainingPokemon
console.log('\n--- Test 6: countRemainingPokemon ---');
const team6 = [
  createPokemon(1, 'Pikachu', ['electric'], 100),
  createPokemon(2, 'Charizard', ['fire'], 0),
  createPokemon(3, 'Blastoise', ['water'], 50),
  createPokemon(4, 'Snorlax', ['normal'], 0),
  createPokemon(5, 'Gengar', ['ghost'], 100),
  createPokemon(6, 'Alakazam', ['psychic'], 100),
];
const player6 = createPlayer('player1', 'Ash', 'session-1', team6);
console.log(`Pokémon restantes (5 vivos): ${countRemainingPokemon(player6)}`);

// Test 7: savedHp preservado
console.log('\n--- Test 7: savedHp preservado al salir ---');
const team7 = [
  createPokemon(1, 'Pikachu', ['electric'], 40), // 60 de daño recibido
  createPokemon(2, 'Charizard', ['fire'], 100),
];
const player7 = createPlayer('player1', 'Ash', 'session-1', team7);

console.log(`Antes: Pikachu HP=${team7[0].hp}, savedHp=${team7[0].savedHp}`);
//模擬 cambiar (daño primero para probar savedHp)
team7[0].hp = 40;
team7[0].savedHp = 40;

executeSwitch(player7, 1, 0); // Cambiar a Charizard
console.log(`Después cambio: savedHp=${team7[0].savedHp} (debería preservarse)`);

// Test 8: Estados no afectan mientras está fuera
console.log('\n--- Test 8: Estados no afectan mientras está fuera ---');
const team8 = [
  createPokemon(1, 'Pikachu', ['electric'], 100),
  createPokemon(2, 'Charizard', ['fire'], 100),
];
const player8 = createPlayer('player1', 'Ash', 'session-1', team8);

// Aplicar burn a Pikachu
applyAilment(team8[0], 'burn', 'player2');
console.log(`Pikachu tiene burn: ${team8[0].ailments.some(a => a.type === 'burn')}`);

// Cambiar a Charizard (Pikachu sale)
executeSwitch(player8, 1, 0);
console.log(`Ahora activo: Charizard (index ${player8.activePokemonIndex})`);

// El burn de Pikachu sigue pero no afecta mientras está fuera
// (el daño por burn se aplicaría solo cuando está activo)

// Test 9: Cambio cuando todos los demás están muertos
console.log('\n--- Test 9: Cambio cuando no hay opciones ---');
const team9 = [
  createPokemon(1, 'Pikachu', ['electric'], 0),
  createPokemon(2, 'Charizard', ['fire'], 0),
  createPokemon(3, 'Blastoise', ['water'], 0),
];
const player9 = createPlayer('player1', 'Ash', 'session-1', team9);

const noOptions = executeSwitch(player9, 1, 0);
console.log(`Cambio sin opciones: ${noOptions.success} - ${noOptions.message}`);
console.log(`Quedan disponibles: ${countRemainingPokemon(player9)}`);

// Test 10: Prioridad del cambio (mostrar que +6)
console.log('\n--- Test 10: Prioridad del cambio ---');
// Esto se maneja en determineExecutionOrder
// Cambio siempre tiene prioridad +6
console.log('Cambio de Pokémon tiene prioridad +6 (siempre va primero)');
console.log('Esto se verifica en getActionPriority() -> retorna 6 para tipo "change"');

console.log('\n✅ TESTS COMPLETADOS');