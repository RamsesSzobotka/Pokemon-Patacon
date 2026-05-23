import React, { useEffect, useState, useRef } from 'react';
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
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('/assets/sounds/CoinFlip.mp3');
    audio.volume = 0.8;
    audioRef.current = audio;
    // play but ignore errors (autoplay may be blocked)
    audio.play().catch(() => {});

    // no-ended handling: we announce based on time after video starts

    const videoTimer = setTimeout(() => {
      setShowVideo(true);
    }, 300);

    // Fallback: if autoplay blocked or something goes wrong, announce after 5s
    const safetyTimer = setTimeout(() => {
      setShowVideo(true);
      setPhase('result');
      setShowResult(true);
    }, 5000);

    return () => {
      clearTimeout(videoTimer);
      clearTimeout(safetyTimer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (phase === 'result') {
      // Fase 2: Mostrar resultado (800ms)
      const resultTimer = setTimeout(() => {
        setPhase('done');
        onAnimationComplete();
      }, 800);

      return () => clearTimeout(resultTimer);
    }
  }, [phase, onAnimationComplete]);

  // Cuando el video empieza a mostrarse, esperar 2s y anunciar
  useEffect(() => {
    if (!showVideo) return;
    const announceTimer = setTimeout(() => {
      setPhase('result');
      setShowResult(true);
    }, 2000);
    return () => clearTimeout(announceTimer);
  }, [showVideo]);

  const firstPlayerName = firstPlayerId === 'player1' ? player1Name : player2Name;

  return (
    <div className="coinflip-overlay">
      <div className="coinflip-container">
        {/* Moneda - video o imagen según fase */}
        <div className="coin">
          {phase === 'flipping' ? (
            showVideo ? (
              <video
                ref={videoRef}
                src={firstPlayerId === 'player1' ? '/assets/items/CoinJ1.mp4' : '/assets/items/CoinJ2.mp4'}
                autoPlay
                muted
                className="coin-video"
              />
            ) : (
              <img
                src="/assets/items/coin.png"
                alt="Coin"
                className="coin-image"
              />
            )
          ) : (
            <img 
              src="/assets/items/coin.png" 
              alt="Coin" 
              className="coin-image"
            />
          )}
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