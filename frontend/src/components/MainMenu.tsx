import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';
import { socket, connect, getSessionId, isConnected, getCurrentRoom } from '../websocket';
import { PokemonSlotAnimation } from './battle/PokemonSlotAnimation';
import '../styles/MainMenu.css';
import '../components/battle/PokemonSlotAnimation.css';

interface RoomData {
  roomCode: string;
  playerName: string;
  isHost: boolean;
}

const MainMenu: React.FC = () => {
  const router = useRouter();
  const [screen, setScreen] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
const [createdRoomCode, setCreatedRoomCode] = useState<string>('');
  const [sessionId] = useState<string>(() => {
    const saved = localStorage.getItem('patacon_session_id');
    if (saved) return saved;
    const gen = crypto.randomUUID();
    localStorage.setItem('patacon_session_id', gen);
    return gen;
  });
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [player1DisplayName, setPlayer1DisplayName] = useState<string>('Jugador 1');
  const [player2DisplayName, setPlayer2DisplayName] = useState<string>('Esperando oponente...');
  const [playerNumber, setPlayerNumber] = useState<number>(0); // 1 o 2, 0 = no know
  const [gameMode, setGameMode] = useState<'normal' | 'random'>('normal'); // Modo de juego
  const [showRandomLoading, setShowRandomLoading] = useState(false);
  const [randomTeams, setRandomTeams] = useState<{player1: any[], player2: any[]} | null>(null);
  const [randomCountdown, setRandomCountdown] = useState<number>(8);
  const [slotAnimationComplete, setSlotAnimationComplete] = useState(false);

// Audio background music ref
  const audioRef = useRef<HTMLAudioElement>(null);

  // Play background music on mount
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3; // 30% volume for background
      audioRef.current.play().catch(() => {
        // Autoplay might be blocked, that's ok
      });
    }
  }, []);

  // Contador decremento automático
  useEffect(() => {
    if (!showRandomLoading || randomCountdown === null) return;
    if (randomCountdown <= 0) return;
    
    const timer = setTimeout(() => {
      setRandomCountdown(randomCountdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [showRandomLoading, randomCountdown]);

  // Navegar a la batalla cuando el contador llega a 0
  useEffect(() => {
    if (showRandomLoading && randomCountdown === 0 && createdRoomCode) {
      console.log('[MainMenu] Countdown finished, navigating to battle');
      router.navigate({ to: '/battle/$roomCode', params: { roomCode: createdRoomCode } });
    }
  }, [showRandomLoading, randomCountdown, createdRoomCode, router]);

  // Si ya había creado o entrado en una sala, restaurar código
  useEffect(() => {
    const savedCode = sessionStorage.getItem('patacon_room_code');
    if (savedCode) {
      setCreatedRoomCode(savedCode);

      // Verificar si la sala ya está en estado in_draft
      fetch(`/api/rooms/${savedCode}?session_id=${encodeURIComponent(sessionId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.room && data.room.state === 'in_draft') {
            setScreen('create');
            // Conectar al socket si no está conectado
            if (!isConnected()) {
              connect();
            }
          } else if (data.success && data.room) {
            setScreen('create');
            // Conectar al socket
            if (!isConnected()) {
              connect();
            }
          }
        })
        .catch(err => console.error('Error checking room state:', err));
    }
  }, []);

  // ==================== WEBSOCKET EVENT HANDLING ====================
  useEffect(() => {
    // Conectar al WebSocket si no está conectado
    if (!isConnected()) {
      connect();
    }

    // Unsubscribe functions
    const unsubscribes: (() => void)[] = [];

    // Manejar conexión establecida
    unsubscribes.push(socket.onConnect(() => {
      console.log('[MainMenu] WebSocket conectado');
    }));

    // Sala creada exitosamente
    unsubscribes.push(socket.on('room:created', (data) => {
      console.log('[MainMenu] Sala creada:', data);
      setCreatedRoomCode(data.roomCode);
      setIsHost(true);
      setPlayerNumber(1);
      sessionStorage.setItem('patacon_room_code', data.roomCode);
      setScreen('create');
      setLoading(false);
    }));

    // Jugador unido a la sala
    unsubscribes.push(socket.on('room:joined', (data) => {
      console.log('[MainMenu] Joined room:', data);

      if (typeof data.player_number === 'number') {
        setPlayerNumber(data.player_number);
      }
      if (typeof data.isHost === 'boolean') {
        setIsHost(data.isHost);
      }
      if (data.opponent_connected !== undefined) {
        setOpponentConnected(!!data.opponent_connected);
      }
      if (data.player1_name) {
        setPlayer1DisplayName(data.player1_name);
      }
      if (data.player2_name) {
        setPlayer2DisplayName(data.player2_name || 'Esperando oponente...');
      }
      if (data.state === 'in_draft') {
        router.navigate({ to: '/draft/$roomCode', params: { roomCode: data.roomCode } });
      }

      setCreatedRoomCode(data.roomCode);
      setScreen('create');
      setLoading(false);
    }));

    // Otro jugador se unió
    unsubscribes.push(socket.on('player:joined', (data) => {
      console.log('[MainMenu] Player joined:', data);
      setOpponentConnected(true);
      setOpponentName(data.player_name);
      setPlayer2DisplayName(data.player_name);

      if (data.player1_name) {
        setPlayer1DisplayName(data.player1_name);
      }
      if (data.player2_name) {
        setPlayer2DisplayName(data.player2_name);
      }
    }));

    // Modo de juego cambiado
    unsubscribes.push(socket.on('room:mode_changed', (data) => {
      console.log('[MainMenu] Mode changed:', data);
      if (data.mode) {
        setGameMode(data.mode);
      }
    }));

    // Equipos aleatorios generados - mostrar pantalla de carga
    unsubscribes.push(socket.on('random:teams_generated', (data) => {
      console.log('[MainMenu] Random teams generated:', data);
      // El servidor envía player1_team y player2_team
      setRandomTeams({
        player1: data.player1_team || [],
        player2: data.player2_team || []
      });
      setShowRandomLoading(true);
      setSlotAnimationComplete(false); // Reiniciar estado de animación
      setRandomCountdown(8);
    }));

    // Contador para modo aleatorio (simplemente guardar el valor)
    unsubscribes.push(socket.on('draft:countdown', (data) => {
      console.log('[MainMenu] Draft countdown:', data);
      setRandomCountdown(8); // Reiniciar a 5 cuando llega el mensaje
    }));

    // Battle starting - navegar a batalla
    unsubscribes.push(socket.on('battle:starting', (data) => {
      console.log('[MainMenu] Battle starting:', data);
      if (showRandomLoading && createdRoomCode) {
        router.navigate({ to: '/battle/$roomCode', params: { roomCode: createdRoomCode } });
      }
    }));

    // Otro jugador salió
    unsubscribes.push(socket.on('player:left', (data) => {
      console.log('[MainMenu] Player left:', data);
      if (data.session_id !== sessionId) {
        setOpponentConnected(false);
        setOpponentName(null);
        setPlayer2DisplayName('Esperando oponente...');
      }
    }));

    // Estado de la sala actualizado
    unsubscribes.push(socket.on('room:state', (data) => {
      console.log('[MainMenu] Room state:', data);
      if (data.opponent_connected !== undefined) {
        setOpponentConnected(!!data.opponent_connected);
      }
      if (data.player1_name) {
        setPlayer1DisplayName(data.player1_name);
      }
      if (data.player2_name) {
        setPlayer2DisplayName(data.player2_name);
        setOpponentName(data.player2_name);
      }
      if (typeof data.isHost === 'boolean') {
        setIsHost(data.isHost);
      }
    }));

// Draft iniciado
    unsubscribes.push(socket.on('draft:started', () => {
      console.log('[MainMenu] Draft started');
      router.navigate({ to: '/draft/$roomCode', params: { roomCode: createdRoomCode } });
    }));

    // Error del servidor
    unsubscribes.push(socket.on('error', (data) => {
      console.error('[MainMenu] Server error:', data);
      // El mensaje puede ser un string o un objeto con propiedad message
      const errorMessage = typeof data === 'string' ? data : (data?.message || 'Error del servidor');
      alert(`❌ ${errorMessage}`);
      setLoading(false);
    }));

    // Cleanup
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [createdRoomCode]); // Agregado para evitar stale closure en draft:started

  // ==================== ACTIONS ====================

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);

    // Asegurar que el socket esté conectado
    if (!isConnected()) {
      connect();
    }

    // Enviar solicitud de crear sala
    // Note: El evento CREATE_ROOM ahora lo maneja el servidor directamente
    // Pero para compatibilidad, usamos el servicio REST primero y luego notify al WS
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          player_name: playerName.trim()
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('[CreateRoom] Error response:', data);
        alert(`❌ ${data.error || 'Error al crear la sala'}`);
        setLoading(false);
        return;
      }

      // Ahora unirse a la sala usando el WebSocket
      socket.joinRoom(data.code, playerName.trim());

      // Guardar código localmente
      setCreatedRoomCode(data.code);
      sessionStorage.setItem('patacon_room_code', data.code);
      setIsHost(true);
      setPlayerNumber(1);
      setScreen('create');

    } catch (error) {
      console.error('Error creating room:', error);
      alert('❌ Error al crear la sala');
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }
    if (roomCode.length !== 6) {
      alert('El código debe tener 6 caracteres');
      return;
    }

    setLoading(true);

    // Asegurar que el socket esté conectado
    if (!isConnected()) {
      connect();
    }

    try {
      // Primero unirse usando la API REST
      const response = await fetch(`/api/rooms/${roomCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          player_name: playerName.trim()
        })
      });

      const data = await response.json();

      if (!data.success) {
        alert(`❌ ${data.error || 'Sala no encontrada o llena'}`);
        setLoading(false);
        return;
      }

      // Luego unirse usando el WebSocket
      socket.joinRoom(data.code, playerName.trim());

      // Guardar código
      sessionStorage.setItem('patacon_room_code', data.code.toUpperCase());
      setCreatedRoomCode(data.code.toUpperCase());
      setScreen('create');
      setIsHost(false);
      setPlayerNumber(data.player_number || 2);

      alert(`✅ Te uniste a la sala ${data.code} como Jugador ${data.player_number}`);

    } catch (error) {
      console.error('Error joining room:', error);
      alert('❌ Error al unirse a la sala');
      setLoading(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(createdRoomCode);
    alert('✅ Código copiado al portapapeles');
  };

  const handleStartDraft = async () => {
    if (!opponentConnected) {
      alert('❌ Necesitas un oponente conectado para iniciar');
      return;
    }
    if (!isConnected()) {
      alert('❌ La conexión con la sala no está lista');
      return;
    }

    // Si el modo es aleatorio, enviar evento de inicio aleatorio
    if (gameMode === 'random') {
      socket.send({ type: 'room:start_random' });
    } else {
      // Modo normal - iniciar draft
      socket.send({ type: 'draft:start' });
    }
  };

  const handleLeaveRoom = async () => {
    // Salir de la sala usando WebSocket (NO cerrar conexión)
    socket.leaveRoom();

    // Limpiar estado local
    setCreatedRoomCode('');
    sessionStorage.removeItem('patacon_room_code');
    setOpponentConnected(false);
    setOpponentName(null);
    setIsHost(false);
    setPlayerNumber(0);
    setScreen('menu');
  };

  // Pantalla de carga para modo aleatorio
  if (showRandomLoading && randomTeams) {
    // Determinar qué equipo es el del jugador
    const myTeam = playerNumber === 1 ? randomTeams.player1 : (playerNumber === 2 ? randomTeams.player2 : randomTeams.player1);
    const opponentTeam = playerNumber === 1 ? randomTeams.player2 : (playerNumber === 2 ? randomTeams.player1 : randomTeams.player2);

    // Si la animación de slots no ha terminado, mostrarla
    if (!slotAnimationComplete) {
      return (
        <PokemonSlotAnimation
          myTeam={myTeam || []}
          opponentTeam={opponentTeam || []}
          onAnimationComplete={() => setSlotAnimationComplete(true)}
        />
      );
    }

    // Una vez terminada la animación, mostrar el resultado final con countdown
    return (
      <div className="main-menu-container">
        <div className="random-loading-screen">
          <h2>¡Equipos aleatorios seleccionados!</h2>
          
          <div className="countdown-display">
            <span className="countdown-number">{randomCountdown}</span>
            <p>La batalla está por comenzar...</p>
          </div>
          
          <div className="teams-preview">
            <div className="team-section">
              <h3>Tu Equipo</h3>
              <div className="team-pokemons">
                {(myTeam || []).slice(0, 6).map((pokemon: any, index: number) => (
                  <div key={index} className="pokemon-preview">
                    <img 
                      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.pokeapi_id}.png`} 
                      alt={String(pokemon.pokeapi_id)}
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="team-section">
              <h3>Equipo del oponente</h3>
              <div className="team-pokemons">
                {(opponentTeam || []).slice(0, 6).map((pokemon: any, index: number) => (
                  <div key={index} className="pokemon-preview">
                    <img 
                      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.pokeapi_id}.png`} 
                      alt={String(pokemon.pokeapi_id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <p className="loading-text">Preparando batalla...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu-container">
      {/* Background Music */}
      <audio
        ref={audioRef}
        src="/assets/music/Title Screen - Pokémon Black and White (Restored).mp3"
        loop
        preload="auto"
      />
      <div className="menu-card">
        {/* Pokemon Logo / Title Image */}
        <div className="logo-container">
          <img
            src="/assets/Title.png"
            alt="Pokémon Patacon"
            className="title-image"
            onError={(e) => {
              const elem = e.target as HTMLImageElement;
              elem.style.display = 'none';
            }}
          />
          <h2 className="league-title">LIGA PATACON</h2>
        </div>

        {screen === 'menu' && (
          <>
            <div className="divider"></div>
            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setPlayerName('');
                  setScreen('create');
                }}
              >
                🔴 CREAR NUEVA SALA
                <span className="btn-hint">Genera un código único</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setPlayerName('');
                  setRoomCode('');
                  setScreen('join');
                }}
              >
                ⚪ UNIRSE A SALA
                <span className="btn-hint">Ingresa un código</span>
              </button>
              <button className="btn btn-tertiary" onClick={() => router.navigate('/pokedex')}>
                📖 VER POKÉDEX
                <span className="btn-hint">649 Pokémon disponibles</span>
              </button>
            </div>
          </>
        )}

        {screen === 'create' && (
          <>
            <div className="header-bar">
              <button className="back-btn" onClick={() => setScreen('menu')}>
                ◀ VOLVER
              </button>
              <span>{createdRoomCode ? 'LOBBY' : 'CREAR SALA'}</span>
              <div style={{ width: '60px' }}></div>
            </div>

            <div className="divider"></div>

            {createdRoomCode ? (
              <div className="room-display">
                <h2>CÓDIGO DE SALA</h2>
                <div className="code-box">
                  <span className="room-code">{createdRoomCode}</span>
                  <button className="copy-btn" onClick={copyRoomCode}>
                    Copiar al Portapapeles
                  </button>
                </div>
                <p className="hint-text">Comparte este código con tu oponente</p>

                <div className="waiting-state">
                  <p className="waiting-text">⏳ ESPERANDO JUGADOR...</p>
                  <p className="waiting-hint">
                    Tu oponente debe ingresar el código<br />para unirse a esta sala
                  </p>
                  <div className="players-list">
                    <h4>Jugadores Conectados</h4>
                    <ul>
                      <li className={`player1 ${playerNumber === 1 ? 'you' : ''}`}>
                        <div>
                          <span className="player-name">{player1DisplayName}</span>
                          <span className="player-role">{playerNumber === 1 ? ' (Tú)' : ''}</span>
                        </div>
                        <div className="player-status ready">
                          <span className="status-icon">✓</span>
                          <span>Conectado</span>
                        </div>
                      </li>
                      <li className={`player2 ${playerNumber === 2 ? 'you' : ''} ${opponentConnected ? 'connected' : ''}`}>
                        <div>
                          <span className="player-name">
                            {opponentConnected ? player2DisplayName : 'Esperando oponente...'}
                          </span>
                          <span className="player-role">{playerNumber === 2 ? ' (Tú)' : opponentConnected ? ' (Oponente)' : ''}</span>
                        </div>
                        <div className={`player-status ${opponentConnected ? 'ready' : 'waiting'}`}>
                          <span className="status-icon">{opponentConnected ? '✓' : '○'}</span>
                          <span>{opponentConnected ? 'Conectado' : 'Esperando...'}</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                  
                  {/* Selector de modo de juego - solo visible para el host */}
                  {isHost && (
                    <div className="game-mode-selector">
                      <h4>Modo de Juego</h4>
                      <div className="mode-buttons">
                        <button 
                          className={`mode-btn ${gameMode === 'normal' ? 'active' : ''}`}
                          onClick={() => setGameMode('normal')}
                        >
                          📋 Normal
                        </button>
                        <button 
                          className={`mode-btn ${gameMode === 'random' ? 'active' : ''}`}
                          onClick={() => {
                            setGameMode('random');
                            // Enviar cambio al servidor
                            socket.send({ 
                              type: 'room:set_mode', 
                              data: { mode: 'random' } 
                            });
                          }}
                        >
                          🎲 Aleatorio
                        </button>
                      </div>
                      <p className="mode-description">
                        {gameMode === 'normal' 
                          ? 'Ambos jugadores eligen sus 6 Pokémon en el draft' 
                          : 'Los equipos se generan automáticamente - sin draft'}
                      </p>
                    </div>
                  )}
                  
                  <div className="loading-bar"></div>
                  <p className="timeout-text">Timeout: 5 min</p>
                </div>

                <div className="divider"></div>

                <div className="lobby-actions">
                  {isHost ? (
                    <button
                      className={`btn btn-danger ${!opponentConnected ? 'disabled' : ''}`}
                      disabled={!opponentConnected || loading}
                      onClick={handleStartDraft}
                    >
                      {!opponentConnected ? '🔒 ESPERANDO OPONENTE...' : '🚀 INICIAR PARTIDA'}
                    </button>
                  ) : (
                    <p className="waiting-hint">⏳ Espera a que el host inicie la partida...</p>
                  )}

                  <button
                    className="btn btn-back"
                    onClick={handleLeaveRoom}
                  >
                    ABANDONAR SALA
                  </button>
                </div>
              </div>
            ) : (
              <div className="form-container">
                <label>TU NOMBRE</label>
                <input
                  type="text"
                  placeholder="Ingresa tu nombre"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={20}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
                  className="bw-input"
                />
                <button
                  className={`btn btn-primary ${loading ? 'loading' : ''}`}
                  onClick={handleCreateRoom}
                  disabled={loading || !playerName.trim()}
                >
                  {loading ? '⏳ CREANDO SALA...' : '🔴 CREAR SALA'}
                </button>
                <button
                  className="btn btn-back"
                  onClick={() => setScreen('menu')}
                >
                  VOLVER
                </button>
              </div>
            )}
          </>
        )}

        {screen === 'join' && (
          <>
            <div className="header-bar">
              <button className="back-btn" onClick={() => setScreen('menu')}>
                ◀ VOLVER
              </button>
              <span>UNIRSE A SALA</span>
              <div style={{ width: '60px' }}></div>
            </div>

            <div className="divider"></div>

            <div className="form-container">
              <label>TU NOMBRE</label>
              <input
                type="text"
                placeholder="Ingresa tu nombre"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                className="bw-input"
              />

              <label>CÓDIGO DE LA SALA</label>
              <div className="room-code-input-wrapper">
                <input
                  type="text"
                  placeholder="6 caracteres"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  className={`bw-input code-input ${
                    roomCode.length === 6 ? 'valid' : ''
                  }`}
                />
                <span className="code-counter">{roomCode.length}/6</span>
              </div>
              <p className="validation-text">
                {roomCode.length === 6 ? '✅ Código válido' : '⚪ Ingresa 6 caracteres'}
              </p>

              <button
                className={`btn btn-primary ${
                  roomCode.length !== 6 ? 'disabled' : ''
                } ${loading ? 'loading' : ''}`}
                onClick={handleJoinRoom}
                disabled={loading || roomCode.length !== 6}
              >
                {loading ? '⏳ UNIÉNDOSE...' : '⚪ UNIRSE A SALA'}
              </button>
              <button
                className="btn btn-back"
                onClick={() => setScreen('menu')}
              >
                VOLVER
              </button>
            </div>
          </>
        )}

        <div className="footer">
          <div className="footer-info">
            <p className="version">🎮 Pokémon Patacon v2.0 (WebSocket Persistente)</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;