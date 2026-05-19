import React, { useEffect, useState } from 'react';
import './CoinFlipAnimation.css';

interface CoinFlipAnimationProps {
  firstPlayerId: 'player1' | 'player2';
  player1Name: string;
  player2Name: string;
  onAnimationComplete: () => void;
}

export const CoinFlipAnimation: React.FC<CoinFlipAnimationProps> = ({
  firstPlayerId,
  player1Name,
  player2Name,
  onAnimationComplete
}) => {
  const [phase, setPhase] = useState<'flipping' | 'result' | 'done'>('flipping');
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // Fase 1: Animación de lanzamiento (2 segundos)
    const flipTimer = setTimeout(() => {
      setPhase('result');
      setShowResult(true);
    }, 2000);

    return () => clearTimeout(flipTimer);
  }, []);

  useEffect(() => {
    if (phase === 'result') {
      // Fase 2: Mostrar resultado (2 segundos)
      const resultTimer = setTimeout(() => {
        setPhase('done');
        onAnimationComplete();
      }, 2000);

      return () => clearTimeout(resultTimer);
    }
  }, [phase, onAnimationComplete]);

  const firstPlayerName = firstPlayerId === 'player1' ? player1Name : player2Name;

  return (
    <div className="coinflip-overlay">
      <div className="coinflip-container">
        {/* Moneda animada con imagen real */}
        <div className={`coin ${phase === 'flipping' ? 'flipping' : ''}`}>
          <img 
            src="/assets/items/coin.png" 
            alt="Coin" 
            className="coin-image"
          />
        </div>

        {/* Resultado */}
        {showResult && (
          <div className="coinflip-result">
            <p className="result-text">
              ¡{firstPlayerName} atacará primero!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
