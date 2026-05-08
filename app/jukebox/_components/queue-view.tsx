"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ListMusic, Play, Music2, Heart, ThumbsDown, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import PlexImage from './plex-image';
import { toast } from 'sonner';

interface QueueViewProps {
  onBack: () => void;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

export default function QueueView({ onBack }: QueueViewProps) {
  const { queue, currentTrack, playQueue, removeFromQueue, queueIndex } = usePlayer();
  const [heartedIds, setHeartedIds] = useState<Set<string>>(new Set());
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = (queue ?? []).map(t => t.id).filter(Boolean);
    if (ids.length === 0) return;
    // Fetch hearted
    fetch('/api/tracks/heart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackIds: ids }) })
      .then(r => r?.json?.())
      .then(d => setHeartedIds(new Set(d?.heartedIds ?? [])))
      .catch(() => {});
    // Fetch banned
    fetch('/api/tracks/ban', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackIds: ids }) })
      .then(r => r?.json?.())
      .then(d => setBannedIds(new Set(d?.bannedIds ?? [])))
      .catch(() => {});
  }, [queue]);

  const toggleHeart = async (trackId: string) => {
    try {
      const res = await fetch('/api/tracks/heart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId }) });
      const data = await res?.json?.();
      setHeartedIds(prev => {
        const next = new Set(prev);
        if (data?.hearted) next.add(trackId); else next.delete(trackId);
        return next;
      });
    } catch {}
  };

  const toggleBan = async (trackId: string, trackTitle: string, queueIdx: number) => {
    try {
      const res = await fetch('/api/tracks/ban', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId }) });
      const data = await res?.json?.();
      setBannedIds(prev => {
        const next = new Set(prev);
        if (data?.banned) next.add(trackId); else next.delete(trackId);
        return next;
      });
      if (data?.banned) {
        toast.success(`Banned "${trackTitle}"`);
        // Also remove from queue
        removeFromQueue(queueIdx);
      } else {
        toast.success(`Unbanned "${trackTitle}"`);
      }
    } catch {}
  };

  const handleRemove = (index: number, trackTitle: string) => {
    removeFromQueue(index);
    toast.success(`Removed "${trackTitle}" from queue`);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
          <ListMusic className="w-6 h-6 text-primary" />
          Queue
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{queue?.length ?? 0} tracks</p>
      </div>

      {(queue?.length ?? 0) === 0 ? (
        <div className="text-center py-16">
          <Music2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-1">
          {(queue ?? [])?.map?.((track: TrackInfo, i: number) => {
            const isCurrent = track?.id === currentTrack?.id;
            return (
              <motion.div
                key={`${track?.id ?? ''}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors group ${
                  isCurrent ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary/70'
                }`}
              >
                <span className="w-6 text-center text-sm text-muted-foreground">
                  {isCurrent ? (
                    <div className="w-4 h-4 mx-auto">
                      <div className="flex items-end gap-0.5 h-4">
                        <div className="w-1 bg-primary rounded-full animate-pulse" style={{ height: '60%' }} />
                        <div className="w-1 bg-primary rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.2s' }} />
                        <div className="w-1 bg-primary rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.4s' }} />
                      </div>
                    </div>
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                  <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={100} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm truncate ${isCurrent ? 'text-primary' : ''}`}>
                    {track?.title ?? ''}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {track?.artistName ?? ''} • {track?.albumTitle ?? ''}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleHeart(track?.id); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  title={heartedIds.has(track?.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`w-4 h-4 ${heartedIds.has(track?.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                </button>
                {!isCurrent && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBan(track?.id, track?.title ?? '', i); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 hover:bg-red-500/20"
                    title="Ban this song"
                  >
                    <ThumbsDown className={`w-4 h-4 ${bannedIds.has(track?.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                  </button>
                )}
                {!isCurrent && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(i, track?.title ?? ''); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0 hover:bg-red-500/20"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
                <span className="text-xs text-muted-foreground">{formatDuration(track?.duration)}</span>
                {!isCurrent && (
                  <button
                    onClick={() => playQueue(queue, i)}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                  </button>
                )}
              </motion.div>
            );
          }) ?? null}
        </div>
      )}
    </div>
  );
}
