"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Disc3, Play, Loader2, Music2, Plus, Pencil, Trash2, X, Save, Check, Radio, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer, TrackInfo } from '@/lib/player-context';
import type { ViewType } from './jukebox-shell';
import { toast } from 'sonner';
import PlexImage from './plex-image';

interface MixesViewProps {
  onNavigate: (view: ViewType, opts?: any) => void;
  stationQueueSize?: number;
}

function MixCard({ mix, onPlay, onEdit, onDelete, isPlaying, cardSize }: {
  mix: any; onPlay: () => void; onEdit: () => void; onDelete: () => void; isPlaying: boolean; cardSize: number;
}) {
  const labelSize = cardSize > 300 ? 'text-xl' : cardSize > 200 ? 'text-lg' : 'text-base';
  const subSize = cardSize > 300 ? 'text-sm' : 'text-xs';
  const stationCount = mix?.stationIds?.length ?? 0;
  const artistCount = mix?.artistIds?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-shrink-0 group relative"
      style={{ width: cardSize, height: cardSize }}
    >
      <button onClick={onPlay} disabled={isPlaying} className="w-full h-full text-left">
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-violet-900/60 to-indigo-950/50">
          {mix?.imageUrl ? (
            <div className="w-full h-full"><PlexImage thumb={mix.imageUrl} alt={mix.name} size={Math.round(cardSize * 2)} /></div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Disc3 className="w-16 h-16 text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-[clamp(3rem,8%,5rem)] h-[clamp(3rem,8%,5rem)] rounded-full bg-primary/90 flex items-center justify-center shadow-lg backdrop-blur-sm">
              {isPlaying ? <Loader2 className="w-[40%] h-[40%] animate-spin text-primary-foreground" /> : <Play className="w-[40%] h-[40%] text-primary-foreground ml-0.5" />}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h4 className={`font-display font-bold ${labelSize} text-white leading-tight`}>{mix?.name ?? 'Mix'}</h4>
            <p className={`${subSize} text-white/60 mt-0.5`}>
              {stationCount > 0 && `${stationCount} station${stationCount > 1 ? 's' : ''}`}
              {stationCount > 0 && artistCount > 0 && ' · '}
              {artistCount > 0 && `${artistCount} artist${artistCount > 1 ? 's' : ''}`}
              {stationCount === 0 && artistCount === 0 && 'Empty mix'}
            </p>
          </div>
        </div>
      </button>
      {/* Edit/delete buttons on hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-full bg-black/60 hover:bg-red-600/80 text-white transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function MixesView({ onNavigate, stationQueueSize = 25 }: MixesViewProps) {
  const [mixes, setMixes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingMix, setPlayingMix] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null); // null=list, 'new'=creating, object=editing
  const [stations, setStations] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [artistSearch, setArtistSearch] = useState('');
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const { playQueue, setCurrentStationId, setCurrentStationName } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState(200);

  // Form state
  const [formName, setFormName] = useState('');
  const [formStationIds, setFormStationIds] = useState<string[]>([]);
  const [formArtistIds, setFormArtistIds] = useState<string[]>([]);
  const [formArtistNames, setFormArtistNames] = useState<Record<string, string>>({});
  const [formPopularOnly, setFormPopularOnly] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMixes = useCallback(() => {
    setLoading(true);
    fetch('/api/mixes').then(r => r?.json?.()).then(data => { setMixes(data?.mixes ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchMixes(); }, [fetchMixes]);

  // Fetch stations list for the editor
  useEffect(() => {
    if (editing !== null) {
      fetch('/api/stations').then(r => r?.json?.()).then(data => setStations(data?.stations ?? [])).catch(() => {});
    }
  }, [editing]);

  // Search artists
  useEffect(() => {
    if (!artistSearch || artistSearch.length < 2) { setArtistResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/artists?search=${encodeURIComponent(artistSearch)}&limit=20`)
        .then(r => r?.json?.())
        .then(data => setArtistResults(data?.artists ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [artistSearch]);

  // Card sizing
  useEffect(() => {
    const calcSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const available = container.clientHeight;
      const perRow = Math.max(120, Math.round(available * 0.70));
      setCardSize(perRow);
    };
    calcSize();
    const ro = new ResizeObserver(calcSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [mixes]);

  const handlePlay = async (mix: any) => {
    setPlayingMix(mix.id);
    try {
      const res = await fetch(`/api/mixes/${mix.id}/tracks?limit=${stationQueueSize}`);
      const data = await res?.json?.();
      const tracks: TrackInfo[] = (data?.tracks ?? [])?.map?.((t: any) => ({
        id: t?.id ?? '',
        title: t?.title ?? '',
        artistName: t?.artist?.name ?? t?.artistName ?? '',
        albumTitle: t?.album?.title ?? t?.albumTitle ?? '',
        thumb: t?.thumb ?? t?.album?.thumb ?? null,
        mediaKey: t?.mediaKey ?? null,
        duration: t?.duration ?? null,
        ratingKey: t?.ratingKey ?? '',
        year: t?.year ?? t?.album?.year ?? null,
        artistId: t?.artistId ?? null,
        albumId: t?.albumId ?? null,
      })) ?? [];
      if (tracks?.length > 0) {
        playQueue(tracks);
        setCurrentStationId(null);
        setCurrentStationName(mix?.name ?? 'Mix');
        toast.success(`Playing ${mix?.name ?? 'Mix'}`);
      } else {
        toast.error('No tracks found for this mix');
      }
    } catch {
      toast.error('Failed to load mix tracks');
    }
    setPlayingMix(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/mixes/${id}`, { method: 'DELETE' });
      setMixes(prev => prev.filter(m => m.id !== id));
      toast.success('Mix deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const startEdit = (mix: any) => {
    setEditing(mix);
    setFormName(mix.name ?? '');
    setFormStationIds(mix.stationIds ?? []);
    setFormArtistIds(mix.artistIds ?? []);
    setFormPopularOnly(mix.popularOnly ?? true);
    setArtistSearch('');
    // Pre-populate artist names
    if (mix.artistIds?.length > 0) {
      fetch(`/api/artists?ids=${mix.artistIds.join(',')}`)
        .then(r => r?.json?.())
        .then(data => {
          const names: Record<string, string> = {};
          (data?.artists ?? []).forEach((a: any) => { if (a?.id) names[a.id] = a?.name ?? ''; });
          setFormArtistNames(prev => ({ ...prev, ...names }));
        })
        .catch(() => {});
    }
  };

  const startNew = () => {
    setEditing('new');
    setFormName('');
    setFormStationIds([]);
    setFormArtistIds([]);
    setFormArtistNames({});
    setFormPopularOnly(true);
    setArtistSearch('');
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const body = { name: formName, stationIds: formStationIds, artistIds: formArtistIds, popularOnly: formPopularOnly };
      if (editing === 'new') {
        const res = await fetch('/api/mixes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res?.json?.();
        if (data?.mix) { setMixes(prev => [data.mix, ...prev]); toast.success('Mix created!'); }
      } else {
        const res = await fetch(`/api/mixes/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res?.json?.();
        if (data?.mix) { setMixes(prev => prev.map(m => m.id === data.mix.id ? data.mix : m)); toast.success('Mix updated!'); }
      }
      setEditing(null);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const toggleStation = (id: string) => {
    setFormStationIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const addArtist = (artist: any) => {
    if (!formArtistIds.includes(artist.id)) {
      setFormArtistIds(prev => [...prev, artist.id]);
      setFormArtistNames(prev => ({ ...prev, [artist.id]: artist.name }));
    }
    setArtistSearch('');
    setArtistResults([]);
  };

  const removeArtist = (id: string) => {
    setFormArtistIds(prev => prev.filter(a => a !== id));
  };

  // Editor view
  if (editing !== null) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        <div className="flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-primary" />
            {editing === 'new' ? 'Create Mix' : 'Edit Mix'}
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium mb-1 block">Mix Name</label>
            <input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="My Custom Mix"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border/30 text-sm"
            />
          </div>

          {/* Stations selection */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" /> Stations
            </label>
            <p className="text-xs text-muted-foreground mb-2">Select stations to pull tracks from</p>
            <div className="flex flex-wrap gap-2">
              {stations.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => toggleStation(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    formStationIds.includes(s.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                  }`}
                >
                  {formStationIds.includes(s.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Artist emphasis */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Emphasized Artists
            </label>
            <p className="text-xs text-muted-foreground mb-2">Add artists whose tracks will be emphasized in the mix</p>
            {/* Selected artists chips */}
            {formArtistIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formArtistIds.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs">
                    {formArtistNames[id] ?? id}
                    <button onClick={() => removeArtist(id)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            {/* Search input */}
            <input
              value={artistSearch}
              onChange={e => setArtistSearch(e.target.value)}
              placeholder="Search artists to add..."
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border/30 text-sm"
            />
            {artistResults.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-secondary border border-border/30">
                {artistResults.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => addArtist(a)}
                    disabled={formArtistIds.includes(a.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 flex items-center gap-2 ${
                      formArtistIds.includes(a.id) ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {a.thumb ? <PlexImage thumb={a.thumb} alt={a.name} size={48} /> : <Users className="w-full h-full p-1 text-muted-foreground" />}
                    </div>
                    {a.name}
                    {formArtistIds.includes(a.id) && <Check className="w-3 h-3 ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popular only toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFormPopularOnly(!formPopularOnly)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                formPopularOnly ? 'bg-primary' : 'bg-secondary'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                formPopularOnly ? 'left-5' : 'left-0.5'
              }`} />
            </button>
            <span className="text-sm">Popular tracks only</span>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden px-4 py-3">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="text-lg font-display font-bold flex items-center gap-2">
          <Disc3 className="w-5 h-5 text-primary" /> Mixes
        </h2>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Mix
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : mixes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Disc3 className="w-16 h-16 opacity-30" />
          <p className="text-lg font-medium">No mixes yet</p>
          <p className="text-sm">Create a mix by combining stations and artists</p>
          <button onClick={startNew} className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            <Plus className="w-4 h-4" /> Create Your First Mix
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden scrollbar-none">
          <div className="flex gap-3 h-full items-center">
            {mixes.map((mix: any) => (
              <MixCard
                key={mix.id}
                mix={mix}
                onPlay={() => handlePlay(mix)}
                onEdit={() => startEdit(mix)}
                onDelete={() => handleDelete(mix.id)}
                isPlaying={playingMix === mix.id}
                cardSize={cardSize}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
