import React, { useState, useEffect, useCallback } from 'react';
import { resolveFrontSprite } from '../../utils/spriteResolver';
import './PokemonSlotAnimation.css';

interface PokemonTeamMember {
  pokeapi_id: number;
  name?: string;
}

interface PokemonSlotAnimationProps {
  myTeam: PokemonTeamMember[];
  opponentTeam: PokemonTeamMember[];
  onAnimationComplete: () => void;
}

// Lista de IDs de Pokémon para la animación de spinning (muestran sprites aleatorios)
const SPIN_POKEMON_IDS = Array.from({ length: 151 }, (_, i) => i + 1);

export const PokemonSlotAnimation: React.FC<PokemonSlotAnimationProps> = ({
  myTeam,
  opponentTeam,
  onAnimationComplete
}) => {
  // Estado para cada slot: su sprite actual y si ya se detuvo
  const [mySlots, setMySlots] = useState<{id: number, stopped: boolean}[]>(
    Array(6).fill(null).map(() => ({ id: 1, stopped: false }))
  );
  const [oppSlots, setOppSlots] = useState<{id: number, stopped: boolean}[]>(
    Array(6).fill(null).map(() => ({ id: 1, stopped: false }))
  );
  
  const [animationPhase, setAnimationPhase] = useState<'spinning' | 'stopping' | 'complete'>('spinning');
  const [completedSlots, setCompletedSlots] = useState(0);

  // Función para obtener un ID aleatorio diferente del objetivo
  const getRandomSpinId = useCallback((targetId: number): number => {
    const candidates = SPIN_POKEMON_IDS.filter(id => id !== targetId);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, []);

  // Efecto principal de animación
  useEffect(() => {
    if (animationPhase === 'spinning') {
      // Phase 1: Spinning rápido - actualizar sprites frecuentemente
      const spinInterval = setInterval(() => {
        setMySlots(prev => prev.map(slot => 
          slot.stopped ? slot : { ...slot, id: getRandomSpinId(myTeam[prev.indexOf(slot)]?.pokeapi_id || 1) }
        ));
        setOppSlots(prev => prev.map(slot => 
          slot.stopped ? slot : { ...slot, id: getRandomSpinId(opponentTeam[prev.indexOf(slot)]?.pokeapi_id || 1) }
        ));
      }, 60); // 60ms = muy rápido

      // Después de 2.5 segundos, empezar a detener en cascada
      const cascadeTimeout = setTimeout(() => {
        setAnimationPhase('stopping');
      }, 2500);

      return () => {
        clearInterval(spinInterval);
        clearTimeout(cascadeTimeout);
      };
    }

    if (animationPhase === 'stopping') {
      // Phase 2: Detener en cascada - un slot cada 500ms
      const stopInterval = setInterval(() => {
        setCompletedSlots(prev => {
          const next = prev + 1;
          
          if (next <= 6) {
            // Detener el siguiente slot de cada equipo
            setMySlots(prev => {
              const newSlots = [...prev];
              if (newSlots[next - 1]) {
                newSlots[next - 1] = { 
                  ...newSlots[next - 1], 
                  stopped: true,
                  id: myTeam[next - 1]?.pokeapi_id || 1
                };
              }
              return newSlots;
            });
            
            setOppSlots(prev => {
              const newSlots = [...prev];
              if (newSlots[next - 1]) {
                newSlots[next - 1] = { 
                  ...newSlots[next - 1], 
                  stopped: true,
                  id: opponentTeam[next - 1]?.pokeapi_id || 1
                };
              }
              return newSlots;
            });
          }
          
          return next;
        });
      }, 400);

      // Cleanup cuando todos los slots estén detenidos
      return () => clearInterval(stopInterval);
    }
  }, [animationPhase, myTeam, opponentTeam, getRandomSpinId]);

  // Detectar cuando todos los slots están completados
  useEffect(() => {
    if (completedSlots >= 6 && animationPhase === 'stopping') {
      setAnimationPhase('complete');
      // Llamar callback después de un delay para mostrar el resultado final
      setTimeout(() => {
        onAnimationComplete();
      }, 3500);
    }
  }, [completedSlots, animationPhase, onAnimationComplete]);

  const getSpriteUrl = (pokeapiId: number) => 
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeapiId}.png`;

  const getRenderedSprite = (id: number, teamMember: any) => {
    // If we have a team member object with sprites, prefer resolving with owner flags
    if (teamMember && teamMember.sprites) {
      const ownerShiny = teamMember.owner_shiny ?? teamMember.owner?.shiny_pack ?? false;
      const resolved = resolveFrontSprite(teamMember.sprites, ownerShiny, teamMember.pokeapi_id || id);
      if (resolved) return resolved;
    }
    return getSpriteUrl(id);
  };

  return (
    <div className="slot-animation-overlay">
      <div className="slot-machine-container">
        <h2 className="slot-title">
          {animationPhase === 'spinning' && '🎰 SELECCIONANDO EQUIPO...'}
          {animationPhase === 'stopping' && '🎲 EQUIPOS DEFINIDOS'}
          {animationPhase === 'complete' && '✅ ¡LISTO PARA LA BATALLA!'}
        </h2>

        <div className="slot-teams-container">
          {/* Mi Equipo */}
          <div className="slot-team-section">
            <h3 className="slot-team-title">TU EQUIPO</h3>
            <div className="slot-reel">
              {mySlots.map((slot, index) => (
                <div 
                  key={index} 
                  className={`slot-item ${slot.stopped ? 'stopped' : 'spinning'}`}
                >
                  <img 
                    src={slot.stopped ? getRenderedSprite(slot.id, myTeam[index]) : getSpriteUrl(slot.id)} 
                    alt={`slot-${index}`}
                    className="slot-sprite"
                  />
                  <span className="slot-number">{index + 1}</span>
                  {slot.stopped && (
                    <div className="slot-stop-indicator" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Equipo Oponente */}
          <div className="slot-team-section opponent">
            <h3 className="slot-team-title">EQUIPO OPONENTE</h3>
            <div className="slot-reel">
              {oppSlots.map((slot, index) => (
                <div 
                  key={index} 
                  className={`slot-item ${slot.stopped ? 'stopped' : 'spinning'}`}
                >
                  <img 
                    src={slot.stopped ? getRenderedSprite(slot.id, opponentTeam[index]) : getSpriteUrl(slot.id)} 
                    alt={`slot-${index}`}
                    className="slot-sprite"
                  />
                  <span className="slot-number">{index + 1}</span>
                  {slot.stopped && (
                    <div className="slot-stop-indicator" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Indicador de estado */}
        <div className="slot-status">
          {animationPhase === 'spinning' && (
            <div className="slot-spinning-indicator">
              <span className="slot-spinner">🎰</span>
              <span>mezclando...</span>
            </div>
          )}
          {animationPhase === 'stopping' && (
            <div className="slot-stopping-indicator">
              <span>Deteniendo: {completedSlots}/6</span>
            </div>
          )}
          {animationPhase === 'complete' && (
            <div className="slot-complete-indicator">
              <span>🎉 ¡Equipos seleccionados!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};