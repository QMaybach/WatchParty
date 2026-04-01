import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css'; // Important: standard CSS include for video.js
import 'videojs-youtube';

interface VideoPlayerProps {
  options: {
    sources?: { src: string; type: string }[];
    [key: string]: unknown;
  };
  onReady?: (player: Player) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ options, onReady }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Player | null>(null);

  const currentSrcRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Инициализация плеера, если он еще не создан
    if (!playerRef.current && containerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered', 'w-full', 'h-full');
      containerRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        videojs.log('Player is ready');
        if (onReady) onReady(player);
      });
      
      const newSrc = options.sources?.[0]?.src || null;
      currentSrcRef.current = newSrc;
    } 
    // 2. Обновление источника видео (src) на лету, если плеер уже есть
    else if (playerRef.current && options.sources) {
      const player = playerRef.current;
      const newSrc = options.sources[0]?.src || null;
      
      // Обновляем источник ТОЛЬКО если он реально изменился
      if (currentSrcRef.current !== newSrc) {
        player.src(options.sources);
        currentSrcRef.current = newSrc;
      }
      
      // Обновляем состояние звука и контролов
      if (typeof options.muted === 'boolean') {
        player.muted(options.muted);
      }
      if (typeof options.controls === 'boolean') {
        player.controls(options.controls);
      }
      
      // Синхронизация статуса Play/Pause (когда меняется options.autoplay)
      if (options.autoplay === true && player.paused()) {
        try { player.play()?.catch(() => {}); } catch { console.debug('Игнорируем ошибку автоплея'); }
      } else if (options.autoplay === false && !player.paused()) {
        try { player.pause(); } catch { console.debug('Игнорируем ошибку паузы'); }
      }
    }
  }, [options, onReady]);

  // Уничтожаем плеер при размонтировании компонента
  useEffect(() => {
    return () => {
      const player = playerRef.current;
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className="w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
