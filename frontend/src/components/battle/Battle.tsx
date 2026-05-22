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
import { useWebSocket } from '../../hooks/useWebSocket';
import { joinRoom } from '../../websocket';
import { CoinFlipAnimation } from './CoinFlipAnimation';
import './Battle.css';
import { useAuthSession } from '../../hooks/useAuthSession';
import { resolveFrontSprite, resolveBackSprite } from '../../utils/spriteResolver';
import { BackgroundMusic } from '../BackgroundMusic';

// ============================================
// INTERFACES
// ============================================

interface Ailment {
  type: 'burn' | 'poison' | 'toxic' | 'paralysis' | 'freeze' | 'sleep' | 'confusion' | 'flinch' | 'leech_seed' | 'curse';
  turnsRemaining?: number;
  appliedBy?: 'player1' | 'player2';
}

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
  ailments?: Ailment[];
  moves?: BattleMove[];
  // V3: 2-Turn Moves and Fatigue
  isChargingTwoTurn?: boolean;
  chargePhase?: 'charge' | 'execute' | null;
  currentTwoTurnMove?: BattleMove | null;
  isFatigued?: boolean;
  fatigueSource?: 'recharge' | 'exhaustion' | null;
  isEvasivelyCharging?: boolean;
  // Owner metadata for shiny rendering
  owner_shiny?: boolean;
  owner?: {
    session_id?: string;
    clerk_user_id?: string;
    shiny_pack?: boolean;
  };
}

interface BattleState {
  roomCode: string;
  turn: number;
  phase: 'selecting' | 'determining' | 'executing' | 'finalizing' | 'ended';
  player1: {
    name: string;
    activePokemon: BattlePokemon;
    team: BattlePokemon[];
    shiny_pack?: boolean;
  };
  player2: {
    name: string;
    activePokemon: BattlePokemon;
    team: BattlePokemon[];
    shiny_pack?: boolean;
  };
}

interface BattleMessage {
  type: string;
  data?: any;
}

interface BattleResultOverlay {
  result: 'win' | 'lose' | 'draw';
  title: string;
  subtitle: string;
}

// ============================================
// COMPONENTES
// ============================================

/**
 * Obtiene el nombre legible del efecto en español
 */
function getAilmentName(ailmentType: string): string {
  const a = String(ailmentType || '').trim().toLowerCase();
  const ailmentNames: { [key: string]: string } = {
    // English canonical keys
    'burn': 'Quemado',
    'poison': 'Envenenado',
    'toxic': 'Envenenado Gravemente',
    'paralysis': 'Paralizado',
    'freeze': 'Congelado',
    'sleep': 'Dormido',
    'confusion': 'Confundido',
    'flinch': 'Retrocedió',
    'leech_seed': 'Emboscada Semilla',
    'curse': 'Maldito',
    // Spanish aliases
    'quemado': 'Quemado',
    'venenado': 'Envenenado',
    'veneno': 'Envenenado',
    'paralizado': 'Paralizado',
    'parálisis': 'Paralizado',
    'congelado': 'Congelado',
    'dormido': 'Dormido',
    'confundido': 'Confundido',
    'emboscada_semilla': 'Emboscada Semilla',
    'emboscada semilla': 'Emboscada Semilla',
    'maldito': 'Maldito'
  };
  return ailmentNames[a] || 'Desconocido';
}

/**
 * Procesa el mensaje del servidor y lo convierte en secuencia de narración estilo Pokémon
 * Elimina información técnica como "recibió X de daño"
 */
