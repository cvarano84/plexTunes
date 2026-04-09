"use client";

import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music2, ListMusic, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';

interface PlayerBarProps {
  onNavigate: (view: ViewType, opts?: any) => void;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

export default function PlayerBar({ onNavigate }: PlayerBarProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    queue,
  } = usePlayer();

  const [showVolume, setShowVolume] = useState(false);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* Progress bar (clickable) */}
      <div
        className="h-1 bg-muted/50 cursor-pointer group"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          const rect = e?.currentTarget?.getBoundingClientRect?.();
          if (!rect) return;
          const x = (e?.clientX ?? 0) - (rect?.left ?? 0);
          const pct = x / (rect?.width ?? 1);
          seek(pct * duration);
        }}
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all group-hover:h-1.5"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="bg-card/95 backdrop-blur-xl border-t border-border/30">
        <div className="max-w-[1200px] mx-auto px-4 h-20 flex items-center gap-4">
          {/* Track info */}
          <button
            onClick={() => onNavigate?.('now-playing')}
            className="flex items-center gap-3 flex-1 min-w-0 group"
          >
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
              <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={120} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate max-w-[200px]">
                {currentTrack?.title ?? ''}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {currentTrack?.artistName ?? ''}
              </p>
            </div>
            <ChevronUp className="w-4 h-4 text-muted-foreground ml-1 group-hover:text-primary transition-colors" />
          </button>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevTrack}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-primary-foreground" />
              ) : (
                <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Time */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono w-24">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Volume */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            >
              {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <AnimatePresence>
              {showVolume && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl p-3 shadow-lg"
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVolume(parseFloat(e?.target?.value ?? '0.5'))}
                    className="w-24 h-2 accent-primary"
                    style={{ writingMode: 'horizontal-tb' as any }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Queue button */}
          <button
            onClick={() => onNavigate?.('queue')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors relative"
          >
            <ListMusic className="w-5 h-5" />
            {(queue?.length ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                {queue?.length ?? 0}
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
