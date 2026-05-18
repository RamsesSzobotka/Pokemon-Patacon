/**
 * Battle Service - Motor de Batalla de Pokémon Patacon
 * Versión Simplificada (V1) - Solo daño básico
 * 
 * Este módulo implementa:
 * - Sistema de prioridad y orden de acciones
 * - Cálculo de daño básico (sin estados, sin cambios de stats)
 * - Cambio de Pokémon
 * - Ejecución de turnos
 */

import type { 
  BattleState, 
  PokemonInBattle, 
  PlayerBattleState, 
  PlayerAction, 
  ActionResult, 
  TurnResult,
  BattleMove,
  BattlePhase
} from '../types/battle.js';
import { 
  BATTLE_CONFIG
} from '../types/battle.js';
import { getTypeEffectiveness } from '../db/mongodb.js';

// ============================================
// SISTEMA DE PRIORIDAD Y ORDEN
// ============================================

/**
 * Obtiene la prioridad de una acción
 * - Cambio de Pokémon: +6 (siempre ataca primero)
 * - Movimiento: según su priority (0 a 5)
 * - Prioridad negativa: -1 a -7 (siempre ataca último)
 */
export function getActionPriority(action: PlayerAction | null): number {
  if (!action) return -Infinity;
  
  if (action.type === 'change') {
    return BATTLE_CONFIG.PRIORITY_SWITCH; // +6
  }
  
  if (action.type === 'attack' && action.move) {
    return action.move.priority;
  }
  
  return 0;
}

/**
 * Determina el orden de ejecución de las acciones
 * REGLA: Prioridad > Coinflip (solo cuando hay empate)
 * 
 * @returns Orden de ejecución [primero, segundo]
 */
export function determineExecutionOrder(
  action1: PlayerAction | null,
  action2: PlayerAction | null
): { order: ['player1' | 'player2', 'player1' | 'player2']; reason: string; usedCoinflip: boolean } {
  
  const priority1 = getActionPriority(action1);
  const priority2 = getActionPriority(action2);
  
  // CASO A: Prioridades diferentes → el de mayor prioridad va primero
  if (priority1 !== priority2) {
    if (priority1 > priority2) {
      return {
        order: ['player1', 'player2'],
        reason: `player1 tiene mayor prioridad (${priority1} vs ${priority2})`,
        usedCoinflip: false
      };
    } else {
      return {
        order: ['player2', 'player1'],
        reason: `player2 tiene mayor prioridad (${priority2} vs ${priority1})`,
        usedCoinflip: false
      };
    }
  }
  
  // CASO B: Misma prioridad → COINFLIP (50/50)
  const coinResult = coinflip();
  
  if (coinResult === 'player1') {
    return {
      order: ['player1', 'player2'],
      reason: `coinflip (misma prioridad ${priority1})`,
      usedCoinflip: true
    };
  } else {
    return {
      order: ['player2', 'player1'],
      reason: `coinflip (misma prioridad ${priority1})`,
      usedCoinflip: true
    };
  }
}

/**
 * Lanza una moneda para determinar orden cuando hay empate de prioridad
 * Retorna aleatoriamente 'player1' o 'player2'
 */
export function coinflip(): 'player1' | 'player2' {
  return Math.random() < 0.5 ? 'player1' : 'player2';
}

// ============================================
// CÁLCULO DE DAÑO
// ============================================

/**
 * Calcula el daño básico de un movimiento (V1 simplificado)
 * 
 * Fórmula simplificada:
 * Daño = (((2 * Nivel / 5 + 2) * Poder * (Ataque / Defensa) / 50) + 2) * STAB * Tipo * Aleatorio
 * 
 * Sin estados, sin críticos, sin quemadura
 */
