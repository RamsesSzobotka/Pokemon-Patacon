import React, { useState, useEffect, useCallback } from 'react';
import './PokemonSlotAnimation.css';

interface PokemonTeamMember {
  pokeapi_id: number;
  name?: string;
  name_es?: string;
  types?: string[];
  sprites?: {
    icon?: string | null;
    [key: string]: any;
  };
  [key: string]: any;
}

interface PokemonSlotAnimationProps {
  myTeam: PokemonTeamMember[];
  opponentTeam: PokemonTeamMember[];
  onAnimationComplete: () => void;
}

const TOTAL_POKEMON = 649;
const SPIN_POOL = Array.from({ length: 151 }, (_, i) => i + 1);
const SPIN_MS = 60;
const SPIN_DURATION = 2500;
const CASCADE_MS = 400;
const FINAL_DISPLAY = 3500;

// Precompute icon URLs for ALL Pokemon — esta es la misma URL que el campo
// sprites.icon almacena en la base de datos. Así todo slot usa formato icono.
const ICON_URLS: Record<number, string> = {};
for (let i = 1; i <= TOTAL_POKEMON; i++) {
  ICON_URLS[i] = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;
}

/** Obtiene la URL del icon: prioriza sprites.icon del DB, si no usa la precomputada */
function getIconSrc(sprites: PokemonTeamMember['sprites'] | undefined, pokeapiId: number): string {
  if (sprites?.icon) return sprites.icon;
  return ICON_URLS[pokeapiId] || ICON_URLS[1];
}

type Phase = 'spinning' | 'stopping' | 'complete';

interface SlotState {
  pokeapiId: number;
  stopped: boolean;
  iconSrc: string;
  name?: string;
  types?: string[];
}

function makeSlot(id: number, stopped: boolean, iconSrc?: string): SlotState {
  return { pokeapiId: id, stopped, iconSrc: iconSrc || ICON_URLS[id] };
}

