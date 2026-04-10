"use client";

import React, { useState } from 'react';
import { Volume2, VolumeX, SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer, EQ_PRESETS, type EqGains } from '@/lib/player-context';

interface AudioControlsProps {
  compact?: boolean; // true for PlayerBar (smaller), false for NowPlaying (larger)
}

const BAND_LABELS: { key: keyof EqGains; label: string; color: string }[] = [
  { key: 'bass', label: 'Bass', color: 'from-orange-500 to-red-500' },
  { key: 'mid', label: 'Mid', color: 'from-green-500 to-emerald-500' },
  { key: 'treble', label: 'Treble', color: 'from-blue-500 to-cyan-500' },
];

export default function AudioControls({ compact = false }: AudioControlsProps) {
  const { volume, setVolume, eqGains, setEqGain, setEqPreset, eqPreset } = usePlayer();
  const [showEq, setShowEq] = useState(false);

  const iconSize = compact
    ? 'w-[clamp(1rem,1.2vw,1.25rem)] h-[clamp(1rem,1.2vw,1.25rem)]'
    : 'w-[clamp(1.125rem,1.5vw,1.5rem)] h-[clamp(1.125rem,1.5vw,1.5rem)]';
  const sliderW = compact ? 'w-[clamp(70px,8vw,120px)]' : 'w-[clamp(90px,10vw,160px)]';

  return (
    <div className="flex items-center gap-2 flex-shrink-0 relative">
      {/* Volume icon + slider */}
      <button
        onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        {volume === 0 ? <VolumeX className={iconSize} /> : <Volume2 className={iconSize} />}
      </button>
      <div
        className={`${sliderW} h-1.5 bg-muted/50 rounded-full cursor-pointer relative group`}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(1, x / rect.width));
          setVolume(pct);
        }}
      >
        <div
          className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full"
          style={{ width: `${(volume ?? 1) * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-lg border-2 border-background"
          style={{ left: `calc(${(volume ?? 1) * 100}% - 6px)` }}
        />
      </div>

      {/* EQ toggle button */}
      <button
        onClick={() => setShowEq(!showEq)}
        className={`flex-shrink-0 rounded-full flex items-center justify-center transition-colors ${
          showEq || eqPreset !== 'flat' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        } ${compact ? 'w-8 h-8' : 'w-[clamp(2rem,2.5vw,2.5rem)] h-[clamp(2rem,2.5vw,2.5rem)]'}`}
      >
        <SlidersHorizontal className={iconSize} />
      </button>

      {/* EQ Popup - expands upward */}
      <AnimatePresence>
        {showEq && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60]"
              onClick={() => setShowEq(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-full left-0 mb-3 z-[61] bg-card/98 backdrop-blur-xl border border-border/30 rounded-xl shadow-2xl p-4"
              style={{ minWidth: 'clamp(260px, 22vw, 340px)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">Equalizer</h4>
                <button onClick={() => setShowEq(false)} className="w-6 h-6 rounded-full bg-secondary/70 flex items-center justify-center hover:bg-secondary">
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* 3-band sliders */}
              <div className="space-y-3 mb-4">
                {BAND_LABELS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-12 text-muted-foreground">{label}</span>
                    <div className="flex-1 relative">
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={eqGains[key]}
                        onChange={(e) => setEqGain(key, parseFloat(e.target.value))}
                        className="w-full h-2 accent-primary appearance-none bg-muted/50 rounded-full"
                        style={{
                          background: `linear-gradient(to right, hsl(var(--muted)/0.5) 0%, hsl(var(--muted)/0.5) ${((eqGains[key] + 12) / 24) * 100}%, hsl(var(--muted)/0.3) ${((eqGains[key] + 12) / 24) * 100}%, hsl(var(--muted)/0.3) 100%)`,
                        }}
                      />
                      {/* Center line marker */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/30 pointer-events-none" />
                    </div>
                    <span className={`text-xs font-mono w-8 text-right ${eqGains[key] > 0 ? 'text-green-400' : eqGains[key] < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {eqGains[key] > 0 ? '+' : ''}{eqGains[key]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Presets */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Presets</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(EQ_PRESETS).map((name) => (
                    <button
                      key={name}
                      onClick={() => setEqPreset(name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                        eqPreset === name
                          ? 'bg-primary text-primary-foreground ring-1 ring-primary/50'
                          : 'bg-secondary/70 text-foreground hover:bg-secondary'
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
