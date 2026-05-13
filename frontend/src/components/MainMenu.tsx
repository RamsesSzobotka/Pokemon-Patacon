import React, { useState } from 'react';
import '../styles/MainMenu.css';

interface RoomData {
  roomCode: string;
  playerName: string;
  isHost: boolean;
}

const MainMenu: React.FC = () => {
  const [screen, setScreen] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

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
        // Aquí se redireccionaría a la sala de batalla
        alert(`✅ Sala creada: ${data.data.room_code}`);
        console.log('Room data:', data.data);
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
    if (!roomCode.trim()) {
      alert('Por favor ingresa el código de la sala');
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
        // Aquí se redireccionaría a la sala de batalla
        alert(`✅ Unido a sala: ${roomCode}`);
        console.log('Joined room:', data.data);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      alert('❌ Error al unirse a la sala');
    } finally {
      setLoading(false);
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
              // Fallback if image doesn't exist
              const elem = e.target as HTMLImageElement;
              elem.style.display = 'none';
            }}
          />
        </div>

        <h1 className="title">Pokémon Patacon</h1>
        <p className="subtitle">1v1 Batalla Multijugador</p>

        {screen === 'menu' && (
          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={() => setScreen('create')}
            >
              Crear Sala
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setScreen('join')}
            >
              Unirse a Sala
            </button>
          </div>
        )}

        {screen === 'create' && (
          <div className="form-container">
            <input
              type="text"
              placeholder="Tu nombre"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
            />
            <button
              className="btn btn-primary"
              onClick={handleCreateRoom}
              disabled={loading}
            >
              {loading ? 'Creando...' : 'Crear Sala'}
            </button>
            <button
              className="btn btn-tertiary"
              onClick={() => setScreen('menu')}
            >
              Volver
            </button>
          </div>
        )}

        {screen === 'join' && (
          <div className="form-container">
            <input
              type="text"
              placeholder="Tu nombre"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
            />
            <input
              type="text"
              placeholder="Código de la sala (ej: AB12CD)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <button
              className="btn btn-primary"
              onClick={handleJoinRoom}
              disabled={loading}
            >
              {loading ? 'Uniéndose...' : 'Unirse a Sala'}
            </button>
            <button
              className="btn btn-tertiary"
              onClick={() => setScreen('menu')}
            >
              Volver
            </button>
          </div>
        )}

        <div className="footer">
          <p className="version">v1.0.0 - En Desarrollo</p>
          <p className="api-status">
            📡 Backend: <span className="status-checking">Verificando...</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
