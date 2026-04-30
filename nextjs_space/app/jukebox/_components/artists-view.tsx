"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';

interface ArtistsViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
  artistRows?: number;
  fillPct?: number;
}

const LETTERS = ['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export default function ArtistsView({ onNavigate, artistRows = 4, fillPct = 70 }: ArtistsViewProps) {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState('All');
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

  useEffect(() => {
    const calcSize = () => {
      // Use scrollRef (the flex-1 grid area) for actual available height
      const el = scrollRef.current;
      if (!el) return;
      const available = el.clientHeight;
      if (available < 10) return; // not laid out yet
      const gapSize = 12;
      const labelHeight = 28; // artist name + album count text
      const totalGaps = (artistRows - 1) * gapSize;
      const perRow = Math.max(80, Math.floor(((available - totalGaps) * (fillPct / 100) / artistRows) - labelHeight));
      setItemSize(perRow);
    };
    calcSize();
    // Observe both — outer for panel resize, inner for layout completion
    const ro = new ResizeObserver(calcSize);
    if (containerRef.current) ro.observe(containerRef.current);
    if (scrollRef.current) ro.observe(scrollRef.current);
    return () => ro.disconnect();
  }, [artistRows, artists.length, fillPct]);

  const allArtistsRef = useRef<any[]>([]);
  const initialLoadDone = useRef(false);

  const fetchArtists = useCallback(async (searchStr: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: searchStr ? '100' : '5000',
      });
      if (searchStr) {
        params.set('search', searchStr);
      }
      const res = await fetch(`/api/artists?${params}`);
      const data = await res?.json?.();
      const newArtists = data?.artists ?? [];
      setTotal(data?.total ?? 0);
      setHasMore(false);
      setArtists(newArtists);
      if (!searchStr) {
        allArtistsRef.current = newArtists;
      }
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    } catch {
      setArtists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load - all artists
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchArtists('');
    }
  }, [fetchArtists]);

  // Search changes trigger re-fetch
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (search) {
      searchTimerRef.current = setTimeout(() => {
        fetchArtists(search);
      }, 300);
    } else {
      // Restore full list from ref
      if (allArtistsRef.current.length > 0) {
        setArtists(allArtistsRef.current);
        setTotal(allArtistsRef.current.length);
      }
    }
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, fetchArtists]);

  const handleLetterTap = (letter: string) => {
    setActiveLetter(letter);
    if (letter === 'All') {
      setSearch('');
      if (scrollRef.current) scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    setSearch('');
    // Use the full artist list to find the position
    const list = allArtistsRef.current.length > 0 ? allArtistsRef.current : artists;
    const idx = list.findIndex(a => (a?.name ?? '').toUpperCase().startsWith(letter));
    if (idx >= 0 && scrollRef.current) {
      const colIdx = Math.floor(idx / artistRows);
      const scrollTarget = colIdx * (itemSize + 12); // item width + gap
      scrollRef.current.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setActiveLetter('All');
  };

  const columns: any[][] = [];
  for (let i = 0; i < artists.length; i += artistRows) {
    columns.push(artists.slice(i, i + artistRows));
  }

  return (
    <div ref={containerRef} className="px-4 py-4 h-full flex flex-col">
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
            className="w-10 h-10 rounded-full bg-secondary/70 flex items-center justify-center disabled:opacity-20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scrollNav('right')}
            disabled={!canScrollRight}
            className="w-10 h-10 rounded-full bg-secondary/70 flex items-center justify-center disabled:opacity-20 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-2 flex-shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e?.target?.value ?? '')}
          placeholder="Search artists..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-secondary/70 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-[clamp(0.875rem,1.3vw,1.125rem)]"
        />
      </div>

      {/* Alphabet quick-jump - auto scales to full width */}
      <div className="flex items-center mb-2 flex-shrink-0 w-full">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            onClick={() => handleLetterTap(letter)}
            className={`flex-1 min-w-0 h-[clamp(1.75rem,2.2vw,2.5rem)] rounded-md flex items-center justify-center text-[clamp(0.55rem,0.85vw,0.75rem)] font-bold transition-colors ${
              activeLetter === letter
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground active:bg-primary/60 active:text-foreground'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>

      {loading && artists.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div
          ref={scrollRef}
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
                      className="relative rounded-full overflow-hidden bg-secondary mb-1 mx-auto transition-all"
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
            <div className="flex-shrink-0 w-4 h-full" />
          </div>
        </div>
      )}
    </div>
  );
}