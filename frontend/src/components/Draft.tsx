import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from '@tanstack/react-router';
import { socket, connect, isConnected, leaveRoom as wsLeaveRoom } from '../websocket';
import { PokemonType, MoveType } from '../types/game';
import '../styles/Draft.css';

interface PokemonSprite {
  pokeapi_id: number;
  name?: string;
  is_legendary?: boolean;
  selected_moves?: MoveType[];
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

const Draft: React.FC<{ roomCode?: string; onExit?: () => void; onBattleStart?: () => void }> = ({ roomCode: propRoomCode }) => {
  const params = useParams({ from: '/draft/$roomCode' });
  const roomCode = propRoomCode || params.roomCode;
  const router = useRouter();

  // Estado para playerNumber e isHost (vienen del WebSocket)
  const [playerNumber, setPlayerNumber] = useState<number>(0);

  const playerNumberRef = useRef(0);
  const myPicksRef = useRef<PokemonSprite[]>([]);
  const opponentPicksRef = useRef<PokemonSprite[]>([]);

  const [pokemonList, setPokemonList] = useState<PokemonType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonType | null>(null);
  const [selectedPokemonMoves, setSelectedPokemonMoves] = useState<MoveType[]>([]);
  const [loadingMoves, setLoadingMoves] = useState(false);
  const [selectedMove, setSelectedMove] = useState<MoveType | null>(null);
  const [selectedMoves, setSelectedMoves] = useState<MoveType[]>([]);
  const [myPicks, setMyPicks] = useState<PokemonSprite[]>([]);
  const [opponentPicks, setOpponentPicks] = useState<PokemonSprite[]>([]);
  const [currentTurn, setCurrentTurn] = useState<'player1' | 'player2' | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battleStarting, setBattleStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPokemon, setTotalPokemon] = useState(0);

  const isCurrentTurnMine = (turn: 'player1' | 'player2' | null, number: number) => {
    if (!turn || number === 0) return false;
    return turn === (number === 1 ? 'player1' : 'player2');
  };

  useEffect(() => {
    setIsMyTurn(isCurrentTurnMine(currentTurn, playerNumber));
  }, [currentTurn, playerNumber]);

  useEffect(() => {
    if (!selectedPokemon) {
      setSelectedPokemonMoves([]);
      setLoadingMoves(false);
      return;
    }

    const loadMoves = async () => {
      setLoadingMoves(true);
      try {
        const response = await fetch(`/api/pokemon/${selectedPokemon.pokeapi_id}/moves`);
        const data = await response.json();

        if (data.success && Array.isArray(data.data?.moves)) {
          setSelectedPokemonMoves(data.data.moves);
        } else {
          setSelectedPokemonMoves([]);
        }
      } catch (error) {
        console.error('Error loading selected Pokémon moves:', error);
        setSelectedPokemonMoves([]);
      } finally {
        setLoadingMoves(false);
      }
    };

    loadMoves();
  }, [selectedPokemon]);