export const PokemonSlotAnimation: React.FC<PokemonSlotAnimationProps> = ({
  myTeam,
  opponentTeam,
  onAnimationComplete
}) => {
  const [mySlots, setMySlots] = useState<SlotState[]>(() =>
    Array.from({ length: 6 }, () => makeSlot(1, false))
  );
  const [oppSlots, setOppSlots] = useState<SlotState[]>(() =>
    Array.from({ length: 6 }, () => makeSlot(1, false))
  );
  const [phase, setPhase] = useState<Phase>('spinning');
  const [stoppedCount, setStoppedCount] = useState(0);

  const getRandomId = useCallback((excludeId: number): number => {
    const candidates = SPIN_POOL.filter(id => id !== excludeId);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, []);

  // Phase 1: Spinning — cycle rapidly through random Pokemon icons
  useEffect(() => {
    if (phase !== 'spinning') return;

    const interval = setInterval(() => {
      setMySlots(prev =>
        prev.map(s =>
          s.stopped ? s : makeSlot(getRandomId(myTeam[prev.indexOf(s)]?.pokeapi_id || 1), false)
        )
      );
      setOppSlots(prev =>
        prev.map(s =>
          s.stopped ? s : makeSlot(getRandomId(opponentTeam[prev.indexOf(s)]?.pokeapi_id || 1), false)
        )
      );
    }, SPIN_MS);

    const timeout = setTimeout(() => setPhase('stopping'), SPIN_DURATION);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase, myTeam, opponentTeam, getRandomId]);

  // Phase 2: Cascade stop — one slot each interval
  useEffect(() => {
    if (phase !== 'stopping') return;

    const interval = setInterval(() => {
      setStoppedCount(prev => {
        const next = prev + 1;
        if (next > 6) return prev;

        const stopSlot = (team: PokemonTeamMember[]): SlotState => {
          const m = team[next - 1];
          if (!m) return makeSlot(1, true);
          const iconSrc = getIconSrc(m.sprites, m.pokeapi_id);
          return {
            pokeapiId: m.pokeapi_id,
            stopped: true,
            iconSrc,
            name: m.name_es || m.name || '',
            types: m.types || [],
          };
        };

        setMySlots(prev => {
          const nextSlots = [...prev];
          nextSlots[next - 1] = stopSlot(myTeam);
          return nextSlots;
        });

        setOppSlots(prev => {
          const nextSlots = [...prev];
          nextSlots[next - 1] = stopSlot(opponentTeam);
          return nextSlots;
        });

        return next;
      });
    }, CASCADE_MS);

    return () => clearInterval(interval);
  }, [phase, myTeam, opponentTeam]);

  // Phase change: all stopped → complete
  useEffect(() => {
    if (stoppedCount >= 6 && phase === 'stopping') {
      setPhase('complete');
      const timeout = setTimeout(() => onAnimationComplete(), FINAL_DISPLAY);
      return () => clearTimeout(timeout);
    }
  }, [stoppedCount, phase, onAnimationComplete]);

  const renderSlot = (slot: SlotState, index: number) => (
    <div
      key={index}
      className={`slot-cell ${slot.stopped ? 'slot-stopped' : 'slot-spinning'}`}
    >
      <div className="slot-icon-wrap">
        <img
          src={slot.iconSrc}
          alt=""
          className="slot-icon"
        />
      </div>

      {slot.stopped && slot.name && (
        <span className="slot-pokemon-name">{slot.name}</span>
      )}

      {slot.stopped && slot.types && slot.types.length > 0 && (
        <div className="slot-types">
          {slot.types.map(t => (
            <img
              key={t}
              src={`/assets/icons/${t}.svg`}
              alt={t}
              className="slot-type-icon"
            />
          ))}
        </div>
      )}

      <span className={`slot-number ${slot.stopped ? 'slot-number-stopped' : ''}`}>
        {index + 1}
      </span>

      {slot.stopped && <div className="slot-stop-bar" />}
    </div>
  );

  const phaseText =
    phase === 'spinning' ? 'Barajando Pokemon...' :
    phase === 'stopping' ? `Deteniendo: ${stoppedCount}/6` :
    'Equipos listos';

  const phaseClass =
    phase === 'spinning' ? 'slot-status-spinning' :
    phase === 'stopping' ? 'slot-status-stopping' :
    'slot-status-complete';

  return (
    <div className="slot-overlay">
      <div className="slot-container">
        {/* Header */}
        <h2 className="slot-title">
          {phase === 'spinning' && 'SELECCIONANDO EQUIPOS'}
          {phase === 'stopping' && 'DEFINIENDO EQUIPOS'}
          {phase === 'complete' && 'EQUIPOS LISTOS'}
        </h2>

        {/* Status */}
        <div className="slot-status">
          <span className={`slot-status-text ${phaseClass}`}>{phaseText}</span>
        </div>

        {/* Teams */}
        <div className="slot-teams">
          <div className="slot-team-group">
            <div className="slot-team-label player-label">TU EQUIPO</div>
            <div className="slot-grid">
              {mySlots.map((s, i) => renderSlot(s, i))}
            </div>
          </div>

          <div className="slot-divider-v">
            <span className="slot-vs">VS</span>
          </div>

          <div className="slot-team-group">
            <div className="slot-team-label opponent-label">OPONENTE</div>
            <div className="slot-grid">
              {oppSlots.map((s, i) => renderSlot(s, i))}
            </div>
          </div>
        </div>

        {/* Footer dots */}
        <div className="slot-footer">
          <span className="slot-footer-text">
            {phase === 'complete' ? 'Iniciando batalla...' : 'Preparando batalla...'}
          </span>
          <div className="slot-footer-dots">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={`slot-dot ${
                  i < stoppedCount ? 'completed' :
                  i === stoppedCount && phase === 'stopping' ? 'active' : ''
                } ${phase === 'complete' ? 'completed' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
