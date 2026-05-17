/**
 * Battle Service - Motor de Batalla de Pokémon Patacon
 * Gestiona la lógica de combate 1v1 según SPEC_BATALLA_V2.md
 * 
 * Este módulo implementa:
 * - Sistema de prioridad y orden de acciones
 * - Cálculo de daño
 * - Sistema de estados (ailments)
 * - Movimientos especiales (2 turnos, multi-hit)
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
  AilmentType,
  BattleMove,
  BattlePhase
} from '../types/battle.js';
import { 
  BATTLE_CONFIG, 
  CHARGE_MOVES, 
  RECHARGE_MOVES, 
  MULTI_HIT_MOVES 
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
): { order: ['player1' | 'player2', 'player1' | 'player2']; reason: string } {
  
  const priority1 = getActionPriority(action1);
  const priority2 = getActionPriority(action2);
  
  // CASO A: Prioridades diferentes → el de mayor prioridad va primero
  if (priority1 !== priority2) {
    if (priority1 > priority2) {
      return {
        order: ['player1', 'player2'],
        reason: `player1 tiene mayor prioridad (${priority1} vs ${priority2})`
      };
    } else {
      return {
        order: ['player2', 'player1'],
        reason: `player2 tiene mayor prioridad (${priority2} vs ${priority1})`
      };
    }
  }
  
  // CASO B: Misma prioridad → COINFLIP (50/50)
  const coinResult = coinflip();
  
  if (coinResult === 'player1') {
    return {
      order: ['player1', 'player2'],
      reason: `coinflip (misma prioridad ${priority1})`
    };
  } else {
    return {
      order: ['player2', 'player1'],
      reason: `coinflip (misma prioridad ${priority1})`
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
 * Calcula el daño de un movimiento según la fórmula de Pokémon
 * 
 * Fórmula:
 * Daño = (((2 * Nivel / 5 + 2) * Poder * (Ataque / Defensa) / 50) + 2) * STAB * Tipo * Aleatorio
 * 
 * Modificadores adicionales:
 * - Burn: 50% de poder para movimientos físicos
 * - Aleatorio: 0.85 a 1.00
 */
export function calculateDamage(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): { damage: number; isCritical: boolean; effectiveness: number } {
  
  // Ignorar si el movimiento no causa daño
  if (!move.power || move.power === 0 || move.damageClass === 'status') {
    return { damage: 0, isCritical: false, effectiveness: 1 };
  }
  
  const level = BATTLE_CONFIG.LEVEL;
  const power = move.power;
  
  // DeterminarAttack y Defense según tipo de movimiento
  let attack: number;
  let defense: number;
  
  if (move.damageClass === 'physical') {
    attack = attacker.attack;
    defense = defender.defense;
  } else {
    attack = attacker.spAttack;
    defense = defender.spDefense;
  }
  
  // Aplicar modificador de quemadura (50% para físicos)
  let powerModifier = 1;
  if (hasAilment(attacker, 'burn') && move.damageClass === 'physical') {
    powerModifier = BATTLE_CONFIG.BURN_PHYSICAL_MODIFIER; // 0.5
  }
  
  // CalcularSTAB (Same Type Attack Bonus)
  const stab = attacker.types.includes(move.type) ? BATTLE_CONFIG.STAB_MULTIPLIER : 1;
  
  // Calcular efectividad de tipos
  const effectiveness = getTypeEffectiveness(move.type, defender.types);
  
  // Aleatorio (85% - 100%)
  const random = BATTLE_CONFIG.DAMAGE_RANDOM_MIN + 
    Math.random() * (BATTLE_CONFIG.DAMAGE_RANDOM_MAX - BATTLE_CONFIG.DAMAGE_RANDOM_MIN);
  
  // Fórmula base
  // (((2 * 50 / 5 + 2) * Poder * (Atk / Def) / 50) + 2)
  // = (((20 + 2) * Poder * (Atk/Def) / 50) + 2)
  // = ((22 * Poder * (Atk/Def) / 50) + 2)
  const baseDamage = (((((2 * level) / 5 + 2) * power * (attack / defense)) / 50) + 2);
  
  // Aplicar todos los modificadores
  const finalDamage = Math.floor(
    baseDamage * powerModifier * stab * effectiveness * random
  );
  
  // Crítico (6.25% de probabilidad - etapa 1)
  const isCritical = Math.random() < 0.0625;
  
  const finalDamageWithCrit = isCritical ? Math.floor(finalDamage * 1.5) : finalDamage;
  
  return {
    damage: Math.max(1, finalDamageWithCrit), // Mínimo 1 de daño
    isCritical,
    effectiveness
  };
}

