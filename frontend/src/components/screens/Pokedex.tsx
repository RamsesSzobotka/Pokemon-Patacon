import { useState } from 'react';

interface PokedexProps {
  onBack: () => void;
}

interface Pokemon {
  id: number;
  name: string;
  type: string;
  sprite: string;
}

export default function Pokedex({ onBack }: PokedexProps) {
  const [selectedType, setSelectedType] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Pokémon de muestra (Gen V)
  const samplePokemon: Pokemon[] = [
    { id: 494, name: 'Victini', type: 'psychic-fire', sprite: '🔴' },
    { id: 495, name: 'Snivy', type: 'grass', sprite: '🟢' },
    { id: 501, name: 'Oshawott', type: 'water', sprite: '💧' },
    { id: 507, name: 'Tepig', type: 'fire', sprite: '🔥' },
    { id: 519, name: 'Pidove', type: 'normal-flying', sprite: '🟤' },
    { id: 524, name: 'Roggenrola', type: 'rock', sprite: '⭐' },
  ];

  const types = [
    'todos',
    'normal',
    'fire',
    'water',
    'grass',
    'electric',
    'ice',
    'fighting',
    'poison',
    'ground',
    'flying',
    'psychic',
    'bug',
    'rock',
    'ghost',
    'dragon',
    'dark',
    'steel',
    'fairy',
  ];

  const filteredPokemon = samplePokemon.filter((pokemon) => {
    const matchesSearch =
      pokemon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pokemon.id.toString().includes(searchQuery);
    const matchesType =
      selectedType === 'todos' || pokemon.type.includes(selectedType);
    return matchesSearch && matchesType;
  });

  return (
    <div className="pokedex-container">
      <div className="screen-header">
        <button className="back-button" onClick={onBack}>
          ← Volver al Menú
        </button>
      </div>

      <div className="screen-content">
        <h1 className="screen-title">POKÉDEX - GEN V</h1>

        {/* Search Bar */}
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar Pokémon por nombre o #ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Type Filter */}
        <div className="type-filter-section">
          <p className="filter-label">Filtrar por Tipo:</p>
          <div className="type-buttons">
            {types.map((type) => (
              <button
                key={type}
                className={`type-button ${selectedType === type ? 'active' : ''}`}
                onClick={() => setSelectedType(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Pokemon Grid */}
        <div className="pokemon-grid">
          {filteredPokemon.length > 0 ? (
            filteredPokemon.map((pokemon) => (
              <div key={pokemon.id} className="pokemon-card">
                <div className="pokemon-sprite">{pokemon.sprite}</div>
                <div className="pokemon-info">
                  <p className="pokemon-name">{pokemon.name}</p>
                  <p className="pokemon-id">#{pokemon.id}</p>
                  <p className="pokemon-type">{pokemon.type}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">
              <p>No se encontraron Pokémon</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="pokedex-stats">
          <p>
            Mostrando {filteredPokemon.length} de {samplePokemon.length} Pokémon
          </p>
        </div>
      </div>
    </div>
  );
}
