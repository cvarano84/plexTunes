"use client";

import React, { useState, useEffect } from 'react';
import { Settings, CheckCircle2, XCircle, Loader2, AlertCircle, Database, RefreshCw, Music2, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';

interface SettingsViewProps {
  idleTimeout: number;
  onIdleTimeoutChange: (val: number) => void;
  eqBands: number;
  onEqBandsChange: (val: number) => void;
  eqColorScheme: string;
  onEqColorSchemeChange: (val: string) => void;
  previousTrackCount: number;
  onPreviousTrackCountChange: (val: number) => void;
  keyboardSize: 'small' | 'medium' | 'large';
  onKeyboardSizeChange: (val: 'small' | 'medium' | 'large') => void;
  columnLayout: string;
  onColumnLayoutChange: (val: string) => void;
  artistRows: number;
  onArtistRowsChange: (val: number) => void;
}

function StatusBadge({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 border border-border/20">
      {ok === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground flex-shrink-0" />
      ) : ok ? (
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground truncate">{detail}</p>}
      </div>
    </div>
  );
}

export default function SettingsView({
  idleTimeout, onIdleTimeoutChange,
  eqBands, onEqBandsChange,
  eqColorScheme, onEqColorSchemeChange,
  previousTrackCount, onPreviousTrackCountChange,
  keyboardSize, onKeyboardSizeChange,
  columnLayout, onColumnLayoutChange,
  artistRows, onArtistRowsChange,
}: SettingsViewProps) {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [popularityRunning, setPopularityRunning] = useState(false);
  const [popularityProgress, setPopularityProgress] = useState('');

  const fetchDiagnostics = () => {
    setLoading(true);
    fetch('/api/settings')
      .then(r => r?.json?.())
      .then(data => setDiagnostics(data))
      .catch(() => setDiagnostics(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleResync = async () => {
    setResyncing(true);
    try {
      const libRes = await fetch('/api/plex/library');
      const libData = await libRes.json();
      const sections = libData?.sections ?? [];
      if (sections.length > 0) {
        await fetch('/api/plex/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId: sections[0].key }),
        });
        setTimeout(fetchDiagnostics, 2000);
      }
    } catch { /* ignore */ }
    setResyncing(false);
  };

  const handleRunPopularity = async () => {
    setPopularityRunning(true);
    setPopularityProgress('Starting...');
    try {
      let done = false;
      let totalProcessed = 0;
      while (!done) {
        const res = await fetch('/api/popularity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize: 50 }),
        });
        const data = await res.json();
        if (data?.error) {
          setPopularityProgress(`Error: ${data.error}`);
          break;
        }
        totalProcessed += data?.processed ?? 0;
        done = data?.done ?? false;
        const remaining = data?.remaining ?? 0;
        setPopularityProgress(`Processed ${totalProcessed} tracks, ${remaining} remaining...`);
        if (!done) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      setPopularityProgress(`Done! ${totalProcessed} tracks checked.`);
      setTimeout(fetchDiagnostics, 1000);
    } catch (e: any) {
      setPopularityProgress(`Error: ${e?.message ?? 'Failed'}`);
    }
    setPopularityRunning(false);
  };

  const testLyrics = async () => {
    try {
      const res = await fetch('/api/lyrics?title=Bohemian+Rhapsody&artist=Queen');
      const data = await res.json();
      alert(
        data.lyrics
          ? `Lyrics working! Found ${data.lyrics.length} chars for Bohemian Rhapsody.\n\nDebug: ${JSON.stringify(data.debug, null, 2)}`
          : `Lyrics not working.\n\nDebug: ${JSON.stringify(data.debug ?? data, null, 2)}`
      );
    } catch (e: any) {
      alert(`Lyrics test failed: ${e?.message}`);
    }
  };

  return (
    <div className="px-6 py-6 max-w-[900px] mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          Settings
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Diagnostics, preferences & configuration</p>
      </div>

      {/* Diagnostics */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-accent" />
          System Diagnostics
          <button onClick={fetchDiagnostics} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <StatusBadge
            ok={diagnostics ? diagnostics.plex?.configured : null}
            label="Plex Connection"
            detail={diagnostics?.plex?.serverUrl ?? 'Checking...'}
          />
          <StatusBadge
            ok={diagnostics ? diagnostics.genius?.connected : null}
            label="Genius Lyrics"
            detail={diagnostics?.genius?.error ?? (diagnostics?.genius?.connected ? 'Connected' : 'Checking...')}
          />
          <StatusBadge
            ok={diagnostics ? diagnostics.spotify?.working : null}
            label="Spotify Popularity"
            detail={diagnostics?.spotify
              ? `${diagnostics.spotify.tracksChecked} checked, ${diagnostics.spotify.tracksPopular} popular${diagnostics.spotify.tracksUnchecked ? ` (${diagnostics.spotify.tracksUnchecked} unchecked)` : ''}`
              : 'Checking...'}
          />
          <StatusBadge
            ok={diagnostics ? (diagnostics.library?.tracks > 0) : null}
            label="Library Cache"
            detail={diagnostics?.library ? `${diagnostics.library.artists} artists, ${diagnostics.library.albums} albums, ${diagnostics.library.tracks} tracks` : 'Checking...'}
          />
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={testLyrics}
            className="px-4 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            Test Lyrics (Bohemian Rhapsody)
          </button>
          <button
            onClick={handleResync}
            disabled={resyncing}
            className="px-4 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
          >
            {resyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Resync Library
          </button>
          <button
            onClick={handleRunPopularity}
            disabled={popularityRunning}
            className="px-4 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
          >
            {popularityRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gauge className="w-3 h-3" />}
            Run Popularity Check
          </button>
        </div>
        {popularityProgress && (
          <p className="text-xs text-muted-foreground mt-2">{popularityProgress}</p>
        )}
      </motion.div>

      {/* Library Stats */}
      {diagnostics?.library && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
            <Database className="w-5 h-5 text-accent" />
            Library Stats
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Artists', value: diagnostics.library.artists },
              { label: 'Albums', value: diagnostics.library.albums },
              { label: 'Tracks', value: diagnostics.library.tracks },
              { label: 'Stations', value: diagnostics.library.stations },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-lg bg-secondary/40 border border-border/20 text-center">
                <p className="text-2xl font-bold font-display">{stat.value?.toLocaleString?.() ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Display Settings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
        <h3 className="text-lg font-display font-semibold mb-3">Display & Behavior</h3>
        <div className="space-y-4">
          {/* Idle timeout */}
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Auto-switch to Now Playing</label>
            <p className="text-xs text-muted-foreground mb-2">Automatically show Now Playing after idle</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="120"
                step="5"
                value={idleTimeout}
                onChange={(e) => onIdleTimeoutChange(parseInt(e.target.value))}
                className="flex-1 h-2 accent-primary"
              />
              <span className="text-sm font-mono w-16 text-right">
                {idleTimeout === 0 ? 'Off' : `${idleTimeout}s`}
              </span>
            </div>
          </div>

          {/* Now Playing column layout */}
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Now Playing Layout</label>
            <p className="text-xs text-muted-foreground mb-2">Column size distribution for the Now Playing view</p>
            <div className="flex gap-2 mt-2">
              {[
                { id: 'balanced', label: 'Balanced', desc: '30 / 40 / 30' },
                { id: 'lyrics', label: 'Lyrics Focus', desc: '25 / 50 / 25' },
                { id: 'art', label: 'Art Focus', desc: '40 / 35 / 25' },
              ].map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => onColumnLayoutChange(layout.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    columnLayout === layout.id
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {layout.label}
                  <p className="text-[10px] opacity-70 mt-0.5">{layout.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Artist rows */}
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Artist Grid Rows</label>
            <p className="text-xs text-muted-foreground mb-2">Number of rows visible when browsing artists horizontally</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={artistRows}
                onChange={(e) => onArtistRowsChange(parseInt(e.target.value))}
                className="flex-1 h-2 accent-primary"
              />
              <span className="text-sm font-mono w-10 text-right">{artistRows}</span>
            </div>
          </div>

          {/* Previous tracks count */}
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Previous Tracks in Queue</label>
            <p className="text-xs text-muted-foreground mb-2">Number of previously played tracks to show in the queue</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={previousTrackCount}
                onChange={(e) => onPreviousTrackCountChange(parseInt(e.target.value))}
                className="flex-1 h-2 accent-primary"
              />
              <span className="text-sm font-mono w-10 text-right">{previousTrackCount}</span>
            </div>
          </div>

          {/* EQ band count */}
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Equalizer Bands</label>
            <p className="text-xs text-muted-foreground mb-2">Number of LED columns in the equalizer display</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="8"
                max="64"
                step="4"
                value={eqBands}
                onChange={(e) => onEqBandsChange(parseInt(e.target.value))}
                className="flex-1 h-2 accent-primary"
              />
              <span className="text-sm font-mono w-10 text-right">{eqBands}</span>
            </div>
          </div>

          {/* EQ color scheme */}
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Equalizer Colors</label>
            <p className="text-xs text-muted-foreground mb-2">Color scheme for the LED equalizer</p>
            <div className="flex gap-2 mt-2">
              {[
                { id: 'classic', label: 'Classic', colors: 'from-green-500 via-yellow-500 to-red-500' },
                { id: 'purple', label: 'Purple', colors: 'from-violet-600 via-purple-500 to-pink-500' },
                { id: 'cyan', label: 'Cyan', colors: 'from-sky-500 via-cyan-500 to-pink-500' },
              ].map((scheme) => (
                <button
                  key={scheme.id}
                  onClick={() => onEqColorSchemeChange(scheme.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    eqColorScheme === scheme.id
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  <div className={`w-12 h-2 rounded-full bg-gradient-to-r ${scheme.colors} mb-1`} />
                  {scheme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Keyboard size */}
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Touch Keyboard Size</label>
            <p className="text-xs text-muted-foreground mb-2">Adjust key size for the on-screen keyboard</p>
            <div className="flex gap-2 mt-2">
              {[
                { id: 'small' as const, label: 'Small' },
                { id: 'medium' as const, label: 'Medium' },
                { id: 'large' as const, label: 'Large' },
              ].map((sz) => (
                <button
                  key={sz.id}
                  onClick={() => onKeyboardSizeChange(sz.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    keyboardSize === sz.id
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                      : 'bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Plex Config */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 className="text-lg font-display font-semibold mb-3">Plex Configuration</h3>
        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
          <p className="text-sm text-muted-foreground mb-3">Reconfigure your Plex server connection or re-sync your library.</p>
          <button
            onClick={() => { window.location.href = '/setup'; }}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Open Setup Wizard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
