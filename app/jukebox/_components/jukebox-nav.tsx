"use client";

import React from 'react';
import { Radio, Users, Search, Music2, ListMusic } from 'lucide-react';
import type { ViewType } from './jukebox-shell';
import { usePlayer } from '@/lib/player-context';

interface JukeboxNavProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

const navItems: Array<{ view: ViewType; label: string; icon: React.ElementType }> = [
  { view: 'stations', label: 'Stations', icon: Radio },
  { view: 'artists', label: 'Artists', icon: Users },
  { view: 'search', label: 'Search', icon: Search },
  { view: 'now-playing', label: 'Now Playing', icon: Music2 },
  { view: 'queue', label: 'Queue', icon: ListMusic },
];

export default function JukeboxNav({ currentView, onNavigate }: JukeboxNavProps) {
  const { currentTrack } = usePlayer();

  return (
    <nav className="sticky top-14 z-40 bg-background/60 backdrop-blur-xl border-b border-border/20">
      <div className="max-w-[1200px] mx-auto px-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-2">
          {navItems?.map?.((item: any) => {
            const Icon = item?.icon;
            const isActive = currentView === item?.view ||
              (item?.view === 'now-playing' && (currentView === 'artist-detail' || currentView === 'album-detail'));
            const isDisabled = (item?.view === 'now-playing' || item?.view === 'queue') && !currentTrack;

            return (
              <button
                key={item?.view ?? ''}
                onClick={() => !isDisabled && onNavigate?.(item?.view)}
                disabled={isDisabled}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : isDisabled
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                  }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {item?.label ?? ''}
              </button>
            );
          }) ?? null}
        </div>
      </div>
    </nav>
  );
}
