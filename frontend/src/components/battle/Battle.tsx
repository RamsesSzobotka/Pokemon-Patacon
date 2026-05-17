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

import { useState, useEffect, useCallback, useRef } from 'react';
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
  description?: string;
  type: string;
  damageClass?: string;
  power: number;
  accuracy?: number;
  priority?: number;
  pp: number;
  maxPp: number;
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
 * Con animación de HP cuando recibe daño
 */
function PokemonInfoPanel({
  pokemon,
  isPlayer
}: {
  pokemon: BattlePokemon | null;
  isPlayer: boolean;
}) {
  const [prevHp, setPrevHp] = useState<number>(pokemon?.hp || 0);
  const [isDamaged, setIsDamaged] = useState(false);

  // Detectar cuando el HP baja para activar animación
  useEffect(() => {
    if (pokemon && prevHp > pokemon.hp) {
      setIsDamaged(true);
      // Remover la clase después de la animación
      const timer = setTimeout(() => setIsDamaged(false), 800);
      return () => clearTimeout(timer);
    }
    setPrevHp(pokemon?.hp || 0);
  }, [pokemon?.hp, prevHp, pokemon]);

  if (!pokemon) return null;

  const hpPercent = pokemon.maxHp > 0 ? (pokemon.hp / pokemon.maxHp) * 100 : 0;

  // Determinar color de la barra de HP según umbrales
  let hpColor = '#4CAF50'; // Verde - más de 35%
  if (hpPercent <= 10) {
    hpColor = '#F44336'; // Rojo - 10% o menos
  } else if (hpPercent <= 35) {
    hpColor = '#FF9800'; // Naranja - entre 10% y 35%
  }

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
            className={`hp-bar-fill ${isDamaged ? 'damaged' : ''}`}
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
  isPlayer,
  isFainting = false,
  showSprite = true
}: {
  pokemon: BattlePokemon | null;
  isPlayer: boolean;
  isFainting?: boolean;
  showSprite?: boolean;
}) {
  // Si no hay sprite para mostrar (cuando está cambiando), mostrar placeholder
  if (!showSprite) {
    return (
      <div className={`pokemon-sprite ${isPlayer ? 'player' : 'enemy'}`}>
        <div className="pokemon-sprite-placeholder hidden">
          <span className="changing-message">Cambiando...</span>
        </div>
      </div>
    );
  }

  if (!pokemon) return <div className="pokemon-sprite-placeholder" />;

  const sprite = isPlayer
    ? pokemon.sprites.back_default || pokemon.sprites.front_default
    : pokemon.sprites.front_default;

  // Determinar la clase de animación según el estado
  let spriteClass = '';
  if (isFainting) {
    spriteClass = 'fainting';
  } else if (pokemon.isFainted) {
    spriteClass = 'fainted';
  }

  return (
    <div className={`pokemon-sprite ${isPlayer ? 'player' : 'enemy'}`}>
      {sprite ? (
        <img
          src={sprite}
          alt={pokemon.name}
          className={spriteClass}
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

  // Función para formatear el nombre del movimiento
  const formatMoveName = (name: string | undefined): string => {
    if (!name) return 'Movimiento';

    // Si el nombre ya está en español, retornarlo directamente
    if (/[áéíóúñü¿¡]/i.test(name)) return name;

    // Convertir el nombre a formato más legible (quitar guiones)
    return name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Función para obtener el tipo del movimiento
  const getTypeIcon = (type: string | undefined): string => {
    const typeIcons: Record<string, string> = {
      normal: '⚪', fire: '🔥', water: '💧', electric: '⚡', grass: '🌿',
      ice: '❄️', fighting: '👊', poison: '☠️', ground: '🪨', flying: '🐦',
      psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉',
      dark: '🌑', steel: '⚙️', fairy: '✨'
    };
    return typeIcons[type?.toLowerCase() || ''] || '⚪';
  };

  // Colores de tipos (semi-transparentes, igual que en la Pokédex)
  const getTypeColor = (type: string | undefined): string => {
    const typeColors: Record<string, string> = {
      normal: 'rgba(168, 168, 120, 0.75)',
      fire: 'rgba(240, 128, 48, 0.75)',
      water: 'rgba(104, 144, 240, 0.75)',
      electric: 'rgba(248, 208, 48, 0.75)',
      grass: 'rgba(120, 200, 80, 0.75)',
      ice: 'rgba(152, 216, 216, 0.75)',
      fighting: 'rgba(192, 48, 40, 0.75)',
      poison: 'rgba(160, 64, 160, 0.75)',
      ground: 'rgba(224, 192, 104, 0.75)',
      flying: 'rgba(168, 144, 240, 0.75)',
      psychic: 'rgba(248, 88, 136, 0.75)',
      bug: 'rgba(168, 184, 32, 0.75)',
      rock: 'rgba(184, 160, 56, 0.75)',
      ghost: 'rgba(112, 88, 152, 0.75)',
      dragon: 'rgba(112, 56, 248, 0.75)',
      dark: 'rgba(112, 88, 72, 0.75)',
      steel: 'rgba(184, 184, 208, 0.75)',
      fairy: 'rgba(238, 153, 172, 0.75)'
    };
    return typeColors[type?.toLowerCase() || ''] || 'rgba(168, 168, 120, 0.75)';
  };

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
                style={{
                  backgroundColor: getTypeColor(move?.type),
                  borderColor: getTypeColor(move?.type)
                }}
                onClick={() => {
                  onAttack(move?.moveId);
                  setShowMoves(false);
                }}
                disabled={disabled}
              >
                <div className="move-name">
                  {formatMoveName(move?.name)}
                </div>
                <div className="move-info">
                  <span className="move-type">{getTypeIcon(move?.type)}</span>
                  <span className="move-power">
                    {move?.power || 0} PWR
                  </span>
                  <span className="move-pp">
                    PP {move?.pp || 0}/{move?.maxPp || 0}
                  </span>
                </div>
              </button>
            )) || <span className="no-moves">No hay movimientos</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Modal de Detalles del Movimiento
 */
function MoveDetailModal({
  move,
  onClose
}: {
  move: any;
  onClose: () => void;
}) {
  const getTypeColor = (type: string): string => {
    const typeColors: Record<string, string> = {
      normal: 'rgba(168, 168, 120, 0.75)',
      fire: 'rgba(240, 128, 48, 0.75)',
      water: 'rgba(104, 144, 240, 0.75)',
      electric: 'rgba(248, 208, 48, 0.75)',
      grass: 'rgba(120, 200, 80, 0.75)',
      ice: 'rgba(152, 216, 216, 0.75)',
      fighting: 'rgba(192, 48, 40, 0.75)',
      poison: 'rgba(160, 64, 160, 0.75)',
      ground: 'rgba(224, 192, 104, 0.75)',
      flying: 'rgba(168, 144, 240, 0.75)',
      psychic: 'rgba(248, 88, 136, 0.75)',
      bug: 'rgba(168, 184, 32, 0.75)',
      rock: 'rgba(184, 160, 56, 0.75)',
      ghost: 'rgba(112, 88, 152, 0.75)',
      dragon: 'rgba(112, 56, 248, 0.75)',
      dark: 'rgba(112, 88, 72, 0.75)',
      steel: 'rgba(184, 184, 208, 0.75)',
      fairy: 'rgba(238, 153, 172, 0.75)'
    };
    return typeColors[type?.toLowerCase()] || 'rgba(168, 168, 120, 0.75)';
  };

  const formatMoveName = (name: string): string => {
    if (/[áéíóúñü¿¡]/i.test(name)) return name;
    return name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTypeIcon = (type: string): string => {
    const typeIcons: Record<string, string> = {
      normal: '⚪', fire: '🔥', water: '💧', electric: '⚡', grass: '🌿',
      ice: '❄️', fighting: '👊', poison: '☠️', ground: '🪨', flying: '🐦',
      psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉',
      dark: '🌑', steel: '⚙️', fairy: '✨'
    };
    return typeIcons[type?.toLowerCase()] || '⚪';
  };

  return (
    <div className="move-detail-overlay" onClick={onClose}>
      <div className="move-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="move-detail-header" style={{ backgroundColor: getTypeColor(move?.type) }}>
          <span className="move-detail-type-icon">{getTypeIcon(move?.type)}</span>
          <h2 className="move-detail-name">{formatMoveName(move?.name)}</h2>
          <span className="move-detail-type">{move?.type}</span>
        </div>

        {/* Descripción del movimiento - con fallback */}
        <div className="move-description-box">
          <p>{move?.description || `Movimiento de tipo ${move?.type || 'desconocido'}.`}</p>
        </div>

        <div className="move-detail-stats">
          <div className="move-stat-item">
            <span className="move-stat-label">Poder</span>
            <span className="move-stat-value power">{move?.power || 0}</span>
          </div>
          <div className="move-stat-item">
            <span className="move-stat-label">PP</span>
            <span className="move-stat-value">{move?.pp || 0} / {move?.maxPp || 0}</span>
          </div>
          <div className="move-stat-item">
            <span className="move-stat-label">Precisión</span>
            <span className="move-stat-value">{move?.accuracy || '-'}%</span>
          </div>
          <div className="move-stat-item">
            <span className="move-stat-label">Prioridad</span>
            <span className="move-stat-value">{move?.priority || 0}</span>
          </div>
        </div>

        <div className="move-detail-class">
          <span className="class-label">Clase:</span>
          <span className={`class-badge ${move?.damageClass}`}>
            {move?.damageClass === 'physical' ? 'Físico' :
             move?.damageClass === 'special' ? 'Especial' : 'Estado'}
          </span>
        </div>

        <button className="close-move-btn" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

/**
 * Modal de Detalles del Pokémon
 */
function PokemonDetailModal({
  pokemon,
  onClose,
  onSelect
}: {
  pokemon: BattlePokemon;
  onClose: () => void;
  onSelect: (pokemonId: number) => void;
}) {
  const [selectedMove, setSelectedMove] = useState<any>(null);

  const getTypeColor = (type: string): string => {
    const typeColors: Record<string, string> = {
      normal: 'rgba(168, 168, 120, 0.75)',
      fire: 'rgba(240, 128, 48, 0.75)',
      water: 'rgba(104, 144, 240, 0.75)',
      electric: 'rgba(248, 208, 48, 0.75)',
      grass: 'rgba(120, 200, 80, 0.75)',
      ice: 'rgba(152, 216, 216, 0.75)',
      fighting: 'rgba(192, 48, 40, 0.75)',
      poison: 'rgba(160, 64, 160, 0.75)',
      ground: 'rgba(224, 192, 104, 0.75)',
      flying: 'rgba(168, 144, 240, 0.75)',
      psychic: 'rgba(248, 88, 136, 0.75)',
      bug: 'rgba(168, 184, 32, 0.75)',
      rock: 'rgba(184, 160, 56, 0.75)',
      ghost: 'rgba(112, 88, 152, 0.75)',
      dragon: 'rgba(112, 56, 248, 0.75)',
      dark: 'rgba(112, 88, 72, 0.75)',
      steel: 'rgba(184, 184, 208, 0.75)',
      fairy: 'rgba(238, 153, 172, 0.75)'
    };
    return typeColors[type?.toLowerCase()] || 'rgba(168, 168, 120, 0.75)';
  };

  const formatMoveName = (name: string): string => {
    if (/[áéíóúñü¿¡]/i.test(name)) return name;
    return name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="pokemon-detail-overlay" onClick={onClose}>
      <div className="pokemon-detail-modal pokemon-modal-wide" onClick={e => e.stopPropagation()}>
        <button className="close-detail-btn" onClick={onClose}>×</button>

        {/* Header con sprite, nombre, tipos y HP lado a lado */}
        <div className="detail-header-horizontal">
          {/* Sprite a la izquierda */}
          <div className="detail-sprite-container-horizontal">
            <img
              src={pokemon.sprites.front_default || pokemon.sprites.front_shiny || ''}
              alt={pokemon.name}
              className="detail-sprite-large"
            />
          </div>

          {/* Info a la derecha del sprite */}
          <div className="detail-info-horizontal">
            <h2 className="detail-name">{pokemon.name}</h2>
            <div className="detail-types">
              {pokemon.types?.map((type: string) => (
                <span
                  key={type}
                  className="type-badge"
                  style={{ backgroundColor: getTypeColor(type) }}
                >
                  {type}
                </span>
              ))}
            </div>

            {/* HP */}
            <div className="detail-hp-section">
              <span className="detail-hp-label">HP</span>
              <div className="detail-hp-bar">
                <div
                  className="detail-hp-fill"
                  style={{
                    width: `${(pokemon.hp / pokemon.maxHp) * 100}%`,
                    backgroundColor: pokemon.hp > pokemon.maxHp * 0.35 ? '#4CAF50' :
                      pokemon.hp > pokemon.maxHp * 0.1 ? '#FF9800' : '#F44336'
                  }}
                />
              </div>
              <span className="detail-hp-text">{pokemon.hp} / {pokemon.maxHp}</span>
            </div>
          </div>
        </div>

        {/* Movimientos con clic para ver detalles - debajo de todo */}
        <div className="detail-moves-section">
          <h3 className="detail-moves-title">Movimientos</h3>
          <div className="detail-moves-grid">
            {pokemon.moves?.map((move: any, index: number) => (
              <button
                key={move?.moveId || index}
                className="detail-move-item"
                style={{
                  backgroundColor: getTypeColor(move?.type),
                  borderColor: getTypeColor(move?.type)
                }}
                onClick={() => setSelectedMove(move)}
              >
                <span className="detail-move-name">{formatMoveName(move?.name)}</span>
                <span className="detail-move-info">
                  {move?.power || 0} PWR | PP {move?.pp || 0}/{move?.maxPp || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="detail-actions">
          <button className="select-pokemon-btn" onClick={() => onSelect(pokemon.id)}>
            Seleccionar
          </button>
          <button className="cancel-detail-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de detalles del movimiento */}
      {selectedMove && (
        <MoveDetailModal
          move={selectedMove}
          onClose={() => setSelectedMove(null)}
        />
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
  const [selectedPokemonForDetails, setSelectedPokemonForDetails] = useState<BattlePokemon | null>(null);

  return (
    <div className="pokemon-selector-overlay">
      <div className="pokemon-selector">
        <h3>Seleccionar Pokémon</h3>
        <div className="team-grid">
          {team.map(pokemon => (
            <div
              key={pokemon.id}
              className={`team-member-card ${pokemon.isFainted ? 'fainted' : ''} ${pokemon.id === currentPokemonId ? 'current' : ''}`}
            >
              <button
                className="team-sprite-btn"
                disabled={pokemon.isFainted || pokemon.id === currentPokemonId}
              >
                <img
                  src={pokemon.sprites.front_default || ''}
                  alt={pokemon.name}
                  className="team-sprite"
                />
              </button>
              <span className="team-name">{pokemon.name}</span>
              <div className="team-hp">
                <div
                  className="team-hp-bar"
                  style={{
                    width: `${(pokemon.hp / pokemon.maxHp) * 100}%`,
                    backgroundColor: pokemon.hp > pokemon.maxHp * 0.35 ? '#4CAF50' :
                      pokemon.hp > pokemon.maxHp * 0.1 ? '#FF9800' : '#F44336'
                  }}
                />
              </div>
              <span className="team-hp-text">{pokemon.hp}/{pokemon.maxHp}</span>

              {/* Botones de acción */}
              <div className="team-member-actions">
                <button
                  className="action-btn select-btn"
                  onClick={() => onSelect(pokemon.id)}
                  disabled={pokemon.isFainted || pokemon.id === currentPokemonId}
                >
                  Seleccionar
                </button>
                <button
                  className="action-btn details-btn"
                  onClick={() => setSelectedPokemonForDetails(pokemon)}
                >
                  Ver detalles
                </button>
              </div>
            </div>
          ))}
        </div>
        <button className="cancel-btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>

      {/* Modal de detalles */}
      {selectedPokemonForDetails && (
        <PokemonDetailModal
          pokemon={selectedPokemonForDetails}
          onClose={() => setSelectedPokemonForDetails(null)}
          onSelect={(id) => {
            onSelect(id);
            setSelectedPokemonForDetails(null);
          }}
        />
      )}
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
      const success = joinRoom(roomCode, '');
      console.log('[Battle] Join room result:', success);
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

  // Estado para animaciones de defeat
  const [playerFainting, setPlayerFainting] = useState<'player1' | 'player2' | null>(null);
  const [showPlayer1Sprite, setShowPlayer1Sprite] = useState(true);
  const [showPlayer2Sprite, setShowPlayer2Sprite] = useState(true);

  // Sistema de cola de mensajes progresivos
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const messageQueueRef = useRef<string[]>([]);
  messageQueueRef.current = messageQueue;

  // Procesar cola de mensajes con delays
  useEffect(() => {
    if (messageQueue.length === 0) {
      setIsProcessingQueue(false);
      return;
    }

    setIsProcessingQueue(true);

    const processQueue = async () => {
      while (messageQueueRef.current.length > 0) {
        // Tomar el siguiente mensaje de la cola
        const nextMessage = messageQueueRef.current[0];
        setLastBattleMessage(nextMessage);

        // Esperar antes de mostrar el siguiente mensaje
        await new Promise(resolve => setTimeout(resolve, 1800));

        // Remover el mensaje procesado
        setMessageQueue(prev => prev.slice(1));
      }

      setIsProcessingQueue(false);
    };

    processQueue();

    // Cleanup al desmontar
    return () => {
      messageQueueRef.current = [];
    };
  }, [messageQueue.length > 0]);

  // Función para agregar mensajes a la cola
  const addMessagesToQueue = useCallback((messages: string[]) => {
    if (messages.length > 0) {
      setMessageQueue(prev => [...prev, ...messages]);
    }
  }, []);
  
  // Ref para evitar loops infinitos en useEffect
  const playerNumberRef = useRef(playerNumber);
  playerNumberRef.current = playerNumber;

  // Efecto para sincronizar el showSprite con el Pokemon activo
  // Esto asegura que el sprite se muestre correctamente cuando el Pokemon cambia
  useEffect(() => {
    if (!battleState) return;

    const p1ActivePokemon = battleState.player1.activePokemon;
    const p2ActivePokemon = battleState.player2.activePokemon;

    // Si el Pokemon activo de player1 no está faintado y tiene HP > 0, mostrar sprite
    if (p1ActivePokemon && !p1ActivePokemon.isFainted && p1ActivePokemon.hp > 0) {
      setShowPlayer1Sprite(true);
    }

    // Si el Pokemon activo de player2 no está faintado y tiene HP > 0, mostrar sprite
    if (p2ActivePokemon && !p2ActivePokemon.isFainted && p2ActivePokemon.hp > 0) {
      setShowPlayer2Sprite(true);
    }
  }, [battleState?.player1.activePokemon, battleState?.player2.activePokemon]);

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

    // Efecto para detectar cuando mi pokemon tiene HP=0 y mostrar selector
    if (battleState) {
      const myPokemon = isPlayer1 ? battleState.player1.activePokemon : battleState.player2.activePokemon;
      if (myPokemon && (myPokemon.hp <= 0 || myPokemon.isFainted) && !showPokemonSelector) {
        setShowPokemonSelector(true);
        setLastBattleMessage(`¡${myPokemon.name} faintó! Selecciona un Pokémon.`);
        setIsMyTurn(false);
      }
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
        setIsMyTurn(true); // Habilitar selección de acciones al inicio de la batalla
        break;
        
      case 'battle:turn-start':
        if (battleState) {
          setBattleState(prev => prev ? {
            ...prev,
            turn: message.data.turn,
            phase: 'executing'
          } : null);
        }
        // Durante la ejecución de acciones, deshabilitamos la selección
        setIsMyTurn(false);
        // Mensaje de inicio de turno - mostrar inmediatamente
        const orderMessage = message.data.reason.includes('coinflip')
          ? `${message.data.executionOrder[0] === (isPlayer1 ? 'player1' : 'player2') ? 'Tú' : message.data.executionOrder[0]} atacas primero`
          : message.data.reason;
        setLastBattleMessage(`Turno ${message.data.turn} - ${orderMessage}`);
        break;
        
      case 'battle:action-result':
        // No mostrar mensaje inmediatamente - agregarlo a la cola
        // Actualizar HP
        if (battleState) {
          const isP1Action = message.data.playerId === 'player1';
          const defenderPlayerId = isP1Action ? 'player2' : 'player1';
          const defenderHp = message.data.defenderHp || 0;

          // Detectar si el defensor llegó a 0 HP (para animación)
          const defenderPreviousHp = isP1Action
            ? battleState?.player2.activePokemon.hp
            : battleState?.player1.activePokemon.hp;

          const justFainted = defenderPreviousHp && defenderPreviousHp > 0 && defenderHp <= 0;

          if (justFainted) {
            // Activar animación de defeat para el jugador que perdió el Pokemon
            setPlayerFainting(defenderPlayerId);
            // Ocultar el sprite después de la animación
            setTimeout(() => {
              if (defenderPlayerId === 'player1') {
                setShowPlayer1Sprite(false);
              } else {
                setShowPlayer2Sprite(false);
              }
            }, 2200); // Después de la animación completa
          }

          setBattleState(prev => {
            if (!prev) return null;
            return {
              ...prev,
              [isP1Action ? 'player1' : 'player2']: {
                ...prev[isP1Action ? 'player1' : 'player2'],
                activePokemon: {
                  ...(isP1Action ? prev.player1.activePokemon : prev.player2.activePokemon),
                  hp: message.data.attackerHp
                }
              },
              [defenderPlayerId]: {
                ...prev[defenderPlayerId],
                activePokemon: {
                  ...prev[defenderPlayerId].activePokemon,
                  hp: defenderHp,
                  isFainted: defenderHp <= 0
                }
              }
            };
          });
        }

        // Agregar mensaje(s) a la cola
        const playerName = message.data.playerId === (isPlayer1 ? 'player1' : 'player2') ? 'Tú' : 'Oponente';
        const messages: string[] = [];

        if (message.data.action.type === 'attack') {
          messages.push(`${playerName} usó un ataque!`);
          if (message.data.result.message) {
            // El mensaje del backend contiene toda la información
            messages.push(message.data.result.message);
          }
          // Agregar info de HP
          const defenderName = message.data.playerId === (isPlayer1 ? 'player1' : 'player2')
            ? 'Oponente'
            : 'Tu Pokémon';
          const targetHp = message.data.result.targetHp || 0;
          // Intentar obtener el HP del defensoresultado del mensaje
          const defenderInfo = message.data.playerId === (isPlayer1 ? 'player1' : 'player2')
            ? (isPlayer1 ? battleState?.player2.activePokemon : battleState?.player1.activePokemon)
            : (isPlayer1 ? battleState?.player1.activePokemon : battleState?.player2.activePokemon);

          if (defenderInfo) {
            messages.push(`HP: ${defenderInfo.hp}/${defenderInfo.maxHp}`);
          }
        } else if (message.data.action.type === 'change') {
          messages.push(message.data.result.message || '¡Pokémon cambiado!');
        }

        // Si hay un mensaje de KO en el resultado, agregarlo
        if (message.data.result.message?.includes('faintó') || message.data.result.message?.includes('KO')) {
          messages.push(message.data.result.message);
        }

        addMessagesToQueue(messages);
        break;
        
      case 'battle:turn-end':
        setLastBattleMessage(`Turno ${message.data.turn} completado.`);

        // Verificar si mi pokemon activo faintó - forzar cambio
        // Usar playerNumber directamente para evitar re-renders infinitos
        const amIPlayer1 = playerNumber === 1 || playerNumber === 0;
        const myActivePokemon = amIPlayer1 ? message.data.player1.activePokemon : message.data.player2.activePokemon;

        if (myActivePokemon?.isFainted || myActivePokemon?.hp <= 0) {
          // Mi pokemon faintó, mostrar selector de cambio
          setShowPokemonSelector(true);
          setLastBattleMessage(`¡${myActivePokemon.name} faintó! Selecciona un Pokémon.`);
          setIsMyTurn(false); // No puede actuar mientras no cambie

          // Ocultar el sprite del Pokemon faintado
          if (amIPlayer1) {
            setShowPlayer1Sprite(false);
          } else {
            setShowPlayer2Sprite(false);
          }
        } else {
          // No faintó, habilitar selección para siguiente turno
          setIsMyTurn(true);
        }

        // Actualizar estados del turno - pero mantener los sprites visibles
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

      case 'battle:switch-success':
        // El cambio de pokemon se ejecutó exitosamente
        setLastBattleMessage(message.data.message);
        setShowPokemonSelector(false);

        // Resetear animación de defeat y mostrar nuevo sprite INMEDIATAMENTE
        const playerId = message.data.playerId;
        setPlayerFainting(null);
        // Usar un timeout para asegurar que se muestre el sprite correcto
        setTimeout(() => {
          if (playerId === 'player1') {
            setShowPlayer1Sprite(true);
          } else {
            setShowPlayer2Sprite(true);
          }
        }, 100);

        // Actualizar el estado de la batalla con el nuevo pokemon
        if (battleState) {
          const isMyPlayer = playerId === (isPlayer1 ? 'player1' : 'player2');
          const targetKey = playerId === 'player1' ? 'player1' : 'player2';

          // Crear el nuevo estado del jugador con el Pokemon correcto
          const updatedPlayerState = {
            ...battleState[targetKey],
            activePokemon: message.data.pokemon,
            team: battleState[targetKey].team.map(p =>
              p.id === message.data.pokemonId ? message.data.pokemon : p
            )
          };

          setBattleState(prev => {
            if (!prev) return null;
            return {
              ...prev,
              [targetKey]: updatedPlayerState,
              phase: 'selecting'
            };
          });

          if (isMyPlayer) {
            setIsMyTurn(true);
          }
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
    // Deshabilitar selección mientras se ejecuta el turno
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
  // Fallback: si no hay playerNumber, asumir que somos player1
  const isPlayer1 = playerNumber === 1 || playerNumber === 0; // 0 es el valor por defecto de useState
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
                isFainting={playerFainting === 'player2'}
                showSprite={showPlayer2Sprite}
              />
            </div>

            <div className="player-position">
              <PokemonSprite
                pokemon={myPokemon}
                isPlayer={true}
                isFainting={playerFainting === 'player1'}
                showSprite={showPlayer1Sprite}
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
                isFainting={playerFainting === 'player1'}
                showSprite={showPlayer1Sprite}
              />
            </div>

            <div className="player-position">
              <PokemonSprite
                pokemon={myPokemon}
                isPlayer={true}
                isFainting={playerFainting === 'player2'}
                showSprite={showPlayer2Sprite}
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
          onAttack={(moveId: number) => handleAttack(moveId)}
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