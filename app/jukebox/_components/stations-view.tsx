"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, Play, Loader2, Music2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import { toast } from 'sonner';
import PlexImage from './plex-image';

interface StationsViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
  stationRows?: number;
  stationQueueSize?: number;
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

function StationCard({ station, onPlay, isPlaying, cardSize }: { station: any; onPlay: () => void; isPlaying: boolean; cardSize: number }) {
  const sampleArt = station?.sampleArt ?? [];
  const stationType = station?.stationType ?? 'standard';
  const decadeLabel = DECADE_LABELS[station?.decade ?? ''] ?? station?.decade ?? '';
  const genreLabel = station?.genre ?? '';
  const stationName = station?.name ?? `${decadeLabel} ${genreLabel}`.trim();
  const labelSize = cardSize > 400 ? 'text-2xl' : cardSize > 300 ? 'text-xl' : cardSize > 250 ? 'text-lg' : 'text-base';
  const subSize = cardSize > 400 ? 'text-base' : cardSize > 300 ? 'text-sm' : 'text-xs';

  // Determine grid: 3x3 if we have 9+ images, 2x2 if 4+, else single
  const useGrid3 = sampleArt.length >= 9;
  const useGrid2 = sampleArt.length >= 4;
  const gridCols = useGrid3 ? 3 : 2;
  const gridCount = useGrid3 ? 9 : 4;
  const imgSize = Math.round(cardSize / gridCols);

  // Color for special station types
  const bgGradient = stationType === 'hits'
    ? 'from-amber-900/60 to-orange-950/40'
    : stationType === 'most-played'
      ? 'from-rose-900/60 to-pink-950/40'
      : DECADE_COLORS[station?.decade ?? ''] ?? 'from-secondary to-muted';

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onPlay}
      disabled={isPlaying}
      className="flex-shrink-0 group relative"
      style={{ width: cardSize, height: cardSize }}
    >
      <div className={`relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-br ${bgGradient}`}>
        {useGrid2 ? (
          <div className="w-full h-full" style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridTemplateRows: `repeat(${gridCols}, 1fr)` }}>
            {sampleArt.slice(0, gridCount).map((thumb: string, i: number) => (
              <div key={i} className="w-full h-full overflow-hidden">
                <PlexImage thumb={thumb} alt="" size={imgSize} />
              </div>
            ))}
          </div>
        ) : sampleArt.length >= 1 ? (
          <div className="w-full h-full">
            <PlexImage thumb={sampleArt[0]} alt="" size={Math.round(cardSize * 2)} />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-[clamp(3rem,8%,5rem)] h-[clamp(3rem,8%,5rem)] rounded-full bg-primary/90 flex items-center justify-center shadow-lg backdrop-blur-sm">
            {isPlaying ? (
              <Loader2 className="w-[40%] h-[40%] animate-spin text-primary-foreground" />
            ) : (
              <Play className="w-[40%] h-[40%] text-primary-foreground ml-0.5" />
            )}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h4 className={`font-display font-bold ${labelSize} text-white leading-tight`}>
            {stationName}
          </h4>
          <p className={`${subSize} text-white/60 mt-0.5`}>{station?.trackCount ?? 0} tracks</p>
        </div>
      </div>
    </motion.button>
  );
}

