"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Plus, Loader2, Disc, Music2, Star, ListPlus, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';
import { toast } from 'sonner';

interface ArtistDetailViewProps {
  artistId: string;
  onNavigate: (view: ViewType, opts?: any) => void;
  onBack: () => void;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

export default function ArtistDetailView({ artistId, onNavigate, onBack }: ArtistDetailViewProps) {
  const [artist, setArtist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [bio, setBio] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [similarArtists, setSimilarArtists] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const { playQueue, addToQueue, playNext } = usePlayer();
  const albumScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    setBio(null);
    setSimilarArtists([]);
    const popular = showAllTracks ? 'false' : 'true';
    fetch(`/api/artists/${artistId}?popular=${popular}`)
      .then(r => r?.json?.())
      .then(data => {
        setArtist(data?.artist ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [artistId, showAllTracks]);

  // Fetch bio
  useEffect(() => {
    if (!artistId) return;
    setBioLoading(true);
    fetch(`/api/artists/${artistId}/bio`)
      .then(r => r?.json?.())
      .then(data => { setBio(data?.bio ?? null); setBioLoading(false); })
      .catch(() => setBioLoading(false));
  }, [artistId]);

  // Fetch similar artists
  useEffect(() => {
    if (!artistId) return;
    setSimilarLoading(true);
    fetch(`/api/artists/${artistId}/similar`)
      .then(r => r?.json?.())
      .then(data => { setSimilarArtists(data?.similar ?? []); setSimilarLoading(false); })
      .catch(() => setSimilarLoading(false));
  }, [artistId]);

  const makeTrackInfo = (t: any): TrackInfo => ({
    id: t?.id ?? '',
    title: t?.title ?? '',
    artistName: artist?.name ?? '',
    albumTitle: t?.albumTitle ?? '',
    thumb: t?.thumb ?? null,
    mediaKey: t?.mediaKey ?? null,
    duration: t?.duration ?? null,
    ratingKey: t?.ratingKey ?? '',
    year: t?.year ?? null,
  });

  const handlePlayAll = () => {
    const tracks = (artist?.cachedTracks ?? [])?.map?.(makeTrackInfo) ?? [];
    if (tracks?.length > 0) {
      playQueue(tracks);
      toast.success(`Playing ${artist?.name ?? 'Artist'}`);
    }
  };

  const scrollAlbums = (dir: 'left' | 'right') => {
    const el = albumScrollRef.current;
    if (!el) return;
    const scrollAmt = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === 'left' ? -scrollAmt : scrollAmt, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-muted-foreground">Artist not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden px-4 py-3 gap-3">
      {/* Back button row */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground active:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h2 className="text-xl font-display font-bold tracking-tight truncate">{artist?.name ?? ''}</h2>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium active:bg-primary/80 transition-colors"
          >
            <Play className="w-4 h-4" /> Play All
          </button>
          <button
            onClick={() => setShowAllTracks(!showAllTracks)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAllTracks
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary text-secondary-foreground active:bg-secondary/80'
            }`}
          >
            <Star className="w-4 h-4" /> {showAllTracks ? 'All' : 'Popular'}
          </button>
        </div>
      </div>

      {/* Main content: left panel + right tracks panel */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* Left panel: bio, albums, similar */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">
          {/* Bio section - compact top area */}
          <div className="flex gap-4 items-start flex-shrink-0 max-h-[30%] overflow-hidden">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-secondary flex-shrink-0 album-art-glow">
              <PlexImage thumb={artist?.thumb} alt={artist?.name ?? ''} size={200} />
            </div>
            <div className="flex-1 min-w-0 overflow-y-auto scrollbar-none max-h-full">
              <p className="text-xs text-muted-foreground mb-1">
                {artist?.cachedAlbums?.length ?? 0} albums / {artist?.cachedTracks?.length ?? 0} tracks
              </p>
              {bioLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading bio...
                </div>
              ) : bio ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{bio}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No biography available</p>
              )}
            </div>
          </div>

          {/* Albums carousel - middle section */}
          {(artist?.cachedAlbums?.length ?? 0) > 0 && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                <Disc className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-display font-semibold">Albums</h3>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => scrollAlbums('left')} className="w-7 h-7 rounded-full bg-secondary/60 flex items-center justify-center active:bg-secondary transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => scrollAlbums('right')} className="w-7 h-7 rounded-full bg-secondary/60 flex items-center justify-center active:bg-secondary transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div ref={albumScrollRef} className="flex gap-3 overflow-x-auto scrollbar-none flex-1 min-h-0 items-start">
                {(artist?.cachedAlbums ?? [])?.map?.((album: any) => (
                  <button
                    key={album?.id ?? ''}
                    onClick={() => onNavigate?.('album-detail', { albumId: album?.id })}
                    className="flex-shrink-0 text-left group"
                    style={{ width: 'clamp(120px, 12vw, 180px)' }}
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-secondary mb-1.5 group-active:ring-2 group-active:ring-primary/50 transition-all">
                      <PlexImage thumb={album?.thumb} alt={album?.title ?? ''} size={300} />
                    </div>
                    <p className="text-xs font-medium truncate">{album?.title ?? ''}</p>
                    <p className="text-[10px] text-muted-foreground">{album?.year ?? ''}</p>
                  </button>
                )) ?? null}
              </div>
            </div>
          )}

          {/* Similar artists - bottom section */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-display font-semibold">Similar Artists</h3>
            </div>
            {similarLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            ) : similarArtists.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                {similarArtists.map((sa: any) => (
                  <button
                    key={sa?.id ?? sa?.name}
                    onClick={() => { if (sa?.id) onNavigate?.('artist-detail', { artistId: sa.id }); }}
                    className="flex-shrink-0 text-center group w-16"
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-secondary mx-auto mb-1 group-active:ring-2 group-active:ring-primary/50 transition-all">
                      {sa?.thumb ? (
                        <PlexImage thumb={sa.thumb} alt={sa?.name ?? ''} size={120} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Users className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] truncate">{sa?.name ?? ''}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-1">No similar artists found in library</p>
            )}
          </div>
        </div>

        {/* Right panel: Track list */}
        <div className="w-[40%] min-w-[280px] max-w-[500px] flex flex-col bg-secondary/20 rounded-lg border border-border/20 overflow-hidden flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20 flex-shrink-0">
            <Music2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-display font-semibold">
              {showAllTracks ? 'All Tracks' : 'Popular Tracks'}
            </h3>
            <span className="text-xs text-muted-foreground ml-auto">{artist?.cachedTracks?.length ?? 0}</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
            {(artist?.cachedTracks ?? [])?.map?.((track: any, i: number) => (
              <div
                key={track?.id ?? i}
                className="flex items-center gap-2 px-3 py-2 border-b border-border/10 active:bg-secondary/60 transition-colors"
              >
                <span className="w-5 text-center text-[10px] text-muted-foreground flex-shrink-0">{i + 1}</span>
                <div className="w-8 h-8 rounded overflow-hidden bg-secondary flex-shrink-0">
                  <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={80} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{track?.title ?? ''}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{track?.albumTitle ?? ''}</p>
                </div>
                {(track?.popularity ?? 0) > 0 && (
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0">
                    <Star className="w-2.5 h-2.5 text-amber-400" />
                    {track?.popularity}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground w-8 text-right flex-shrink-0">
                  {formatDuration(track?.duration)}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { addToQueue(makeTrackInfo(track)); toast.success('Queued'); }}
                    className="w-7 h-7 rounded flex items-center justify-center bg-secondary text-foreground text-xs active:bg-primary active:text-primary-foreground transition-colors"
                    title="Add to queue"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { playNext(makeTrackInfo(track)); toast.success('Playing next'); }}
                    className="w-7 h-7 rounded flex items-center justify-center bg-primary text-primary-foreground text-xs active:bg-accent transition-colors"
                    title="Play next"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )) ?? null}
          </div>
        </div>
      </div>
    </div>
  );
}
