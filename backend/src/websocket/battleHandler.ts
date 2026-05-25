/**
 * Battle WebSocket Handler - Tarea 8
 * Maneja los mensajes WebSocket relacionados con la batalla
 * Conecta el motor de batalla (battleService) con los clientes
 */

import { broadcast, sendTo, getConnection, getRoomPlayers } from './roomManager.js';
import { createBattleState, createPlayerBattleState, determineExecutionOrder, executeMove, executeSwitch, checkBattleEnd, canActWithAilments, applyEndOfTurnAilmentDamage, decrementAilmentTurns, resetFatigueState } from '../services/battleService.js';
import { getMovesByIds, getPokemonById } from '../db/mongodb.js';
import { getUserBySessionId } from '../db/users';
import type { BattleState, PokemonInBattle, BattleMove, PlayerAction, PlayerBattleState } from '../types/battle.js';
import type { Room } from '../db/rooms.js';

// ============================================
// UTILIDADES
// ============================================

/**
 * Crea un delay (promesa que se resuelve después de ms milisegundos)
 * Usado para separar visualmente las acciones en la batalla
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normaliza aliases comunes de efectos a las keys canónicas usadas internamente
 */
function normalizeAilmentType(ailment?: string | null): string | null {
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
    default:
      return a;
  }
}

// ============================================
// GESTIÓN DE BATALLAS EN MEMORIA
// ============================================

// Mapa de salas a estados de batalla
const activeBattles: Map<string, BattleState> = new Map();

/**
 * Inicia una nueva batalla en una sala
 */
export async function startBattle(roomCode: string, room: Room): Promise<BattleState | null> {
  console.log(`[BATTLE] Iniciando batalla en sala ${roomCode}`);
  
  // Obtener equipos de ambos jugadores
  const team1 = room.draft_picks?.player1 || [];
  const team2 = room.draft_picks?.player2 || [];
  
  console.log(`[BATTLE] Equipo 1: ${team1.length} Pokémon`, team1);
  console.log(`[BATTLE] Equipo 2: ${team2.length} Pokémon`, team2);
  
  if (team1.length === 0 || team2.length === 0) {
    console.error(`[BATTLE] Equipos no encontrados para sala ${roomCode}`);
    return null;
  }
  
  // Cargar movimientos para cada Pokémon (pasando session ids para owner metadata)
  const team1WithMoves = await loadTeamMoves(team1, room.players.player1.session_id);
  const team2WithMoves = await loadTeamMoves(team2, room.players.player2.session_id);
  
  // Crear estados de jugadores
  const player1 = createPlayerBattleState(
    'player1',
    room.players.player1.player_name || 'Player 1',
    room.players.player1.session_id,
    team1WithMoves
  );
  
  const player2 = createPlayerBattleState(
    'player2',
    room.players.player2.player_name || 'Player 2',
    room.players.player2.session_id,
    team2WithMoves
  );
  
  // Crear estado de batalla
  const battleState = createBattleState(roomCode, player1, player2);
  
  // Guardar en mapa de batallas activas
  activeBattles.set(roomCode, battleState);
  
  console.log(`[BATTLE] Batalla iniciada en sala ${roomCode}`);
  return battleState;
}

/**
 * Envía el mensaje de inicio de batalla a los clientes
 * Debe llamarse después del temporizador de 5 segundos
 */
export function sendBattleStart(roomCode: string): void {
  const battleState = activeBattles.get(roomCode);
  if (!battleState) {
    console.error(`[BATTLE] No se encontró estado de batalla para sala ${roomCode}`);
    return;
  }
  
  const player1 = battleState.players.player1;
  const player2 = battleState.players.player2;
  
  console.log(`[BATTLE] player1 team[0]:`, player1.team[0]);
  console.log(`[BATTLE] player1.activePokemonIndex:`, player1.activePokemonIndex);
  
  // Notificar a ambos jugadores que la batalla comenzó
  broadcast(roomCode, {
    type: 'battle:start',
    data: {
      roomCode,
      turn: battleState.turn,
      phase: battleState.phase,
      player1: {
        name: player1.name,
        activePokemon: serializePokemon(player1.team[player1.activePokemonIndex]),
        team: player1.team.map(p => serializePokemon(p))
      },
      player2: {
        name: player2.name,
        activePokemon: serializePokemon(player2.team[player2.activePokemonIndex]),
        team: player2.team.map(p => serializePokemon(p))
      },
      message: '¡La batalla está por comenzar!'
    }
  });
}

/**
 * Carga los movimientos de un equipo desde la base de datos
 */
