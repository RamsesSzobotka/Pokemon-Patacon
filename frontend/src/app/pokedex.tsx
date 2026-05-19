import { createFileRoute } from '@tanstack/react-router';
import PokédexView from '../components/PokédexView';

export const Route = createFileRoute('/pokedex')({
  component: Pokedex,
});

function Pokedex() {
  return (
    <div className="pokedex-page">
      <PokédexView />
    </div>
  );
}