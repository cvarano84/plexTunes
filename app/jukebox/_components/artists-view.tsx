"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Search, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';

interface ArtistsViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
}

export default function ArtistsView({ onNavigate }: ArtistsViewProps) {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchArtists = useCallback(async (pageNum: number, searchStr: string, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '50',
        ...(searchStr ? { search: searchStr } : {}),
      });
      const res = await fetch(`/api/artists?${params}`);
      const data = await res?.json?.();
      const newArtists = data?.artists ?? [];
      const totalPages = data?.totalPages ?? 1;
      setTotal(data?.total ?? 0);
      setHasMore(pageNum < totalPages);
      if (append) {
        setArtists(prev => [...prev, ...newArtists]);
      } else {
        setArtists(newArtists);
      }
    } catch {
      if (!append) setArtists([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load and search changes
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchArtists(1, search, false);
    }, search ? 300 : 0);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, fetchArtists]);

  // Infinite scroll via IntersectionObserver on a sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchArtists(nextPage, search, true);
        }
      },
      { root: scrollRef.current, rootMargin: '200px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, search, fetchArtists]);

  return (
    <div className="px-4 py-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            Artists
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{total} artists in your library</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e?.target?.value ?? '')}
          placeholder="Search artists..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-secondary/70 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
        />
      </div>

      {loading && artists.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-none"
        >
          <div className="flex gap-4 items-start h-full pb-2">
            {(artists ?? []).map((artist: any, i: number) => (
              <motion.button
                key={artist?.id ?? i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.3) }}
                onClick={() => onNavigate?.('artist-detail', { artistId: artist?.id })}
                className="group text-center flex-shrink-0 w-[140px]"
              >
                <div className="relative w-[140px] h-[140px] rounded-full overflow-hidden bg-secondary mb-2 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
                  <PlexImage thumb={artist?.thumb} alt={artist?.name ?? 'Artist'} />
                </div>
                <h4 className="font-medium text-sm text-foreground truncate px-1">{artist?.name ?? 'Unknown'}</h4>
                <p className="text-xs text-muted-foreground">
                  {artist?._count?.cachedAlbums ?? 0} albums
                </p>
              </motion.button>
            ))}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="flex-shrink-0 w-4 h-full" />
            {loadingMore && (
              <div className="flex-shrink-0 flex items-center justify-center w-[140px]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
