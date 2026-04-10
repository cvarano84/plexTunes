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
import TouchKeyboard from './touch-keyboard';

export type ViewType = 'stations' | 'artists' | 'search' | 'now-playing' | 'artist-detail' | 'album-detail' | 'queue' | 'settings';

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
  
  // Touch keyboard
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Idle timer
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { currentTrack, isPlaying } = usePlayer();

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jukebox-settings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.idleTimeout !== undefined) setIdleTimeout(s.idleTimeout);
        if (s.eqBands !== undefined) setEqBands(s.eqBands);
        if (s.eqColorScheme !== undefined) setEqColorScheme(s.eqColorScheme);
      }
    } catch { /* ignore */ }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('jukebox-settings', JSON.stringify({ idleTimeout, eqBands, eqColorScheme }));
    } catch { /* ignore */ }
  }, [idleTimeout, eqBands, eqColorScheme]);

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
    <div className="min-h-screen flex flex-col bg-background hero-gradient">
      <JukeboxHeader onNavigate={(v: ViewType) => { setViewHistory([]); setView(v); }} />
      <JukeboxNav currentView={view} onNavigate={(v: ViewType) => { setViewHistory([]); setView(v); }} />
      
      <main className={`flex-1 overflow-y-auto ${view === 'now-playing' ? '' : 'pb-32'}`}
        style={view === 'now-playing' ? { paddingBottom: 0 } : undefined}
      >
        {view === 'stations' && <StationsView onNavigate={navigate} />}
        {view === 'artists' && <ArtistsView onNavigate={navigate} />}
        {view === 'search' && <SearchView onNavigate={navigate} />}
        {view === 'now-playing' && <NowPlayingView />}
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
        {view === 'settings' && (
          <SettingsView
            idleTimeout={idleTimeout}
            onIdleTimeoutChange={setIdleTimeout}
            eqBands={eqBands}
            onEqBandsChange={setEqBands}
            eqColorScheme={eqColorScheme}
            onEqColorSchemeChange={setEqColorScheme}
          />
        )}
      </main>

      {view !== 'now-playing' && <PlayerBar onNavigate={navigate} />}
      
      <TouchKeyboard
        visible={keyboardVisible}
        onClose={() => setKeyboardVisible(false)}
        targetRef={activeInputRef}
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
