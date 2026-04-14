"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export interface TrackInfo {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  thumb: string | null;
  mediaKey: string | null;
  duration: number | null;
  ratingKey: string;
  year?: number | null;
}

interface PlayerState {
  currentTrack: TrackInfo | null;
  queue: TrackInfo[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  currentStationId: string | null;
  currentStationName: string | null;
  queueIndex: number;
}

export interface EqGains {
  bass: number;   // -12 to +12 dB
  mid: number;    // -12 to +12 dB
  treble: number; // -12 to +12 dB
}

export const EQ_PRESETS: Record<string, EqGains> = {
  flat:       { bass: 0,  mid: 0,  treble: 0 },
  rock:       { bass: 4,  mid: -1, treble: 3 },
  pop:        { bass: 1,  mid: 3,  treble: 2 },
  jazz:       { bass: 2,  mid: 0,  treble: 3 },
  classical:  { bass: 0,  mid: 0,  treble: 3 },
  'bass boost': { bass: 8, mid: 0, treble: 0 },
  'treble boost': { bass: 0, mid: 0, treble: 6 },
  'vocal':    { bass: -2, mid: 4,  treble: 1 },
  'electronic': { bass: 5, mid: -2, treble: 4 },
};

export const EQ_10BAND_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_10BAND_LABELS = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

export const EQ_10BAND_PRESETS: Record<string, number[]> = {
  flat:          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock:          [4, 3, 1, 0, -1, 1, 2, 3, 4, 3],
  pop:           [0, 1, 3, 4, 3, 1, 0, 1, 2, 2],
  jazz:          [3, 2, 0, 1, -1, -1, 0, 1, 2, 3],
  classical:     [3, 2, 0, 0, 0, 0, 0, 1, 2, 3],
  'bass boost':  [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  'treble boost':[0, 0, 0, 0, 0, 0, 2, 4, 6, 8],
  vocal:         [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  electronic:    [5, 4, 2, 0, -2, -1, 2, 4, 5, 4],
};

interface PlayerContextType extends PlayerState {
  playTrack: (track: TrackInfo) => void;
  playQueue: (tracks: TrackInfo[], startIndex?: number) => void;
  addToQueue: (track: TrackInfo) => void;
  playNext: (track: TrackInfo) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setCurrentStationId: (id: string | null) => void;
  setCurrentStationName: (name: string | null) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  analyserNode: AnalyserNode | null;
  eqGains: EqGains;
  setEqGain: (band: keyof EqGains, value: number) => void;
  setEqPreset: (name: string) => void;
  eqPreset: string;
  eqMode: 'simple' | 'advanced';
  setEqMode: (mode: 'simple' | 'advanced') => void;
  advancedEqGains: number[];
  setAdvancedEqGain: (index: number, value: number) => void;
  setAdvancedEqPreset: (name: string) => void;
  advancedEqPreset: string;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer(): PlayerContextType {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return ctx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [queue, setQueue] = useState<TrackInfo[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [currentStationId, setCurrentStationId] = useState<string | null>(null);
  const [currentStationName, setCurrentStationName] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [eqGains, setEqGains] = useState<EqGains>({ bass: 0, mid: 0, treble: 0 });
  const [eqPreset, setEqPresetState] = useState('flat');
  const [eqMode, setEqModeState] = useState<'simple' | 'advanced'>('simple');
  const [advancedEqGains, setAdvancedEqGains] = useState<number[]>(new Array(10).fill(0));
  const [advancedEqPreset, setAdvancedEqPresetState] = useState('flat');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fetchingMoreRef = useRef(false);
  // Persistent Web Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const eqNodesRef = useRef<{ bass: BiquadFilterNode; mid: BiquadFilterNode; treble: BiquadFilterNode } | null>(null);
  const advancedEqNodesRef = useRef<BiquadFilterNode[] | null>(null);

  // Initialize Web Audio API once the audio element exists
  // This MUST live in the provider so it persists across view changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || sourceNodeRef.current) return;

    const initAudio = () => {
      if (sourceNodeRef.current) return; // already initialized
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = ctx.createMediaElementSource(audio);

        // 3-band EQ: lowshelf (bass), peaking (mid), highshelf (treble)
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 250;
        bassFilter.gain.value = 0;

        const midFilter = ctx.createBiquadFilter();
        midFilter.type = 'peaking';
        midFilter.frequency.value = 1500;
        midFilter.Q.value = 0.7;
        midFilter.gain.value = 0;

        const trebleFilter = ctx.createBiquadFilter();
        trebleFilter.type = 'highshelf';
        trebleFilter.frequency.value = 4000;
        trebleFilter.gain.value = 0;

        // Create 10-band peaking filters
        const advFilters: BiquadFilterNode[] = EQ_10BAND_FREQS.map((freq) => {
          const f = ctx.createBiquadFilter();
          f.type = 'peaking';
          f.frequency.value = freq;
          f.Q.value = 1.4;
          f.gain.value = 0;
          return f;
        });

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;

        // Chain: source -> bass -> mid -> treble -> [10 bands] -> analyser -> destination
        source.connect(bassFilter);
        bassFilter.connect(midFilter);
        midFilter.connect(trebleFilter);
        let lastNode: AudioNode = trebleFilter;
        for (const af of advFilters) {
          lastNode.connect(af);
          lastNode = af;
        }
        lastNode.connect(analyser);
        analyser.connect(ctx.destination);

        audioContextRef.current = ctx;
        sourceNodeRef.current = source;
        eqNodesRef.current = { bass: bassFilter, mid: midFilter, treble: trebleFilter };
        advancedEqNodesRef.current = advFilters;
        setAnalyserNode(analyser);

        // Load saved EQ from localStorage
        try {
          const savedEq = localStorage.getItem('jukebox_eq');
          const savedPreset = localStorage.getItem('jukebox_eq_preset');
          const savedMode = localStorage.getItem('jukebox_eq_mode');
          const savedAdvEq = localStorage.getItem('jukebox_eq_adv');
          const savedAdvPreset = localStorage.getItem('jukebox_eq_adv_preset');
          const mode = savedMode === 'advanced' ? 'advanced' : 'simple';
          setEqModeState(mode);

          if (savedEq) {
            const parsed = JSON.parse(savedEq);
            if (mode === 'simple') {
              bassFilter.gain.value = parsed.bass ?? 0;
              midFilter.gain.value = parsed.mid ?? 0;
              trebleFilter.gain.value = parsed.treble ?? 0;
            }
            setEqGains(parsed);
          }
          if (savedPreset) setEqPresetState(savedPreset);

          if (savedAdvEq) {
            const advGains = JSON.parse(savedAdvEq);
            if (mode === 'advanced') {
              advFilters.forEach((f, i) => { f.gain.value = advGains[i] ?? 0; });
              // Zero out 3-band in advanced mode
              bassFilter.gain.value = 0;
              midFilter.gain.value = 0;
              trebleFilter.gain.value = 0;
            }
            setAdvancedEqGains(advGains);
          }
          if (savedAdvPreset) setAdvancedEqPresetState(savedAdvPreset);
        } catch { /* ignore */ }

        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      } catch (e) {
        console.warn('Web Audio init failed:', e);
      }
    };

    // Try immediately, and also on first user interaction
    initAudio();
    const handleInteraction = () => {
      initAudio();
      // Also resume if suspended
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    document.addEventListener('pointerdown', handleInteraction, { once: false });
    document.addEventListener('keydown', handleInteraction, { once: false });

    return () => {
      document.removeEventListener('pointerdown', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Resume AudioContext whenever playback starts
  useEffect(() => {
    if (isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
  }, [isPlaying]);

  const playTrack = useCallback((track: TrackInfo) => {
    setCurrentTrack(track);
    setQueue([track]);
    setQueueIndex(0);
    setIsPlaying(true);
    setCurrentStationId(null);
  }, []);

  const playQueue = useCallback((tracks: TrackInfo[], startIndex: number = 0) => {
    if (!tracks?.length) return;
    setQueue(tracks);
    setQueueIndex(startIndex);
    setCurrentTrack(tracks[startIndex] ?? null);
    setIsPlaying(true);
  }, []);

  const addToQueue = useCallback((track: TrackInfo) => {
    setQueue(prev => [...(prev ?? []), track]);
  }, []);

  const playNext = useCallback((track: TrackInfo) => {
    setQueue(prev => {
      const copy = [...(prev ?? [])];
      copy.splice(queueIndex + 1, 0, track);
      return copy;
    });
  }, [queueIndex]);

  const setEqGain = useCallback((band: keyof EqGains, value: number) => {
    const nodes = eqNodesRef.current;
    if (nodes) {
      nodes[band].gain.value = value;
    }
    setEqGains(prev => {
      const updated = { ...prev, [band]: value };
      try { localStorage.setItem('jukebox_eq', JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    setEqPresetState('custom');
    try { localStorage.setItem('jukebox_eq_preset', 'custom'); } catch { /* ignore */ }
  }, []);

  const setEqPreset = useCallback((name: string) => {
    const preset = EQ_PRESETS[name];
    if (!preset) return;
    const nodes = eqNodesRef.current;
    if (nodes) {
      nodes.bass.gain.value = preset.bass;
      nodes.mid.gain.value = preset.mid;
      nodes.treble.gain.value = preset.treble;
    }
    setEqGains(preset);
    setEqPresetState(name);
    try {
      localStorage.setItem('jukebox_eq', JSON.stringify(preset));
      localStorage.setItem('jukebox_eq_preset', name);
    } catch { /* ignore */ }
  }, []);

  const setAdvancedEqGain = useCallback((index: number, value: number) => {
    const nodes = advancedEqNodesRef.current;
    if (nodes && nodes[index]) {
      nodes[index].gain.value = value;
    }
    setAdvancedEqGains(prev => {
      const updated = [...prev];
      updated[index] = value;
      try { localStorage.setItem('jukebox_eq_adv', JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    setAdvancedEqPresetState('custom');
    try { localStorage.setItem('jukebox_eq_adv_preset', 'custom'); } catch { /* ignore */ }
  }, []);

  const setAdvancedEqPreset = useCallback((name: string) => {
    const preset = EQ_10BAND_PRESETS[name];
    if (!preset) return;
    const nodes = advancedEqNodesRef.current;
    if (nodes) {
      preset.forEach((val, i) => { if (nodes[i]) nodes[i].gain.value = val; });
    }
    setAdvancedEqGains([...preset]);
    setAdvancedEqPresetState(name);
    try {
      localStorage.setItem('jukebox_eq_adv', JSON.stringify(preset));
      localStorage.setItem('jukebox_eq_adv_preset', name);
    } catch { /* ignore */ }
  }, []);

  const setEqMode = useCallback((mode: 'simple' | 'advanced') => {
    setEqModeState(mode);
    try { localStorage.setItem('jukebox_eq_mode', mode); } catch { /* ignore */ }
    const simpleNodes = eqNodesRef.current;
    const advNodes = advancedEqNodesRef.current;
    if (mode === 'simple') {
      // Restore 3-band, zero out 10-band
      if (simpleNodes) {
        simpleNodes.bass.gain.value = eqGains.bass;
        simpleNodes.mid.gain.value = eqGains.mid;
        simpleNodes.treble.gain.value = eqGains.treble;
      }
      if (advNodes) advNodes.forEach(n => { n.gain.value = 0; });
    } else {
      // Restore 10-band, zero out 3-band
      if (simpleNodes) {
        simpleNodes.bass.gain.value = 0;
        simpleNodes.mid.gain.value = 0;
        simpleNodes.treble.gain.value = 0;
      }
      if (advNodes) advNodes.forEach((n, i) => { n.gain.value = advancedEqGains[i] ?? 0; });
    }
  }, [eqGains, advancedEqGains]);

  const fetchMoreStationTracks = useCallback(async (stationId: string, existingIds: Set<string>) => {
    if (fetchingMoreRef.current) return [];
    fetchingMoreRef.current = true;
    try {
      const res = await fetch(`/api/stations/${stationId}/tracks`);
      const data = await res?.json?.();
      const newTracks: TrackInfo[] = (data?.tracks ?? [])
        .filter((t: any) => !existingIds.has(t?.id ?? ''))
        .map((t: any) => ({
          id: t?.id ?? '',
          title: t?.title ?? '',
          artistName: t?.artist?.name ?? t?.artistName ?? '',
          albumTitle: t?.album?.title ?? t?.albumTitle ?? '',
          thumb: t?.thumb ?? t?.album?.thumb ?? null,
          mediaKey: t?.mediaKey ?? null,
          duration: t?.duration ?? null,
          ratingKey: t?.ratingKey ?? '',
          year: t?.year ?? t?.album?.year ?? null,
        }));
      return newTracks;
    } catch {
      return [];
    } finally {
      fetchingMoreRef.current = false;
    }
  }, []);

  const nextTrack = useCallback(() => {
    setQueueIndex(prev => {
      const next = prev + 1;
      if (next < (queue?.length ?? 0)) {
        setCurrentTrack(queue?.[next] ?? null);
        setIsPlaying(true);
        return next;
      }
      return prev;
    });
  }, [queue]);

  useEffect(() => {
    if (!currentStationId || queueIndex < 0) return;
    const remaining = queue.length - queueIndex - 1;
    if (remaining <= 3) {
      const existingIds = new Set(queue.map(t => t.id));
      fetchMoreStationTracks(currentStationId, existingIds).then(newTracks => {
        if (newTracks.length > 0) {
          setQueue(prev => [...prev, ...newTracks]);
        }
      });
    }
  }, [queueIndex, currentStationId, queue.length, fetchMoreStationTracks, queue]);

  const prevTrack = useCallback(() => {
    setQueueIndex(prev => {
      const next = prev - 1;
      if (next >= 0) {
        setCurrentTrack(queue?.[next] ?? null);
        setIsPlaying(true);
        return next;
      }
      return prev;
    });
  }, [queue]);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef?.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (audioRef?.current) {
      audioRef.current.volume = vol;
    }
  }, []);

  // Track play counts - record after 30s of playback
  const playRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentTrack?.id) return;
    // Reset when track changes
    playRecordedRef.current = null;
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack?.id || !isPlaying) return;
    if (playRecordedRef.current === currentTrack.id) return;
    if (currentTime >= 30) {
      playRecordedRef.current = currentTrack.id;
      fetch('/api/tracks/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: currentTrack.id }),
      }).catch(() => {});
    }
  }, [currentTrack?.id, currentTime, isPlaying]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    if (currentTrack?.mediaKey) {
      audio.src = `/api/plex/stream?key=${encodeURIComponent(currentTrack.mediaKey)}`;
      audio.volume = volume;
      if (isPlaying) {
        audio.play?.()?.catch?.(() => {});
      }
    }
  }, [currentTrack?.mediaKey]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play?.()?.catch?.(() => {});
    } else {
      audio.pause?.();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio?.currentTime ?? 0);
    const onDurationChange = () => setDuration(audio?.duration ?? 0);
    const onEnded = () => nextTrack();
    const onError = () => console.error('Audio playback error');

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [nextTrack]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        currentTime,
        duration,
        volume,
        currentStationId,
        currentStationName,
        queueIndex,
        playTrack,
        playQueue,
        addToQueue,
        playNext,
        nextTrack,
        prevTrack,
        togglePlay,
        seek,
        setVolume,
        setCurrentStationId,
        setCurrentStationName,
        audioRef,
        analyserNode,
        eqGains,
        setEqGain,
        setEqPreset,
        eqPreset,
        eqMode,
        setEqMode,
        advancedEqGains,
        setAdvancedEqGain,
        setAdvancedEqPreset,
        advancedEqPreset,
      }}
    >
      {children}
      <audio ref={audioRef} preload="auto" />
    </PlayerContext.Provider>
  );
}
