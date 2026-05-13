interface PokemonSpriteProps {
  pokemon: {
    name: string;
    sprites: {
      bw_sprite?: string;
      front_default?: string;
      official_artwork?: string;
    };
  };
  isEnemy?: boolean;
}

export function PokemonSprite({ pokemon, isEnemy }: PokemonSpriteProps) {
  const src = pokemon.sprites?.bw_sprite ||
              pokemon.sprites?.official_artwork ||
              pokemon.sprites?.front_default ||
              '';

  return (
    <div className={`pokemon-sprite ${isEnemy ? 'enemy' : 'player'}`}>
      <img src={src} alt={pokemon.name} />
    </div>
  );
}