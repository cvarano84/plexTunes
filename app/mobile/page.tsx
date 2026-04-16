"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Music2, Search, ListMusic, Mic2, Loader2, Plus, ChevronLeft, Users, BarChart3, Disc, AlertCircle } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────── */
interface QueueItem {
  id: string;
  title: string;
  artistName: string;
  thumb: string | null;
  albumTitle: string;
  duration: number | null;
}

interface NowPlayingData {
  currentTrack: { id: string; title: string; artistName: string; albumTitle: string; thumb: string | null; duration: number | null; mediaKey?: string | null; ratingKey?: string } | null;
  isPlaying: boolean;
  currentTime: number;
  publishedAt: number;
  queue: QueueItem[];
  queueIndex: number;
  currentStationName: string | null;
  jukeboxTitle: string;
  previousTrackCount: number;
  stationQueueSize: number;
}

interface TimedLine { time: number; text: string; }

/* ─── Helpers ────────────────────────────────────────────────── */
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseLRC(lrc: string): TimedLine[] {
  const lines: TimedLine[] = [];
  for (const raw of lrc.split('\n')) {
    const match = raw.match(/^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
      const time = mins * 60 + secs + ms / 1000;
      const text = match[4]?.trim() ?? '';
      if (text.length > 0) lines.push({ time, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/* ─── PlexImg ────────────────────────────────────────────────── */
function PlexImg({ thumb, alt, size = 100 }: { thumb: string | null; alt: string; size?: number }) {
  if (!thumb) return <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Music2 className="w-6 h-6 text-zinc-600" /></div>;
  const src = `/api/plex/image?thumb=${encodeURIComponent(thumb)}&w=${size}&h=${size}`;
  return <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />;
}

/* ─── Synced Lyrics Component ────────────────────────────────── */
function MobileSyncedLyrics({ lyrics, syncedLyrics, currentTime, duration }: {
  lyrics: string | null;
  syncedLyrics: string | null;
  currentTime: number;
  duration: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const lastScrollTime = useRef(0);

  const timedLines = useMemo<TimedLine[]>(() => {
    if (syncedLyrics) {
      const parsed = parseLRC(syncedLyrics);
      if (parsed.length > 0) return parsed;
    }
    if (lyrics) {
      const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0 && duration > 0) {
        const interval = duration / lines.length;
        return lines.map((text, i) => ({ time: i * interval, text }));
      }
      return lines.map((text, i) => ({ time: i, text }));
    }
    return [];
  }, [syncedLyrics, lyrics, duration]);

  useEffect(() => {
    lineRefs.current = new Array(timedLines.length).fill(null);
  }, [timedLines.length]);

  useEffect(() => {
    if (timedLines.length === 0) { setActiveLineIdx(0); return; }
    let idx = 0;
    for (let i = timedLines.length - 1; i >= 0; i--) {
      if (currentTime >= timedLines[i].time) { idx = i; break; }
    }
    setActiveLineIdx(idx);
  }, [currentTime, timedLines]);

  useEffect(() => {
    const container = containerRef.current;
    const activeLine = lineRefs.current[activeLineIdx];
    if (!container || !activeLine) return;
    const now = Date.now();
    if (now - lastScrollTime.current < 400) return;
    lastScrollTime.current = now;
    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const containerCenter = containerRect.height / 2;
    const lineCenter = lineRect.top - containerRect.top + lineRect.height / 2;
    const scrollOffset = lineCenter - containerCenter;
    container.scrollBy({ top: scrollOffset, behavior: 'smooth' });
  }, [activeLineIdx]);

  if (timedLines.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        <Mic2 className="w-5 h-5 mr-2" /> No lyrics available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="max-h-[40vh] overflow-y-auto px-3 py-4"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        scrollbarWidth: 'none',
      }}
    >
      <div style={{ height: '30%' }} />
      <div className="text-center flex flex-col gap-2">
        {timedLines.map((line, i) => {
          const isActive = i === activeLineIdx;
          const distance = Math.abs(i - activeLineIdx);
          const opacity = isActive ? 1 : Math.max(0.2, 1 - distance * 0.18);
          return (
            <p
              key={`${i}-${line.text.slice(0, 10)}`}
              ref={(el) => { lineRefs.current[i] = el; }}
              className="transition-all duration-500 ease-out text-sm leading-relaxed"
              style={{
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#ffffff' : '#a1a1aa',
                opacity,
                fontSize: isActive ? '0.95rem' : '0.85rem',
              }}
            >
              {line.text}
            </p>
          );
        })}
      </div>
      <div style={{ height: '30%' }} />
    </div>
  );
}

/* ─── Main Mobile Page ───────────────────────────────────────── */
export default function MobilePage() {
  const [tab, setTab] = useState<'playing' | 'artists' | 'search' | 'top-played'>('playing');
  const [npData, setNpData] = useState<NowPlayingData | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Lyrics state
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // Add tracking
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const lastAddedIdRef = useRef<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const lastTrackIdRef = useRef<string>('');

  // Artist browse state
  const [artistBrowse, setArtistBrowse] = useState<'list' | 'artist-detail' | 'album-detail'>('list');
  const [artists, setArtists] = useState<any[]>([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [artistLetter, setArtistLetter] = useState<string | null>(null);
  const [artistPage, setArtistPage] = useState(1);
  const [artistTotalPages, setArtistTotalPages] = useState(1);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [artistDetailLoading, setArtistDetailLoading] = useState(false);
  const [albumDetailLoading, setAlbumDetailLoading] = useState(false);

  // Top played state
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [topLoading, setTopLoading] = useState(false);
  const [topPeriod, setTopPeriod] = useState('all');

  // Computed synced time (accounts for network delay)
  const estimatedTime = useMemo(() => {
    if (!npData) return 0;
    if (!npData.isPlaying) return npData.currentTime;
    const elapsed = (Date.now() - (npData.publishedAt || Date.now())) / 1000;
    return npData.currentTime + elapsed;
  }, [npData]);

  // Re-render every second for lyrics sync
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!showLyrics || !npData?.isPlaying) return;
    const iv = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(iv);
  }, [showLyrics, npData?.isPlaying]);

  const liveTime = useMemo(() => {
    if (!npData) return 0;
    if (!npData.isPlaying) return npData.currentTime;
    const elapsed = (Date.now() - (npData.publishedAt || Date.now())) / 1000;
    return npData.currentTime + elapsed;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npData, npData?.isPlaying, npData?.currentTime, npData?.publishedAt]);

  /* ─── Poll for now-playing state ─── */
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/remote/state');
      const data = await res?.json?.();
      if (data?.state) setNpData(data.state);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchState();
    pollRef.current = setInterval(fetchState, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchState]);

  /* ─── Fetch lyrics when track changes ─── */
  useEffect(() => {
    const track = npData?.currentTrack;
    if (!track?.title || !track?.artistName) { setLyrics(null); setSyncedLyrics(null); return; }
    const trackKey = `${track.title}|${track.artistName}`;
    if (trackKey === lastTrackIdRef.current) return;
    lastTrackIdRef.current = trackKey;
    setLyricsLoading(true);
    setLyrics(null);
    setSyncedLyrics(null);
    fetch(`/api/lyrics?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artistName)}&album=${encodeURIComponent(track.albumTitle || '')}&duration=${track.duration ? Math.floor(track.duration / 1000) : ''}`)
      .then(r => r?.json?.())
      .then(data => {
        setSyncedLyrics(data?.syncedLyrics ?? null);
        setLyrics(data?.lyrics ?? null);
        setLyricsLoading(false);
      })
      .catch(() => setLyricsLoading(false));
  }, [npData?.currentTrack?.title, npData?.currentTrack?.artistName]);

  /* ─── Search ─── */
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res?.json?.();
      const flat: any[] = [];
      for (const a of (data?.artists ?? [])) flat.push({ ...a, type: 'artist', name: a.name });
      for (const a of (data?.albums ?? [])) flat.push({ ...a, type: 'album', artistName: a.artist?.name ?? '' });
      for (const t of (data?.tracks ?? [])) flat.push({ ...t, type: 'track', artistName: t.artist?.name ?? '', albumTitle: t.album?.title ?? '', thumb: t.thumb ?? t.album?.thumb ?? null });
      setSearchResults(flat);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (searchQuery.trim()) doSearch(searchQuery); }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  /* ─── Add to queue ─── */
  const addToQueue = async (track: any) => {
    const trackId = track.id ?? track.ratingKey ?? '';
    // Back-to-back duplicate check
    const queue = npData?.queue ?? [];
    const lastInQueue = queue.length > 0 ? queue[queue.length - 1] : null;
    if (lastInQueue?.id === trackId || lastAddedIdRef.current === trackId) {
      return { error: 'duplicate' };
    }

    try {
      const trackInfo = {
        id: trackId,
        title: track.title,
        artistName: track.artistName ?? track.artist?.name ?? '',
        albumTitle: track.albumTitle ?? track.album?.title ?? '',
        thumb: track.thumb ?? track.album?.thumb ?? null,
        mediaKey: track.mediaKey ?? null,
        duration: track.duration ?? null,
        ratingKey: track.ratingKey ?? '',
      };
      const res = await fetch('/api/remote/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'add_to_queue', track: trackInfo }),
      });
      const data = await res?.json?.();
      if (data?.duplicate) return { error: 'duplicate' };
      lastAddedIdRef.current = trackId;
      setAddedIds(prev => new Set(prev).add(trackId));
      return { ok: true };
    } catch { return { error: 'failed' }; }
  };

  /* ─── Artist browse ─── */
  const allMobileArtistsRef = useRef<any[]>([]);
  const artistListRef = useRef<HTMLDivElement>(null);

  const fetchArtists = useCallback(async (_letter: string | null, page: number) => {
    setArtistsLoading(true);
    try {
      // Load all artists for scroll support (letter tap scrolls, doesn't filter)
      const params = new URLSearchParams({ page: String(page), limit: '5000' });
      const res = await fetch(`/api/artists?${params}`);
      const data = await res?.json?.();
      const allArtists = data?.artists ?? [];
      setArtists(allArtists);
      allMobileArtistsRef.current = allArtists;
      setArtistTotalPages(1);
    } catch { setArtists([]); }
    setArtistsLoading(false);
  }, []);

  const fetchArtistDetail = useCallback(async (id: string) => {
    setArtistDetailLoading(true);
    try {
      const res = await fetch(`/api/artists/${id}`);
      const data = await res?.json?.();
      setSelectedArtist(data?.artist ?? data);
    } catch { setSelectedArtist(null); }
    setArtistDetailLoading(false);
  }, []);

  const fetchAlbumDetail = useCallback(async (id: string) => {
    setAlbumDetailLoading(true);
    try {
      const res = await fetch(`/api/albums/${id}`);
      const data = await res?.json?.();
      setSelectedAlbum(data?.album ?? data);
    } catch { setSelectedAlbum(null); }
    setAlbumDetailLoading(false);
  }, []);

  // Load artists on tab switch (load all once, letter tap just scrolls)
  useEffect(() => {
    if (tab === 'artists' && artistBrowse === 'list' && allMobileArtistsRef.current.length === 0) {
      fetchArtists(null, 1);
    }
  }, [tab, artistBrowse, fetchArtists]);

  // Load top played on tab switch
  useEffect(() => {
    if (tab === 'top-played') {
      setTopLoading(true);
      fetch(`/api/tracks/stats?period=${topPeriod}&limit=50`)
        .then(r => r?.json?.())
        .then(data => { setTopTracks(data?.tracks ?? []); setTopLoading(false); })
        .catch(() => { setTopTracks([]); setTopLoading(false); });
    }
  }, [tab, topPeriod]);

  const track = npData?.currentTrack;
  const jukeboxTitle = npData?.jukeboxTitle || 'Plex Jukebox Remote';
  const previousTrackCount = npData?.previousTrackCount ?? 3;
  const queueIndex = npData?.queueIndex ?? -1;
  const queue = npData?.queue ?? [];
  const upcomingTracks = queueIndex >= 0 ? queue.slice(queueIndex + 1) : [];
  const prevTracks = queueIndex > 0 ? queue.slice(Math.max(0, queueIndex - previousTrackCount), queueIndex) : [];

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  /* ─── Add button component ─── */
  const AddButton = ({ item, small }: { item: any; small?: boolean }) => {
    const [status, setStatus] = useState<'idle' | 'added' | 'duplicate'>('idle');
    const isAdded = addedIds.has(item.id);

    const handleAdd = async () => {
      const result = await addToQueue(item);
      if (result?.error === 'duplicate') {
        setStatus('duplicate');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setStatus('added');
      }
    };

    if (status === 'duplicate') {
      return <span className={`${small ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'} rounded-lg bg-amber-900/30 text-amber-400 whitespace-nowrap`}><AlertCircle className="w-3 h-3 inline mr-1" />Back-to-back</span>;
    }
    if (isAdded || status === 'added') {
      return <span className={`${small ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'} rounded-lg bg-green-900/30 text-green-400`}>Added ✓</span>;
    }
    return (
      <button
        onClick={handleAdd}
        className={`${small ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'} rounded-lg bg-purple-600 text-white active:bg-purple-700 transition-colors flex items-center gap-1 whitespace-nowrap`}
      >
        <Plus className="w-3 h-3" /> Queue
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <h1 className="text-lg font-bold tracking-tight">{jukeboxTitle}</h1>
        <p className="text-xs text-zinc-500">Add songs to the queue from your phone</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 flex-shrink-0 overflow-x-auto">
        {[
          { id: 'playing' as const, label: 'Now Playing', icon: Music2 },
          { id: 'artists' as const, label: 'Artists', icon: Users },
          { id: 'search' as const, label: 'Search', icon: Search },
          { id: 'top-played' as const, label: 'Top Played', icon: BarChart3 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'artists') setArtistBrowse('list'); }}
            className={`flex-1 flex items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors min-w-0 ${
              tab === t.id ? 'text-white border-b-2 border-purple-500' : 'text-zinc-500'
            }`}
          >
            <t.icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ════════ NOW PLAYING TAB ════════ */}
        {tab === 'playing' && (
          <div className="p-4">
            {track ? (
              <div className="space-y-3">
                {/* Album art */}
                <div className="aspect-square max-w-[240px] mx-auto rounded-xl overflow-hidden shadow-2xl">
                  <PlexImg thumb={track.thumb} alt={track.title} size={600} />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold truncate">{track.title}</p>
                  <p className="text-sm text-zinc-400 truncate">{track.artistName}</p>
                  <p className="text-xs text-zinc-500 truncate">{track.albumTitle}</p>
                  {npData?.currentStationName && (
                    <p className="text-xs text-purple-400 mt-1">Station: {npData.currentStationName}</p>
                  )}
                </div>
                {/* Progress */}
                <div className="space-y-1">
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${track.duration ? (liveTime / (track.duration / 1000)) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>{formatTime(liveTime)}</span>
                    <span>{formatTime((track.duration ?? 0) / 1000)}</span>
                  </div>
                </div>
                <p className={`text-xs text-center ${npData?.isPlaying ? 'text-green-400' : 'text-zinc-500'}`}>
                  {npData?.isPlaying ? 'Playing' : 'Paused'}
                </p>

                {/* Lyrics toggle */}
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 text-sm font-medium active:bg-zinc-700 transition-colors"
                >
                  <Mic2 className="w-4 h-4" />
                  {showLyrics ? 'Hide Lyrics' : 'Show Lyrics'}
                </button>
                {showLyrics && (
                  <div className="bg-zinc-900 rounded-lg">
                    {lyricsLoading ? (
                      <div className="flex items-center justify-center gap-2 text-zinc-500 py-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading lyrics...
                      </div>
                    ) : (
                      <MobileSyncedLyrics
                        lyrics={lyrics}
                        syncedLyrics={syncedLyrics}
                        currentTime={liveTime}
                        duration={(track.duration ?? 0) / 1000}
                      />
                    )}
                  </div>
                )}

                {/* Queue section */}
                <div className="mt-4 pt-3 border-t border-zinc-800">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-purple-400" /> Queue
                  </h3>

                  {/* Previously played */}
                  {prevTracks.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Previously Played</p>
                      {prevTracks.map((q, i) => (
                        <div key={`prev-${i}`} className="flex items-center gap-2 py-1.5 opacity-50">
                          <div className="w-7 h-7 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                            <PlexImg thumb={q.thumb} alt={q.title} size={60} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{q.title}</p>
                            <p className="text-[10px] text-zinc-600 truncate">{q.artistName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Current track indicator */}
                  {track && (
                    <div className="flex items-center gap-2 py-1.5 mb-1 bg-purple-500/10 rounded-lg px-2">
                      <div className="w-7 h-7 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                        <PlexImg thumb={track.thumb} alt={track.title} size={60} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-purple-300">{track.title}</p>
                        <p className="text-[10px] text-purple-400/70 truncate">{track.artistName}</p>
                      </div>
                      <span className="text-[9px] text-purple-400 font-medium">NOW</span>
                    </div>
                  )}

                  {/* Upcoming */}
                  {upcomingTracks.length > 0 ? (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Up Next</p>
                      {upcomingTracks.slice(0, 10).map((q, i) => (
                        <div key={`up-${i}`} className="flex items-center gap-2 py-1.5">
                          <span className="text-[10px] text-zinc-600 w-4 text-center">{i + 1}</span>
                          <div className="w-7 h-7 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                            <PlexImg thumb={q.thumb} alt={q.title} size={60} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{q.title}</p>
                            <p className="text-[10px] text-zinc-600 truncate">{q.artistName}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600 py-2">Queue is empty</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <Music2 className="w-12 h-12 mb-3" />
                <p className="text-sm">Nothing playing</p>
                <p className="text-xs mt-1">Waiting for playback to start on the jukebox...</p>
              </div>
            )}
          </div>
        )}

        {/* ════════ ARTISTS TAB ════════ */}
        {tab === 'artists' && (
          <div className="flex flex-col h-full">
            {artistBrowse === 'list' && (
              <div className="flex flex-col h-full">
                {/* A-Z quick jump - pinned to top */}
                <div className="flex flex-wrap gap-1 p-4 pb-2 flex-shrink-0 bg-black/95">
                  <button
                    onClick={() => {
                      setArtistLetter(null);
                      artistListRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      !artistLetter ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'
                    }`}
                  >All</button>
                  {LETTERS.map(l => (
                    <button
                      key={l}
                      onClick={() => {
                        setArtistLetter(l);
                        // Scroll to the first artist starting with this letter
                        const list = allMobileArtistsRef.current.length > 0 ? allMobileArtistsRef.current : artists;
                        const idx = list.findIndex((a: any) => (a?.name ?? '').toUpperCase().startsWith(l));
                        if (idx >= 0 && artistListRef.current) {
                          const items = artistListRef.current.querySelectorAll('[data-artist-idx]');
                          const targetEl = items[idx] as HTMLElement;
                          if (targetEl) {
                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }
                      }}
                      className={`w-7 h-7 rounded text-[10px] font-medium transition-colors flex items-center justify-center ${
                        artistLetter === l ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'
                      }`}
                    >{l}</button>
                  ))}
                </div>

                <div ref={artistListRef} className="flex-1 overflow-y-auto px-4 pb-4">
                  {artistsLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
                  ) : artists.length > 0 ? (
                    <div className="space-y-1">
                      {artists.map((a: any, ai: number) => (
                        <button
                          key={a.id}
                          data-artist-idx={ai}
                          onClick={() => { fetchArtistDetail(a.id); setArtistBrowse('artist-detail'); }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900 active:bg-zinc-800 transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                            <PlexImg thumb={a.thumb} alt={a.name} size={80} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p className="text-[10px] text-zinc-500">{a._count?.cachedAlbums ?? 0} albums · {a._count?.cachedTracks ?? 0} tracks</p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-zinc-600 rotate-180" />
                        </button>
                      ))}
                      <p className="text-center text-xs text-zinc-600 pt-2">{artists.length} artists</p>
                    </div>
                  ) : (
                    <p className="text-center text-zinc-500 text-sm py-8">No artists found</p>
                  )}
                </div>
              </div>
            )}

            {/* Artist Detail - Albums */}
            {artistBrowse === 'artist-detail' && (
              <div className="p-4">
                <button
                  onClick={() => { setArtistBrowse('list'); setSelectedArtist(null); }}
                  className="flex items-center gap-1 text-xs text-purple-400 mb-3 active:text-purple-300"
                >
                  <ChevronLeft className="w-4 h-4" /> All Artists
                </button>
                {artistDetailLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
                ) : selectedArtist ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                        <PlexImg thumb={selectedArtist.thumb} alt={selectedArtist.name} size={120} />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{selectedArtist.name}</p>
                        <p className="text-xs text-zinc-500">{selectedArtist.cachedAlbums?.length ?? 0} albums · {selectedArtist.cachedTracks?.length ?? 0} tracks</p>
                      </div>
                    </div>

                    {/* Albums */}
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 font-medium">Albums</p>
                    <div className="space-y-1 mb-4">
                      {(selectedArtist.cachedAlbums ?? []).map((album: any) => (
                        <button
                          key={album.id}
                          onClick={() => { fetchAlbumDetail(album.id); setArtistBrowse('album-detail'); }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900 active:bg-zinc-800 transition-colors text-left"
                        >
                          <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                            <PlexImg thumb={album.thumb} alt={album.title} size={80} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{album.title}</p>
                            <p className="text-[10px] text-zinc-500">{album.year || ''}</p>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-zinc-600 rotate-180" />
                        </button>
                      ))}
                    </div>

                    {/* All Tracks */}
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 font-medium">Tracks</p>
                    <div className="space-y-1">
                      {(selectedArtist.cachedTracks ?? []).map((t: any) => (
                        <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900">
                          <div className="w-8 h-8 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                            <PlexImg thumb={t.thumb ?? t.album?.thumb} alt={t.title} size={60} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{t.title}</p>
                            <p className="text-[10px] text-zinc-600 truncate">{t.album?.title ?? ''}</p>
                          </div>
                          <AddButton item={{ ...t, artistName: selectedArtist.name, albumTitle: t.album?.title ?? '' }} small />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center text-zinc-500 text-sm py-8">Artist not found</p>
                )}
              </div>
            )}

            {/* Album Detail - Tracks */}
            {artistBrowse === 'album-detail' && (
              <div className="p-4">
                <button
                  onClick={() => { setArtistBrowse('artist-detail'); setSelectedAlbum(null); }}
                  className="flex items-center gap-1 text-xs text-purple-400 mb-3 active:text-purple-300"
                >
                  <ChevronLeft className="w-4 h-4" /> {selectedArtist?.name ?? 'Back'}
                </button>
                {albumDetailLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
                ) : selectedAlbum ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        <PlexImg thumb={selectedAlbum.thumb} alt={selectedAlbum.title} size={120} />
                      </div>
                      <div>
                        <p className="text-base font-bold">{selectedAlbum.title}</p>
                        <p className="text-xs text-zinc-500">{selectedAlbum.artist?.name ?? ''} {selectedAlbum.year ? `· ${selectedAlbum.year}` : ''}</p>
                        <p className="text-[10px] text-zinc-600">{selectedAlbum.cachedTracks?.length ?? 0} tracks</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(selectedAlbum.cachedTracks ?? []).map((t: any, i: number) => (
                        <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900">
                          <span className="text-[10px] text-zinc-600 w-5 text-center">{t.trackNumber ?? i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{t.title}</p>
                          </div>
                          <AddButton item={{ ...t, artistName: selectedAlbum.artist?.name ?? '', albumTitle: selectedAlbum.title ?? '' }} small />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center text-zinc-500 text-sm py-8">Album not found</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════ SEARCH TAB ════════ */}
        {tab === 'search' && (
          <div className="p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search artists, albums, tracks..."
                className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
                autoFocus
              />
            </div>
            {searching ? (
              <div className="flex items-center justify-center gap-2 text-zinc-500 py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900">
                    <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                      <PlexImg thumb={r.thumb} alt={r.title ?? r.name ?? ''} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{r.title ?? r.name ?? ''}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {r.type === 'track' ? `${r.artistName} - ${r.albumTitle}` : r.type === 'album' ? `${r.artistName} · Album` : 'Artist'}
                      </p>
                    </div>
                    {r.type === 'track' && <AddButton item={r} />}
                    {r.type === 'artist' && (
                      <button
                        onClick={() => { fetchArtistDetail(r.id); setTab('artists'); setArtistBrowse('artist-detail'); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700"
                      >View</button>
                    )}
                    {r.type === 'album' && (
                      <button
                        onClick={() => { fetchAlbumDetail(r.id); setTab('artists'); setArtistBrowse('album-detail'); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700"
                      >View</button>
                    )}
                  </div>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <p className="text-center text-zinc-500 text-sm py-8">No results found</p>
            ) : (
              <p className="text-center text-zinc-600 text-sm py-8">Type to search your Plex library</p>
            )}
          </div>
        )}

        {/* ════════ TOP PLAYED TAB ════════ */}
        {tab === 'top-played' && (
          <div className="p-4">
            {/* Period selector */}
            <div className="flex gap-2 mb-3 overflow-x-auto">
              {[
                { id: '30d', label: '30d' },
                { id: '90d', label: '90d' },
                { id: '1y', label: '1yr' },
                { id: 'all', label: 'All' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setTopPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    topPeriod === p.id ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 active:bg-zinc-700'
                  }`}
                >{p.label}</button>
              ))}
            </div>

            {topLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
            ) : topTracks.length > 0 ? (
              <div className="space-y-1">
                {topTracks.map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900">
                    <span className={`text-xs w-5 text-center font-bold ${
                      i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-zinc-600'
                    }`}>{i + 1}</span>
                    <div className="w-9 h-9 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                      <PlexImg thumb={t.thumb} alt={t.title} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.title}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{t.artistName}</p>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">{t.playCount}×</span>
                    <AddButton item={t} small />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <BarChart3 className="w-10 h-10 mb-2" />
                <p className="text-sm">No plays yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini now-playing footer */}
      {tab !== 'playing' && track && (
        <div
          onClick={() => setTab('playing')}
          className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-t border-zinc-800 flex-shrink-0 active:bg-zinc-800 transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
            <PlexImg thumb={track.thumb} alt={track.title} size={80} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{track.title}</p>
            <p className="text-xs text-zinc-500 truncate">{track.artistName}</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${npData?.isPlaying ? 'bg-green-400' : 'bg-zinc-600'}`} />
        </div>
      )}
    </div>
  );
}
