import { createFileRoute } from '@tanstack/react-router';
import PokédexView from '../components/PokédexView';
import { BackgroundMusic } from '../components/BackgroundMusic';

export const Route = createFileRoute('/pokedex')({
  component: Pokedex,
});

function Pokedex() {
  return (
    <div className="pokedex-page">
      <BackgroundMusic src="/assets/music/PokedexMusic.mp3" volume={0.3} />
      <PokédexView />
    </div>
  );
}