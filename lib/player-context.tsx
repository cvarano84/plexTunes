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
}

interface PlayerState {
  currentTrack: TrackInfo | null;
  queue: TrackInfo[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  currentStationId: string | null;
  queueIndex: number;
}

interface PlayerContextType extends PlayerState {
  playTrack: (track: TrackInfo) => void;
  playQueue: (tracks: TrackInfo[], startIndex?: number) => void;
  addToQueue: (track: TrackInfo) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setCurrentStationId: (id: string | null) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fetchingMoreRef = useRef(false);

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

  // Fetch more tracks from station when running low
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

  // Auto-fetch more tracks when nearing end of station queue
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

  // Handle audio element
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
        queueIndex,
        playTrack,
        playQueue,
        addToQueue,
        nextTrack,
        prevTrack,
        togglePlay,
        seek,
        setVolume,
        setCurrentStationId,
        audioRef,
      }}
    >
      {children}
      <audio ref={audioRef} preload="auto" />
    </PlayerContext.Provider>
  );
}
