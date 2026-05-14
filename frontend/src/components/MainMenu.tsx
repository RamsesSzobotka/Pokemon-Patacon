import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MainMenu.css';

interface RoomData {
  roomCode: string;
  playerName: string;
  isHost: boolean;
}

const MainMenu: React.FC = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [createdRoomCode, setCreatedRoomCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('patacon_session_id');
    if (saved) return saved;
    const gen = crypto.randomUUID();
    localStorage.setItem('patacon_session_id', gen);
    return gen;
  });
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [player1DisplayName, setPlayer1DisplayName] = useState<string>('Jugador 1');
  const [player2DisplayName, setPlayer2DisplayName] = useState<string>('Esperando oponente...');
  const [playerNumber, setPlayerNumber] = useState<number>(0); // 1 o 2, 0 = no know

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

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch (error) {
        setBackendStatus('offline');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);

  // Si ya había creado o entrado en una sala, restaurar código
  useEffect(() => {
    const savedCode = localStorage.getItem('patacon_room_code');
    if (savedCode) {
      setCreatedRoomCode(savedCode);
      setScreen('create');
    }
  }, []);

  // WebSocket connection for real-time room updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 5;

    function connect() {
      if (!createdRoomCode) return;

      const wsUrl = `ws://localhost:3000/ws/${createdRoomCode}?session_id=${encodeURIComponent(sessionId)}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Connected to room:', createdRoomCode);
        reconnectAttempts = 0;

        // Enviar init al servidor
        ws!.send(JSON.stringify({
          type: 'connection:init',
          data: { session_id: sessionId, room_code: createdRoomCode }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('[WS] Server confirmed connection');
              break;

            case 'room:joined':
              // Guardar el número de jugador que viene del backend
              if (typeof message.data.player_number === 'number') {
                setPlayerNumber(message.data.player_number);
              }
              // Usar isHost del backend
              if (typeof message.data.isHost === 'boolean') {
                setIsHost(message.data.isHost);
              }
              // Actualizar estados de readiness
              if (message.data.your_ready !== undefined) {
                setPlayerReady(!!message.data.your_ready);
              }
              if (message.data.opponent_ready !== undefined) {
                setOpponentReady(!!message.data.opponent_ready);
              }
              // Actualizar nombres de jugadores desde el inicio
              if (message.data.player1_name) {
                setPlayer1DisplayName(message.data.player1_name);
              }
              if (message.data.player2_name) {
                setPlayer2DisplayName(message.data.player2_name || 'Esperando oponente...');
              }
              break;

            case 'player:joined':
              setOpponentConnected(true);
              setOpponentName(message.data.player_name);
              setPlayer2DisplayName(message.data.player_name);
              // También actualizar player_number si viene
              if (typeof message.data.player_number === 'number') {
                setPlayerNumber(message.data.player_number);
              }
              // Actualizar nombres si vienen
              if (message.data.player1_name) {
                setPlayer1DisplayName(message.data.player1_name);
              }
              if (message.data.player2_name) {
                setPlayer2DisplayName(message.data.player2_name);
              }
              break;

            case 'player:left':
              if (message.data.session_id !== sessionId) {
                setOpponentConnected(false);
                setOpponentName(null);
                setOpponentReady(false);
                setPlayer2DisplayName('Esperando oponente...');
              }
              break;

            case 'room:state':
              // Actualizar número de jugador si viene
              if (typeof message.data.player_number === 'number') {
                setPlayerNumber(message.data.player_number);
              }
              // Actualizar estados de readiness
              if (message.data.your_ready !== undefined) {
                setPlayerReady(!!message.data.your_ready);
              }
              if (message.data.opponent_ready !== undefined) {
                setOpponentReady(!!message.data.opponent_ready);
              }
              if (message.data.opponent_connected !== undefined) {
                setOpponentConnected(!!message.data.opponent_connected);
              }
              // Actualizar nombres de jugadores
              if (message.data.player1_name) {
                setPlayer1DisplayName(message.data.player1_name);
              }
              if (message.data.player2_name) {
                setPlayer2DisplayName(message.data.player2_name);
                setOpponentName(message.data.player2_name);
              }
              // Sincronizar isHost del backend
              if (typeof message.data.isHost === 'boolean') {
                setIsHost(message.data.isHost);
              }
              break;

            case 'pong':
              // Heartbeat response - conexión viva
              break;

            case 'error':
              console.error('[WS] Server error:', message.message);
              break;
          }
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onclose = (event) => {
        console.log(`[WS] Disconnected (code: ${event.code})`);

        // Auto-reconectar si no fue un cierre intencional
        if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          console.log(`[WS] Reconnecting... attempt ${reconnectAttempts}/${MAX_RECONNECT}`);
          reconnectTimer = setTimeout(connect, 2000 * reconnectAttempts);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] WebSocket error:', error);
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.close(1000, 'Component unmounting');
      }
    };
  }, [createdRoomCode, sessionId]);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    setLoading(true);
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
        return;
      }
      
      // Sincronizar con el servidor REST inmediatamente
      const roomRes = await fetch(`/api/rooms/${data.code}?session_id=${encodeURIComponent(sessionId)}`);
      const roomData = await roomRes.json();
      
      if (roomData.success && roomData.room) {
        // Establecer isHost desde el backend inmediatamente
        setIsHost(!!roomData.room.isHost);
      }
      
      setCreatedRoomCode(data.code);
      localStorage.setItem('patacon_room_code', data.code);
      setScreen('create');
    } catch (error) {
      console.error('Error creating room:', error);
      alert('❌ Error al crear la sala');
    } finally {
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
    try {
      const response = await fetch(`/api/rooms/${roomCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: sessionId,
          player_name: playerName.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        console.log('Joined room:', data);
        
        // Sincronizar con el servidor REST para obtener isHost
        const roomRes = await fetch(`/api/rooms/${data.code}?session_id=${encodeURIComponent(sessionId)}`);
        const roomData = await roomRes.json();
        
        if (roomData.success && roomData.room) {
          setIsHost(!!roomData.room.isHost);
        }
        
        // Guardar código y navegar al lobby
        localStorage.setItem('patacon_room_code', data.code);
        setCreatedRoomCode(data.code);
        setScreen('create');
        alert(`✅ Te uniste a la sala ${data.code} como Jugador ${data.player_number}`);
      } else {
        alert(`❌ ${data.error || 'Sala no encontrada o llena'}`);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      alert('❌ Error al unirse a la sala');
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(createdRoomCode);
    alert('✅ Código copiado al portapapeles');
  };

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'online':
        return '#2ECC71';
      case 'offline':
        return '#E10600';
      default:
        return '#FFB90F';
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'online':
        return 'Conectado';
      case 'offline':
        return 'Desconectado';
      default:
        return 'Verificando...';
    }
  };

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
              <button className="btn btn-tertiary" onClick={() => navigate('/pokedex')}>
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
                        <div className={`player-status ${(playerNumber === 1 ? playerReady : opponentReady) ? 'ready' : 'waiting'}`}>
                          <span className="status-icon">{playerNumber === 1 ? playerReady : opponentReady ? '✓' : '○'}</span>
                          <span>{playerNumber === 1 ? playerReady : opponentReady ? 'LISTO' : 'Esperando'}</span>
                        </div>
                      </li>
                      <li className={`player2 ${playerNumber === 2 ? 'you' : ''} ${opponentConnected ? 'connected' : ''}`}>
                        <div>
                          <span className="player-name">
                            {opponentConnected ? player2DisplayName : 'Esperando oponente...'}
                          </span>
                          <span className="player-role">{playerNumber === 2 ? ' (Tú)' : opponentConnected ? ' (Oponente)' : ''}</span>
                        </div>
                        <div className={`player-status ${(playerNumber === 2 ? playerReady : opponentReady) ? 'ready' : 'waiting'}`}>
                          <span className="status-icon">{playerNumber === 2 ? playerReady : opponentReady ? '✓' : opponentConnected ? '○' : '...'}</span>
                          <span>{playerNumber === 2 ? playerReady : opponentReady ? 'LISTO' : opponentConnected ? 'Esperando' : 'Conectando...'}</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <div className="loading-bar"></div>
                  <p className="timeout-text">Timeout: 5 min</p>
                </div>

                <div className="divider"></div>

                <div className="lobby-actions">
                  <button
                    className={`btn ${playerReady ? 'btn-success' : 'btn-primary'}`}
                    onClick={async () => {
                      // toggle ready
                      const newReady = !playerReady;
                      setPlayerReady(newReady);
                      try {
                        await fetch(`/api/rooms/${createdRoomCode}/ready`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ session_id: sessionId, ready: newReady })
                        });
                      } catch (e) {}
                    }}
                  >
                    {playerReady ? '✅ Listo' : 'Listo'}
                  </button>

                  {isHost ? (
                    <button
                      className="btn btn-danger"
                      onClick={async () => {
                        // boton para iniciar draft (estético por ahora)
                        try {
                          const res = await fetch(`/api/rooms/${createdRoomCode}/state`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ session_id: sessionId, state: 'in_draft' })
                          });
                          const data = await res.json();
                          if (data.success) {
                            alert('🚀 Draft iniciado (estético)');
                            // aqui podríamos navegar al draft más tarde
                          } else {
                            alert(`❌ ${data.error || 'No se pudo iniciar'}`);
                          }
                        } catch (e) { console.error(e); }
                      }}
                    >
                      INICIAR PARTIDA
                    </button>
                  ) : null}

                  <button
                    className="btn btn-back"
                    onClick={async () => {
                      // abandonar sala
                      try {
                        await fetch(`/api/rooms/${createdRoomCode}/leave`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ session_id: sessionId })
                        });
                      } catch (e) {}
                      setCreatedRoomCode('');
                      localStorage.removeItem('patacon_room_code');
                      setOpponentConnected(false);
                      setOpponentName(null);
                      setScreen('menu');
                    }}
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

        <div className="divider"></div>

        <div className="footer">
          <div className="footer-info">
            <p className="version">🎮 Pokémon Patacon v1.0</p>
            <p className="api-status">
              <span className="status-dot" style={{ backgroundColor: getStatusColor() }}></span>
              📡 Backend: <span className="status-text">{getStatusText()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
