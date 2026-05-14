import React, { useState, useEffect } from 'react';
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
        body: JSON.stringify({ playerName })
      });

      const data = await response.json();
      if (data.success) {
        setCreatedRoomCode(data.data.room_code);
        // Update to create screen shows room code
      }
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
      const response = await fetch(`/api/rooms/${roomCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName })
      });

      const data = await response.json();
      if (data.success) {
        console.log('Joined room:', data.data);
        // Aquí se redireccionaría a la sala de batalla
      } else {
        alert('❌ Sala no encontrada o llena');
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
      <div className="menu-card">
        {/* Pokemon Logo */}
        <div className="logo-container">
          <img
            src="/assets/title.png"
            alt="Pokémon Patacon"
            className="pokemon-logo"
            onError={(e) => {
              const elem = e.target as HTMLImageElement;
              elem.style.display = 'none';
            }}
          />
        </div>

        <h1 className="title">POKÉMON PATACON</h1>
        <div className="title-separator"></div>
        <p className="subtitle">1v1 Batalla Multijugador - Generación V</p>

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
                <span className="btn-hint">493 Pokémon disponibles</span>
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
              <span>CREAR SALA</span>
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
                  <div className="loading-bar"></div>
                  <p className="timeout-text">Timeout: 5 min</p>
                </div>

                <div className="divider"></div>

                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setCreatedRoomCode('');
                    setScreen('menu');
                  }}
                >
                  ABANDONAR SALA
                </button>
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
