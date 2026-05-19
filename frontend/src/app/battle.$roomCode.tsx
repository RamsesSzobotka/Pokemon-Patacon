import { createFileRoute } from '@tanstack/react-router';
import Battle from '../components/battle/Battle';

export const Route = createFileRoute('/battle/$roomCode')({
  component: BattlePage,
});

function BattlePage() {
  const { roomCode } = Route.useParams();
  return <Battle roomCode={roomCode} />;
}