// ============================================
// SISTEMA DE ESTADOS (AILMENTS)
// ============================================

/**
 * Verifica si un Pokémon tiene un estado específico
 */
export function hasAilment(pokemon: PokemonInBattle, ailment: AilmentType): boolean {
  return pokemon.ailments.some(a => a.type === ailment);
}

/**
 * Aplica un estado a un Pokémon
 */
export function applyAilment(
  pokemon: PokemonInBattle,
  ailmentType: AilmentType,
  appliedBy: 'player1' | 'player2'
): { success: boolean; message: string } {
  
  // Verificar si ya tiene ese estado
  if (hasAilment(pokemon, ailmentType)) {
    return { success: false, message: `${pokemon.name} ya tiene ${ailmentType}` };
  }
  
  // Verificar inmunidad
  if (isImmuneToAilment(pokemon, ailmentType)) {
    return { success: false, message: `${pokemon.name} es immune a ${ailmentType}` };
  }
  
  const ailment = {
    type: ailmentType,
    turnsRemaining: BATTLE_CONFIG.DEFAULT_AILMENT_TURNS,
    appliedBy,
    ...(ailmentType === 'toxic' && { toxicTurn: 1 })
  };
  
  pokemon.ailments.push(ailment);
  
  return { success: true, message: `${pokemon.name} ahora tiene ${ailmentType}` };
}

/**
 * Verifica si un Pokémon es immune a un estado
 */
function isImmuneToAilment(pokemon: PokemonInBattle, ailment: string): boolean {
  const immunityRules: Record<string, string[]> = {
    burn: ['fire'],
    poison: ['steel'],
    toxic: ['steel'],
    paralysis: [],
    freeze: ['ice'],
    sleep: [],
    confusion: [],
    flinch: [],
    leech_seed: [],
    curse: []
  };
  
  // Verificar si el tipo de estado es válido
  if (!immunityRules[ailment]) {
    return false;
  }
  
  const immuneTypes = immunityRules[ailment];
  return immuneTypes.some(type => pokemon.types.includes(type));
}

/**
 * Verifica si un Pokémon puede actuar este turno
 * Considera: paralysis (25%), freeze (80%), sleep, flinch, fatiga
 */
export function canPokemonAct(pokemon: PokemonInBattle): { canAct: boolean; reason: string; selfHit: boolean } {
  
  // Verificar si está fuera de combate
  if (pokemon.isFainted || pokemon.hp <= 0) {
    return { canAct: false, reason: 'Pokémon desfallecido', selfHit: false };
  }
  
  // Verificar si está cargando un movimiento
  if (pokemon.isCharging) {
    return { canAct: true, reason: 'Completando movimiento de carga', selfHit: false };
  }
  
  // Verificar si no puede actuar por fatiga
  if (pokemon.cannotActNextTurn) {
    return { canAct: false, reason: 'Agotado (necesita descansar)', selfHit: false };
  }
  
  // Verificar flinch
  if (pokemon.hasFlinched) {
    pokemon.hasFlinched = false; // Consumir efecto
    return { canAct: false, reason: 'Retrocedió del miedo', selfHit: false };
  }
  
  // Verificar estados
  for (const ailment of pokemon.ailments) {
    switch (ailment.type) {
      case 'paralysis':
        // 25% de no actuar
        if (Math.random() < BATTLE_CONFIG.PARALYSIS_FREEZE_CHANCE) {
          return { canAct: false, reason: 'Paralizado (no puede moverse)', selfHit: false };
        }
        break;
        
      case 'freeze':
        // 80% de permanecer congelado
        if (Math.random() < (1 - BATTLE_CONFIG.FREEZE_UNFREEZE_CHANCE)) {
          return { canAct: false, reason: 'Congelado (no puede moverse)', selfHit: false };
        } else {
          // Se descongeló - quitar estado
          pokemon.ailments = pokemon.ailments.filter(a => a.type !== 'freeze');
        }
        break;
        
      case 'sleep':
        if (ailment.turnsRemaining > 0) {
          return { canAct: false, reason: 'Dormido (no puede moverse)', selfHit: false };
        } else {
          // Despertó - quitar estado
          pokemon.ailments = pokemon.ailments.filter(a => a.type !== 'sleep');
        }
        break;
        
      case 'confusion':
        // 33% de atacarse a sí mismo
        if (Math.random() < BATTLE_CONFIG.CONFUSION_SELF_HIT_CHANCE) {
          return { canAct: true, reason: 'Confuso (se atacó a sí mismo)', selfHit: true };
        }
        break;
    }
  }
  
  return { canAct: true, reason: '', selfHit: false };
}

