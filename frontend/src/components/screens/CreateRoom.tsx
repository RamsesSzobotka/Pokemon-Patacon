import { useState } from 'react';

interface CreateRoomProps {
  onBack: () => void;
}

export default function CreateRoom({ onBack }: CreateRoomProps) {
  const [roomCode] = useState('AB3F2K');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="create-room-container">
      <div className="screen-header">
        <button className="back-button" onClick={onBack}>
          ← Volver al Menú
        </button>
      </div>

      <div className="screen-content">
        <h1 className="screen-title">CREAR SALA</h1>

        {/* Room Code Section */}
        <div className="room-code-section">
          <label className="code-label">Codigo de la Sala:</label>
          <div className="code-display-wrapper">
            <div className="code-display">{roomCode}</div>
            <button
              className={`copy-button ${copied ? 'copied' : ''}`}
              onClick={handleCopyCode}
            >
              {copied ? '✓ Copiado' : '📋 Copiar'}
            </button>
          </div>
        </div>

        {/* QR Code Placeholder */}
        <div className="qr-placeholder">
          <div className="qr-box">
            <p className="qr-text">[QR Code Placeholder]</p>
          </div>
          <p className="qr-instruction">
            Comparte este codigo con tu oponente
          </p>
        </div>

        {/* Waiting Section */}
        <div className="waiting-section">
          <div className="waiting-indicator">
            <span className="pulse">⏳</span>
            <p className="waiting-text">Esperando jugador...</p>
          </div>
          <p className="waiting-hint">
            Tu oponente debe ingresar el codigo para unirse a la sala
          </p>
        </div>
      </div>
    </div>
  );
}
