import { useState } from 'react';
import { useBattle } from '../stores/battle';

interface ActionPanelProps {
  onOpenObjects: () => void;
}

export function ActionPanel({ onOpenObjects }: ActionPanelProps) {
  const { state, actions } = useBattle();
  const [selectedAction, setSelectedAction] = useState<'attack' | 'switch' | null>(null);
  const [selectedMove, setSelectedMove] = useState<number | null>(null);

  const currentPokemon = state?.player1Team?.[state.player1Active];
  const moves = currentPokemon?.moves || [];

  const handleAction = () => {
    if (selectedAction === 'attack' && selectedMove !== null) {
    }
  };

  return (
    <div className="action-panel">
      <div className="main-actions">
        <button onClick={() => setSelectedAction('attack')}>Atacar</button>
        <button onClick={() => setSelectedAction('switch')}>Cambiar Pokémon</button>
        <button onClick={onOpenObjects}>Objetos</button>
      </div>

      {selectedAction === 'attack' && (
        <div className="moves-list">
          {moves.map((move: any, i: number) => (
            <button
              key={i}
              className="move-button"
              onClick={() => setSelectedMove(i)}
            >
              {move.name}
            </button>
          ))}
        </div>
      )}

      {selectedMove !== null && (
        <button className="confirm-button" onClick={handleAction}>
          Confirmar
        </button>
      )}
    </div>
  );
}