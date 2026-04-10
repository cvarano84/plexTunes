"use client";

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Plus, Loader2, Disc, Music2, Star, ListPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';
import { toast } from 'sonner';

interface ArtistDetailViewProps {
  artistId: string;
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

export default function ArtistDetailView({ artistId, onNavigate, onBack }: ArtistDetailViewProps) {
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const { playQueue, addToQueue, playNext } = usePlayer();

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    const popular = showAllTracks ? 'false' : 'true';
    fetch(`/api/artists/${artistId}?popular=${popular}`)
      .then(r => r?.json?.())
      .then(data => {
        setArtist(data?.artist ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [artistId, showAllTracks]);

  const makeTrackInfo = (t: any): TrackInfo => ({
    id: t?.id ?? '',
    title: t?.title ?? '',
    artistName: artist?.name ?? '',
    albumTitle: t?.albumTitle ?? '',
    thumb: t?.thumb ?? null,
    mediaKey: t?.mediaKey ?? null,
    duration: t?.duration ?? null,
    ratingKey: t?.ratingKey ?? '',
    year: t?.year ?? null,
  });

  const handlePlayAll = () => {
    const tracks = (artist?.cachedTracks ?? [])?.map?.(makeTrackInfo) ?? [];
    if (tracks?.length > 0) {
      playQueue(tracks);
      toast.success(`Playing ${artist?.name ?? 'Artist'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Artist not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      {/* Artist header */}
      <div className="flex items-center gap-6 mb-8">
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-secondary flex-shrink-0 album-art-glow">
          <PlexImage thumb={artist?.thumb} alt={artist?.name ?? ''} size={400} />
        </div>
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight">{artist?.name ?? ''}</h2>
          <p className="text-muted-foreground mt-1">
            {artist?.cachedAlbums?.length ?? 0} albums • {artist?.cachedTracks?.length ?? 0} tracks
          </p>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Play className="w-4 h-4 ml-0.5" /> Play All
            </button>
            <button
              onClick={() => setShowAllTracks(!showAllTracks)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                showAllTracks
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <Star className="w-4 h-4" /> {showAllTracks ? 'All Tracks' : 'Popular'}
            </button>
          </div>
        </div>
      </div>

      {/* Albums */}
      {(artist?.cachedAlbums?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
            <Disc className="w-5 h-5 text-primary" /> Albums
          </h3>
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2">
            {(artist?.cachedAlbums ?? [])?.map?.((album: any) => (
              <button
                key={album?.id ?? ''}
                onClick={() => onNavigate?.('album-detail', { albumId: album?.id })}
                className="flex-shrink-0 w-36 text-left group"
              >
                <div className="w-36 h-36 rounded-lg overflow-hidden bg-secondary mb-2 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                  <PlexImage thumb={album?.thumb} alt={album?.title ?? ''} size={300} />
                </div>
                <p className="text-sm font-medium truncate">{album?.title ?? ''}</p>
                <p className="text-xs text-muted-foreground">{album?.year ?? ''}</p>
              </button>
            )) ?? null}
          </div>
        </div>
      )}

      {/* Tracks */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
          <Music2 className="w-5 h-5 text-primary" />
          {showAllTracks ? 'All Tracks' : 'Popular Tracks'}
        </h3>
        <div className="space-y-1">
          {(artist?.cachedTracks ?? [])?.map?.((track: any, i: number) => (
            <motion.div
              key={track?.id ?? i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/70 transition-colors group"
            >
              <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
              <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={100} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{track?.title ?? ''}</p>
                <p className="text-xs text-muted-foreground truncate">{track?.albumTitle ?? ''}</p>
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
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => { addToQueue(makeTrackInfo(track)); toast.success('Added to queue'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 active:bg-primary active:text-primary-foreground transition-colors"
                >
                  <ListPlus className="w-4 h-4" />
                  Queue
                </button>
                <button
                  onClick={() => { playNext(makeTrackInfo(track)); toast.success('Playing next'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:bg-accent transition-colors"
                >
                  <Play className="w-4 h-4 ml-0.5" />
                  Next
                </button>
              </div>
            </motion.div>
          )) ?? null}
        </div>
      </div>
    </div>
  );
}
