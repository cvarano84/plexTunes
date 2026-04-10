"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music2, Loader2, Mic2, ListMusic, Play, SkipForward, SkipBack, History } from 'lucide-react';
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

// LED Equalizer component
function LEDEqualizer({ audioRef, isPlaying, bandCount = 32, colorScheme = 'classic' }: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  bandCount?: number;
  colorScheme?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animRef = useRef<number>(0);
  const fallbackBarsRef = useRef<number[]>([]);

  const getBarColor = useCallback((normalizedHeight: number, _bandIndex: number, totalBands: number) => {
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
    // Classic green/yellow/red
    if (normalizedHeight > 0.85) return '#ef4444';
    if (normalizedHeight > 0.65) return '#eab308';
    return '#22c55e';
  }, [colorScheme]);

  useEffect(() => {
    const audio = audioRef?.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    if (!audioContextRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceRef.current = source;
        analyserRef.current = analyser;
      } catch {
        // Audio element may already be connected - use fallback
      }
    }

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
      if (analyserRef.current) {
        dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < bars; i++) {
        let value: number;
        if (dataArray) {
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
            ctx.fillStyle = getBarColor(normalizedH, i, bars);
            ctx.shadowColor = getBarColor(normalizedH, i, bars);
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
  }, [audioRef, isPlaying, bandCount, getBarColor]);

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={80}
      className="w-full h-16 rounded-lg"
    />
  );
}

interface NowPlayingViewProps {
  eqBands?: number;
  eqColorScheme?: string;
  previousTrackCount?: number;
  columnLayout?: string;
}