async function loadTeamMoves(team: any[], ownerSessionId?: string | null): Promise<PokemonInBattle[]> {
  const result: PokemonInBattle[] = [];
  
  for (const teamMember of team) {
    console.log(`[BATTLE] Procesando Pokémon:`, teamMember);
    
    // Cargar datos completos del Pokémon desde la DB
    const pokeData = await getPokemonById(teamMember.pokeapi_id);
    
    if (!pokeData) {
      console.error(`[BATTLE] Pokémon no encontrado en DB: ${teamMember.pokeapi_id}`);
      continue;
    }
    
    console.log(`[BATTLE] Pokemon encontrado: ${pokeData.name}, moves: ${teamMember.selected_moves?.length || 0}`);
    
    // Obtener movimientos seleccionados
    // Soportar tanto array de números (modo aleatorio) como array de objetos (modo draft)
    let moveIds: number[] = [];
    if (teamMember.selected_moves && Array.isArray(teamMember.selected_moves)) {
      moveIds = teamMember.selected_moves.map((m: any) => 
        typeof m === 'number' ? m : (m.move_id || m.id || m)
      );
    }
    console.log(`[BATTLE] Buscando movimientos:`, moveIds);
    const moves = await getMovesByIds(moveIds);
    console.log(`[BATTLE] Movimientos encontrados: ${moves.length}`);
    
    // Convertir movimientos al formato de batalla (si hay movimientos)
    // Usar nombre en español si está disponible, si no usar el nombre en inglés
    const battleMoves: BattleMove[] = (moves && moves.length > 0)
      ? moves.map(m => ({
        moveId: m.move_id,
        name: m.names?.es || m.name_es || m.name, // Prioridad: names.es > name_es > name
        description: m.description || m.names?.description_es || '', // Descripción en español
        type: m.type,
        damageClass: m.damage_class,
        power: m.power,
        accuracy: m.accuracy,
        priority: m.priority,
        pp: m.pp,
        maxPp: m.pp,
        target: m.target,
        meta: {
          ailment: m.meta?.ailment,
          ailmentChance: m.meta?.ailment_chance || 0,
          statChanges: m.meta?.stat_changes || [],
          flinchChance: m.meta?.flinch_chance || 0,
          healing: m.meta?.healing || 0,
          drain: m.meta?.drain || 0,
          minHits: m.meta?.min_hits,
          maxHits: m.meta?.max_hits,
          minTurns: m.meta?.min_turns,
          maxTurns: m.meta?.max_turns
        },
        flags: {
          recharge: m.flags?.recharge || false,
          charge: m.flags?.charge || false,
          protect: m.flags?.protect || false,
          mirror: m.flags?.mirror || false
        }
      }))
      : [];
    
    // Determinar metadata del owner (shiny_pack) si está disponible
    let ownerMeta: any = null;
    if (ownerSessionId) {
      try {
        const user = await getUserBySessionId(ownerSessionId);
        if (user) ownerMeta = { session_id: ownerSessionId, clerk_user_id: user.clerk_user_id, shiny_pack: !!user.shiny_pack };
      } catch (e) {
        console.warn('[BATTLE] No se pudo obtener user meta para ownerSessionId', ownerSessionId, e);
      }
    }

    result.push({
      id: teamMember.pokeapi_id,
      pokeapiId: teamMember.pokeapi_id,
      name: pokeData.name || teamMember.name || `Pokemon ${teamMember.pokeapi_id}`,
      types: pokeData.types || [],
      hp: pokeData.stats?.hp || 100,
      maxHp: pokeData.stats?.hp || 100,
      attack: pokeData.stats?.attack || 50,
      defense: pokeData.stats?.defense || 50,
      spAttack: pokeData.stats?.sp_attack || 50,
      spDefense: pokeData.stats?.sp_defense || 50,
      sprites: pokeData.sprites || { front_default: null, back_default: null },
      moveIds: moveIds,
      moves: battleMoves,
      ailments: [],
      statStages: { attack: 0, defense: 0, spAttack: 0, spDefense: 0 },
      isCharging: false,
      cannotActNextTurn: false,
      hasFlinched: false,
      isFainted: false,
      savedHp: pokeData.stats?.hp || 100,
      // V3: 2-Turn Moves and Fatigue
      isChargingTwoTurn: false,
      currentTwoTurnMove: null,
      chargePhase: null,
      isFatigued: false,
      fatigueSource: null,
      isEvasivelyCharging: false,
      evasiveChargeMove: null,
      // Owner metadata for frontend to decide shiny rendering
      // Si el usuario eligió explícitamente no-shiny (draft toggle OFF), respetarlo
      // Si no hay preferencia explícita (random mode o draft sin toggle), usar el shiny_pack del owner
      owner_shiny: teamMember.owner_shiny === false
        ? false
        : (ownerMeta ? !!ownerMeta.shiny_pack : false),
      owner: ownerMeta
    });
  }
  
  return result;
}

/**
 * Serializa un Pokémon para enviar al cliente
 * Valida que todos los campos requeridos existan
 */