function processServerMessage(message: string, actionType?: string, result?: any): string[] {
  // Si es un cambio de Pokémon, devolver mensaje simple
  if (actionType === 'change') {
    return [message || '¡Pokémon cambiado!'];
  }
  
  // Si es un ataque, procesar el mensaje
  const lines = message.split('\n').filter(line => line.trim());
  const narration: string[] = [];
  
  for (const line of lines) {
    // Eliminar líneas con información técnica
    if (line.includes('recibió') && line.includes('de daño')) {
      continue; // Skip "X recibió Y de daño"
    }
    if (line.includes('recibió') && line.includes('HP')) {
      continue; // Skip "recibió X HP"
    }
    if (line.includes('Turno') && !line.includes('turno')) {
      continue; // Skip "Turno X"
    }
    if (line.includes('usado') && line.includes('.')) {
      // Skip "Pikachu usado Impactrueno." - se procesa después
    }
    
    // Limpiar el mensaje
    let cleanedLine = line
      .replace(/\[.*?\]/g, '') // Remover tags como [turn:1]
      .replace(/\(.*?\)/g, '') // Remover paréntesis con info técnica
      .trim();
    
    // Reformatear mensajes de efectividad al estilo BW (sin acentos para evitar problemas)
    //Buscar cualquier variación de "muy efectivo" o "poco efectivo"
    const lowerLine = cleanedLine.toLowerCase();
    
    if (lowerLine.includes('muy efectivo') || lowerLine.includes('super efectivo')) {
      cleanedLine = '¡Es muy efectivo!';
    } else if (lowerLine.includes('no es muy efectivo') || lowerLine.includes('poco efectivo')) {
      cleanedLine = 'No es muy efectivo...';
    } else if (lowerLine.includes('no tiene efecto') || lowerLine.includes('sin efecto')) {
      cleanedLine = '¡No tiene efecto!';
    } else if (cleanedLine.toLowerCase().includes('se debilit') || cleanedLine.toLowerCase().includes('se debilito')) {
      cleanedLine = line; // Mantener el mensaje de KO tal cual
    } else if (cleanedLine.includes('usado')) {
      // Convertir "Pikachu usado Impactrueno." a "Pikachu usó Impactrueno."
      cleanedLine = cleanedLine.replace(/usado/g, 'usó').replace(/\.$/, '!');
    }
    
    if (cleanedLine && cleanedLine.trim() !== '') {
      narration.push(cleanedLine);
    }
  }
  
  // Si no hay narración válida, usar mensaje original
  if (narration.length === 0) {
    return [message];
  }
  
  return narration;
}

/**
 * Obtiene el color del efecto
 */
function getAilmentColor(ailmentType: string): string {
  const colors: { [key: string]: string } = {
    'burn': '#FF5722',
    'poison': '#AB47BC',
    'toxic': '#6A1B9A',
    'paralysis': '#FFD700',
    'freeze': '#00BCD4',
    'sleep': '#9C27B0',
    'confusion': '#E91E63',
    'flinch': '#FF6F00',
    'leech_seed': '#8BC34A',
    'curse': '#424242'
  };
  return colors[ailmentType] || '#999';
}

/**
 * Panel de Información del Pokémon (HUD estilo Pokémon)
 * Con animación de HP cuando recibe daño e indicador de efectos
 * V3: Con indicadores de carga y fatiga
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

  // Obtener el efecto principal (si hay)
  const mainAilment = pokemon.ailments && pokemon.ailments.length > 0 
    ? pokemon.ailments[0] 
    : null;

  return (
    <div className={`pokemon-info-panel ${isPlayer ? 'player' : 'enemy'}`}>
      <div className="pokemon-name-level">
        <span className="pokemon-name">{pokemon.name}</span>
        <span className="pokemon-level">Lv50</span>
      </div>

      {/* Indicador de efecto */}
      {mainAilment && (
        <div 
          className="ailment-indicator"
          style={{ backgroundColor: getAilmentColor(mainAilment.type) }}
          title={getAilmentName(mainAilment.type)}
        >
          <span className="ailment-text">{getAilmentName(mainAilment.type).substring(0, 3).toUpperCase()}</span>
        </div>
      )}

      {/* V3: Indicador de carga (2-Turn Moves) */}
      {pokemon.isChargingTwoTurn && pokemon.currentTwoTurnMove && (
        <div className="v3-status-indicator charging" title="Cargando movimiento">
          <span>⚡ {pokemon.chargePhase === 'charge' ? 'Preparando...' : 'Listo'}</span>
        </div>
      )}

      {/* V3: Indicador de evasión (Fly, Dig, etc) */}
      {pokemon.isEvasivelyCharging && (
        <div className="v3-status-indicator evasion" title="En posición evasiva">
          <span>🛡️ Evasivo</span>
        </div>
      )}

      {/* V3: Indicador de fatiga */}
      {pokemon.isFatigued && (
        <div 
          className={`v3-status-indicator fatigue ${pokemon.fatigueSource || 'unknown'}`}
          title={pokemon.fatigueSource === 'recharge' ? 'Agotado (necesita descansar)' : 'Exhausto (débil)'}
        >
          <span>
            {pokemon.fatigueSource === 'recharge' ? '💤 Agotado' : '😓 Exhausto'}
          </span>
        </div>
      )}

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
 * Obtiene el sprite correcto para un Pokémon en batalla
 * Determina si usar shiny basado en owner_shiny del Pokémon
 * @param pokemon - El Pokémon en batalla
 * @param isBackSprite - true para back sprite, false para front sprite
 * @returns URL del sprite o string vacío
 */
function getBattleSprite(pokemon: BattlePokemon | null, isBackSprite: boolean): string {
  if (!pokemon) return '';

  // Determinar si usar shiny basándose en el dueño del Pokémon
  // owner_shiny es enviado por el backend basándose en si el dueño tiene shiny_pack
  const useShiny = pokemon.owner_shiny === true;
  
  if (isBackSprite) {
    return resolveBackSprite(pokemon.sprites as any, useShiny, pokemon.pokeapiId);
  } else {
    return resolveFrontSprite(pokemon.sprites as any, useShiny, pokemon.pokeapiId);
  }
}

