"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';

interface ArtistsViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
  artistRows?: number;
}

export default function ArtistsView({ onNavigate, artistRows = 4 }: ArtistsViewProps) {
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [itemSize, setItemSize] = useState(140);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [artists]);

  const scrollNav = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -(itemSize + 12) * 3 : (itemSize + 12) * 3, behavior: 'smooth' });
  };

  // Calculate item size based on available height and rows
  useEffect(() => {
    const calcSize = () => {
      const container = containerRef.current;
      if (!container) return;
      // Available height for the grid (subtract search bar ~60px, header ~50px, gaps)
      const available = container.clientHeight;
      const gapSize = 12; // gap between rows
      const labelHeight = 40; // text below each circle
      const totalGaps = (artistRows - 1) * gapSize;
      const perRow = Math.max(80, Math.floor((available - totalGaps) / artistRows) - labelHeight);
      setItemSize(Math.min(200, perRow));
    };
    calcSize();
    const ro = new ResizeObserver(calcSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [artistRows]);

  const fetchArtists = useCallback(async (pageNum: number, searchStr: string, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '100',
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

  // Infinite scroll via IntersectionObserver
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
      { root: scrollRef.current, rootMargin: '400px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, search, fetchArtists]);

  // Chunk artists into columns of `artistRows` items for the grid
  const columns: any[][] = [];
  for (let i = 0; i < artists.length; i += artistRows) {
    columns.push(artists.slice(i, i + artistRows));
  }

  return (
    <div className="px-4 py-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <h2 className="text-[clamp(1.25rem,2.5vw,2rem)] font-display font-bold tracking-tight flex items-center gap-3">
            <Users className="w-[clamp(1.25rem,2vw,1.75rem)] h-[clamp(1.25rem,2vw,1.75rem)] text-primary" />
            Artists
          </h2>
          <p className="text-muted-foreground text-[clamp(0.75rem,1.2vw,1rem)] mt-1">{total} artists in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollNav('left')}
            disabled={!canScrollLeft}
            className="w-10 h-10 rounded-full bg-secondary/70 flex items-center justify-center disabled:opacity-20 hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scrollNav('right')}
            disabled={!canScrollRight}
            className="w-10 h-10 rounded-full bg-secondary/70 flex items-center justify-center disabled:opacity-20 hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3 flex-shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e?.target?.value ?? '')}
          placeholder="Search artists..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-secondary/70 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-[clamp(0.875rem,1.3vw,1.125rem)]"
        />
      </div>

      {loading && artists.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div
          ref={(el) => {
            (scrollRef as any).current = el;
            (containerRef as any).current = el;
          }}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-none min-h-0"
        >
          <div className="flex gap-3 h-full items-center">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-3 flex-shrink-0" style={{ width: itemSize }}>
                {col.map((artist: any, i: number) => (
                  <motion.button
                    key={artist?.id ?? `${ci}-${i}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(ci * 0.02, 0.3) }}
                    onClick={() => onNavigate?.('artist-detail', { artistId: artist?.id })}
                    className="group text-center flex-shrink-0"
                  >
                    <div
                      className="relative rounded-full overflow-hidden bg-secondary mb-1 mx-auto group-hover:ring-2 group-hover:ring-primary/50 transition-all"
                      style={{ width: itemSize, height: itemSize }}
                    >
                      <PlexImage thumb={artist?.thumb} alt={artist?.name ?? 'Artist'} />
                    </div>
                    <h4 className="font-medium text-[clamp(0.7rem,1vw,0.875rem)] text-foreground truncate px-1">{artist?.name ?? 'Unknown'}</h4>
                    <p className="text-[clamp(0.6rem,0.8vw,0.75rem)] text-muted-foreground">
                      {artist?._count?.cachedAlbums ?? 0} albums
                    </p>
                  </motion.button>
                ))}
              </div>
            ))}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="flex-shrink-0 w-4 h-full" />
            {loadingMore && (
              <div className="flex-shrink-0 flex items-center justify-center w-[100px]">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
