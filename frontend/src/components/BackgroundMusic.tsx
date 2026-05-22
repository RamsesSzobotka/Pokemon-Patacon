import { useEffect, useRef } from 'react';

interface BackgroundMusicProps {
  src: string;
  volume?: number;
}

export function BackgroundMusic({ src, volume = 0.3 }: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.loop = true;

    const playAudio = () => {
      audio.play().catch(() => {
        // Autoplay puede estar bloqueado; el loop ya queda preparado.
      });
    };

    playAudio();

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [src, volume]);

  return <audio ref={audioRef} src={src} preload="auto" aria-hidden="true" style={{ display: 'none' }} />;
}
