import { Battle } from '../components/Battle';
import { createFileRoute } from '@tanstack/react-router';

export const route = createFileRoute('/battle/$code')({
  component: BattleRoute,
});

function BattleRoute() {
  return <Battle />;
}