"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, CheckCircle2, XCircle, Loader2, AlertCircle, Database, RefreshCw, Music2, Gauge, Radio, Plus, Trash2, ChevronUp, ChevronDown, BarChart3, Zap, SlidersHorizontal } from 'lucide-react';
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
  keyboardSize: 'small' | 'medium' | 'large' | 'xl' | 'xxl';
  onKeyboardSizeChange: (val: 'small' | 'medium' | 'large' | 'xl' | 'xxl') => void;
  columnLayout: string;
  onColumnLayoutChange: (val: string) => void;
  artistRows: number;
  onArtistRowsChange: (val: number) => void;
  stationRows: number;
  onStationRowsChange: (val: number) => void;
  lyricsZoom: number;
  onLyricsZoomChange: (val: number) => void;
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

type PopProvider = { id: string; label: string; desc: string; requiresKey: boolean; keyName?: string };
type LyricsProvider = { id: string; label: string; desc: string; requiresKey: boolean; keyName?: string };

const POP_PROVIDERS: PopProvider[] = [
  { id: 'deezer', label: 'Deezer', desc: 'Free, no API key needed. Uses track rank (0-1M).', requiresKey: false },
  { id: 'lastfm', label: 'Last.fm', desc: 'Free with API key. Uses listener counts.', requiresKey: true, keyName: 'LASTFM_API_KEY' },
  { id: 'spotify', label: 'Spotify', desc: 'Requires Premium + API credentials.', requiresKey: true, keyName: 'SPOTIFY_CLIENT_ID' },
];

const LYRICS_PROVIDERS: LyricsProvider[] = [
  { id: 'lrclib', label: 'LRCLIB', desc: 'Free, no key. Synced + plain lyrics with timestamps.', requiresKey: false },
  { id: 'genius', label: 'Genius', desc: 'Requires access token. Plain text lyrics only.', requiresKey: true, keyName: 'GENIUS_ACCESS_TOKEN' },
];