export function calculateDamage(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): { damage: number; effectiveness: number } {
  
  // Ignorar si el movimiento no causa daño
  if (!move.power || move.power === 0 || move.damageClass === 'status') {
    return { damage: 0, effectiveness: 1 };
  }
  
  const level = BATTLE_CONFIG.LEVEL;
  const power = move.power;
  
  // Determinar Attack y Defense según tipo de movimiento
  let attack: number;
  let defense: number;
  
  if (move.damageClass === 'physical') {
    attack = attacker.attack;
    defense = defender.defense;
  } else {
    attack = attacker.spAttack;
    defense = defender.spDefense;
  }
  
  // Calcular STAB (Same Type Attack Bonus)
  const stab = attacker.types.includes(move.type) ? BATTLE_CONFIG.STAB_MULTIPLIER : 1;
  
  // Calcular efectividad de tipos
  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  
  // Aleatorio (85% - 100%)
  const random = BATTLE_CONFIG.DAMAGE_RANDOM_MIN + 
    Math.random() * (BATTLE_CONFIG.DAMAGE_RANDOM_MAX - BATTLE_CONFIG.DAMAGE_RANDOM_MIN);
  
  // Fórmula base
  const baseDamage = (((((2 * level) / 5 + 2) * power * (attack / defense)) / 50) + 2);
  
  // Aplicar todos los modificadores (sin crítico, sin burn)
  const finalDamage = Math.floor(baseDamage * stab * effectiveness * random);
  
  return {
    damage: Math.max(1, finalDamage), // Mínimo 1 de daño
    effectiveness
  };
}

// ============================================
// EJECUCIÓN DE MOVIMIENTOS
// ============================================

/**
 * Ejecuta un movimiento de ataque (V1 simplificado - solo daño básico)
 * Sin estados, sin flinch, sin cambios de stats, sin movimientos de carga
 */
export function executeMove(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove,
  attackerPlayerId: 'player1' | 'player2'
): ActionResult {
  
  // Verificar accuracy
  if (move.accuracy && Math.random() * 100 > move.accuracy) {
    return {
      success: false,
      action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
      message: `¡${attacker.name} intentó usar ${move.name}, pero falló!`,
      failed: true,
      failureReason: 'miss'
    };
  }
  
  // Ignorar movimientos que no causan daño
  if (!move.power || move.power === 0 || move.damageClass === 'status') {
    return {
      success: true,
      action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
      message: `¡${attacker.name} usó ${move.name}! Pero... ¡No tuvo efecto!`,
      failed: false
    };
  }
  
  // Calcular daño (versión básica)
  const { damage, effectiveness } = calculateDamage(attacker, defender, move);
  
  // Aplicar daño
  const hpBefore = defender.hp;
  defender.hp = Math.max(0, defender.hp - damage);
  const hpAfter = defender.hp;
  
  // Construir mensaje narrativo
  let message = `¡${attacker.name} usó ${move.name}!`;
  
  // Agregar efectividad del ataque
  if (effectiveness > 1) {
    message += '\n¡Es muy efectivo!';
  } else if (effectiveness < 1 && effectiveness > 0) {
    message += '\nNo es muy efectivo...';
  } else if (effectiveness === 0) {
    message += '\n¡No tiene efecto!';
  }
  
  // Mostrar daño
  message += `\n¡${defender.name} recibió ${damage} de daño!`;
  
  // Verificar si se debilitó
  const fainted = hpAfter <= 0;
  if (fainted) {
    defender.isFainted = true;
    message += `\n¡${defender.name} se debilitó!`;
  }
  
  return {
    success: true,
    action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
    message,
    damage,
    targetHpBefore: hpBefore,
    targetHpAfter: hpAfter,
    effectiveness,
    failed: fainted,
    // Información adicional para el frontend
    attackerName: attacker.name,
    defenderName: defender.name,
    moveName: move.name
  };
}

/**
 * Ejecuta un cambio de Pokémon
 */
export function executeSwitch(
  player: PlayerBattleState,
  newPokemonIndex: number,
  previousPokemonIndex: number
): { success: boolean; message: string; pokemon?: PokemonInBattle } {
  
  const newPokemon = player.team[newPokemonIndex];
  const previousPokemon = player.team[previousPokemonIndex];
  
  // Verificar que el Pokémon tenga HP
  if (newPokemon.isFainted || newPokemon.hp <= 0) {
    return { 
      success: false, 
      message: `¡${newPokemon.name} no puede luchar, está sin fuerzas!` 
    };
  }
  
  // Guardar HP del Pokémon actual antes de salir
  previousPokemon.savedHp = previousPokemon.hp;
  
  // Cambiar al nuevo Pokémon
  player.activePokemonIndex = newPokemonIndex;
  
  // El nuevo Pokémon mantiene sus estados, pero no afectan mientras está fuera
  // (los efectos como burn/poison ya no reducen HP cuando vuelve a salir)
  // Nota: según SPEC, los estados no se eliminan al cambiar
  
  return {
    success: true,
    message: `¡${player.name} cambió a ${newPokemon.name}!\n¡Adelante, ${newPokemon.name}!`,
    pokemon: newPokemon
  };
}

