import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { usePokemon } from '../stores/pokemon';

export function DraftSelector() {
  const { code } = useParams({ from: '/draft/$code' });
  const { allPokemon, search, setSearch } = usePokemon();
  const [team, setTeam] = useState<any[]>([]);
  const [picksLeft, setPicksLeft] = useState(6);

  const handleSelect = (pokemon: any) => {
    if (team.length >= 6) return;
    setTeam([...team, pokemon]);
    setPicksLeft(picksLeft - 1);
  };

  const handleRemove = (index: number) => {
    const newTeam = [...team];
    newTeam.splice(index, 1);
    setTeam(newTeam);
    setPicksLeft(picksLeft + 1);
  };

  return (
    <div className="draft-selector">
      <h2>Selección de Equipo - {code}</h2>
      <div className="team-preview">
        <h3>Tu Equipo ({team.length}/6)</h3>
        <div className="team-slots">
          {team.map((p, i) => (
            <div key={i} className="team-slot" onClick={() => handleRemove(i)}>
              {p.name}
            </div>
          ))}
          {Array.from({ length: picksLeft }).map((_, i) => (
            <div key={i} className="team-slot empty">Vacío</div>
          ))}
        </div>
      </div>
      <div className="pokemon-search">
        <input
          type="text"
          placeholder="Buscar Pokémon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="pokemon-list">
        {allPokemon?.slice(0, 20).map((p: any) => (
          <div
            key={p.pokeapi_id}
            className="pokemon-card"
            onClick={() => handleSelect(p)}
          >
            <img src={p.sprites?.bw_sprite || p.sprites?.front_default} alt={p.name} />
            <span>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}