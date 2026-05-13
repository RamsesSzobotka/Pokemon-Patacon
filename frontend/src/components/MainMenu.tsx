import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { createRoom } from '../services/pokemonApi';
import './MainMenu.css';

interface RoomHistory {
  code: string;
  time: string;
}

export function MainMenu() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RoomHistory[]>([
    { code: 'AB3F2K', time: 'hace 5 minutos' },
    { code: 'XY7K2L', time: 'hace 1 hora' },
    { code: 'ZA9B1M', time: 'hace 3 horas' },
  ]);

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const code = await createRoom();
      navigate({ to: '/room/$code', params: { code } });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = () => {
    if (joinCode.trim().length !== 6) return;
    navigate({ to: '/room/$code', params: { code: joinCode } });
  };

  const handleHistoryClick = (code: string) => {
    setJoinCode(code);
  };

  const handlePokedex = () => {
    console.log('Pokedex not implemented yet');
  };

  return (
    <div className="main-menu">
      <div className="menu-container">
        <div className="logo-section">
          <img
            src="/assets/titleF.png"
            alt="Pokémon Patacon"
            className="title-image"
          />
          <p className="subtitle">Battle Arena - Generación V</p>
        </div>

        <div className="menu-buttons">
          <button
            className="menu-button create-room"
            onClick={handleCreateRoom}
            disabled={loading}
          >
            <span className="button-icon">+</span>
            <span className="button-text">Crear Sala</span>
            <span className="button-hint">Genera código único</span>
          </button>

          <button
            className="menu-button join-room"
            onClick={handleJoinRoom}
            disabled={joinCode.length !== 6}
          >
            <span className="button-icon">🔗</span>
            <span className="button-text">Unirse a Sala</span>
            <span className="button-hint">Ingresa código</span>
          </button>

          <button
            className="menu-button pokedex"
            onClick={handlePokedex}
          >
            <span className="button-icon">📖</span>
            <span className="button-text">Pokédex</span>
            <span className="button-hint">Ver Pokémon disponibles</span>
          </button>
        </div>

        <div className="join-section">
          <div className="join-input-wrapper">
            <input
              type="text"
              className="join-input"
              placeholder="Código de sala"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
            />
            {joinCode.length > 0 && (
              <span className="char-count">{joinCode.length}/6</span>
            )}
          </div>
        </div>

        <div className="history-section">
          <h3 className="history-title">📋 Historial de Salas:</h3>
          <ul className="history-list">
            {history.map((room, index) => (
              <li
                key={index}
                className="history-item"
                onClick={() => handleHistoryClick(room.code)}
              >
                <span className="history-code">{room.code}</span>
                <span className="history-time">{room.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="menu-footer">
          <p>Pokémon Patacon v1.0 | Sin login</p>
        </div>
      </div>
    </div>
  );
}