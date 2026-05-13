interface RoomHistory {
  code: string;
  time: string;
}

interface MenuPrincipalProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onPokedex: () => void;
  onHistoryClick: (code: string) => void;
  history: RoomHistory[];
}

export default function MenuPrincipal({
  onCreateRoom,
  onJoinRoom,
  onPokedex,
  onHistoryClick,
  history,
}: MenuPrincipalProps) {
  return (
    <div className="main-menu">
      <div className="menu-container">
        {/* Logo Section */}
        <div className="logo-section">
          <img
            src="/assets/titleF.png"
            alt="Pokémon Patacon"
            className="title-image"
          />
          <p className="subtitle">Battle Arena - Generación V</p>
        </div>

        {/* Main Buttons */}
        <div className="menu-buttons">
          <button className="menu-button create-room" onClick={onCreateRoom}>
            <span className="button-icon">➕</span>
            <span className="button-text">Crear Sala</span>
            <span className="button-hint">Genera código único</span>
          </button>

          <button className="menu-button join-room" onClick={onJoinRoom}>
            <span className="button-icon">🔗</span>
            <span className="button-text">Unirse a Sala</span>
            <span className="button-hint">Ingresa código</span>
          </button>

          <button className="menu-button pokedex" onClick={onPokedex}>
            <span className="button-icon">📖</span>
            <span className="button-text">Pokédex</span>
            <span className="button-hint">Ver Pokémon disponibles</span>
          </button>
        </div>

        {/* History Section */}
        <div className="history-section">
          <h3 className="history-title">📋 Historial de Salas:</h3>
          <ul className="history-list">
            {history.map((room, index) => (
              <li
                key={index}
                className="history-item"
                onClick={() => onHistoryClick(room.code)}
              >
                <span className="history-code">{room.code}</span>
                <span className="history-time">{room.time}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="menu-footer">
          <p>Pokémon Patacon v1.0 | Sin login</p>
        </div>
      </div>
    </div>
  );
}
