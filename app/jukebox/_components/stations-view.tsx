"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Loader2, Music2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import { toast } from 'sonner';
import PlexImage from './plex-image';

interface StationsViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
}

const DECADE_COLORS: Record<string, string> = {
  '1970s': 'from-amber-900/60 to-amber-950/40',
  '1980s': 'from-pink-900/60 to-fuchsia-950/40',
  '1990s': 'from-emerald-900/60 to-teal-950/40',
  '2000s': 'from-blue-900/60 to-indigo-950/40',
  '2010s': 'from-violet-900/60 to-purple-950/40',
  '2020s': 'from-cyan-900/60 to-sky-950/40',
};

const DECADE_LABELS: Record<string, string> = {
  '1970s': "70's",
  '1980s': "80's",
  '1990s': "90's",
  '2000s': "2000's",
  '2010s': "2010's",
  '2020s': "2020's",
};

function StationCard({ station, onPlay, isPlaying }: { station: any; onPlay: () => void; isPlaying: boolean }) {
  const sampleArt = station?.sampleArt ?? [];
  const decadeLabel = DECADE_LABELS[station?.decade ?? ''] ?? station?.decade ?? '';
  const genreLabel = station?.genre ?? '';

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onPlay}
      disabled={isPlaying}
      className="flex-shrink-0 w-[220px] group relative"
    >
      {/* Album art mosaic */}
      <div className={`relative w-[220px] h-[220px] rounded-xl overflow-hidden bg-gradient-to-br ${DECADE_COLORS[station?.decade ?? ''] ?? 'from-secondary to-muted'}`}>
        {sampleArt.length >= 4 ? (
          <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
            {sampleArt.slice(0, 4).map((thumb: string, i: number) => (
              <div key={i} className="w-full h-full overflow-hidden">
                <PlexImage thumb={thumb} alt="" size={200} />
              </div>
            ))}
          </div>
        ) : sampleArt.length >= 1 ? (
          <div className="w-full h-full">
            <PlexImage thumb={sampleArt[0]} alt="" size={400} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg backdrop-blur-sm">
            {isPlaying ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary-foreground" />
            ) : (
              <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
            )}
          </div>
        </div>
        {/* Station label */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h4 className="font-display font-bold text-base text-white leading-tight">
            {decadeLabel} {genreLabel}
          </h4>
          <p className="text-xs text-white/60 mt-0.5">{station?.trackCount ?? 0} tracks</p>
        </div>
      </div>
    </motion.button>
  );
}

function HorizontalScroller({ children, label }: { children: React.ReactNode; label: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -460 : 460, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, []);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xl font-display font-bold text-foreground">{label}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center disabled:opacity-20 hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center disabled:opacity-20 hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none pb-2 scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {children}
      </div>
    </div>
  );
}

export default function StationsView({ onNavigate }: StationsViewProps) {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingStation, setPlayingStation] = useState<string | null>(null);
  const { playQueue, setCurrentStationId } = usePlayer();

  useEffect(() => {
    fetch('/api/stations')
      .then(r => r?.json?.())
      .then(data => {
        setStations(data?.stations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handlePlayStation = async (station: any) => {
    const stationId = station?.id ?? '';
    setPlayingStation(stationId);
    try {
      const res = await fetch(`/api/stations/${stationId}/tracks`);
      const data = await res?.json?.();
      const tracks: TrackInfo[] = (data?.tracks ?? [])?.map?.((t: any) => ({
        id: t?.id ?? '',
        title: t?.title ?? '',
        artistName: t?.artist?.name ?? t?.artistName ?? '',
        albumTitle: t?.album?.title ?? t?.albumTitle ?? '',
        thumb: t?.thumb ?? t?.album?.thumb ?? null,
        mediaKey: t?.mediaKey ?? null,
        duration: t?.duration ?? null,
        ratingKey: t?.ratingKey ?? '',
      })) ?? [];

      if (tracks?.length > 0) {
        playQueue(tracks);
        setCurrentStationId(stationId);
        toast.success(`Playing ${station?.name ?? 'Station'}`);
        // Navigate to now playing after starting station
        setTimeout(() => onNavigate('now-playing'), 500);
      } else {
        toast.error('No tracks available for this station');
      }
    } catch {
      toast.error('Failed to load station');
    } finally {
      setPlayingStation(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if ((stations?.length ?? 0) === 0) {
    return (
      <div className="mx-auto px-6 py-16 text-center">
        <Radio className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold mb-2">No Stations Yet</h2>
        <p className="text-muted-foreground mb-6">Stations are generated based on your music library. Sync your library first!</p>
      </div>
    );
  }

  // Group by decade
  const grouped = (stations ?? []).reduce((acc: Record<string, any[]>, s: any) => {
    const decade = s?.decade ?? 'Other';
    if (!acc[decade]) acc[decade] = [];
    acc[decade].push(s);
    return acc;
  }, {} as Record<string, any[]>);

  const decades = Object.keys(grouped).sort();

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
          <Radio className="w-6 h-6 text-primary" />
          Smart Stations
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Auto-generated from your library • Swipe to browse</p>
      </div>

      {decades.map((decade: string) => (
        <HorizontalScroller key={decade} label={DECADE_LABELS[decade] ?? decade}>
          {(grouped[decade] ?? []).map((station: any) => (
            <StationCard
              key={station?.id}
              station={station}
              onPlay={() => handlePlayStation(station)}
              isPlaying={playingStation === station?.id}
            />
          ))}
        </HorizontalScroller>
      ))}
    </div>
  );
}
