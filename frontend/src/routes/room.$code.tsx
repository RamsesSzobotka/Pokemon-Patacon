import { RoomLobby } from '../components/RoomLobby';
import { createFileRoute } from '@tanstack/react-router';

export const route = createFileRoute('/room/$code')({
  component: Room,
});

function Room() {
  return <RoomLobby />;
}