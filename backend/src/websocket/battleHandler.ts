/**
 * Battle WebSocket Handler - Tarea 8
 * Maneja los mensajes WebSocket relacionados con la batalla
 * Conecta el motor de batalla (battleService) con los clientes
 */

import { broadcast, sendTo, getConnection, getRoomPlayers } from './roomManager.js';
import { createBattleState, createPlayerBattleState, determineExecutionOrder, executeMove, executeSwitch, checkBattleEnd } from '../services/battleService.js';
import { getMovesByIds, getPokemonById } from '../db/mongodb.js';
import type { BattleState, PokemonInBattle, BattleMove, PlayerAction, PlayerBattleState } from '../types/battle.js';
import type { Room } from '../db/rooms.js';

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
  
  // Cargar movimientos para cada Pokémon
  const team1WithMoves = await loadTeamMoves(team1);
  const team2WithMoves = await loadTeamMoves(team2);
  
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
async function loadTeamMoves(team: any[]): Promise<PokemonInBattle[]> {
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
        meta: {
          ailment: m.meta?.ailment,
          ailmentChance: m.meta?.ailment_chance || 0,
          statChanges: m.meta?.stat_changes || [],
          flinchChance: m.meta?.flinch_chance || 0,
          heal: m.meta?.heal || 0,
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
      isCharging: false,
      cannotActNextTurn: false,
      hasFlinched: false,
      isFainted: false,
      savedHp: pokeData.stats?.hp || 100
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
    
    const serialized = {
      id: pokemon.id,
      pokeapiId: pokemon.pokeapiId,
      name: pokemon.name || 'Unknown',
      types: pokemon.types || [],
      hp: pokemon.hp || 0,
      maxHp: pokemon.maxHp || 100,
      sprites: sprites,
      isFainted: pokemon.isFainted || false,
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
      isFainted: true
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
  
  // Obtener el movimiento si es ataque
  let move: BattleMove | undefined;
  if (actionData.type === 'attack' && actionData.moveId) {
    const activePokemon = player.team[player.activePokemonIndex];
    console.log('[BATTLE] Active pokemon:', activePokemon.name, 'moves:', activePokemon.moves?.map(m => m.moveId));
    move = activePokemon.moves?.find(m => m.moveId === actionData.moveId);
    
    if (!move) {
      console.log('[BATTLE] Move not found:', actionData.moveId);
      sendTo(sessionId, { type: 'error', message: 'Movimiento no válido' });
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
  const activePokemon = player.team[player.activePokemonIndex];
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
    const { order, reason } = determineExecutionOrder(
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
      reason
    }
  });
  
  const player1 = battle.players.player1;
  const player2 = battle.players.player2;
  
  // Obtener Pokémon activos
  let p1Active = player1.team[player1.activePokemonIndex];
  let p2Active = player2.team[player2.activePokemonIndex];
  
  // Ejecutar acciones en orden
  for (const attackerId of order) {
    const attacker = attackerId === 'player1' ? player1 : player2;
    const defender = attackerId === 'player1' ? player2 : player1;
    const attackerPokemon = attackerId === 'player1' ? p1Active : p2Active;
    const defenderPokemon = attackerId === 'player1' ? p2Active : p1Active;
    const action = attackerId === 'player1' ? battle.pendingActions.player1 : battle.pendingActions.player2;
    
    if (!action) continue;
    
    // V1 Simplificado: siempre puede actuar (sin estados)
    let result;
    
    if (action.type === 'attack' && action.move) {
      // Ejecutar movimiento
      result = executeMove(attackerPokemon, defenderPokemon, action.move, attackerId);
    } else if (action.type === 'change' && action.pokemonId !== undefined) {
      // Ejecutar cambio
      const currentIndex = attacker.activePokemonIndex;
      const newIndex = attacker.team.findIndex(p => p.id === action.pokemonId);
      
      if (newIndex >= 0 && newIndex !== currentIndex) {
        const switchResult = executeSwitch(attacker, newIndex, currentIndex);
        result = {
          success: switchResult.success,
          action,
          message: switchResult.message,
          failed: !switchResult.success
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
        },
        attackerHp: attackerPokemon.hp,
        defenderHp: defenderPokemon.hp
      }
    });
    
    battle.actionResults.push(result);
    
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
  
  // Fase 4: V1 - Sin efectos de estados (simplificado)
  // Solo verificar KO por daño de ataques directos
  
  // Limpiar flags (no hay fatiga en V1 básico)
  // (Los flags cannotActNextTurn ya no se usan)
  
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