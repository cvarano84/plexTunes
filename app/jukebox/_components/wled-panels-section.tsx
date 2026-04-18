"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Lightbulb, Plus, Trash2, Loader2, XCircle,
  RefreshCw, ChevronDown, ChevronUp, Play, Save, AlertCircle,
} from 'lucide-react';

type Instance = {
  id: string;
  name: string;
  host: string;
  enabled: boolean;
  brightnessCap: number;

  matrixEnabled: boolean;
  matrixSegmentId: number;
  matrixTextFormat: string;
  matrixColorMode: 'fixed' | 'random' | string;
  matrixColor: string;
  matrixEffectId: number;
  matrixSpeed: number;
  matrixIntensity: number;

  perimeterEnabled: boolean;
  perimeterSegmentId: number;
  perimeterEffectId: number;
  perimeterColor: string;
  perimeterPaletteId: number;
  perimeterSpeed: number;
  perimeterIntensity: number;

  lastSeenAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProbeInfo = {
  online: boolean;
  host: string;
  version?: string | null;
  name?: string | null;
  ledCount?: number | null;
  is2d?: boolean;
  matrix?: any;
  effects?: string[];
  palettes?: string[];
  error?: string;
};

const DEFAULT_NEW: Partial<Instance> = {
  name: '',
  host: '',
  enabled: true,
  brightnessCap: 200,
  matrixEnabled: true,
  matrixSegmentId: 0,
  matrixTextFormat: '{title}',
  matrixColorMode: 'fixed',
  matrixColor: '#22c55e',
  matrixEffectId: 165,
  matrixSpeed: 128,
  matrixIntensity: 128,
  perimeterEnabled: true,
  perimeterSegmentId: 1,
  perimeterEffectId: 9,
  perimeterColor: '#06b6d4',
  perimeterPaletteId: 0,
  perimeterSpeed: 128,
  perimeterIntensity: 128,
};

const AUDIO_REACTIVE_HINTS: Array<{ id: number; label: string }> = [
  // Common audio-reactive effect IDs in WLED-MM / SR builds.
  { id: 128, label: 'Perlin Move (AR)' },
  { id: 140, label: 'Ripple Peak (AR)' },
  { id: 141, label: 'Gravimeter (AR)' },
  { id: 142, label: 'Pixels (AR)' },
  { id: 143, label: 'Plasmoid (AR)' },
  { id: 144, label: 'Puddles (AR)' },
  { id: 145, label: 'Matripix (AR)' },
  { id: 146, label: 'Midnoise (AR)' },
  { id: 147, label: 'Blurz (AR)' },
  { id: 148, label: 'Freqmap (AR)' },
  { id: 149, label: 'Gravcenter (AR)' },
  { id: 150, label: 'Noisefire (AR)' },
];

function StatusDot({ inst }: { inst: Instance }) {
  const now = Date.now();
  const seen = inst.lastSeenAt ? Date.parse(inst.lastSeenAt) : 0;
  const fresh = seen && now - seen < 10 * 60 * 1000;
  if (inst.lastError && !fresh) {
    return <span title={inst.lastError} className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />;
  }
  if (fresh) {
    return <span title="Online" className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />;
  }
  return <span title="Unknown" className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/60" />;
}

export default function WledPanelsSection() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-instance expansion state + probe cache.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [probes, setProbes] = useState<Record<string, ProbeInfo | null>>({});
  const [probing, setProbing] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string | null>>({});

  // Local edits (drafts) per instance so we can debounce saves.
  const [drafts, setDrafts] = useState<Record<string, Partial<Instance>>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newDraft, setNewDraft] = useState<Partial<Instance>>(DEFAULT_NEW);
  const [creating, setCreating] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/wled/instances', { cache: 'no-store' });
      const j = await r.json();
      setInstances(j.instances ?? []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const probe = useCallback(async (id: string, hostOverride?: string) => {
    setProbing(p => ({ ...p, [id]: true }));
    try {
      const url = hostOverride
        ? `/api/wled/instances/${id}/info?host=${encodeURIComponent(hostOverride)}`
        : `/api/wled/instances/${id}/info`;
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      setProbes(p => ({ ...p, [id]: j }));
    } catch (e: any) {
      setProbes(p => ({ ...p, [id]: { online: false, host: hostOverride ?? '', error: e?.message } }));
    } finally {
      setProbing(p => ({ ...p, [id]: false }));
    }
  }, []);

  const toggleExpand = useCallback(async (id: string) => {
    setExpanded(e => ({ ...e, [id]: !e[id] }));
    if (!probes[id]) probe(id);
  }, [probe, probes]);

  const getEffective = useCallback((id: string): Instance | null => {
    const base = instances.find(i => i.id === id);
    if (!base) return null;
    return { ...base, ...(drafts[id] ?? {}) } as Instance;
  }, [instances, drafts]);

  const updateDraft = useCallback((id: string, patch: Partial<Instance>) => {
    setDrafts(d => ({ ...d, [id]: { ...(d[id] ?? {}), ...patch } }));
  }, []);

  const save = useCallback(async (id: string) => {
    const d = drafts[id];
    if (!d || Object.keys(d).length === 0) return;
    setSavingId(id);
    try {
      const r = await fetch(`/api/wled/instances/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      const j = await r.json();
      if (j.instance) {
        setInstances(prev => prev.map(i => i.id === id ? j.instance : i));
        setDrafts(prev => { const n = { ...prev }; delete n[id]; return n; });
      }
    } finally {
      setSavingId(null);
    }
  }, [drafts]);

  const test = useCallback(async (id: string) => {
    setTestingId(id);
    setTestResult(t => ({ ...t, [id]: null }));
    try {
      // Save any pending edits first so the test reflects current UI.
      if (drafts[id] && Object.keys(drafts[id]).length > 0) {
        await save(id);
      }
      const r = await fetch(`/api/wled/instances/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      setTestResult(t => ({ ...t, [id]: j.ok ? 'Pushed preview' : (j.error ?? 'Failed') }));
    } catch (e: any) {
      setTestResult(t => ({ ...t, [id]: e?.message ?? 'Failed' }));
    } finally {
      setTestingId(null);
      setTimeout(() => setTestResult(t => ({ ...t, [id]: null })), 4000);
    }
  }, [drafts, save]);

  const del = useCallback(async (id: string) => {
    if (!confirm('Delete this WLED panel?')) return;
    await fetch(`/api/wled/instances/${id}`, { method: 'DELETE' });
    setInstances(prev => prev.filter(i => i.id !== id));
  }, []);

  const add = useCallback(async () => {
    if (!newDraft.name || !newDraft.host) return;
    setCreating(true);
    try {
      const r = await fetch('/api/wled/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDraft),
      });
      const j = await r.json();
      if (j.instance) {
        setInstances(prev => [...prev, j.instance]);
        setNewDraft(DEFAULT_NEW);
        setShowAdd(false);
      }
    } finally {
      setCreating(false);
    }
  }, [newDraft]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.27 }}
      className="mb-8"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-display font-semibold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-accent" />
          WLED Panels
        </h3>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Panel
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Configure WLED-powered light panels. Each unit has two outputs &#8212; a 2D matrix for the song title and a
        perimeter strip for ambient or audio-reactive effects. All panels update together when a new track plays.
      </p>

      {showAdd && (
        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20 mb-3 space-y-3">
          <h4 className="text-sm font-semibold">New Panel</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex flex-col text-xs">
              <span className="text-muted-foreground mb-1">Name</span>
              <input
                type="text" value={newDraft.name ?? ''}
                onChange={(e) => setNewDraft(n => ({ ...n, name: e.target.value }))}
                placeholder="Living Room"
                className="px-2 py-1.5 rounded-lg bg-background border border-border/50 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs">
              <span className="text-muted-foreground mb-1">Host (IP or hostname)</span>
              <input
                type="text" value={newDraft.host ?? ''}
                onChange={(e) => setNewDraft(n => ({ ...n, host: e.target.value }))}
                placeholder="192.168.1.42"
                className="px-2 py-1.5 rounded-lg bg-background border border-border/50 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={add}
              disabled={creating || !newDraft.name || !newDraft.host}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewDraft(DEFAULT_NEW); }}
              className="px-3 py-1.5 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6 rounded-lg bg-secondary/40 border border-border/20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
      ) : instances.length === 0 ? (
        <div className="p-4 rounded-lg bg-secondary/40 border border-border/20 text-sm text-muted-foreground">
          No WLED panels configured yet. Click <strong>Add Panel</strong> above to connect one.
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((raw) => {
            const inst = getEffective(raw.id);
            if (!inst) return null;
            const draft = drafts[raw.id];
            const dirty = !!(draft && Object.keys(draft).length > 0);
            const probeInfo = probes[raw.id];
            const isOpen = !!expanded[raw.id];
            const effectsList = probeInfo?.effects ?? [];
            const palettesList = probeInfo?.palettes ?? [];
            const needs2D = inst.matrixEnabled && probeInfo && probeInfo.online && !probeInfo.is2d;

            return (
              <div key={raw.id} className="rounded-lg bg-secondary/40 border border-border/20 overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <StatusDot inst={raw} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inst.name}
                        onChange={(e) => updateDraft(raw.id, { name: e.target.value })}
                        className="bg-transparent text-sm font-medium outline-none border-b border-transparent focus:border-border px-1 -ml-1 min-w-0 flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <input
                        type="text"
                        value={inst.host}
                        onChange={(e) => updateDraft(raw.id, { host: e.target.value })}
                        className="bg-transparent outline-none border-b border-transparent focus:border-border px-1 -ml-1 font-mono"
                      />
                      {probeInfo?.version && <span>&bull; v{probeInfo.version}</span>}
                      {probeInfo?.ledCount != null && <span>&bull; {probeInfo.ledCount} LEDs</span>}
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={inst.enabled}
                      onChange={(e) => updateDraft(raw.id, { enabled: e.target.checked })}
                      className="accent-primary"
                    />
                    <span className="text-muted-foreground">Enabled</span>
                  </label>
                  <button
                    onClick={() => probe(raw.id)}
                    disabled={probing[raw.id]}
                    title="Re-check status"
                    className="p-1.5 rounded-lg hover:bg-background/60 transition-colors text-muted-foreground disabled:opacity-50"
                  >
                    {probing[raw.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => toggleExpand(raw.id)}
                    className="p-1.5 rounded-lg hover:bg-background/60 transition-colors text-muted-foreground"
                  >
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/10">
                    {probeInfo && !probeInfo.online && (
                      <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
                        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>Cannot reach WLED at {inst.host}: {probeInfo.error ?? 'offline'}</span>
                      </div>
                    )}
                    {needs2D && (
                      <div className="mt-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-400 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>Matrix output is enabled but this WLED isn&apos;t configured as a 2D matrix yet. Open the WLED UI &rarr; <em>2D Configuration</em> and set width/height, then come back.</span>
                      </div>
                    )}

                    {/* Brightness */}
                    <div className="flex items-center gap-3 mt-3">
                      <label className="text-xs text-muted-foreground w-28">Brightness cap</label>
                      <input
                        type="range" min={0} max={255}
                        value={inst.brightnessCap}
                        onChange={(e) => updateDraft(raw.id, { brightnessCap: parseInt(e.target.value) })}
                        className="flex-1 accent-primary h-2"
                      />
                      <span className="text-xs font-mono w-10 text-right">{inst.brightnessCap}</span>
                    </div>

                    {/* Matrix output (scrolling text) */}
                    <div className="rounded-lg bg-background/40 border border-border/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold">Output 1 - Matrix (scrolling song title)</h5>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={inst.matrixEnabled}
                            onChange={(e) => updateDraft(raw.id, { matrixEnabled: e.target.checked })}
                            className="accent-primary"
                          />
                          <span className="text-muted-foreground">Enabled</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">Segment ID</span>
                          <input
                            type="number" min={0} max={15}
                            value={inst.matrixSegmentId}
                            onChange={(e) => updateDraft(raw.id, { matrixSegmentId: parseInt(e.target.value) || 0 })}
                            className="px-2 py-1 rounded-lg bg-background border border-border/50 text-sm"
                          />
                        </label>
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">Effect</span>
                          <select
                            value={inst.matrixEffectId}
                            onChange={(e) => updateDraft(raw.id, { matrixEffectId: parseInt(e.target.value) })}
                            className="px-2 py-1 rounded-lg bg-background border border-border/50 text-sm"
                          >
                            {effectsList.length > 0 ? effectsList.map((name, i) => (
                              <option key={i} value={i}>{i}: {name}</option>
                            )) : (
                              <option value={165}>165: Scrolling Text</option>
                            )}
                          </select>
                        </label>
                      </div>

                      <label className="flex flex-col text-xs mt-2">
                        <span className="text-muted-foreground mb-1">
                          Text template <span className="opacity-70">(tokens: {`{title}`} {`{artist}`} {`{album}`} {`{station}`})</span>
                        </span>
                        <input
                          type="text"
                          value={inst.matrixTextFormat}
                          onChange={(e) => updateDraft(raw.id, { matrixTextFormat: e.target.value })}
                          className="px-2 py-1 rounded-lg bg-background border border-border/50 text-sm font-mono"
                        />
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">Colour mode</span>
                          <select
                            value={inst.matrixColorMode}
                            onChange={(e) => updateDraft(raw.id, { matrixColorMode: e.target.value })}
                            className="px-2 py-1 rounded-lg bg-background border border-border/50 text-sm"
                          >
                            <option value="fixed">Fixed colour</option>
                            <option value="random">Random each song</option>
                          </select>
                        </label>
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">Colour</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={inst.matrixColor}
                              onChange={(e) => updateDraft(raw.id, { matrixColor: e.target.value })}
                              disabled={inst.matrixColorMode === 'random'}
                              className="w-10 h-8 rounded-lg bg-background border border-border/50 cursor-pointer disabled:opacity-40"
                            />
                            <input
                              type="text"
                              value={inst.matrixColor}
                              onChange={(e) => updateDraft(raw.id, { matrixColor: e.target.value })}
                              disabled={inst.matrixColorMode === 'random'}
                              className="flex-1 px-2 py-1 rounded-lg bg-background border border-border/50 text-sm font-mono disabled:opacity-40"
                            />
                          </div>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground w-16">Speed</label>
                          <input
                            type="range" min={0} max={255}
                            value={inst.matrixSpeed}
                            onChange={(e) => updateDraft(raw.id, { matrixSpeed: parseInt(e.target.value) })}
                            className="flex-1 accent-primary h-2"
                          />
                          <span className="text-xs font-mono w-8 text-right">{inst.matrixSpeed}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground w-16">Intensity</label>
                          <input
                            type="range" min={0} max={255}
                            value={inst.matrixIntensity}
                            onChange={(e) => updateDraft(raw.id, { matrixIntensity: parseInt(e.target.value) })}
                            className="flex-1 accent-primary h-2"
                          />
                          <span className="text-xs font-mono w-8 text-right">{inst.matrixIntensity}</span>
                        </div>
                      </div>
                    </div>

                    {/* Perimeter output (ambient / audio-reactive) */}
                    <div className="rounded-lg bg-background/40 border border-border/20 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold">Output 2 - Perimeter (ambient)</h5>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={inst.perimeterEnabled}
                            onChange={(e) => updateDraft(raw.id, { perimeterEnabled: e.target.checked })}
                            className="accent-primary"
                          />
                          <span className="text-muted-foreground">Enabled</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">Segment ID</span>
                          <input
                            type="number" min={0} max={15}
                            value={inst.perimeterSegmentId}
                            onChange={(e) => updateDraft(raw.id, { perimeterSegmentId: parseInt(e.target.value) || 0 })}
                            className="px-2 py-1 rounded-lg bg-background border border-border/50 text-sm"
                          />
                        </label>
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">
                            Effect <span className="opacity-60">(&quot;AR&quot; effects use the built-in mic)</span>
                          </span>
                          <select
                            value={inst.perimeterEffectId}
                            onChange={(e) => updateDraft(raw.id, { perimeterEffectId: parseInt(e.target.value) })}
                            className="px-2 py-1 rounded-lg bg-background border border-border/50 text-sm"
                          >
                            {effectsList.length > 0 ? effectsList.map((name, i) => (
                              <option key={i} value={i}>{i}: {name}</option>
                            )) : AUDIO_REACTIVE_HINTS.map(o => (
                              <option key={o.id} value={o.id}>{o.id}: {o.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">Palette</span>
                          <select
                            value={inst.perimeterPaletteId}
                            onChange={(e) => updateDraft(raw.id, { perimeterPaletteId: parseInt(e.target.value) })}
                            className="px-2 py-1 rounded-lg bg-background border border-border/50 text-sm"
                          >
                            {palettesList.length > 0 ? palettesList.map((name, i) => (
                              <option key={i} value={i}>{i}: {name}</option>
                            )) : (
                              <option value={0}>0: Default</option>
                            )}
                          </select>
                        </label>
                        <label className="flex flex-col text-xs">
                          <span className="text-muted-foreground mb-1">Accent colour</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={inst.perimeterColor}
                              onChange={(e) => updateDraft(raw.id, { perimeterColor: e.target.value })}
                              className="w-10 h-8 rounded-lg bg-background border border-border/50 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={inst.perimeterColor}
                              onChange={(e) => updateDraft(raw.id, { perimeterColor: e.target.value })}
                              className="flex-1 px-2 py-1 rounded-lg bg-background border border-border/50 text-sm font-mono"
                            />
                          </div>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground w-16">Speed</label>
                          <input
                            type="range" min={0} max={255}
                            value={inst.perimeterSpeed}
                            onChange={(e) => updateDraft(raw.id, { perimeterSpeed: parseInt(e.target.value) })}
                            className="flex-1 accent-primary h-2"
                          />
                          <span className="text-xs font-mono w-8 text-right">{inst.perimeterSpeed}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-muted-foreground w-16">Intensity</label>
                          <input
                            type="range" min={0} max={255}
                            value={inst.perimeterIntensity}
                            onChange={(e) => updateDraft(raw.id, { perimeterIntensity: parseInt(e.target.value) })}
                            className="flex-1 accent-primary h-2"
                          />
                          <span className="text-xs font-mono w-8 text-right">{inst.perimeterIntensity}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => save(raw.id)}
                        disabled={!dirty || savingId === raw.id}
                        className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {savingId === raw.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save{dirty ? ' *' : ''}
                      </button>
                      <button
                        onClick={() => test(raw.id)}
                        disabled={testingId === raw.id}
                        className="px-3 py-1.5 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {testingId === raw.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Test
                      </button>
                      {testResult[raw.id] && (
                        <span className={`text-xs ${testResult[raw.id]?.startsWith('Pushed') ? 'text-green-400' : 'text-red-400'}`}>
                          {testResult[raw.id]}
                        </span>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => del(raw.id)}
                        title="Delete panel"
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
