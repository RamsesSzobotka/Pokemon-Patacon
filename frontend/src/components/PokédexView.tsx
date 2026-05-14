import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PokemonType, POKEMON_TYPES, TYPE_COLORS, GENERATIONS } from '../types/game';
import '../styles/Pokedex.css';

interface PokemonListResponse {
  success: boolean;
  data: {
    pokemon: PokemonType[];
    total: number;
    limit: number;
    offset: number;
    pages: number;
  };
}

const PokédexView: React.FC = () => {
  const navigate = useNavigate();
  const [pokemon, setPokemon] = useState<PokemonType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonType | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showAllMoves, setShowAllMoves] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<number | null>(null);
  const [showLegendary, setShowLegendary] = useState(false);
  const [showMythical, setShowMythical] = useState(false);
  const [showOnlySpecial, setShowOnlySpecial] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  /**
   * Fetch Pokémon con filtros actuales
   */
  const fetchPokemon = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      // Búsqueda
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // Tipos
      if (selectedTypes.length > 0) {
        params.append('types', selectedTypes.join(','));
      }

      // Generación
      if (selectedGeneration) {
        params.append('generation', selectedGeneration.toString());
      }

      // Legendarios/Míticos
      if (showOnlySpecial) {
        if (showLegendary) {
          params.append('legendary', 'true');
        }
        if (showMythical) {
          params.append('mythical', 'true');
        }
      }

      // Paginación
      params.append('limit', pageSize.toString());
      params.append('offset', ((currentPage - 1) * pageSize).toString());

      const response = await fetch(`/api/pokemon?${params.toString()}`);
      const data: PokemonListResponse = await response.json();

      if (data.success) {
        setPokemon(data.data.pokemon);
      } else {
        setError('Failed to fetch Pokémon');
      }
    } catch (err) {
      console.error('Error fetching Pokémon:', err);
      setError('Network error fetching Pokémon');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTypes, selectedGeneration, showLegendary, showMythical, showOnlySpecial, currentPage, pageSize]);

  // Fetch on filter change
  useEffect(() => {
    setCurrentPage(1); // Reset to first page on filter change
  }, [searchQuery, selectedTypes, selectedGeneration, showLegendary, showMythical, showOnlySpecial]);

  useEffect(() => {
    fetchPokemon();
  }, [fetchPokemon]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedGeneration(null);
    setShowLegendary(false);
    setShowMythical(false);
    setShowOnlySpecial(false);
    setCurrentPage(1);
  };

  const openDetail = (poke: PokemonType) => {
    setSelectedPokemon(poke);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setShowAllMoves(false);
  };

  return (
    <div className="pokedex-view">
      {/* Header */}
      <div className="pokedex-header">
        <button
          className="back-btn-header"
          onClick={() => navigate('/')}
          title="Volver al menú"
        >
          ◀
        </button>
        <h1>📖 POKÉDEX - 493 POKÉMON (GEN I-V)</h1>
        <p className="subtitle">Explora todos los Pokémon disponibles en batalla</p>
      </div>

      {/* Filtros */}
      <div className="filters-panel">
        {/* Búsqueda */}
        <div className="filter-section">
          <label htmlFor="search">BUSCAR POKÉMON</label>
          <div className="search-box">
            <input
              id="search"
              type="text"
              placeholder="Pikachu, Charizard, 25..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bw-input search-input"
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tipos */}
        <div className="filter-section">
          <label>FILTRAR POR TIPO ({selectedTypes.length})</label>
          <div className="type-filter">
            {POKEMON_TYPES.map(type => (
              <button
                key={type}
                className={`type-btn ${selectedTypes.includes(type) ? 'active' : ''}`}
                onClick={() => toggleType(type)}
                style={{
                  backgroundColor: selectedTypes.includes(type)
                    ? TYPE_COLORS[type] || '#999'
                    : '#2d2d2d',
                  borderColor: TYPE_COLORS[type] || '#999'
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Generación */}
        <div className="filter-section">
          <label htmlFor="generation">GENERACIÓN</label>
          <select
            id="generation"
            value={selectedGeneration || ''}
            onChange={(e) => setSelectedGeneration(e.target.value ? parseInt(e.target.value) : null)}
            className="bw-input generation-select"
          >
            <option value="">Todas las generaciones</option>
            {Object.entries(GENERATIONS).map(([id, gen]) => (
              <option key={id} value={id}>
                {gen.name}
              </option>
            ))}
          </select>
        </div>

        {/* Especiales */}
        <div className="filter-section">
          <label>ESPECIALES</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showOnlySpecial}
                onChange={(e) => setShowOnlySpecial(e.target.checked)}
              />
              <span>Mostrar solo especiales</span>
            </label>
            {showOnlySpecial && (
              <>
                <label className="checkbox-label indent">
                  <input
                    type="checkbox"
                    checked={showLegendary}
                    onChange={(e) => setShowLegendary(e.target.checked)}
                  />
                  <span>👑 Legendarios (35)</span>
                </label>
                <label className="checkbox-label indent">
                  <input
                    type="checkbox"
                    checked={showMythical}
                    onChange={(e) => setShowMythical(e.target.checked)}
                  />
                  <span>✨ Míticos (13)</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Controles */}
        <div className="filter-controls">
          <button
            className="btn btn-secondary"
            onClick={clearAllFilters}
            disabled={
              !searchQuery &&
              selectedTypes.length === 0 &&
              !selectedGeneration &&
              !showLegendary &&
              !showMythical &&
              !showOnlySpecial
            }
          >
            LIMPIAR FILTROS
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className="bw-input"
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      {/* Estado de carga/error */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando Pokémon...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>❌ Error: {error}</p>
          <button onClick={fetchPokemon} className="btn btn-primary">
            Reintentar
          </button>
        </div>
      )}

      {/* Grid de Pokémon */}
      {!loading && pokemon.length > 0 && (
        <>
          <div className="pokemon-grid">
            {pokemon.map((poke) => (
              <div
                key={poke.pokeapi_id}
                className={`pokemon-card ${poke.is_legendary ? 'legendary' : ''} ${
                  poke.is_mythical ? 'mythical' : ''
                }`}
                onClick={() => openDetail(poke)}
              >
                <div className="pokemon-sprite">
                  <img
                    src={poke.sprites.animated_gif}
                    alt={poke.name}
                    className="sprite-img"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = poke.sprites.static_png;
                    }}
                  />
                </div>

                <div className="pokemon-info">
                  <div className="pokemon-number">#{poke.pokeapi_id}</div>
                  <h3 className="pokemon-name">{poke.name.toUpperCase()}</h3>

                  <div className="pokemon-types">
                    {poke.types.map(type => (
                      <span
                        key={type}
                        className="type-badge"
                        style={{ backgroundColor: TYPE_COLORS[type] || '#999' }}
                      >
                        {type}
                      </span>
                    ))}
                  </div>

                  {(poke.is_legendary || poke.is_mythical) && (
                    <div className="special-badge">
                      {poke.is_legendary && '👑 LEGENDARIO'}
                      {poke.is_mythical && '✨ MÍTICO'}
                    </div>
                  )}

                  <div className="pokemon-stats-mini">
                    <div className="stat-bar">
                      <span className="stat-label">ATK</span>
                      <div className="bar" style={{ width: `${(poke.stats.attack / 150) * 100}%` }}></div>
                      <span className="stat-value">{poke.stats.attack}</span>
                    </div>
                    <div className="stat-bar">
                      <span className="stat-label">DEF</span>
                      <div className="bar" style={{ width: `${(poke.stats.defense / 150) * 100}%` }}></div>
                      <span className="stat-value">{poke.stats.defense}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          <div className="pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary"
            >
              ◀ Anterior
            </button>
            <span className="page-info">
              Página {currentPage} de {Math.ceil(493 / pageSize)}
            </span>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={pokemon.length < pageSize}
              className="btn btn-secondary"
            >
              Siguiente ▶
            </button>
          </div>
        </>
      )}

      {/* Sin resultados */}
      {!loading && pokemon.length === 0 && !error && (
        <div className="no-results">
          <p>😔 No se encontraron Pokémon con los filtros aplicados</p>
          <button onClick={clearAllFilters} className="btn btn-primary">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Modal de detalles */}
      {isDetailOpen && selectedPokemon && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDetail}>✕</button>

            <div className="detail-container">
              {/* Sprite grande */}
              <div className="detail-sprite">
                <img
                  src={selectedPokemon.sprites.animated_gif}
                  alt={selectedPokemon.name}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = selectedPokemon.sprites.static_png;
                  }}
                />
              </div>

              {/* Información */}
              <div className="detail-info">
                <h1>{selectedPokemon.name.toUpperCase()}</h1>
                <p className="detail-number">#{selectedPokemon.pokeapi_id}</p>

                <div className="detail-types">
                  {selectedPokemon.types.map(type => (
                    <span
                      key={type}
                      className="type-badge-large"
                      style={{ backgroundColor: TYPE_COLORS[type] || '#999' }}
                    >
                      {type.toUpperCase()}
                    </span>
                  ))}
                </div>

                {(selectedPokemon.is_legendary || selectedPokemon.is_mythical) && (
                  <div className="detail-special">
                    {selectedPokemon.is_legendary && '👑 LEGENDARIO'}
                    {selectedPokemon.is_mythical && '✨ MÍTICO'}
                  </div>
                )}

                {/* Stats completos */}
                <div className="detail-stats">
                  <h3>ESTADÍSTICAS</h3>
                  {Object.entries(selectedPokemon.stats).map(([stat, value]) => (
                    <div key={stat} className="stat-row">
                      <span className="stat-name">{stat.toUpperCase()}</span>
                      <div className="stat-bar-full">
                        <div
                          className="bar"
                          style={{ width: `${(value / 150) * 100}%` }}
                        ></div>
                      </div>
                      <span className="stat-val">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Movimientos - Lista Scroll con detalles completos */}
                <div className="detail-moves">
                  <h3>MOVIMIENTOS</h3>
                  
                  {/* Botón para mostrar/ocultar todos los ataques */}
                  <button 
                    className="view-all-moves-btn"
                    onClick={() => setShowAllMoves(!showAllMoves)}
                  >
                    {showAllMoves 
                      ? '🔼 Ocultar movimientos' 
                      : `🔍 Ver ${selectedPokemon.moves.length} ataques disponibles`
                    }
                  </button>

                  {/* Lista de movimientos con scroll */}
                  <div className={`moves-scroll-container ${showAllMoves ? 'expanded' : 'collapsed'}`}>
                    {selectedPokemon.moves.map((move, index) => (
                      <div key={`${move.name}-${index}`} className="move-card">
                        <div className="move-header">
                          <span className="move-name">{move.name.toUpperCase()}</span>
                          <span 
                            className="move-type-badge" 
                            style={{ backgroundColor: TYPE_COLORS[move.type] || '#999' }}
                          >
                            {move.type.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="move-details">
                          <div className="move-stat">
                            <span className="stat-label">PODER</span>
                            <span className="stat-value">{move.power !== null ? move.power : '—'}</span>
                          </div>
                          <div className="move-stat">
                            <span className="stat-label">PRECISIÓN</span>
                            <span className="stat-value">{move.accuracy !== null ? `${move.accuracy}%` : '—'}</span>
                          </div>
                          <div className="move-stat">
                            <span className="stat-label">PRIORIDAD</span>
                            <span className="stat-value">{move.priority >= 0 ? `+${move.priority}` : move.priority}</span>
                          </div>
                          <div className="move-stat">
                            <span className="stat-label">TIPO</span>
                            <span className={`damage-class ${move.damage_class}`}>
                              {move.damage_class === 'physical' ? 'FÍSICO' : 
                               move.damage_class === 'special' ? 'ESPECIAL' : 'ESTADO'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Indicador de más movimientos */}
                  {!showAllMoves && selectedPokemon.moves.length > 4 && (
                    <p className="moves-hint">
                      + {selectedPokemon.moves.length - 4} ataques más. Haz clic en "Ver ataques" para ver todos.
                    </p>
                  )}
                </div>

                {/* Info adicional */}
                <div className="detail-extra">
                  <div className="extra-item">
                    <span>Altura:</span>
                    <strong>{selectedPokemon.height_dm / 10} m</strong>
                  </div>
                  <div className="extra-item">
                    <span>Peso:</span>
                    <strong>{selectedPokemon.weight_hg / 10} kg</strong>
                  </div>
                  <div className="extra-item">
                    <span>Experiencia:</span>
                    <strong>{selectedPokemon.base_experience} XP</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokédexView;
