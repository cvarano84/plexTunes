"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Music2, Settings } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

/* ─── Types ──────────────────────────────────────── */
interface NowPlayingData {
  currentTrack: {
    id: string; title: string; artistName: string; albumTitle: string;
    thumb: string | null; duration: number | null; year?: number | null;
    mediaKey?: string | null;
  } | null;
  isPlaying: boolean;
  currentTime: number;
  publishedAt: number;
  queue: { id: string; title: string; artistName: string; thumb: string | null; duration: number | null; mediaKey?: string | null }[];
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

/* ─── QR Code as raster image (SVG doesn't render on many TVs) ─── */
function QRImage({ url, size = 80 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for QRCodeCanvas to render, then grab the data URL
    const timer = setTimeout(() => {
      const canvas = canvasContainerRef.current?.querySelector('canvas');
      if (canvas) {
        try { setDataUrl(canvas.toDataURL('image/png')); } catch {}
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [url, size]);

  return (
    <>
      {/* Hidden canvas renderer */}
      <div ref={canvasContainerRef} style={{ position: 'absolute', left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }}>
        <QRCodeCanvas value={url} size={size} bgColor="#ffffff" fgColor="#000000" level="M" />
      </div>
      {/* Visible raster image */}
      {dataUrl && (
        <img src={dataUrl} alt="QR code" width={size} height={size} className="rounded-lg" style={{ imageRendering: 'pixelated' }} />
      )}
    </>
  );
}

/* ─── Animated Background (standalone, no player-context) ─── */
type BgStyle = 'aurora' | 'nebula' | 'gradient-flow';
const BG_STYLES: BgStyle[] = ['aurora', 'nebula', 'gradient-flow'];
const BG_LABELS: Record<string, string> = { 'auto': 'Auto Cycle', 'aurora': 'Aurora', 'nebula': 'Nebula', 'gradient-flow': 'Gradient Flow', 'none': 'None' };

function TVBackground({ energy, mode = 'auto' }: { energy: number; mode?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (mode === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    let running = true;
    const loop = () => {
      if (!running) return;
      const t = performance.now();
      const e = energy;

      // Use fixed style or auto-cycle every 60s
      let style: BgStyle;
      if (mode === 'auto') {
        const styleIdx = Math.floor(t / 60000) % BG_STYLES.length;
        style = BG_STYLES[styleIdx];
      } else {
        style = mode as BgStyle;
      }

      if (style === 'aurora') {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(0, 0, w, h);
        for (let l = 0; l < 4; l++) {
          const baseY = h * (0.2 + l * 0.15);
          const amp = 30 + e * 40;
          const speed = 0.0003 + l * 0.0001;
          const hue = (200 + l * 30 + t * 0.01) % 360;
          ctx.beginPath(); ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 4) {
            const y = baseY + Math.sin(x * 0.003 + t * speed) * amp + Math.sin(x * 0.007 + t * speed * 1.3) * amp * 0.5;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h); ctx.closePath();
          const grad = ctx.createLinearGradient(0, baseY - amp, 0, baseY + amp * 2);
          grad.addColorStop(0, `hsla(${hue}, 70%, 50%, ${0.03 + e * 0.06})`);
          grad.addColorStop(0.5, `hsla(${hue + 20}, 60%, 40%, ${0.02 + e * 0.04})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad; ctx.fill();
        }
      } else if (style === 'nebula') {
        ctx.fillStyle = 'rgba(0,0,0,0.02)';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 3; i++) {
          const cx = w * (0.3 + 0.2 * Math.sin(t * 0.0002 + i * 2));
          const cy = h * (0.3 + 0.2 * Math.cos(t * 0.00015 + i * 1.5));
          const r = 150 + e * 100;
          const hue = (220 + i * 40 + t * 0.005) % 360;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          grad.addColorStop(0, `hsla(${hue}, 60%, 50%, ${0.04 + e * 0.06})`);
          grad.addColorStop(0.5, `hsla(${hue + 30}, 50%, 40%, ${0.02 + e * 0.03})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      } else {
        const hue1 = (t * 0.01) % 360;
        const hue2 = (hue1 + 60 + e * 30) % 360;
        const hue3 = (hue1 + 180) % 360;
        const x1 = w * (0.5 + 0.3 * Math.sin(t * 0.0002));
        const y1 = h * (0.5 + 0.3 * Math.cos(t * 0.00015));
        const grad = ctx.createRadialGradient(x1, y1, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
        grad.addColorStop(0, `hsla(${hue1}, 50%, 15%, ${0.8 + e * 0.2})`);
        grad.addColorStop(0.5, `hsla(${hue2}, 40%, 10%, 0.9)`);
        grad.addColorStop(1, `hsla(${hue3}, 30%, 5%, 1)`);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      }

      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(frameRef.current); window.removeEventListener('resize', resize); };
  }, [energy, mode]);

  if (mode === 'none') return null;

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.35 }} />
      <div className="fixed inset-0 z-0 pointer-events-none bg-black/50" />
    </>
  );
}

/* ─── LED Equalizer (standalone, uses provided analyser) ─── */
function TVEqualizer({ analyserNode, isPlaying, bandCount = 48 }: {
  analyserNode: AnalyserNode | null; isPlaying: boolean; bandCount?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const fallbackBarsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const cw = Math.round(rect.width * dpr);
      const ch = Math.round(rect.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    };
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (fallbackBarsRef.current.length !== bandCount) fallbackBarsRef.current = Array(bandCount).fill(0);

    const draw = () => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      const dpr = window.devicePixelRatio || 1;
      const gap = Math.round(2 * dpr);
      const barW = Math.max(Math.round(2 * dpr), Math.floor((w - gap * (bandCount - 1)) / bandCount));
      const ledH = Math.round(4 * dpr);
      const ledGap = Math.round(2 * dpr);
      const maxLeds = Math.floor(h / (ledH + ledGap));

      let dataArray: Uint8Array | null = null;
      if (analyserNode) { dataArray = new Uint8Array(analyserNode.frequencyBinCount); analyserNode.getByteFrequencyData(dataArray); }

      for (let i = 0; i < bandCount; i++) {
        let value: number;
        if (dataArray && analyserNode) {
          const idx = Math.floor((i / bandCount) * dataArray.length);
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
        const x = Math.round(i * (barW + gap));
        for (let led = 0; led < maxLeds; led++) {
          const y = Math.round(h - (led + 1) * (ledH + ledGap));
          const nH = led / maxLeds;
          ctx.fillStyle = led < activeLeds
            ? (nH > 0.85 ? '#ef4444' : nH > 0.65 ? '#eab308' : '#22c55e')
            : 'rgba(255,255,255,0.04)';
          ctx.fillRect(x, y, barW, ledH);
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [analyserNode, isPlaying, bandCount]);

  return (
    <canvas ref={canvasRef} className="w-full rounded-lg" style={{ imageRendering: 'pixelated', height: 'clamp(3rem,6vh,5rem)' }} />
  );
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

  // Background setting (persisted to localStorage)
  const [bgMode, setBgMode] = useState<string>('auto');
  const [showSettings, setShowSettings] = useState(false);
  const [mobileUrl, setMobileUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tv-bg-mode');
      if (saved) setBgMode(saved);
      setMobileUrl(`${window.location.origin}/mobile`);
    }
  }, []);

  const changeBgMode = useCallback((mode: string) => {
    setBgMode(mode);
    if (typeof window !== 'undefined') localStorage.setItem('tv-bg-mode', mode);
  }, []);

  // Audio streaming
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [audioEnergy, setAudioEnergy] = useState(0.3);
  const lastMediaKeyRef = useRef<string>('');

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = 0.8;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  // Setup Web Audio analyser on first user interaction or auto-play
  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setAnalyserNode(analyser);
    } catch (e) {
      console.warn('[TV] AudioContext init failed:', e);
    }
  }, []);

  // Energy monitor for background effects
  useEffect(() => {
    const iv = setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) { setAudioEnergy(np?.isPlaying ? 0.4 : 0.2); return; }
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i];
      setAudioEnergy(Math.min(1, (sum / buf.length / 255) * 2.5));
    }, 100);
    return () => clearInterval(iv);
  }, [np?.isPlaying]);

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
          const elapsed = (Date.now() - (data.state.publishedAt ?? Date.now())) / 1000;
          setLocalTime(Math.max(0, (data.state.currentTime ?? 0) + (data.state.isPlaying ? elapsed : 0)));
        }
      } catch { /* ignore */ }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  // Update audio when track changes
  useEffect(() => {
    const track = np?.currentTrack;
    const mediaKey = track?.mediaKey;
    const audio = audioRef.current;
    if (!audio || !mediaKey) return;

    if (mediaKey !== lastMediaKeyRef.current) {
      lastMediaKeyRef.current = mediaKey;
      ensureAudioContext();
      audio.src = `/api/plex/stream?key=${encodeURIComponent(mediaKey)}`;
      audio.currentTime = 0;
      if (np?.isPlaying) {
        audio.play().catch(() => {
          // Auto-play blocked — will play on interaction
        });
      }
    }
  }, [np?.currentTrack?.mediaKey, np?.isPlaying, ensureAudioContext]);

  // Sync play/pause state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (np?.isPlaying && audio.paused) {
      ensureAudioContext();
      audio.play().catch(() => {});
    } else if (!np?.isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [np?.isPlaying, ensureAudioContext]);

  // Resume audio context if suspended
  useEffect(() => {
    if (np?.isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, [np?.isPlaying]);

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

  // Smooth scroll lyrics using translateY instead of scrollTo - no resizing
  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container || currentLineIdx < 0) return;
    const el = container.querySelector(`[data-line="${currentLineIdx}"]`) as HTMLElement;
    if (!el) return;
    const containerH = container.clientHeight;
    const targetTop = el.offsetTop - containerH / 3;
    container.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [currentLineIdx]);

  // Click anywhere to init audio (auto-play policy workaround)
  useEffect(() => {
    const handler = () => {
      ensureAudioContext();
      const audio = audioRef.current;
      if (audio && audio.src && audio.paused && np?.isPlaying) {
        audio.play().catch(() => {});
      }
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener('click', handler, { once: false });
    document.addEventListener('keydown', handler, { once: false });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [ensureAudioContext, np?.isPlaying]);

  const track = np?.currentTrack;
  const duration = track?.duration ? track.duration / 1000 : 0;
  const progress = duration > 0 ? Math.min(100, (localTime / duration) * 100) : 0;
  const upcoming = (np?.queue ?? []).slice((np?.queueIndex ?? 0) + 1, (np?.queueIndex ?? 0) + 6);

  // Idle / nothing playing screen
  if (!track) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
        <TVBackground energy={0.2} mode={bgMode} />
        <div className="relative z-10 flex flex-col items-center">
          <Music2 className="w-24 h-24 text-zinc-700 mb-6" />
          <h1 className="text-4xl font-bold text-zinc-500">HomeBarr Tunes</h1>
          <p className="text-xl text-zinc-600 mt-2">Waiting for playback...</p>
          {mobileUrl && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="bg-white p-2 rounded-lg"><QRImage url={mobileUrl} size={100} /></div>
              <p className="text-xs text-zinc-600">Scan to open mobile remote</p>
            </div>
          )}
        </div>
        {/* Settings gear */}
        <button onClick={() => setShowSettings(!showSettings)} className="fixed top-4 right-4 z-20 w-10 h-10 rounded-full bg-zinc-900/60 flex items-center justify-center hover:bg-zinc-800/80 transition-colors">
          <Settings className="w-5 h-5 text-zinc-400" />
        </button>
        {showSettings && (
          <div className="fixed top-16 right-4 z-20 bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-4 w-56 space-y-2">
            <p className="text-xs font-medium text-zinc-400 mb-2">Background Effect</p>
            {['auto', ...BG_STYLES, 'none'].map(s => (
              <button key={s} onClick={() => changeBgMode(s)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${bgMode === s ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
              >{BG_LABELS[s] ?? s}</button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden select-none">
      {/* Animated background */}
      <TVBackground energy={audioEnergy} mode={bgMode} />

      {/* Main content: 3 columns — Art | Lyrics | Queue */}
      <div className="flex-1 flex min-h-0 relative z-10">
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

        {/* CENTER: Lyrics — uniform size, smooth scroll, no resizing */}
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
                      className={`text-center text-2xl leading-relaxed transition-colors duration-500 ${
                        isCurrent
                          ? 'text-white font-bold'
                          : isPast
                            ? 'text-zinc-600'
                            : 'text-zinc-500'
                      }`}
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

      {/* Settings gear (top-right) */}
      <button onClick={() => setShowSettings(!showSettings)} className="fixed top-4 right-4 z-20 w-10 h-10 rounded-full bg-zinc-900/60 flex items-center justify-center hover:bg-zinc-800/80 transition-colors">
        <Settings className="w-5 h-5 text-zinc-400" />
      </button>
      {showSettings && (
        <div className="fixed top-16 right-4 z-20 bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-4 w-56 space-y-2">
          <p className="text-xs font-medium text-zinc-400 mb-2">Background Effect</p>
          {['auto', ...BG_STYLES, 'none'].map(s => (
            <button key={s} onClick={() => changeBgMode(s)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${bgMode === s ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >{BG_LABELS[s] ?? s}</button>
          ))}
        </div>
      )}

      {/* Bottom: QR above EQ + Progress bar */}
      <div className="flex-shrink-0 px-6 pb-4 relative z-10 space-y-2">
        {/* QR code - right-aligned above EQ */}
        {mobileUrl && (
          <div className="flex justify-end">
            <div className="flex flex-col items-center gap-0.5">
              <div className="bg-white p-1 rounded-lg"><QRImage url={mobileUrl} size={48} /></div>
              <p className="text-[8px] text-zinc-600">Mobile</p>
            </div>
          </div>
        )}
        {/* EQ */}
        <TVEqualizer analyserNode={analyserNode} isPlaying={np?.isPlaying ?? false} />
        {/* Progress */}
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
