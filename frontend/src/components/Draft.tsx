import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket, connect, isConnected, getSessionId, leaveRoom as wsLeaveRoom } from '../websocket';
import '../styles/Draft.css';

interface PokemonSprite {
  pokeapi_id: number;
  name?: string;
  is_legendary?: boolean;
}

interface DraftProps {
  onExit?: () => void;
  onBattleStart?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
  grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
  ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
  rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', steel: '#B8B8D0',
  fairy: '#EE99AC'
};

const Draft: React.FC<DraftProps> = ({ onExit, onBattleStart }) => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  // Obtener sessionId desde el socket singleton
  const sessionId = getSessionId();

  // Estado para playerNumber e isHost (vienen del WebSocket)
  const [playerNumber, setPlayerNumber] = useState<number>(0);
  const [isHost, setIsHost] = useState(false);

  const [pokemonList, setPokemonList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonSprite | null>(null);
  const [myPicks, setMyPicks] = useState<PokemonSprite[]>([]);
  const [opponentPicks, setOpponentPicks] = useState<PokemonSprite[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player1' | 'player2' | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [battleStarting, setBattleStarting] = useState(false);

  const isCurrentTurnMine = (turn: 'player1' | 'player2' | null, number: number) => {
    if (!turn || number === 0) return false;
    return turn === (number === 1 ? 'player1' : 'player2');
  };

  useEffect(() => {
    setIsMyTurn(isCurrentTurnMine(currentTurn, playerNumber));
  }, [currentTurn, playerNumber]);

  // ==================== WEBSOCKET EVENT HANDLING ====================
  useEffect(() => {
    if (!roomCode) return;

    // Asegurar que el socket esté conectado
    if (!isConnected()) {
      connect();
    }

    // Unsubscribe functions
    const unsubscribes: (() => void)[] = [];

    // Sala iniciada (reconexión)
    unsubscribes.push(socket.on('room:joined', (data) => {
      console.log('[Draft] Room joined:', data);
      if (typeof data.player_number === 'number') {
        setPlayerNumber(data.player_number);
      }
      if (typeof data.isHost === 'boolean') {
        setIsHost(data.isHost);
      }
      setLoading(false);
    }));

    // Sala reconectada
    unsubscribes.push(socket.on('room:reconnected', (data) => {
      console.log('[Draft] Room reconnected:', data);
      if (typeof data.player_number === 'number') {
        setPlayerNumber(data.player_number);
      }
      if (typeof data.isHost === 'boolean') {
        setIsHost(data.isHost);
      }
      setLoading(false);

      // Solicitar estado del draft
      socket.send({ type: 'draft:state' });
      socket.send({ type: 'draft:picks' });
    }));

    // Error del servidor
    unsubscribes.push(socket.on('error', (data) => {
      console.error('[Draft] Server error:', data);
      // El mensaje puede ser un string o un objeto con propiedad message
      const errorMessage = typeof data === 'string' ? data : (data?.message || 'Error del servidor');
      setError(errorMessage);
      setLoading(false);
    }));

    // Draft iniciado
    unsubscribes.push(socket.on('draft:started', (data) => {
      console.log('[Draft] Draft started:', data);
      setCurrentTurn(data.current_turn);
    }));

    // Pokemon seleccionado
    unsubscribes.push(socket.on('draft:picked', (data) => {
      console.log('[Draft] Pokemon picked:', data);
      handlePickUpdate(data);
    }));

    // Sincronizar picks
    unsubscribes.push(socket.on('draft:picks', (data) => {
      console.log('[Draft] Draft picks:', data);
      if (data.player1 && data.player2) {
        const myPicksData = playerNumber === 1 ? data.player1 : data.player2;
        const oppPicksData = playerNumber === 1 ? data.player2 : data.player1;
        setMyPicks(myPicksData || []);
        setOpponentPicks(oppPicksData || []);
      }
      if (data.current_turn) {
        setCurrentTurn(data.current_turn);
      }
    }));

    // Estado del draft
    unsubscribes.push(socket.on('draft:state', (data) => {
      console.log('[Draft] Draft state:', data);
      if (data.started) {
        setCurrentTurn(data.current_turn);
      }
    }));

    // Batalla comenzando
    unsubscribes.push(socket.on('battle:starting', (data) => {
      console.log('[Draft] Battle starting:', data);
      setBattleStarting(true);
      setTimeout(() => {
        if (onBattleStart) {
          onBattleStart();
        } else {
          navigate('/battle/' + roomCode);
        }
      }, 2000);
    }));

    // Cleanup
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [roomCode, playerNumber]);

  // ==================== FUNCTIONS ====================

  /**
   * Función para salir de la sala
   * NOTA: NO cierra el WebSocket, solo sale de la sala lógica
   */
  const handleExit = () => {
    // Salir de la sala (estructura lógica) pero mantener conexión
    wsLeaveRoom();

    // Limpiar localStorage
    localStorage.removeItem('patacon_room_code');

    if (onExit) {
      onExit();
    } else {
      navigate('/');
    }
  };

  /**
   * Manejar actualización de picks
   */
  const handlePickUpdate = (data: any) => {
    const pickerNum = data.player_number;
    const pickerIsMe = pickerNum === playerNumber;

    if (pickerIsMe) {
      setMyPicks(prev => [...prev, data.pokemon]);
    } else {
      setOpponentPicks(prev => [...prev, data.pokemon]);
    }

    setCurrentTurn(data.current_turn);
  };

  /**
   * Seleccionar un Pokémon
   */
  const handlePokemonSelect = (pokemon: any) => {
    if (!isMyTurn) return;
    if (myPicks.length >= 6) return;

    // Verificar que no esté en mis picks
    if (myPicks.some(p => p.pokeapi_id === pokemon.pokeapi_id)) {
      setError('Ya has seleccionado este Pokémon');
      return;
    }

    // Verificar que no esté en picks del oponente
    if (opponentPicks.some(p => p.pokeapi_id === pokemon.pokeapi_id)) {
      setError('El oponente ya seleccionó este Pokémon');
      return;
    }

    // Verificar legendarios (máximo 1)
    const legendaryCount = myPicks.filter(p => p.is_legendary).length;
    if (pokemon.is_legendary && legendaryCount >= 1) {
      setError('Máximo 1 legendario por equipo');
      return;
    }

    setSelectedPokemon(pokemon);
  };

  /**
   * Confirmar selección de Pokémon
   */
  const confirmPick = () => {
    if (!selectedPokemon) return;

    const pokemonData: PokemonSprite = {
      pokeapi_id: selectedPokemon.pokeapi_id,
      name: selectedPokemon.name,
      is_legendary: selectedPokemon.is_legendary
    };

    socket.send({
      type: 'draft:pick',
      data: { pokemon: pokemonData }
    });

    setSelectedPokemon(null);
    setError(null);
  };

  /**
   * Cancelar selección
   */
  const cancelPick = () => {
    setSelectedPokemon(null);
  };

  /**
   * Confirmar equipo completo
   */
  const confirmTeam = () => {
    if (myPicks.length !== 6) return;

    socket.send({
      type: 'draft:confirm',
      data: {}
    });
  };

  // Cargar lista de Pokémon desde la API
  useEffect(() => {
    const fetchPokemon = async () => {
      try {
        const response = await fetch('/api/pokemon?limit=649');
        const data = await response.json();
        if (data.success && data.data && data.data.pokemon) {
          setPokemonList(data.data.pokemon);
        }
      } catch (err) {
        console.error('Error fetching Pokemon:', err);
      }
    };
    fetchPokemon();
  }, []);

  // Filtrar Pokémon por búsqueda
  const filteredPokemon = pokemonList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.pokeapi_id.toString().includes(searchQuery)
  ).slice(0, 50); // Limitar a 50 resultados

  const getSpriteUrl = (pokeapiId: number) =>
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/versions/generation-v/black-white/animated/${pokeapiId}.gif`;

  if (battleStarting) {
    return (
      <div className="draft-container">
        <div className="battle-starting">
          <h1>¡La batalla está por comenzar!</h1>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="draft-container">
      <div className="draft-header">
        <h1>SELECCIÓN DE EQUIPO</h1>
        <div className="turn-indicator">
          {isCurrentTurnMine(currentTurn, playerNumber) ? (
            <span className="your-turn">¡ES TU TURNO!</span>
          ) : (
            <span className="waiting-turn">Esperando al oponente...</span>
          )}
        </div>
        <button className="exit-btn" onClick={handleExit}>Salir</button>
      </div>

      <div className="draft-content">
        {/* Mi equipo (izquierda) */}
        <div className="team-panel my-team">
          <h2>TUS POKÉMON</h2>
          <div className="pokemon-slots">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="pokemon-slot">
                {myPicks[i] ? (
                  <img
                    src={getSpriteUrl(myPicks[i].pokeapi_id)}
                    alt={myPicks[i].name}
                    className="pokemon-sprite"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${myPicks[i].pokeapi_id}.png`;
                    }}
                  />
                ) : (
                  <div className="empty-slot">{i + 1}</div>
                )}
              </div>
            ))}
          </div>
          <p className="pick-count">{myPicks.length}/6 seleccionados</p>
        </div>

        {/* Selector de Pokémon (centro) */}
        <div className="selector-panel">
          {selectedPokemon ? (
            <div className="selected-preview">
              <img
                src={getSpriteUrl(selectedPokemon.pokeapi_id)}
                alt={selectedPokemon.name}
                className="preview-sprite"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${selectedPokemon.pokeapi_id}.png`;
                }}
              />
              <h3>{selectedPokemon.name}</h3>
              <span className={`legendary-badge ${selectedPokemon.is_legendary ? 'show' : ''}`}>
                {selectedPokemon.is_legendary ? 'Legendario' : ''}
              </span>
              <div className="preview-actions">
                <button className="confirm-btn" onClick={confirmPick}>
                  ✓ Seleccionar
                </button>
                <button className="cancel-btn" onClick={cancelPick}>
                  ✗ Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Buscar Pokémon por nombre o número..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                disabled={!isMyTurn}
              />
              <div className="pokemon-grid">
                {filteredPokemon.map((pokemon) => {
                  const isSelected = myPicks.some(p => p.pokeapi_id === pokemon.pokeapi_id);
                  const isOppSelected = opponentPicks.some(p => p.pokeapi_id === pokemon.pokeapi_id);
                  const isDisabled = !isMyTurn || isSelected || isOppSelected;

                  return (
                    <button
                      key={pokemon.pokeapi_id}
                      className={`pokemon-card ${isDisabled ? 'disabled' : ''} ${isOppSelected ? 'taken' : ''}`}
                      onClick={() => handlePokemonSelect(pokemon)}
                      disabled={isDisabled}
                    >
                      <img
                        src={getSpriteUrl(pokemon.pokeapi_id)}
                        alt={pokemon.name}
                        className="card-sprite"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.pokeapi_id}.png`;
                        }}
                      />
                      <span className="card-name">#{pokemon.pokeapi_id} {pokemon.name}</span>
                      {pokemon.is_legendary && <span className="card-legendary">★</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {error && <div className="error-message">{error}</div>}
        </div>

        {/* Equipo oponente (derecha) */}
        <div className="team-panel opponent-team">
          <h2>EQUIPO OPONENTE</h2>
          <div className="pokemon-slots">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="pokemon-slot">
                {opponentPicks[i] ? (
                  <img
                    src={getSpriteUrl(opponentPicks[i].pokeapi_id)}
                    alt={opponentPicks[i].name}
                    className="pokemon-sprite"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${opponentPicks[i].pokeapi_id}.png`;
                    }}
                  />
                ) : (
                  <div className="empty-slot">?</div>
                )}
              </div>
            ))}
          </div>
          <p className="pick-count">{opponentPicks.length}/6 seleccionados</p>
        </div>
      </div>

      {myPicks.length === 6 && (
        <div className="confirm-team-section">
          <button className="confirm-team-btn" onClick={confirmTeam}>
            ✓ Confirmar Equipo
          </button>
        </div>
      )}
    </div>
  );
};

export default Draft;