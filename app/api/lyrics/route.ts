export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { searchGeniusSong, fetchLyricsFromGenius } from '@/lib/genius';

// Try LRCLIB first for synced lyrics (free, no API key needed)
async function fetchFromLrclib(title: string, artist: string, album?: string, durationSec?: number): Promise<{
  syncedLyrics: string | null;
  plainLyrics: string | null;
}> {
  try {
    // Try exact match with /api/get first (requires duration)
    if (durationSec && durationSec > 0) {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
        ...(album ? { album_name: album } : {}),
        duration: String(Math.round(durationSec)),
      });
      const res = await fetch(`https://lrclib.net/api/get?${params}`, {
        headers: { 'User-Agent': 'PlexJukebox/1.0 (https://github.com/gilligan5000/plexTunes)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.syncedLyrics || data?.plainLyrics) {
          return { syncedLyrics: data.syncedLyrics ?? null, plainLyrics: data.plainLyrics ?? null };
        }
      }
    }

    // Fall back to search if exact match fails
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams}`, {
      headers: { 'User-Agent': 'PlexJukebox/1.0 (https://github.com/gilligan5000/plexTunes)' },
    });
    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        // Find best match - prefer synced lyrics
        const withSynced = results.find((r: any) => r?.syncedLyrics);
        const best = withSynced ?? results[0];
        return { syncedLyrics: best?.syncedLyrics ?? null, plainLyrics: best?.plainLyrics ?? null };
      }
    }

    return { syncedLyrics: null, plainLyrics: null };
  } catch (e: any) {
    console.error('LRCLIB error:', e?.message);
    return { syncedLyrics: null, plainLyrics: null };
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const title = searchParams?.get?.('title') ?? '';
    const artist = searchParams?.get?.('artist') ?? '';
    const album = searchParams?.get?.('album') ?? '';
    const durationMs = parseInt(searchParams?.get?.('duration') ?? '0', 10);
    const durationSec = durationMs > 0 ? Math.round(durationMs / 1000) : 0;

    if (!title || !artist) {
      return NextResponse.json({ error: 'Title and artist required' }, { status: 400 });
    }

    // 1. Try LRCLIB first (synced lyrics)
    const lrclib = await fetchFromLrclib(title, artist, album || undefined, durationSec || undefined);

    if (lrclib.syncedLyrics) {
      return NextResponse.json({
        lyrics: lrclib.plainLyrics ?? lrclib.syncedLyrics,
        syncedLyrics: lrclib.syncedLyrics,
        source: 'lrclib',
        debug: { lrclib: true, synced: true },
      });
    }

    if (lrclib.plainLyrics) {
      return NextResponse.json({
        lyrics: lrclib.plainLyrics,
        syncedLyrics: null,
        source: 'lrclib',
        debug: { lrclib: true, synced: false },
      });
    }

    // 2. Fall back to Genius (plain lyrics only)
    const searchResult = await searchGeniusSong(title, artist);

    if (!searchResult.song) {
      return NextResponse.json({
        lyrics: null,
        syncedLyrics: null,
        source: null,
        message: searchResult.error ?? 'No lyrics found',
        debug: {
          lrclib: false,
          tokenValid: searchResult.tokenValid,
          searchWorked: searchResult.searchWorked,
          error: searchResult.error,
        }
      });
    }

    const lyricsResult = await fetchLyricsFromGenius(searchResult.song?.url ?? '');

    return NextResponse.json({
      lyrics: lyricsResult.lyrics ?? null,
      syncedLyrics: null,
      source: 'genius',
      songInfo: {
        title: searchResult.song?.title ?? title,
        artist: searchResult.song?.primary_artist?.name ?? artist,
        geniusUrl: searchResult.song?.url ?? null,
      },
      debug: {
        lrclib: false,
        tokenValid: searchResult.tokenValid,
        searchWorked: searchResult.searchWorked,
        geniusUrl: searchResult.song?.url,
        scrapeError: lyricsResult.error,
      }
    });
  } catch (e: any) {
    console.error('Lyrics error:', e?.message);
    return NextResponse.json({ lyrics: null, syncedLyrics: null, error: 'Failed to fetch lyrics', debug: { error: e?.message } });
  }
}