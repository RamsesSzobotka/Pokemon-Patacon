import { useState } from 'react';

interface JoinRoomProps {
  onBack: () => void;
}

export default function JoinRoom({ onBack }: JoinRoomProps) {
  const [code, setCode] = useState('');

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 6);
    setCode(value);
  };

  const handleJoin = () => {
    if (code.length === 6) {
      console.log('Unirse a sala:', code);
      // Aquí se implementaría la lógica para unirse
    }
  };

  return (
    <div className="join-room-container">
      <div className="screen-header">
        <button className="back-button" onClick={onBack}>
          ← Volver al Menú
        </button>
      </div>

      <div className="screen-content">
        <h1 className="screen-title">UNIRSE A SALA</h1>

        <p className="section-description">
          Ingresa el codigo de la sala para unirte
        </p>

        {/* Input Section */}
        <div className="join-input-section">
          <div className="input-wrapper">
            <input
              type="text"
              className="join-code-input"
              placeholder="AB3F2K"
              value={code}
              onChange={handleCodeChange}
              maxLength={6}
            />
            <button
              className={`join-button ${code.length === 6 ? 'enabled' : 'disabled'}`}
              onClick={handleJoin}
              disabled={code.length !== 6}
            >
              UNIRSE
            </button>
          </div>

          <p className="validation-text">
            El codigo debe tener 6 caracteres
          </p>

          {code.length > 0 && (
            <p className="char-counter">
              {code.length}/6 caracteres ingresados
            </p>
          )}
        </div>

        {/* Hint */}
        <div className="join-hint">
          <p>💡 Pide el código a tu oponente</p>
          <p>Solo se aceptan letras (A-Z) y números (0-9)</p>
        </div>
      </div>
    </div>
  );
}
