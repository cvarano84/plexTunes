"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Music2 } from 'lucide-react';

/* ─── Types ──────────────────────────────────────── */
interface NowPlayingData {
  currentTrack: {
    id: string; title: string; artistName: string; albumTitle: string;
    thumb: string | null; duration: number | null; year?: number | null;
  } | null;
  isPlaying: boolean;
  currentTime: number;
  publishedAt: number;
  queue: { id: string; title: string; artistName: string; thumb: string | null; duration: number | null }[];
  queueIndex: number;
  currentStationName: string | null;
  jukeboxTitle: string;
}

interface TimedLine { time: number; text: string; }

/* ─── Helpers ──────────────────────────────────────── */
function parseSyncedLyrics(raw: string): TimedLine[] {
  const lines: TimedLine[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (m) {
      const secs = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 3 ? 1000 : 100);
      lines.push({ time: secs, text: m[4] });
    }
  }
  return lines;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function PlexImg({ thumb, alt, className }: { thumb: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (!thumb || err) {
    return <div className={`bg-zinc-800 flex items-center justify-center ${className ?? ''}`}><Music2 className="w-1/3 h-1/3 text-zinc-600" /></div>;
  }
  const src = `/api/plex/image?thumb=${encodeURIComponent(thumb)}&w=800&h=800`;
  return <img src={src} alt={alt} className={className} onError={() => setErr(true)} draggable={false} />;
}

/* ─── TV Display Page ──────────────────────────────── */
export default function TVPage() {
  const [np, setNp] = useState<NowPlayingData | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLyrics, setSyncedLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const lastTrackRef = useRef<string>('');
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Poll remote state every 2 seconds
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/remote/state');
        const data = await res?.json?.();
        if (!active) return;
        if (data?.state) {
          setNp(data.state);
          // Estimate current time accounting for poll delay
          const elapsed = (Date.now() - (data.state.publishedAt ?? Date.now())) / 1000;
          setLocalTime(Math.max(0, (data.state.currentTime ?? 0) + (data.state.isPlaying ? elapsed : 0)));
        }
      } catch { /* ignore */ }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  // Tick local time forward
  useEffect(() => {
    if (!np?.isPlaying) return;
    const iv = setInterval(() => setLocalTime(t => t + 0.25), 250);
    return () => clearInterval(iv);
  }, [np?.isPlaying]);

  // Fetch lyrics when track changes
  useEffect(() => {
    const track = np?.currentTrack;
    if (!track?.title || !track?.artistName) { setLyrics(null); setSyncedLyrics(null); return; }
    const key = `${track.title}|${track.artistName}`;
    if (key === lastTrackRef.current) return;
    lastTrackRef.current = key;
    setLyricsLoading(true);
    setLyrics(null);
    setSyncedLyrics(null);
    const params = new URLSearchParams({ title: track.title, artist: track.artistName });
    if (track.albumTitle) params.set('album', track.albumTitle);
    if (track.duration) params.set('duration', String(track.duration));
    fetch(`/api/lyrics?${params}`)
      .then(r => r?.json?.())
      .then(data => { setLyrics(data?.lyrics ?? null); setSyncedLyrics(data?.syncedLyrics ?? null); })
      .catch(() => { setLyrics(null); setSyncedLyrics(null); })
      .finally(() => setLyricsLoading(false));
  }, [np?.currentTrack?.title, np?.currentTrack?.artistName]);

  const timedLines = useMemo(() => syncedLyrics ? parseSyncedLyrics(syncedLyrics) : [], [syncedLyrics]);

  const currentLineIdx = useMemo(() => {
    if (timedLines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < timedLines.length; i++) {
      if (timedLines[i].time <= localTime + 0.3) idx = i;
    }
    return idx;
  }, [timedLines, localTime]);

  // Auto-scroll lyrics to current line
  const scrollToLine = useCallback((idx: number) => {
    const container = lyricsContainerRef.current;
    if (!container || idx < 0) return;
    const el = container.querySelector(`[data-line="${idx}"]`) as HTMLElement;
    if (el) {
      const containerH = container.clientHeight;
      const targetTop = el.offsetTop - containerH / 3;
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => { scrollToLine(currentLineIdx); }, [currentLineIdx, scrollToLine]);

  const track = np?.currentTrack;
  const duration = track?.duration ? track.duration / 1000 : 0;
  const progress = duration > 0 ? Math.min(100, (localTime / duration) * 100) : 0;
  const upcoming = (np?.queue ?? []).slice((np?.queueIndex ?? 0) + 1, (np?.queueIndex ?? 0) + 6);

  // Idle / nothing playing screen
  if (!track) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
        <Music2 className="w-24 h-24 text-zinc-700 mb-6" />
        <h1 className="text-4xl font-bold text-zinc-500">HomeBarr Tunes</h1>
        <p className="text-xl text-zinc-600 mt-2">Waiting for playback...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden select-none">
      {/* Main content: 3 columns — Art | Lyrics | Queue */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT: Album art + track info */}
        <div className="flex flex-col items-center justify-center px-8" style={{ flex: '0 0 32%' }}>
          {/* Year */}
          {track.year && (
            <div className="self-start mb-2">
              <span className="text-5xl font-bold text-zinc-400 tracking-wider">{track.year}</span>
            </div>
          )}
          {/* Album art */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ width: 'min(35vh, 400px)', height: 'min(35vh, 400px)' }}>
            <PlexImg thumb={track.thumb} alt={track.title} className="w-full h-full object-cover" />
          </div>
          {/* Track info */}
          <div className="mt-4 w-full max-w-sm text-center space-y-1">
            <h2 className="text-3xl font-bold truncate">{track.title}</h2>
            <p className="text-xl text-purple-400 truncate">{track.artistName}</p>
            <p className="text-sm text-zinc-500 truncate">{track.albumTitle}</p>
          </div>
          {/* Station name */}
          {np?.currentStationName && (
            <div className="mt-3 px-4 py-1.5 rounded-full bg-purple-900/40 border border-purple-700/30">
              <span className="text-sm text-purple-300">📻 {np.currentStationName}</span>
            </div>
          )}
        </div>

        {/* CENTER: Lyrics */}
        <div className="flex-1 flex flex-col min-h-0 py-6">
          <div className="text-sm text-zinc-500 font-medium mb-2 px-4">🎤 Lyrics</div>
          <div
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto scrollbar-none px-4 relative"
            style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)' }}
          >
            {timedLines.length > 0 ? (
              <div className="py-[30vh] space-y-3">
                {timedLines.map((line, i) => {
                  const isCurrent = i === currentLineIdx;
                  const isPast = i < currentLineIdx;
                  return (
                    <p
                      key={i}
                      data-line={i}
                      className={`text-center transition-all duration-500 leading-relaxed ${
                        isCurrent
                          ? 'text-white text-4xl font-bold scale-105'
                          : isPast
                            ? 'text-zinc-600 text-2xl'
                            : 'text-zinc-500 text-2xl'
                      }`}
                      style={{ transform: isCurrent ? 'scale(1.03)' : 'scale(1)' }}
                    >
                      {line.text || '\u266A'}
                    </p>
                  );
                })}
              </div>
            ) : lyrics ? (
              <div className="py-8 space-y-2">
                {lyrics.split('\n').map((line, i) => (
                  <p key={i} className="text-center text-xl text-zinc-400 leading-relaxed">{line || '\u00A0'}</p>
                ))}
              </div>
            ) : lyricsLoading ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-zinc-600 text-xl animate-pulse">Loading lyrics...</p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <Music2 className="w-16 h-16 text-zinc-800" />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Queue */}
        <div className="flex flex-col py-6 pr-6" style={{ flex: '0 0 24%' }}>
          <div className="text-sm text-zinc-500 font-medium mb-3">Up Next</div>
          <div className="flex-1 overflow-y-auto scrollbar-none space-y-2">
            {upcoming.length > 0 ? upcoming.map((item, i) => (
              <div key={`${item.id}-${i}`} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                  <PlexImg thumb={item.thumb} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{item.artistName}</p>
                </div>
                {item.duration && (
                  <span className="text-xs text-zinc-600 tabular-nums">{formatTime(item.duration / 1000)}</span>
                )}
              </div>
            )) : (
              <p className="text-zinc-700 text-sm">No upcoming tracks</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Progress bar */}
      <div className="flex-shrink-0 px-6 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 tabular-nums w-12 text-right">{formatTime(localTime)}</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 tabular-nums w-12">{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
}
