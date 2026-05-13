import { useParams } from '@tanstack/react-router';
import { useRoom } from '../stores/room';

export function RoomLobby() {
  const { code } = useParams({ from: '/room/$code' });
  const { room, isHost, ready } = useRoom();

  return (
    <div className="room-lobby">
      <h2>Sala: {code}</h2>
      <div className="players">
        <div className="player-slot">
          <span>Jugador 1 {isHost ? '(Tú)' : ''}</span>
          {room?.player_1 ? '✓ Conectado' : '◌ Esperando...'}
        </div>
        <div className="player-slot">
          <span>Jugador 2 {!isHost ? '(Tú)' : ''}</span>
          {room?.player_2 ? '✓ Conectado' : '◌ Esperando...'}
        </div>
      </div>
      <button disabled={!ready}>Listo</button>
    </div>
  );
}