// ============================================
// VERIFICACIÓN DE ESTADO DE BATALLA
// ============================================

/**
 * Verifica si un jugador tiene Pokémon disponibles
 */
export function hasAvailablePokemon(player: PlayerBattleState): boolean {
  return player.team.some(p => !p.isFainted && p.hp > 0);
}

/**
 * Cuenta los Pokémon restantes de un jugador
 */
export function countRemainingPokemon(player: PlayerBattleState): number {
  return player.team.filter(p => !p.isFainted && p.hp > 0).length;
}

/**
 * Verifica si la batalla terminó y determina el ganador
 */
export function checkBattleEnd(
  player1: PlayerBattleState,
  player2: PlayerBattleState
): { ended: boolean; winner: 'player1' | 'player2' | null; message: string } {
  
  const p1HasPokemon = hasAvailablePokemon(player1);
  const p2HasPokemon = hasAvailablePokemon(player2);
  
  if (!p1HasPokemon && !p2HasPokemon) {
    return { ended: true, winner: null, message: '¡Empate! Ambos entrenadores se quedan sin Pokémon.' };
  }
  
  if (!p1HasPokemon) {
    return { ended: true, winner: 'player2', message: `¡${player2.name} ha ganado la batalla!\n¡Todos los Pokémon de ${player1.name} se debilitaron!` };
  }
  
  if (!p2HasPokemon) {
    return { ended: true, winner: 'player1', message: `¡${player1.name} ha ganado la batalla!\n¡Todos los Pokémon de ${player2.name} se debilitaron!` };
  }
  
  return { ended: false, winner: null, message: '' };
}

// ============================================
// CREACIÓN DE ESTADO DE BATALLA
// ============================================

/**
 * Crea un nuevo estado de batalla a partir de los equipos
 */
export function createBattleState(
  roomCode: string,
  player1: PlayerBattleState,
  player2: PlayerBattleState
): BattleState {
  return {
    roomCode,
    turn: 1,
    phase: 'selecting',
    state: 'in_progress',
    players: {
      player1,
      player2
    },
    pendingActions: {
      player1: null,
      player2: null
    },
    executionOrder: [],
    actionResults: [],
    history: [],
    nextTurnAilments: {
      player1: [],
      player2: []
    },
    currentMessage: '¡La batalla comienza!',
    requiresSwitchFor: null,
    winner: null
  };
}

/**
 * Crea un PlayerBattleState a partir de un equipo de Pokémon
 */
export function createPlayerBattleState(
  playerId: 'player1' | 'player2',
  name: string,
  sessionId: string,
  team: any[] // Array de Pokémon del draft
): PlayerBattleState {
  
  const battleTeam: PokemonInBattle[] = team.map((pokemon, index) => ({
    id: index + 1,
    pokeapiId: pokemon.pokeapi_id || pokemon.pokeapiId,
    name: pokemon.name,
    types: pokemon.types || [],
    hp: pokemon.stats?.hp || 100,
    maxHp: pokemon.stats?.hp || 100,
    attack: pokemon.stats?.attack || 50,
    defense: pokemon.stats?.defense || 50,
    spAttack: pokemon.stats?.sp_attack || 50,
    spDefense: pokemon.stats?.sp_defense || 50,
    sprites: pokemon.sprites || { front_default: null, back_default: null, front_shiny: null, back_shiny: null },
    moveIds: pokemon.move_ids || pokemon.moveIds || [],
    moves: pokemon.moves || [], // ← Agregar movimientos del equipo
    ailments: [],
    isCharging: false,
    chargingMoveId: undefined,
    cannotActNextTurn: false,
    hasFlinched: false,
    isFainted: false,
    savedHp: pokemon.stats?.hp || 100
  }));
  
  return {
    playerId,
    name,
    sessionId,
    team: battleTeam,
    activePokemonIndex: 0,
    hasSelectedAction: false
  };
}