  // ==================== WEBSOCKET EVENT HANDLING ====================
  useEffect(() => {
    if (!roomCode) return;

    // Asegurar que el socket esté conectado
    if (!isConnected()) {
      connect();
    }

    // Unsubscribe functions — declarar ANTES de usarse
    const unsubscribes: (() => void)[] = [];

    // Solicitar estado inicial del draft al montar el componente
    const requestDraftState = () => {
      // Solo solicitar si tenemos playerNumber válido
      if (playerNumberRef.current === 0) {
        console.log('[Draft] Esperando playerNumber válido antes de solicitar estado...');
        return;
      }
      console.log('[Draft] Solicitando estado del draft (playerNumber:', playerNumberRef.current + ')');
      socket.send({ type: 'draft:state' });
      socket.send({ type: 'draft:picks' });
    };

    // Si ya conectado y tenemos playerNumber, enviar inmediatamente
    if (isConnected() && playerNumberRef.current > 0) {
        requestDraftState();
    } else {
        // Si no, esperar a que el socket conecte
        const unsubConnect = socket.onConnect(() => {
            requestDraftState();
            unsubConnect(); // cleanup after first fire
        });
        unsubscribes.push(unsubConnect);
    }

    // Sala iniciada (reconexión)
    unsubscribes.push(socket.on('room:joined', (data) => {
      console.log('[Draft] Room joined:', data);
      if (typeof data.player_number === 'number') {
        setPlayerNumber(data.player_number);
        playerNumberRef.current = data.player_number;
        // Solicitar estado después de tener playerNumber válido
        requestDraftState();
      }
    }));

    // Sala reconectada
    unsubscribes.push(socket.on('room:reconnected', (data) => {
      console.log('[Draft] Room reconnected:', data);
      if (typeof data.player_number === 'number') {
        setPlayerNumber(data.player_number);
        playerNumberRef.current = data.player_number;
        // Solicitar estado después de tener playerNumber válido
        requestDraftState();
      }
    }));

    // Error del servidor
    unsubscribes.push(socket.on('error', (data) => {
      console.error('[Draft] Server error:', data);
      // El mensaje puede ser un string o un objeto con propiedad message
      const errorMessage = typeof data === 'string' ? data : (data?.message || 'Error del servidor');
      setError(errorMessage);
    }));

    // Error específico del draft (cuando falla un pick)
    unsubscribes.push(socket.on('draft:error', (data) => {
      console.error('[Draft] Draft error:', data);
      const errorMessage = data?.message || 'Error al realizar la acción';
      setError(errorMessage);
    }));

    // Sala cerrada por abandono del host
    unsubscribes.push(socket.on('room:closed', (data) => {
      console.log('[Draft] Sala cerrada por el host:', data);
      const reason = data?.reason || 'host_left';
      if (reason === 'host_left') {
        // Limpiar estado de sala
        sessionStorage.removeItem('patacon_room_code');
        // Mostrar mensaje y redirigir al menú
        alert('El host abandonó la sala');
        router.navigate('/');
      }
    }));

    // Draft iniciado
    unsubscribes.push(socket.on('draft:started', (data) => {
      console.log('[Draft] Draft started:', data);
      setCurrentTurn(data.current_turn);
    }));

// Pokemon seleccionado - actualizar interfaz del oponente
    unsubscribes.push(socket.on('draft:picked', (data) => {
      console.log('[Draft] Pokemon picked:', data);
      console.log('[Draft] playerNumberRef:', playerNumberRef.current);
      
      // Validación defensiva: no procesar si playerNumber no está disponible
      if (playerNumberRef.current === 0) {
        console.warn('[Draft] Ignorando draft:picked - playerNumber no disponible');
        return;
      }

      const pickerNum = data.player_number;
      const pickerIsMe = pickerNum === playerNumberRef.current;

      if (pickerIsMe) {
        // Mi pick - ya se actualizó con optimistic update, solo actualizar turno
        console.log('[Draft] Mi pick confirmado');
      } else {
        // Pick del oponente - actualizar opponentPicks
        console.log('[Draft] Pick del oponente, actualizando opponentPicks');
        setOpponentPicks(prev => {
          const newPicks = [...prev, data.pokemon];
          opponentPicksRef.current = newPicks;
          return newPicks;
        });
      }

      // Actualizar turno siempre
      if (data.current_turn) {
        console.log('[Draft] Actualizando currentTurn a:', data.current_turn);
        setCurrentTurn(data.current_turn);
      }
    }));

    // Sincronizar picks
    unsubscribes.push(socket.on('draft:picks', (data) => {
      console.log('[Draft] Draft picks:', data);
      console.log('[Draft] playerNumberRef en draft:picks:', playerNumberRef.current);
      
      // Validación defensiva: no procesar si playerNumber no está disponible
      if (playerNumberRef.current === 0) {
        console.warn('[Draft] Ignorando draft:picks - playerNumber no disponible');
        return;
      }

      if (data.player1 && data.player2) {
        const myPicksData = playerNumberRef.current === 1 ? data.player1 : data.player2;
        const oppPicksData = playerNumberRef.current === 1 ? data.player2 : data.player1;
        console.log('[Draft] Mis picks:', myPicksData?.length, 'Picks oponente:', oppPicksData?.length);
        setMyPicks(myPicksData || []);
        setOpponentPicks(oppPicksData || []);
        // Sincronizar refs
        myPicksRef.current = myPicksData || [];
        opponentPicksRef.current = oppPicksData || [];
      }
      if (data.current_turn) {
        console.log('[Draft] Actualizando currentTurn desde draft:picks:', data.current_turn);
        setCurrentTurn(data.current_turn);
      }
    }));

    // Estado del draft
    unsubscribes.push(socket.on('draft:state', (data) => {
      console.log('[Draft] Draft state:', data);
      
      // Actualizar playerNumber si viene en el evento
      if (typeof data.player_number === 'number') {
        setPlayerNumber(data.player_number);
        playerNumberRef.current = data.player_number;
        console.log('[Draft] playerNumber actualizado desde draft:state:', data.player_number);
      }
      
      if (typeof data.is_my_turn === 'boolean') {
        setIsMyTurn(data.is_my_turn);
      }
      
      if (data.started && data.current_turn) {
        console.log('[Draft] Draft iniciado, currentTurn:', data.current_turn);
        setCurrentTurn(data.current_turn);
      }
    }));

    // Contador del draft (5 segundos antes de batalla)
    unsubscribes.push(socket.on('draft:countdown', (data) => {
      console.log('[Draft] Countdown:', data);
      const seconds = data?.seconds || 5;
      setCountdown(seconds);
      
      // Decrementar el contador cada segundo
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }));

    // Esperar a que el oponente seleccione 6 Pokémon
    unsubscribes.push(socket.on('draft:waiting', (data) => {
      console.log('[Draft] Waiting:', data);
      setError(data?.message || 'Esperando al oponente...');
    }));

    // Batalla comenzando - navegar inmediatamente a la batalla
    // El componente Battle mostrará el contador de carga
    unsubscribes.push(socket.on('battle:starting', (data) => {
      console.log('[Draft] Battle starting, navigating to battle:', data);
      setBattleStarting(true);
      
      // Navegar inmediatamente - el componente Battle mostrará el countdown
      if (onBattleStart) {
        onBattleStart();
      } else {
        router.navigate('/battle/' + roomCode);
      }
    }));

    // Cleanup
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [roomCode]);

  // ==================== FUNCTIONS ====================

  /**
   * Función para salir de la sala
   * NOTA: NO cierra el WebSocket, solo sale de la sala lógica
   */
  const handleExit = () => {
    // Salir de la sala (estructura lógica) pero mantener conexión
    wsLeaveRoom();

    // Limpiar sessionStorage
    sessionStorage.removeItem('patacon_room_code');

    if (onExit) {
      onExit();
    } else {
      router.navigate('/');
    }
  };

  /**
   * Seleccionar un Pokémon
   */
  const handlePokemonSelect = (pokemon: PokemonType) => {
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

    // Validar que el Pokémon tiene movimientos disponibles
    if (selectedPokemonMoves.length === 0) {
      setError('Este Pokémon no tiene movimientos disponibles');
      return;
    }

    // Validar que hay al menos 1 movimiento seleccionado
    if (selectedMoves.length === 0) {
      setError('Selecciona al menos 1 ataque para el Pokémon');
      return;
    }

    const pokemonData: PokemonSprite = {
      pokeapi_id: selectedPokemon.pokeapi_id,
      name: selectedPokemon.name,
      is_legendary: selectedPokemon.is_legendary,
      selected_moves: selectedMoves
    };

    // === OPTIMISTIC UPDATE: actualizar UI inmediatamente ===
    // Agregar el pokemon a myPicks localmente (sin esperar roundtrip)
    setMyPicks(prev => {
      const newPicks = [...prev, pokemonData];
      myPicksRef.current = newPicks;
      return newPicks;
    });
    // Alternar el turno: si soy player1 → pasa a player2, y viceversa
    const nextTurn = (playerNumberRef.current === 1 ? 'player2' : 'player1') as 'player1' | 'player2';
    setCurrentTurn(nextTurn);
    // =====================================================

    socket.send({
      type: 'draft:pick',
      data: { pokemon: pokemonData }
    });

    setSelectedPokemon(null);
    setSelectedPokemonMoves([]);
    setSelectedMoves([]);
    setError(null);
  };

  /**
   * Cancelar selección
   */
  const cancelPick = () => {
    setSelectedPokemon(null);
    setSelectedPokemonMoves([]);
    setSelectedMoves([]);
    setError(null);
  };

  /**
   * Ver detalles de un movimiento
   */
  const handleMoveClick = (move: MoveType) => {
    setSelectedMove(move);
  };

  /**
   * Verificar si un movimiento ya está seleccionado
   */
  const isMoveSelected = (moveId: number): boolean => {
    return selectedMoves.some(m => m.move_id === moveId);
  };

  /**
   * Añadir un movimiento a la selección
   */
  const handleAddMove = (move: MoveType) => {
    if (selectedMoves.length >= 4) return;
    if (isMoveSelected(move.move_id)) return;
    setSelectedMoves([...selectedMoves, move]);
  };

  /**
   * Quitar un movimiento de la selección
   */
  const handleRemoveMove = (moveId: number) => {
    setSelectedMoves(selectedMoves.filter(m => m.move_id !== moveId));
  };

  /**
   * Confirmar equipo completo (YA NO SE USA - se hace automático)
   * Mantenido por compatibilidad
   */
  const confirmTeam = () => {
    // Ya no se usa - el sistema detecta automáticamente cuando ambos tienen 6
    console.log('[Draft] confirmTeam ya no se usa - se hace automático');
  };

  // Resetear página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Cargar lista de Pokémon desde la API con paginación
  useEffect(() => {
    const fetchPokemon = async () => {
      try {
        const offset = (currentPage - 1) * pageSize;
        const params = new URLSearchParams();
        params.append('limit', pageSize.toString());
        params.append('offset', offset.toString());
        
        if (searchQuery) {
          params.append('search', searchQuery);
        }
        
        const response = await fetch(`/api/pokemon?${params.toString()}`);
        const data = await response.json();
        
        if (data.success && data.data) {
          setPokemonList(data.data.pokemon || []);
          setTotalPokemon(data.data.total || 0);
        }
      } catch (err) {
        console.error('Error fetching Pokemon:', err);
      }
    };
    fetchPokemon();
  }, [currentPage, pageSize, searchQuery]);

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
        {countdown !== null ? (
          <div className="countdown-indicator">
            <span className="countdown-number">{countdown}</span>
            <span className="countdown-text">¡La batalla está por comenzar!</span>
          </div>
        ) : (
          <div className="turn-indicator">
            {isCurrentTurnMine(currentTurn, playerNumber) ? (
              <span className="your-turn">¡ES TU TURNO!</span>
            ) : (
              <span className="waiting-turn">Esperando al oponente...</span>
            )}
          </div>
        )}
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
              <div className="selected-preview-top">
                <div className="selected-preview-visual">
                  <img
                    src={selectedPokemon.sprites.front_default || getSpriteUrl(selectedPokemon.pokeapi_id)}
                    alt={selectedPokemon.name}
                    className="preview-sprite"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = selectedPokemon.sprites.static_front_default || getSpriteUrl(selectedPokemon.pokeapi_id);
                    }}
                  />
                  <h3>{selectedPokemon.name}</h3>
                  <span className={`legendary-badge ${selectedPokemon.is_legendary ? 'show' : ''}`}>
                    {selectedPokemon.is_legendary ? 'Legendario' : ''}
                  </span>
                </div>

                <div className="selected-preview-scrolls">
                  <div className="pokemon-info-card">
                    <div className="pokemon-info-row">
                      <span className="pokemon-info-label">Tipo</span>
                      <div className="pokemon-type-tags">
                        {selectedPokemon.types.map((type) => (
                          <span
                            key={type}
                            className="pokemon-type-tag"
                            style={{ backgroundColor: TYPE_COLORS[type] || '#4a4a4a' }}
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="pokemon-info-grid">
                      <div className="pokemon-info-item">
                        <span className="pokemon-info-label">Gen</span>
                        <strong>{selectedPokemon.generation}</strong>
                      </div>
                      <div className="pokemon-info-item">
                        <span className="pokemon-info-label">Base EXP</span>
                        <strong>{selectedPokemon.base_experience}</strong>
                      </div>
                      <div className="pokemon-info-item">
                        <span className="pokemon-info-label">Altura</span>
                        <strong>{(selectedPokemon.height_dm / 10).toFixed(1)} m</strong>
                      </div>
                      <div className="pokemon-info-item">
                        <span className="pokemon-info-label">Peso</span>
                        <strong>{(selectedPokemon.weight_hg / 10).toFixed(1)} kg</strong>
                      </div>
                    </div>
                    <div className="pokemon-stats-list">
                      <div className="pokemon-stat-row"><span>HP</span><strong>{selectedPokemon.stats.hp}</strong></div>
                      <div className="pokemon-stat-row"><span>Ataque</span><strong>{selectedPokemon.stats.attack}</strong></div>
                      <div className="pokemon-stat-row"><span>Defensa</span><strong>{selectedPokemon.stats.defense}</strong></div>
                      <div className="pokemon-stat-row"><span>At. Esp.</span><strong>{selectedPokemon.stats.sp_attack}</strong></div>
                      <div className="pokemon-stat-row"><span>Def. Esp.</span><strong>{selectedPokemon.stats.sp_defense}</strong></div>
                      <div className="pokemon-stat-row"><span>Velocidad</span><strong>{selectedPokemon.stats.speed}</strong></div>
                    </div>
                  </div>

                  <div className="pokemon-moves-card">
                    <div className="pokemon-moves-header">
                      <span className="pokemon-info-label">Ataques</span>
                      <span className="pokemon-moves-count">
                        {loadingMoves ? 'Cargando...' : `${selectedPokemonMoves.length} mostrados`}
                      </span>
                    </div>

                    {loadingMoves ? (
                      <div className="pokemon-moves-loading">
                        <div className="spinner-small"></div>
                        <span>Cargando ataques...</span>
                      </div>
                    ) : selectedPokemonMoves.length > 0 ? (
                      <div className="pokemon-moves-list">
                        {selectedPokemonMoves.map((move) => (
                          <div 
                            key={move.move_id} 
                            className={`pokemon-move-row ${isMoveSelected(move.move_id) ? 'selected' : ''}`}
                            onClick={() => handleMoveClick(move)}
                          >
                            <div className="pokemon-move-main">
                              <span className="pokemon-move-name">
                                {move.names?.es?.toUpperCase() || move.name.toUpperCase()}
                              </span>
                              <span
                                className="pokemon-move-type"
                                style={{ backgroundColor: TYPE_COLORS[move.type] || '#4a4a4a' }}
                              >
                                {move.type.toUpperCase()}
                              </span>
                            </div>
                            <div className="pokemon-move-meta">
                              <span>Poder: {move.power !== null ? move.power : '—'}</span>
                              <span>Precisión: {move.accuracy !== null ? `${move.accuracy}%` : '—'}</span>
                              <span>PP: {move.pp || '—'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="pokemon-moves-empty">Este Pokémon no tiene ataques disponibles en la base de datos.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="preview-actions">
                <button 
                  className="confirm-btn" 
                  onClick={confirmPick}
                  disabled={selectedMoves.length === 0 || selectedPokemonMoves.length === 0}
                >
                  {selectedPokemonMoves.length === 0 
                    ? '⚠️ Sin movimientos disponibles' 
                    : selectedMoves.length === 0 
                      ? 'Selecciona al menos 1 ataque' 
                      : `✓ Seleccionar (${selectedMoves.length}/4)`}
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
                {pokemonList.map((pokemon) => {
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
                        src={pokemon.sprites.front_default || getSpriteUrl(pokemon.pokeapi_id)}
                        alt={pokemon.name}
                        className="card-sprite"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = pokemon.sprites.static_front_default || getSpriteUrl(pokemon.pokeapi_id);
                        }}
                      />
                      <span className="card-name">#{pokemon.pokeapi_id} {pokemon.name}</span>
                      {pokemon.is_legendary && <span className="card-legendary">★</span>}
                    </button>
                  );
                })}
              </div>

              {/* Controles de paginación */}
              <div className="pagination-controls">
                <div className="pagination-info">
                  <span>Mostrando {pokemonList.length} de {totalPokemon} Pokémon</span>
                </div>
                <div className="pagination-buttons">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    ◀ Anterior
                  </button>
                  <span className="pagination-page">
                    Página {currentPage} de {Math.ceil(totalPokemon / pageSize) || 1}
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={pokemonList.length < pageSize}
                  >
                    Siguiente ▶
                  </button>
                </div>
                <div className="page-size-selector">
                  <label>Por página:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
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

      {/* Ya no hay botón de confirmar - se hace automáticamente cuando ambos tienen 6 */}

      {/* Modal de descripción del movimiento */}
      {selectedMove && (
        <div className="move-detail-overlay" onClick={() => setSelectedMove(null)}>
          <div className="move-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="move-detail-close"
              onClick={() => setSelectedMove(null)}
            >
              ✕
            </button>

            <div className="move-detail-header">
              <h2>{selectedMove.names?.es?.toUpperCase() || selectedMove.name.toUpperCase()}</h2>
              <span 
                className="move-type-badge-large"
                style={{ backgroundColor: TYPE_COLORS[selectedMove.type] || '#999' }}
              >
                {selectedMove.type.toUpperCase()}
              </span>
            </div>

            <div className="move-detail-description">
              <p>{selectedMove.description || 'Sin descripción disponible.'}</p>
            </div>

            <div className="move-detail-stats">
              <div className="detail-stat-item">
                <span className="label">PODER</span>
                <span className="value">{selectedMove.power !== null ? selectedMove.power : '—'}</span>
              </div>
              <div className="detail-stat-item">
                <span className="label">PRECISIÓN</span>
                <span className="value">{selectedMove.accuracy !== null ? `${selectedMove.accuracy}%` : '—'}</span>
              </div>
              <div className="detail-stat-item">
                <span className="label">PP</span>
                <span className="value">{selectedMove.pp || '—'}</span>
              </div>
              <div className="detail-stat-item">
                <span className="label">PRIORIDAD</span>
                <span className="value">{selectedMove.priority >= 0 ? `+${selectedMove.priority}` : selectedMove.priority}</span>
              </div>
            </div>

            <div className="move-detail-class">
              <span className={`damage-class-large ${selectedMove.damage_class}`}>
                {selectedMove.damage_class === 'physical' ? '⚔️ FÍSICO' : 
                 selectedMove.damage_class === 'special' ? '✨ ESPECIAL' : '📋 ESTADO'}
              </span>
            </div>

            <div className="move-detail-ailment">
              {selectedMove.meta?.ailment ? (
                <>
                  <span className="ailment-label">Efecto:</span>
                  <span 
                    className="ailment-badge-large"
                    style={{ 
                      backgroundColor: selectedMove.meta.ailment === 'burn' ? '#ff6b35' :
                                     selectedMove.meta.ailment === 'poison' ? '#9b59b6' :
                                     selectedMove.meta.ailment === 'sleep' ? '#3498db' :
                                     selectedMove.meta.ailment === 'paralysis' ? '#f1c40f' :
                                     selectedMove.meta.ailment === 'freeze' ? '#00cec9' : '#999'
                    }}
                  >
                    {selectedMove.meta.ailment.toUpperCase()} ({selectedMove.meta.ailment_chance}%)
                  </span>
                </>
              ) : (
                <span className="ailment-label">Efectos: ninguno</span>
              )}
            </div>

            <div className="move-detail-flags">
              {selectedMove.flags?.protect && <span className="flag">🛡️ Bloqueable</span>}
              {selectedMove.flags?.mirror && <span className="flag">🔄 Reflejable</span>}
              {selectedMove.flags?.contact && <span className="flag">👊 Contacto</span>}
              {selectedMove.flags?.recharge && <span className="flag">🔋 Recarga</span>}
            </div>

            {/* Contador de ataques seleccionados */}
            <div className="move-selected-counter">
              {selectedMoves.length}/4 ataques seleccionados
            </div>

            {/* Botón de elegir/quitar ataque */}
            <div className="move-action-buttons">
              {isMoveSelected(selectedMove.move_id) ? (
                <button 
                  className="move-action-btn remove-move"
                  onClick={() => handleRemoveMove(selectedMove.move_id)}
                >
                  ✕ Quitar Ataque
                </button>
              ) : (
                <button 
                  className="move-action-btn add-move"
                  onClick={() => handleAddMove(selectedMove)}
                  disabled={selectedMoves.length >= 4}
                >
                  {selectedMoves.length >= 4 ? 'Máximo 4 ataques' : '✓ Elegir Ataque'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Draft;