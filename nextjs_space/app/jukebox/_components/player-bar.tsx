"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music2, ListMusic, ChevronUp, Smartphone, X, Waves, PartyPopper, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import PlexImage from './plex-image';
import AudioControls from './audio-controls';
import LEDEqualizer from './led-equalizer';
import { QRCodeSVG } from 'qrcode.react';

interface PlayerBarProps {
  onNavigate: (view: ViewType, opts?: any) => void;
  eqBands?: number;
  eqColorScheme?: string;
  eqBarHeight?: number;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s?.toString?.()?.padStart?.(2, '0') ?? '00'}`;
}

export default function PlayerBar({ onNavigate, eqBands = 32, eqColorScheme = 'classic', eqBarHeight = 48 }: PlayerBarProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    queue,
    analyserNode,
    sweetFades,
    setSweetFades,
    partyBeat,
    setPartyBeat,
    partyBeatRate,
    setPartyBeatRate,
    detectedBpm,
  } = usePlayer();

  const [partyPopover, setPartyPopover] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);
  const [mobileUrl, setMobileUrl] = useState('');
  const qrTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Build mobile URL from current page location
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setMobileUrl(`${origin}/mobile`);
    }
  }, []);

  useEffect(() => {
    if (qrOpen) {
      if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
      qrTimerRef.current = setTimeout(() => setQrOpen(false), 15000);
    }
    return () => { if (qrTimerRef.current) clearTimeout(qrTimerRef.current); };
  }, [qrOpen]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50"
    >
      {/* LED Equalizer - solid background, part of the bar */}
      <div className="bg-card px-4 py-1">
        <LEDEqualizer analyserNode={analyserNode} isPlaying={isPlaying} bandCount={eqBands} colorScheme={eqColorScheme} height={eqBarHeight} />
      </div>

      {/* Progress bar (clickable) */}
      <div
        className="h-1 bg-muted/50 cursor-pointer group"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          const rect = e?.currentTarget?.getBoundingClientRect?.();
          if (!rect) return;
          const x = (e?.clientX ?? 0) - (rect?.left ?? 0);
          const pct = x / (rect?.width ?? 1);
          seek(pct * duration);
        }}
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all group-hover:h-1.5"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="bg-card/95 backdrop-blur-xl border-t border-border/30">
        <div className="px-4 h-20 flex items-center gap-4">
          {/* Audio controls: volume + EQ (far left) */}
          <AudioControls compact />

          {/* Sweet Fades toggle */}
          <button
            onClick={() => setSweetFades(!sweetFades)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative ${
              sweetFades ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}
            title={sweetFades ? 'Sweet Fades: ON' : 'Sweet Fades: OFF'}
          >
            <Waves className="w-5 h-5" />
            {sweetFades && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400" />
            )}
          </button>

          {/* Party Beat button */}
          <div className="relative">
            <button
              onClick={() => setPartyPopover(p => !p)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative ${
                partyBeat ? 'bg-pink-600 text-white' : 'text-muted-foreground hover:bg-secondary'
              }`}
              title="Party Beat — auto tempo to 120-130 BPM"
            >
              <PartyPopper className="w-5 h-5" />
              {partyBeat && (
                <>
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400" />
                  <span className="absolute inset-0 rounded-full bg-pink-500/30 animate-ping pointer-events-none" />
                </>
              )}
            </button>
            <AnimatePresence>
              {partyPopover && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[100] bg-card border border-border/40 rounded-xl p-3 shadow-2xl min-w-[220px]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <PartyPopper className="w-3.5 h-3.5 text-pink-400" /> Party Beat
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPartyBeat(!partyBeat)}
                        className={`w-9 h-5 rounded-full transition-colors relative ${partyBeat ? 'bg-pink-500' : 'bg-secondary'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${partyBeat ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <button onClick={() => setPartyPopover(false)} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-secondary">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {/* BPM readout */}
                  {partyBeat && (
                    <div className="bg-black/30 rounded-lg p-2 mb-2 text-center">
                      {detectedBpm ? (
                        <>
                          <span className="text-2xl font-bold text-pink-400 tabular-nums">{detectedBpm}</span>
                          <span className="text-xs text-muted-foreground ml-1">BPM detected</span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            → Target: 120–130 BPM · Speed: {Math.round(partyBeatRate * 100)}%
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground animate-pulse">Analyzing tempo...</p>
                      )}
                    </div>
                  )}
                  {/* Manual override slider */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPartyBeatRate(partyBeatRate - 0.02)}
                      className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-lg font-bold tabular-nums">{Math.round(partyBeatRate * 100)}%</span>
                      <p className="text-[10px] text-muted-foreground">Speed (key locked)</p>
                    </div>
                    <button
                      onClick={() => setPartyBeatRate(partyBeatRate + 0.02)}
                      className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="130"
                    value={Math.round(partyBeatRate * 100)}
                    onChange={(e) => setPartyBeatRate(parseInt(e.target.value) / 100)}
                    className="w-full mt-2 accent-pink-500"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>80%</span>
                    <button onClick={() => setPartyBeatRate(1.0)} className="text-pink-400 font-medium hover:underline">Reset</button>
                    <span>130%</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Track info */}
          <button
            onClick={() => onNavigate?.('now-playing')}
            className="flex items-center gap-3 flex-1 min-w-0 group"
          >
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary flex-shrink-0 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
              <PlexImage thumb={currentTrack?.thumb} alt={currentTrack?.title ?? ''} size={120} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate max-w-[200px]">
                {currentTrack?.title ?? ''}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {currentTrack?.artistName ?? ''}
              </p>
            </div>
            <ChevronUp className="w-4 h-4 text-muted-foreground ml-1 group-hover:text-primary transition-colors" />
          </button>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevTrack}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-primary-foreground" />
              ) : (
                <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Time */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono w-24">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Queue button */}
          <button
            onClick={() => onNavigate?.('queue')}
            className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors relative"
          >
            <ListMusic className="w-5 h-5" />
            {(queue?.length ?? 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                {queue?.length ?? 0}
              </span>
            )}
          </button>

          {/* Mobile remote QR button */}
          <div className="relative">
            <button
              onClick={() => setQrOpen(prev => !prev)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
              title="Mobile remote"
            >
              <Smartphone className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {qrOpen && mobileUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-14 right-0 z-[100] bg-card border border-border/40 rounded-xl p-4 shadow-2xl min-w-[220px]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Mobile Remote</span>
                    <button onClick={() => setQrOpen(false)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-secondary transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="bg-white p-3 rounded-lg flex items-center justify-center">
                    <QRCodeSVG value={mobileUrl} size={160} level="M" />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-2 break-all">{mobileUrl}</p>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">Scan with your phone (same network)</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
