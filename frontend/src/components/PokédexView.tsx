import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PokemonType, MoveType, POKEMON_TYPES, TYPE_COLORS, GENERATIONS } from '../types/game';
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

interface MovesResponse {
  success: boolean;
  data: {
    pokemon_id: number;
    moves: MoveType[];
    count: number;
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
  const [pokemonMoves, setPokemonMoves] = useState<MoveType[]>([]);
  const [loadingMoves, setLoadingMoves] = useState(false);
  const [selectedMove, setSelectedMove] = useState<MoveType | null>(null);

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

  const openDetail = async (poke: PokemonType) => {
    setSelectedPokemon(poke);
    setIsDetailOpen(true);
    setShowAllMoves(false);
    setPokemonMoves([]);
    
    // Cargar movimientos del Pokémon desde el endpoint
    setLoadingMoves(true);
    try {
      const response = await fetch(`/api/pokemon/${poke.pokeapi_id}/moves`);
      const data: MovesResponse = await response.json();
      
      if (data.success) {
        setPokemonMoves(data.data.moves);
      }
    } catch (err) {
      console.error('Error fetching moves:', err);
    } finally {
      setLoadingMoves(false);
    }
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setShowAllMoves(false);
    setPokemonMoves([]);
    setShowAllMoves(false);
  };

  return (
    <div className="pokedex-view">
      {/* Main Layout: Filtros + Área de Pokémon */}
      <div className="pokedex-main">
        {/* Filtros */}
        <div className="filters-panel">
          {/* Header dentro de filtros */}
          <div className="filters-header">
            <button
              className="back-btn-filters"
              onClick={() => navigate('/')}
              title="Volver al menú"
            >
              ◀
            </button>
            <span className="filters-title">POKÉDEX</span>
          </div>

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
        </div>  {/* cierra filters-panel */}

        {/* Área de Pokémon */}
        <div className="pokemon-area">
          <div className="pokemon-scroll-container">
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
              Página {currentPage} de {Math.ceil(649 / pageSize)}
            </span>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={pokemon.length < pageSize}
              className="btn btn-secondary"
            >
              Siguiente ▶
            </button>
          </div>  {/* cierra pagination */}
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
          </div>  {/* cierra pokemon-scroll-container */}
        </div>  {/* cierra pokemon-area */}
      </div>  {/* cierra pokedex-main */}

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
                  
                  {/* Indicador de carga de movimientos */}
                  {loadingMoves && (
                    <div className="moves-loading">
                      <div className="spinner-small"></div>
                      <span>Cargando movimientos...</span>
                    </div>
                  )}

                  {/* Botón para mostrar/ocultar todos los ataques */}
                  {!loadingMoves && (
                    <button 
                      className="view-all-moves-btn"
                      onClick={() => setShowAllMoves(!showAllMoves)}
                    >
                      {showAllMoves 
                        ? '🔼 Ocultar movimientos' 
                        : `🔍 Ver ${pokemonMoves.length} ataques disponibles`
                      }
                    </button>
                  )}

                  {/* Lista de movimientos con scroll */}
                  {!loadingMoves && (
                    <div className={`moves-scroll-container ${showAllMoves ? 'expanded' : 'collapsed'}`}>
                      {pokemonMoves.map((move) => (
                        <div 
                          key={move.move_id} 
                          className="move-card"
                          onClick={() => setSelectedMove(move)}
                        >
                          <div className="move-header">
                            <span className="move-name">{move.names?.es?.toUpperCase() || move.name.toUpperCase()}</span>
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

                          {/* Mostrar estado aplicado si existe */}
                          {move.meta?.ailment && (
                            <div className="move-ailment">
                              <span className="ailment-badge">{move.meta.ailment.toUpperCase()}</span>
                              <span className="ailment-chance">{move.meta.ailment_chance}%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Indicador de más movimientos */}
                  {!loadingMoves && !showAllMoves && pokemonMoves.length > 4 && (
                    <p className="moves-hint">
                      + {pokemonMoves.length - 4} ataques más. Haz clic en "Ver ataques" para ver todos.
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

      {/* Modal de descripción del movimiento */}
      {selectedMove && (
        <div className="move-detail-overlay" onClick={() => setSelectedMove(null)}>
          <div className="move-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="move-detail-close"
              onClick={() => setSelectedMove(null)}
            >
              ✕
            </button>

            <div className="move-detail-header">
              <h2>{selectedMove.names?.es?.toUpperCase() || selectedMove.name.toUpperCase()}</h2>
              <span 
                className="move-type-badge-large"
                style={{ backgroundColor: TYPE_COLORS[selectedMove.type] || '#999' }}
              >
                {selectedMove.type.toUpperCase()}
              </span>
            </div>

            <div className="move-detail-description">
              <p>{selectedMove.description || 'Sin descripción disponible.'}</p>
            </div>

            <div className="move-detail-stats">
              <div className="detail-stat-item">
                <span className="label">PODER</span>
                <span className="value">{selectedMove.power !== null ? selectedMove.power : '—'}</span>
              </div>
              <div className="detail-stat-item">
                <span className="label">PRECISIÓN</span>
                <span className="value">{selectedMove.accuracy !== null ? `${selectedMove.accuracy}%` : '—'}</span>
              </div>
              <div className="detail-stat-item">
                <span className="label">PP</span>
                <span className="value">{selectedMove.pp || '—'}</span>
              </div>
              <div className="detail-stat-item">
                <span className="label">PRIORIDAD</span>
                <span className="value">{selectedMove.priority >= 0 ? `+${selectedMove.priority}` : selectedMove.priority}</span>
              </div>
            </div>

            <div className="move-detail-class">
              <span className={`damage-class-large ${selectedMove.damage_class}`}>
                {selectedMove.damage_class === 'physical' ? '⚔️ FÍSICO' : 
                 selectedMove.damage_class === 'special' ? '✨ ESPECIAL' : '📋 ESTADO'}
              </span>
            </div>

            {selectedMove.meta?.ailment && (
              <div className="move-detail-ailment">
                <span className="ailment-label">Puede causar:</span>
                <span 
                  className="ailment-badge-large"
                  style={{ 
                    backgroundColor: selectedMove.meta.ailment === 'burn' ? '#ff6b35' :
                                   selectedMove.meta.ailment === 'poison' ? '#9b59b6' :
                                   selectedMove.meta.ailment === 'sleep' ? '#3498db' :
                                   selectedMove.meta.ailment === 'paralysis' ? '#f1c40f' :
                                   selectedMove.meta.ailment === 'freeze' ? '#00cec9' : '#999'
                  }}
                >
                  {selectedMove.meta.ailment.toUpperCase()} ({selectedMove.meta.ailment_chance}%)
                </span>
              </div>
            )}

            <div className="move-detail-flags">
              {selectedMove.flags?.protect && <span className="flag">🛡️ Bloqueable</span>}
              {selectedMove.flags?.mirror && <span className="flag">🔄 Reflejable</span>}
              {selectedMove.flags?.contact && <span className="flag">👊 Contacto</span>}
              {selectedMove.flags?.recharge && <span className="flag">🔋 Recarga</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokédexView;
