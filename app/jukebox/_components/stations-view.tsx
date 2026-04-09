"use client";

import React, { useState, useEffect } from 'react';
import { Radio, Play, Loader2, Music2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import { toast } from 'sonner';

interface StationsViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
}

const DECADE_COLORS: Record<string, string> = {
  '1970s': 'from-amber-900/40 to-amber-800/20',
  '1980s': 'from-pink-900/40 to-purple-800/20',
  '1990s': 'from-emerald-900/40 to-teal-800/20',
  '2000s': 'from-blue-900/40 to-indigo-800/20',
  '2010s': 'from-violet-900/40 to-purple-800/20',
  '2020s': 'from-cyan-900/40 to-blue-800/20',
};

const GENRE_ICONS: Record<string, string> = {
  'Rock': '🎸',
  'Pop': '⭐',
  'Dance': '🕺',
  'Hip-Hop': '🎤',
  'R&B': '🎵',
  'Country': '🤠',
  'New Wave': '🌊',
  'Soul': '❤️',
};

export default function StationsView({ onNavigate }: StationsViewProps) {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingStation, setPlayingStation] = useState<string | null>(null);
  const { playQueue } = usePlayer();

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
        toast.success(`Playing ${station?.name ?? 'Station'}`);
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
      <div className="max-w-[1200px] mx-auto px-4 py-16 text-center">
        <Radio className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold mb-2">No Stations Yet</h2>
        <p className="text-muted-foreground mb-6">Stations are generated based on your music library. Sync your library first!</p>
      </div>
    );
  }

  // Group by decade
  const grouped = (stations ?? [])?.reduce?.((acc: Record<string, any[]>, s: any) => {
    const decade = s?.decade ?? 'Other';
    if (!acc[decade]) acc[decade] = [];
    acc[decade].push(s);
    return acc;
  }, {} as Record<string, any[]>) ?? {};

  const decades = Object.keys(grouped ?? {})?.sort?.() ?? [];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
          <Radio className="w-6 h-6 text-primary" />
          Smart Stations
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Auto-generated from your library featuring popular hits</p>
      </div>

      {decades?.map?.((decade: string, di: number) => (
        <div key={decade} className="mb-8">
          <h3 className="text-lg font-display font-semibold mb-3 text-muted-foreground">{decade}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(grouped?.[decade] ?? [])?.map?.((station: any, si: number) => (
              <motion.button
                key={station?.id ?? si}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: di * 0.05 + si * 0.05 }}
                onClick={() => handlePlayStation(station)}
                disabled={playingStation === station?.id}
                className={`relative overflow-hidden rounded-xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-br ${DECADE_COLORS?.[decade] ?? 'from-secondary to-muted'} border border-border/30 group`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-2xl mb-2">{GENRE_ICONS?.[station?.genre ?? ''] ?? '🎵'}</div>
                    <h4 className="font-display font-bold text-base text-foreground">{station?.name ?? ''}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{station?.description ?? ''}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Music2 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{station?.trackCount ?? 0} tracks</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/40 transition-colors">
                    {playingStation === station?.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <Play className="w-5 h-5 text-primary ml-0.5" />
                    )}
                  </div>
                </div>
              </motion.button>
            )) ?? null}
          </div>
        </div>
      )) ?? null}
    </div>
  );
}
