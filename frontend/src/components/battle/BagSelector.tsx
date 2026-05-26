import { useState } from 'react';
import { resolveFrontSprite } from '../../utils/spriteResolver';

// ============================================
// TYPES
// ============================================

interface BagPokemon {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  isFainted: boolean;
  sprites?: {
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
  };
  pokeapiId?: number;
  owner_shiny?: boolean;
}

interface ItemDef {
  id: 'hiperPosion' | 'maximoRevivir';
  name: string;
  description: string;
  icon: string;
  canUseOn: (pokemon: BagPokemon) => boolean;
}

// ============================================
// ITEM DEFINITIONS
// ============================================

const ITEMS: ItemDef[] = [
  {
    id: 'hiperPosion',
    name: 'Hiper Poción',
    description: 'Restaura todos los PS de un Pokémon',
    icon: '/assets/items/hiperPosion.png',
    canUseOn: (p) => p.hp > 0 && p.hp < p.maxHp,
  },
  {
    id: 'maximoRevivir',
    name: 'Máximo Revivir',
    description: 'Revive un Pokémon debilitado al máximo PS',
    icon: '/assets/items/revive.png',
    canUseOn: (p) => p.isFainted || p.hp <= 0,
  },
];

// ============================================
// COMPONENT
// ============================================

function BagSelector({
  inventory,
  team,
  onUse,
  onCancel,
}: {
  inventory: { hiperPosion: number; maximoRevivir: number };
  team: BagPokemon[];
  onUse: (itemId: string, targetId: number) => void;
  onCancel: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Si se seleccionó un ítem, mostrar grid de selección de objetivo
  if (selectedItem) {
    const item = ITEMS.find(i => i.id === selectedItem)!;
    return (
      <div className="bag-selector-overlay">
        <div className="bag-selector">
          <h3>Usar {item.name}</h3>
          <div className="team-grid">
            {team.map(pokemon => {
              const canUse = item.canUseOn(pokemon);
              return (
                <div
                  key={pokemon.id}
                  className={`team-member-card ${pokemon.isFainted ? 'fainted' : ''}`}
                >
                  <img
                    src={resolveFrontSprite(
                      pokemon.sprites as any,
                      pokemon.owner_shiny === true,
                      pokemon.pokeapiId
                    )}
                    alt={pokemon.name}
                    className="team-sprite"
                  />
                  <span className="team-name">{pokemon.name}</span>
                  <div className="team-hp">
                    <div
                      className="team-hp-bar"
                      style={{
                        width: `${(pokemon.hp / pokemon.maxHp) * 100}%`,
                        backgroundColor:
                          pokemon.hp > pokemon.maxHp * 0.35
                            ? '#4CAF50'
                            : pokemon.hp > pokemon.maxHp * 0.1
                              ? '#FF9800'
                              : '#F44336',
                      }}
                    />
                  </div>
                  <span className="team-hp-text">
                    {pokemon.hp}/{pokemon.maxHp}
                  </span>
                  <div className="team-member-actions">
                    <button
                      className={`action-btn${canUse ? ' valid-target' : ''}`}
                      onClick={() => onUse(selectedItem, pokemon.id)}
                      disabled={!canUse}
                    >
                      Usar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="cancel-btn" onClick={() => setSelectedItem(null)}>
            Atrás
          </button>
        </div>
      </div>
    );
  }

  // Vista de lista de ítems
  return (
    <div className="bag-selector-overlay">
      <div className="bag-selector">
        <h3>Bolsa de Batalla</h3>
        <div className="bag-item-list">
          {ITEMS.map(item => {
            const count = inventory[item.id] || 0;
            const isDisabled = count <= 0;
            return (
              <button
                key={item.id}
                className={`item-slot${isDisabled ? ' item-disabled' : ''}`}
                onClick={() => !isDisabled && setSelectedItem(item.id)}
                disabled={isDisabled}
              >
                <img src={item.icon} alt={item.name} className="item-icon" />
                <div className="item-info">
                  <span className="item-name">{item.name}</span>
                  <span className="item-desc">{item.description}</span>
                </div>
                <span className="item-count">{count}</span>
              </button>
            );
          })}
        </div>
        <button className="cancel-btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default BagSelector;