/**
 * Obtiene el daño por estado que se aplica al final del turno
 */
export function getAilmentDamagePerTurn(pokemon: PokemonInBattle): number {
  let totalDamage = 0;
  
  for (const ailment of pokemon.ailments) {
    const maxHp = pokemon.maxHp;
    
    switch (ailment.type) {
      case 'burn':
      case 'poison':
        totalDamage += Math.floor(maxHp * BATTLE_CONFIG.BURN_DAMAGE);
        break;
        
      case 'toxic':
        // Daño acumulativo: 5%, 10%, 15%, 20%, ...
        const toxicDamage = Math.floor(maxHp * BATTLE_CONFIG.TOXIC_BASE_DAMAGE * (ailment.toxicTurn || 1));
        totalDamage += toxicDamage;
        break;
        
      case 'leech_seed':
        totalDamage += Math.floor(maxHp * BATTLE_CONFIG.LEECH_SEED_DAMAGE);
        break;
        
      case 'curse':
        totalDamage += Math.floor(maxHp * BATTLE_CONFIG.CURSE_DAMAGE);
        break;
    }
  }
  
  return totalDamage;
}

/**
 * Decrementa los turnos restantes de todos los estados
 */
export function decrementAilmentTurns(pokemon: PokemonInBattle): void {
  for (const ailment of pokemon.ailments) {
    ailment.turnsRemaining--;
    
    // Para toxic, incrementar el turno de daño acumulativo
    if (ailment.type === 'toxic' && ailment.turnsRemaining > 0) {
      ailment.toxicTurn = (ailment.toxicTurn || 1) + 1;
    }
  }
  
  // Eliminar estados con turnos <= 0
  pokemon.ailments = pokemon.ailments.filter(a => a.turnsRemaining > 0);
}

/**
 * Aplica efectos que se activan al inicio del turno (no paralysis/confusion/sleep/freeze)
 */
export function applyStartOfTurnAilments(pokemon: PokemonInBattle): string[] {
  const messages: string[] = [];
  
  // Flinch: se consume al inicio del turno (ya manejado en canPokemonAct)
  // No hay otros efectos que se apliquen al inicio del turno
  
  return messages;
}

// ============================================
// EJECUCIÓN DE MOVIMIENTOS
// ============================================