export default function SettingsView({
  idleTimeout, onIdleTimeoutChange,
  eqBands, onEqBandsChange,
  eqColorScheme, onEqColorSchemeChange,
  previousTrackCount, onPreviousTrackCountChange,
  keyboardSize, onKeyboardSizeChange,
  columnLayout, onColumnLayoutChange,
  artistRows, onArtistRowsChange,
  stationRows, onStationRowsChange,
  lyricsZoom, onLyricsZoomChange,
}: SettingsViewProps) {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [popularityRunning, setPopularityRunning] = useState(false);
  const [popularityProgress, setPopularityProgress] = useState('');

  // Provider management state - initialized with defaults, loaded from localStorage in effect
  const [popOrder, setPopOrder] = useState<string[]>(['deezer', 'lastfm', 'spotify']);
  const [popDisabled, setPopDisabled] = useState<string[]>([]);
  const [lyricsOrder, setLyricsOrder] = useState<string[]>(['lrclib', 'genius']);
  const [lyricsDisabled, setLyricsDisabled] = useState<string[]>([]);
  const [providerConfigLoaded, setProviderConfigLoaded] = useState(false);

  // Load provider config from localStorage on mount
  useEffect(() => {
    try {
      const po = localStorage.getItem('popProviderOrder');
      if (po) { const parsed = JSON.parse(po); if (Array.isArray(parsed) && parsed.length > 0) setPopOrder(parsed); }
      const pd = localStorage.getItem('popProviderDisabled');
      if (pd) { const parsed = JSON.parse(pd); if (Array.isArray(parsed)) setPopDisabled(parsed); }
      const lo = localStorage.getItem('lyricsProviderOrder');
      if (lo) { const parsed = JSON.parse(lo); if (Array.isArray(parsed) && parsed.length > 0) setLyricsOrder(parsed); }
      const ld = localStorage.getItem('lyricsProviderDisabled');
      if (ld) { const parsed = JSON.parse(ld); if (Array.isArray(parsed)) setLyricsDisabled(parsed); }
    } catch { /* ignore */ }
    setProviderConfigLoaded(true);
  }, []);
  const [providerTests, setProviderTests] = useState<Record<string, any>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // Top tracks viewer state
  const [topTracks, setTopTracks] = useState<any[] | null>(null);
  const [topTracksStats, setTopTracksStats] = useState<any>(null);
  const [topTracksLoading, setTopTracksLoading] = useState(false);
  const [showTopTracks, setShowTopTracks] = useState(false);

  // Station management state
  const [stations, setStations] = useState<any[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [newStationType, setNewStationType] = useState<'standard' | 'hits' | 'most-played'>('standard');
  const [newStationDecade, setNewStationDecade] = useState('1980s');
  const [newStationGenre, setNewStationGenre] = useState('Rock');
  const [newStationName, setNewStationName] = useState('');
  const [stationSaving, setStationSaving] = useState(false);

  // Station tuning state
  const [tuningMinPop, setTuningMinPop] = useState(40);
  const [tuningPreview, setTuningPreview] = useState<any>(null);
  const [tuningLoading, setTuningLoading] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [tuningStats, setTuningStats] = useState<any>(null);
  const tuningTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const DECADES = ['1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s'];
  const GENRES = ['Rock','Pop','Dance','Hip-Hop','R&B','Country','New Wave','Soul'];

  // Persist provider config after initial load
  useEffect(() => {
    if (!providerConfigLoaded) return;
    localStorage.setItem('popProviderOrder', JSON.stringify(popOrder));
    localStorage.setItem('popProviderDisabled', JSON.stringify(popDisabled));
    localStorage.setItem('lyricsProviderOrder', JSON.stringify(lyricsOrder));
    localStorage.setItem('lyricsProviderDisabled', JSON.stringify(lyricsDisabled));
  }, [popOrder, popDisabled, lyricsOrder, lyricsDisabled, providerConfigLoaded]);

  const moveProvider = (list: string[], setList: (v: string[]) => void, id: string, dir: 'up' | 'down') => {
    const idx = list.indexOf(id);
    if (idx < 0) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= list.length) return;
    const copy = [...list];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setList(copy);
  };

  const toggleDisabled = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  };

  const handleTestProvider = async (provider: string, type: 'popularity' | 'lyrics') => {
    setTestingProvider(provider);
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, type }),
      });
      const data = await res.json();
      setProviderTests(prev => ({ ...prev, [provider]: data }));
    } catch (e: any) {
      setProviderTests(prev => ({ ...prev, [provider]: { working: false, error: e?.message ?? 'Test failed' } }));
    }
    setTestingProvider(null);
  };

  const fetchTopTracks = async () => {
    setTopTracksLoading(true);
    try {
      const res = await fetch('/api/providers/top-tracks?limit=25');
      const data = await res.json();
      setTopTracks(data?.topTracks ?? []);
      setTopTracksStats(data?.stats ?? null);
    } catch { setTopTracks([]); }
    setTopTracksLoading(false);
  };

  const fetchStations = useCallback(async () => {
    setStationsLoading(true);
    try {
      const res = await fetch('/api/stations');
      const data = await res.json();
      setStations(data?.stations ?? []);
    } catch { setStations([]); }
    setStationsLoading(false);
  }, []);

  const fetchStationPreview = useCallback(async (minPop: number) => {
    setTuningLoading(true);
    try {
      const res = await fetch(`/api/stations/rescan?minPopularity=${minPop}`);
      const data = await res.json();
      setTuningPreview(data?.stations ?? []);
      setTuningStats(data?.stats ?? null);
    } catch { setTuningPreview(null); }
    setTuningLoading(false);
  }, []);

  const handleRescanStations = async () => {
    setRescanning(true);
    try {
      const res = await fetch('/api/stations/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minPopularity: tuningMinPop }),
      });
      const data = await res.json();
      setTuningPreview(data?.stations ?? []);
      setTuningStats(data?.stats ?? null);
      fetchStations(); // refresh the main station list
    } catch { /* ignore */ }
    setRescanning(false);
  };

  // Load preview on mount
  useEffect(() => { fetchStationPreview(tuningMinPop); }, []);

  const handleAddStation = async () => {
    if (stationSaving) return;
    setStationSaving(true);
    try {
      let payload: any = { stationType: newStationType };

      if (newStationType === 'most-played') {
        payload.name = newStationName.trim() || 'Most Played';
        payload.description = 'Your most played tracks, shuffled';
      } else if (newStationType === 'hits') {
        const genrePart = newStationGenre !== 'all' ? newStationGenre : null;
        const decadePart = newStationDecade !== 'all' ? newStationDecade : null;
        payload.genre = genrePart;
        payload.decade = decadePart;
        payload.name = newStationName.trim() || `${genrePart ? genrePart + ' ' : ''}${decadePart ? decadePart + ' ' : ''}Hits`.trim() || 'All the Hits';
        payload.minPopularity = 40;
      } else {
        payload.decade = newStationDecade;
        payload.genre = newStationGenre;
        payload.name = newStationName.trim() || `${newStationDecade} ${newStationGenre}`;
      }

      const res = await fetch('/api/stations/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.error) { alert(data.error); }
      else {
        setNewStationName('');
        fetchStations();
      }
    } catch (e: any) { alert(e?.message ?? 'Failed'); }
    setStationSaving(false);
  };

  const handleRemoveStation = async (id: string) => {
    try {
      await fetch(`/api/stations/manage?id=${id}`, { method: 'DELETE' });
      fetchStations();
    } catch { /* ignore */ }
  };

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
    fetchStations();
  }, [fetchStations]);

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
          body: JSON.stringify({
            batchSize: 50,
            providerOrder: popOrder.filter(p => !popDisabled.includes(p)),
            disabledProviders: popDisabled,
          }),
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

  // Render a provider card for the provider management section
  function ProviderCard({ provider, type, order, disabled, onMove, onToggle }: {
    provider: PopProvider | LyricsProvider;
    type: 'popularity' | 'lyrics';
    order: string[];
    disabled: string[];
    onMove: (id: string, dir: 'up' | 'down') => void;
    onToggle: (id: string) => void;
  }) {
    const idx = order.indexOf(provider.id);
    const isDisabled = disabled.includes(provider.id);
    const test = providerTests[provider.id];
    const isTesting = testingProvider === provider.id;

    return (
      <div className={`p-3 rounded-lg border transition-colors ${isDisabled ? 'bg-secondary/20 border-border/10 opacity-60' : 'bg-secondary/40 border-border/20'}`}>
        <div className="flex items-center gap-3">
          {/* Priority arrows */}
          <div className="flex flex-col gap-0.5">
            <button onClick={() => onMove(provider.id, 'up')} disabled={idx <= 0} className="p-0.5 rounded hover:bg-background/50 disabled:opacity-20">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onMove(provider.id, 'down')} disabled={idx >= order.length - 1} className="p-0.5 rounded hover:bg-background/50 disabled:opacity-20">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Priority number */}
          <span className="text-xs font-mono text-muted-foreground w-4 text-center">#{idx + 1}</span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{provider.label}</p>
              {test && !isTesting && (
                test.working
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  : <XCircle className="w-3.5 h-3.5 text-red-500" />
              )}
              {test?.score !== undefined && test?.score !== null && (
                <span className="text-xs font-mono text-accent">Score: {test.score}</span>
              )}
              {test?.synced !== undefined && (
                <span className="text-xs font-mono text-accent">{test.synced ? 'Synced' : 'Plain'}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{provider.desc}</p>
            {test?.error && <p className="text-xs text-red-400 mt-0.5">{test.error}</p>}
          </div>

          {/* Actions */}
          <button
            onClick={() => handleTestProvider(provider.id, type)}
            disabled={isTesting}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-background/50 hover:bg-background/80 border border-border/20 transition-colors flex items-center gap-1"
          >
            {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Test
          </button>
          <button
            onClick={() => onToggle(provider.id)}
            className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors border ${
              isDisabled
                ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
            }`}
          >
            {isDisabled ? 'Disabled' : 'Enabled'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-[900px] mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold tracking-tight flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          Settings
        </h2>
        <p className="text-muted-foreground text-sm mt-1">Providers, diagnostics, preferences & configuration</p>
      </div>

      {/* Provider Management */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-accent" />
          Popularity Providers
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Providers are tried in priority order. The first provider to return a result wins.
          Use the arrows to reorder, toggle to enable/disable, and test to verify each provider.
        </p>
        <div className="space-y-2 mb-4">
          {popOrder.map(pid => {
            const prov = POP_PROVIDERS.find(p => p.id === pid);
            if (!prov) return null;
            return (
              <ProviderCard
                key={prov.id}
                provider={prov}
                type="popularity"
                order={popOrder}
                disabled={popDisabled}
                onMove={(id, dir) => moveProvider(popOrder, setPopOrder, id, dir)}
                onToggle={(id) => toggleDisabled(popDisabled, setPopDisabled, id)}
              />
            );
          })}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleRunPopularity}
            disabled={popularityRunning}
            className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
          >
            {popularityRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gauge className="w-3 h-3" />}
            Run Popularity Check
          </button>
          <button
            onClick={async () => {
              if (!confirm('Reset all popularity data? This lets you re-run with different providers/priority.')) return;
              try { await fetch('/api/popularity', { method: 'DELETE' }); fetchDiagnostics(); } catch { /* ignore */ }
            }}
            className="px-4 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1 text-amber-400"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Popularity Data
          </button>
          <button
            onClick={() => { setShowTopTracks(!showTopTracks); if (!showTopTracks && !topTracks) fetchTopTracks(); }}
            className="px-4 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
          >
            <BarChart3 className="w-3 h-3" />
            {showTopTracks ? 'Hide' : 'View'} Top Tracks
          </button>
        </div>
        {popularityProgress && (
          <p className="text-xs text-muted-foreground mt-2">{popularityProgress}</p>
        )}

        {/* Top Tracks Viewer */}
        {showTopTracks && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4">
            <div className="p-4 rounded-lg bg-background/50 border border-border/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Top Tracks by Popularity
                </h4>
                <button onClick={fetchTopTracks} disabled={topTracksLoading} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RefreshCw className={`w-3 h-3 ${topTracksLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {/* Distribution stats */}
              {topTracksStats && (
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {[
                    { label: 'Total', value: topTracksStats.totalTracks, color: '' },
                    { label: 'High (70+)', value: topTracksStats.distribution?.high ?? 0, color: 'text-green-400' },
                    { label: 'Med (40-69)', value: topTracksStats.distribution?.medium ?? 0, color: 'text-yellow-400' },
                    { label: 'Low (1-39)', value: topTracksStats.distribution?.low ?? 0, color: 'text-orange-400' },
                    { label: 'Unchecked', value: topTracksStats.unchecked ?? 0, color: 'text-muted-foreground' },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-lg bg-secondary/30">
                      <p className={`text-lg font-bold font-mono ${s.color}`}>{(s.value ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {topTracksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !topTracks || topTracks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No popularity data yet. Run a popularity check first.</p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {topTracks.map((t: any, i: number) => (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.artistName}</p>
                      </div>
                      {t.genre && <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/50">{t.genre}</span>}
                      {t.year && <span className="text-[10px] text-muted-foreground font-mono">{t.year}</span>}
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-2 rounded-full bg-secondary/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (t.popularity ?? 0) >= 70 ? 'bg-green-500' : (t.popularity ?? 0) >= 40 ? 'bg-yellow-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${t.popularity ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold w-7 text-right">{t.popularity ?? 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Lyrics Providers */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
        <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
          <Music2 className="w-5 h-5 text-accent" />
          Lyrics Providers
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          LRCLIB provides synced timestamps. Genius provides plain text. Priority determines which is tried first.
        </p>
        <div className="space-y-2">
          {lyricsOrder.map(pid => {
            const prov = LYRICS_PROVIDERS.find(p => p.id === pid);
            if (!prov) return null;
            return (
              <ProviderCard
                key={prov.id}
                provider={prov}
                type="lyrics"
                order={lyricsOrder}
                disabled={lyricsDisabled}
                onMove={(id, dir) => moveProvider(lyricsOrder, setLyricsOrder, id, dir)}
                onToggle={(id) => toggleDisabled(lyricsDisabled, setLyricsDisabled, id)}
              />
            );
          })}
        </div>
      </motion.div>

      {/* System Diagnostics */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
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
            ok={diagnostics ? (diagnostics.library?.tracks > 0) : null}
            label="Library Cache"
            detail={diagnostics?.library ? `${diagnostics.library.artists} artists, ${diagnostics.library.albums} albums, ${diagnostics.library.tracks} tracks` : 'Checking...'}
          />
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={handleResync}
            disabled={resyncing}
            className="px-4 py-2 text-xs rounded-lg bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
          >
            {resyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Resync Library
          </button>
        </div>
      </motion.div>

      {/* Library Stats */}
      {diagnostics?.library && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
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
          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Auto-switch to Now Playing</label>
            <p className="text-xs text-muted-foreground mb-2">Automatically show Now Playing after idle</p>
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="120" step="5" value={idleTimeout} onChange={(e) => onIdleTimeoutChange(parseInt(e.target.value))} className="flex-1 h-2 accent-primary" />
              <span className="text-sm font-mono w-16 text-right">{idleTimeout === 0 ? 'Off' : `${idleTimeout}s`}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Now Playing Layout</label>
            <p className="text-xs text-muted-foreground mb-2">Column size distribution</p>
            <div className="flex gap-2 mt-2">
              {[
                { id: 'balanced', label: 'Balanced', desc: '30 / 40 / 30' },
                { id: 'lyrics', label: 'Lyrics Focus', desc: '25 / 50 / 25' },
                { id: 'art', label: 'Art Focus', desc: '40 / 35 / 25' },
              ].map((layout) => (
                <button key={layout.id} onClick={() => onColumnLayoutChange(layout.id)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${columnLayout === layout.id ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' : 'bg-secondary hover:bg-secondary/80'}`}>
                  {layout.label}<p className="text-[10px] opacity-70 mt-0.5">{layout.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Lyrics Text Size</label>
            <p className="text-xs text-muted-foreground mb-2">Zoom level for lyrics display</p>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="5" step="1" value={lyricsZoom} onChange={(e) => onLyricsZoomChange(parseInt(e.target.value))} className="flex-1 h-2 accent-primary" />
              <span className="text-sm font-mono w-16 text-right">{lyricsZoom === 1 ? 'Tiny' : lyricsZoom === 2 ? 'Small' : lyricsZoom === 3 ? 'Medium' : lyricsZoom === 4 ? 'Large' : 'Huge'}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Artist Grid Rows</label>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="6" step="1" value={artistRows} onChange={(e) => onArtistRowsChange(parseInt(e.target.value))} className="flex-1 h-2 accent-primary" />
              <span className="text-sm font-mono w-10 text-right">{artistRows}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Station Grid Rows</label>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="4" step="1" value={stationRows} onChange={(e) => onStationRowsChange(parseInt(e.target.value))} className="flex-1 h-2 accent-primary" />
              <span className="text-sm font-mono w-10 text-right">{stationRows}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Previous Tracks in Queue</label>
            <div className="flex items-center gap-3">
              <input type="range" min="0" max="20" step="1" value={previousTrackCount} onChange={(e) => onPreviousTrackCountChange(parseInt(e.target.value))} className="flex-1 h-2 accent-primary" />
              <span className="text-sm font-mono w-10 text-right">{previousTrackCount}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Equalizer Bands</label>
            <div className="flex items-center gap-3">
              <input type="range" min="8" max="64" step="4" value={eqBands} onChange={(e) => onEqBandsChange(parseInt(e.target.value))} className="flex-1 h-2 accent-primary" />
              <span className="text-sm font-mono w-10 text-right">{eqBands}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Equalizer Colors</label>
            <div className="flex gap-2 mt-2">
              {[
                { id: 'classic', label: 'Classic', colors: 'from-green-500 via-yellow-500 to-red-500' },
                { id: 'purple', label: 'Purple', colors: 'from-violet-600 via-purple-500 to-pink-500' },
                { id: 'cyan', label: 'Cyan', colors: 'from-sky-500 via-cyan-500 to-pink-500' },
              ].map((scheme) => (
                <button key={scheme.id} onClick={() => onEqColorSchemeChange(scheme.id)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${eqColorScheme === scheme.id ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' : 'bg-secondary hover:bg-secondary/80'}`}>
                  <div className={`w-12 h-2 rounded-full bg-gradient-to-r ${scheme.colors} mb-1`} />{scheme.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
            <label className="text-sm font-medium">Touch Keyboard Size</label>
            <div className="flex gap-2 mt-2">
              {(['small', 'medium', 'large', 'xl', 'xxl'] as const).map((sz) => (
                <button key={sz} onClick={() => onKeyboardSizeChange(sz)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${keyboardSize === sz ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' : 'bg-secondary hover:bg-secondary/80'}`}>
                  {sz.charAt(0).toUpperCase() + sz.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Station Tuning */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mb-8">
        <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-accent" />
          Station Tuning
        </h3>

        {/* Stats bar */}
        {tuningStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <div className="p-2 rounded-lg bg-secondary/40 border border-border/20 text-center">
              <p className="text-lg font-bold text-primary">{tuningStats.totalTracks?.toLocaleString?.()}</p>
              <p className="text-[10px] text-muted-foreground">Total Tracks</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/40 border border-border/20 text-center">
              <p className="text-lg font-bold text-primary">{tuningStats.withGenre?.toLocaleString?.()}</p>
              <p className="text-[10px] text-muted-foreground">Have Genre</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/40 border border-border/20 text-center">
              <p className="text-lg font-bold text-primary">{tuningStats.withYear?.toLocaleString?.()}</p>
              <p className="text-[10px] text-muted-foreground">Have Year</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/40 border border-border/20 text-center">
              <p className="text-lg font-bold text-primary">{tuningStats.withPopularity?.toLocaleString?.()}</p>
              <p className="text-[10px] text-muted-foreground">Have Popularity</p>
            </div>
          </div>
        )}

        {/* Min popularity slider for hits stations */}
        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20 mb-3">
          <label className="text-sm font-medium">Hits Station Min Popularity</label>
          <p className="text-xs text-muted-foreground mb-2">Lower this value to include more tracks in Hits stations. Standard stations (decade+genre) are not affected by this.</p>
          <div className="flex items-center gap-3">
            <input
              type="range" min="0" max="80" step="5" value={tuningMinPop}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setTuningMinPop(val);
                if (tuningTimerRef.current) clearTimeout(tuningTimerRef.current);
                tuningTimerRef.current = setTimeout(() => fetchStationPreview(val), 400);
              }}
              className="flex-1 h-2 accent-primary"
            />
            <span className="text-sm font-mono w-10 text-right">{tuningMinPop}</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleRescanStations}
              disabled={rescanning}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-2"
            >
              {rescanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Apply &amp; Rescan Stations
            </button>
            <p className="text-xs text-muted-foreground">Updates all station track counts and saves the new min popularity for Hits stations.</p>
          </div>
        </div>

        {/* Real-time preview of station track counts */}
        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">
              Station Track Counts
              {tuningLoading && <Loader2 className="w-3 h-3 animate-spin inline ml-2" />}
            </label>
            <button onClick={() => fetchStationPreview(tuningMinPop)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {tuningPreview && tuningPreview.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[300px] overflow-y-auto">
              {(tuningPreview as any[])
                .sort((a: any, b: any) => (b.trackCount ?? 0) - (a.trackCount ?? 0))
                .map((s: any) => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{s.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-20 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.trackCount > 50 ? 'bg-green-500' : s.trackCount > 10 ? 'bg-yellow-500' : s.trackCount > 0 ? 'bg-orange-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, (s.trackCount / Math.max(1, ...(tuningPreview as any[]).map((x: any) => x.trackCount ?? 0))) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-12 text-right ${s.trackCount === 0 ? 'text-red-400' : s.trackCount < 10 ? 'text-orange-400' : 'text-foreground'}`}>
                      {s.trackCount?.toLocaleString?.() ?? 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : tuningPreview && tuningPreview.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No stations found. Add stations below.</p>
          ) : null}
        </div>
      </motion.div>

      {/* Station Management */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-8">
        <h3 className="text-lg font-display font-semibold mb-3 flex items-center gap-2">
          <Radio className="w-5 h-5 text-accent" />
          Station Management
        </h3>

        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20 mb-3">
          <label className="text-sm font-medium">Add Station</label>
          <div className="flex gap-2 mb-3 mt-2">
            {[
              { id: 'standard' as const, label: 'Standard', desc: 'Decade + Genre' },
              { id: 'hits' as const, label: 'Hits', desc: 'Top tracks across eras' },
              { id: 'most-played' as const, label: 'Most Played', desc: 'Your favorites' },
            ].map((t) => (
              <button key={t.id} onClick={() => setNewStationType(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${newStationType === t.id ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' : 'bg-secondary hover:bg-secondary/80'}`}>
                {t.label}<p className="text-[10px] opacity-70 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 flex-wrap">
            {newStationType !== 'most-played' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Decade</label>
                  <select value={newStationDecade} onChange={(e) => setNewStationDecade(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
                    {newStationType === 'hits' && <option value="all">All Decades</option>}
                    {DECADES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Genre</label>
                  <select value={newStationGenre} onChange={(e) => setNewStationGenre(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
                    {newStationType === 'hits' && <option value="all">All Genres</option>}
                    {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-muted-foreground block mb-1">Custom Name (optional)</label>
              <input type="text" value={newStationName} onChange={(e) => setNewStationName(e.target.value)}
                placeholder={newStationType === 'most-played' ? 'Most Played' : newStationType === 'hits' ? `${newStationGenre !== 'all' ? newStationGenre + ' ' : ''}Hits` : `${newStationDecade} ${newStationGenre}`}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
            <button onClick={handleAddStation} disabled={stationSaving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-1">
              {stationSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
            </button>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">Active Stations ({stations.length})</label>
            <button onClick={fetchStations} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${stationsLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          {stationsLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : stations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active stations. Add one above.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {stations.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border/10 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {s.stationType === 'hits' ? 'Hits' : s.stationType === 'most-played' ? 'Most Played' : `${s.decade ?? ''} ${s.genre ?? ''}`.trim()}
                      {' '}<span className={`${(s.trackCount ?? 0) === 0 ? 'text-red-400' : 'text-muted-foreground'}`}>({s.trackCount ?? 0} tracks)</span>
                    </p>
                  </div>
                  <button onClick={() => handleRemoveStation(s.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Remove station">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Plex Config */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 className="text-lg font-display font-semibold mb-3">Plex Configuration</h3>
        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20">
          <p className="text-sm text-muted-foreground mb-3">Reconfigure your Plex server connection or re-sync your library.</p>
          <button onClick={() => { window.location.href = '/setup'; }} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Open Setup Wizard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
