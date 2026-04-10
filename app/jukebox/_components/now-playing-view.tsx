"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Music2, Loader2, Mic2, ListMusic, Play, SkipForward, SkipBack, History, Disc3, User, Album, Calendar } from 'lucide-react';
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

// Zoom level font sizes: [active, inactive] in clamp values
const LYRICS_ZOOM_LEVELS: Record<number, { active: string; inactive: string; lineHeight: string; gap: string }> = {
  1: { active: 'clamp(0.9rem,1.5vw,1.25rem)', inactive: 'clamp(0.75rem,1.2vw,1rem)', lineHeight: '1.5', gap: '0.5rem' },
  2: { active: 'clamp(1.1rem,2vw,1.75rem)', inactive: 'clamp(0.875rem,1.5vw,1.25rem)', lineHeight: '1.45', gap: '0.625rem' },
  3: { active: 'clamp(1.35rem,2.5vw,2.25rem)', inactive: 'clamp(1rem,1.8vw,1.5rem)', lineHeight: '1.4', gap: '0.75rem' },
  4: { active: 'clamp(1.75rem,3.2vw,3rem)', inactive: 'clamp(1.25rem,2.2vw,2rem)', lineHeight: '1.35', gap: '1rem' },
  5: { active: 'clamp(2.25rem,4vw,4rem)', inactive: 'clamp(1.5rem,2.8vw,2.5rem)', lineHeight: '1.3', gap: '1.25rem' },
};

