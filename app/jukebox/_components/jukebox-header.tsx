"use client";

import React from 'react';
import { Disc3, Settings } from 'lucide-react';
import type { ViewType } from './jukebox-shell';

interface JukeboxHeaderProps {
  onNavigate: (view: ViewType) => void;
}

export default function JukeboxHeader({ onNavigate }: JukeboxHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Disc3 className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-display font-bold tracking-tight neon-text">Plex Jukebox</h1>
        </div>
        <button
          onClick={() => onNavigate('settings')}
          className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
