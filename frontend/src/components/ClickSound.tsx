import React, { useEffect, useRef } from 'react';

const AUDIO_PATH = '/assets/music/ButtonMusic.mp3';
const POOL_SIZE = 4;

const ClickSound: React.FC = () => {
  const poolRef = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    // Inicializar pool de audios
    poolRef.current = Array.from({ length: POOL_SIZE }, () => {
      const a = new Audio(AUDIO_PATH);
      a.preload = 'auto';
      a.volume = 0.5;
      return a;
    });

    const playClick = (ev: MouseEvent) => {
      try {
        const target = ev.target as HTMLElement | null;
        if (!target) return;

        // Reproducir sólo si el elemento clicado es interactivo (botón, enlace o role=button)
        if (
          target.closest('button, a, [role="button"], .click-sound')
        ) {
          // Buscar audio libre en la pool
          const audio = poolRef.current.find((x) => x.paused) || poolRef.current[0];
          audio.currentTime = 0;
          // Ignorar errores de reproducción automática
          audio.play().catch(() => {});
        }
      } catch (e) {
        // no-op
      }
    };

    document.addEventListener('click', playClick);

    return () => {
      document.removeEventListener('click', playClick);
      // Cleanup pool
      poolRef.current.forEach((a) => {
        a.pause();
        a.src = '';
      });
      poolRef.current = [];
    };
  }, []);

  return null;
};

export default ClickSound;