export default function StationsView({ onNavigate, stationRows = 1, stationQueueSize = 5 }: StationsViewProps) {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingStation, setPlayingStation] = useState<string | null>(null);
  const { playQueue, setCurrentStationId, setCurrentStationName } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState(200);

  useEffect(() => {
    fetch('/api/stations')
      .then(r => r?.json?.())
      .then(data => {
        setStations(data?.stations ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Calculate card size based on available vertical space and row count
  useEffect(() => {
    const calcSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const available = container.clientHeight;
      const gap = 12;
      const totalGaps = (stationRows - 1) * gap;
      // Cards should fill ~70% of the available height per row
      const perRow = Math.max(120, Math.round((available - totalGaps) * 0.70 / stationRows));
      setCardSize(perRow);
    };
    calcSize();
    const ro = new ResizeObserver(calcSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [stations, stationRows]);

  // Infinite carousel: debounced wrap after scrolling stops
  const wrapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressWrapRef = useRef(false);

  const wrapScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || stations.length === 0 || suppressWrapRef.current) return;
    const cols = Math.ceil(stations.length / stationRows);
    if (cols < 3) return;
    const colWidth = cardSize + 12;
    const oneSetWidth = cols * colWidth;
    // Check if near start or end of triple-rendered content
    if (el.scrollLeft < colWidth * 0.5) {
      suppressWrapRef.current = true;
      el.style.scrollBehavior = 'auto';
      el.scrollLeft += oneSetWidth;
      el.style.scrollBehavior = '';
      requestAnimationFrame(() => { suppressWrapRef.current = false; });
    } else if (el.scrollLeft > oneSetWidth * 2 - el.clientWidth - colWidth * 0.5) {
      suppressWrapRef.current = true;
      el.style.scrollBehavior = 'auto';
      el.scrollLeft -= oneSetWidth;
      el.style.scrollBehavior = '';
      requestAnimationFrame(() => { suppressWrapRef.current = false; });
    }
  }, [stations.length, stationRows, cardSize]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (wrapTimeoutRef.current) clearTimeout(wrapTimeoutRef.current);
      wrapTimeoutRef.current = setTimeout(wrapScroll, 200);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (wrapTimeoutRef.current) clearTimeout(wrapTimeoutRef.current);
    };
  }, [wrapScroll]);

  // Center on middle set initially (suppress wrap during initial positioning)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || stations.length === 0) return;
    suppressWrapRef.current = true;
    const cols = Math.ceil(stations.length / stationRows);
    const colWidth = cardSize + 12;
    el.style.scrollBehavior = 'auto';
    el.scrollLeft = cols * colWidth;
    el.style.scrollBehavior = '';
    // Keep suppressed until after any momentum settles
    setTimeout(() => { suppressWrapRef.current = false; }, 500);
  }, [stations.length, stationRows, cardSize]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -(cardSize + 12) * 2 : (cardSize + 12) * 2, behavior: 'smooth' });
  };

  const handlePlayStation = async (station: any) => {
    const stationId = station?.id ?? '';
    setPlayingStation(stationId);
    try {
      const res = await fetch(`/api/stations/${stationId}/tracks?limit=${stationQueueSize}`);
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
        year: t?.year ?? t?.album?.year ?? null,
      })) ?? [];

      if (tracks?.length > 0) {
        playQueue(tracks);
        setCurrentStationId(stationId);
        setCurrentStationName(station?.name ?? null);
        toast.success(`Playing ${station?.name ?? 'Station'}`);
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if ((stations?.length ?? 0) === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center px-6">
        <div>
          <Radio className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold mb-2">No Stations Yet</h2>
          <p className="text-muted-foreground">Stations are generated based on your music library. Sync your library first!</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full px-6">
      {/* Header row */}
      <div className="flex items-center justify-between py-3 flex-shrink-0">
        <div>
          <h2 className="text-[clamp(1.25rem,2.5vw,2rem)] font-display font-bold tracking-tight flex items-center gap-3">
            <Radio className="w-[clamp(1.25rem,2vw,1.75rem)] h-[clamp(1.25rem,2vw,1.75rem)] text-primary" />
            Smart Stations
          </h2>
          <p className="text-muted-foreground text-[clamp(0.75rem,1.2vw,1rem)] mt-1">Auto-generated from your library -- Swipe to browse</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-10 h-10 rounded-full bg-secondary/70 flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-10 h-10 rounded-full bg-secondary/70 flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stations grid - centered vertically in remaining space */}
      <div className="flex-1 flex items-center min-h-0">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-none w-full items-center"
        >
          {(() => {
            // Triple the stations for infinite carousel wrapping
            const tripled = [...stations, ...stations, ...stations];
            const cols: any[][] = [];
            for (let i = 0; i < tripled.length; i += stationRows) {
              cols.push(tripled.slice(i, i + stationRows));
            }
            return cols.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-3 flex-shrink-0">
                {col.map((station: any, si: number) => (
                  <StationCard
                    key={`${ci}-${si}-${station?.id}`}
                    station={station}
                    onPlay={() => handlePlayStation(station)}
                    isPlaying={playingStation === station?.id}
                    cardSize={cardSize}
                  />
                ))}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