function serializePokemon(pokemon: PokemonInBattle, includeMoves: boolean = true) {
  try {
    // Validar campos requeridos
    if (!pokemon) {
      console.error('[BATTLE] serializePokemon: pokemon es null/undefined');
      return null;
    }
    
    // Validar que el Pokémon tenga movimientos
    const moves = pokemon.moves || [];
    
    // Validar sprites
    const sprites = pokemon.sprites || { front_default: null, back_default: null };
    
    // Serializar efectos (ailments)
    const ailments = (pokemon.ailments || []).map(a => ({
      type: normalizeAilmentType(a.type) || a.type,
      turnsRemaining: a.turnsRemaining,
      appliedBy: a.appliedBy
    }));
    
    const serialized = {
      id: pokemon.id,
      pokeapiId: pokemon.pokeapiId,
      name: pokemon.name || 'Unknown',
      types: pokemon.types || [],
      hp: pokemon.hp || 0,
      maxHp: pokemon.maxHp || 100,
      sprites: sprites,
      isFainted: pokemon.isFainted || false,
      ailments: ailments,
      // Stat stages for buff/debuff indicators
      statStages: pokemon.statStages ? {
        attack: pokemon.statStages.attack,
        defense: pokemon.statStages.defense,
        spAttack: pokemon.statStages.spAttack,
        spDefense: pokemon.statStages.spDefense
      } : { attack: 0, defense: 0, spAttack: 0, spDefense: 0 },
      // V3: 2-Turn Moves and Fatigue state
      isChargingTwoTurn: pokemon.isChargingTwoTurn || false,
      chargePhase: pokemon.chargePhase || null,
      currentTwoTurnMove: pokemon.currentTwoTurnMove ? {
        moveId: pokemon.currentTwoTurnMove.moveId,
        name: pokemon.currentTwoTurnMove.name,
        type: pokemon.currentTwoTurnMove.type
      } : null,
      isFatigued: pokemon.isFatigued || false,
      fatigueSource: pokemon.fatigueSource || null,
      isEvasivelyCharging: pokemon.isEvasivelyCharging || false,
      ...(includeMoves && moves.length > 0 && { 
        moves: moves.map(m => ({
          moveId: m.moveId || 0,
          name: m.name || 'Unknown Move',
          description: m.description || '',
          type: m.type || 'normal',
          damageClass: m.damageClass || 'physical',
          power: m.power || 0,
          accuracy: m.accuracy || 100,
          priority: m.priority || 0,
          pp: m.pp || 0,
          maxPp: m.maxPp || 0
        }))
      })
      ,
      // Incluir metadata del owner SIEMPRE (para decidir sprites shiny)
      // owner_shiny depende ÚNICAMENTE del dueño del Pokémon, NO del viewer
      owner_shiny: pokemon.owner_shiny === true,
      ...(pokemon.owner ? { owner: pokemon.owner } : {})
    };
    
    console.log(`[BATTLE] serializePokemon: ${pokemon.name} serializado correctamente`);
    return serialized;
  } catch (error) {
    console.error('[BATTLE] Error serializing pokemon:', error);
    console.error('[BATTLE] Pokemon object:', pokemon);
    // Retornar objeto seguro vacío en caso de error
    return {
      id: 0,
      pokeapiId: 0,
      name: 'Error',
      types: [],
      hp: 0,
      maxHp: 0,
      sprites: { front_default: null, back_default: null },
      isFainted: true,
      ailments: []
    };
  }
}

/**
 * Obtiene el estado de batalla de una sala
 */
export function getBattle(roomCode: string): BattleState | undefined {
  return activeBattles.get(roomCode);
}

/**
 * Maneja la selección de acción de un jugador
 */
