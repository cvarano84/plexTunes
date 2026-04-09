"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Plus, Loader2, Music2, Star, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';
import { toast } from 'sonner';

interface AlbumDetailViewProps {
  albumId: string;
  onNavigate: (view: ViewType, opts?: any) => void;
  onBack: () => void;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

export default function AlbumDetailView({ albumId, onNavigate, onBack }: AlbumDetailViewProps) {
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { playTrack, playQueue, addToQueue } = usePlayer();

  useEffect(() => {
    if (!albumId) return;
    setLoading(true);
    fetch(`/api/albums/${albumId}`)
      .then(r => r?.json?.())
      .then(data => {
        setAlbum(data?.album ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [albumId]);

  const makeTrackInfo = (t: any): TrackInfo => ({
    id: t?.id ?? '',
    title: t?.title ?? '',
    artistName: album?.artist?.name ?? '',
    albumTitle: album?.title ?? '',
    thumb: t?.thumb ?? album?.thumb ?? null,
    mediaKey: t?.mediaKey ?? null,
    duration: t?.duration ?? null,
    ratingKey: t?.ratingKey ?? '',
  });

  const handlePlayAll = () => {
    const tracks = (album?.cachedTracks ?? [])?.map?.(makeTrackInfo) ?? [];
    if (tracks?.length > 0) {
      playQueue(tracks);
      toast.success(`Playing ${album?.title ?? 'Album'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Album not found</p>
      </div>
    );
  }

  const totalDuration = (album?.cachedTracks ?? [])?.reduce?.((acc: number, t: any) => acc + (t?.duration ?? 0), 0) ?? 0;

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      {/* Album header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden bg-secondary flex-shrink-0 album-art-glow">
          <PlexImage thumb={album?.thumb} alt={album?.title ?? ''} size={600} />
        </div>
        <div className="pt-2">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Album</p>
          <h2 className="text-3xl font-display font-bold tracking-tight mt-1">{album?.title ?? ''}</h2>
          <button
            onClick={() => onNavigate?.('artist-detail', { artistId: album?.artistId })}
            className="text-primary hover:underline mt-1 text-lg"
          >
            {album?.artist?.name ?? ''}
          </button>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            {album?.year && <span>{album.year}</span>}
            <span>•</span>
            <span>{album?.cachedTracks?.length ?? 0} tracks</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(totalDuration)}
            </span>
          </div>
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors mt-4"
          >
            <Play className="w-4 h-4 ml-0.5" /> Play Album
          </button>
        </div>
      </div>

      {/* Track list */}
      <div className="space-y-1">
        {(album?.cachedTracks ?? [])?.map?.((track: any, i: number) => (
          <motion.div
            key={track?.id ?? i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/70 transition-colors group"
          >
            <span className="w-6 text-center text-sm text-muted-foreground">
              {track?.trackNumber ?? i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{track?.title ?? ''}</p>
            </div>
            {(track?.popularity ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3 text-amber-400" />
                {track?.popularity}
              </div>
            )}
            <span className="text-xs text-muted-foreground w-12 text-right">
              {formatDuration(track?.duration)}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { addToQueue(makeTrackInfo(track)); toast.success('Added to queue'); }}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => playTrack(makeTrackInfo(track))}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90"
              >
                <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
              </button>
            </div>
          </motion.div>
        )) ?? null}
      </div>
    </div>
  );
}
