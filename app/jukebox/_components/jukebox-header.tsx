"use client";

import React from 'react';
import { Disc3, Settings } from 'lucide-react';
import { usePlayer } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';

interface JukeboxHeaderProps {
  onNavigate: (view: ViewType) => void;
  jukeboxTitle?: string;
}

export default function JukeboxHeader({ onNavigate, jukeboxTitle }: JukeboxHeaderProps) {
  const { currentStationName, isPlaying } = usePlayer();
  const title = jukeboxTitle || 'Plex Jukebox';

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Disc3 className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-display font-bold tracking-tight neon-text flex-shrink-0">{title}</h1>
          {currentStationName && isPlaying && (
            <>
              <span className="text-muted-foreground/40 mx-1 flex-shrink-0">/</span>
              <span className="text-[clamp(1rem,2vw,1.5rem)] font-display font-bold text-white truncate">
                {currentStationName}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => onNavigate('settings')}
          className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors flex-shrink-0"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