export async function handleBattleAction(
  sessionId: string,
  roomCode: string,
  actionData: { type: 'attack' | 'change'; moveId?: number; pokemonId?: number }
): Promise<void> {
  try {
    console.log('[BATTLE] handleBattleAction called', { sessionId, roomCode, actionData });
    
    const battle = activeBattles.get(roomCode);
    if (!battle) {
      console.log('[BATTLE] No battle found for room:', roomCode);
      sendTo(sessionId, { type: 'error', message: 'No hay batalla activa' });
      return;
    }
  
  // Determinar qué jugador es
  const isPlayer1 = battle.players.player1.sessionId === sessionId;
  const isPlayer2 = battle.players.player2.sessionId === sessionId;
  
  console.log('[BATTLE] sessionId:', sessionId, 'player1:', battle.players.player1.sessionId, 'player2:', battle.players.player2.sessionId);
  
  if (!isPlayer1 && !isPlayer2) {
    console.log('[BATTLE] Player not in battle');
    sendTo(sessionId, { type: 'error', message: 'No perteneces a esta batalla' });
    return;
  }
  
  const playerId = isPlayer1 ? 'player1' : 'player2';
  const player = isPlayer1 ? battle.players.player1 : battle.players.player2;
  const opponent = isPlayer1 ? battle.players.player2 : battle.players.player1;
  const activePokemon = player.team[player.activePokemonIndex];

  // VERIFICACIÓN: Si el Pokémon está en fase de carga (2 turnos), solo puede rendirse
  if (activePokemon.isChargingTwoTurn && activePokemon.chargePhase === 'charge' && activePokemon.currentTwoTurnMove) {
    if (actionData.type === 'attack') {
      // No puede elegir otro ataque - debe esperar a ejecutar el movimiento preparado
      sendTo(sessionId, {
        type: 'error',
        message: `¡${activePokemon.name} está preparándose para usar ${activePokemon.currentTwoTurnMove.name}! No puedes elegir otro movimiento.`
      });
      return;
    }
    // Si es change, también rechazamos (no puede cambiar durante carga)
    if (actionData.type === 'change') {
      sendTo(sessionId, {
        type: 'error',
        message: `¡${activePokemon.name} está preparándose para usar ${activePokemon.currentTwoTurnMove.name}! No puedes cambiar de Pokémon.`
      });
      return;
    }
  }
  
  // Obtener el movimiento si es ataque
  let move: BattleMove | undefined;
  if (actionData.type === 'attack' && actionData.moveId) {
    console.log('[BATTLE] Active pokemon:', activePokemon.name, 'moves:', activePokemon.moves?.map(m => m.moveId));
    move = activePokemon.moves?.find(m => m.moveId === actionData.moveId);
    
    if (!move) {
      console.log('[BATTLE] Move not found:', actionData.moveId);
      sendTo(sessionId, { type: 'error', message: 'Movimiento no válido' });
      return;
    }

    // Verificar PP disponible
    if (move.pp <= 0) {
      console.log('[BATTLE] Move has no PP:', move.name);
      sendTo(sessionId, { 
        type: 'battle:pp-exhausted', 
        data: { 
          moveId: move.moveId, 
          moveName: move.name,
          pp: move.pp,
          maxPp: move.maxPp
        }
      });
      return;
    }
  }
  
  // Crear la acción
  const action: PlayerAction = {
    playerId,
    type: actionData.type,
    moveId: actionData.moveId,
    move,
    pokemonId: actionData.pokemonId
  };
  
// Guardar la acción pendiente
  if (isPlayer1) {
    battle.pendingActions.player1 = action;
  } else {
    battle.pendingActions.player2 = action;
  }

  // Notificar que el jugador seleccionó acción
  broadcast(roomCode, {
    type: 'battle:action-selected',
    data: {
      playerId,
      actionType: actionData.type,
      ready: !!(battle.pendingActions.player1 && battle.pendingActions.player2)
    }
  });

  console.log(`[BATTLE] ${player.name} seleccionó: ${actionData.type}, pending p1:`, !!battle.pendingActions.player1, 'pending p2:', !!battle.pendingActions.player2);

  // Verificar si el jugador necesita cambio obligatorio (su pokemon active tiene HP=0)
  const needsMandatorySwitch = activePokemon.hp <= 0 || activePokemon.isFainted;

  // Si el jugador necesita cambio obligatorio, ejecutar el cambio inmediatamente (sin esperar al oponente)
  if (needsMandatorySwitch && actionData.type === 'change' && actionData.pokemonId !== undefined) {
    console.log(`[BATTLE] Mandatory switch for ${playerId}, executing immediately`);

    const currentIndex = player.activePokemonIndex;
    const newIndex = player.team.findIndex(p => p.id === actionData.pokemonId);

    if (newIndex >= 0 && newIndex !== currentIndex) {
      const switchResult = executeSwitch(player, newIndex, currentIndex);

      // Obtener el nuevo pokemon activo
      const newActivePokemon = player.team[player.activePokemonIndex];

      // Notificar el cambio exitoso
      broadcast(roomCode, {
        type: 'battle:switch-success',
        data: {
          playerId,
          pokemonId: actionData.pokemonId,
          pokemon: serializePokemon(newActivePokemon),
          message: switchResult.message
        }
      });

      // Limpiar la acción pendiente de este jugador
      if (isPlayer1) {
        battle.pendingActions.player1 = null;
      } else {
        battle.pendingActions.player2 = null;
      }

      // ¿Fue un cambio solicitado durante el turno (requiresSwitchFor)?
      if (battle.requiresSwitchFor === playerId) {
        // Limpiar el flag de cambio obligatorio
        battle.requiresSwitchFor = null;
        
        // El turno ya fue pausado, así que simplemente terminamos aquí
        // El siguiente turno comenzará normalmente
        console.log('[BATTLE] Mandatory switch during turn completed, waiting for next turn');
        return;
      }

      // Ahora verificar si el oponente también necesita seleccionar
      // Si el oponente ya tenía acción, ejecutamos el turno normal
      const opponentPending = isPlayer1 ? battle.pendingActions.player2 : battle.pendingActions.player1;
      if (opponentPending) {
        console.log('[BATTLE] Opponent has action, executing turn with switch');
        await executeTurn(roomCode, battle);
      }
      // Si el oponente no ha seleccionado aún, esperar (la batalla queda en fase de selección)
      // hasta que seleccione su acción

      return;
    }
  }

    // Si ambos jugadores han seleccionado, ejecutar el turno
    if (battle.pendingActions.player1 && battle.pendingActions.player2) {
      console.log('[BATTLE] Both players ready, executing turn');
      await executeTurn(roomCode, battle);
    }
  } catch (error) {
    console.error('[BATTLE] Error in handleBattleAction:', error);
    console.error('[BATTLE] Stack:', (error as Error).stack);
    sendTo(sessionId, { 
      type: 'battle:error', 
      data: { 
        message: 'Error al procesar la acción',
        error: (error as Error).message
      }
    });
  }
}

