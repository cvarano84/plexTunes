"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Music2, Loader2, Mic2, ListMusic, Play, SkipForward, SkipBack, History, Disc3, User, Album } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import PlexImage from './plex-image';

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

// LED Equalizer - uses analyser from PlayerProvider context
function LEDEqualizer({ analyserNode, isPlaying, bandCount = 32, colorScheme = 'classic' }: {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  bandCount?: number;
  colorScheme?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const fallbackBarsRef = useRef<number[]>([]);

  const getBarColor = useCallback((normalizedHeight: number) => {
    if (colorScheme === 'purple') {
      if (normalizedHeight > 0.85) return '#ff3366';
      if (normalizedHeight > 0.65) return '#cc44ff';
      return '#7c3aed';
    }
    if (colorScheme === 'cyan') {
      if (normalizedHeight > 0.85) return '#ff3366';
      if (normalizedHeight > 0.65) return '#06b6d4';
      return '#0ea5e9';
    }
    if (normalizedHeight > 0.85) return '#ef4444';
    if (normalizedHeight > 0.65) return '#eab308';
    return '#22c55e';
  }, [colorScheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (fallbackBarsRef.current.length !== bandCount) {
      fallbackBarsRef.current = Array(bandCount).fill(0);
    }

    const draw = () => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = bandCount;
      const gap = 2;
      const barW = Math.max(2, (w - gap * (bars - 1)) / bars);
      const ledH = 4;
      const ledGap = 2;
      const maxLeds = Math.floor(h / (ledH + ledGap));

      let dataArray: Uint8Array | null = null;
      if (analyserNode) {
        dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < bars; i++) {
        let value: number;
        if (dataArray && analyserNode) {
          const idx = Math.floor((i / bars) * dataArray.length);
          value = (dataArray[idx] ?? 0) / 255;
        } else if (isPlaying) {
          const target = 0.2 + Math.random() * 0.6;
          fallbackBarsRef.current[i] = (fallbackBarsRef.current[i] ?? 0) * 0.7 + target * 0.3;
          value = fallbackBarsRef.current[i];
        } else {
          fallbackBarsRef.current[i] = (fallbackBarsRef.current[i] ?? 0) * 0.9;
          value = fallbackBarsRef.current[i];
        }

        const activeLeds = Math.max(0, Math.round(value * maxLeds));
        const x = i * (barW + gap);

        for (let led = 0; led < maxLeds; led++) {
          const y = h - (led + 1) * (ledH + ledGap);
          const normalizedH = led / maxLeds;
          if (led < activeLeds) {
            ctx.fillStyle = getBarColor(normalizedH);
            ctx.shadowColor = getBarColor(normalizedH);
            ctx.shadowBlur = 3;
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.shadowBlur = 0;
          }
          ctx.fillRect(x, y, barW, ledH);
        }
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [analyserNode, isPlaying, bandCount, getBarColor]);

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={80}
      className="w-full h-[clamp(3rem,5vh,5rem)] rounded-lg"
    />
  );
}

// Karaoke-style lyrics component
function KaraokeLyrics({ lyrics, currentTime, duration }: {
  lyrics: string | null;
  currentTime: number;
  duration: number;
}) {
  const [activeLineIdx, setActiveLineIdx] = useState(0);

  const allLines = useMemo(() => {
    if (!lyrics) return [];
    return lyrics.split('\n').filter(line => line.trim().length > 0);
  }, [lyrics]);

  useEffect(() => {
    if (allLines.length === 0 || duration <= 0) {
      setActiveLineIdx(0);
      return;
    }
    const progress = Math.min(1, currentTime / duration);
    const estimatedLine = Math.floor(progress * allLines.length);
    setActiveLineIdx(Math.max(0, Math.min(allLines.length - 1, estimatedLine)));
  }, [currentTime, duration, allLines]);

  if (!lyrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Mic2 className="w-[clamp(2rem,4vw,3.5rem)] h-[clamp(2rem,4vw,3.5rem)] text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-[clamp(0.875rem,1.5vw,1.25rem)]">No lyrics available</p>
      </div>
    );
  }

  // Show a window: 1 before, current, 2 after
  const startIdx = Math.max(0, activeLineIdx - 1);
  const visibleLines = allLines.slice(startIdx, startIdx + 4);
  const activeInWindow = activeLineIdx - startIdx;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="space-y-4 w-full text-center">
        {visibleLines.map((line, i) => (
          <motion.p
            key={`${startIdx + i}-${line.slice(0, 20)}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`font-display leading-snug transition-all duration-300 ${
              i === activeInWindow
                ? 'text-[clamp(1.5rem,3.2vw,3rem)] font-bold text-foreground'
                : i < activeInWindow
                  ? 'text-[clamp(1rem,2vw,1.75rem)] text-muted-foreground/40'
                  : 'text-[clamp(1.125rem,2.2vw,2rem)] text-muted-foreground/60'
            }`}
          >
            {line}
          </motion.p>
        ))}
      </div>
    </div>
  );
}

interface NowPlayingViewProps {
  eqBands?: number;
  eqColorScheme?: string;
  previousTrackCount?: number;
  columnLayout?: string;
}

export default function NowPlayingView({ eqBands = 32, eqColorScheme = 'classic', previousTrackCount = 3, columnLayout = 'balanced' }: NowPlayingViewProps) {
  const {
    currentTrack, isPlaying, queue, queueIndex, currentTime, duration,
    togglePlay, nextTrack, prevTrack, seek, playQueue, analyserNode
  } = usePlayer();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

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
      .then(data => setLyrics(data?.lyrics ?? null))
      .catch(() => setLyrics(null))
      .finally(() => setLyricsLoading(false));
  }, [currentTrack?.title, currentTrack?.artistName]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const colFlex = columnLayout === 'lyrics' ? [25, 50, 25]
    : columnLayout === 'art' ? [40, 35, 25]
    : [30, 40, 30];

  if (!currentTrack) {
    return (
      <div className="flex items-center justify-center h-full text-center px-6">
        <div>
          <Music2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold mb-2">Nothing Playing</h2>
          <p className="text-muted-foreground">Pick a song or station to start listening</p>
        </div>
      </div>
    );
  }

  const prevTracks = queue.slice(Math.max(0, queueIndex - previousTrackCount), queueIndex);
  const upcomingTracks = queue.slice(queueIndex + 1, queueIndex + 50);
  // Show limited items to keep text large: prev + 1 current + ~5 upcoming
  const visibleUpcoming = upcomingTracks.slice(0, Math.max(2, 10 - previousTrackCount - 1));
  const remainingUpcoming = upcomingTracks.slice(visibleUpcoming.length);

  return (
    <div className="flex flex-col h-full">
      {/* 3-column content area */}
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        {/* LEFT: Album art (square) + vinyl + track info with icons */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 gap-3" style={{ flex: `${colFlex[0]} 0 0%` }}>
          {/* Square album art */}
          <div className="relative rounded-xl overflow-hidden shadow-2xl" style={{ width: 'clamp(120px, 15vw, 280px)', height: 'clamp(120px, 15vw, 280px)' }}>
            <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={500} />
          </div>

          {/* Spinning vinyl below the art */}
          <div className="relative" style={{ width: 'clamp(100px, 10vw, 180px)', height: 'clamp(100px, 10vw, 180px)' }}>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900 shadow-xl" />
            <div className="absolute inset-[3px] rounded-full border border-zinc-600/30" />
            <div className={`absolute inset-[6px] rounded-full overflow-hidden ${isPlaying ? 'animate-vinyl' : ''}`}
              style={{ animationDuration: '2s' }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
              <div className="absolute inset-[25%] rounded-full overflow-hidden">
                <PlexImage thumb={currentTrack?.thumb} alt="" size={200} />
              </div>
              <div className="absolute inset-[45%] rounded-full bg-zinc-700 border-2 border-zinc-500 shadow-inner" />
              <div className="absolute inset-[14%] rounded-full border border-zinc-800/40" />
              <div className="absolute inset-[38%] rounded-full border border-zinc-800/30" />
            </div>
            {/* Tonearm */}
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-zinc-500 shadow-lg z-10" />
            <div className={`absolute top-0 right-0.5 w-0.5 bg-zinc-500 rounded-full origin-top z-10 transition-transform duration-700 ${isPlaying ? 'rotate-[25deg]' : 'rotate-[5deg]'}`}
              style={{ height: 'clamp(40px, 5vw, 80px)' }}
            />
          </div>

          {/* Track info with monochrome icons */}
          <div className="w-full px-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <Music2 className="w-[clamp(1rem,1.5vw,1.5rem)] h-[clamp(1rem,1.5vw,1.5rem)] text-muted-foreground flex-shrink-0" />
              <h2 className="text-[clamp(1.125rem,2.5vw,2.25rem)] font-display font-bold tracking-tight truncate">
                {currentTrack?.title ?? ''}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-[clamp(0.875rem,1.3vw,1.25rem)] h-[clamp(0.875rem,1.3vw,1.25rem)] text-muted-foreground flex-shrink-0" />
              <p className="text-[clamp(1rem,2vw,1.75rem)] text-primary truncate">
                {currentTrack?.artistName ?? ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Disc3 className="w-[clamp(0.875rem,1.3vw,1.25rem)] h-[clamp(0.875rem,1.3vw,1.25rem)] text-muted-foreground flex-shrink-0" />
              <p className="text-[clamp(0.875rem,1.5vw,1.375rem)] text-muted-foreground truncate">
                {currentTrack?.albumTitle ?? ''}
              </p>
            </div>
          </div>
        </div>

        {/* MIDDLE: Karaoke Lyrics */}
        <div className="border-l border-r border-border/20 flex flex-col overflow-hidden" style={{ flex: `${colFlex[1]} 0 0%` }}>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/20 flex-shrink-0">
            <Mic2 className="w-4 h-4 text-accent" />
            <h3 className="text-[clamp(0.75rem,1vw,0.875rem)] font-display font-semibold text-muted-foreground">Lyrics</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            {lyricsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground text-[clamp(0.875rem,1.3vw,1.125rem)]">Searching for lyrics...</span>
              </div>
            ) : (
              <KaraokeLyrics lyrics={lyrics} currentTime={currentTime} duration={duration} />
            )}
          </div>
        </div>

        {/* RIGHT: Queue - auto-sized to fit ~10 items */}
        <div className="flex flex-col overflow-hidden" style={{ flex: `${colFlex[2]} 0 0%` }}>
          <div className="px-4 py-2 border-b border-border/20 flex-shrink-0">
            <h3 className="text-[clamp(0.75rem,1.2vw,1rem)] font-display font-semibold flex items-center gap-2">
              <ListMusic className="w-[clamp(0.875rem,1.2vw,1.125rem)] h-[clamp(0.875rem,1.2vw,1.125rem)] text-primary" />
              Queue
              <span className="text-[clamp(0.55rem,0.8vw,0.75rem)] text-muted-foreground ml-auto">{upcomingTracks.length} upcoming</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Previously played */}
            {prevTracks.length > 0 && (
              <>
                <div className="px-3 py-1 bg-secondary/20 border-b border-border/10">
                  <p className="text-[clamp(0.6rem,0.85vw,0.75rem)] text-muted-foreground font-medium flex items-center gap-1">
                    <History className="w-[clamp(0.6rem,0.85vw,0.75rem)] h-[clamp(0.6rem,0.85vw,0.75rem)]" /> Previously Played
                  </p>
                </div>
                <div className="divide-y divide-border/10 opacity-50">
                  {prevTracks.map((track: TrackInfo, i: number) => (
                    <button
                      key={`prev-${track.id}-${i}`}
                      onClick={() => playQueue(queue, queueIndex - prevTracks.length + i)}
                      className="flex items-center gap-2 px-3 py-[clamp(0.25rem,0.6vh,0.5rem)] hover:bg-secondary/50 transition-colors w-full text-left"
                    >
                      <div className="w-[clamp(2rem,3vw,3rem)] h-[clamp(2rem,3vw,3rem)] rounded overflow-hidden bg-secondary flex-shrink-0">
                        <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={80} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[clamp(0.75rem,1.1vw,1rem)] font-medium truncate">{track?.title ?? ''}</p>
                        <p className="text-[clamp(0.6rem,0.85vw,0.8rem)] text-muted-foreground truncate">{track?.artistName ?? ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Now playing indicator */}
            <div className="px-3 py-[clamp(0.375rem,0.8vh,0.625rem)] bg-primary/10 border-y border-primary/20">
              <div className="flex items-center gap-2">
                <div className="w-[clamp(2.25rem,3.5vw,3.5rem)] h-[clamp(2.25rem,3.5vw,3.5rem)] rounded overflow-hidden bg-secondary flex-shrink-0 ring-2 ring-primary">
                  <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={80} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[clamp(0.8rem,1.2vw,1.125rem)] font-bold truncate text-primary">{currentTrack?.title ?? ''}</p>
                  <p className="text-[clamp(0.65rem,0.9vw,0.8rem)] text-muted-foreground truncate">{currentTrack?.artistName ?? ''}</p>
                </div>
                <span className="text-[clamp(0.65rem,0.9vw,0.8rem)] font-bold text-primary">NOW</span>
              </div>
            </div>

            {/* Upcoming - limited visible count */}
            {visibleUpcoming.length === 0 && remainingUpcoming.length === 0 ? (
              <div className="text-center py-4">
                <Music2 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1" />
                <p className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground">Queue is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {visibleUpcoming.map((track: TrackInfo, i: number) => (
                  <button
                    key={`${track.id}-${i}`}
                    onClick={() => playQueue(queue, queueIndex + 1 + i)}
                    className="flex items-center gap-2 px-3 py-[clamp(0.25rem,0.6vh,0.5rem)] hover:bg-secondary/50 transition-colors w-full text-left"
                  >
                    <span className="w-[clamp(1rem,1.5vw,1.5rem)] text-center text-[clamp(0.65rem,0.9vw,0.8rem)] text-muted-foreground">{i + 1}</span>
                    <div className="w-[clamp(2rem,3vw,3rem)] h-[clamp(2rem,3vw,3rem)] rounded overflow-hidden bg-secondary flex-shrink-0">
                      <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[clamp(0.75rem,1.1vw,1rem)] font-medium truncate">{track?.title ?? ''}</p>
                      <p className="text-[clamp(0.6rem,0.85vw,0.8rem)] text-muted-foreground truncate">{track?.artistName ?? ''}</p>
                    </div>
                    <span className="text-[clamp(0.6rem,0.85vw,0.75rem)] text-muted-foreground">{formatDuration(track?.duration)}</span>
                  </button>
                ))}
                {remainingUpcoming.length > 0 && (
                  <div className="px-3 py-2 text-center">
                    <p className="text-[clamp(0.6rem,0.85vw,0.75rem)] text-muted-foreground">+ {remainingUpcoming.length} more</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM: EQ + Player bar */}
      <div className="flex-shrink-0 border-t border-border/20 bg-background/80 backdrop-blur-sm">
        <div className="px-4 py-1">
          <LEDEqualizer analyserNode={analyserNode} isPlaying={isPlaying} bandCount={eqBands} colorScheme={eqColorScheme} />
        </div>
        <div className="px-4 py-2 border-t border-border/10">
          <div
            className="h-1.5 bg-muted/50 rounded-full cursor-pointer group mb-2"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const pct = x / rect.width;
              seek(pct * duration);
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all group-hover:h-2"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-center gap-4">
            <span className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground font-mono w-12 text-right">{formatTime(currentTime)}</span>
            <button onClick={prevTrack} className="w-[clamp(2.25rem,3vw,3rem)] h-[clamp(2.25rem,3vw,3rem)] rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
              <SkipBack className="w-[clamp(1.125rem,1.5vw,1.5rem)] h-[clamp(1.125rem,1.5vw,1.5rem)]" />
            </button>
            <button onClick={togglePlay} className="w-[clamp(3rem,4vw,4rem)] h-[clamp(3rem,4vw,4rem)] rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg">
              {isPlaying ? (
                <svg className="w-[clamp(1.25rem,1.8vw,1.75rem)] h-[clamp(1.25rem,1.8vw,1.75rem)] text-primary-foreground" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <Play className="w-[clamp(1.25rem,1.8vw,1.75rem)] h-[clamp(1.25rem,1.8vw,1.75rem)] text-primary-foreground ml-0.5" />
              )}
            </button>
            <button onClick={nextTrack} className="w-[clamp(2.25rem,3vw,3rem)] h-[clamp(2.25rem,3vw,3rem)] rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
              <SkipForward className="w-[clamp(1.125rem,1.5vw,1.5rem)] h-[clamp(1.125rem,1.5vw,1.5rem)]" />
            </button>
            <span className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground font-mono w-12">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
