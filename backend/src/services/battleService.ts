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

import { randomBytes } from 'crypto';

import type { 
  BattleState, 
  PokemonInBattle, 
  PlayerBattleState, 
  PlayerAction, 
  ActionResult, 
  TurnResult,
  BattleMove,
  BattlePhase,
  AilmentType,
  V3MoveMetadata,
  EvasiveMoveMetadata,
  FatigueMoveMetadata
} from '../types/battle.js';
import { 
  BATTLE_CONFIG,
  V3_MOVES,
  TEST_MOVES
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
  
  if (action.type === 'item') {
    return BATTLE_CONFIG.PRIORITY_ITEM; // +4
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
 * Usa crypto.randomBytes para mayor precisión que Math.random()
 */
export function coinflip(): 'player1' | 'player2' {
  const randomBytesResult = randomBytes(4);
  const randomNumber = randomBytesResult.readUInt32BE(0);
  // Distribución uniforme: si el número es par → player1, impar → player2
  return randomNumber % 2 === 0 ? 'player1' : 'player2';
}

// ============================================
// CÁLCULO DE DAÑO
// ============================================

// ============================================
// SISTEMA DE EFECTOS (ESTADOS) - V2
// ============================================

/**
 * Obtiene cuántos turnos dura cada tipo de efecto
 */
export function getAilmentDuration(ailmentType: string): number {
  switch (ailmentType) {
    case 'sleep':
    case 'confusion':
    case 'paralysis':
    case 'burn':
    case 'poison':
    case 'toxic':
    case 'leech_seed':
    case 'curse':
    case 'freeze':
    case 'flinch':
    case 'trap':
      return 3; // Todos duran 3 turnos
    default:
      return 3;
  }
}

/**
 * Obtiene el daño de efectos por turno (como % del HP máximo)
 */
export function getAilmentDamagePercentage(ailmentType: string, toxicTurn?: number): number {
  switch (ailmentType) {
    case 'burn':
      return 0.125; // 12.5% del HP máximo
    case 'poison':
      return 0.125; // 12.5% del HP máximo
    case 'toxic':
      // Daño acumulativo: turno 1 = 1/8, turno 2 = 2/8, etc
      return (toxicTurn || 1) / 8;
    case 'leech_seed':
      return 0.125; // 12.5% del HP máximo
    case 'curse':
      return 0.25; // 25% del HP máximo
    default:
      return 0;
  }
}

/**
 * Obtiene el nombre legible del efecto en español
 */
export function getAilmentName(ailmentType: string): string {
  switch (ailmentType) {
    case 'burn':
      return 'Quemado';
    case 'poison':
      return 'Envenenado';
    case 'toxic':
      return 'Envenenado Gravemente';
    case 'paralysis':
      return 'Paralizado';
    case 'freeze':
      return 'Congelado';
    case 'sleep':
      return 'Dormido';
    case 'confusion':
      return 'Confundido';
    case 'flinch':
      return 'Retrocedió del miedo';
    case 'leech_seed':
      return 'Emboscada Semilla';
    case 'curse':
      return 'Maldito';
    case 'trap':
      return 'Atrapado';
    default:
        return 'Desconocido';
  }
}

  /**
   * Normaliza aliases comunes de efectos a las keys canónicas usadas internamente
   */
  export function normalizeAilmentType(ailment?: string | null): string | null {
    if (!ailment) return null;
    const a = String(ailment).trim().toLowerCase();
    switch (a) {
      case 'quemado':
      case 'quemar':
      case 'burn':
        return 'burn';
      case 'venenado':
      case 'veneno':
      case 'poison':
        return 'poison';
      case 'toxic':
      case 'venenado gravemente':
        return 'toxic';
      case 'paralisis':
      case 'parálisis':
      case 'paralizado':
      case 'paralysis':
        return 'paralysis';
      case 'congelado':
      case 'freeze':
        return 'freeze';
      case 'dormido':
      case 'sleep':
        return 'sleep';
      case 'confundido':
      case 'confusion':
        return 'confusion';
      case 'retrocedio':
      case 'retrocedió':
      case 'flinch':
        return 'flinch';
      case 'emboscada_semilla':
      case 'emboscada semilla':
      case 'leech_seed':
      case 'leech seed':
        return 'leech_seed';
      case 'maldito':
      case 'curse':
        return 'curse';
      case 'atrapado':
      case 'trap':
      case 'bind':
      case 'wrap':
        return 'trap';
      default:
        return a; // devolver el valor canónico si ya lo es o el original en minúsculas
    }
  }

/**
 * Aplica un efecto a un Pokémon
 */
export function applyAilment(
  pokemon: PokemonInBattle,
  ailmentType: string,
  appliedBy: 'player1' | 'player2',
  trapPower?: number
): { applied: boolean; message: string } {
  
  // No aplicar efectos si el Pokémon ya está debilitado
  if (pokemon.isFainted) {
    return { applied: false, message: `${pokemon.name} ya está debilitado.` };
  }
  
  // Normalizar tipo de efecto
  const normalized = normalizeAilmentType(ailmentType);
  if (!normalized) {
    return { applied: false, message: '' };
  }

  // Verificar si ya tiene este efecto
  const existingAilment = pokemon.ailments.find(a => a.type === normalized);
  if (existingAilment) {
    return { applied: false, message: `${pokemon.name} ya está ${getAilmentName(normalized).toLowerCase()}.` };
  }
  
  // Verificar si ya tiene cualquier efecto activo (solo 1 efecto permitido)
  if (pokemon.ailments.length > 0) {
    return { applied: false, message: `${pokemon.name} ya tiene un efecto activo.` };
  }
  
  // Crear nuevo efecto
  const newAilment: any = {
    type: normalized,
    turnsRemaining: getAilmentDuration(normalized),
    appliedBy,
    toxicTurn: normalized === 'toxic' ? 1 : undefined
  };
  
  // Para trap, guardar el power del movimiento
  if (normalized === 'trap' && trapPower) {
    newAilment.trapPower = trapPower;
  }
  
  pokemon.ailments.push(newAilment);
  
  return {
    applied: true,
    message: `¡${pokemon.name} está ${getAilmentName(normalized).toLowerCase()}!`
  };
}

/**
 * Verifica si un Pokémon puede actuar en este turno (considerando estados)
 * Retorna si puede actuar y la razón si no puede
 */
export function canActWithAilments(pokemon: PokemonInBattle): {
  canAct: boolean;
  reason: string;
  willAttackItself?: boolean;
} {
  
  // Verificar si está debilitado
  if (pokemon.isFainted || pokemon.hp <= 0) {
    return { canAct: false, reason: 'Pokémon desfallecido' };
  }
  
  // V3: Si está en fase de carga de 2 turnos, DEBE poder actuar (ejecutar el movimiento preparado)
  // chargePhase = 'charge' significa que está preparándose para ejecutar en el siguiente turno
  if (pokemon.isChargingTwoTurn && pokemon.chargePhase === 'charge') {
    return { canAct: true, reason: '' }; // Debe ejecutar el movimiento de 2 turnos
  }
  
  // V3: Verificar fatiga ANTES de otros estados (must be first to prevent action)
  // Only recharge-type fatigue blocks action; exhaustion is narrative only
  // Al bloquear, se consume la fatiga: este turno cuenta como el descanso
  if (pokemon.isFatigued && pokemon.fatigueSource === 'recharge') {
    resetFatigueState(pokemon);
    return { canAct: false, reason: 'Agotado (necesita descansar)' };
  }
  
  // Verificar banderas especiales
  if (pokemon.cannotActNextTurn) {
    return { canAct: false, reason: 'Agotado (necesita descansar)' };
  }
  
  if (pokemon.hasFlinched) {
    return { canAct: false, reason: 'Retrocedió del miedo' };
  }
  
  // Verificar efectos de estado
  for (const ailment of pokemon.ailments) {
    switch (ailment.type) {
      case 'flinch':
        if (ailment.turnsRemaining > 0) {
          return { canAct: false, reason: 'Retrocedió del miedo' };
        }
        break;

      case 'paralysis':
        // 25% de no actuar
        if (Math.random() < 0.25) {
          return { canAct: false, reason: 'Paralizado (no puede moverse)' };
        }
        break;
        
      case 'freeze':
        // 20% de descongelar (80% permanece congelado)
        if (Math.random() < 0.8) {
          return { canAct: false, reason: 'Congelado (no puede moverse)' };
        }
        break;
        
      case 'sleep':
        if (ailment.turnsRemaining > 0) {
          return { canAct: false, reason: 'Dormido (no puede moverse)' };
        }
        break;
        
      case 'confusion':
        // 33% de atacarse a sí mismo
        if (Math.random() < 0.33) {
          return { canAct: true, reason: 'Confundido', willAttackItself: true };
        }
        break;
    }
  }
  
  return { canAct: true, reason: '' };
}

/**
 * Aplica daño por efectos al final del turno (burn, poison, etc)
 */
export function applyEndOfTurnAilmentDamage(pokemon: PokemonInBattle): {
  totalDamage: number;
  messages: string[];
} {
  
  const messages: string[] = [];
  let totalDamage = 0;
  
  for (const ailment of pokemon.ailments) {
    // Trap usa power fijo en lugar de porcentaje
    if (ailment.type === 'trap' && ailment.trapPower) {
      const damage = ailment.trapPower;
      pokemon.hp = Math.max(0, pokemon.hp - damage);
      totalDamage += damage;
      messages.push(`${pokemon.name} está atrapado.`);
      continue;
    }
    
    const damagePercent = getAilmentDamagePercentage(ailment.type, ailment.toxicTurn);
    
    if (damagePercent > 0) {
      const damage = Math.ceil(pokemon.maxHp * damagePercent);
      pokemon.hp = Math.max(0, pokemon.hp - damage);
      totalDamage += damage;
      
      // Mensaje de daño (estilo limpio sin números)
      let damageMessage = `${pokemon.name}`;
      switch (ailment.type) {
        case 'burn':
          damageMessage += ` está quemado.`;
          break;
        case 'poison':
          damageMessage += ` está envenenado.`;
          break;
        case 'toxic':
          damageMessage += ` está envenenado gravemente.`;
          break;
        case 'leech_seed':
          damageMessage += ` está siendo absorbido por Emboscada Semilla.`;
          break;
        case 'curse':
          damageMessage += ` está maldito.`;
          break;
      }
      
      messages.push(damageMessage);
      
      // Incrementar turno de toxic
      if (ailment.type === 'toxic' && ailment.toxicTurn) {
        ailment.toxicTurn++;
      }
    }
  }
  
  return { totalDamage, messages };
}

/**
 * Decrementa los turnos de los efectos y elimina los que vencieron
 */
export function decrementAilmentTurns(pokemon: PokemonInBattle): {
  expiredAilments: string[];
  messages: string[];
} {
  
  const expiredAilments: string[] = [];
  const messages: string[] = [];
  
  for (let i = pokemon.ailments.length - 1; i >= 0; i--) {
    const ailment = pokemon.ailments[i];
    
    // No decrementar si ya es indefinido (-1)
    if (ailment.turnsRemaining > 0) {
      ailment.turnsRemaining--;
      
      // Si llegó a 0, eliminar
      if (ailment.turnsRemaining <= 0) {
        expiredAilments.push(ailment.type);
        pokemon.ailments.splice(i, 1);
        
        let message = `${pokemon.name} `;
        switch (ailment.type) {
          case 'sleep':
            message += '¡se despertó!';
            break;
          case 'confusion':
            message += '¡dejó de estar confundido!';
            break;
        }
        messages.push(message);
      }
    }
  }
  
  return { expiredAilments, messages };
}

// ============================================
// V3: HELPER FUNCTIONS (2 Turnos y Fatiga)
// ============================================

/**
 * Determina si un movimiento es de 2 turnos (carga + ejecución)
 * Un movimiento es de 2 turnos si tiene flag 'charge' pero no 'recharge'
 * 
 * @param move - El movimiento a verificar
 * @returns true si es movimiento de 2 turnos, false en otro caso
 */
export function isMoveTwoTurn(move: BattleMove | null): boolean {
  if (!move) return false;
  return move.flags.charge === true && !move.flags.recharge;
}

/**
 * Obtiene lista de nombres de movimientos de 2 turnos desde V3_MOVES
 * 
 * @returns Array de nombres de movimientos de 2 turnos
 */
export function getTwoTurnMoveList(): string[] {
  return Object.values(V3_MOVES)
    .filter((meta: V3MoveMetadata) => meta.isTwoTurn === true)
    .map((meta: V3MoveMetadata) => meta.name);
}

/**
 * Verifica si un Pokémon está actualmente cargando un movimiento de 2 turnos
 * Retorna true solo si TODOS estos campos son verdaderos:
 * - isChargingTwoTurn = true
 * - chargePhase = 'charge'
 * - currentTwoTurnMove !== null
 * - El movimiento tiene flag charge = true
 * 
 * @param pokemon - Pokémon a verificar
 * @returns true si está en fase de carga, false en otro caso
 */
export function isTwoTurnCharging(pokemon: PokemonInBattle): boolean {
  return (
    pokemon.isChargingTwoTurn === true &&
    pokemon.chargePhase === 'charge' &&
    pokemon.currentTwoTurnMove !== null &&
    isMoveTwoTurn(pokemon.currentTwoTurnMove)
  );
}

/**
 * Verifica si un Pokémon está cargando un movimiento evasivo
 * Los movimientos evasivos permiten evitar ataques durante la carga
 * 
 * @param pokemon - Pokémon a verificar
 * @returns true si está cargando movimiento evasivo, false en otro caso
 */
export function isEvasivelyCharging(pokemon: PokemonInBattle): boolean {
  if (!pokemon.isEvasivelyCharging || !pokemon.evasiveChargeMove) {
    return false;
  }
  
  return pokemon.evasiveChargeMove.flags.evasive === true;
}

/**
 * Verifica si un Pokémon que está cargando puede ser interrumpido
 * Un Pokémon solo puede ser interrumpido si:
 * - Está en fase de carga de 2 turnos (isTwoTurnCharging = true)
 * - El movimiento tiene flag interruptible = true
 * 
 * @param attacker - Pokémon atacante que está cargando
 * @returns true si puede ser interrumpido, false en otro caso
 */
export function canBeInterrupted(attacker: PokemonInBattle): boolean {
  // Solo puede ser interrumpido si está en fase de carga
  if (!isTwoTurnCharging(attacker)) {
    return false;
  }
  
  // Verificar si el movimiento tiene la flag interruptible
  const move = attacker.currentTwoTurnMove;
  if (!move) return false;
  
  return move.flags.interruptible === true;
}

/**
 * Aplica estado de fatiga a un Pokémon después de ejecutar ciertos movimientos
 * La fatiga debilita el siguiente ataque del Pokémon
 * 
 * @param pokemon - Pokémon afectado
 * @param fatigueType - Tipo de fatiga:
 *   - 'recharge': Obligatorio (Hyper Beam) - Pokémon debe "descansar"
 *   - 'exhaustion': Normal - Siguiente ataque es más débil
 */
export function applyFatigue(
  pokemon: PokemonInBattle,
  fatigueType: 'recharge' | 'exhaustion' = 'exhaustion'
): void {
  pokemon.isFatigued = true;
  pokemon.fatigueSource = fatigueType;
}

/**
 * Limpia el estado de fatiga de un Pokémon
 * Se ejecuta generalmente al inicio del turno cuando el Pokémon recupera fuerzas
 * 
 * @param pokemon - Pokémon a limpiar
 */
export function resetFatigueState(pokemon: PokemonInBattle): void {
  pokemon.isFatigued = false;
  pokemon.fatigueSource = null;
}

/**
 * Obtiene la fase actual de un movimiento de 2 turnos
 * 
 * @param pokemon - Pokémon a verificar
 * @returns 'charge' si está en fase de carga, 'execute' si está en fase de ejecución, 'none' si no está cargando
 */
export function getMovePhase(pokemon: PokemonInBattle): 'charge' | 'execute' | 'none' {
  if (!pokemon.isChargingTwoTurn) {
    return 'none';
  }
  
  if (pokemon.chargePhase === 'charge') {
    return 'charge';
  }
  
  if (pokemon.chargePhase === 'execute') {
    return 'execute';
  }
  
  return 'none';
}

/**
 * Maneja la lógica completa de movimientos de 2 turnos (carga y ejecución)
 * 
 * Fase de Carga:
 * - Establece los flags de carga
 * - Si es movimiento evasivo, marca como evadiendo
 * - Si es Skull Bash, aplica +1 defensa temporal
 * - Retorna mensaje de carga
 * 
 * Fase de Ejecución:
 * - Calcula daño normalmente
 * - Verifica si el defensor está evadiendo
 * - Aplica fatiga si corresponde
 * - Limpia todos los flags de carga
 * 
 * @param attacker - Pokémon atacante
 * @param defender - Pokémon defensor
 * @param move - Movimiento de 2 turnos
 * @param phase - Fase actual ('charge' o 'execute')
 * @param playerId - ID del jugador atacante
 * @returns ActionResult con los resultados de la acción
 */
export async function handleTwoTurnMove(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove,
  phase: 'charge' | 'execute',
  playerId: 'player1' | 'player2'
): Promise<ActionResult> {
  
  if (phase === 'charge') {
    // ===== FASE DE CARGA =====
    
    // Establecer flags de carga
    attacker.isChargingTwoTurn = true;
    attacker.chargePhase = 'charge';  // ← Fase de carga (esperar siguiente turno)
    attacker.currentTwoTurnMove = move;
    
    // Verificar si es movimiento evasivo (Fly, Dig, Bounce, Dive, Shadow Force)
    if (move.flags.evasive === true) {
      attacker.isEvasivelyCharging = true;
      attacker.evasiveChargeMove = move;
    }
    
    // Verificar si es Skull Bash para aplicar +1 stage de defensa temporal
    if (move.moveId === 37) {  // Skull Bash moveId
      attacker.statStages.defense = Math.min(6, attacker.statStages.defense + 1);
    }
    
    // Construir mensaje de carga
    const chargeMessage = `¡${attacker.name} está cargando ${move.name}!`;
    
    return {
      success: true,
      action: { playerId, type: 'attack', move, moveId: move.moveId },
      message: chargeMessage,
      isCharging: true,
      attackerName: attacker.name,
      moveName: move.name
    };
  }
  
  // ===== FASE DE EJECUCIÓN =====
  
  // Calcular daño normalmente
  const { damage, effectiveness } = await calculateDamage(attacker, defender, move);
  
  // Verificar si el defensor está evadiendo
  if (isDefenderEvading(defender)) {
    // Limpiar flags de carga
    attacker.isChargingTwoTurn = false;
    attacker.chargePhase = null;
    attacker.currentTwoTurnMove = null;
    attacker.isEvasivelyCharging = false;
    attacker.evasiveChargeMove = null;
    
    return {
      success: true,
      action: { playerId, type: 'attack', move, moveId: move.moveId },
      message: `${attacker.name} usado ${move.name}.\n${defender.name} evadio el ataque!`,
      damage: 0,
      targetHpBefore: defender.hp,
      targetHpAfter: defender.hp,
      effectiveness: 0,
      failed: false,
      attackerName: attacker.name,
      defenderName: defender.name,
      moveName: move.name
    };
  }
  
  // Aplicar daño
  const hpBefore = defender.hp;
  defender.hp = Math.max(0, defender.hp - damage);
  const hpAfter = defender.hp;
  
  // Construir mensaje narrativo estilo Pokémon BW
  let message = `${attacker.name} usado ${move.name}.`;
  
  // Agregar efectividad del ataque con mensajes específicos
  if (effectiveness >= 4) {
    message += '\n¡Es súper efectivo!'; // x4 (tipo dual con ambos débiles)
  } else if (effectiveness > 1) {
    message += '\n¡Es muy efectivo!'; // x2
  } else if (effectiveness < 1 && effectiveness > 0) {
    message += '\nNo es muy efectivo...'; // x0.5
  } else if (effectiveness === 0) {
    message += '\n¡No tiene efecto! (Inmune)'; // Inmunidad clara
  }
  
// Verificar si se debilitó
  const fainted = hpAfter <= 0;
  if (fainted) {
    defender.isFainted = true;
    message += `\n${defender.name} se debilito.`;
  }

  // V4: Aplicar Drain (robo de vida o autolesión)
  const drain = move.meta?.drain ?? 0;
  if (drain !== 0 && damage > 0 && !attacker.isFainted) {
    const drainPercent = Math.abs(drain) / 100;
    const drainAmount = Math.floor(damage * drainPercent);

    if (drain > 0) {
      const maxHeal = attacker.maxHp - attacker.hp;
      const drainHealed = Math.min(drainAmount, maxHeal);
      attacker.hp += drainHealed;
      if (drainHealed > 0) {
        message += `\n¡${attacker.name} recuperó ${drainHealed} PS!`;
      }
    } else {
      const drainDamage = Math.min(drainAmount, attacker.hp);
      attacker.hp = Math.max(0, attacker.hp - drainDamage);
      message += `\n¡${attacker.name} se lastimó con su propio ataque!`;
    }
  }

  // V5: Aplicar Healing (curación al usuario o objetivo)
  const healing = move.meta?.healing ?? 0;
  if (healing > 0 && !attacker.isFainted) {
    const targetIsUser = move.target?.toLowerCase() === 'user';
    const healTarget = targetIsUser ? attacker : defender;
    
    const healAmount = Math.floor(healTarget.maxHp * (healing / 100));
    const maxHeal = healTarget.maxHp - healTarget.hp;
    const actualHeal = Math.min(healAmount, maxHeal);
    
    if (actualHeal > 0) {
      healTarget.hp += actualHeal;
      const targetName = targetIsUser ? attacker.name : defender.name;
      message += `\n¡${targetName} recuperó ${actualHeal} PS!`;
    }
  }
   
  // Verificar si el movimiento causa fatiga (usando flags de la DB)
  if (move.flags.fatigue === true) {
    if (move.flags.recharge === true) {
      applyFatigue(attacker, 'recharge');
      message += `\n¡${attacker.name} necesita descansar!`;
    } else {
      applyFatigue(attacker, 'exhaustion');
      message += `\n¡${attacker.name} está agotado!`;
    }
  }
  
  // Limpiar flags de carga
  attacker.isChargingTwoTurn = false;
  attacker.chargePhase = null;
  attacker.currentTwoTurnMove = null;
  attacker.isEvasivelyCharging = false;
  attacker.evasiveChargeMove = null;
  
  // Si era Skull Bash, restaurar stage de defensa
  if (move.moveId === 37) {  // Skull Bash moveId
    attacker.statStages.defense = Math.max(-6, attacker.statStages.defense - 1);
  }
  
  return {
    success: true,
    action: { playerId, type: 'attack', move, moveId: move.moveId },
    message,
    damage,
    targetHpBefore: hpBefore,
    targetHpAfter: hpAfter,
    effectiveness,
    failed: fainted,
    attackerName: attacker.name,
    defenderName: defender.name,
    moveName: move.name
  };
}

/**
 * Verifica si el defensor está evadiendo un ataque
 * Un defensor solo puede evadir si:
 * - Está en fase de carga de movimiento evasivo
 * - El movimiento tiene flag evasive = true
 * 
 * @param defender - Pokémon defensor
 * @returns true si el defensor puede evadir, false en otro caso
 */
export function isDefenderEvading(defender: PokemonInBattle): boolean {
  // Verificar si está en fase de carga evasiva
  if (!defender.isEvasivelyCharging) {
    return false;
  }
  
  // Verificar si el movimiento evasivo tiene flag evasive = true
  if (!defender.evasiveChargeMove || !defender.evasiveChargeMove.flags.evasive) {
    return false;
  }
  
  // Verificar si está en fase de carga
  // chargePhase = 'charge' means "preparing to execute move next turn" (can evade attacks)
  // chargePhase = 'execute' means "about to execute (deprecated)"
  // chargePhase = null means "not charging"
  if (defender.chargePhase !== 'charge') {
    return false;
  }
  
  return true;
}

/**
 * Reinicia los flags de estado de carga de 2 turnos al inicio de un turno
 * Se ejecuta antes de procesar las acciones del turno
 * 
 * @param pokemon - Pokémon a reiniciar
 */
export function updateTwoTurnState(pokemon: PokemonInBattle): void {
  // No hacer nada si no está cargando
  if (!pokemon.isChargingTwoTurn) {
    return;
  }
  
  // Si está en fase de ejecución, es responsabilidad de handleTwoTurnMove limpiar
  // Este función solo se usa para diagnosticar o hacer reset completo
  // Por ahora, no hacemos nada aquí ya que handleTwoTurnMove limpia los flags
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
export async function calculateDamage(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove
): Promise<{ damage: number; effectiveness: number }> {
  
  // Ignorar si el movimiento no causa daño
  if (!move.power || move.power === 0 || move.damageClass === 'status') {
    return { damage: 0, effectiveness: 1 };
  }
  
  const level = BATTLE_CONFIG.LEVEL;
  const power = move.power;
  
  // Determinar Attack y Defense según tipo de movimiento (con etapas de stats)
  let attack: number;
  let defense: number;
  
  if (move.damageClass === 'physical') {
    attack = getEffectiveStat(attacker.attack, attacker.statStages.attack);
    defense = getEffectiveStat(defender.defense, defender.statStages.defense);
  } else {
    attack = getEffectiveStat(attacker.spAttack, attacker.statStages.spAttack);
    defense = getEffectiveStat(defender.spDefense, defender.statStages.spDefense);
  }
  
  // Calcular STAB (Same Type Attack Bonus)
  const stab = attacker.types.includes(move.type) ? BATTLE_CONFIG.STAB_MULTIPLIER : 1;
  
  // Calcular efectividad de tipos
  const effectiveness = await getTypeEffectiveness(move.type, defender.types);
  
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

type StatChangeTarget = 'attacker' | 'defender';
type BattleStatKey = 'attack' | 'defense' | 'spAttack' | 'spDefense';

const STAT_NAME_MAP: Record<string, BattleStatKey | null> = {
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  'sp-attack': 'spAttack',
  'sp-defense': 'spDefense',
  spattack: 'spAttack',
  spdefense: 'spDefense',
  speed: null,
  evasion: null,
  accuracy: null
};

const SELF_TARGETS = new Set(['self', 'user', 'users-field']);

function normalizeStatName(stat: string): BattleStatKey | null {
  const normalized = stat.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  return STAT_NAME_MAP[normalized] ?? null;
}

function resolveStatChangeTarget(move: BattleMove, _changeValue: number): StatChangeTarget {
  const target = move.target?.toLowerCase();

  if (target === 'user') {
    return 'attacker';
  }

  return 'defender';
}

function getStatLabel(stat: BattleStatKey): string {
  switch (stat) {
    case 'attack':
      return 'Ataque';
    case 'defense':
      return 'Defensa';
    case 'spAttack':
      return 'Ataque Especial';
    case 'spDefense':
      return 'Defensa Especial';
  }
}

function getEffectiveStat(baseStat: number, stage: number): number {
  if (stage >= 0) return Math.floor(baseStat * (2 + stage) / 2);
  return Math.floor(baseStat * 2 / (2 - stage));
}

function applyStatChange(pokemon: PokemonInBattle, stat: BattleStatKey, change: number): { applied: number; wasCapped: boolean } {
  const currentStage = pokemon.statStages[stat];
  const newStage = Math.max(-6, Math.min(6, currentStage + change));
  pokemon.statStages[stat] = newStage;
  const applied = newStage - currentStage;
  return { applied, wasCapped: applied !== change };
}

function applyMoveStatChanges(
  move: BattleMove,
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  defenderFainted: boolean
): Array<{ stat: BattleStatKey; change: number; target: StatChangeTarget; wasCapped: boolean }> {
  const results: Array<{ stat: BattleStatKey; change: number; target: StatChangeTarget; wasCapped: boolean }> = [];
  const statChanges = move.meta?.statChanges || [];

  for (const change of statChanges) {
    const mappedStat = normalizeStatName(change.stat);
    if (!mappedStat) {
      continue;
    }

    const target = resolveStatChangeTarget(move, change.change);
    if (target === 'defender' && defenderFainted) {
      continue;
    }

    const targetPokemon = target === 'attacker' ? attacker : defender;
    const result = applyStatChange(targetPokemon, mappedStat, change.change);

    if (result.applied !== 0 || result.wasCapped) {
      results.push({
        stat: mappedStat,
        change: result.applied,
        target,
        wasCapped: result.wasCapped
      });
    }
  }

  return results;
}

function buildStatChangeMessage(pokemon: PokemonInBattle, stat: BattleStatKey, change: number): string {
  const direction = change > 0 ? 'subió' : 'bajó';
  return `¡El ${getStatLabel(stat)} de ${pokemon.name} ${direction}!`;
}

// ============================================
// EJECUCIÓN DE MOVIMIENTOS
// ============================================

/**
 * Ejecuta un movimiento de ataque (V2 - ahora con efectos de estado)
 */
export async function executeMove(
  attacker: PokemonInBattle,
  defender: PokemonInBattle,
  move: BattleMove,
  attackerPlayerId: 'player1' | 'player2'
): Promise<ActionResult> {

  // Decrementar PP del movimiento
  // Para movimientos de carga (2 turnos): descontar al seleccionar en el turno 1 (cuando NO está cargando)
  // No descontar en el turno 2 cuando se ejecuta el movimiento preparado
  const isTwoTurnMove = move.flags?.charge === true;
  const isAlreadyCharging = attacker.isChargingTwoTurn && attacker.chargePhase === 'charge' && attacker.currentTwoTurnMove;
  
  // Descontar si: es movimiento normal O movimiento de carga Y todavía no está cargando
  if ((!isTwoTurnMove || !isAlreadyCharging) && move.pp !== undefined && move.pp > 0) {
    move.pp = Math.max(0, move.pp - 1);
    console.log(`[PP] ${attacker.name} usó ${move.name}. PP restantes: ${move.pp}/${move.maxPp}`);
  }

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
  
  // ===== V3: MANEJO DE HYPER BEAM (Recharge Move) =====
  // Hyper Beam se ejecuta inmediatamente + aplica fatiga
  if (move.flags.recharge === true) {
    const hasApplicableStatChanges = (move.meta?.statChanges || []).some(change => normalizeStatName(change.stat) !== null);

    // Ignorar si el movimiento no causa daño
    if ((!move.power || move.power === 0 || move.damageClass === 'status') && !hasApplicableStatChanges) {
      return {
        success: true,
        action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
        message: `${attacker.name} usado ${move.name}.\nEl ataque no tuvo efecto!`,
        failed: false
      };
    }
    
    // Calcular daño normalmente
    const { damage, effectiveness } = await calculateDamage(attacker, defender, move);
    
    // V3: Verificar si el defensor está evadiendo (Fly, Dig, Bounce, etc.)
    if (isDefenderEvading(defender)) {
      // Aplicar fatiga igualmente aunque haya evadido (el esfuerzo ya se hizo)
      applyFatigue(attacker, 'recharge');
      
      return {
        success: true,
        action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
        message: `${attacker.name} usado ${move.name}.\n¡Pero ${defender.name} evadió el ataque!\n¡${attacker.name} necesita descansar!`,
        damage: 0,
        targetHpBefore: defender.hp,
        targetHpAfter: defender.hp,
        effectiveness: 0,
        failed: false,
        attackerName: attacker.name,
        defenderName: defender.name,
        moveName: move.name
      };
    }
    
    // Aplicar daño
    const hpBefore = defender.hp;
    defender.hp = Math.max(0, defender.hp - damage);
    const hpAfter = defender.hp;
    const defenderFainted = hpAfter <= 0;
    
// Construir mensaje narrativo estilo Pokémon BW
  let message = `${attacker.name} usado ${move.name}.`;
  
  // Agregar efectividad del ataque con mensajes específicos
  if (effectiveness >= 4) {
    message += '\n¡Es súper efectivo!'; // x4 (tipo dual con ambos débiles)
  } else if (effectiveness > 1) {
    message += '\n¡Es muy efectivo!'; // x2
  } else if (effectiveness < 1 && effectiveness > 0) {
    message += '\nNo es muy efectivo...'; // x0.5
  } else if (effectiveness === 0) {
    message += '\n¡No tiene efecto! (Inmune)'; // Inmunidad clara
  }
  
  // Verificar si se debilitó
  if (defenderFainted) {
    defender.isFainted = true;
    message += `\n${defender.name} se debilito.`;
  }

  // V4: Aplicar Drain (robo de vida o autolesión)
  const drain = move.meta?.drain ?? 0;
  let drainHealed = 0;
  let drainDamage = 0;

  if (drain !== 0 && damage > 0 && !attacker.isFainted) {
    const drainPercent = Math.abs(drain) / 100;
    const drainAmount = Math.floor(damage * drainPercent);

    if (drain > 0) {
      const maxHeal = attacker.maxHp - attacker.hp;
      drainHealed = Math.min(drainAmount, maxHeal);
      attacker.hp += drainHealed;
      if (drainHealed > 0) {
        message += `\n¡${attacker.name} recuperó ${drainHealed} PS!`;
      }
    } else {
      drainDamage = Math.min(drainAmount, attacker.hp);
      attacker.hp = Math.max(0, attacker.hp - drainDamage);
      message += `\n¡${attacker.name} se lastimó con su propio ataque!`;
    }
  }

  // V5: Aplicar Healing (curación al usuario o objetivo)
  const healing = move.meta?.healing ?? 0;
  if (healing > 0 && !attacker.isFainted) {
    const targetIsUser = move.target?.toLowerCase() === 'user';
    const healTarget = targetIsUser ? attacker : defender;
    
    const healAmount = Math.floor(healTarget.maxHp * (healing / 100));
    const maxHeal = healTarget.maxHp - healTarget.hp;
    const actualHeal = Math.min(healAmount, maxHeal);
    
    if (actualHeal > 0) {
      healTarget.hp += actualHeal;
      const targetName = targetIsUser ? attacker.name : defender.name;
      message += `\n¡${targetName} recuperó ${actualHeal} PS!`;
    }
  }

  const statChangeResults = applyMoveStatChanges(move, attacker, defender, defenderFainted);
  // NOTA: los cambios de estadística se aplican pero no generan líneas narrativas.
  // Se incluyen en el campo `statChanges` del ActionResult para el frontend si es necesario.
    
    // Aplicar fatiga inmediatamente (Recharge)
    applyFatigue(attacker, 'recharge');
    message += `\n¡${attacker.name} necesita descansar!`;
    
    return {
      success: true,
      action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
      message,
      damage,
      targetHpBefore: hpBefore,
      targetHpAfter: hpAfter,
      effectiveness,
      failed: defenderFainted,
      statChanges: statChangeResults.map(change => ({
        stat: change.stat,
        change: change.change,
        target: change.target,
        wasCapped: change.wasCapped
      })),
      // Full stat stages snapshot for frontend buff/debuff indicators
      statStages: {
        attacker: { ...attacker.statStages },
        defender: { ...defender.statStages }
      },
      attackerName: attacker.name,
      defenderName: defender.name,
      moveName: move.name
    };
  }
  
  // ===== V3: MANEJO DE MOVIMIENTOS DE 2 TURNOS =====
  if (isMoveTwoTurn(move)) {
    // Verificar si ya está cargando
    if (!isTwoTurnCharging(attacker)) {
      // Primera ejecución: Fase de Carga
      return await handleTwoTurnMove(attacker, defender, move, 'charge', attackerPlayerId);
    } else {
      // Segunda ejecución: Fase de Ejecución
      return await handleTwoTurnMove(attacker, defender, move, 'execute', attackerPlayerId);
    }
  }
  
  // ===== MOVIMIENTOS NORMALES (Sin carga, sin recharge) =====
  
  // Ignorar solo movimientos sin daño que tampoco aplican estados
  if ((!move.power || move.power === 0) && move.damageClass !== 'status') {
    return {
      success: true,
      action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
      message: `${attacker.name} usado ${move.name}.\nEl ataque no tuvo efecto!`,
      failed: false
    };
  }
  
  // Calcular daño (versión básica)
  const { damage, effectiveness } = await calculateDamage(attacker, defender, move);
  
  // V3: Verificar si el defensor está evadiendo (Fly, Dig, Bounce, etc.)
  if (isDefenderEvading(defender)) {
    return {
      success: true,
      action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
      message: `${attacker.name} usado ${move.name}.\n¡Pero ${defender.name} evadió el ataque!`,
      damage: 0,
      targetHpBefore: defender.hp,
      targetHpAfter: defender.hp,
      effectiveness: 0,
      failed: false,
      attackerName: attacker.name,
      defenderName: defender.name,
      moveName: move.name
    };
  }
  
  // Aplicar daño
  const hpBefore = defender.hp;
  defender.hp = Math.max(0, defender.hp - damage);
  const hpAfter = defender.hp;
  const defenderFainted = hpAfter <= 0;
  
  // Construir mensaje narrativo estilo Pokémon BW
  let message = `${attacker.name} usado ${move.name}.`;
  
  // Agregar efectividad del ataque con mensajes específicos
  if (effectiveness >= 4) {
    message += '\n¡Es súper efectivo!'; // x4 (tipo dual con ambos débiles)
  } else if (effectiveness > 1) {
    message += '\n¡Es muy efectivo!'; // x2
  } else if (effectiveness < 1 && effectiveness > 0) {
    message += '\nNo es muy efectivo...'; // x0.5
  } else if (effectiveness === 0) {
    message += '\n¡No tiene efecto! (Inmune)'; // Inmunidad clara
  }
  
  // Verificar si se debilitó
  if (defenderFainted) {
    defender.isFainted = true;
    message += `\n${defender.name} se debilito.`;
  }

  // V4: Aplicar Drain (robo de vida o autolesión)
  const drain = move.meta?.drain ?? 0;
  let drainHealed = 0;
  let drainDamage = 0;

  if (drain !== 0 && damage > 0 && !attacker.isFainted) {
    const drainPercent = Math.abs(drain) / 100;
    const drainAmount = Math.floor(damage * drainPercent);

    if (drain > 0) {
      const maxHeal = attacker.maxHp - attacker.hp;
      drainHealed = Math.min(drainAmount, maxHeal);
      attacker.hp += drainHealed;
      if (drainHealed > 0) {
        message += `\n¡${attacker.name} recuperó ${drainHealed} PS!`;
      }
    } else {
      drainDamage = Math.min(drainAmount, attacker.hp);
      attacker.hp = Math.max(0, attacker.hp - drainDamage);
      message += `\n¡${attacker.name} se lastimó con su propio ataque!`;
    }
  }

  // V5: Aplicar Healing (curación al usuario o objetivo)
  const healing = move.meta?.healing ?? 0;
  if (healing > 0 && !attacker.isFainted) {
    const targetIsUser = move.target?.toLowerCase() === 'user';
    const healTarget = targetIsUser ? attacker : defender;
    
    const healAmount = Math.floor(healTarget.maxHp * (healing / 100));
    const maxHeal = healTarget.maxHp - healTarget.hp;
    const actualHeal = Math.min(healAmount, maxHeal);
    
    if (actualHeal > 0) {
      healTarget.hp += actualHeal;
      const targetName = targetIsUser ? attacker.name : defender.name;
      message += `\n¡${targetName} recuperó ${actualHeal} PS!`;
    }
  }

  const statChangeResults = applyMoveStatChanges(move, attacker, defender, defenderFainted);
  // NOTA: los cambios de estadística se aplican pero no generan líneas narrativas.
  // Se incluyen en el campo `statChanges` del ActionResult para el frontend si es necesario.
  
  // V2: Aplicar efectos de estado si el movimiento los tiene
  let ailmentApplied: AilmentType | undefined = undefined;
  let ailmentSuccess = false;
  const moveAilment = move.meta?.ailment;
  const hasAilment = Boolean(moveAilment && moveAilment !== 'none');
  const ailmentChance = move.meta?.ailmentChance ?? 0;

  if (hasAilment && !defenderFainted && (damage > 0 || move.damageClass === 'status')) {
    const guaranteedStatusMove = move.damageClass === 'status' && ailmentChance === 0;
    const shouldAttemptAilment = guaranteedStatusMove || ailmentChance > 0;

    if (shouldAttemptAilment) {
      const rollSucceeded = guaranteedStatusMove || Math.random() * 100 < ailmentChance;

      if (rollSucceeded) {
        const ailmentResult = applyAilment(
          defender,
          moveAilment,
          attackerPlayerId,
          moveAilment === 'trap' ? (move.power || 0) : undefined
        );

        if (ailmentResult.applied) {
          ailmentApplied = moveAilment;
          ailmentSuccess = true;
          message += `\n${ailmentResult.message}`;
        }
      }
    }
  }

  if (move.meta?.flinchChance && move.meta.flinchChance > 0 && !defenderFainted) {
    if (Math.random() * 100 < move.meta.flinchChance) {
      defender.hasFlinched = true;
    }
  }

  if ((move.power === null || move.power === undefined || move.power === 0 || move.damageClass === 'status') && !ailmentSuccess && statChangeResults.length === 0) {
    message += `\nEl ataque no tuvo efecto!`;
  }
  
  return {
    success: true,
    action: { playerId: attackerPlayerId, type: 'attack', move, moveId: move.moveId },
    message,
    damage,
    targetHpBefore: hpBefore,
    targetHpAfter: hpAfter,
    effectiveness,
    failed: defenderFainted,
    ailmentApplied,
    ailmentSuccess,
    statChanges: statChangeResults.map(change => ({
      stat: change.stat,
      change: change.change,
      target: change.target,
      wasCapped: change.wasCapped
    })),
    // Full stat stages snapshot for frontend buff/debuff indicators
    statStages: {
      attacker: { ...attacker.statStages },
      defender: { ...defender.statStages }
    },
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
  
  // ===== V3: LIMPIAR ESTADOS DE 2 TURNOS DEL POKÉMON ANTERIOR =====
  previousPokemon.isChargingTwoTurn = false;
  previousPokemon.currentTwoTurnMove = null;
  previousPokemon.chargePhase = null;
  previousPokemon.isEvasivelyCharging = false;
  previousPokemon.evasiveChargeMove = null;
  
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
// SISTEMA DE ÍTEMS EN BATALLA
// ============================================

/**
 * IDs de ítems disponibles en batalla
 */
export type ItemId = 'hiperPosion' | 'maximoRevivir';

/**
 * Definición de un ítem usable en batalla
 */
interface ItemDef {
  name: string;
  description: string;
  condition: (pokemon: PokemonInBattle) => boolean;
  effect: (pokemon: PokemonInBattle) => void;
}

/**
 * Mapa de definiciones de ítems
 * Cada ítem tiene nombre, descripción, condición de uso y efecto
 */
const ITEM_DEFS: Record<ItemId, ItemDef> = {
  hiperPosion: {
    name: 'Hiper Poción',
    description: 'Restaura todos los PS de un Pokémon',
    condition: (p) => p.hp > 0 && p.hp < p.maxHp,
    effect: (p) => { p.hp = p.maxHp; },
  },
  maximoRevivir: {
    name: 'Máximo Revivir',
    description: 'Revive un Pokémon debilitado al máximo PS',
    condition: (p) => p.hp <= 0 || p.isFainted,
    effect: (p) => { p.hp = p.maxHp; p.isFainted = false; },
  },
};

/**
 * Ejecuta el uso de un ítem en batalla
 *
 * 1. Valida que el ítem exista
 * 2. Valida que haya al menos 1 unidad disponible
 * 3. Encuentra al Pokémon objetivo por ID
 * 4. Valida que el objetivo cumpla la condición del ítem
 * 5. Aplica el efecto (cura/revive)
 * 6. Decrementa el contador del ítem
 * 7. Retorna ActionResult con healAmount e inventory actualizado
 *
 * @param player - Estado del jugador que usa el ítem
 * @param itemId - ID del ítem a usar
 * @param targetPokemonId - ID del Pokémon objetivo
 * @returns ActionResult con el resultado de la acción
 */
export function executeItem(
  player: PlayerBattleState,
  itemId: ItemId,
  targetPokemonId: number
): ActionResult {
  // Validar que el ítem exista
  const itemDef = ITEM_DEFS[itemId];
  if (!itemDef) {
    return {
      success: false,
      action: { playerId: player.playerId, type: 'item', itemId },
      message: 'Ítem no válido',
      failed: true,
      failureReason: 'invalid_item',
    };
  }

  // Validar que haya al menos 1 unidad
  if (player.inventory[itemId] <= 0) {
    return {
      success: false,
      action: { playerId: player.playerId, type: 'item', itemId },
      message: `No quedan ${itemDef.name}`,
      failed: true,
      failureReason: 'no_items_left',
    };
  }

  // Encontrar al Pokémon objetivo
  const target = player.team.find(p => p.id === targetPokemonId);
  if (!target) {
    return {
      success: false,
      action: { playerId: player.playerId, type: 'item', itemId, targetPokemonId },
      message: 'Objetivo no válido',
      failed: true,
      failureReason: 'invalid_target',
    };
  }

  // Validar condición del ítem sobre el objetivo
  if (!itemDef.condition(target)) {
    const failMessage = itemId === 'hiperPosion'
      ? `${target.name} no necesita ser curado`
      : `${target.name} no está debilitado`;
    return {
      success: false,
      action: { playerId: player.playerId, type: 'item', itemId, targetPokemonId },
      message: failMessage,
      failed: true,
      failureReason: 'condition_not_met',
    };
  }

  // Guardar HP antes de aplicar efecto
  const hpBefore = target.hp;

  // Aplicar efecto
  itemDef.effect(target);

  const hpAfter = target.hp;
  const healAmount = hpAfter - hpBefore;

  // Decrementar contador (con piso defensivo en 0)
  player.inventory[itemId] = Math.max(0, player.inventory[itemId] - 1);

  // Construir PlayerAction para el resultado
  const action: PlayerAction = {
    playerId: player.playerId,
    type: 'item',
    itemId,
    targetPokemonId,
  };

  return {
    success: true,
    action,
    message: `¡${itemDef.name} usada en ${target.name}!\n¡${target.name} recuperó toda su vida!`,
    healAmount,
    targetHpBefore: hpBefore,
    targetHpAfter: hpAfter,
    attackerName: player.name,
    targetName: target.name,
    moveName: itemDef.name,
    inventory: { ...player.inventory },
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
    statStages: {
      attack: 0,
      defense: 0,
      spAttack: 0,
      spDefense: 0,
    },
    sprites: pokemon.sprites || { front_default: null, back_default: null, front_shiny: null, back_shiny: null },
    moveIds: pokemon.move_ids || pokemon.moveIds || [],
    moves: pokemon.moves || [],
    ailments: [],
    isCharging: false,
    chargingMoveId: undefined,
    cannotActNextTurn: false,
    hasFlinched: false,
    // V3: Movimientos de 2 turnos
    isChargingTwoTurn: false,
    currentTwoTurnMove: null,
    chargePhase: null,
    // V3: Fatiga
    isFatigued: false,
    fatigueSource: null,
    // V3: Evasión
    isEvasivelyCharging: false,
    evasiveChargeMove: null,
    // Otros
    isFainted: false,
    savedHp: pokemon.stats?.hp || 100,
    // Preservar owner metadata del draft/battleHandler (shiny sprites)
    owner_shiny: pokemon.owner_shiny,
    owner: pokemon.owner
  }));
  
  return {
    playerId,
    name,
    sessionId,
    team: battleTeam,
    activePokemonIndex: 0,
    hasSelectedAction: false,
    inventory: {
      hiperPosion: 2,
      maximoRevivir: 1,
    }
  };
}