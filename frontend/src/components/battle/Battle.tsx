/**
 * Battle - Componente Principal de Batalla
 * Interfaz de batalla estilo Pokémon clásico
 * 
 * Muestra:
 * - Panel enemigo (arriba derecha)
 * - Panel jugador (abajo izquierda) 
 * - Panel de comandos (abajo derecha)
 * - Campo de batalla (centro)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { joinRoom } from '../../websocket';
import './Battle.css';

// ============================================
// INTERFACES
// ============================================

interface BattleMove {
  moveId: number;
  name: string;
  type: string;
}

interface BattlePokemon {
  id: number;
  pokeapiId: number;
  name: string;
  types: string[];
  hp: number;
  maxHp: number;
  sprites: {
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
  };
  isFainted: boolean;
  moves?: BattleMove[];
}

interface BattleState {
  roomCode: string;
  turn: number;
  phase: 'selecting' | 'determining' | 'executing' | 'finalizing' | 'ended';
  player1: {
    name: string;
    activePokemon: BattlePokemon;
    team: BattlePokemon[];
  };
  player2: {
    name: string;
    activePokemon: BattlePokemon;
    team: BattlePokemon[];
  };
}

interface BattleMessage {
  type: string;
  data?: any;
}

// ============================================
// COMPONENTES
// ============================================

/**
 * Panel de Información del Pokémon (HUD estilo Pokémon)
 */
function PokemonInfoPanel({ 
  pokemon, 
  isPlayer
}: { 
  pokemon: BattlePokemon | null; 
  isPlayer: boolean;
}) {
  if (!pokemon) return null;
  
  const hpPercent = pokemon.maxHp > 0 ? (pokemon.hp / pokemon.maxHp) * 100 : 0;
  
  // Determinar color de la barra de HP
  let hpColor = '#4CAF50'; // Verde
  if (hpPercent <= 50) hpColor = '#FFC107'; // Amarillo
  if (hpPercent <= 20) hpColor = '#F44336'; // Rojo
  
  return (
    <div className={`pokemon-info-panel ${isPlayer ? 'player' : 'enemy'}`}>
      <div className="pokemon-name-level">
        <span className="pokemon-name">{pokemon.name}</span>
        <span className="pokemon-level">Lv50</span>
      </div>
      
      <div className="hp-bar-container">
        <div className="hp-label">HP</div>
        <div className="hp-bar-bg">
          <div 
            className="hp-bar-fill" 
            style={{ 
              width: `${hpPercent}%`,
              backgroundColor: hpColor
            }}
          />
        </div>
        <div className="hp-numbers">
          {pokemon.hp} / {pokemon.maxHp}
        </div>
      </div>
    </div>
  );
}

/**
 * Sprite del Pokémon en el campo de batalla
 */
function PokemonSprite({ 
  pokemon, 
  isPlayer 
}: { 
  pokemon: BattlePokemon | null; 
  isPlayer: boolean;
}) {
  if (!pokemon) return <div className="pokemon-sprite-placeholder" />;
  
  const sprite = isPlayer 
    ? pokemon.sprites.back_default || pokemon.sprites.front_default
    : pokemon.sprites.front_default;
  
  return (
    <div className={`pokemon-sprite ${isPlayer ? 'player' : 'enemy'}`}>
      {sprite ? (
        <img 
          src={sprite} 
          alt={pokemon.name}
          className={pokemon.isFainted ? 'fainted' : ''}
        />
      ) : (
        <div className="no-sprite">?</div>
      )}
    </div>
  );
}

/**
 * Panel de Comandos (Luchar, Cambiar, etc.)
 */