/**
 * Ejecuta un turno completo de la batalla
 */
async function executeTurn(roomCode: string, battle: BattleState): Promise<void> {
  try {
    console.log(`[BATTLE] Ejecutando turno ${battle.turn} en sala ${roomCode}`);
    
    // Fase 2: Determinar orden de ejecución
    const { order, reason, usedCoinflip } = determineExecutionOrder(
      battle.pendingActions.player1,
      battle.pendingActions.player2
    );
    
    battle.executionOrder = order;
    battle.phase = 'executing';
  
  // Notificar inicio del turno
  broadcast(roomCode, {
    type: 'battle:turn-start',
    data: {
      turn: battle.turn,
      executionOrder: order,
      reason,
      usedCoinflip,
      firstPlayerId: order[0]
    }
  });
  
  // Esperar a que el cliente procese la animación
  // Si se usó coinflip, la animación dura 4 segundos (2s flip + 2s resultado)
  // Si no, solo esperar 1.5 segundos
  const waitTime = reason.includes('coinflip') ? 4500 : 1500;
  await sleep(waitTime);
  
  const player1 = battle.players.player1;
  const player2 = battle.players.player2;
  
  // Obtener Pokémon activos
  let p1Active = player1.team[player1.activePokemonIndex];
  let p2Active = player2.team[player2.activePokemonIndex];
  
  // PHASE 1: SELECCIÓN - V3: Reset fatigue state at start of turn
  // Allows Hyper Beam Pokemon to act normally the turn after fatigue
  resetFatigueState(p1Active);
  resetFatigueState(p2Active);
  
  // Ejecutar acciones en orden
  for (const attackerId of order) {
    const attacker = attackerId === 'player1' ? player1 : player2;
    const defender = attackerId === 'player1' ? player2 : player1;
    const attackerPokemon = attackerId === 'player1' ? p1Active : p2Active;
    const defenderPokemon = attackerId === 'player1' ? p2Active : p1Active;
    const action = attackerId === 'player1' ? battle.pendingActions.player1 : battle.pendingActions.player2;
    
    if (!action) continue;
    
    // ¡IMPORTANTE! Verificar si el Pokémon attacker puede actuar (debe estar vivo)
    // Si el Pokémon fue debilitado en la acción anterior, solicitar cambio al jugador
    if (attackerPokemon.hp <= 0 || attackerPokemon.isFainted) {
      // Marcar que este jugador necesita cambio obligatorio
      battle.requiresSwitchFor = attackerId;
      
      // Notificar al cliente que debe seleccionar un Pokémon
      broadcast(roomCode, {
        type: 'battle:pokemon-fainted',
        data: {
          playerId: attackerId,
          pokemonName: attackerPokemon.name,
          message: `¡${attackerPokemon.name} se debilitó! Selecciona tu siguiente Pokémon.`
        }
      });
      
      // Esperar a que el jugador seleccione y ejecute el cambio
      // El turno continúa normalmente en el siguiente
      // NO ejecutar más acciones en este turno
      break;
    }
    
    // V2: Verificar si puede actuar antes de ejecutar (con estados)
    // Verificar si el Pokémon puede actuar según sus efectos
    const canActResult = canActWithAilments(attackerPokemon);
    
    if (!canActResult.canAct || canActResult.willAttackItself) {
      // El Pokémon no puede actuar - enviar mensaje explicativo
      let blockMessage = `¡${attackerPokemon.name} ${canActResult.reason}!`;
      
      // Si está confundido y se atacó a sí mismo
      if (canActResult.willAttackItself) {
        // Calcular autolesión
        const selfDamage = Math.ceil(attackerPokemon.maxHp * 0.25);
        attackerPokemon.hp = Math.max(0, attackerPokemon.hp - selfDamage);
        blockMessage = `¡${attackerPokemon.name} está confundido!\n¡Se atacó a sí mismo y recibió ${selfDamage} de daño!`;
      }
      
      broadcast(roomCode, {
        type: 'battle:action-result',
        data: {
          playerId: attackerId,
          action: {
            type: action.type,
            moveId: action.moveId,
            pokemonId: action.pokemonId
          },
          result: {
            success: true,
            message: blockMessage,
            damage: 0,
            targetHp: defenderPokemon.hp,
            ailmentApplied: undefined,
            attackerName: attackerPokemon.name,
            defenderName: defenderPokemon.name
          },
          attackerHp: attackerPokemon.hp,
          defenderHp: defenderPokemon.hp
        }
      });
      
      battle.actionResults.push({
        success: true,
        action,
        message: blockMessage
      });
      
      // Esperar antes de continuar
      await sleep(2000);
      
      // Verificar KO
      if (canActResult.willAttackItself && attackerPokemon.hp <= 0) {
        attackerPokemon.isFainted = true;
        const endCheck = checkBattleEnd(player1, player2);
        if (endCheck.ended) {
          battle.phase = 'ended';
          battle.winner = endCheck.winner;
          
          broadcast(roomCode, {
            type: 'battle:end',
            data: {
              winner: endCheck.winner,
              message: endCheck.message,
              finalState: {
                player1: {
                  activePokemon: serializePokemon(p1Active),
                  remainingPokemon: player1.team.filter(p => !p.isFainted).length
                },
                player2: {
                  activePokemon: serializePokemon(p2Active),
                  remainingPokemon: player2.team.filter(p => !p.isFainted).length
                }
              }
            }
          });
          
          activeBattles.delete(roomCode);
          return;
        }
      }
      
      continue; // Pasar al siguiente atacante (o fin del turno)
    }
    
    let result;
    
    // ===== V3: MANEJO DE 2 TURNOS - Si está cargando, ejecutar el movimiento preparado =====
    let moveToExecute = action.move;
    
    // Si el jugador está en fase de carga (charging phase), debe ejecutar el movimiento que tenía preparado
    // No puede elegir otra acción - se ejecuta automáticamente
    if (attackerPokemon.isChargingTwoTurn && attackerPokemon.chargePhase === 'charge' && attackerPokemon.currentTwoTurnMove) {
      console.log(`[BATTLE] ${attackerPokemon.name} está cargando ${attackerPokemon.currentTwoTurnMove.name} - ejecutando automáticamente`);
      moveToExecute = attackerPokemon.currentTwoTurnMove;
      
      // Notificar que está ejecutando el movimiento preparado
      broadcast(roomCode, {
        type: 'battle:charging-move-execute',
        data: {
          playerId: attackerId,
          pokemonName: attackerPokemon.name,
          moveName: moveToExecute.name
        }
      });
      
      await sleep(1000);
    }
    
    if (action.type === 'attack' && moveToExecute) {
      // Ejecutar movimiento
      result = executeMove(attackerPokemon, defenderPokemon, moveToExecute, attackerId);
    } else if (action.type === 'change' && action.pokemonId !== undefined) {
      // Ejecutar cambio
      const currentIndex = attacker.activePokemonIndex;
      const newIndex = attacker.team.findIndex(p => p.id === action.pokemonId);
      
      if (newIndex >= 0 && newIndex !== currentIndex) {
        const switchResult = executeSwitch(attacker, newIndex, currentIndex);
        
        // Obtener el nuevo Pokémon después del cambio
        const newPokemon = attacker.team[attacker.activePokemonIndex];
        
        result = {
          success: switchResult.success,
          action,
          message: switchResult.message,
          failed: !switchResult.success,
          // Incluir el nuevo Pokémon serializado
          newPokemon: serializePokemon(newPokemon)
        };
        
        // Actualizar referencia al Pokémon activo
        if (attackerId === 'player1') {
          p1Active = attacker.team[attacker.activePokemonIndex];
        } else {
          p2Active = attacker.team[attacker.activePokemonIndex];
        }
      } else {
        result = {
          success: false,
          action,
          message: 'Cambio no válido',
          failed: true
        };
      }
    } else {
      result = {
        success: false,
        action,
        message: 'Acción no válida',
        failed: true
      };
    }
    
    // Notificar resultado de la acción
    // Incluir newPokemon si es un cambio de Pokémon
    const resultData: any = {
      success: result.success,
      message: result.message,
      damage: result.damage,
      targetHp: result.targetHpAfter,
      isCritical: result.isCritical,
      effectiveness: result.effectiveness,
      ailmentApplied: result.ailmentApplied,
      isCharging: result.isCharging,
      cannotActNextTurn: result.cannotActNextTurn,
      flinchedTarget: result.flinchedTarget,
      attackerName: result.attackerName,
      defenderName: result.defenderName,
      moveName: result.moveName
    };

    // Incluir statChanges (with wasCapped) and statStages snapshot for frontend buff/debuff
    if (result.statChanges && result.statChanges.length > 0) {
      resultData.statChanges = result.statChanges;
    }
    if (result.statStages) {
      resultData.statStages = result.statStages;
    }

    // Agregar newPokemon si la acción es un cambio
    if (action.type === 'change' && result.newPokemon) {
      resultData.newPokemon = result.newPokemon;
    }

    broadcast(roomCode, {
      type: 'battle:action-result',
      data: {
        playerId: attackerId,
        action: {
          type: action.type,
          moveId: action.moveId,
          pokemonId: action.pokemonId
        },
        result: resultData,
        attackerHp: attackerPokemon.hp,
        defenderHp: defenderPokemon.hp
      }
    });
    
    // V3: Add follow-up messages for charging and fatigue states
    const v3Messages: string[] = [];
    
    // Check if attacker is now charging (2-turn move) - phase 'charge' means preparing for next turn
    if (attackerPokemon.isChargingTwoTurn && attackerPokemon.chargePhase === 'charge') {
      const chargingMove = attackerPokemon.currentTwoTurnMove;
      if (chargingMove) {
        v3Messages.push(`¡${attackerPokemon.name} está preparándose para usar ${chargingMove.name}!`);
      }
    }
    
    // Check if attacker is now fatigued
    if (attackerPokemon.isFatigued) {
      if (attackerPokemon.fatigueSource === 'recharge') {
        v3Messages.push(`¡${attackerPokemon.name} está agotado y debe descansar el próximo turno!`);
      } else if (attackerPokemon.fatigueSource === 'exhaustion') {
        v3Messages.push(`¡${attackerPokemon.name} está exhausto! Su próximo ataque será más débil.`);
      }
    }
    
    // Send V3 state messages if any
    if (v3Messages.length > 0) {
      broadcast(roomCode, {
        type: 'battle:v3-state-message',
        data: {
          playerId: attackerId,
          messages: v3Messages,
          pokemonState: {
            name: attackerPokemon.name,
            isChargingTwoTurn: attackerPokemon.isChargingTwoTurn,
            chargePhase: attackerPokemon.chargePhase,
            isFatigued: attackerPokemon.isFatigued,
            fatigueSource: attackerPokemon.fatigueSource
          }
        }
      });
      
      await sleep(1500); // Brief pause for client to display state messages
    }
    
    battle.actionResults.push(result);
    
    // Esperar antes de verificar el final de batalla o ejecutar la siguiente acción
    // (permite que el cliente procese la animación)
    await sleep(2000);
    
    // Verificar si la batalla terminó
    const endCheck = checkBattleEnd(player1, player2);
    if (endCheck.ended) {
      battle.phase = 'ended';
      battle.winner = endCheck.winner;
      
      broadcast(roomCode, {
        type: 'battle:end',
        data: {
          winner: endCheck.winner,
          message: endCheck.message,
          finalState: {
            player1: {
              activePokemon: serializePokemon(p1Active),
              remainingPokemon: player1.team.filter(p => !p.isFainted).length
            },
            player2: {
              activePokemon: serializePokemon(p2Active),
              remainingPokemon: player2.team.filter(p => !p.isFainted).length
            }
          }
        }
      });
      
      // Limpiar batalla activa
      activeBattles.delete(roomCode);
      return;
    }
  }
  
  // Fase 4: V2 - Aplicar efectos al final del turno y decrementar duraciones
  const endTurnMessages: string[] = [];
  
  // Aplicar daño por efectos al final del turno (burn, poison, toxic, etc)
  const p1AilmentDamage = applyEndOfTurnAilmentDamage(p1Active);
  const p2AilmentDamage = applyEndOfTurnAilmentDamage(p2Active);
  
  // Agregar mensajes de daño
  endTurnMessages.push(...p1AilmentDamage.messages);
  endTurnMessages.push(...p2AilmentDamage.messages);
  
  // Decrementar turnos de efectos
  const p1AilmentDecrement = decrementAilmentTurns(p1Active);
  const p2AilmentDecrement = decrementAilmentTurns(p2Active);
  
  // Agregar mensajes de efectos que expiraron
  endTurnMessages.push(...p1AilmentDecrement.messages);
  endTurnMessages.push(...p2AilmentDecrement.messages);
  
  // Enviar mensajes de fin de turno (efectos)
  if (endTurnMessages.length > 0) {
    broadcast(roomCode, {
      type: 'battle:end-of-turn-effects',
      data: {
        messages: endTurnMessages,
        player1: {
          activePokemon: serializePokemon(p1Active),
          hp: p1Active.hp,
          maxHp: p1Active.maxHp,
          ailments: p1Active.ailments.map(a => ({ type: a.type, turnsRemaining: a.turnsRemaining }))
        },
        player2: {
          activePokemon: serializePokemon(p2Active),
          hp: p2Active.hp,
          maxHp: p2Active.maxHp,
          ailments: p2Active.ailments.map(a => ({ type: a.type, turnsRemaining: a.turnsRemaining }))
        }
      }
    });
    
    await sleep(2000);
  }
  
  // Verificar si la batalla terminó por daño de efectos
  const endCheck2 = checkBattleEnd(player1, player2);
  if (endCheck2.ended) {
    battle.phase = 'ended';
    battle.winner = endCheck2.winner;
    
    broadcast(roomCode, {
      type: 'battle:end',
      data: {
        winner: endCheck2.winner,
        message: endCheck2.message,
        finalState: {
          player1: {
            activePokemon: serializePokemon(p1Active),
            remainingPokemon: player1.team.filter(p => !p.isFainted).length
          },
          player2: {
            activePokemon: serializePokemon(p2Active),
            remainingPokemon: player2.team.filter(p => !p.isFainted).length
          }
        }
      }
    });
    
    activeBattles.delete(roomCode);
    return;
  }
  
  // Limpiar flags especiales (flinch solo dura un turno)
  p1Active.hasFlinched = false;
  p2Active.hasFlinched = false;
  
  // Preparar siguiente turno
  battle.turn++;
  battle.phase = 'selecting';
  battle.pendingActions.player1 = null;
  battle.pendingActions.player2 = null;
  battle.actionResults = [];
  
  // Notificar fin del turno
  broadcast(roomCode, {
    type: 'battle:turn-end',
    data: {
      turn: battle.turn - 1,
      player1: {
        activePokemon: serializePokemon(p1Active),
        team: player1.team.map(p => serializePokemon(p)),
        remaining: player1.team.filter(p => !p.isFainted).length
      },
      player2: {
        activePokemon: serializePokemon(p2Active),
        team: player2.team.map(p => serializePokemon(p)),
        remaining: player2.team.filter(p => !p.isFainted).length
      },
      nextTurn: battle.turn
    }
  });
  
    console.log(`[BATTLE] Turno ${battle.turn - 1} completado, siguiente: turno ${battle.turn}`);
  } catch (error) {
    console.error('[BATTLE] Error in executeTurn:', error);
    console.error('[BATTLE] Stack:', (error as Error).stack);
    broadcast(roomCode, {
      type: 'battle:error',
      data: {
        message: 'Error al ejecutar el turno',
        error: (error as Error).message
      }
    });
  }
}

