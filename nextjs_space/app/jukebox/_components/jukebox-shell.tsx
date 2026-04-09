"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlayerProvider } from '@/lib/player-context';
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

export type ViewType = 'stations' | 'artists' | 'search' | 'now-playing' | 'artist-detail' | 'album-detail' | 'queue';

export default function JukeboxShell() {
  const router = useRouter();
  const [view, setView] = useState<ViewType>('stations');
  const [loading, setLoading] = useState(true);
  const [selectedArtistId, setSelectedArtistId] = useState<string>('');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [viewHistory, setViewHistory] = useState<Array<{ view: ViewType; artistId?: string; albumId?: string }>>([]);

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
    <PlayerProvider>
      <div className="min-h-screen flex flex-col bg-background hero-gradient">
        <JukeboxHeader />
        <JukeboxNav currentView={view} onNavigate={(v: ViewType) => { setViewHistory([]); setView(v); }} />
        
        <main className="flex-1 overflow-y-auto pb-32">
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
        </main>

        <PlayerBar onNavigate={navigate} />
      </div>
    </PlayerProvider>
  );
}
