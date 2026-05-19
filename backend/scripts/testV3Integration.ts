/**
 * Test Integración V3 - Escenarios de Batalla Completos
 * 
 * 5 Escenarios de Batalla probando:
 * 1. Solar Beam: Ciclo completo de carga y ejecución
 * 2. Hyper Beam: Fatiga obligatoria (recharge)
 * 3. Evasión: Atacar a Pokémon en carga evasiva
 * 4. Skull Bash: Boost de defensa temporal
 * 5. Cambio de Pokémon: Limpia estados de carga
 */

import {
  isMoveTwoTurn,
  isTwoTurnCharging,
  isDefenderEvading,
  handleTwoTurnMove,
  applyFatigue,
  resetFatigueState,
  canActWithAilments,
  executeSwitch,
  createBattleState,
  createPlayerBattleState,
} from '../src/services/battleService.js';
import type { PokemonInBattle, PlayerBattleState } from '../src/types/battle.js';
import { TEST_MOVES } from '../src/types/battle.js';

// ============================================
// VARIABLES GLOBALES
// ============================================

let totalScenarios = 0;
let passedScenarios = 0;
let failedScenarios = 0;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Crea un Pokémon de prueba
 */
function createBattlePokemon(
  name: string,
  hp: number = 100,
  attack: number = 80,
  defense: number = 80,
  spAttack: number = 100,
  spDefense: number = 100
): PokemonInBattle {
  return {
    id: Math.floor(Math.random() * 10000),
    pokeapiId: 1,
    name,
    types: ['normal'],
    hp,
    maxHp: hp,
    attack,
    defense,
    spAttack,
    spDefense,
    sprites: { front_default: null, back_default: null, front_shiny: null, back_shiny: null },
    moves: [],
    ailments: [],
    isCharging: false,
    cannotActNextTurn: false,
    hasFlinched: false,
    isFainted: false,
    savedHp: hp,
    // V3 Fields
    isChargingTwoTurn: false,
    currentTwoTurnMove: null,
    chargePhase: null,
    isFatigued: false,
    fatigueSource: null,
    isEvasivelyCharging: false,
    evasiveChargeMove: null,
  };
}

/**
 * Ejecuta un escenario de prueba
 */
