"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';

interface ArtistsViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
}

export default function ArtistsView({ onNavigate }: ArtistsViewProps) {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchArtists = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page?.toString?.() ?? '1',
        limit: '36',
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/artists?${params}`);
      const data = await res?.json?.();
      setArtists(data?.artists ?? []);
      setTotalPages(data?.totalPages ?? 1);
      setTotal(data?.total ?? 0);
    } catch {
      setArtists([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchArtists, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchArtists, search]);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            Artists
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{total} artists in your library</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e?.target?.value ?? '')}
          placeholder="Search artists..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-secondary/70 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(artists ?? [])?.map?.((artist: any, i: number) => (
              <motion.button
                key={artist?.id ?? i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => onNavigate?.('artist-detail', { artistId: artist?.id })}
                className="group text-center"
              >
                <div className="relative aspect-square rounded-full overflow-hidden bg-secondary mb-3 mx-auto w-full max-w-[160px] group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                  <PlexImage thumb={artist?.thumb} alt={artist?.name ?? 'Artist'} />
                </div>
                <h4 className="font-medium text-sm text-foreground truncate px-1">{artist?.name ?? 'Unknown'}</h4>
                <p className="text-xs text-muted-foreground">
                  {artist?._count?.cachedAlbums ?? 0} albums
                </p>
              </motion.button>
            )) ?? null}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-secondary text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
