import { useParams } from '@tanstack/react-router';
import { useBattle } from '../stores/battle';
import { PokemonSprite } from './PokemonSprite';
import { ActionPanel } from './ActionPanel';
import { ObjectsMenu } from './ObjectsMenu';
import { useState } from 'react';

export function Battle() {
  const { code } = useParams({ from: '/battle/$code' });
  const { state, turn } = useBattle();
  const [showObjects, setShowObjects] = useState(false);

  const player1Active = state?.player1Team?.[state.player1Active];
  const player2Active = state?.player2Team?.[state.player2Active];

  return (
    <div className="battle-arena">
      <div className="battle-header">
        <span>Turno {turn}</span>
      </div>

      <div className="battle-field">
        <div className="player-side player-2">
          {player2Active && (
            <>
              <div className="pokemon-info">
                <span className="pokemon-name">{player2Active.name}</span>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{ width: `${(player2Active.hp / player2Active.maxHp) * 100}%` }}
                  />
                </div>
                <span className="hp-text">
                  {player2Active.hp} / {player2Active.maxHp}
                </span>
              </div>
              <PokemonSprite pokemon={player2Active} isEnemy />
            </>
          )}
        </div>

        <div className="player-side player-1">
          {player1Active && (
            <>
              <PokemonSprite pokemon={player1Active} />
              <div className="pokemon-info">
                <span className="pokemon-name">{player1Active.name}</span>
                <div className="hp-bar">
                  <div
                    className="hp-fill"
                    style={{ width: `${(player1Active.hp / player1Active.maxHp) * 100}%` }}
                  />
                </div>
                <span className="hp-text">
                  {player1Active.hp} / {player1Active.maxHp}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {showObjects ? (
        <ObjectsMenu onClose={() => setShowObjects(false)} />
      ) : (
        <ActionPanel onOpenObjects={() => setShowObjects(true)} />
      )}
    </div>
  );
}