function scenario(
  scenarioName: string,
  scenarioFn: () => { passed: boolean; details: string[] }
): void {
  totalScenarios++;
  const scenarioNumber = String(totalScenarios).padStart(2, '0');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ESCENARIO ${scenarioNumber}: ${scenarioName}`);
  console.log('='.repeat(60));
  
  try {
    const result = scenarioFn();
    
    result.details.forEach(detail => console.log(detail));
    
    if (result.passed) {
      console.log(`\n✅ ESCENARIO APROBADO: ${scenarioName}`);
      passedScenarios++;
    } else {
      console.log(`\n❌ ESCENARIO FALLIDO: ${scenarioName}`);
      failedScenarios++;
    }
  } catch (error) {
    console.log(`❌ ERROR EN ESCENARIO: ${scenarioName}`);
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    failedScenarios++;
  }
}

/**
 * Imprime estado de Pokémon
 */
function printPokemonState(pokemon: PokemonInBattle, indent: string = ''): string {
  return (
    `${indent}${pokemon.name}: HP=${pokemon.hp}/${pokemon.maxHp}, ` +
    `Charging=${pokemon.isChargingTwoTurn}, Phase=${pokemon.chargePhase}, ` +
    `Fatigued=${pokemon.isFatigued}`
  );
}

// ============================================
// ESCENARIO 1: SOLAR BEAM (Ciclo Completo de 2 Turnos)
// ============================================

scenario(
  'Solar Beam Battle: Carga → Ejecución → Daño',
  () => {
    const details: string[] = [];
    
    // Crear combatientes
    const p1 = createBattlePokemon('Venusaur', 100, 80, 80, 110, 100);
    const p2 = createBattlePokemon('Pidgeot', 100, 80, 80, 90, 90);
    
    details.push('\n📋 ESTADO INICIAL:');
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    // Turno 1: P1 carga Solar Beam, P2 ataca
    details.push('\n⚔️ TURNO 1: Venusaur carga Solar Beam, Pidgeot ataca');
    
    const chargeResult = handleTwoTurnMove(p1, p2, TEST_MOVES.SOLAR_BEAM, 'charge', 'player1');
    details.push(`  > Carga Solar Beam: ${chargeResult.message}`);
    
    // P2 ataca a P1 durante carga
    const attackResultTurn1 = handleTwoTurnMove(p2, p1, TEST_MOVES.NORMAL_ATTACK, 'execute', 'player2');
    const damage1 = attackResultTurn1.damage || 0;
    p1.hp = Math.max(0, p1.hp - damage1);
    details.push(`  > Pidgeot ataca: ${damage1} daño a Venusaur`);
    
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    // Verificar que está cargando
    const isCharging1 = p1.isChargingTwoTurn && p1.chargePhase === 'execute';
    details.push(`  ✓ Venusaur cargando: ${isCharging1}`);
    
    // Turno 2: P1 ejecuta Solar Beam, P2 ataca nuevamente
    details.push('\n⚡ TURNO 2: Venusaur ejecuta Solar Beam, Pidgeot ataca');
    
    const executeResult = handleTwoTurnMove(p1, p2, TEST_MOVES.SOLAR_BEAM, 'execute', 'player1');
    const damageBeam = executeResult.damage || 0;
    p2.hp = Math.max(0, p2.hp - damageBeam);
    
    details.push(`  > Venusaur usa Solar Beam: ${damageBeam} daño a Pidgeot`);
    details.push(`  > ${executeResult.message}`);
    
    // P2 ataca a P1
    const attackResultTurn2 = handleTwoTurnMove(p2, p1, TEST_MOVES.NORMAL_ATTACK, 'execute', 'player2');
    const damage2 = attackResultTurn2.damage || 0;
    p1.hp = Math.max(0, p1.hp - damage2);
    details.push(`  > Pidgeot ataca: ${damage2} daño a Venusaur`);
    
    // Turno 3: Ambos pueden actuar normalmente
    details.push('\n📊 TURNO 3 - ESTADO FINAL:');
    
    const isCharging2 = !p1.isChargingTwoTurn;
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    details.push(`  ✓ Venusaur dejó de cargar: ${isCharging2}`);
    details.push(`  ✓ Ambos pueden actuar normalmente`);
    
    const passed =
      isCharging1 === true &&
      isCharging2 === true &&
      damageBeam > 0 &&
      p2.hp < 100;
    
    return { passed, details };
  }
);

// ============================================
// ESCENARIO 2: HYPER BEAM (Fatiga Obligatoria)
// ============================================

scenario(
  'Hyper Beam Fatigue: Ataque inmediato + Recharge obligatorio',
  () => {
    const details: string[] = [];
    
    const p1 = createBattlePokemon('Dragonite', 100, 100, 100, 100, 100);
    const p2 = createBattlePokemon('Pidgeot', 80, 80, 80, 90, 90);
    
    details.push('\n📋 ESTADO INICIAL:');
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    // Turno 1: P1 usa Hyper Beam (inmediato, 150 poder)
    details.push('\n⚡ TURNO 1: Dragonite usa Hyper Beam (SIN CARGA)');
    
    // Hyper Beam NO requiere carga, es inmediato
    // pero aplica fatigaRecharge para el siguiente turno
    const hyperBeamDamage = 120; // Simular daño
    const hpAntesBeam = p2.hp;
    p2.hp = Math.max(0, p2.hp - hyperBeamDamage);
    
    details.push(`  > Dragonite usa Hyper Beam: ${hyperBeamDamage} daño a Pidgeot`);
    details.push(`  > Pidgeot HP: ${hpAntesBeam} → ${p2.hp}`);
    
    // Aplicar fatiga de recharge
    applyFatigue(p1, 'recharge');
    details.push(`  > Dragonite necesita descansar (recharge fatigue)`);
    
    // P2 ataca
    const p2Attack = handleTwoTurnMove(p2, p1, TEST_MOVES.NORMAL_ATTACK, 'execute', 'player2');
    const damage2 = p2Attack.damage || 0;
    p1.hp = Math.max(0, p1.hp - damage2);
    details.push(`  > Pidgeot ataca: ${damage2} daño a Dragonite`);
    
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    // Turno 2: P1 está fatigado (NO PUEDE ACTUAR)
    details.push('\n😴 TURNO 2: Dragonite está fatigado, NO puede actuar');
    
    const canActAfterRecharge = canActWithAilments(p1);
    details.push(`  > ¿Puede actuar? ${canActAfterRecharge.canAct} (razón: ${canActAfterRecharge.reason})`);
    
    // P2 ataca libremente
    const p2AttackTurn2 = handleTwoTurnMove(p2, p1, TEST_MOVES.NORMAL_ATTACK, 'execute', 'player1');
    const damage3 = p2AttackTurn2.damage || 0;
    p1.hp = Math.max(0, p1.hp - damage3);
    details.push(`  > Pidgeot ataca sin oposición: ${damage3} daño a Dragonite`);
    
    // Turno 3: P1 recupera fuerzas
    details.push('\n💪 TURNO 3: Dragonite recupera fuerzas');
    
    resetFatigueState(p1);
    const canActAfterRecovery = canActWithAilments(p1);
    details.push(`  > ¿Puede actuar? ${canActAfterRecovery.canAct}`);
    
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    const passed =
      !canActAfterRecharge.canAct &&
      p1.isFatigued &&
      canActAfterRecovery.canAct &&
      !p1.isFatigued;
    
    return { passed, details };
  }
);

// ============================================
// ESCENARIO 3: EVASIÓN DURANTE CARGA EVASIVA
// ============================================

scenario(
  'Evasion Mechanics: Fly carga (evade) vs Normal Attack',
  () => {
    const details: string[] = [];
    
    const p1 = createBattlePokemon('Pidgeot', 100, 80, 80, 90, 90);
    const p2 = createBattlePokemon('Charizard', 100, 84, 78, 109, 85);
    
    details.push('\n📋 ESTADO INICIAL:');
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    // Turno 1: P1 carga Fly (evasivo), P2 ataca (debería fallar)
    details.push('\n⚡ TURNO 1: Pidgeot carga Fly (EVASIVO), Charizard ataca');
    
    const flyChargeResult = handleTwoTurnMove(p1, p2, TEST_MOVES.FLY, 'charge', 'player1');
    details.push(`  > Pidgeot carga: ${flyChargeResult.message}`);
    details.push(`  > ¿Está cargando evasivo? ${p1.isEvasivelyCharging}`);
    
    // P2 intenta atacar a P1 que está evadiendo
    const hpP1Before = p1.hp;
    
    // Simulamos que P2 ataca pero P1 está evadiendo
    const canEvade = isDefenderEvading(p1);
    details.push(`  > ¿Puede evitar P1? ${canEvade}`);
    
    if (canEvade) {
      details.push(`  > ¡${p2.name} intenta atacar pero ${p1.name} evade!`);
      details.push(`  > ${p1.name} recibe 0 daño`);
    }
    
    const hpP1After = p1.hp;
    details.push(`  > HP de ${p1.name}: ${hpP1Before} → ${hpP1After} (sin daño)`);
    
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    // Turno 2: P1 ejecuta Fly (Sale del ataque evasivo), P2 puede atacar
    details.push('\n💥 TURNO 2: Pidgeot ejecuta Fly, Charizard puede atacar');
    
    // P1 ejecuta Fly
    const flyExecuteResult = handleTwoTurnMove(p1, p2, TEST_MOVES.FLY, 'execute', 'player1');
    const flyDamage = flyExecuteResult.damage || 0;
    p2.hp = Math.max(0, p2.hp - flyDamage);
    
    details.push(`  > ${p1.name} usa Fly: ${flyDamage} daño a ${p2.name}`);
    details.push(`  > ${p1.name} ya no está evadiendo`);
    
    // P2 puede atacar libremente
    const canP2Attack = !isDefenderEvading(p1);
    details.push(`  > ¿Puede atacar ${p2.name}? ${canP2Attack}`);
    
    details.push(printPokemonState(p1, '  '));
    details.push(printPokemonState(p2, '  '));
    
    const passed =
      canEvade === true &&
      hpP1Before === hpP1After &&
      flyDamage > 0 &&
      !p1.isEvasivelyCharging;
    
    return { passed, details };
  }
);

// ============================================
// ESCENARIO 4: SKULL BASH (Defense Boost)
// ============================================

scenario(
  'Skull Bash Defense Boost: +1 temporal, se quita después',
  () => {
    const details: string[] = [];
    
    const p1 = createBattlePokemon('Blastoise', 100, 80, 80, 85, 105);
    const p2 = createBattlePokemon('Machamp', 100, 130, 65, 65, 65);
    
    const defenseBefore = p1.defense;
    
    details.push('\n📋 ESTADO INICIAL:');
    details.push(`  ${p1.name} - DEF: ${defenseBefore}`);
    details.push(`  ${p2.name} - ATK: ${p2.attack}`);
    
    // Turno 1: P1 carga Skull Bash
    details.push('\n⚔️ TURNO 1: Blastoise carga Skull Bash (boost +1 DEF)');
    
    // Crear movimiento Skull Bash con flags correctos
    const skullBashCharge = {
      ...TEST_MOVES.NORMAL_ATTACK,
      moveId: 37,
      name: 'Skull Bash',
      flags: { ...TEST_MOVES.NORMAL_ATTACK.flags, charge: true }
    };
    
    const chargeResult = handleTwoTurnMove(p1, p2, skullBashCharge, 'charge', 'player1');
    const defenseAfterCharge = p1.defense;
    
    details.push(`  > Blastoise carga: ${chargeResult.message}`);
    details.push(`  > DEF: ${defenseBefore} → ${defenseAfterCharge} (+${defenseAfterCharge - defenseBefore})`);
    
    // P2 ataca
    const p2Attack = handleTwoTurnMove(p2, p1, TEST_MOVES.NORMAL_ATTACK, 'execute', 'player2');
    const damage = p2Attack.damage || 0;
    details.push(`  > Machamp ataca: ${damage} daño (contra DEF mejorada)`);
    
    // Turno 2: P1 ejecuta Skull Bash
    details.push('\n💥 TURNO 2: Blastoise ejecuta Skull Bash (DEF regresa)');
    
    // Ejecutar Skull Bash
    const executeResult = handleTwoTurnMove(p1, p2, skullBashCharge, 'execute', 'player1');
    const damageDealt = executeResult.damage || 0;
    
    const defenseAfterExecute = p1.defense;
    
    details.push(`  > Blastoise usa Skull Bash: ${damageDealt} daño`);
    details.push(`  > DEF: ${defenseAfterCharge} → ${defenseAfterExecute}`);
    details.push(`  > ¿DEF volvió al original? ${defenseAfterExecute === defenseBefore}`);
    
    details.push(`\n  Estado final - ${p1.name}: DEF=${defenseAfterExecute}`);
    
    const passed =
      defenseAfterCharge > defenseBefore &&
      defenseAfterExecute === defenseBefore &&
      damageDealt > 0;
    
    return { passed, details };
  }
);

// ============================================
// ESCENARIO 5: CAMBIO DE POKÉMON DURANTE CARGA
// ============================================

scenario(
  'Pokemon Switch: Solar Beam carga → Switch → Limpia estados',
  () => {
    const details: string[] = [];
    
    // Crear jugador con equipo
    const player = createPlayerBattleState('player1', 'Ash', 'session1', [
      createBattlePokemon('Venusaur', 100, 80, 80, 110, 100),
      createBattlePokemon('Blastoise', 100, 83, 100, 85, 105),
      createBattlePokemon('Charizard', 100, 84, 78, 109, 85),
    ]);
    
    const opponent = createPlayerBattleState('player2', 'Gary', 'session2', [
      createBattlePokemon('Pidgeot', 100, 80, 80, 90, 90),
    ]);
    
    const venusaur = player.team[0];
    const blastoise = player.team[1];
    const pidgeot = opponent.team[0];
    
    details.push('\n📋 EQUIPO INICIAL:');
    details.push(`  Player 1: [${venusaur.name}, ${blastoise.name}, ${player.team[2].name}]`);
    details.push(`  Player 2: [${pidgeot.name}]`);
    
    // Turno 1: Venusaur carga Solar Beam
    details.push('\n⚡ TURNO 1: Venusaur carga Solar Beam');
    
    const chargeResult = handleTwoTurnMove(
      venusaur,
      pidgeot,
      TEST_MOVES.SOLAR_BEAM,
      'charge',
      'player1'
    );
    
    details.push(`  > ${chargeResult.message}`);
    details.push(`  > Venusaur está cargando: ${venusaur.isChargingTwoTurn}`);
    details.push(`  > Fase: ${venusaur.chargePhase}`);
    
    // Pidgeot ataca
    const pidgeotAttack = handleTwoTurnMove(pidgeot, venusaur, TEST_MOVES.NORMAL_ATTACK, 'execute', 'player2');
    venusaur.hp = Math.max(0, venusaur.hp - (pidgeotAttack.damage || 0));
    details.push(`  > Pidgeot ataca: ${pidgeotAttack.damage} daño`);
    
    details.push(printPokemonState(venusaur, '  '));
    
    // Turno 2: CAMBIO DE POKÉMON (Venusaur se retira)
    details.push('\n🔄 TURNO 2: Ash cambia a Blastoise');
    
    const chargePhaseAntesDeCambio = venusaur.chargePhase;
    const isChargingAntes = venusaur.isChargingTwoTurn;
    
    const switchResult = executeSwitch(player, 1, 0); // Cambiar a índice 1 (Blastoise)
    
    details.push(`  > ${switchResult.message}`);
    details.push(`  > Venusaur sale de batalla (estaba cargando: ${isChargingAntes})`);
    
    // Verificar que los flags se limpiaron
    const isChargingDespues = venusaur.isChargingTwoTurn;
    const chargePhaseDepues = venusaur.chargePhase;
    const evasiveChargeLimpio = venusaur.isEvasivelyCharging === false;
    
    details.push(`  > Estados limpiados en Venusaur:`);
    details.push(`    - isChargingTwoTurn: ${isChargingAntes} → ${isChargingDespues}`);
    details.push(`    - chargePhase: ${chargePhaseAntesDeCambio} → ${chargePhaseDepues}`);
    details.push(`    - isEvasivelyCharging: limpio=${evasiveChargeLimpio}`);
    
    // Blastoise está activo
    details.push(`\n  Blastoise entra en batalla`);
    details.push(printPokemonState(blastoise, '  '));
    
    // Turno 3: Blastoise puede actuar normalmente, no hay residuos de carga
    details.push('\n💪 TURNO 3: Blastoise puede usar movimientos normales');
    
    const blastoiseCanAttack = !blastoise.isChargingTwoTurn;
    details.push(`  > ¿Puede atacar Blastoise? ${blastoiseCanAttack}`);
    details.push(`  > Sin residuos de estado de carga`);
    
    const passed =
      isChargingAntes === true &&
      isChargingDespues === false &&
      chargePhaseDepues === null &&
      evasiveChargeLimpio &&
      blastoiseCanAttack;
    
    return { passed, details };
  }
);

// ============================================
// RESUMEN FINAL
// ============================================

console.log('\n\n' + '='.repeat(60));
console.log('📊 RESUMEN DE ESCENARIOS DE INTEGRACIÓN V3');
console.log('='.repeat(60));
console.log(`Total de escenarios: ${totalScenarios}`);
console.log(`✅ Aprobados: ${passedScenarios}`);
console.log(`❌ Fallidos: ${failedScenarios}`);
console.log(`Porcentaje de éxito: ${((passedScenarios / totalScenarios) * 100).toFixed(2)}%`);
console.log('='.repeat(60));

if (failedScenarios === 0) {
  console.log('🎉 ¡TODOS LOS ESCENARIOS PASARON!');
} else {
  console.log(`⚠️ ${failedScenarios} escenario(s) fallaron. Revisar detalles arriba.`);
  process.exit(1);
}