/**
 * Sprite del Pokémon en el campo de batalla
 * V3: Con soporte para carga, evasión y fatiga
 */
function PokemonSprite({
  pokemon,
  isPlayer,
  isFainting = false,
  showSprite = true,
  isAttacking = false,
  isHit = false
}: {
  pokemon: BattlePokemon | null;
  isPlayer: boolean;
  isFainting?: boolean;
  showSprite?: boolean;
  isAttacking?: boolean;
  isHit?: boolean;
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

  // Usar sprite front para oponente, back para jugador
  // El sprite depende ÚNICAMENTE de owner_shiny del Pokémon
  const sprite = isPlayer
    ? getBattleSprite(pokemon, true)  // back sprite para jugador
    : getBattleSprite(pokemon, false); // front sprite para oponente

  // Determinar la clase de animación según el estado
  let spriteClass = '';
  if (isFainting) {
    spriteClass = 'fainting';
  } else if (pokemon.isFainted) {
    spriteClass = 'fainted';
  }

  // Agregar clase de ataque si está atacando o recibiendo daño
  const spriteClasses = [
    spriteClass,
    isAttacking ? 'attacking' : '',
    isHit ? 'hit' : '',
    // V3: Agregar clases para estados V3
    pokemon.isChargingTwoTurn ? 'v3-charging' : '',
    pokemon.isEvasivelyCharging ? 'v3-evasive' : '',
    pokemon.isFatigued ? `v3-fatigued v3-fatigued-${pokemon.fatigueSource || 'unknown'}` : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={`pokemon-sprite ${isPlayer ? 'player' : 'enemy'} ${isAttacking ? 'attacking' : ''} ${isHit ? 'hit' : ''} ${pokemon.isChargingTwoTurn ? 'v3-charging' : ''} ${pokemon.isEvasivelyCharging ? 'v3-evasive' : ''} ${pokemon.isFatigued ? 'v3-fatigued' : ''}`}>
      <div className="pokemon-base" aria-hidden="true" />
      {sprite ? (
        <img
          src={sprite}
          alt={pokemon.name}
          className={spriteClasses}
        />
      ) : (
        <div className="no-sprite">?</div>
      )}
    </div>
  );
}

/**
 * Panel de Comandos (Luchar, Cambiar, etc.)
 * V3: Con soporte para movimientos de 2 turnos y fatiga
 */
function CommandPanel({
  onAttack,
  onChange,
  onSurrender,
  moves,
  disabled,
  isChargingTwoTurn,
  chargePhase,
  currentTwoTurnMove,
  isFatigued,
  fatigueSource
}: {
  onAttack: (moveId: number) => void;
  onChange: () => void;
  onSurrender?: () => void;
  moves?: any[];
  disabled?: boolean;
  // V3 props
  isChargingTwoTurn?: boolean;
  chargePhase?: 'charge' | 'execute' | null;
  currentTwoTurnMove?: any;
  isFatigued?: boolean;
  fatigueSource?: 'recharge' | 'exhaustion' | null;
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

  // V3: Determinar si el Pokémon puede actuar
  const isFatigueBlocking = isFatigued && fatigueSource === 'recharge';
  const canActNormally = !isFatigueBlocking;

  // V3: Si está en ejecución de movimiento de 2 turnos, mostrar botón "Ejecutar"
  if (isChargingTwoTurn && chargePhase === 'charge' && currentTwoTurnMove) {
    return (
      <div className="command-panel v3-charging-mode">
        <div className="charging-notice">
          <p>⚡ {formatMoveName(currentTwoTurnMove.name)} está listo para ejecutarse</p>
        </div>
        <div className="commands-grid">
          <button className="command-btn execute-charging" disabled>
            EJECUTANDO
          </button>
          <button className="command-btn change-forced" disabled>
            ESPERA
          </button>
        </div>
      </div>
    );
  }

  // V3: Si está fatigado (recharge), mostrar mensaje bloqueante
  if (isFatigueBlocking) {
    return (
      <div className="command-panel v3-fatigue-mode">
        <div className="fatigue-notice">
          <p>💤 ¡Tu Pokémon está agotado! Necesita descansar.</p>
        </div>
        <div className="commands-grid">
          <button
            className="command-btn fight"
            disabled={true}
            title="Tu Pokémon está agotado y no puede atacar"
          >
            LUCHAR (Bloqueado)
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
            disabled={true}
          >
            MOCHILA
          </button>
          <button
            className="command-btn run"
            disabled={true}
          >
            RENDIRSE
          </button>
        </div>
      </div>
    );
  }

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
            onClick={() => {
              if (onSurrender && confirm('¿Estás seguro de que quieres rendirte?')) {
                onSurrender();
              }
            }}
          >
            RENDIRSE
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
            {/* Siempre mostrar 4 slots de movimientos */}
            {[0, 1, 2, 3].map((index) => {
              const move = moves?.[index];
              if (move) {
                // Verificar si el movimiento tiene PP disponible
                const hasPP = (move?.pp || 0) > 0;
                const isDisabled = disabled || !hasPP;

                return (
                  <button
                    key={move?.moveId || index}
                    className={`move-btn ${!hasPP ? 'no-pp' : ''}`}
                    style={{
                      backgroundColor: getTypeColor(move?.type),
                      borderColor: getTypeColor(move?.type),
                      opacity: !hasPP ? 0.5 : 1
                    }}
                    onClick={() => {
                      if (hasPP) {
                        onAttack(move?.moveId);
                        setShowMoves(false);
                      }
                    }}
                    disabled={isDisabled}
                  >
                    <div className="move-name">
                      {formatMoveName(move?.name)}
                    </div>
                    <div className="move-info">
                      <span className="move-type">{getTypeIcon(move?.type)}</span>
                      <span className="move-power">
                        {move?.power || 0} PWR
                      </span>
                      <span className={`move-pp ${!hasPP ? 'pp-exhausted' : ''}`}>
                        {hasPP ? `PP ${move?.pp}/${move?.maxPp}` : 'SIN PP'}
                      </span>
                    </div>
                  </button>
                );
              }
              // Slot vacío - mostrar indicador
              return (
                <button
                  key={`empty-${index}`}
                  className="move-btn move-btn-empty"
                  disabled={disabled}
                >
                  <div className="move-name">—</div>
                  <div className="move-info">
                    <span className="move-type">-</span>
                    <span className="move-power">-</span>
                    <span className="move-pp">-</span>
                  </div>
                </button>
              );
            })}
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
  const { shinyPack } = useAuthSession();
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
              src={resolveFrontSprite(pokemon.sprites as any, pokemon.owner_shiny === true, pokemon.pokeapiId)}
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
            {/* Siempre mostrar 4 slots de movimientos */}
            {[0, 1, 2, 3].map((index) => {
              const move = pokemon.moves?.[index];
              if (move) {
                return (
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
                );
              }
              // Slot vacío
              return (
                <button
                  key={`empty-${index}`}
                  className="detail-move-item detail-move-item-empty"
                  disabled
                >
                  <span className="detail-move-name">—</span>
                  <span className="detail-move-info">-</span>
                </button>
              );
            })}
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
  const { shinyPack } = useAuthSession();
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
                  src={resolveFrontSprite(pokemon.sprites as any, pokemon.owner_shiny === true, pokemon.pokeapiId)}
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
  // Renderizar saltos de línea como <br>
  const messageLines = message.split('\n').map((line, index) => (
    <span key={index}>
      {line}
      {index < message.split('\n').length - 1 && <br />}
    </span>
  ));

  return (
    <div className="battle-message-box">
      <p>{messageLines}</p>
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

interface BattleProps {
  roomCode?: string;
}

export default function Battle({ roomCode }: BattleProps) {
  const { sendMessage, lastMessage } = useWebSocket();
  const returnToMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const battleStateRequestedRef = useRef(false);
  
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
    
    // Capturar player_number de room:created, room:joined o room:reconnected
    if (message.type === 'room:created' || message.type === 'room:joined' || message.type === 'room:reconnected') {
      if (message.data?.player_number) {
        console.log('[Battle] Player number:', message.data.player_number);
        setPlayerNumber(message.data.player_number);
      }

      // Pedir el estado actual de batalla como respaldo si se perdió battle:start
      if (!battleStateRequestedRef.current) {
        battleStateRequestedRef.current = true;
        sendMessage({ type: 'battle:state' });
      }
    }
  }, [lastMessage]);
  
  // Estado de la batalla
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [lastBattleMessage, setLastBattleMessage] = useState<string>('¡La batalla está por comenzar!');
  
  // Sistema de narración secuencial (estilo Pokémon BW)
  const narrationQueueRef = useRef<string[]>([]);
  const isProcessingNarrationRef = useRef(false);
  
  // Función para mostrar secuencia de narración con delay
  const showNarrationSequence = useCallback(async (messages: string[], delay: number = 1000) => {
    for (const msg of messages) {
      setLastBattleMessage(msg);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }, []);
  
  // Función para procesar un mensaje individual (sin secuencia)
  const showSingleNarration = useCallback((message: string) => {
    setLastBattleMessage(message);
  }, []);

  // Control para que la animación slide-in solo ocurra 1 vez
  const slideInPlayedRef = useRef(false);

  // Audio de ataque
  const attackAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio('/assets/music/SUPER SMASH BROS ULTIMATE - Sound Effect.mp3');
    audio.volume = 0.5;
    attackAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playAttackSound = useCallback(() => {
    const audio = attackAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }, []);
  
  const [showPokemonSelector, setShowPokemonSelector] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [loadingCountdown, setLoadingCountdown] = useState<number | null>(5); // Iniciar con 5 segundos visible
  const [playerNumber, setPlayerNumber] = useState<number>(1); // Determinar si somos player1 o player2

  // Estado para animaciones de defeat
  const [playerFainting, setPlayerFainting] = useState<'player1' | 'player2' | null>(null);
  const [showPlayer1Sprite, setShowPlayer1Sprite] = useState(true);
  const [showPlayer2Sprite, setShowPlayer2Sprite] = useState(true);

  // Estado para animación de ataque simple
  const [attackingPlayer, setAttackingPlayer] = useState<'player1' | 'player2' | null>(null);
  
  // Estado para animación de recibir daño
  const [hitPlayer, setHitPlayer] = useState<'player1' | 'player2' | null>(null);

  // Estado para saber si ya sélectioné mi acción (para bloquear botones)
  const [hasSelectedAction, setHasSelectedAction] = useState(false);
  const hasSelectedActionRef = useRef(false);
  hasSelectedActionRef.current = hasSelectedAction;

  // Estado para animación de coinflip
  const [showCoinFlip, setShowCoinFlip] = useState(false);
  const [coinFlipWinner, setCoinFlipWinner] = useState<'player1' | 'player2' | null>(null);
  const [battleResultOverlay, setBattleResultOverlay] = useState<BattleResultOverlay | null>(null);
  const lastAutoExecuteKeyRef = useRef<string | null>(null);

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

    if (message.type === 'battle:state') {
      setBattleState({
        roomCode: roomCode || message.data.roomCode,
        turn: message.data.turn,
        phase: message.data.phase,
        player1: message.data.player1,
        player2: message.data.player2
      });
      setBattleResultOverlay(null);
      setLoadingCountdown(null);
      setLastBattleMessage('¡La batalla está por comenzar!');
      setIsMyTurn(message.data.phase === 'selecting');
      return;
    }

    // Efecto para detectar cuando mi pokemon tiene HP=0 y mostrar selector
    if (battleState) {
      const myPokemon = isPlayer1 ? battleState.player1.activePokemon : battleState.player2.activePokemon;
      if (myPokemon && (myPokemon.hp <= 0 || myPokemon.isFainted) && !showPokemonSelector) {
        setShowPokemonSelector(true);
        setLastBattleMessage(`¡${myPokemon.name} se debilitó! Selecciona un Pokémon.`);
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
        setBattleResultOverlay(null);
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
        
        // Si se usó coinflip, mostrar animación
        if (message.data.usedCoinflip) {
          setCoinFlipWinner(message.data.firstPlayerId);
          setShowCoinFlip(true);
          // La animación durará 4 segundos (2 de flip + 2 de resultado)
          // No establecer lastBattleMessage aquí, dejar que la animación lo maneje
        } else {
          // Si no es coinflip, mostrar mensaje limpio de orden (sin número de turno)
          const orderMessage = message.data.reason;
          // Limpiar el mensaje de orden
          const cleanMessage = orderMessage
            .replace(/player1 tiene mayor prioridad.*/gi, 'Jugador 1 ataca primero.')
            .replace(/player2 tiene mayor prioridad.*/gi, 'Jugador 2 ataca primero.')
            .replace(/coinflip.*/gi, 'Se determin\u00f3 el orden de ataque.')
            .replace(/\d+/g, ''); // Eliminar números restantes
          setLastBattleMessage(cleanMessage || 'Turno de acci\u00f3n.');
        }
        break;
        
      case 'battle:action-result':
        // Procesar resultado de la acción
        if (battleState) {
          const isP1Action = message.data.playerId === 'player1';
          const attackerPlayerId = isP1Action ? 'player1' : 'player2';
          const defenderPlayerId = isP1Action ? 'player2' : 'player1';
          const defenderHp = message.data.defenderHp || 0;

          // Si es un CAMBIO de Pokémon, NO hacer animación de ataque
          if (message.data.action.type === 'change') {
            // El cambio de Pokémon no tiene animación de ataque
            // Actualizar el estado del jugador con el nuevo Pokémon
            setBattleState(prev => {
              if (!prev) return null;
              return {
                ...prev,
                [attackerPlayerId]: {
                  ...prev[attackerPlayerId],
                  activePokemon: message.data.result.newPokemon || prev[attackerPlayerId].activePokemon,
                  team: prev[attackerPlayerId].team.map(p =>
                    p.id === message.data.result.newPokemon?.id ? message.data.result.newPokemon : p
                  )
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

            // Mostrar mensaje de cambio
            setLastBattleMessage(message.data.result.message || '¡Pokémon cambiado!');
            break; // Salir del case sin animación
          }

          // Continuar con la lógica de ataque normal...
          // Detectar si el defensor llegó a 0 HP (para animación)
          const defenderPreviousHp = isP1Action
            ? battleState?.player2.activePokemon.hp
            : battleState?.player1.activePokemon.hp;

          const justFainted = defenderPreviousHp && defenderPreviousHp > 0 && defenderHp <= 0;

          // Animación de ataque
          playAttackSound();
          setAttackingPlayer(message.data.playerId as 'player1' | 'player2');
          setTimeout(() => setAttackingPlayer(null), 400);

          if (justFainted) {
            // Animación de defeat
            setPlayerFainting(defenderPlayerId);
            setTimeout(() => {
              setPlayerFainting(null);
              if (defenderPlayerId === 'player1') {
                setShowPlayer1Sprite(false);
              } else {
                setShowPlayer2Sprite(false);
              }
            }, 1500);
          } else {
            // Animación de hit
            setTimeout(() => {
              setHitPlayer(defenderPlayerId);
              setTimeout(() => setHitPlayer(null), 400);
            }, 400);
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

          // Mostrar mensaje de resultado del ataque con secuencia narrativa
          const result = message.data.result;
          const actionType = message.data.action.type;
          
          // Debug: log del mensaje original
          console.log('[Battle] Action result:', message.data.playerId, 'message:', result.message);
          
          // Procesar el mensaje para obtener secuencia limpia
          const narrationSequence = processServerMessage(
            result.message,
            actionType,
            result
          );
          
          console.log('[Battle] Narration sequence:', narrationSequence);
          
          // Construir mensajes de cambios de estadística provistos por el servidor
          const statMessages = formatStatChangeMessages(result?.statChanges, attackerPlayerId, defenderPlayerId, battleState);

          // Combinar narración principal con mensajes de stat changes
          const combinedSequence = narrationSequence.concat(statMessages);

          // Mostrar el primer mensaje inmediatamente
          if (combinedSequence.length > 0) {
            setLastBattleMessage(combinedSequence[0]);

            // Si hay más mensajes, mostrar en secuencia
            if (combinedSequence.length > 1) {
              let delay = 1000;
              for (let i = 1; i < combinedSequence.length; i++) {
                setTimeout(() => {
                  setLastBattleMessage(combinedSequence[i]);
                }, delay);
                delay += 1000;
              }
            }
          }
        }
        break;

      case 'battle:pokemon-fainted':
        // El Pokémon fue debilitado durante el turno y se requiere cambio
        setLastBattleMessage(message.data.message);
        
        // Si es mi Pokémon el que fue debilitado, mostrar selector
        if (message.data.playerId === (playerNumber === 1 || playerNumber === 0 ? 'player1' : 'player2')) {
          setShowPokemonSelector(true);
          setIsMyTurn(true); // Permitir seleccionar mientras se pausa el turno
        }
        
        // Ocultar sprite del Pokémon debilitado
        if (message.data.playerId === 'player1') {
          setShowPlayer1Sprite(false);
        } else {
          setShowPlayer2Sprite(false);
        }
        break;
        
      case 'battle:turn-end': {
        // Manejar fin de turno
        const amIPlayer1 = playerNumber === 1 || playerNumber === 0;
        const myActivePokemon = amIPlayer1 ? message.data.player1.activePokemon : message.data.player2.activePokemon;

        if (myActivePokemon?.isFainted || myActivePokemon?.hp <= 0) {
          setLastBattleMessage(`¡${myActivePokemon.name} se debilitó! Selecciona un Pokémon.`);
          setShowPokemonSelector(true);
          setIsMyTurn(false);
          setHasSelectedAction(false);

          if (amIPlayer1) {
            setShowPlayer1Sprite(false);
          } else {
            setShowPlayer2Sprite(false);
          }
        } else {
          setLastBattleMessage(`Turno ${message.data.nextTurn} - ¡Es tu turno!`);
          setIsMyTurn(true);
          setHasSelectedAction(false);
        }

        // Actualizar estados del turno
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
      }

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
            setHasSelectedAction(false); // Permitir seleccionar acción después del cambio
          }
        }
        break;
        
      case 'battle:end':
        setBattleState(prev => prev ? {
          ...prev,
          phase: 'ended'
        } : null);
        setLastBattleMessage(message.data.message);

        const amIPlayer1 = playerNumberRef.current === 1 || playerNumberRef.current === 0;
        const myPlayerId = amIPlayer1 ? 'player1' : 'player2';
        const winner = message.data?.winner as 'player1' | 'player2' | null;

        if (!winner) {
          setBattleResultOverlay({
            result: 'draw',
            title: 'EMPATE',
            subtitle: 'Nadie ganó esta batalla.'
          });
        } else if (winner === myPlayerId) {
          setBattleResultOverlay({
            result: 'win',
            title: 'VICTORIA',
            subtitle: '¡Has ganado la batalla!'
          });
        } else {
          setBattleResultOverlay({
            result: 'lose',
            title: 'DERROTA',
            subtitle: 'Has perdido la batalla.'
          });
        }
        
        // Navegar al menú después de 4 segundos para mostrar el resultado visual
        if (returnToMenuTimeoutRef.current) {
          clearTimeout(returnToMenuTimeoutRef.current);
        }
        returnToMenuTimeoutRef.current = setTimeout(() => {
          sessionStorage.removeItem('patacon_room_code');
          window.location.assign('/');
        }, 4000);
        break;
        
      case 'battle:action-selected': {
        // Notificación de que el oponente seleccionó
        // Si yo ya seleccioné, no necesito hacer nada especial
        // Si yo NO he seleccionado, los botones ya están bloqueados por hasSelectedAction
        const amIReady = hasSelectedActionRef.current;
        if (!amIReady) {
          setLastBattleMessage('El oponente ya seleccionó. ¡Rápido, elige tu acción!');
        }
        break;
      }

      case 'battle:v3-state-message': {
        // V3: Mostrar mensajes de carga y fatiga desde el servidor
        const v3Message = message.data.message;
        if (v3Message) {
          setLastBattleMessage(v3Message);
        }
        break;
      }
    }
  }, [lastMessage]);
  
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
    // Bloquear botones para que no pueda actuar de nuevo hasta que ambos seleccionen
    setHasSelectedAction(true);
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
    // Bloquear botones
    setHasSelectedAction(true);
    setIsMyTurn(false);
  }, [sendMessage]);
  
  const handleOpenChange = useCallback(() => {
    setShowPokemonSelector(true);
  }, []);

  const handleSurrender = useCallback(() => {
    sendMessage({ type: 'battle:surrender', data: {} });
    // Limpiar session storage y navegar al menú
    sessionStorage.removeItem('patacon_room_code');
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      if (returnToMenuTimeoutRef.current) {
        clearTimeout(returnToMenuTimeoutRef.current);
      }
    };
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

  useEffect(() => {
    if (!battleState || !myPokemon) return;

    const currentTwoTurnMove = myPokemon.currentTwoTurnMove;
    if (
      !isMyTurn ||
      hasSelectedActionRef.current ||
      !myPokemon.isChargingTwoTurn ||
      myPokemon.chargePhase !== 'charge' ||
      !currentTwoTurnMove
    ) {
      return;
    }

    const autoExecuteKey = `${battleState.turn}-${myPokemon.id}-${currentTwoTurnMove.moveId}`;
    if (lastAutoExecuteKeyRef.current === autoExecuteKey) {
      return;
    }

    lastAutoExecuteKeyRef.current = autoExecuteKey;
    handleAttack(currentTwoTurnMove.moveId);
  }, [battleState?.turn, myPokemon?.id, myPokemon?.isChargingTwoTurn, myPokemon?.chargePhase, myPokemon?.currentTwoTurnMove, isMyTurn, handleAttack]);
  
  if (!battleState) {
    return (
      <div className="battle-loading">
        <div className="loading-content">
          <div className="pokeball-spinner"></div>
          <p className="loading-text">Cargando</p>
        </div>
      </div>
    );
  }
  
  // Marcamos que el slide-in ya se disparó en la PRIMERA renderización con battleState
  const isFirstBattleRender = battleState && !slideInPlayedRef.current;
  if (isFirstBattleRender) {
    slideInPlayedRef.current = true;
  }

  return (
    <div className={`battle-container${isFirstBattleRender ? ' battle-active' : ''}`}>
      <BackgroundMusic src="/assets/music/BatleMusic.mp3" volume={0.3} />
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
                pokemon={opponentPokemon || null}
                isPlayer={false}
              />
              <PokemonSprite
                pokemon={opponentPokemon || null}
                isPlayer={false}
                isFainting={playerFainting === 'player2'}
                showSprite={showPlayer2Sprite}
                isAttacking={attackingPlayer === 'player2'}
                isHit={hitPlayer === 'player2'}
              />
            </div>

            <div className="player-position">
              <PokemonSprite
                pokemon={myPokemon || null}
                isPlayer={true}
                isFainting={playerFainting === 'player1'}
                showSprite={showPlayer1Sprite}
                isAttacking={attackingPlayer === 'player1'}
                isHit={hitPlayer === 'player1'}
              />
              <PokemonInfoPanel
                pokemon={myPokemon || null}
                isPlayer={true}
              />
            </div>
          </>
        ) : (
          <>
            {/* Player 2: oponente arriba (de frente), jugador abajo (de espalda) - INVERTIDO */}
            <div className="enemy-position">
              <PokemonInfoPanel
                pokemon={opponentPokemon || null}
                isPlayer={false}
              />
              <PokemonSprite
                pokemon={opponentPokemon || null}
                isPlayer={false}
                isFainting={playerFainting === 'player1'}
                showSprite={showPlayer1Sprite}
                isAttacking={attackingPlayer === 'player1'}
                isHit={hitPlayer === 'player1'}
              />
            </div>

            <div className="player-position">
              <PokemonSprite
                pokemon={myPokemon || null}
                isPlayer={true}
                isFainting={playerFainting === 'player2'}
                showSprite={showPlayer2Sprite}
                isAttacking={attackingPlayer === 'player2'}
                isHit={hitPlayer === 'player2'}
              />
              <PokemonInfoPanel
                pokemon={myPokemon || null}
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
          onSurrender={handleSurrender}
          moves={moves}
          disabled={!isMyTurn || battleState.phase === 'ended' || hasSelectedAction}
          // V3: Pasar información sobre carga y fatiga
          isChargingTwoTurn={myPokemon?.isChargingTwoTurn}
          chargePhase={myPokemon?.chargePhase}
          currentTwoTurnMove={myPokemon?.currentTwoTurnMove || undefined}
          isFatigued={myPokemon?.isFatigued}
          fatigueSource={myPokemon?.fatigueSource}
        />
      </div>
      
      {/* Animación de coinflip */}
      {showCoinFlip && coinFlipWinner && (
        <CoinFlipAnimation
          firstPlayerId={coinFlipWinner}
          player1Name={battleState?.player1.name || 'Jugador 1'}
          player2Name={battleState?.player2.name || 'Jugador 2'}
          onAnimationComplete={() => {
            setShowCoinFlip(false);
            setCoinFlipWinner(null);
          }}
        />
      )}
      
      {/* Selector de Pokémon */}
      {showPokemonSelector && (
        <PokemonSelector
          team={myTeam || []}
          onSelect={handleChange}
          onCancel={() => setShowPokemonSelector(false)}
          currentPokemonId={myPokemon?.id || 0}
        />
      )}

      {/* Resultado final antes de volver al menú */}
      {battleResultOverlay && (
        <div className={`battle-result-overlay ${battleResultOverlay.result}`}>
          <div className="battle-result-card">
            <p className="battle-result-label">
              {battleResultOverlay.result === 'win'
                ? '¡Felicidades, Entrenador!'
                : battleResultOverlay.result === 'lose'
                  ? 'La batalla ha terminado'
                  : 'Combate cerrado'}
            </p>
            <h2 className="battle-result-title">{battleResultOverlay.title}</h2>
            <p className="battle-result-subtitle">{battleResultOverlay.subtitle}</p>
            <p className="battle-result-menu-hint">Regresando al menú...</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Formatea mensajes legibles para cambios de estadística enviados por el servidor
 * statChanges: [{ stat, change, target }]
 */
function formatStatChangeMessages(statChanges: any[] | undefined, attackerPlayerId: string, defenderPlayerId: string, battleState: BattleState | null): string[] {
  if (!statChanges || !Array.isArray(statChanges) || statChanges.length === 0) return [];

  const STAT_LABELS: { [key: string]: string } = {
    attack: 'Ataque',
    defense: 'Defensa',
    spAttack: 'Ataque Especial',
    spDefense: 'Defensa Especial'
  };

  const messages: string[] = [];
  const HUGE_THRESHOLD = 3; // Umbral por defecto: cambio absoluto >= 3 => "muchísimo"

  for (const ch of statChanges) {
    if (!ch || typeof ch.change !== 'number' || !ch.stat) continue;

    const label = STAT_LABELS[ch.stat] || ch.stat;
    const targetPlayerId = ch.target === 'attacker' ? attackerPlayerId : defenderPlayerId;
    const pokemonName = battleState?.[targetPlayerId as keyof BattleState]?.activePokemon?.name || 'El Pokémon';
    const magnitude = Math.abs(ch.change);

    if (ch.change < 0) {
      if (magnitude >= HUGE_THRESHOLD) {
        messages.push(`${label} de ${pokemonName} ha bajado muchísimo.`);
      } else {
        messages.push(`${label} de ${pokemonName} ha disminuido.`);
      }
    } else if (ch.change > 0) {
      if (magnitude >= HUGE_THRESHOLD) {
        messages.push(`${label} de ${pokemonName} ha aumentado muchísimo.`);
      } else {
        messages.push(`${label} de ${pokemonName} ha aumentado.`);
      }
    }
  }

  return messages;
}