function CommandPanel({ 
  onAttack, 
  onChange,
  moves,
  disabled
}: { 
  onAttack: (moveId: number) => void; 
  onChange: () => void;
  moves?: any[];
  disabled?: boolean;
}) {
  const [showMoves, setShowMoves] = useState(false);
  
  return (
    <div className="command-panel">
      {!showMoves ? (
        <div className="commands-grid">
          <button 
            className="command-btn fight"
            onClick={() => setShowMoves(true)}
            disabled={disabled}
          >
            LUCHAR
          </button>
          <button 
            className="command-btn bag"
            onClick={onChange}
            disabled={disabled}
          >
            CAMBIAR
          </button>
          <button 
            className="command-btn pokemon"
            disabled={disabled}
          >
            MOCHILA
          </button>
          <button 
            className="command-btn run"
            disabled={disabled}
          >
            HUIR
          </button>
        </div>
      ) : (
        <div className="moves-panel">
          <button 
            className="back-btn"
            onClick={() => setShowMoves(false)}
          >
            ← VOLVER
          </button>
          <div className="moves-grid">
            {moves?.map((move: any, index: number) => (
              <button 
                key={move?.moveId || index}
                className="move-btn"
                onClick={() => {
                  onAttack(move?.moveId);
                  setShowMoves(false);
                }}
                disabled={disabled}
              >
                {move?.name || `Movimiento ${index + 1}`}
              </button>
            )) || <span className="no-moves">No hay movimientos</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Selector de Pokémon para cambio
 */
function PokemonSelector({ 
  team, 
  onSelect, 
  onCancel,
  currentPokemonId 
}: { 
  team: BattlePokemon[]; 
  onSelect: (pokemonId: number) => void;
  onCancel: () => void;
  currentPokemonId: number;
}) {
  return (
    <div className="pokemon-selector-overlay">
      <div className="pokemon-selector">
        <h3>Seleccionar Pokémon</h3>
        <div className="team-grid">
          {team.map(pokemon => (
            <button
              key={pokemon.id}
              className={`team-member ${pokemon.isFainted ? 'fainted' : ''} ${pokemon.id === currentPokemonId ? 'current' : ''}`}
              onClick={() => !pokemon.isFainted && pokemon.id !== currentPokemonId && onSelect(pokemon.id)}
              disabled={pokemon.isFainted || pokemon.id === currentPokemonId}
            >
              <img 
                src={pokemon.sprites.front_default || ''} 
                alt={pokemon.name}
                className="team-sprite"
              />
              <span className="team-name">{pokemon.name}</span>
              <div className="team-hp">
                <div 
                  className="team-hp-bar" 
                  style={{ 
                    width: `${(pokemon.hp / pokemon.maxHp) * 100}%`
                  }}
                />
              </div>
              <span className="team-hp-text">{pokemon.hp}/{pokemon.maxHp}</span>
            </button>
          ))}
        </div>
        <button className="cancel-btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Mensaje de batalla (estilo Pokémon)
 */
function BattleMessage({ 
  message, 
  onContinue 
}: { 
  message: string; 
  onContinue?: () => void;
}) {
  return (
    <div className="battle-message-box">
      <p>{message}</p>
      {onContinue && (
        <button className="continue-btn" onClick={onContinue}>
          CONTINUAR
        </button>
      )}
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function Battle() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { sendMessage, lastMessage } = useWebSocket();
  
  // Unirse a la sala al montar el componente
  useEffect(() => {
    if (roomCode) {
      console.log('[Battle] Uniéndose a la sala:', roomCode);
      joinRoom(roomCode, '');
    }
  }, [roomCode]);
  
  // Efecto para capturar el playerNumber de los mensajes de sala
  useEffect(() => {
    if (!lastMessage) return;
    
    const message = lastMessage;
    
    // Capturar player_number de room:created o room:joined
    if (message.type === 'room:created' || message.type === 'room:joined') {
      if (message.data?.player_number) {
        console.log('[Battle] Player number:', message.data.player_number);
        setPlayerNumber(message.data.player_number);
      }
    }
  }, [lastMessage]);
  
  // Estado de la batalla
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [lastBattleMessage, setLastBattleMessage] = useState<string>('¡La batalla está por comenzar!');
  const [showPokemonSelector, setShowPokemonSelector] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [loadingCountdown, setLoadingCountdown] = useState<number | null>(5); // Iniciar con 5 segundos visible
  const [playerNumber, setPlayerNumber] = useState<number>(1); // Determinar si somos player1 o player2
  
  // Efecto para el contador de carga de la batalla
  useEffect(() => {
    if (loadingCountdown === null) return;
    
    if (loadingCountdown <= 0) {
      // Cuando llega a 0, esperar el mensaje battle:start indefinidamente
      return;
    }
    
    const timer = setTimeout(() => {
      setLoadingCountdown(loadingCountdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [loadingCountdown]);
  
  // Efecto para escuchar mensajes WebSocket
  useEffect(() => {
    if (!lastMessage) return;
    
    const message: BattleMessage = lastMessage;
    
    // También escuchar battle:starting para iniciar el contador
    if (message.type === 'battle:starting') {
      setLoadingCountdown(5);
      return;
    }
    
    switch (message.type) {
      case 'battle:start':
        setBattleState({
          roomCode: message.data.roomCode,
          turn: message.data.turn,
          phase: message.data.phase,
          player1: message.data.player1,
          player2: message.data.player2
        });
        setLastBattleMessage('¡La batalla está por comenzar!');
        break;
        
      case 'battle:turn-start':
        if (battleState) {
          setBattleState(prev => prev ? {
            ...prev,
            turn: message.data.turn,
            phase: 'executing'
          } : null);
        }
        // Determinar si es mi turno
        const firstPlayer = message.data.executionOrder[0];
        setIsMyTurn(firstPlayer === `player${playerNumber}`);
        setLastBattleMessage(`Turno ${message.data.turn} - ${message.data.reason}`);
        break;
        
      case 'battle:action-result':
        setLastBattleMessage(message.data.result.message);
        // Actualizar HP
        if (battleState) {
          setBattleState(prev => {
            if (!prev) return null;
            const isP1Action = message.data.playerId === 'player1';
            return {
              ...prev,
              [isP1Action ? 'player1' : 'player2']: {
                ...prev[isP1Action ? 'player1' : 'player2'],
                activePokemon: {
                  ...(isP1Action ? prev.player1.activePokemon : prev.player2.activePokemon),
                  hp: message.data.attackerHp
                }
              },
              [isP1Action ? 'player2' : 'player1']: {
                ...prev[isP1Action ? 'player2' : 'player1'],
                activePokemon: {
                  ...(isP1Action ? prev.player2.activePokemon : prev.player1.activePokemon),
                  hp: message.data.defenderHp
                }
              }
            };
          });
        }
        break;
        
      case 'battle:turn-end':
        setLastBattleMessage(`Turno ${message.data.turn} completado.`);
        setIsMyTurn(true); // Mi turno de seleccionar
        // Actualizar estados
        if (battleState) {
          setBattleState(prev => {
            if (!prev) return null;
            return {
              ...prev,
              player1: message.data.player1,
              player2: message.data.player2,
              turn: message.data.nextTurn,
              phase: 'selecting'
            };
          });
        }
        break;
        
      case 'battle:end':
        setBattleState(prev => prev ? {
          ...prev,
          phase: 'ended'
        } : null);
        setLastBattleMessage(message.data.message);
        break;
        
      case 'battle:action-selected':
        // Notificación de que el oponente seleccionó
        break;
    }
  }, [lastMessage, battleState, playerNumber]);
  
  // Handlers
  const handleAttack = useCallback((moveId: number) => {
    if (!moveId) return;
    sendMessage({
      type: 'battle:action',
      data: {
        type: 'attack',
        moveId
      }
    });
    setIsMyTurn(false);
  }, [sendMessage]);
  
  const handleChange = useCallback((pokemonId: number) => {
    sendMessage({
      type: 'battle:action',
      data: {
        type: 'change',
        pokemonId
      }
    });
    setShowPokemonSelector(false);
    setIsMyTurn(false);
  }, [sendMessage]);
  
  const handleOpenChange = useCallback(() => {
    setShowPokemonSelector(true);
  }, []);
  
  // Obtener datos del jugador actual según playerNumber
  // Si playerNumber === 1: somos player1, nuestro equipo está en player1
  // Si playerNumber === 2: somos player2, nuestro equipo está en player2
  const isPlayer1 = playerNumber === 1;
  const myTeam = isPlayer1 
    ? (battleState?.player1?.team || []) 
    : (battleState?.player2?.team || []);
  const myPokemon = isPlayer1 
    ? battleState?.player1?.activePokemon 
    : battleState?.player2?.activePokemon;
  const opponentPokemon = isPlayer1 
    ? battleState?.player2?.activePokemon 
    : battleState?.player1?.activePokemon;
  
  // Obtener movimientos del Pokémon activo
  const moves = myPokemon?.moves || [];
  
  if (!battleState) {
    return (
      <div className="battle-loading">
        <div className="loading-pokeball">
          <div className="pokeball" />
        </div>
        {loadingCountdown !== null ? (
          <div className="loading-countdown">
            <span className="countdown-number">{loadingCountdown}</span>
            <p>Cargando datos de batalla...</p>
          </div>
        ) : (
          <p>Cargando batalla...</p>
        )}
      </div>
    );
  }
  
  return (
    <div className="battle-container">
      {/* Campo de batalla */}
      <div className="battle-field">
        {/* 
          Posiciones según el jugador:
          - Player 1: su pokémon abajo (player-position), oponente arriba (enemy-position)
          - Player 2: su pokémon arriba (enemy-position), oponente abajo (player-position)
        */}
        {isPlayer1 ? (
          <>
            {/* Player 1: oponente arriba (de frente), jugador abajo (de espalda) */}
            <div className="enemy-position">
              <PokemonInfoPanel 
                pokemon={opponentPokemon} 
                isPlayer={false}
              />
              <PokemonSprite 
                pokemon={opponentPokemon} 
                isPlayer={false}
              />
            </div>
            
            <div className="player-position">
              <PokemonSprite 
                pokemon={myPokemon} 
                isPlayer={true}
              />
              <PokemonInfoPanel 
                pokemon={myPokemon} 
                isPlayer={true}
              />
            </div>
          </>
        ) : (
          <>
            {/* Player 2: oponente arriba (de frente), jugador abajo (de espalda) - INVERTIDO */}
            <div className="enemy-position">
              <PokemonInfoPanel 
                pokemon={opponentPokemon} 
                isPlayer={false}
              />
              <PokemonSprite 
                pokemon={opponentPokemon} 
                isPlayer={false}
              />
            </div>
            
            <div className="player-position">
              <PokemonSprite 
                pokemon={myPokemon} 
                isPlayer={true}
              />
              <PokemonInfoPanel 
                pokemon={myPokemon} 
                isPlayer={true}
              />
            </div>
          </>
        )}
      </div>
      
      {/* Panel de comandos */}
      <div className="battle-panel">
        <BattleMessage 
          message={lastBattleMessage}
        />
        <CommandPanel 
          onAttack={() => handleAttack(moves[0]?.moveId)}
          onChange={handleOpenChange}
          moves={moves}
          disabled={!isMyTurn || battleState.phase === 'ended'}
        />
      </div>
      
      {/* Selector de Pokémon */}
      {showPokemonSelector && (
        <PokemonSelector
          team={myTeam || []}
          onSelect={handleChange}
          onCancel={() => setShowPokemonSelector(false)}
          currentPokemonId={myPokemon?.id || 0}
        />
      )}
    </div>
  );
}