export default function NowPlayingView({ eqBands = 32, eqColorScheme = 'classic', previousTrackCount = 5, columnLayout = 'balanced' }: NowPlayingViewProps) {
  const {
    currentTrack, isPlaying, queue, queueIndex, currentTime, duration,
    togglePlay, nextTrack, prevTrack, seek, playQueue, audioRef
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
      .then(data => {
        setLyrics(data?.lyrics ?? null);
      })
      .catch(() => setLyrics(null))
      .finally(() => setLyricsLoading(false));
  }, [currentTrack?.title, currentTrack?.artistName]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Column flex values based on layout preset
  const colFlex = columnLayout === 'lyrics' ? [25, 50, 25]
    : columnLayout === 'art' ? [40, 35, 25]
    : [30, 40, 30]; // balanced

  if (!currentTrack) {
    return (
      <div className="mx-auto px-6 py-16 text-center">
        <Music2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold mb-2">Nothing Playing</h2>
        <p className="text-muted-foreground">Pick a song or station to start listening</p>
      </div>
    );
  }

  // Previous + upcoming tracks from queue
  const prevTracks = queue.slice(Math.max(0, queueIndex - previousTrackCount), queueIndex);
  const upcomingTracks = queue.slice(queueIndex + 1, queueIndex + 50);

  return (
    <div className="flex flex-col h-full">
      {/* 3-column main content */}
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        {/* LEFT: Album art + spinning vinyl */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-4" style={{ flex: `${colFlex[0]} 0 0%` }}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            {/* Turntable */}
            <div className="w-[280px] h-[280px] relative">
              {/* Platter base */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900 shadow-2xl" />
              <div className="absolute inset-[3px] rounded-full border border-zinc-600/30" />
              {/* Record */}
              <div className={`absolute inset-[8px] rounded-full overflow-hidden ${isPlaying ? 'animate-vinyl' : ''}`}
                style={{ animationDuration: '2s' }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
                <div className="absolute inset-[20%] rounded-full overflow-hidden album-art-glow">
                  <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={400} />
                </div>
                <div className="absolute inset-[45%] rounded-full bg-zinc-700 border-2 border-zinc-500 shadow-inner" />
                <div className="absolute inset-[12%] rounded-full border border-zinc-800/40" />
                <div className="absolute inset-[16%] rounded-full border border-zinc-800/30" />
                <div className="absolute inset-[38%] rounded-full border border-zinc-800/30" />
                <div className="absolute inset-[42%] rounded-full border border-zinc-800/20" />
              </div>
              {/* Tonearm */}
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-500 shadow-lg z-10" />
              <div className={`absolute top-0 right-1 w-1 h-[120px] bg-zinc-500 rounded-full origin-top z-10 transition-transform duration-700 ${isPlaying ? 'rotate-[25deg]' : 'rotate-[5deg]'}`} />
            </div>
          </motion.div>

          {/* Track info below turntable */}
          <div className="mt-4 text-center w-full max-w-[300px]">
            <h2 className="text-xl font-display font-bold tracking-tight truncate">
              {currentTrack?.title ?? ''}
            </h2>
            <p className="text-base text-primary truncate mt-0.5">
              {currentTrack?.artistName ?? ''}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {currentTrack?.albumTitle ?? ''}
            </p>
          </div>
        </div>

        {/* MIDDLE: Lyrics */}
        <div className="border-l border-r border-border/20 flex flex-col overflow-hidden" style={{ flex: `${colFlex[1]} 0 0%` }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 flex-shrink-0">
            <Mic2 className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-display font-semibold text-muted-foreground">Lyrics</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 lyrics-scroll">
            {lyricsLoading ? (
              <div className="flex items-center justify-center h-full py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground text-sm">Searching for lyrics...</span>
              </div>
            ) : lyrics ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre-line text-foreground/90 leading-relaxed text-sm">
                {lyrics}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                <Mic2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">No lyrics available</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Queue with previous tracks */}
        <div className="flex flex-col overflow-hidden" style={{ flex: `${colFlex[2]} 0 0%` }}>
          <div className="px-4 py-3 border-b border-border/20 flex-shrink-0">
            <h3 className="text-sm font-display font-semibold flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-primary" />
              Queue
              <span className="text-xs text-muted-foreground ml-auto">{upcomingTracks.length} upcoming</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Previously played */}
            {prevTracks.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-secondary/20 border-b border-border/10">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <History className="w-3 h-3" /> Previously Played
                  </p>
                </div>
                <div className="divide-y divide-border/10 opacity-50">
                  {prevTracks.map((track: TrackInfo, i: number) => (
                    <button
                      key={`prev-${track.id}-${i}`}
                      onClick={() => playQueue(queue, queueIndex - prevTracks.length + i)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors w-full text-left group"
                    >
                      <div className="w-8 h-8 rounded overflow-hidden bg-secondary flex-shrink-0">
                        <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={80} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{track?.title ?? ''}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{track?.artistName ?? ''}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatDuration(track?.duration)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Now playing indicator */}
            <div className="px-3 py-2 bg-primary/10 border-y border-primary/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded overflow-hidden bg-secondary flex-shrink-0 ring-2 ring-primary">
                  <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={80} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate text-primary">{currentTrack?.title ?? ''}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{currentTrack?.artistName ?? ''}</p>
                </div>
                <span className="text-[10px] font-medium text-primary">NOW</span>
              </div>
            </div>

            {/* Upcoming */}
            {upcomingTracks.length === 0 ? (
              <div className="text-center py-8">
                <Music2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Queue is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {upcomingTracks.map((track: TrackInfo, i: number) => (
                  <button
                    key={`${track.id}-${i}`}
                    onClick={() => playQueue(queue, queueIndex + 1 + i)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors w-full text-left group"
                  >
                    <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <div className="w-8 h-8 rounded overflow-hidden bg-secondary flex-shrink-0">
                      <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{track?.title ?? ''}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{track?.artistName ?? ''}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDuration(track?.duration)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EQ */}
      <div className="px-4 py-2 flex-shrink-0 border-t border-border/20">
        <LEDEqualizer audioRef={audioRef} isPlaying={isPlaying} bandCount={eqBands} colorScheme={eqColorScheme} />
      </div>

      {/* Player bar (progress + controls) */}
      <div className="px-4 py-3 flex-shrink-0 border-t border-border/20 bg-card/50">
        {/* Progress bar */}
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
          <span className="text-xs text-muted-foreground font-mono w-12 text-right">{formatTime(currentTime)}</span>
          <button onClick={prevTrack} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg">
            {isPlaying ? (
              <svg className="w-6 h-6 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            ) : (
              <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
            )}
          </button>
          <button onClick={nextTrack} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
          <span className="text-xs text-muted-foreground font-mono w-12">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
