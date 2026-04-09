"use client";

import React, { useState, useEffect } from 'react';
import { Music2, Loader2, Mic2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer } from '@/lib/player-context';
import PlexImage from './plex-image';

export default function NowPlayingView() {
  const { currentTrack, isPlaying } = usePlayer();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [songInfo, setSongInfo] = useState<any>(null);

  useEffect(() => {
    if (!currentTrack?.title || !currentTrack?.artistName) {
      setLyrics(null);
      return;
    }

    setLyricsLoading(true);
    setLyrics(null);
    const params = new URLSearchParams({
      title: currentTrack.title,
      artist: currentTrack.artistName,
    });

    fetch(`/api/lyrics?${params}`)
      .then(r => r?.json?.())
      .then(data => {
        setLyrics(data?.lyrics ?? null);
        setSongInfo(data?.songInfo ?? null);
      })
      .catch(() => setLyrics(null))
      .finally(() => setLyricsLoading(false));
  }, [currentTrack?.title, currentTrack?.artistName]);

  if (!currentTrack) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-16 text-center">
        <Music2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold mb-2">Nothing Playing</h2>
        <p className="text-muted-foreground">Pick a song or station to start listening</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Album art + track info */}
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-[400px] aspect-square rounded-2xl overflow-hidden album-art-glow mb-6"
          >
            <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? 'Now Playing'} size={800} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center w-full max-w-[400px]"
          >
            <h2 className="text-2xl font-display font-bold tracking-tight truncate">
              {currentTrack?.title ?? ''}
            </h2>
            <p className="text-lg text-primary truncate mt-1">
              {currentTrack?.artistName ?? ''}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {currentTrack?.albumTitle ?? ''}
            </p>
          </motion.div>

          {/* Vinyl animation */}
          <div className="mt-6 relative">
            <div className={`w-24 h-24 rounded-full border-4 border-muted bg-gradient-to-br from-muted to-secondary flex items-center justify-center ${isPlaying ? 'animate-vinyl' : 'animate-vinyl animate-vinyl-paused'}`}>
              <div className="w-8 h-8 rounded-full bg-background border-2 border-muted-foreground/20" />
            </div>
          </div>
        </div>

        {/* Lyrics */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Mic2 className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-display font-semibold">Lyrics</h3>
          </div>

          <div className="flex-1 bg-card/50 rounded-xl p-6 border border-border/30 min-h-[400px] max-h-[600px] overflow-y-auto lyrics-scroll">
            {lyricsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Searching for lyrics...</span>
              </div>
            ) : lyrics ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-pre-line text-foreground/90 leading-relaxed text-base font-sans"
              >
                {lyrics}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Mic2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No lyrics available</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Powered by Genius</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
