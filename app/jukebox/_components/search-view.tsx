"use client";

import React, { useState, useCallback } from 'react';
import { Search, Loader2, Music2, Disc, Users, Play, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';
import { toast } from 'sonner';

interface SearchViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
}

export default function SearchView({ onNavigate }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { playTrack, addToQueue } = usePlayer();

  const handleSearch = useCallback(async (q: string) => {
    if ((q?.length ?? 0) < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res?.json?.();
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e?.target?.value ?? '';
    setQuery(val);
    const timer = setTimeout(() => handleSearch(val), 300);
    return () => clearTimeout(timer);
  };

  const handlePlayTrack = (track: any) => {
    const t: TrackInfo = {
      id: track?.id ?? '',
      title: track?.title ?? '',
      artistName: track?.artist?.name ?? track?.artistName ?? '',
      albumTitle: track?.album?.title ?? track?.albumTitle ?? '',
      thumb: track?.thumb ?? track?.album?.thumb ?? null,
      mediaKey: track?.mediaKey ?? null,
      duration: track?.duration ?? null,
      ratingKey: track?.ratingKey ?? '',
    };
    playTrack(t);
  };

  const handleAddToQueue = (track: any) => {
    const t: TrackInfo = {
      id: track?.id ?? '',
      title: track?.title ?? '',
      artistName: track?.artist?.name ?? track?.artistName ?? '',
      albumTitle: track?.album?.title ?? track?.albumTitle ?? '',
      thumb: track?.thumb ?? track?.album?.thumb ?? null,
      mediaKey: track?.mediaKey ?? null,
      duration: track?.duration ?? null,
      ratingKey: track?.ratingKey ?? '',
    };
    addToQueue(t);
    toast.success('Added to queue');
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
          <Search className="w-6 h-6 text-primary" />
          Search
        </h2>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={onQueryChange}
          placeholder="Search for songs, artists, or albums..."
          className="w-full pl-12 pr-4 py-4 rounded-xl bg-secondary/70 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-primary" />
        )}
      </div>

      {results && (
        <div className="space-y-8">
          {/* Artists */}
          {(results?.artists?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Artists
              </h3>
              <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2">
                {(results?.artists ?? [])?.map?.((artist: any) => (
                  <button
                    key={artist?.id ?? ''}
                    onClick={() => onNavigate?.('artist-detail', { artistId: artist?.id })}
                    className="flex-shrink-0 w-28 text-center group"
                  >
                    <div className="w-28 h-28 rounded-full overflow-hidden bg-secondary mb-2 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                      <PlexImage thumb={artist?.thumb} alt={artist?.name ?? ''} size={200} />
                    </div>
                    <p className="text-sm font-medium truncate">{artist?.name ?? ''}</p>
                  </button>
                )) ?? null}
              </div>
            </div>
          )}

          {/* Albums */}
          {(results?.albums?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Disc className="w-4 h-4" /> Albums
              </h3>
              <div className="flex gap-4 overflow-x-auto scrollbar-none pb-2">
                {(results?.albums ?? [])?.map?.((album: any) => (
                  <button
                    key={album?.id ?? ''}
                    onClick={() => onNavigate?.('album-detail', { albumId: album?.id })}
                    className="flex-shrink-0 w-36 text-left group"
                  >
                    <div className="w-36 h-36 rounded-lg overflow-hidden bg-secondary mb-2 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                      <PlexImage thumb={album?.thumb} alt={album?.title ?? ''} size={300} />
                    </div>
                    <p className="text-sm font-medium truncate">{album?.title ?? ''}</p>
                    <p className="text-xs text-muted-foreground truncate">{album?.artist?.name ?? ''}</p>
                  </button>
                )) ?? null}
              </div>
            </div>
          )}

          {/* Tracks */}
          {(results?.tracks?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Music2 className="w-4 h-4" /> Songs
              </h3>
              <div className="space-y-1">
                {(results?.tracks ?? [])?.map?.((track: any, i: number) => (
                  <motion.div
                    key={track?.id ?? i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/70 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                      <PlexImage thumb={track?.thumb ?? track?.album?.thumb} alt={track?.title ?? ''} size={100} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{track?.title ?? ''}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track?.artist?.name ?? ''} • {track?.album?.title ?? ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleAddToQueue(track)}
                        className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePlayTrack(track)}
                        className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90"
                      >
                        <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                      </button>
                    </div>
                  </motion.div>
                )) ?? null}
              </div>
            </div>
          )}

          {/* No results */}
          {(results?.artists?.length ?? 0) === 0 && (results?.albums?.length ?? 0) === 0 && (results?.tracks?.length ?? 0) === 0 && (
            <div className="text-center py-12">
              <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No results found</p>
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Type to search your music library</p>
        </div>
      )}
    </div>
  );
}
