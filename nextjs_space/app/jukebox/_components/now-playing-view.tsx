"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music2, Loader2, Mic2, ListMusic, Play, SkipForward, SkipBack } from 'lucide-react';
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

    // Try to connect Web Audio API
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

    // Init fallback bars
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
          // Fallback: simulate EQ with smooth random
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
      width={800}
      height={80}
      className="w-full h-16 rounded-lg"
    />
  );
}

export default function NowPlayingView() {
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

  if (!currentTrack) {
    return (
      <div className="mx-auto px-6 py-16 text-center">
        <Music2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-display font-bold mb-2">Nothing Playing</h2>
        <p className="text-muted-foreground">Pick a song or station to start listening</p>
      </div>
    );
  }

  // Upcoming tracks from queue
  const upcomingTracks = queue.slice(queueIndex + 1, queueIndex + 50);

  return (
    <div className="flex flex-col h-full">
      {/* Main content: Now Playing + Queue side by side */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Now Playing side */}
        <div className="flex-1 flex flex-col items-center px-6 py-4 overflow-y-auto">
          <div className="flex items-center gap-6 w-full max-w-[700px]">
            {/* Album art + Technics turntable */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative flex-shrink-0"
            >
              {/* Turntable platter */}
              <div className="w-[200px] h-[200px] relative">
                {/* Platter base - silver ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900 shadow-2xl" />
                {/* Platter dots (speed markers) */}
                <div className="absolute inset-[3px] rounded-full border border-zinc-600/30" />
                {/* Record */}
                <div className={`absolute inset-[8px] rounded-full overflow-hidden ${isPlaying ? 'animate-vinyl' : ''}`}
                  style={{ animationDuration: '2s' }}
                >
                  {/* Vinyl grooves */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zinc-900 via-black to-zinc-900" />
                  <div className="absolute inset-[20%] rounded-full overflow-hidden album-art-glow">
                    <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={400} />
                  </div>
                  {/* Center spindle */}
                  <div className="absolute inset-[45%] rounded-full bg-zinc-700 border-2 border-zinc-500 shadow-inner" />
                  {/* Groove lines */}
                  <div className="absolute inset-[12%] rounded-full border border-zinc-800/40" />
                  <div className="absolute inset-[16%] rounded-full border border-zinc-800/30" />
                  <div className="absolute inset-[38%] rounded-full border border-zinc-800/30" />
                  <div className="absolute inset-[42%] rounded-full border border-zinc-800/20" />
                </div>
                {/* Tonearm */}
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-zinc-500 shadow-lg z-10" />
                <div className={`absolute top-0 right-1 w-1 h-[90px] bg-zinc-500 rounded-full origin-top z-10 transition-transform duration-700 ${isPlaying ? 'rotate-[25deg]' : 'rotate-[5deg]'}`} />
              </div>
            </motion.div>

            {/* Track info + controls */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-display font-bold tracking-tight truncate">
                {currentTrack?.title ?? ''}
              </h2>
              <p className="text-base text-primary truncate mt-0.5">
                {currentTrack?.artistName ?? ''}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {currentTrack?.albumTitle ?? ''}
              </p>

              {/* Progress */}
              <div className="mt-3">
                <div
                  className="h-1.5 bg-muted/50 rounded-full cursor-pointer group"
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
                <div className="flex justify-between text-xs text-muted-foreground font-mono mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-3 mt-2">
                <button onClick={prevTrack} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg">
                  {isPlaying ? (
                    <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  ) : (
                    <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
                  )}
                </button>
                <button onClick={nextTrack} className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors">
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Lyrics */}
          <div className="w-full max-w-[700px] mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-display font-semibold text-muted-foreground">Lyrics</h3>
            </div>
            <div className="bg-card/50 rounded-xl p-4 border border-border/30 min-h-[150px] max-h-[250px] overflow-y-auto lyrics-scroll">
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
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Mic2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">No lyrics available</p>
                </div>
              )}
            </div>
          </div>

          {/* LED Equalizer */}
          <div className="w-full max-w-[700px] mt-4">
            <LEDEqualizer audioRef={audioRef} isPlaying={isPlaying} />
          </div>
        </div>

        {/* Queue side */}
        <div className="w-[340px] flex-shrink-0 border-l border-border/30 flex flex-col bg-card/30">
          <div className="px-4 py-3 border-b border-border/20">
            <h3 className="text-sm font-display font-semibold flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-primary" />
              Up Next
              <span className="text-xs text-muted-foreground ml-auto">{upcomingTracks.length} tracks</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {upcomingTracks.length === 0 ? (
              <div className="text-center py-12">
                <Music2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
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
    </div>
  );
}