/**
 * Ejecuta un movimiento de ataque
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
      message: `${attacker.name} usó ${move.name} pero falló!`,
      failed: true,
      failureReason: 'miss'
    };
  }
  
// Normalizar nombre del movimiento (eliminar guiones y espacios)
  const normalizedName = move.name.toLowerCase().replace(/-/g, '').replace(/ /g, '');

  // Verificar si es movimiento de carga (2 turnos)
  if (CHARGE_MOVES.has(normalizedName)) {
    if (!attacker.isCharging) {
      // Primer turno - cargar
      attacker.isCharging = true;
      attacker.chargingMove = move;
      
      return {
        success: true,
        action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
        message: `${attacker.name} está cargando energía!`,
        isCharging: true
      };
    }
    // Si ya está cargando, continuar con el ataque (segundo turno)
  }

  // Verificar si es movimiento de recarga (fatiga)
  const isRechargeMove = RECHARGE_MOVES.has(normalizedName);
  
  // Calcular daño
  const { damage, isCritical, effectiveness } = calculateDamage(attacker, defender, move);
  
  // Aplicar daño
  const hpBefore = defender.hp;
  defender.hp = Math.max(0, defender.hp - damage);
  const hpAfter = defender.hp;
  
  // Construir mensaje
  let message = `${attacker.name} usó ${move.name}!`;
  
  // V1: Si no hace daño, mostrar "No hizo efecto"
  if (damage === 0 && !attacker.isCharging) {
    message += ' ¡No hizo efecto!';
  }
  
  if (isCritical) message += ' ¡Golpe crítico!';
  if (effectiveness > 1) message += ' ¡Es muy efectivo!';
  if (effectiveness < 1 && effectiveness > 0) message += ' No es muy efectivo...';
  if (effectiveness === 0) message += ' ¡No tiene efecto!';
  
  // Verificar si faintó
  const fainted = hpAfter <= 0;
  if (fainted) {
    defender.isFainted = true;
    message += `\n¡${defender.name} faintó!`;
  }
  
  // Aplicar estado del movimiento (burn, poison, freeze, etc.)
  let ailmentApplied: AilmentType | undefined;
  let ailmentSuccess = false;
  
  if (move.meta.ailment && move.meta.ailmentChance > 0) {
    if (Math.random() * 100 < move.meta.ailmentChance) {
      const result = applyAilment(defender, move.meta.ailment as AilmentType, attackerPlayerId);
      if (result.success) {
        ailmentApplied = move.meta.ailment as AilmentType;
        ailmentSuccess = true;
        message += `\n¡${defender.name} quedó ${move.meta.ailment}!`;
      }
    }
  }
  
  // Aplicar flinch
  let flinchedTarget = false;
  if (move.meta.flinchChance > 0 && !fainted) {
    if (Math.random() * 100 < move.meta.flinchChance) {
      defender.hasFlinched = true;
      flinchedTarget = true;
      message += `\n¡${defender.name} retrocedió!`;
    }
  }
  
  // Aplicar cambios de stats
  const statChanges: ActionResult['statChanges'] = [];
  if (move.meta.statChanges && move.meta.statChanges.length > 0) {
    for (const change of move.meta.statChanges) {
      // Aquí se aplicarían los cambios de stats
      statChanges.push({
        stat: change.stat,
        change: change.change,
        target: 'defender'
      });
    }
  }
  
  // Establecer fatiga para el siguiente turno
  let cannotActNextTurn = false;
  if (isRechargeMove) {
    attacker.cannotActNextTurn = true;
    cannotActNextTurn = true;
    message += `\n¡${attacker.name} necesita descansar!`;
  }
  
  return {
    success: true,
    action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
    message,
    damage,
    targetHpBefore: hpBefore,
    targetHpAfter: hpAfter,
    ailmentApplied,
    ailmentSuccess,
    statChanges,
    flinchedTarget,
    cannotActNextTurn,
    failed: fainted // Si faintó, el turno del siguiente jugador podría considerarse fallido
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
  
  // Verificar que el Pokémon tenga HP
  if (newPokemon.isFainted || newPokemon.hp <= 0) {
    return { 
      success: false, 
      message: `${newPokemon.name} no puede luchar (HP: 0)` 
    };
  }
  
  // Guardar HP del Pokémon actual antes de salir
  const currentPokemon = player.team[previousPokemonIndex];
  currentPokemon.savedHp = currentPokemon.hp;
  
  // Cambiar al nuevo Pokémon
  player.activePokemonIndex = newPokemonIndex;
  
  // El nuevo Pokémon mantiene sus estados, pero no afectan mientras está fuera
  // (los efectos como burn/poison ya no reducen HP cuando vuelve a salir)
  // Nota: según SPEC, los estados no se eliminan al cambiar
  
  return {
    success: true,
    message: `¡${player.name} cambió a ${newPokemon.name}!`,
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
    return { ended: true, winner: null, message: '¡Empate! Ambos equipos desfallecieron.' };
  }
  
  if (!p1HasPokemon) {
    return { ended: true, winner: 'player2', message: `¡${player2.name} ganó la batalla!` };
  }
  
  if (!p2HasPokemon) {
    return { ended: true, winner: 'player1', message: `¡${player1.name} ganó la batalla!` };
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