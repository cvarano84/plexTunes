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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTrack = useCallback((track: TrackInfo) => {
    setCurrentTrack(track);
    setQueue([track]);
    setQueueIndex(0);
    setIsPlaying(true);
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
        playTrack,
        playQueue,
        addToQueue,
        nextTrack,
        prevTrack,
        togglePlay,
        seek,
        setVolume,
        audioRef,
      }}
    >
      {children}
      <audio ref={audioRef} preload="auto" />
    </PlayerContext.Provider>
  );
}