/**
 * Maneja desconexión durante la batalla
 */
export function handleBattleDisconnect(roomCode: string, sessionId: string): void {
  const battle = activeBattles.get(roomCode);
  if (!battle) return;
  
  // Notificar al oponente
  broadcast(roomCode, {
    type: 'battle:player-disconnected',
    data: {
      sessionId,
      message: 'El oponente se ha desconectado'
    }
  });
}

/**
 * Termina una batalla (cuando la sala termina)
 */
export function endBattle(roomCode: string): void {
  if (activeBattles.has(roomCode)) {
    console.log(`[BATTLE] Batalla terminada en sala ${roomCode}`);
    activeBattles.delete(roomCode);
  }
}

// ============================================
// RENDICIÓN
// ============================================

/**
 * Maneja la rendición de un jugador
 * 1. Establece HP de todos los pokémon del jugador a 0
 * 2. Envía mensaje de rendición
 * 3. Después de delay, declara victoria del oponente
 * 4. Marca la room como finished
 */
export async function handleBattleSurrender(sessionId: string, roomCode: string): Promise<void> {
  console.log(`[BATTLE] ${sessionId} se ha rendu en sala ${roomCode}`);

  const battle = activeBattles.get(roomCode);
  if (!battle) {
    console.error(`[BATTLE] No se encontró batalla activa en sala ${roomCode}`);
    return;
  }

  // Determinar qué jugador se rindió
  const surrenderPlayerId = battle.players.player1.sessionId === sessionId ? 'player1' : 'player2';
  const winnerPlayerId = surrenderPlayerId === 'player1' ? 'player2' : 'player1';
  
  const surrenderPlayer = battle.players[surrenderPlayerId as keyof typeof battle.players];
  const winnerPlayer = battle.players[winnerPlayerId as keyof typeof battle.players];

  const surrenderPlayerName = surrenderPlayer.name;
  const winnerPlayerName = winnerPlayer.name;

  console.log(`[BATTLE] Jugador ${surrenderPlayerName} (${surrenderPlayerId}) se rinde. ${winnerPlayerName} gana.`);

  // Establecer HP de todos los pokémon del jugador que se rindió a 0
  for (const pokemon of surrenderPlayer.team) {
    pokemon.hp = 0;
    pokemon.isFainted = true;
  }

  // Enviar mensaje de rendición
  broadcast(roomCode, {
    type: 'battle:end',
    data: {
      winner: winnerPlayerId,
      message: `¡${surrenderPlayerName} se rindió!`,
      surrender: true,
      finalState: {
        player1: {
          activePokemon: serializePokemon(battle.players.player1.team[battle.players.player1.activePokemonIndex]),
          remainingPokemon: surrenderPlayerId === 'player1' ? 0 : battle.players.player1.team.filter(p => !p.isFainted).length
        },
        player2: {
          activePokemon: serializePokemon(battle.players.player2.team[battle.players.player2.activePokemonIndex]),
          remainingPokemon: surrenderPlayerId === 'player2' ? 0 : battle.players.player2.team.filter(p => !p.isFainted).length
        }
      }
    }
  });

  // Esperar 2 segundos antes de mostrar el mensaje de victoria
  await sleep(2000);

  // Enviar mensaje de victoria
  broadcast(roomCode, {
    type: 'battle:end',
    data: {
      winner: winnerPlayerId,
      message: `¡${winnerPlayerName} gana la batalla!`,
      finalState: {
        player1: {
          activePokemon: serializePokemon(battle.players.player1.team[battle.players.player1.activePokemonIndex]),
          remainingPokemon: battle.players.player1.team.filter(p => !p.isFainted).length
        },
        player2: {
          activePokemon: serializePokemon(battle.players.player2.team[battle.players.player2.activePokemonIndex]),
          remainingPokemon: battle.players.player2.team.filter(p => !p.isFainted).length
        }
      }
    }
  });

  // Limpiar batalla activa
  activeBattles.delete(roomCode);

  // Marcar la room como finished
  try {
    const { updateRoomState } = await import('../db/rooms.js');
    await updateRoomState(roomCode, 'finished');
    console.log(`[BATTLE] Sala ${roomCode} marcada como finished`);
  } catch (error) {
    console.error(`[BATTLE] Error al marcar sala ${roomCode} como finished:`, error);
  }
}