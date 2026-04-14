"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Music2, Search, ListMusic, Mic2, Loader2, Play, Plus, ChevronRight } from 'lucide-react';

interface NowPlayingData {
  currentTrack: { title: string; artistName: string; albumTitle: string; thumb: string | null; duration: number | null } | null;
  isPlaying: boolean;
  currentTime: number;
  queue: Array<{ title: string; artistName: string; thumb: string | null }>;
  currentStationName: string | null;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlexImg({ thumb, alt, size = 100 }: { thumb: string | null; alt: string; size?: number }) {
  if (!thumb) return <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Music2 className="w-6 h-6 text-zinc-600" /></div>;
  const src = `/api/plex/image?url=${encodeURIComponent(thumb)}&size=${size}`;
  return <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" />;
}

export default function MobilePage() {
  const [tab, setTab] = useState<'playing' | 'queue' | 'search'>('playing');
  const [npData, setNpData] = useState<NowPlayingData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const lastTrackIdRef = useRef<string>('');

  // Poll for now-playing state
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

  // Fetch lyrics when track changes
  useEffect(() => {
    const track = npData?.currentTrack;
    if (!track?.title || !track?.artistName) { setLyrics(null); return; }
    const trackKey = `${track.title}|${track.artistName}`;
    if (trackKey === lastTrackIdRef.current) return;
    lastTrackIdRef.current = trackKey;
    setLyricsLoading(true);
    setLyrics(null);
    fetch(`/api/lyrics?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artistName)}`)
      .then(r => r?.json?.())
      .then(data => { setLyrics(data?.lyrics ?? null); setLyricsLoading(false); })
      .catch(() => setLyricsLoading(false));
  }, [npData?.currentTrack?.title, npData?.currentTrack?.artistName]);

  // Search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res?.json?.();
      // Flatten artists, albums, tracks into a single list with type annotations
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

  // Add to queue
  const addToQueue = async (track: any) => {
    try {
      const trackInfo = {
        id: track.id,
        title: track.title,
        artistName: track.artistName ?? track.artist?.name ?? '',
        albumTitle: track.albumTitle ?? track.album?.title ?? '',
        thumb: track.thumb ?? track.album?.thumb ?? null,
        mediaKey: track.mediaKey ?? null,
        duration: track.duration ?? null,
        ratingKey: track.ratingKey ?? '',
      };
      await fetch('/api/remote/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'add_to_queue', track: trackInfo }),
      });
      setAddedIds(prev => new Set(prev).add(track.id));
    } catch { /* ignore */ }
  };

  const track = npData?.currentTrack;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <h1 className="text-lg font-bold tracking-tight">Plex Jukebox Remote</h1>
        <p className="text-xs text-zinc-500">Add songs to the queue from your phone</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 flex-shrink-0">
        {[
          { id: 'playing' as const, label: 'Now Playing', icon: Music2 },
          { id: 'queue' as const, label: 'Queue', icon: ListMusic },
          { id: 'search' as const, label: 'Search', icon: Search },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
              tab === t.id ? 'text-white border-b-2 border-purple-500' : 'text-zinc-500'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* NOW PLAYING TAB */}
        {tab === 'playing' && (
          <div className="p-4">
            {track ? (
              <div className="space-y-4">
                {/* Album art */}
                <div className="aspect-square max-w-[280px] mx-auto rounded-xl overflow-hidden shadow-2xl">
                  <PlexImg thumb={track.thumb} alt={track.title} size={600} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold truncate">{track.title}</p>
                  <p className="text-sm text-zinc-400 truncate">{track.artistName}</p>
                  <p className="text-xs text-zinc-500 truncate">{track.albumTitle}</p>
                  {npData?.currentStationName && (
                    <p className="text-xs text-purple-400 mt-1">Station: {npData.currentStationName}</p>
                  )}
                </div>
                {/* Playback progress */}
                <div className="space-y-1">
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${track.duration ? ((npData?.currentTime ?? 0) / (track.duration / 1000)) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>{formatTime(npData?.currentTime ?? 0)}</span>
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
                  <div className="bg-zinc-900 rounded-lg p-4 max-h-[40vh] overflow-y-auto">
                    {lyricsLoading ? (
                      <div className="flex items-center justify-center gap-2 text-zinc-500 py-4">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading lyrics...
                      </div>
                    ) : lyrics ? (
                      <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">{lyrics}</pre>
                    ) : (
                      <p className="text-xs text-zinc-500 text-center py-4">No lyrics found</p>
                    )}
                  </div>
                )}
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

        {/* QUEUE TAB */}
        {tab === 'queue' && (
          <div className="p-4">
            {(npData?.queue?.length ?? 0) > 0 ? (
              <div className="space-y-1">
                {npData?.queue?.map((q, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900">
                    <span className="text-xs text-zinc-600 w-5 text-center">{i + 1}</span>
                    <div className="w-9 h-9 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
                      <PlexImg thumb={q.thumb} alt={q.title} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{q.title}</p>
                      <p className="text-xs text-zinc-500 truncate">{q.artistName}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <ListMusic className="w-12 h-12 mb-3" />
                <p className="text-sm">Queue is empty</p>
              </div>
            )}
          </div>
        )}

        {/* SEARCH TAB */}
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
                        {r.type === 'track' ? `${r.artistName} - ${r.albumTitle}` : r.type === 'album' ? r.artistName : `${r.type}`}
                      </p>
                    </div>
                    {r.type === 'track' && (
                      <button
                        onClick={() => addToQueue(r)}
                        disabled={addedIds.has(r.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          addedIds.has(r.id)
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-purple-600 text-white active:bg-purple-700'
                        }`}
                      >
                        {addedIds.has(r.id) ? 'Added' : <><Plus className="w-3 h-3" /> Queue</>}
                      </button>
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
