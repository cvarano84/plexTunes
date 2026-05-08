"use client";

import React, { useState, useEffect } from 'react';
import { ThumbsDown, Music2, Loader2, Undo2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PlexImage from './plex-image';
import { toast } from 'sonner';

interface BannedTrack {
  id: string;
  title: string;
  artistName: string | null;
  albumTitle: string | null;
  thumb: string | null;
  duration: number | null;
  artist?: { name: string; thumb: string | null };
  album?: { title: string; thumb: string | null; year: number | null };
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

export default function BannedView() {
  const [tracks, setTracks] = useState<BannedTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBanned = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tracks/ban');
      const data = await res?.json?.();
      setTracks(data?.tracks ?? []);
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBanned(); }, []);

  const unban = async (trackId: string, title: string) => {
    try {
      const res = await fetch('/api/tracks/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      });
      const data = await res?.json?.();
      if (!data?.banned) {
        setTracks(prev => prev.filter(t => t.id !== trackId));
        toast.success(`Unbanned "${title}"`);
      }
    } catch {}
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
          <ThumbsDown className="w-6 h-6 text-red-500" />
          Banned Songs
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {loading ? 'Loading...' : `${tracks.length} banned track${tracks.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-16">
          <Music2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No banned songs</p>
          <p className="text-muted-foreground text-sm mt-1">Songs you ban will appear here so you can undo later</p>
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {tracks.map((track) => (
              <motion.div
                key={track.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/70 transition-colors group"
              >
                <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                  <PlexImage thumb={track?.thumb ?? track?.album?.thumb} alt={track?.title ?? ''} size={100} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{track?.title ?? ''}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track?.artist?.name ?? track?.artistName ?? ''} • {track?.album?.title ?? track?.albumTitle ?? ''}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDuration(track?.duration)}</span>
                <button
                  onClick={() => unban(track.id, track.title)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                  title="Unban this song"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Unban
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
