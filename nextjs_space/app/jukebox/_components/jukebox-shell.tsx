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
  
  // Touch keyboard
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Idle timer
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { currentTrack, isPlaying, queue: playerQueue, queueIndex, addToQueue: playerAddToQueue, currentTime, currentStationName } = usePlayer();

  // Load settings from localStorage
  useEffect(() => {
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
      }
    } catch { /* ignore */ }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('jukebox-settings', JSON.stringify({
        idleTimeout, eqBands, eqColorScheme, previousTrackCount, keyboardSize, columnLayout, artistRows, stationRows, lyricsZoom, jukeboxTitle, stationQueueSize
      }));
    } catch { /* ignore */ }
  }, [idleTimeout, eqBands, eqColorScheme, previousTrackCount, keyboardSize, columnLayout, artistRows, stationRows, lyricsZoom, jukeboxTitle, stationQueueSize]);

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
      
      <main className={`flex-1 min-h-0 ${view === 'now-playing' || view === 'stations' || view === 'artists' || view === 'stats' ? 'overflow-hidden' : 'overflow-y-auto pb-32'}`}
      >
        {view === 'stations' && <StationsView onNavigate={navigate} stationRows={stationRows} stationQueueSize={stationQueueSize} />}
        {view === 'artists' && <ArtistsView onNavigate={navigate} artistRows={artistRows} />}
        {view === 'search' && <SearchView onNavigate={navigate} />}
        {view === 'now-playing' && (
          <NowPlayingView
            eqBands={eqBands}
            eqColorScheme={eqColorScheme}
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
          />
        )}
      </main>

      {view !== 'now-playing' && <PlayerBar onNavigate={navigate} />}
      
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
