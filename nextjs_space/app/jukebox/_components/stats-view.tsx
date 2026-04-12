"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Play, ListPlus, Loader2, Music2, Trophy, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import PlexImage from './plex-image';
import { toast } from 'sonner';

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

const PERIODS = [
  { id: '30d', label: '30 Days' },
  { id: '90d', label: '90 Days' },
  { id: '1y', label: '1 Year' },
  { id: 'all', label: 'All Time' },
];

export default function StatsView() {
  const [period, setPeriod] = useState('all');
  const [tracks, setTracks] = useState<any[]>([]);
  const [totalPlays, setTotalPlays] = useState(0);
  const [loading, setLoading] = useState(true);
  const { playQueue, addToQueue, playNext } = usePlayer();

  const fetchStats = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tracks/stats?period=${p}&limit=50`);
      const data = await res.json();
      setTracks(data?.tracks ?? []);
      setTotalPlays(data?.totalPlays ?? 0);
    } catch { setTracks([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStats(period); }, [period, fetchStats]);

  const makeTrackInfo = (t: any): TrackInfo => ({
    id: t?.id ?? '',
    title: t?.title ?? '',
    artistName: t?.artistName ?? '',
    albumTitle: t?.albumTitle ?? '',
    thumb: t?.thumb ?? null,
    mediaKey: t?.mediaKey ?? null,
    duration: t?.duration ?? null,
    ratingKey: t?.ratingKey ?? '',
    year: t?.year ?? null,
  });

  const handlePlayAll = () => {
    const all = tracks.map(makeTrackInfo);
    if (all.length > 0) {
      playQueue(all);
      toast.success(`Playing top ${all.length} tracks`);
    }
  };

  const handleAddAll = () => {
    tracks.forEach(t => addToQueue(makeTrackInfo(t)));
    toast.success(`Added ${tracks.length} tracks to queue`);
  };

  const maxPlays = tracks.length > 0 ? Math.max(...tracks.map(t => t.playCount ?? 0)) : 1;

  return (
    <div className="px-6 py-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-[clamp(1.25rem,2.5vw,2rem)] font-display font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="w-[clamp(1.25rem,2vw,1.75rem)] h-[clamp(1.25rem,2vw,1.75rem)] text-primary" />
            Top Played
          </h2>
          <p className="text-muted-foreground text-[clamp(0.75rem,1.2vw,1rem)] mt-1">
            {totalPlays} total plays across {tracks.length} tracks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-[clamp(0.75rem,1vw,0.875rem)] hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> Play All
          </button>
          <button
            onClick={handleAddAll}
            disabled={tracks.length === 0}
            className="px-4 py-2.5 rounded-lg bg-secondary text-foreground font-medium text-[clamp(0.75rem,1vw,0.875rem)] hover:bg-secondary/80 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <ListPlus className="w-4 h-4" /> Add All
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-5 py-2.5 rounded-lg text-[clamp(0.8rem,1.1vw,1rem)] font-medium transition-all ${
              period === p.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Track list */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Music2 className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-display font-bold mb-2">No plays yet</h3>
          <p className="text-muted-foreground">Start listening to build your stats</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-none min-h-0">
          <div className="space-y-1">
            {tracks.map((track: any, i: number) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.5) }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
              >
                {/* Rank */}
                <div className="w-[clamp(2rem,3vw,3rem)] text-center flex-shrink-0">
                  {i < 3 ? (
                    <Trophy className={`w-[clamp(1.25rem,1.8vw,1.75rem)] h-[clamp(1.25rem,1.8vw,1.75rem)] mx-auto ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : 'text-orange-400'
                    }`} />
                  ) : (
                    <span className="text-[clamp(0.875rem,1.3vw,1.25rem)] font-mono text-muted-foreground">{i + 1}</span>
                  )}
                </div>

                {/* Art */}
                <div className="w-[clamp(3rem,4.5vw,4.5rem)] h-[clamp(3rem,4.5vw,4.5rem)] rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                  <PlexImage thumb={track.thumb} alt={track.title ?? ''} size={120} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[clamp(0.9rem,1.4vw,1.25rem)] font-medium truncate">{track.title}</p>
                  <p className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground truncate">{track.artistName}</p>
                  {(track.billboardPeak || track.billboardWeeks) && (
                    <p className="text-[clamp(0.6rem,0.8vw,0.7rem)] text-accent mt-0.5">
                      {track.billboardPeak ? `#${track.billboardPeak} peak` : ''}
                      {track.billboardPeak && track.billboardWeeks ? ' · ' : ''}
                      {track.billboardWeeks ? `${track.billboardWeeks} wks on chart` : ''}
                    </p>
                  )}
                </div>

                {/* Play bar + count */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-[clamp(4rem,8vw,8rem)] h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${((track.playCount ?? 0) / maxPlays) * 100}%` }}
                    />
                  </div>
                  <span className="text-[clamp(0.875rem,1.3vw,1.25rem)] font-mono font-bold w-[clamp(2rem,3vw,3.5rem)] text-right">
                    {track.playCount}
                  </span>
                </div>

                {/* Duration */}
                <span className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground w-14 text-right flex-shrink-0">
                  {formatDuration(track.duration)}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { addToQueue(makeTrackInfo(track)); toast.success('Added to queue'); }}
                    className="px-3 py-2 rounded-lg bg-secondary/70 text-foreground text-[clamp(0.65rem,0.9vw,0.8rem)] font-medium hover:bg-secondary transition-colors flex items-center gap-1"
                  >
                    <ListPlus className="w-3.5 h-3.5" /> Queue
                  </button>
                  <button
                    onClick={() => { playNext(makeTrackInfo(track)); toast.success('Playing next'); }}
                    className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-[clamp(0.65rem,0.9vw,0.8rem)] font-medium hover:bg-primary/30 transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3.5 h-3.5" /> Next
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
