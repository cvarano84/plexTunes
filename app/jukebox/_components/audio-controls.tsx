"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer, EQ_PRESETS, EQ_10BAND_PRESETS, EQ_10BAND_LABELS, type EqGains } from '@/lib/player-context';

interface AudioControlsProps {
  compact?: boolean;
}

const BAND_LABELS: { key: keyof EqGains; label: string }[] = [
  { key: 'bass', label: 'Bass' },
  { key: 'mid', label: 'Mid' },
  { key: 'treble', label: 'Treble' },
];

export default function AudioControls({ compact = false }: AudioControlsProps) {
  const {
    volume, setVolume, eqGains, setEqGain, setEqPreset, eqPreset,
    eqMode, setEqMode, advancedEqGains, setAdvancedEqGain, setAdvancedEqPreset, advancedEqPreset
  } = usePlayer();
  const [showEq, setShowEq] = useState(false);
  const draggingRef = useRef(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const eqTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide EQ popup after 15 seconds of no interaction
  useEffect(() => {
    if (!showEq) return;
    const resetTimer = () => {
      if (eqTimeoutRef.current) clearTimeout(eqTimeoutRef.current);
      eqTimeoutRef.current = setTimeout(() => setShowEq(false), 15000);
    };
    resetTimer();
    const handler = () => resetTimer();
    document.addEventListener('pointerdown', handler);
    return () => {
      document.removeEventListener('pointerdown', handler);
      if (eqTimeoutRef.current) clearTimeout(eqTimeoutRef.current);
    };
  }, [showEq]);

  const iconSize = compact
    ? 'w-[clamp(1rem,1.2vw,1.25rem)] h-[clamp(1rem,1.2vw,1.25rem)]'
    : 'w-[clamp(1.125rem,1.5vw,1.5rem)] h-[clamp(1.125rem,1.5vw,1.5rem)]';
  const sliderW = compact ? 'w-[clamp(70px,8vw,120px)]' : 'w-[clamp(90px,10vw,160px)]';

  const updateVolumeFromEvent = useCallback((clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setVolume(pct);
  }, [setVolume]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateVolumeFromEvent(e.clientX);
  }, [updateVolumeFromEvent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateVolumeFromEvent(e.clientX);
  }, [updateVolumeFromEvent]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const activePresets = eqMode === 'simple' ? EQ_PRESETS : EQ_10BAND_PRESETS;
  const currentPresetName = eqMode === 'simple' ? eqPreset : advancedEqPreset;

  return (
    <div className="flex items-center gap-2 flex-shrink-0 relative">
      {/* Volume */}
      <button
        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
        className="flex-shrink-0 text-muted-foreground transition-colors"
      >
        {volume === 0 ? <VolumeX className={iconSize} /> : <Volume2 className={iconSize} />}
      </button>
      <div
        ref={sliderRef}
        className={`${sliderW} h-4 flex items-center cursor-pointer relative group touch-none`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="w-full h-1.5 bg-muted/50 rounded-full relative">
          <div className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full" style={{ width: `${(volume ?? 1) * 100}%` }} />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary shadow-lg border-2 border-background pointer-events-none" style={{ left: `calc(${(volume ?? 1) * 100}% - 8px)` }} />
      </div>

      {/* EQ toggle */}
      <button
        onClick={() => setShowEq(!showEq)}
        className={`flex-shrink-0 rounded-full flex items-center justify-center transition-colors ${
          showEq || currentPresetName !== 'flat' ? 'text-primary' : 'text-muted-foreground'
        } ${compact ? 'w-8 h-8' : 'w-[clamp(2rem,2.5vw,2.5rem)] h-[clamp(2rem,2.5vw,2.5rem)]'}`}
      >
        <SlidersHorizontal className={iconSize} />
      </button>

      {/* EQ Popup */}
      <AnimatePresence>
        {showEq && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60]" onClick={() => setShowEq(false)} />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-full left-0 mb-3 z-[61] bg-card border border-border/40 rounded-xl shadow-2xl p-4"
              style={{ minWidth: eqMode === 'advanced' ? 'clamp(400px, 35vw, 560px)' : 'clamp(260px, 22vw, 340px)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">Equalizer</h4>
                <div className="flex items-center gap-2">
                  {/* Simple / Advanced toggle */}
                  <div className="flex rounded-lg overflow-hidden border border-border/40">
                    <button
                      onClick={() => setEqMode('simple')}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        eqMode === 'simple' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'
                      }`}
                    >
                      Simple
                    </button>
                    <button
                      onClick={() => setEqMode('advanced')}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        eqMode === 'advanced' ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground'
                      }`}
                    >
                      Advanced
                    </button>
                  </div>
                  <button onClick={() => setShowEq(false)} className="w-6 h-6 rounded-full bg-secondary/70 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {eqMode === 'simple' ? (
                /* 3-band horizontal sliders */
                <div className="space-y-3 mb-4">
                  {BAND_LABELS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-12 text-muted-foreground">{label}</span>
                      <div className="flex-1 relative">
                        <input
                          type="range" min="-12" max="12" step="1"
                          value={eqGains[key]}
                          onChange={(e) => setEqGain(key, parseFloat(e.target.value))}
                          className="w-full h-2 accent-primary appearance-none bg-muted/50 rounded-full"
                        />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/30 pointer-events-none" />
                      </div>
                      <span className={`text-xs font-mono w-8 text-right ${eqGains[key] > 0 ? 'text-green-400' : eqGains[key] < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {eqGains[key] > 0 ? '+' : ''}{eqGains[key]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                /* 10-band vertical sliders - old school rack EQ style */
                <div className="mb-4">
                  <div className="flex items-end gap-1 justify-center" style={{ height: 'clamp(140px, 14vw, 200px)' }}>
                    {EQ_10BAND_LABELS.map((label, i) => {
                      const val = advancedEqGains[i] ?? 0;
                      const pct = ((val + 12) / 24) * 100;
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full">
                          <span className={`text-[9px] font-mono ${val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                            {val > 0 ? '+' : ''}{val}
                          </span>
                          <div className="flex-1 relative w-full flex justify-center">
                            <div className="w-1.5 bg-muted/30 rounded-full h-full relative">
                              {/* Center line */}
                              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-px bg-muted-foreground/40" />
                              {/* Fill bar from center */}
                              <div
                                className={`absolute left-0 w-full rounded-full ${val >= 0 ? 'bg-green-500/70' : 'bg-red-500/70'}`}
                                style={val >= 0
                                  ? { bottom: '50%', height: `${(val / 12) * 50}%` }
                                  : { top: '50%', height: `${(-val / 12) * 50}%` }
                                }
                              />
                            </div>
                            {/* Invisible vertical range input overlay */}
                            <input
                              type="range" min="-12" max="12" step="1"
                              value={val}
                              onChange={(e) => setAdvancedEqGain(i, parseFloat(e.target.value))}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              style={{ writingMode: 'vertical-lr', direction: 'rtl', width: '100%', height: '100%' }}
                            />
                          </div>
                          <span className="text-[8px] text-muted-foreground font-mono">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Presets */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(activePresets).map((name) => (
                    <button
                      key={name}
                      onClick={() => eqMode === 'simple' ? setEqPreset(name) : setAdvancedEqPreset(name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                        currentPresetName === name
                          ? 'bg-primary text-primary-foreground ring-1 ring-primary/50'
                          : 'bg-secondary/70 text-foreground'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
