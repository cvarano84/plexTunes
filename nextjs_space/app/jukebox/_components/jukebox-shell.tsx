"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PlayerProvider, usePlayer } from '@/lib/player-context';
import { Loader2 } from 'lucide-react';
import JukeboxHeader from './jukebox-header';
import JukeboxNav from './jukebox-nav';
import StationsView from './stations-view';
import ArtistsView from './artists-view';
import SearchView from './search-view';
import NowPlayingView from './now-playing-view';
import PlayerBar from './player-bar';
import ArtistDetailView from './artist-detail-view';
import AlbumDetailView from './album-detail-view';
import QueueView from './queue-view';
import SettingsView from './settings-view';
import StatsView from './stats-view';
import TouchKeyboard from './touch-keyboard';

export type ViewType = 'stations' | 'artists' | 'search' | 'now-playing' | 'artist-detail' | 'album-detail' | 'queue' | 'settings' | 'stats';

function JukeboxInner() {
  const router = useRouter();
  const [view, setView] = useState<ViewType>('stations');
  const [loading, setLoading] = useState(true);
  const [selectedArtistId, setSelectedArtistId] = useState<string>('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [viewHistory, setViewHistory] = useState<Array<{ view: ViewType; artistId?: string; albumId?: string }>>([]);
  
  // Settings state
  const [idleTimeout, setIdleTimeout] = useState(30);
  const [eqBands, setEqBands] = useState(32);
  const [eqColorScheme, setEqColorScheme] = useState('classic');
  const [previousTrackCount, setPreviousTrackCount] = useState(5);
  const [keyboardSize, setKeyboardSize] = useState<'small' | 'medium' | 'large' | 'xl' | 'xxl'>('medium');
  const [columnLayout, setColumnLayout] = useState('balanced');
  const [artistRows, setArtistRows] = useState(4);
  const [stationRows, setStationRows] = useState(1);
  const [lyricsZoom, setLyricsZoom] = useState(3);
  const [jukeboxTitle, setJukeboxTitle] = useState('');
  const [stationQueueSize, setStationQueueSize] = useState(5);
  const [eqBarHeight, setEqBarHeight] = useState(48);
  const [artistBioHeight, setArtistBioHeight] = useState(30);
  const [artistAlbumHeight, setArtistAlbumHeight] = useState(40);
  const [artistSimilarHeight, setArtistSimilarHeight] = useState(30);
  const [artistTrackWidth, setArtistTrackWidth] = useState(40);
  const settingsLoadedRef = useRef(false);
  
  // Touch keyboard
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Idle timer
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { currentTrack, isPlaying, queue: playerQueue, queueIndex, addToQueue: playerAddToQueue, currentTime, currentStationName } = usePlayer();

  // Load settings from server (with localStorage as fast cache)
  useEffect(() => {
    // Load localStorage cache first for instant UI
    try {
      const saved = localStorage.getItem('jukebox-settings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.idleTimeout !== undefined) setIdleTimeout(s.idleTimeout);
        if (s.eqBands !== undefined) setEqBands(s.eqBands);
        if (s.eqColorScheme !== undefined) setEqColorScheme(s.eqColorScheme);
        if (s.previousTrackCount !== undefined) setPreviousTrackCount(s.previousTrackCount);
        if (s.keyboardSize !== undefined) setKeyboardSize(s.keyboardSize);
        if (s.columnLayout !== undefined) setColumnLayout(s.columnLayout);
        if (s.artistRows !== undefined) setArtistRows(s.artistRows);
        if (s.stationRows !== undefined) setStationRows(s.stationRows);
        if (s.lyricsZoom !== undefined) setLyricsZoom(s.lyricsZoom);
        if (s.jukeboxTitle !== undefined) setJukeboxTitle(s.jukeboxTitle);
        if (s.stationQueueSize !== undefined) setStationQueueSize(s.stationQueueSize);
        if (s.eqBarHeight !== undefined) setEqBarHeight(s.eqBarHeight);
        if (s.artistBioHeight !== undefined) setArtistBioHeight(s.artistBioHeight);
        if (s.artistAlbumHeight !== undefined) setArtistAlbumHeight(s.artistAlbumHeight);
        if (s.artistSimilarHeight !== undefined) setArtistSimilarHeight(s.artistSimilarHeight);
        if (s.artistTrackWidth !== undefined) setArtistTrackWidth(s.artistTrackWidth);
      }
    } catch { /* ignore */ }
    // Then fetch from server (source of truth)
    fetch('/api/jukebox-settings').then(r => r.json()).then(s => {
      if (!s || s.error) return;
      setIdleTimeout(s.idleTimeout ?? 30);
      setEqBands(s.eqBands ?? 32);
      setEqColorScheme(s.eqColorScheme ?? 'classic');
      setPreviousTrackCount(s.previousTrackCount ?? 5);
      setKeyboardSize(s.keyboardSize ?? 'medium');
      setColumnLayout(s.columnLayout ?? 'balanced');
      setArtistRows(s.artistRows ?? 4);
      setStationRows(s.stationRows ?? 1);
      setLyricsZoom(s.lyricsZoom ?? 3);
      setJukeboxTitle(s.jukeboxTitle ?? '');
      setStationQueueSize(s.stationQueueSize ?? 5);
      setEqBarHeight(s.eqBarHeight ?? 48);
      setArtistBioHeight(s.artistBioHeight ?? 30);
      setArtistAlbumHeight(s.artistAlbumHeight ?? 40);
      setArtistSimilarHeight(s.artistSimilarHeight ?? 30);
      setArtistTrackWidth(s.artistTrackWidth ?? 40);
      settingsLoadedRef.current = true;
    }).catch(() => { settingsLoadedRef.current = true; });
  }, []);

  // Save settings to server + localStorage cache
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const settingsObj = {
      idleTimeout, eqBands, eqColorScheme, previousTrackCount, keyboardSize, columnLayout,
      artistRows, stationRows, lyricsZoom, jukeboxTitle, stationQueueSize, eqBarHeight,
      artistBioHeight, artistAlbumHeight, artistSimilarHeight, artistTrackWidth,
    };
    // Always write to localStorage for fast reads
    try { localStorage.setItem('jukebox-settings', JSON.stringify(settingsObj)); } catch { /* ignore */ }
    // Debounce server save
    if (!settingsLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch('/api/jukebox-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsObj),
      }).catch(() => {});
    }, 1000);
  }, [idleTimeout, eqBands, eqColorScheme, previousTrackCount, keyboardSize, columnLayout, artistRows, stationRows, lyricsZoom, jukeboxTitle, stationQueueSize, eqBarHeight, artistBioHeight, artistAlbumHeight, artistSimilarHeight, artistTrackWidth]);

  // Idle timeout logic
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (idleTimeout > 0 && currentTrack && isPlaying) {
      idleTimerRef.current = setTimeout(() => {
        setView(prev => {
          if (prev !== 'now-playing' && prev !== 'settings') return 'now-playing';
          return prev;
        });
      }, idleTimeout * 1000);
    }
  }, [idleTimeout, currentTrack, isPlaying]);

  useEffect(() => {
    resetIdleTimer();
    const handler = () => resetIdleTimer();
    window.addEventListener('pointerdown', handler);
    window.addEventListener('pointermove', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('pointermove', handler);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Touch keyboard: listen for focus on input fields
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const inputEl = target as HTMLInputElement;
        if (inputEl.type === 'range' || inputEl.type === 'checkbox' || inputEl.type === 'radio') return;
        activeInputRef.current = inputEl;
        setKeyboardVisible(true);
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  useEffect(() => {
    fetch('/api/plex/config')
      .then(r => r?.json?.())
      .then(data => {
        if (!data?.configured) {
          router?.push?.('/setup');
        } else {
          setLoading(false);
        }
      })
      .catch(() => router?.push?.('/setup'));
  }, [router]);

  // Publish playback state for mobile remote clients
  useEffect(() => {
    const interval = setInterval(() => {
      if (!currentTrack) return;
      fetch('/api/remote/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrack,
          isPlaying,
          currentTime,
          publishedAt: Date.now(),
          queue: playerQueue.map(t => ({ id: t.id, title: t.title, artistName: t.artistName, thumb: t.thumb, albumTitle: t.albumTitle, duration: t.duration })),
          queueIndex,
          currentStationName,
          jukeboxTitle,
          previousTrackCount,
          stationQueueSize,
        }),
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [currentTrack, isPlaying, playerQueue, queueIndex, currentTime, currentStationName, jukeboxTitle, previousTrackCount, stationQueueSize]);

  // Poll for remote queue additions
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/remote/queue');
        const data = await res?.json?.();
        const actions = data?.actions ?? [];
        for (const action of actions) {
          if (action?.type === 'add_to_queue' && action?.payload) {
            playerAddToQueue(action.payload);
          }
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [playerAddToQueue]);

  const navigate = (newView: ViewType, opts?: { artistId?: string; albumId?: string }) => {
    setViewHistory(prev => [...(prev ?? []), { view, artistId: selectedArtistId, albumId: selectedAlbumId }]);
    setView(newView);
    if (opts?.artistId) setSelectedArtistId(opts.artistId);
    if (opts?.albumId) setSelectedAlbumId(opts.albumId);
    resetIdleTimer();
  };

  const goBack = () => {
    const prev = viewHistory?.[(viewHistory?.length ?? 0) - 1];
    if (prev) {
      setView(prev.view);
      if (prev.artistId) setSelectedArtistId(prev.artistId);
      if (prev.albumId) setSelectedAlbumId(prev.albumId);
      setViewHistory(h => h?.slice?.(0, -1) ?? []);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background hero-gradient overflow-hidden">
      <JukeboxHeader onNavigate={(v: ViewType) => { setViewHistory([]); setView(v); }} jukeboxTitle={jukeboxTitle} />
      <JukeboxNav currentView={view} onNavigate={(v: ViewType) => { setViewHistory([]); setView(v); }} />
      
      <main className={`flex-1 min-h-0 ${view === 'now-playing' || view === 'stations' || view === 'artists' || view === 'stats' ? 'overflow-hidden pb-36' : 'overflow-y-auto pb-36'}`}
      >
        {view === 'stations' && <StationsView onNavigate={navigate} stationRows={stationRows} stationQueueSize={stationQueueSize} />}
        {view === 'artists' && <ArtistsView onNavigate={navigate} artistRows={artistRows} />}
        {view === 'search' && <SearchView onNavigate={navigate} />}
        {view === 'now-playing' && (
          <NowPlayingView
            previousTrackCount={previousTrackCount}
            columnLayout={columnLayout}
            lyricsZoom={lyricsZoom}
          />
        )}
        {view === 'artist-detail' && (
          <ArtistDetailView
            artistId={selectedArtistId}
            onNavigate={navigate}
            onBack={goBack}
            bioHeight={artistBioHeight}
            albumHeight={artistAlbumHeight}
            similarHeight={artistSimilarHeight}
            trackWidth={artistTrackWidth}
          />
        )}
        {view === 'album-detail' && (
          <AlbumDetailView
            albumId={selectedAlbumId}
            onNavigate={navigate}
            onBack={goBack}
          />
        )}
        {view === 'queue' && <QueueView onBack={goBack} />}
        {view === 'stats' && <StatsView />}
        {view === 'settings' && (
          <SettingsView
            idleTimeout={idleTimeout}
            onIdleTimeoutChange={setIdleTimeout}
            eqBands={eqBands}
            onEqBandsChange={setEqBands}
            eqColorScheme={eqColorScheme}
            onEqColorSchemeChange={setEqColorScheme}
            previousTrackCount={previousTrackCount}
            onPreviousTrackCountChange={setPreviousTrackCount}
            keyboardSize={keyboardSize}
            onKeyboardSizeChange={setKeyboardSize}
            columnLayout={columnLayout}
            onColumnLayoutChange={setColumnLayout}
            artistRows={artistRows}
            onArtistRowsChange={setArtistRows}
            stationRows={stationRows}
            onStationRowsChange={setStationRows}
            lyricsZoom={lyricsZoom}
            onLyricsZoomChange={setLyricsZoom}
            jukeboxTitle={jukeboxTitle}
            onJukeboxTitleChange={setJukeboxTitle}
            stationQueueSize={stationQueueSize}
            onStationQueueSizeChange={setStationQueueSize}
            eqBarHeight={eqBarHeight}
            onEqBarHeightChange={setEqBarHeight}
            artistBioHeight={artistBioHeight}
            onArtistBioHeightChange={setArtistBioHeight}
            artistAlbumHeight={artistAlbumHeight}
            onArtistAlbumHeightChange={setArtistAlbumHeight}
            artistSimilarHeight={artistSimilarHeight}
            onArtistSimilarHeightChange={setArtistSimilarHeight}
            artistTrackWidth={artistTrackWidth}
            onArtistTrackWidthChange={setArtistTrackWidth}
          />
        )}
      </main>

      <PlayerBar onNavigate={navigate} eqBands={eqBands} eqColorScheme={eqColorScheme} eqBarHeight={eqBarHeight} />
      
      <TouchKeyboard
        visible={keyboardVisible}
        onClose={() => setKeyboardVisible(false)}
        targetRef={activeInputRef}
        size={keyboardSize}
      />
    </div>
  );
}

export default function JukeboxShell() {
  return (
    <PlayerProvider>
      <JukeboxInner />
    </PlayerProvider>
  );
}
