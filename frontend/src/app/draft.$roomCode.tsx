import { createFileRoute } from '@tanstack/react-router';
import Draft from '../components/Draft';

export const Route = createFileRoute('/draft/$roomCode')({
  component: DraftPage,
});

function DraftPage() {
  const { roomCode } = Route.useParams();
  return <Draft roomCode={roomCode} />;
}