// Parse LRC format timestamps: [mm:ss.xx] text -> { time: seconds, text: string }
interface TimedLine { time: number; text: string; }
function parseLRC(lrc: string): TimedLine[] {
  const lines: TimedLine[] = [];
  for (const raw of lrc.split('\n')) {
    const match = raw.match(/^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
      const time = mins * 60 + secs + ms / 1000;
      const text = match[4]?.trim() ?? '';
      if (text.length > 0) {
        lines.push({ time, text });
      }
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

// Smooth-scrolling lyrics component - supports both synced (LRC) and plain lyrics
function KaraokeLyrics({ lyrics, syncedLyrics, currentTime, duration, zoom = 3 }: {
  lyrics: string | null;
  syncedLyrics: string | null;
  currentTime: number;
  duration: number;
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const lastScrollTime = useRef(0);

  // Parse synced lyrics if available, otherwise split plain lyrics
  const timedLines = useMemo<TimedLine[]>(() => {
    if (syncedLyrics) {
      const parsed = parseLRC(syncedLyrics);
      if (parsed.length > 0) return parsed;
    }
    // Fall back to plain lyrics with estimated timing
    if (lyrics) {
      const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0 && duration > 0) {
        const interval = duration / lines.length;
        return lines.map((text, i) => ({ time: i * interval, text }));
      }
      return lines.map((text, i) => ({ time: i, text }));
    }
    return [];
  }, [syncedLyrics, lyrics, duration]);

  const hasSyncedTiming = useMemo(() => {
    if (!syncedLyrics) return false;
    return parseLRC(syncedLyrics).length > 0;
  }, [syncedLyrics]);

  // Reset refs when lines change
  useEffect(() => {
    lineRefs.current = new Array(timedLines.length).fill(null);
  }, [timedLines.length]);

  // Track active line based on actual timestamps (synced) or estimation (plain)
  useEffect(() => {
    if (timedLines.length === 0) {
      setActiveLineIdx(0);
      return;
    }
    // Binary search for the line at currentTime
    let idx = 0;
    for (let i = timedLines.length - 1; i >= 0; i--) {
      if (currentTime >= timedLines[i].time) {
        idx = i;
        break;
      }
    }
    setActiveLineIdx(idx);
  }, [currentTime, timedLines]);

  // Smooth scroll to active line - centered in container
  useEffect(() => {
    const container = containerRef.current;
    const activeLine = lineRefs.current[activeLineIdx];
    if (!container || !activeLine) return;

    const now = Date.now();
    if (now - lastScrollTime.current < 400) return;
    lastScrollTime.current = now;

    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const containerCenter = containerRect.height / 2;
    const lineCenter = lineRect.top - containerRect.top + lineRect.height / 2;
    const scrollOffset = lineCenter - containerCenter;

    container.scrollBy({
      top: scrollOffset,
      behavior: 'smooth',
    });
  }, [activeLineIdx]);

  const zoomConfig = LYRICS_ZOOM_LEVELS[zoom] ?? LYRICS_ZOOM_LEVELS[3];

  if (timedLines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <Mic2 className="w-[clamp(2rem,4vw,3.5rem)] h-[clamp(2rem,4vw,3.5rem)] text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground text-[clamp(0.875rem,1.5vw,1.25rem)]">No lyrics available</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-6 py-8"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        scrollbarWidth: 'none',
      }}
    >
      <div style={{ height: '40%' }} />
      <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: zoomConfig.gap }}>
        {timedLines.map((line, i) => {
          const isActive = i === activeLineIdx;
          const distance = Math.abs(i - activeLineIdx);
          const opacity = isActive ? 1 : Math.max(0.15, 1 - distance * 0.15);

          return (
            <p
              key={`${i}-${line.text.slice(0, 15)}`}
              ref={(el) => { lineRefs.current[i] = el; }}
              className="font-display transition-all duration-700 ease-out"
              style={{
                fontSize: isActive ? zoomConfig.active : zoomConfig.inactive,
                lineHeight: zoomConfig.lineHeight,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                opacity,
                transform: isActive ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {line.text}
            </p>
          );
        })}
      </div>
      <div style={{ height: '40%' }} />
      {/* Source indicator */}
      {hasSyncedTiming && (
        <div className="text-center pb-2">
          <span className="text-[clamp(0.5rem,0.7vw,0.625rem)] text-muted-foreground/30 uppercase tracking-widest">synced</span>
        </div>
      )}
    </div>
  );
}

interface NowPlayingViewProps {
  eqBands?: number;
  eqColorScheme?: string;
  previousTrackCount?: number;
  columnLayout?: string;
  lyricsZoom?: number;
}

export default function NowPlayingView({ eqBands = 32, eqColorScheme = 'classic', previousTrackCount = 3, columnLayout = 'balanced', lyricsZoom = 3 }: NowPlayingViewProps) {
  const {
    currentTrack, isPlaying, queue, queueIndex, currentTime, duration,
    togglePlay, nextTrack, prevTrack, seek, playQueue, analyserNode
  } = usePlayer();
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [trackSummary, setTrackSummary] = useState<string>('');

  useEffect(() => {
    if (!currentTrack?.title || !currentTrack?.artistName) {
      setLyrics(null);
      setSyncedLyrics(null);
      return;
    }
    setLyricsLoading(true);
    setLyrics(null);
    setSyncedLyrics(null);
    const params = new URLSearchParams({
      title: currentTrack.title,
      artist: currentTrack.artistName,
    });
    if (currentTrack.albumTitle) params.set('album', currentTrack.albumTitle);
    if (currentTrack.duration) params.set('duration', String(currentTrack.duration));
    fetch(`/api/lyrics?${params}`)
      .then(r => r?.json?.())
      .then(data => {
        setLyrics(data?.lyrics ?? null);
        setSyncedLyrics(data?.syncedLyrics ?? null);
      })
      .catch(() => { setLyrics(null); setSyncedLyrics(null); })
      .finally(() => setLyricsLoading(false));
  }, [currentTrack?.title, currentTrack?.artistName, currentTrack?.albumTitle, currentTrack?.duration]);

  // Fetch track summary from Wikipedia (cached in DB)
  useEffect(() => {
    setTrackSummary('');
    if (!currentTrack?.id) return;
    fetch(`/api/tracks/summary?trackId=${encodeURIComponent(currentTrack.id)}`)
      .then(r => r?.json?.())
      .then(data => setTrackSummary(data?.summary ?? ''))
      .catch(() => setTrackSummary(''));
  }, [currentTrack?.id]);

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
        {/* LEFT: Year + Album art + vinyl + track info + summary */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 gap-2 overflow-hidden" style={{ flex: `${colFlex[0]} 0 0%` }}>
          {/* Release year - large and prominent above art */}
          {currentTrack?.year ? (
            <div className="flex items-center gap-2">
              <Calendar className="w-[clamp(1rem,1.5vw,1.5rem)] h-[clamp(1rem,1.5vw,1.5rem)] text-primary/70" />
              <span className="text-[clamp(1.5rem,3vw,3rem)] font-display font-bold text-primary/80 tracking-wider">
                {currentTrack.year}
              </span>
            </div>
          ) : null}

          {/* Square album art */}
          <div className="relative rounded-xl overflow-hidden shadow-2xl" style={{ width: 'clamp(180px, 22vw, 420px)', height: 'clamp(180px, 22vw, 420px)' }}>
            <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={600} />
          </div>

          {/* Spinning vinyl below the art */}
          <div className="relative" style={{ width: 'clamp(60px, 6vw, 110px)', height: 'clamp(60px, 6vw, 110px)' }}>
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
              style={{ height: 'clamp(30px, 4vw, 60px)' }}
            />
          </div>

          {/* Track info with monochrome icons */}
          <div className="w-full px-2 space-y-1">
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

          {/* Wikipedia summary - small font for the person standing at the jukebox */}
          {trackSummary ? (
            <div className="w-full px-2 mt-1">
              <p className="text-[clamp(0.6rem,0.8vw,0.75rem)] text-muted-foreground/70 leading-relaxed line-clamp-4">
                {trackSummary}
              </p>
            </div>
          ) : null}
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
              <KaraokeLyrics lyrics={lyrics} syncedLyrics={syncedLyrics} currentTime={currentTime} duration={duration} zoom={lyricsZoom} />
            )}
          </div>
        </div>

        {/* RIGHT: Queue - larger items to fill the column */}
        <div className="flex flex-col overflow-hidden" style={{ flex: `${colFlex[2]} 0 0%` }}>
          <div className="px-4 py-2 border-b border-border/20 flex-shrink-0">
            <h3 className="text-[clamp(0.875rem,1.4vw,1.25rem)] font-display font-semibold flex items-center gap-2">
              <ListMusic className="w-[clamp(1rem,1.4vw,1.25rem)] h-[clamp(1rem,1.4vw,1.25rem)] text-primary" />
              Queue
              <span className="text-[clamp(0.65rem,1vw,0.875rem)] text-muted-foreground ml-auto">{upcomingTracks.length} upcoming</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {/* Previously played */}
            {prevTracks.length > 0 && (
              <>
                <div className="px-4 py-2 bg-secondary/20 border-b border-border/10">
                  <p className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground font-medium flex items-center gap-1.5">
                    <History className="w-[clamp(0.7rem,1vw,0.875rem)] h-[clamp(0.7rem,1vw,0.875rem)]" /> Previously Played
                  </p>
                </div>
                <div className="divide-y divide-border/10 opacity-50">
                  {prevTracks.map((track: TrackInfo, i: number) => (
                    <button
                      key={`prev-${track.id}-${i}`}
                      onClick={() => playQueue(queue, queueIndex - prevTracks.length + i)}
                      className="flex items-center gap-3 px-4 py-[clamp(0.5rem,1vh,0.75rem)] hover:bg-secondary/50 transition-colors w-full text-left"
                    >
                      <div className="w-[clamp(2.5rem,4vw,4rem)] h-[clamp(2.5rem,4vw,4rem)] rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                        <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={120} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[clamp(0.875rem,1.3vw,1.125rem)] font-medium truncate">{track?.title ?? ''}</p>
                        <p className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground truncate">{track?.artistName ?? ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Now playing indicator */}
            <div className="px-4 py-[clamp(0.5rem,1vh,0.75rem)] bg-primary/10 border-y border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-[clamp(3rem,4.5vw,4.5rem)] h-[clamp(3rem,4.5vw,4.5rem)] rounded-lg overflow-hidden bg-secondary flex-shrink-0 ring-2 ring-primary">
                  <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={120} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[clamp(0.9rem,1.4vw,1.25rem)] font-bold truncate text-primary">{currentTrack?.title ?? ''}</p>
                  <p className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground truncate">{currentTrack?.artistName ?? ''}</p>
                </div>
                <span className="text-[clamp(0.75rem,1.1vw,1rem)] font-bold text-primary">NOW</span>
              </div>
            </div>

            {/* Upcoming - limited visible count */}
            {visibleUpcoming.length === 0 && remainingUpcoming.length === 0 ? (
              <div className="text-center py-6">
                <Music2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[clamp(0.8rem,1.2vw,1rem)] text-muted-foreground">Queue is empty</p>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {visibleUpcoming.map((track: TrackInfo, i: number) => (
                  <button
                    key={`${track.id}-${i}`}
                    onClick={() => playQueue(queue, queueIndex + 1 + i)}
                    className="flex items-center gap-3 px-4 py-[clamp(0.5rem,1vh,0.75rem)] hover:bg-secondary/50 transition-colors w-full text-left"
                  >
                    <span className="w-[clamp(1.25rem,1.8vw,1.75rem)] text-center text-[clamp(0.75rem,1.1vw,1rem)] text-muted-foreground">{i + 1}</span>
                    <div className="w-[clamp(2.5rem,4vw,4rem)] h-[clamp(2.5rem,4vw,4rem)] rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                      <PlexImage thumb={track?.thumb} alt={track?.title ?? ''} size={120} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[clamp(0.875rem,1.3vw,1.125rem)] font-medium truncate">{track?.title ?? ''}</p>
                      <p className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground truncate">{track?.artistName ?? ''}</p>
                    </div>
                    <span className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground">{formatDuration(track?.duration)}</span>
                  </button>
                ))}
                {remainingUpcoming.length > 0 && (
                  <div className="px-4 py-3 text-center">
                    <p className="text-[clamp(0.7rem,1vw,0.875rem)] text-muted-foreground">+ {remainingUpcoming.length} more</p>
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
